(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const progress = ProgressStore.load();

  const session = { tier: "easy", active: false, solvedCount: 0, timesSec: [] };

  // Current-problem-scoped state, rebuilt each time nextProblem() runs.
  let current = null;
  let timerInterval = null;
  let timerBaseElapsed = 0; // seconds already elapsed before this tick started (for restore)

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // -----------------------------------------------------------------
  // Setup screen
  // -----------------------------------------------------------------

  function initSetup() {
    document.querySelectorAll(".tier-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tier-btn").forEach((b) => b.setAttribute("aria-checked", "false"));
        btn.setAttribute("aria-checked", "true");
        session.tier = btn.dataset.tier;
      });
    });
    $("#start-btn").addEventListener("click", startSession);
  }

  function startSession() {
    session.active = true;
    session.solvedCount = 0;
    session.timesSec = [];
    $("#setup-section").hidden = true;
    $("#summary-section").hidden = true;
    nextProblem();
  }

  // -----------------------------------------------------------------
  // Problem generation & rendering
  // -----------------------------------------------------------------

  function nextProblem() {
    const typeChoice = pickRandom(ProblemAdapters.PROBLEM_TYPES);
    const { category, problem } = ProblemAdapters.generateProblem(typeChoice.category, typeChoice.subtype, session.tier);
    beginProblem(category, problem, "table", {}, 0, 0, true, null, 0, undefined);
  }

  // Shared entry point for both a freshly generated problem and one
  // restored from a saved in-progress snapshot.
  //
  // timedOverride: when restoring an in-progress problem, the
  // untimed-first/timed-after decision must be whatever it was when the
  // problem was ORIGINALLY generated, not recomputed now — by the time
  // of a restore, ProgressStore already has this type marked seen (from
  // the original render), so recomputing here would wrongly flip a
  // first-exposure untimed problem to timed just because the page
  // reloaded. Pass the saved value through instead of recomputing it.
  function beginProblem(category, problem, stage, results, correctCount, elapsedSec, allFirstTryCorrect, followUpsState, timerBase, timedOverride) {
    const adapted = ProblemAdapters.adapt(category, problem);
    const key = ProblemAdapters.seenKey(category, problem, session.tier);
    let timed;
    if (timedOverride !== undefined) {
      timed = timedOverride;
    } else {
      timed = ProgressStore.hasSeen(progress, key);
      if (!timed) {
        ProgressStore.markSeen(progress, key);
        ProgressStore.save(progress);
      }
    }

    current = {
      category,
      problem,
      adapted,
      seenKey: key,
      timed,
      elapsedSec: elapsedSec || 0,
      results: results || {},
      totalBlank: 0,
      correctCount: correctCount || 0,
      allFirstTryCorrect: allFirstTryCorrect !== false,
      followUps: (followUpsState && followUpsState.followUps) || [],
      followUpIndex: (followUpsState && followUpsState.followUpIndex) || 0,
      followUpAllCorrect: (followUpsState && followUpsState.followUpAllCorrect) !== false,
    };
    timerBaseElapsed = timerBase || 0;

    if (stage === "followups") {
      renderProblem({ skipReset: true, restoreResults: true });
      lockResolvedFields();
      $("#followup-section").hidden = false;
      renderFollowUp();
    } else if (stage === "explain") {
      renderProblem({ skipReset: true, restoreResults: true });
      lockResolvedFields();
      showExplainBox();
    } else {
      renderProblem({});
      if (results) restoreFieldStates();
    }
  }

  function renderProblem(opts) {
    $("#problem-section").hidden = false;
    $("#followup-section").hidden = true;
    $("#explain-section").hidden = true;
    $("#summary-section").hidden = true;

    const timerEl = $("#timer");
    stopTimer();
    if (current.timed) {
      timerEl.hidden = false;
      timerEl.textContent = fmtTime(timerBaseElapsed);
      startTimer();
    } else {
      timerEl.hidden = true;
    }

    $("#problem-prompt").textContent =
      current.adapted.title + (current.timed ? "" : " — first time seeing this type, so it's untimed.");

    $("#problem-givens").innerHTML =
      "<ul>" + current.adapted.givenLines.map((l) => "<li>" + escapeHtml(l) + "</li>").join("") + "</ul>";

    const tableHead = $("#table-head");
    const container = $("#problem-groups");
    container.innerHTML = "";
    container.className = current.adapted.layout === "table" ? "layout-table" : "layout-steplist";

    if (current.adapted.layout === "table") {
      tableHead.className = "table-head layout-table";
      tableHead.innerHTML = "<span>Year</span><span>Cash Flow ($m)</span><span>Discount Factor</span><span>Present Value ($m)</span>";
      tableHead.hidden = false;
    } else {
      tableHead.hidden = true;
      tableHead.innerHTML = "";
      tableHead.className = "table-head";
    }

    current.totalBlank = 0;
    if (!opts || !opts.skipReset) current.correctCount = 0;

    current.adapted.groups.forEach((group) => {
      const isYearRow = current.adapted.layout === "table" && /^Year \d+$/.test(group.label);
      const block = document.createElement("div");

      if (!isYearRow) {
        block.className = "group-block";
        const labelEl = document.createElement("div");
        labelEl.className = "group-label";
        labelEl.textContent = group.label;
        block.appendChild(labelEl);
      }

      const row = document.createElement("div");
      row.className = "table-row" + (isYearRow ? " is-year-row" : "");
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", group.label);

      if (isYearRow) {
        const yearSpan = document.createElement("span");
        yearSpan.className = "row-year";
        yearSpan.textContent = group.label;
        row.appendChild(yearSpan);
      }

      group.fields.forEach((field) => {
        row.appendChild(buildFieldEl(field));
      });

      block.appendChild(row);
      container.appendChild(block);
    });

    $("#step-feedback").textContent = "";
    updateProgressBar();

    if (!opts || !opts.restoreResults) {
      const firstInput = container.querySelector("input");
      if (firstInput) firstInput.focus();
    }

    saveInProgressSnapshot("table");
  }

  // After a table-layout render, re-mark previously-resolved fields as
  // correct/locked (used when restoring into the follow-up/explain stage).
  function lockResolvedFields() {
    Object.keys(current.results).forEach((key) => {
      const rec = current.results[key];
      if (!rec.resolved) return;
      const input = $("#input-" + key);
      const fieldEl = $("#field-" + key);
      const status = $("#input-" + key + "-status");
      if (input) {
        input.readOnly = true;
        input.value = "";
        fieldEl.classList.add("is-correct");
        if (status) {
          status.textContent = "Correct";
          status.className = "field-status correct";
        }
      }
    });
  }

  // After a fresh render (not restoring into follow-ups), re-fill and
  // lock any fields the student had already gotten right pre-refresh.
  function restoreFieldStates() {
    let restoredCount = 0;
    Object.keys(current.results).forEach((key) => {
      const rec = current.results[key];
      if (!rec.resolved) return;
      const input = $("#input-" + key);
      const fieldEl = $("#field-" + key);
      const status = $("#input-" + key + "-status");
      if (input) {
        input.readOnly = true;
        fieldEl.classList.add("is-correct");
        if (status) {
          status.textContent = "Correct (restored)";
          status.className = "field-status correct";
        }
        restoredCount++;
      }
    });
    current.correctCount = restoredCount;
    updateProgressBar();
  }

  function buildFieldEl(field) {
    const fieldEl = document.createElement("div");
    fieldEl.className = "field";
    fieldEl.id = "field-" + field.key;

    const inputId = "input-" + field.key;
    const labelEl = document.createElement("label");
    labelEl.className = "field-label";
    labelEl.textContent = field.label + (field.unit ? " (" + field.unit + ")" : field.isPercent ? " (%)" : "");
    labelEl.htmlFor = inputId;
    fieldEl.appendChild(labelEl);

    if (field.given) {
      const val = document.createElement("div");
      val.className = "field-value-given";
      val.textContent = Number(field.value).toFixed(field.decimals);
      val.id = inputId;
      fieldEl.appendChild(val);
      return fieldEl;
    }

    current.totalBlank++;

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.id = inputId;
    input.autocomplete = "off";
    input.setAttribute("aria-describedby", inputId + "-status");
    fieldEl.appendChild(input);

    const status = document.createElement("div");
    status.className = "field-status";
    status.id = inputId + "-status";
    status.setAttribute("aria-live", "polite");
    fieldEl.appendChild(status);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        checkField(field, input, status, fieldEl);
      }
    });
    input.addEventListener("blur", () => {
      if (input.value.trim() !== "" && !fieldEl.classList.contains("is-correct")) {
        checkField(field, input, status, fieldEl);
      }
    });

    return fieldEl;
  }

  function checkField(field, input, status, fieldEl) {
    const raw = input.value.trim();
    if (raw === "") return;
    const parsed = parseFloat(raw.replace(/,/g, ""));
    if (Number.isNaN(parsed)) {
      status.textContent = "Enter a number";
      status.className = "field-status incorrect";
      fieldEl.classList.add("is-incorrect");
      return;
    }

    const value = field.isPercent ? parsed / 100 : parsed;
    const result = current.adapted.checkStep(current.problem, field.key, value);

    if (!current.results[field.key]) current.results[field.key] = { attemptedOnce: false, resolved: false };
    const rec = current.results[field.key];
    if (!rec.attemptedOnce) {
      rec.attemptedOnce = true;
      ProgressStore.recordStepAttempt(progress, field.label, result.correct);
      if (!result.correct) current.allFirstTryCorrect = false;
      ProgressStore.save(progress);
    }

    if (result.correct) {
      fieldEl.classList.add("is-correct");
      fieldEl.classList.remove("is-incorrect");
      status.textContent = "Correct";
      status.className = "field-status correct";
      input.readOnly = true;
      if (!rec.resolved) {
        rec.resolved = true;
        current.correctCount++;
      }
      updateProgressBar();
      advanceFocus(input);
      saveInProgressSnapshot("table");
      if (current.correctCount === current.totalBlank) finishTable();
    } else {
      fieldEl.classList.add("is-incorrect");
      fieldEl.classList.remove("is-correct");
      status.textContent = "Not quite — try again";
      status.className = "field-status incorrect";
      saveInProgressSnapshot("table");
    }
  }

  function advanceFocus(fromInput) {
    const inputs = Array.from($("#problem-groups").querySelectorAll("input"));
    const idx = inputs.indexOf(fromInput);
    for (let i = idx + 1; i < inputs.length; i++) {
      if (!inputs[i].readOnly) {
        inputs[i].focus();
        return;
      }
    }
  }

  function updateProgressBar() {
    const pct = current.totalBlank === 0 ? 100 : (current.correctCount / current.totalBlank) * 100;
    $("#progress-fill").style.width = pct + "%";
  }

  // -----------------------------------------------------------------
  // Timer
  // -----------------------------------------------------------------

  function startTimer() {
    const start = Date.now();
    const base = timerBaseElapsed;
    timerInterval = setInterval(() => {
      current.elapsedSec = base + (Date.now() - start) / 1000;
      $("#timer").textContent = fmtTime(current.elapsedSec);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // -----------------------------------------------------------------
  // Follow-ups
  // -----------------------------------------------------------------

  function finishTable() {
    stopTimer();
    current.followUps = current.adapted.generateFollowUps(current.problem);
    current.followUpIndex = 0;
    $("#followup-section").hidden = false;
    renderFollowUp();
    saveInProgressSnapshot("followups");
  }

  function renderFollowUp() {
    const fu = current.followUps[current.followUpIndex];
    $("#followup-heading").textContent = "Follow-up " + (current.followUpIndex + 1) + " of " + current.followUps.length;
    $("#followup-prompt").textContent = fu.prompt;

    const inputsEl = $("#followup-inputs");
    inputsEl.innerHTML = "";

    if (fu.valueKind === "choice") {
      const label = document.createElement("label");
      label.textContent = "Your answer";
      label.htmlFor = "fu-choice";
      const select = document.createElement("select");
      select.id = "fu-choice";
      select.innerHTML =
        '<option value="">Choose one</option>' +
        fu.choices.map((c) => '<option value="' + c.value + '">' + escapeHtml(c.label) + "</option>").join("");
      inputsEl.appendChild(label);
      inputsEl.appendChild(select);
    } else {
      const label = document.createElement("label");
      label.textContent = "New value" + (fu.valueKind === "percent" ? " (%)" : "");
      label.htmlFor = "fu-value";
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.id = "fu-value";
      input.autocomplete = "off";
      inputsEl.appendChild(label);
      inputsEl.appendChild(input);

      if (fu.correctDirection !== undefined) {
        const dirLabel = document.createElement("label");
        dirLabel.textContent = "Direction";
        dirLabel.htmlFor = "fu-direction";
        const dirSelect = document.createElement("select");
        dirSelect.id = "fu-direction";
        dirSelect.innerHTML = '<option value="">Choose one</option><option value="up">Up</option><option value="down">Down</option>';
        inputsEl.appendChild(dirLabel);
        inputsEl.appendChild(dirSelect);
      }
    }

    $("#followup-feedback").textContent = "";
    $("#followup-feedback").className = "step-feedback";
    $("#followup-submit").textContent = "Check answer";
    $("#followup-submit").onclick = checkFollowUpAnswer;

    const firstInput = inputsEl.querySelector("input, select");
    if (firstInput) firstInput.focus();
  }

  function checkFollowUpAnswer() {
    const fu = current.followUps[current.followUpIndex];
    const feedbackEl = $("#followup-feedback");
    let correct;

    if (fu.valueKind === "choice") {
      const choice = $("#fu-choice").value;
      if (!choice) return;
      correct = choice === fu.correctAnswer;
    } else {
      const raw = $("#fu-value").value.trim();
      if (raw === "") return;
      const parsed = parseFloat(raw.replace(/,/g, ""));
      if (Number.isNaN(parsed)) {
        feedbackEl.textContent = "Enter a number";
        feedbackEl.className = "step-feedback incorrect";
        return;
      }
      const value = fu.valueKind === "percent" ? parsed / 100 : parsed;
      const valueCorrect = Math.abs(value - fu.correctValue) <= fu.tolerance;

      let directionCorrect = true;
      if (fu.correctDirection !== undefined) {
        const dir = $("#fu-direction").value;
        if (!dir) return;
        directionCorrect = dir === fu.correctDirection;
      }
      correct = valueCorrect && directionCorrect;
    }

    ProgressStore.recordFollowUp(progress, correct);
    ProgressStore.save(progress);
    if (!correct) current.followUpAllCorrect = false;

    if (correct) {
      feedbackEl.textContent = "Correct.";
      feedbackEl.className = "step-feedback correct";
    } else {
      feedbackEl.textContent = "Not quite.";
      feedbackEl.className = "step-feedback incorrect";
    }

    $("#followup-submit").textContent =
      current.followUpIndex + 1 < current.followUps.length ? "Next follow-up" : "Continue";
    $("#followup-submit").onclick = advanceFollowUp;
    saveInProgressSnapshot("followups");
  }

  function advanceFollowUp() {
    current.followUpIndex++;
    if (current.followUpIndex < current.followUps.length) {
      renderFollowUp();
      saveInProgressSnapshot("followups");
    } else {
      showExplainBox();
    }
  }

  // -----------------------------------------------------------------
  // Self-explain (ungraded)
  // -----------------------------------------------------------------

  function showExplainBox() {
    $("#followup-section").hidden = true;
    $("#explain-section").hidden = false;
    $("#explain-box").value = "";
    $("#explain-continue").onclick = completeProblem;
    saveInProgressSnapshot("explain");
    $("#explain-box").focus();
  }

  // -----------------------------------------------------------------
  // Problem completion & session flow
  // -----------------------------------------------------------------

  function completeProblem() {
    $("#explain-section").hidden = true;

    const timedSeconds = current.timed ? current.elapsedSec : null;
    ProgressStore.recordProblemCompletion(progress, {
      allFirstTryCorrect: current.allFirstTryCorrect && current.followUpAllCorrect,
      timedSeconds,
    });
    ProgressStore.save(progress);
    ProgressStore.clearInProgress();

    session.solvedCount++;
    if (timedSeconds !== null) session.timesSec.push(timedSeconds);

    updateStatsStrip();
    showSummary();
  }

  function showSummary() {
    $("#problem-section").hidden = true;
    $("#summary-section").hidden = false;

    const accuracy = ProgressStore.overallAccuracy(progress);
    const avgSpeed = ProgressStore.averageSpeedSeconds(progress);

    const stats = [
      { label: "Solved this session", value: String(session.solvedCount) },
      { label: "Streak", value: String(progress.currentStreak) },
      { label: "Accuracy", value: accuracy === null ? "—" : Math.round(accuracy * 100) + "%" },
      { label: "Avg. speed", value: avgSpeed === null ? "—" : fmtTime(avgSpeed) },
    ];

    $("#summary-stats").innerHTML = stats
      .map(
        (s) =>
          '<div class="stat-tile"><div class="stat-value">' +
          escapeHtml(s.value) +
          '</div><div class="stat-label">' +
          escapeHtml(s.label) +
          "</div></div>"
      )
      .join("");

    const weak = ProgressStore.weakestSteps(progress, 3);
    const weakEl = document.createElement("div");
    weakEl.className = "weak-steps";
    if (weak.length > 0) {
      weakEl.textContent =
        "Room to improve: " + weak.map((w) => w.label + " (" + Math.round(w.accuracy * 100) + "%)").join(", ");
    }
    $("#summary-stats").appendChild(weakEl);

    $("#continue-session-btn").onclick = nextProblem;
    $("#end-session-btn").onclick = endSession;

    let shareBtn = $("#share-card-btn");
    if (!shareBtn) {
      shareBtn = document.createElement("button");
      shareBtn.type = "button";
      shareBtn.id = "share-card-btn";
      shareBtn.className = "btn btn-secondary";
      shareBtn.textContent = "Download result card";
      $(".summary-actions").appendChild(shareBtn);
    }
    shareBtn.onclick = downloadShareCard;

    $("#continue-session-btn").focus();
  }

  function endSession() {
    $("#summary-section").hidden = true;
    $("#setup-section").hidden = false;
    session.active = false;
  }

  // -----------------------------------------------------------------
  // Persistent stats strip (visible once any progress exists)
  // -----------------------------------------------------------------

  function updateStatsStrip() {
    const strip = $("#stats-strip");
    if (progress.totalProblems === 0) {
      strip.hidden = true;
      return;
    }
    const accuracy = ProgressStore.overallAccuracy(progress);
    const avgSpeed = ProgressStore.averageSpeedSeconds(progress);
    strip.hidden = false;
    strip.innerHTML =
      '<span>Streak <span class="stat-value">' + progress.currentStreak + "</span></span>" +
      '<span>Best streak <span class="stat-value">' + progress.bestStreak + "</span></span>" +
      '<span>Accuracy <span class="stat-value">' + (accuracy === null ? "—" : Math.round(accuracy * 100) + "%") + "</span></span>" +
      '<span>Avg. speed <span class="stat-value">' + (avgSpeed === null ? "—" : fmtTime(avgSpeed)) + "</span></span>" +
      '<span><button type="button" id="export-progress-btn" class="btn-link">Export progress</button></span>' +
      '<span><button type="button" id="import-progress-btn" class="btn-link">Import progress</button></span>';

    $("#export-progress-btn").onclick = exportProgress;
    $("#import-progress-btn").onclick = importProgress;
  }

  function exportProgress() {
    const blob = new Blob([ProgressStore.exportJSON(progress)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dcf-drills-progress.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importProgress() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = ProgressStore.importJSON(reader.result);
          Object.assign(progress, imported);
          ProgressStore.save(progress);
          updateStatsStrip();
        } catch (e) {
          alert("Couldn't read that file — is it a progress export from this tool?");
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  // -----------------------------------------------------------------
  // Shareable result card (canvas -> PNG, no backend, no login)
  // -----------------------------------------------------------------

  function downloadShareCard() {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 560;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0b0c0c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#5eead4";
    ctx.font = "600 28px monospace";
    ctx.fillText("DCF Drills", 60, 80);

    ctx.fillStyle = "#9a9da1";
    ctx.font = "16px sans-serif";
    ctx.fillText("Investment banking interview practice", 60, 110);

    const accuracy = ProgressStore.overallAccuracy(progress);
    const avgSpeed = ProgressStore.averageSpeedSeconds(progress);
    const stats = [
      ["Solved this session", String(session.solvedCount)],
      ["Current streak", String(progress.currentStreak)],
      ["Accuracy", accuracy === null ? "—" : Math.round(accuracy * 100) + "%"],
      ["Avg. speed", avgSpeed === null ? "—" : fmtTime(avgSpeed)],
    ];

    const startY = 210;
    stats.forEach((s, i) => {
      const x = 60 + (i % 2) * 460;
      const y = startY + Math.floor(i / 2) * 140;
      ctx.fillStyle = "#5eead4";
      ctx.font = "600 48px monospace";
      ctx.fillText(s[1], x, y);
      ctx.fillStyle = "#9a9da1";
      ctx.font = "16px sans-serif";
      ctx.fillText(s[0], x, y + 30);
    });

    ctx.fillStyle = "#63676c";
    ctx.font = "13px sans-serif";
    ctx.fillText("Independent practice tool — not affiliated with any bank or prep platform.", 60, canvas.height - 40);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dcf-drills-result.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // -----------------------------------------------------------------
  // In-progress persistence (refresh / back-button recovery)
  // -----------------------------------------------------------------

  function saveInProgressSnapshot(stage) {
    if (!current) return;
    ProgressStore.saveInProgress({
      tier: session.tier,
      sessionSolvedCount: session.solvedCount,
      sessionTimesSec: session.timesSec,
      category: current.category,
      subtype: current.problem.subtype, // undefined for wacc/beta/fcf, harmless
      problemTier: current.problem.tier,
      inputs: current.problem.inputs,
      stage,
      results: current.results,
      correctCount: current.correctCount,
      allFirstTryCorrect: current.allFirstTryCorrect,
      timed: current.timed,
      elapsedSec: current.elapsedSec,
      followUps: current.followUps,
      followUpIndex: current.followUpIndex,
      followUpAllCorrect: current.followUpAllCorrect,
    });
  }

  function restoreInProgress() {
    const saved = ProgressStore.loadInProgress();
    if (!saved || !saved.inputs) return false;

    try {
      session.tier = saved.tier || "easy";
      session.active = true;
      session.solvedCount = saved.sessionSolvedCount || 0;
      session.timesSec = saved.sessionTimesSec || [];

      document.querySelectorAll(".tier-btn").forEach((b) => {
        b.setAttribute("aria-checked", b.dataset.tier === session.tier ? "true" : "false");
      });

      const problem = ProblemAdapters.rebuildProblem(saved.category, saved.subtype, saved.problemTier, saved.inputs);
      $("#setup-section").hidden = true;

      beginProblem(
        saved.category,
        problem,
        saved.stage,
        saved.results || {},
        saved.correctCount || 0,
        saved.elapsedSec || 0,
        saved.allFirstTryCorrect !== false,
        { followUps: saved.followUps || [], followUpIndex: saved.followUpIndex || 0, followUpAllCorrect: saved.followUpAllCorrect !== false },
        saved.elapsedSec || 0,
        saved.timed
      );
      return true;
    } catch (e) {
      ProgressStore.clearInProgress();
      return false;
    }
  }

  // -----------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    initSetup();
    updateStatsStrip();
    restoreInProgress();
  });
})();
