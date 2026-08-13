/*
WACC build-up drill engine.
Easy: cost of equity (given levered beta), after-tax cost of debt,
      capital-structure weights, WACC.
Medium: same, but the beta must first be un-levered from a comparable
      company's capital structure and re-levered to the target's
      (Hamada equation) before computing cost of equity.
*/

(function (root) {
  "use strict";

  const shared = root.DCFEngine ? root.DCFEngine._internal : require("./dcf-engine.js")._internal;
  const { makeRng, randStep, randInRange } = shared;

  function buildProblem(tier, inputs) {
    const { riskFreeRate, erp, taxRate, costOfDebtPreTax, equityValue, debtValue } = inputs;

    const solution = {};
    let releveredBeta;

    if (tier === "easy") {
      releveredBeta = inputs.beta;
    } else {
      const targetDE = debtValue / equityValue;
      const unleveredBeta = inputs.compBeta / (1 + (1 - taxRate) * inputs.compDE);
      releveredBeta = unleveredBeta * (1 + (1 - taxRate) * targetDE);
      solution.targetDE = targetDE;
      solution.unleveredBeta = unleveredBeta;
      solution.releveredBeta = releveredBeta;
    }

    const costOfEquity = riskFreeRate + releveredBeta * erp;
    const costOfDebtAfterTax = costOfDebtPreTax * (1 - taxRate);
    const evWeight = equityValue / (equityValue + debtValue);
    const dvWeight = debtValue / (equityValue + debtValue);
    const wacc = evWeight * costOfEquity + dvWeight * costOfDebtAfterTax;

    solution.costOfEquity = costOfEquity;
    solution.costOfDebtAfterTax = costOfDebtAfterTax;
    solution.evWeight = evWeight;
    solution.dvWeight = dvWeight;
    solution.wacc = wacc;

    return { tier, inputs, solution };
  }

  function generateInputs(tier, rng) {
    const inputs = {
      riskFreeRate: randStep(rng, 3, 4.5, 0.25) / 100,
      erp: randStep(rng, 4.5, 6.5, 0.25) / 100,
      taxRate: randStep(rng, 20, 28, 1) / 100,
      costOfDebtPreTax: randStep(rng, 4, 9, 0.25) / 100,
      equityValue: randStep(rng, 300, 3000, 50),
      debtValue: randStep(rng, 50, 1000, 25),
    };
    if (tier === "easy") {
      inputs.beta = randStep(rng, 0.7, 1.8, 0.05);
    } else {
      inputs.compBeta = randStep(rng, 0.9, 2.0, 0.05);
      inputs.compDE = randStep(rng, 0.3, 1.5, 0.05);
    }
    return inputs;
  }

  function generateProblem(tier, seed) {
    const rng = makeRng(seed);
    const inputs = generateInputs(tier, rng);
    return buildProblem(tier, inputs);
  }

  function toleranceFor(stepKey) {
    if (stepKey === "evWeight" || stepKey === "dvWeight") return 0.005;
    if (stepKey === "targetDE" || stepKey === "unleveredBeta" || stepKey === "releveredBeta") return 0.02;
    // costOfEquity, costOfDebtAfterTax, wacc: percentages, tolerance 0.1 point
    return 0.001;
  }

  function checkStep(problem, stepKey, studentValue) {
    const correctValue = problem.solution[stepKey];
    if (correctValue === undefined) throw new Error("Unknown step key: " + stepKey);
    const tolerance = toleranceFor(stepKey);
    const correct = Math.abs(studentValue - correctValue) <= tolerance;
    return { correct, correctValue, tolerance };
  }

  function sensitivityFollowUp(problem) {
    const baseWacc = problem.solution.wacc;
    if (problem.tier === "easy") {
      const betaUp = problem.inputs.beta + 0.2;
      const rebuilt = buildProblem("easy", Object.assign({}, problem.inputs, { beta: betaUp }));
      return {
        id: "betaUp",
        prompt: "If the company's beta rises by 0.2 (to " + betaUp.toFixed(2) + "), what is the new WACC, and does it go up or down?",
        correctDirection: rebuilt.solution.wacc > baseWacc ? "up" : "down",
        correctValue: rebuilt.solution.wacc,
        tolerance: 0.001,
      };
    }
    const taxUp = problem.inputs.taxRate + 0.03;
    const rebuilt = buildProblem("medium", Object.assign({}, problem.inputs, { taxRate: taxUp }));
    return {
      id: "taxUp",
      prompt: "If the tax rate rises by 3 percentage points (to " + (taxUp * 100).toFixed(1) + "%), what is the new WACC, and does it go up or down?",
      correctDirection: rebuilt.solution.wacc > baseWacc ? "up" : "down",
      correctValue: rebuilt.solution.wacc,
      tolerance: 0.001,
    };
  }

  // Backsolve: given a target WACC (not the one this problem's own
  // inputs produce — e.g. "management says WACC is X%"), work backward
  // to the required cost of equity, then the required beta.
  function backsolveBetaFollowUp(problem, targetWacc) {
    const baseWacc = problem.solution.wacc;
    const t = targetWacc !== undefined ? targetWacc : baseWacc * (0.9 + Math.random() * 0.2);
    const requiredCoE = (t - problem.solution.dvWeight * problem.solution.costOfDebtAfterTax) / problem.solution.evWeight;
    const requiredBeta = (requiredCoE - problem.inputs.riskFreeRate) / problem.inputs.erp;
    return {
      id: "backsolveBeta",
      prompt:
        "Suppose you're told WACC must be " +
        (t * 100).toFixed(2) +
        "% instead. Holding the cost of debt and capital structure fixed, what beta would that require?",
      correctValue: requiredBeta,
      tolerance: 0.02,
    };
  }

  function generateFollowUps(problem) {
    return [sensitivityFollowUp(problem), backsolveBetaFollowUp(problem)];
  }

  const WaccEngine = {
    buildProblem,
    generateProblem,
    checkStep,
    generateFollowUps,
    followUps: { sensitivity: sensitivityFollowUp, backsolveBeta: backsolveBetaFollowUp },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = WaccEngine;
  } else {
    root.WaccEngine = WaccEngine;
  }
})(typeof window !== "undefined" ? window : globalThis);
