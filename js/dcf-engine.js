/*
DCF drill engine — all number generation and answer-checking logic.
No randomness or UI here except where explicitly noted; this file is the
single source of truth for "what is the correct answer," so the app's
correctness rests entirely on this file being right.

Two DCF sub-types:
  "gordon"       — terminal value via Gordon Growth (perpetuity) method
  "exitMultiple" — terminal value via Exit Multiple method

Two tiers:
  "easy"   — 3 projection years, cash flows given directly, no equity bridge
  "medium" — 5 projection years, cash flows must be grown from a base +
             growth rate, includes the equity bridge (net debt -> equity
             value -> value per share)
*/

(function (root) {
  "use strict";

  // ---------------------------------------------------------------------
  // 1. Pure math: build a fully-solved problem from EXPLICIT inputs.
  //    No randomness. This is the function whose output must match the
  //    hand-verified worked examples exactly.
  // ---------------------------------------------------------------------

  /**
   * @param {"gordon"|"exitMultiple"} subtype
   * @param {"easy"|"medium"} tier
   * @param {object} inputs
   *   Common:      discountRate, years
   *   Easy:        cashFlows (array, length = years)
   *   Medium:      baseCashFlow, cashFlowGrowth
   *   gordon:      terminalGrowth
   *   exitMultiple:finalYearMetric, exitMultiple
   *   Medium only: netDebt, sharesOutstanding
   */
  function buildProblem(subtype, tier, inputs) {
    const years = inputs.years;
    const r = inputs.discountRate;

    // Step 1: cash flows
    let cashFlows;
    if (tier === "easy") {
      cashFlows = inputs.cashFlows.slice();
    } else {
      const base = inputs.baseCashFlow;
      const g = inputs.cashFlowGrowth;
      cashFlows = [];
      for (let n = 1; n <= years; n++) {
        cashFlows.push(base * Math.pow(1 + g, n));
      }
    }

    // Step 2: discount factors + present values, year by year
    const rows = [];
    for (let n = 1; n <= years; n++) {
      const discountFactor = 1 / Math.pow(1 + r, n);
      const cashFlow = cashFlows[n - 1];
      const presentValue = cashFlow * discountFactor;
      rows.push({ year: n, cashFlow, discountFactor, presentValue });
    }
    const finalDiscountFactor = rows[rows.length - 1].discountFactor;

    // Step 3: terminal value
    let terminalValue;
    if (subtype === "gordon") {
      const g = inputs.terminalGrowth;
      const finalCF = cashFlows[cashFlows.length - 1];
      terminalValue = (finalCF * (1 + g)) / (r - g);
    } else {
      terminalValue = inputs.finalYearMetric * inputs.exitMultiple;
    }
    const pvTerminalValue = terminalValue * finalDiscountFactor;

    // Step 4: enterprise value
    const sumPvCashFlows = rows.reduce((s, row) => s + row.presentValue, 0);
    const enterpriseValue = sumPvCashFlows + pvTerminalValue;

    const solution = {
      rows,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
    };

    // Step 5 (medium only): equity bridge
    if (tier === "medium") {
      const netDebt = inputs.netDebt;
      const sharesOutstanding = inputs.sharesOutstanding;
      const equityValue = enterpriseValue - netDebt;
      const valuePerShare = equityValue / sharesOutstanding;
      solution.equityValue = equityValue;
      solution.valuePerShare = valuePerShare;
    }

    return { subtype, tier, inputs, cashFlows, solution };
  }

  // ---------------------------------------------------------------------
  // 2. Randomized input generation
  // ---------------------------------------------------------------------

  // Deterministic seedable RNG (mulberry32) so problems/tests can be
  // reproduced with a known seed. Falls back to Math.random if no seed.
  function makeRng(seed) {
    if (seed === undefined || seed === null) {
      return Math.random;
    }
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInRange(rng, min, max) {
    return min + rng() * (max - min);
  }

  // Random number in [min,max], snapped to the nearest multiple of `step`.
  function randStep(rng, min, max, step) {
    const stepsCount = Math.round((max - min) / step);
    const k = Math.floor(rng() * (stepsCount + 1));
    const val = min + k * step;
    return Math.min(max, Math.max(min, val));
  }

  function randInt(rng, min, max) {
    return Math.floor(randInRange(rng, min, max + 1));
  }

  function generateInputs(subtype, tier, rng) {
    const years = tier === "easy" ? 3 : 5;

    const discountRate =
      tier === "easy"
        ? randStep(rng, 8, 12, 1) / 100
        : randStep(rng, 6, 15, 0.5) / 100;

    const inputs = { years, discountRate };

    if (tier === "easy") {
      // Cash flows given directly. Generated via an internal growth path
      // so they look like a realistic projection, then rounded to $1m —
      // the growth rate itself is never shown or asked about at this tier.
      const base = randStep(rng, 50, 300, 10);
      const hiddenGrowth = randStep(rng, 3, 10, 0.5) / 100;
      const cashFlows = [];
      for (let n = 1; n <= years; n++) {
        cashFlows.push(Math.round(base * Math.pow(1 + hiddenGrowth, n)));
      }
      inputs.cashFlows = cashFlows;
    } else {
      inputs.baseCashFlow = randInt(rng, 40, 450);
      inputs.cashFlowGrowth = randStep(rng, 3, 10, 0.5) / 100;
    }

    if (subtype === "gordon") {
      const maxG = tier === "easy" ? 3 : 3.5;
      const minG = tier === "easy" ? 2 : 1.5;
      // Enforce at least a 2-point buffer between g and r so the
      // perpetuity formula never approaches a degenerate blow-up.
      const cappedMax = Math.min(maxG, discountRate * 100 - 2);
      const terminalGrowth = randStep(rng, minG, Math.max(minG, cappedMax), 0.5) / 100;
      inputs.terminalGrowth = terminalGrowth;
    } else {
      const exitMultiple =
        tier === "easy" ? randInt(rng, 6, 10) : randStep(rng, 6, 10, 0.5);
      inputs.exitMultiple = exitMultiple;
      // Final-year EBITDA given directly (not derived by the student),
      // scaled to be plausibly larger than final-year FCF.
      const lastCF =
        tier === "easy"
          ? inputs.cashFlows[inputs.cashFlows.length - 1]
          : inputs.baseCashFlow * Math.pow(1 + inputs.cashFlowGrowth, years);
      const scaleFactor = randInRange(rng, 1.3, 2.0);
      inputs.finalYearMetric = Math.round(lastCF * scaleFactor);
    }

    if (tier === "medium") {
      inputs.netDebt = randStep(rng, -50, 200, 5);
      inputs.sharesOutstanding = randStep(rng, 20, 500, 5);
    }

    return inputs;
  }

  function generateProblem(subtype, tier, seed) {
    const rng = makeRng(seed);
    const inputs = generateInputs(subtype, tier, rng);
    return buildProblem(subtype, tier, inputs);
  }

  // ---------------------------------------------------------------------
  // 3. Answer checking (per-cell, with tolerance)
  // ---------------------------------------------------------------------

  // stepKey format: "cf_1", "df_1", "pv_1", "terminalValue",
  // "pvTerminalValue", "enterpriseValue", "equityValue", "valuePerShare"
  function getCorrectValue(problem, stepKey) {
    const sol = problem.solution;
    const m = /^(cf|df|pv)_(\d+)$/.exec(stepKey);
    if (m) {
      const row = sol.rows[Number(m[2]) - 1];
      if (!row) return undefined;
      if (m[1] === "cf") return row.cashFlow;
      if (m[1] === "df") return row.discountFactor;
      if (m[1] === "pv") return row.presentValue;
    }
    if (stepKey in sol) return sol[stepKey];
    return undefined;
  }

  function toleranceFor(stepKey, correctValue) {
    if (stepKey.startsWith("df_")) {
      return 0.001;
    }
    if (stepKey === "valuePerShare") {
      return Math.max(Math.abs(correctValue) * 0.01, 0.01);
    }
    // Dollar figures: cash flow, PV, terminal value, PV of TV,
    // enterprise value, equity value.
    return Math.max(Math.abs(correctValue) * 0.005, 0.1);
  }

  /**
   * @returns {{correct: boolean, correctValue: number, tolerance: number}}
   */
  function checkStep(problem, stepKey, studentValue) {
    const correctValue = getCorrectValue(problem, stepKey);
    if (correctValue === undefined) {
      throw new Error("Unknown step key: " + stepKey);
    }
    const tolerance = toleranceFor(stepKey, correctValue);
    const correct = Math.abs(studentValue - correctValue) <= tolerance;
    return { correct, correctValue, tolerance };
  }

  // ---------------------------------------------------------------------
  // 4. Follow-up questions
  // ---------------------------------------------------------------------

  // Recompute enterprise value for a modified (r, terminalGrowth) or
  // (r, exitMultiple) pair, holding everything else fixed.
  function recomputeEV(problem, overrides) {
    const merged = Object.assign({}, problem.inputs, overrides);
    const rebuilt = buildProblem(problem.subtype, problem.tier, merged);
    return rebuilt.solution.enterpriseValue;
  }

  function generateFollowUps(problem) {
    const baseEV = problem.solution.enterpriseValue;
    const followUps = [];

    // Follow-up 1: discount rate +1 point
    const rUp = problem.inputs.discountRate + 0.01;
    const evRateUp = recomputeEV(problem, { discountRate: rUp });
    followUps.push({
      id: "rateUp1pt",
      prompt:
        "If the discount rate rises by 1.0 percentage point (to " +
        (rUp * 100).toFixed(1) +
        "%), what is the new Enterprise Value, and does it go up or down?",
      correctDirection: evRateUp > baseEV ? "up" : "down",
      correctValue: evRateUp,
      tolerance: toleranceFor("enterpriseValue", evRateUp),
    });

    // Follow-up 2: terminal assumption +0.5 point
    let evGrowthUp, growthLabel, newValueLabel;
    if (problem.subtype === "gordon") {
      const gUp = problem.inputs.terminalGrowth + 0.005;
      evGrowthUp = recomputeEV(problem, { terminalGrowth: gUp });
      growthLabel =
        "the terminal growth rate rises by 0.5 percentage point (to " +
        (gUp * 100).toFixed(1) +
        "%)";
    } else {
      const mUp = problem.inputs.exitMultiple + 0.5;
      evGrowthUp = recomputeEV(problem, { exitMultiple: mUp });
      growthLabel = "the exit multiple rises by 0.5x (to " + mUp.toFixed(1) + "x)";
    }
    followUps.push({
      id: "terminalAssumptionUp",
      prompt:
        "If " + growthLabel + ", what is the new Enterprise Value?",
      correctDirection: evGrowthUp > baseEV ? "up" : "down",
      correctValue: evGrowthUp,
      tolerance: toleranceFor("enterpriseValue", evGrowthUp),
    });

    // Follow-up 3 (medium only): which input moves EV more?
    if (problem.tier === "medium") {
      const rUp1 = problem.inputs.discountRate + 0.01;
      const evRUp1 = recomputeEV(problem, { discountRate: rUp1 });
      const deltaR = Math.abs(evRUp1 - baseEV);

      let deltaG;
      if (problem.subtype === "gordon") {
        const gUp1 = problem.inputs.terminalGrowth + 0.01;
        const evGUp1 = recomputeEV(problem, { terminalGrowth: gUp1 });
        deltaG = Math.abs(evGUp1 - baseEV);
      } else {
        const mUp1 = problem.inputs.exitMultiple + 1;
        const evMUp1 = recomputeEV(problem, { exitMultiple: mUp1 });
        deltaG = Math.abs(evMUp1 - baseEV);
      }

      followUps.push({
        id: "compareSensitivity",
        prompt:
          "Which moves Enterprise Value more: a 1-point rise in the discount rate, or an equivalent 1-point/1x rise in the terminal assumption?",
        correctAnswer: deltaR > deltaG ? "discountRate" : "terminalAssumption",
        deltaR,
        deltaG,
      });
    }

    return followUps;
  }

  // ---------------------------------------------------------------------
  // Exports
  // ---------------------------------------------------------------------

  const DCFEngine = {
    buildProblem,
    generateProblem,
    checkStep,
    generateFollowUps,
    _internal: { makeRng, randStep, randInt, randInRange }, // exposed for tests only
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = DCFEngine;
  } else {
    root.DCFEngine = DCFEngine;
  }
})(typeof window !== "undefined" ? window : globalThis);
