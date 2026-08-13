// Automated cross-check of dcf-engine.js against the hand-verified worked
// examples in docs/formulas.md. Run with: node js/test-engine.js
const DCFEngine = require("./dcf-engine.js");

let failures = 0;
function approxEqual(actual, expected, tol, label) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) {
    failures++;
    console.error(
      `FAIL ${label}: expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)}, tol ${tol})`
    );
  } else {
    console.log(`OK   ${label}: ${actual.toFixed(4)} (expected ${expected})`);
  }
}

// ---- Example 1: Easy / Gordon Growth ----
const p1 = DCFEngine.buildProblem("gordon", "easy", {
  years: 3,
  discountRate: 0.10,
  cashFlows: [100, 110, 120],
  terminalGrowth: 0.025,
  finalYearMetric: 205, // for the terminal-value cross-check follow-up
});

console.log("\n=== Example 1: Easy / Gordon Growth ===");
approxEqual(p1.solution.rows[0].discountFactor, 0.909091, 0.000001, "DF1");
approxEqual(p1.solution.rows[1].discountFactor, 0.826446, 0.000001, "DF2");
approxEqual(p1.solution.rows[2].discountFactor, 0.751315, 0.000001, "DF3");
approxEqual(p1.solution.rows[0].presentValue, 90.9091, 0.0001, "PV1");
approxEqual(p1.solution.rows[1].presentValue, 90.9091, 0.0001, "PV2");
approxEqual(p1.solution.rows[2].presentValue, 90.1578, 0.0001, "PV3");
approxEqual(p1.solution.terminalValue, 1640.0, 0.0001, "Terminal Value");
approxEqual(p1.solution.pvTerminalValue, 1232.1563, 0.0001, "PV of Terminal Value");
approxEqual(p1.solution.enterpriseValue, 1504.1322, 0.0001, "Enterprise Value");

const fu1Rate = DCFEngine.followUps.rateSensitivity(p1);
approxEqual(fu1Rate.correctValue, 1325.1885, 0.0001, "Follow-up (rate+1pt) EV");
if (fu1Rate.correctDirection !== "down") {
  failures++;
  console.error("FAIL rate follow-up direction: expected down, got " + fu1Rate.correctDirection);
} else {
  console.log("OK   rate follow-up direction: down");
}

const fu1Growth = DCFEngine.followUps.terminalAssumption(p1);
approxEqual(fu1Growth.correctValue, 1598.5832, 0.0001, "Follow-up (growth+0.5pt) EV");
if (fu1Growth.correctDirection !== "up") {
  failures++;
  console.error("FAIL growth follow-up direction: expected up, got " + fu1Growth.correctDirection);
} else {
  console.log("OK   growth follow-up direction: up");
}

const fu1CrossCheck = DCFEngine.followUps.tvCrossCheck(p1);
approxEqual(fu1CrossCheck.correctValue, 8.0, 0.0001, "TV cross-check implied multiple");

const fu1MidYear = DCFEngine.followUps.midYearConvention(p1);
approxEqual(fu1MidYear.correctValue, 1577.5472, 0.0005, "Mid-year convention EV");
if (fu1MidYear.correctDirection !== "up") {
  failures++;
  console.error("FAIL mid-year direction: expected up, got " + fu1MidYear.correctDirection);
} else {
  console.log("OK   mid-year direction: up");
}

// ---- Example 2: Medium / Exit Multiple + Equity Bridge ----
const p2 = DCFEngine.buildProblem("exitMultiple", "medium", {
  years: 5,
  discountRate: 0.095,
  baseCashFlow: 200,
  cashFlowGrowth: 0.06,
  exitMultiple: 8,
  finalYearMetric: 350,
  debt: 150,
  preferredStock: 20,
  noncontrollingInterests: 15,
  cashAndEquivalents: 70,
  sharesOutstanding: 100,
});

console.log("\n=== Example 2: Medium / Exit Multiple + Equity Bridge ===");
approxEqual(p2.solution.rows[0].presentValue, 193.6073, 0.0005, "PV1");
approxEqual(p2.solution.rows[4].presentValue, 170.0156, 0.0005, "PV5");
approxEqual(p2.solution.terminalValue, 2800.0, 0.0001, "Terminal Value");
approxEqual(p2.solution.pvTerminalValue, 1778.6375, 0.0005, "PV of Terminal Value");
approxEqual(p2.solution.enterpriseValue, 2686.7370, 0.0005, "Enterprise Value");
approxEqual(p2.solution.equityValue, 2571.7370, 0.0005, "Equity Value");
approxEqual(p2.solution.valuePerShare, 25.717370, 0.00005, "Value per Share");

approxEqual(DCFEngine.followUps.rateSensitivity(p2).correctValue, 2583.8622, 0.0005, "Follow-up (rate+1pt) EV");
approxEqual(DCFEngine.followUps.terminalAssumption(p2).correctValue, 2797.9018, 0.0005, "Follow-up (multiple+0.5x) EV");

const cmp2 = DCFEngine.followUps.compareSensitivity(p2);
approxEqual(cmp2.deltaR, 102.8748, 0.0005, "compareSensitivity deltaR");
approxEqual(cmp2.deltaG, 222.3297, 0.0005, "compareSensitivity deltaMultiple");
if (cmp2.correctAnswer !== "terminalAssumption") {
  failures++;
  console.error("FAIL compareSensitivity answer: expected terminalAssumption, got " + cmp2.correctAnswer);
} else {
  console.log("OK   compareSensitivity answer: terminalAssumption");
}

// Separate instance for the exit-multiple TV cross-check (clean
// illustrative numbers, doesn't disturb the verified Example 2 figures)
const p2CrossCheck = DCFEngine.buildProblem("exitMultiple", "medium", {
  years: 5,
  discountRate: 0.095,
  baseCashFlow: 200,
  cashFlowGrowth: 0.06,
  exitMultiple: 9,
  finalYearMetric: 380,
  debt: 150,
  preferredStock: 20,
  noncontrollingInterests: 15,
  cashAndEquivalents: 70,
  sharesOutstanding: 100,
});
approxEqual(
  DCFEngine.followUps.tvCrossCheck(p2CrossCheck).correctValue,
  0.015526,
  0.00001,
  "TV cross-check implied growth rate"
);

// Sampling wrapper: rate sensitivity always first, correct count, no duplicates
const sampled = DCFEngine.generateFollowUps(p2, () => 0.5);
if (sampled.length !== 3) {
  failures++;
  console.error("FAIL generateFollowUps medium count: expected 3, got " + sampled.length);
} else {
  console.log("OK   generateFollowUps medium count: 3");
}
if (sampled[0].id !== "rateUp1pt") {
  failures++;
  console.error("FAIL generateFollowUps: first entry should be rate sensitivity");
} else {
  console.log("OK   generateFollowUps: first entry is rate sensitivity");
}
const ids = sampled.map((f) => f.id);
if (new Set(ids).size !== ids.length) {
  failures++;
  console.error("FAIL generateFollowUps: duplicate follow-up types in one problem");
} else {
  console.log("OK   generateFollowUps: no duplicate follow-up types");
}

// ---- checkStep tolerance sanity checks ----
console.log("\n=== checkStep tolerance sanity checks ===");
const r1 = DCFEngine.checkStep(p1, "df_1", 0.909);
if (!r1.correct) { failures++; console.error("FAIL checkStep df_1 should accept 0.909"); }
else console.log("OK   checkStep df_1 accepts 0.909");

const r2 = DCFEngine.checkStep(p1, "enterpriseValue", 1500);
if (!r2.correct) { failures++; console.error("FAIL checkStep enterpriseValue should accept 1500 (within 0.5%)"); }
else console.log("OK   checkStep enterpriseValue accepts 1500");

const r3 = DCFEngine.checkStep(p1, "enterpriseValue", 1000);
if (r3.correct) { failures++; console.error("FAIL checkStep enterpriseValue should reject 1000"); }
else console.log("OK   checkStep enterpriseValue correctly rejects 1000");

// ---- Random generation sanity: run 500 generated problems, check no NaN/crashes ----
console.log("\n=== Random generation stress test (500 problems x 4 combos) ===");
let randomFailures = 0;
const subtypes = ["gordon", "exitMultiple"];
const tiers = ["easy", "medium"];
for (const subtype of subtypes) {
  for (const tier of tiers) {
    for (let i = 0; i < 500; i++) {
      const problem = DCFEngine.generateProblem(subtype, tier, i * 7919 + 13);
      const ev = problem.solution.enterpriseValue;
      if (!Number.isFinite(ev)) {
        randomFailures++;
        console.error(`FAIL non-finite EV for ${subtype}/${tier} seed=${i}: inputs=`, problem.inputs);
        continue;
      }
      const followUps = DCFEngine.generateFollowUps(problem);
      for (const fu of followUps) {
        const val = fu.correctValue !== undefined ? fu.correctValue : fu.deltaR;
        if (val !== undefined && !Number.isFinite(val)) {
          randomFailures++;
          console.error(`FAIL non-finite follow-up for ${subtype}/${tier} seed=${i}`);
        }
      }
    }
  }
}
if (randomFailures === 0) {
  console.log("OK   All 2000 randomly generated problems produced finite, sane results");
} else {
  failures += randomFailures;
}

// =========================================================================
// WACC build-up engine
// =========================================================================
const WaccEngine = require("./wacc-engine.js");

console.log("\n=== WACC: Easy ===");
const wEasy = WaccEngine.buildProblem("easy", {
  riskFreeRate: 0.035, erp: 0.055, beta: 1.2, costOfDebtPreTax: 0.06,
  taxRate: 0.25, equityValue: 800, debtValue: 200,
});
approxEqual(wEasy.solution.costOfEquity, 0.101, 0.000001, "Cost of Equity");
approxEqual(wEasy.solution.costOfDebtAfterTax, 0.045, 0.000001, "After-tax CoD");
approxEqual(wEasy.solution.evWeight, 0.8, 0.000001, "E/V");
approxEqual(wEasy.solution.dvWeight, 0.2, 0.000001, "D/V");
approxEqual(wEasy.solution.wacc, 0.0898, 0.000001, "WACC");
const wEasyFU = WaccEngine.generateFollowUps(wEasy)[0];
approxEqual(wEasyFU.correctValue, 0.0986, 0.000001, "WACC follow-up (beta+0.2)");
if (wEasyFU.correctDirection !== "up") { failures++; console.error("FAIL WACC easy follow-up direction"); }
else console.log("OK   WACC easy follow-up direction: up");

console.log("\n=== WACC: Medium (beta relever) ===");
const wMed = WaccEngine.buildProblem("medium", {
  riskFreeRate: 0.04, erp: 0.06, compBeta: 1.5, compDE: 0.8, taxRate: 0.24,
  costOfDebtPreTax: 0.07, equityValue: 900, debtValue: 300,
});
approxEqual(wMed.solution.targetDE, 0.333333, 0.000001, "Target D/E");
approxEqual(wMed.solution.unleveredBeta, 0.932836, 0.000001, "Unlevered Beta");
approxEqual(wMed.solution.releveredBeta, 1.169154, 0.000001, "Relevered Beta");
approxEqual(wMed.solution.wacc, 0.095912, 0.000001, "WACC");
const wMedFU = WaccEngine.generateFollowUps(wMed)[0];
approxEqual(wMedFU.correctValue, 0.095758, 0.000001, "WACC follow-up (tax+3pt)");
if (wMedFU.correctDirection !== "down") { failures++; console.error("FAIL WACC medium follow-up direction"); }
else console.log("OK   WACC medium follow-up direction: down");

let waccRandomFailures = 0;
for (const tier of ["easy", "medium"]) {
  for (let i = 0; i < 500; i++) {
    const p = WaccEngine.generateProblem(tier, i * 5147 + 3);
    if (!Number.isFinite(p.solution.wacc)) { waccRandomFailures++; console.error(`FAIL non-finite WACC ${tier} seed=${i}`); }
  }
}
if (waccRandomFailures === 0) console.log("OK   All 1000 randomly generated WACC problems produced finite results");
else failures += waccRandomFailures;

// =========================================================================
// Beta un-lever/re-lever engine
// =========================================================================
const BetaEngine = require("./beta-engine.js");

console.log("\n=== Beta: Easy ===");
const bEasy = BetaEngine.buildProblem("easy", { leveredBeta: 1.4, de: 0.6, taxRate: 0.25, targetDE: 1.0 });
approxEqual(bEasy.solution.unleveredBeta, 0.965517, 0.000001, "Unlevered Beta");
approxEqual(bEasy.solution.releveredBeta, 1.689655, 0.000001, "Relevered Beta");

console.log("\n=== Beta: Medium (3 comps) ===");
const bMed = BetaEngine.buildProblem("medium", {
  taxRate: 0.25, targetDE: 0.7,
  comps: [{ beta: 1.3, de: 0.5 }, { beta: 1.6, de: 0.9 }, { beta: 1.1, de: 0.3 }],
});
approxEqual(bMed.solution.unleveredBetas[0], 0.945455, 0.000001, "Comp 1 unlevered");
approxEqual(bMed.solution.unleveredBetas[1], 0.955224, 0.000001, "Comp 2 unlevered");
approxEqual(bMed.solution.unleveredBetas[2], 0.897959, 0.000001, "Comp 3 unlevered");
approxEqual(bMed.solution.averageUnleveredBeta, 0.932879, 0.000001, "Average unlevered");
approxEqual(bMed.solution.releveredBeta, 1.422641, 0.000001, "Relevered Beta");
const bMedFU = BetaEngine.generateFollowUps(bMed)[0];
approxEqual(bMedFU.correctValue, 0.884513, 0.000001, "Beta medium follow-up (comp2 DE up)");
if (bMedFU.correctDirection !== "down") { failures++; console.error("FAIL Beta medium follow-up direction"); }
else console.log("OK   Beta medium follow-up direction: down");

let betaRandomFailures = 0;
for (const tier of ["easy", "medium"]) {
  for (let i = 0; i < 500; i++) {
    const p = BetaEngine.generateProblem(tier, i * 6247 + 11);
    const val = tier === "easy" ? p.solution.releveredBeta : p.solution.releveredBeta;
    if (!Number.isFinite(val)) { betaRandomFailures++; console.error(`FAIL non-finite beta ${tier} seed=${i}`); }
  }
}
if (betaRandomFailures === 0) console.log("OK   All 1000 randomly generated Beta problems produced finite results");
else failures += betaRandomFailures;

// =========================================================================
// Unlevered FCF build engine
// =========================================================================
const FCFEngine = require("./fcf-engine.js");

console.log("\n=== FCF build: Easy ===");
const fEasy = FCFEngine.buildProblem("easy", { taxRate: 0.25, ebitda: 300, da: 30, capex: 25, deltaNwc: 8 });
approxEqual(fEasy.solution.ebit, 270, 0.0001, "EBIT");
approxEqual(fEasy.solution.nopat, 202.5, 0.0001, "NOPAT");
approxEqual(fEasy.solution.fcf, 199.5, 0.0001, "Unlevered FCF");
const fEasyFU = FCFEngine.generateFollowUps(fEasy)[0];
approxEqual(fEasyFU.correctValue, 200.625, 0.0001, "FCF follow-up (D&A+15%)");
if (fEasyFU.correctDirection !== "up") { failures++; console.error("FAIL FCF easy follow-up direction (expected up, tax shield)"); }
else console.log("OK   FCF easy follow-up direction: up (tax shield)");

console.log("\n=== FCF build: Medium (3-year) ===");
const fMed = FCFEngine.buildProblem("medium", {
  taxRate: 0.24, baseEbitda: 250, ebitdaGrowth: 0.07, daPct: 0.10, capexPct: 0.09, nwcPct: 0.015, years: 3,
});
approxEqual(fMed.solution.years[0].ebitda, 267.5, 0.0001, "Year1 EBITDA");
approxEqual(fMed.solution.years[0].fcf, 181.6325, 0.0005, "Year1 FCF");
approxEqual(fMed.solution.years[1].fcf, 194.3468, 0.0005, "Year2 FCF");
approxEqual(fMed.solution.years[2].fcf, 207.9510, 0.0005, "Year3 FCF");

let fcfRandomFailures = 0;
for (const tier of ["easy", "medium"]) {
  for (let i = 0; i < 500; i++) {
    const p = FCFEngine.generateProblem(tier, i * 4111 + 17);
    const val = tier === "easy" ? p.solution.fcf : p.solution.totalFcf;
    if (!Number.isFinite(val)) { fcfRandomFailures++; console.error(`FAIL non-finite FCF ${tier} seed=${i}`); }
  }
}
if (fcfRandomFailures === 0) console.log("OK   All 1000 randomly generated FCF problems produced finite results");
else failures += fcfRandomFailures;

console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : failures + " TEST(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
