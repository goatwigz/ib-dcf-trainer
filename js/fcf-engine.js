/*
Unlevered Free Cash Flow build engine.
Easy: one year, EBITDA and D&A given separately (EBIT = EBITDA − D&A).
Medium: 3-year mini-projection; EBITDA must be grown from a base, then
        D&A/CapEx/ΔNWC are given as fixed percentages of EBITDA that
        the student applies each year.

FCF = NOPAT + D&A − CapEx − ΔNWC, where NOPAT = EBIT × (1 − tax rate).
*/

(function (root) {
  "use strict";

  const shared = root.DCFEngine ? root.DCFEngine._internal : require("./dcf-engine.js")._internal;
  const { makeRng, randStep, randInt } = shared;

  function buildYear(ebitda, da, capex, deltaNwc, taxRate) {
    const ebit = ebitda - da;
    const nopat = ebit * (1 - taxRate);
    const fcf = nopat + da - capex - deltaNwc;
    return { ebitda, da, ebit, nopat, capex, deltaNwc, fcf };
  }

  function buildProblem(tier, inputs) {
    const { taxRate } = inputs;

    if (tier === "easy") {
      const year = buildYear(inputs.ebitda, inputs.da, inputs.capex, inputs.deltaNwc, taxRate);
      return { tier, inputs, solution: year };
    }

    const { baseEbitda, ebitdaGrowth, daPct, capexPct, nwcPct, years } = inputs;
    const yearRows = [];
    for (let n = 1; n <= years; n++) {
      const ebitda = baseEbitda * Math.pow(1 + ebitdaGrowth, n);
      const da = ebitda * daPct;
      const capex = ebitda * capexPct;
      const deltaNwc = ebitda * nwcPct;
      yearRows.push(buildYear(ebitda, da, capex, deltaNwc, taxRate));
    }
    const totalFcf = yearRows.reduce((s, y) => s + y.fcf, 0);
    return { tier, inputs, solution: { years: yearRows, totalFcf } };
  }

  function generateInputs(tier, rng) {
    const taxRate = randStep(rng, 20, 28, 1) / 100;

    if (tier === "easy") {
      const ebitda = randInt(rng, 100, 500);
      const da = Math.round(ebitda * randStep(rng, 8, 15, 0.5) / 100);
      const capex = Math.round(ebitda * randStep(rng, 5, 12, 0.5) / 100);
      const deltaNwc = Math.round(ebitda * randStep(rng, -3, 5, 0.5) / 100);
      return { taxRate, ebitda, da, capex, deltaNwc };
    }

    return {
      taxRate,
      baseEbitda: randInt(rng, 150, 400),
      ebitdaGrowth: randStep(rng, 4, 10, 0.5) / 100,
      daPct: randStep(rng, 8, 12, 0.5) / 100,
      capexPct: randStep(rng, 6, 11, 0.5) / 100,
      nwcPct: randStep(rng, 0.5, 3, 0.25) / 100,
      years: 3,
    };
  }

  function generateProblem(tier, seed) {
    const rng = makeRng(seed);
    const inputs = generateInputs(tier, rng);
    return buildProblem(tier, inputs);
  }

  function toleranceFor(correctValue) {
    return Math.max(Math.abs(correctValue) * 0.005, 0.1);
  }

  // stepKey: easy -> "ebit" | "nopat" | "fcf"
  //          medium -> "ebitda_n" | "da_n" | "ebit_n" | "nopat_n" | "capex_n" | "nwc_n" | "fcf_n"
  function getCorrectValue(problem, stepKey) {
    if (problem.tier === "easy") {
      return problem.solution[stepKey];
    }
    const m = /^(ebitda|da|ebit|nopat|capex|nwc|fcf)_(\d+)$/.exec(stepKey);
    if (!m) return undefined;
    const year = problem.solution.years[Number(m[2]) - 1];
    if (!year) return undefined;
    const fieldMap = { ebitda: "ebitda", da: "da", ebit: "ebit", nopat: "nopat", capex: "capex", nwc: "deltaNwc", fcf: "fcf" };
    return year[fieldMap[m[1]]];
  }

  function checkStep(problem, stepKey, studentValue) {
    const correctValue = getCorrectValue(problem, stepKey);
    if (correctValue === undefined) throw new Error("Unknown step key: " + stepKey);
    const tolerance = toleranceFor(correctValue);
    const correct = Math.abs(studentValue - correctValue) <= tolerance;
    return { correct, correctValue, tolerance };
  }

  function sensitivityFollowUp(problem) {
    if (problem.tier === "easy") {
      const daUp = problem.inputs.da * 1.15;
      const rebuilt = buildProblem("easy", Object.assign({}, problem.inputs, { da: daUp }));
      return {
        id: "daUp",
        prompt: "If D&A rises by 15% (to " + daUp.toFixed(1) + "), what is the new Unlevered FCF, and does it go up or down? (Think about the tax shield.)",
        correctDirection: rebuilt.solution.fcf > problem.solution.fcf ? "up" : "down",
        correctValue: rebuilt.solution.fcf,
        valueKind: "dollar",
        tolerance: toleranceFor(rebuilt.solution.fcf),
      };
    }
    const capexUp = problem.inputs.capexPct + 0.02;
    const rebuilt = buildProblem("medium", Object.assign({}, problem.inputs, { capexPct: capexUp }));
    return {
      id: "capexUp",
      prompt: "If CapEx rises by 2 percentage points of EBITDA (to " + (capexUp * 100).toFixed(1) + "%) across all years, what is the new total 3-year Unlevered FCF?",
      correctDirection: rebuilt.solution.totalFcf > problem.solution.totalFcf ? "up" : "down",
      correctValue: rebuilt.solution.totalFcf,
      valueKind: "dollar",
      tolerance: toleranceFor(rebuilt.solution.totalFcf),
    };
  }

  // Backsolve: given a target FCF (e.g. "we need at least $X of FCF to
  // hit our leverage covenant"), work backward to the required EBITDA.
  // Easy tier: direct algebraic inverse (D&A/CapEx/ΔNWC are fixed $).
  // Medium tier: FCF is linear in base EBITDA once daPct/capexPct/nwcPct
  // are fixed, so the same kind of inverse applies to the 3-year total.
  function backsolveEbitdaFollowUp(problem, targetFcf) {
    if (problem.tier === "easy") {
      const { da, capex, deltaNwc, taxRate } = problem.inputs;
      const t = targetFcf !== undefined ? targetFcf : problem.solution.fcf * (0.9 + Math.random() * 0.25);
      const requiredEbitda = da + (t - da + capex + deltaNwc) / (1 - taxRate);
      return {
        id: "backsolveEbitda",
        prompt: "Suppose the target Unlevered FCF is $" + t.toFixed(1) + "m instead. What EBITDA would that require?",
        correctValue: requiredEbitda,
        valueKind: "dollar",
        tolerance: toleranceFor(requiredEbitda),
      };
    }
    const { daPct, capexPct, nwcPct, taxRate, ebitdaGrowth, years } = problem.inputs;
    const coefficient = (1 - daPct) * (1 - taxRate) + daPct - capexPct - nwcPct;
    let growthSum = 0;
    for (let n = 1; n <= years; n++) growthSum += Math.pow(1 + ebitdaGrowth, n);
    const t = targetFcf !== undefined ? targetFcf : problem.solution.totalFcf * (0.9 + Math.random() * 0.25);
    const requiredBaseEbitda = t / (coefficient * growthSum);
    return {
      id: "backsolveEbitda",
      prompt: "Suppose the target total 3-year Unlevered FCF is $" + t.toFixed(1) + "m instead. What base-year EBITDA would that require?",
      correctValue: requiredBaseEbitda,
      valueKind: "dollar",
      tolerance: toleranceFor(requiredBaseEbitda),
    };
  }

  // Ungraded, conceptual — reveals a hand-written model answer instead
  // of checking a number.
  function conceptualFollowUp() {
    return {
      id: "conceptualDaAddback",
      valueKind: "conceptual",
      prompt: "We subtract D&A to get to EBIT, then add it straight back later. What's the point?",
      modelAnswer:
        "D&A is a non-cash accounting expense — subtracting it first matters because it reduces taxable income (and " +
        "therefore the tax bill), but no actual cash leaves the business when it's recorded. Adding it back after " +
        "computing NOPAT restores the cash that was never really spent, while still keeping the tax benefit it " +
        "generated along the way.",
    };
  }

  function generateFollowUps(problem) {
    const bank = [backsolveEbitdaFollowUp, conceptualFollowUp];
    const pick = bank[Math.floor(Math.random() * bank.length)];
    return [sensitivityFollowUp(problem), pick(problem)];
  }

  const FCFEngine = {
    buildProblem,
    generateProblem,
    checkStep,
    generateFollowUps,
    followUps: { sensitivity: sensitivityFollowUp, backsolveEbitda: backsolveEbitdaFollowUp, conceptual: conceptualFollowUp },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = FCFEngine;
  } else {
    root.FCFEngine = FCFEngine;
  }
})(typeof window !== "undefined" ? window : globalThis);
