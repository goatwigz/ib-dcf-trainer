/*
Local-only progress tracking. No accounts, no backend — everything
lives in localStorage on the student's device. Two keys are used:
  ibdcf.progress   — the persistent stats store (streaks, accuracy,
                      speed, seen-type tracking, per-step weak spots)
  ibdcf.inprogress — the current unfinished problem's state, so a
                      refresh or back-button tap doesn't lose work
*/

(function (root) {
  "use strict";

  const PROGRESS_KEY = "ibdcf.progress";
  const INPROGRESS_KEY = "ibdcf.inprogress";
  const SCHEMA_VERSION = 1;

  function emptyProgress() {
    return {
      version: SCHEMA_VERSION,
      totalProblems: 0,
      totalFollowUpsCorrect: 0,
      totalFollowUpsSeen: 0,
      currentStreak: 0,
      bestStreak: 0,
      score: 0,
      completionTimesSeconds: [], // only timed (previously-seen) completions
      // stepStats keyed by a generic field-type label, e.g. "Discount Factor"
      stepStats: {},
      // categoryStats keyed by topic ("dcf" | "wacc" | "beta" | "fcf") — kept
      // separate from stepStats because some field labels (e.g. "Re-levered
      // Beta") are shared between WACC and Beta drills, so per-label stats
      // alone can't tell mastery of one topic from the other.
      categoryStats: {},
      seenTypes: {}, // e.g. "dcf:gordon:easy" -> true
      shownMilestones: {}, // e.g. "problems_10" -> true, so it only fires once
      sessions: [], // [{startedAt, endedAt, problemsSolved}]
    };
  }

  function categoryBucket(progress, category) {
    if (!progress.categoryStats[category]) {
      progress.categoryStats[category] = {
        problems: 0,
        stepAttempts: 0,
        stepCorrectFirstTry: 0,
        timesSec: [],
      };
    }
    return progress.categoryStats[category];
  }

  function load() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return emptyProgress();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SCHEMA_VERSION) return emptyProgress();
      return Object.assign(emptyProgress(), parsed);
    } catch (e) {
      return emptyProgress();
    }
  }

  function save(progress) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (e) {
      // localStorage unavailable (private browsing, quota, etc.) — the
      // session still works, it just won't persist. Nothing to do here.
    }
  }

  function hasSeen(progress, key) {
    return !!progress.seenTypes[key];
  }

  function markSeen(progress, key) {
    progress.seenTypes[key] = true;
  }

  // Record one field-level check (correct or not) against a human label
  // (e.g. "Discount Factor", "Present Value") so weak spots can be
  // surfaced without caring which underlying engine produced them, and
  // against its topic category for per-topic mastery tracking.
  function recordStepAttempt(progress, category, label, correct) {
    if (!progress.stepStats[label]) {
      progress.stepStats[label] = { correctFirstTry: 0, attempts: 0 };
    }
    const s = progress.stepStats[label];
    s.attempts += 1;
    if (correct) s.correctFirstTry += 1;

    const cat = categoryBucket(progress, category);
    cat.stepAttempts += 1;
    if (correct) cat.stepCorrectFirstTry += 1;
  }

  function recordProblemCompletion(progress, category, { allFirstTryCorrect, timedSeconds }) {
    progress.totalProblems += 1;
    if (allFirstTryCorrect) {
      progress.currentStreak += 1;
      progress.bestStreak = Math.max(progress.bestStreak, progress.currentStreak);
    } else {
      progress.currentStreak = 0;
    }
    if (timedSeconds !== undefined && timedSeconds !== null) {
      progress.completionTimesSeconds.push(timedSeconds);
    }

    const cat = categoryBucket(progress, category);
    cat.problems += 1;
    if (timedSeconds !== undefined && timedSeconds !== null) {
      cat.timesSec.push(timedSeconds);
    }
  }

  function recordFollowUp(progress, correct) {
    progress.totalFollowUpsSeen += 1;
    if (correct) progress.totalFollowUpsCorrect += 1;
  }

  // Score: only timed attempts count (the untimed first exposure is a
  // learning pass, not a scored one). Getting a step right first try is
  // worth more than getting there after a wrong attempt or two.
  function addScore(progress, points) {
    progress.score += points;
    return progress.score;
  }

  const POINTS_FIRST_TRY = 10;
  const POINTS_AFTER_RETRY = 4;
  const POINTS_FOLLOWUP = 15;

  // Coarse, locally-computed mastery tier per topic. Thresholds are a
  // starting heuristic, not a tuned model — easy to adjust once real
  // usage data exists.
  function masteryTier(progress, category) {
    const cat = progress.categoryStats[category];
    if (!cat || cat.problems < 3) return "learning";
    const accuracy = cat.stepAttempts === 0 ? 0 : cat.stepCorrectFirstTry / cat.stepAttempts;
    const avgSpeed = cat.timesSec.length ? cat.timesSec.reduce((a, b) => a + b, 0) / cat.timesSec.length : null;
    if (cat.problems >= 10 && accuracy >= 0.9 && avgSpeed !== null && avgSpeed <= 90) return "fluent";
    if (cat.problems >= 5 && accuracy >= 0.7) return "practiced";
    return "learning";
  }

  const MILESTONE_DEFS = [
    { id: "problems_10", label: "10 problems solved.", check: (p) => p.totalProblems >= 10 },
    { id: "problems_25", label: "25 problems solved.", check: (p) => p.totalProblems >= 25 },
    { id: "problems_50", label: "50 problems solved.", check: (p) => p.totalProblems >= 50 },
    { id: "streak_5", label: "5 in a row.", check: (p) => p.bestStreak >= 5 },
    { id: "streak_10", label: "10 in a row.", check: (p) => p.bestStreak >= 10 },
    { id: "fast_30", label: "First sub-30-second solve.", check: (p) => p.completionTimesSeconds.some((t) => t <= 30) },
  ];

  // Returns labels for any milestone crossed for the first time just now
  // (and marks them shown, so each one only ever fires once).
  function checkMilestones(progress) {
    const newly = [];
    MILESTONE_DEFS.forEach((m) => {
      if (!progress.shownMilestones[m.id] && m.check(progress)) {
        progress.shownMilestones[m.id] = true;
        newly.push(m.label);
      }
    });
    return newly;
  }

  // Returns the step label(s) the student struggles with most (lowest
  // first-try accuracy among labels with a meaningful sample size).
  // Only ever surfaces steps with genuine room to improve (accuracy
  // below 100%) — a step the student has aced so far shouldn't show up
  // under "room to improve" just because it's the least-worst of a
  // small sample.
  function weakestSteps(progress, minAttempts) {
    const min = minAttempts || 3;
    const entries = Object.entries(progress.stepStats)
      .filter(([, s]) => s.attempts >= min && s.correctFirstTry < s.attempts)
      .map(([label, s]) => ({ label, accuracy: s.correctFirstTry / s.attempts, attempts: s.attempts }))
      .sort((a, b) => a.accuracy - b.accuracy);
    return entries.slice(0, 3);
  }

  function overallAccuracy(progress) {
    const total = Object.values(progress.stepStats).reduce((s, v) => s + v.attempts, 0);
    const correct = Object.values(progress.stepStats).reduce((s, v) => s + v.correctFirstTry, 0);
    return total === 0 ? null : correct / total;
  }

  function averageSpeedSeconds(progress) {
    if (progress.completionTimesSeconds.length === 0) return null;
    const sum = progress.completionTimesSeconds.reduce((a, b) => a + b, 0);
    return sum / progress.completionTimesSeconds.length;
  }

  // ---- In-progress state (refresh/back-button recovery) ----------------

  function saveInProgress(state) {
    try {
      localStorage.setItem(INPROGRESS_KEY, JSON.stringify(state));
    } catch (e) {
      /* ignore */
    }
  }

  function loadInProgress() {
    try {
      const raw = localStorage.getItem(INPROGRESS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearInProgress() {
    try {
      localStorage.removeItem(INPROGRESS_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  // ---- Export / import ---------------------------------------------------

  function exportJSON(progress) {
    return JSON.stringify(progress, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid progress file");
    return Object.assign(emptyProgress(), parsed);
  }

  const ProgressStore = {
    load,
    save,
    hasSeen,
    markSeen,
    recordStepAttempt,
    recordProblemCompletion,
    recordFollowUp,
    weakestSteps,
    overallAccuracy,
    averageSpeedSeconds,
    addScore,
    masteryTier,
    checkMilestones,
    POINTS_FIRST_TRY,
    POINTS_AFTER_RETRY,
    POINTS_FOLLOWUP,
    saveInProgress,
    loadInProgress,
    clearInProgress,
    exportJSON,
    importJSON,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ProgressStore;
  } else {
    root.ProgressStore = ProgressStore;
  }
})(typeof window !== "undefined" ? window : globalThis);
