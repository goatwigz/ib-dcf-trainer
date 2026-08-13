/*
Beta un-lever / re-lever drill engine (Hamada equation).
Easy: one comparable company, unlever then relever to a target D/E.
Medium: three comparables, unlever each, average, then relever once.
*/

(function (root) {
  "use strict";

  const shared = root.DCFEngine ? root.DCFEngine._internal : require("./dcf-engine.js")._internal;
  const { makeRng, randStep } = shared;

  function unlever(leveredBeta, de, taxRate) {
    return leveredBeta / (1 + (1 - taxRate) * de);
  }
  function relever(unleveredBeta, de, taxRate) {
    return unleveredBeta * (1 + (1 - taxRate) * de);
  }

  function buildProblem(tier, inputs) {
    const { taxRate, targetDE } = inputs;
    const solution = {};

    if (tier === "easy") {
      const unleveredBeta = unlever(inputs.leveredBeta, inputs.de, taxRate);
      const releveredBeta = relever(unleveredBeta, targetDE, taxRate);
      solution.unleveredBeta = unleveredBeta;
      solution.releveredBeta = releveredBeta;
    } else {
      const unleveredBetas = inputs.comps.map((c) => unlever(c.beta, c.de, taxRate));
      const averageUnleveredBeta = unleveredBetas.reduce((s, v) => s + v, 0) / unleveredBetas.length;
      const releveredBeta = relever(averageUnleveredBeta, targetDE, taxRate);
      solution.unleveredBetas = unleveredBetas;
      solution.averageUnleveredBeta = averageUnleveredBeta;
      solution.releveredBeta = releveredBeta;
    }

    return { tier, inputs, solution };
  }

  function generateInputs(tier, rng) {
    const taxRate = randStep(rng, 20, 28, 1) / 100;
    const targetDE = randStep(rng, 0.2, 1.6, 0.05);

    if (tier === "easy") {
      return {
        taxRate,
        targetDE,
        leveredBeta: randStep(rng, 0.8, 1.8, 0.05),
        de: randStep(rng, 0.2, 1.5, 0.05),
      };
    }
    const comps = [];
    for (let i = 0; i < 3; i++) {
      comps.push({
        beta: randStep(rng, 0.8, 1.9, 0.05),
        de: randStep(rng, 0.2, 1.6, 0.05),
      });
    }
    return { taxRate, targetDE, comps };
  }

  function generateProblem(tier, seed) {
    const rng = makeRng(seed);
    const inputs = generateInputs(tier, rng);
    return buildProblem(tier, inputs);
  }

  function toleranceFor() {
    return 0.02; // beta values, unitless
  }

  function checkStep(problem, stepKey, studentValue) {
    let correctValue;
    const m = /^unlevered_(\d+)$/.exec(stepKey);
    if (m) {
      correctValue = problem.solution.unleveredBetas[Number(m[1]) - 1];
    } else {
      correctValue = problem.solution[stepKey];
    }
    if (correctValue === undefined) throw new Error("Unknown step key: " + stepKey);
    const tolerance = toleranceFor();
    const correct = Math.abs(studentValue - correctValue) <= tolerance;
    return { correct, correctValue, tolerance };
  }

  function sensitivityFollowUp(problem) {
    if (problem.tier === "easy") {
      const newTargetDE = problem.inputs.targetDE + 0.3;
      const rebuilt = buildProblem("easy", Object.assign({}, problem.inputs, { targetDE: newTargetDE }));
      return {
        id: "targetDEUp",
        prompt: "If the target company's D/E ratio rises to " + newTargetDE.toFixed(2) + ", what is the new relevered beta, and does it go up or down?",
        correctDirection: rebuilt.solution.releveredBeta > problem.solution.releveredBeta ? "up" : "down",
        correctValue: rebuilt.solution.releveredBeta,
        valueKind: "ratio",
        tolerance: 0.02,
      };
    }
    const newComps = problem.inputs.comps.map((c) => Object.assign({}, c));
    newComps[1].de = newComps[1].de + 0.4;
    const rebuilt = buildProblem("medium", Object.assign({}, problem.inputs, { comps: newComps }));
    return {
      id: "comp2DEUp",
      prompt: "If Comp 2's D/E ratio is corrected to " + newComps[1].de.toFixed(2) + ", what is the new average unlevered beta, and does it go up or down?",
      correctDirection: rebuilt.solution.averageUnleveredBeta > problem.solution.averageUnleveredBeta ? "up" : "down",
      correctValue: rebuilt.solution.averageUnleveredBeta,
      valueKind: "ratio",
      tolerance: 0.02,
    };
  }

  // Backsolve: given a target relevered beta (e.g. "we want this deal
  // valued using a beta of X"), work backward to the required target
  // D/E ratio. Target is always generated above the unlevered beta
  // (which is the floor at D/E = 0), so the required D/E is always
  // well-defined and non-negative.
  function backsolveDEFollowUp(problem, targetRelevered) {
    const unlevered = problem.tier === "easy" ? problem.solution.unleveredBeta : problem.solution.averageUnleveredBeta;
    const currentRelevered = problem.solution.releveredBeta;
    const t =
      targetRelevered !== undefined
        ? targetRelevered
        : unlevered + (currentRelevered - unlevered) * (0.7 + Math.random() * 0.8);
    const requiredDE = (t / unlevered - 1) / (1 - problem.inputs.taxRate);
    return {
      id: "backsolveDE",
      prompt:
        "Suppose you want the deal valued using a relevered beta of " +
        t.toFixed(3) +
        " instead. What target D/E ratio would that require?",
      correctValue: requiredDE,
      valueKind: "ratio",
      tolerance: 0.03,
    };
  }

  // Ungraded, conceptual — reveals a hand-written model answer instead
  // of checking a number.
  function conceptualFollowUp(problem) {
    if (problem.tier === "easy") {
      return {
        id: "conceptualBetaMeaning",
        valueKind: "conceptual",
        prompt: "What does a beta less than 1 imply about this stock relative to the market?",
        modelAnswer:
          "A beta below 1 means the stock has historically moved less than the overall market — smaller swings up " +
          "and down, on average, for a given market move. It's a measure of systematic (market) risk specifically, " +
          "not total risk — a low-beta stock can still be risky for company-specific reasons that beta doesn't " +
          "capture at all.",
      };
    }
    return {
      id: "conceptualWhyUnlever",
      valueKind: "conceptual",
      prompt: "Why do we un-lever each comp's beta before averaging, instead of just averaging their raw (levered) betas?",
      modelAnswer:
        "A levered beta reflects both the underlying business risk AND how much debt that specific company happens " +
        "to carry. Comps rarely share the same capital structure, so averaging raw levered betas would blend " +
        "together different amounts of financial leverage as if they were equivalent. Un-levering strips out each " +
        "comp's own financing effect, leaving pure business risk to average — then you re-lever the average using " +
        "the TARGET company's actual capital structure.",
    };
  }

  function generateFollowUps(problem) {
    const bank = [backsolveDEFollowUp, conceptualFollowUp];
    const pick = bank[Math.floor(Math.random() * bank.length)];
    return [sensitivityFollowUp(problem), pick(problem)];
  }

  const BetaEngine = {
    buildProblem,
    generateProblem,
    checkStep,
    generateFollowUps,
    followUps: { sensitivity: sensitivityFollowUp, backsolveDE: backsolveDEFollowUp, conceptual: conceptualFollowUp },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = BetaEngine;
  } else {
    root.BetaEngine = BetaEngine;
  }
})(typeof window !== "undefined" ? window : globalThis);
