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

const fu1 = DCFEngine.generateFollowUps(p1);
approxEqual(fu1[0].correctValue, 1325.1885, 0.0001, "Follow-up 1 (rate+1pt) EV");
if (fu1[0].correctDirection !== "down") {
  failures++;
  console.error("FAIL Follow-up 1 direction: expected down, got " + fu1[0].correctDirection);
} else {
  console.log("OK   Follow-up 1 direction: down");
}
approxEqual(fu1[1].correctValue, 1598.5832, 0.0001, "Follow-up 2 (growth+0.5pt) EV");
if (fu1[1].correctDirection !== "up") {
  failures++;
  console.error("FAIL Follow-up 2 direction: expected up, got " + fu1[1].correctDirection);
} else {
  console.log("OK   Follow-up 2 direction: up");
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

const fu2 = DCFEngine.generateFollowUps(p2);
approxEqual(fu2[0].correctValue, 2583.8622, 0.0005, "Follow-up 1 (rate+1pt) EV");
approxEqual(fu2[1].correctValue, 2797.9018, 0.0005, "Follow-up 2 (multiple+0.5x) EV");
approxEqual(fu2[2].deltaR, 102.8748, 0.0005, "compareSensitivity deltaR");
approxEqual(fu2[2].deltaG, 222.3297, 0.0005, "compareSensitivity deltaMultiple");
if (fu2[2].correctAnswer !== "terminalAssumption") {
  failures++;
  console.error("FAIL compareSensitivity answer: expected terminalAssumption, got " + fu2[2].correctAnswer);
} else {
  console.log("OK   compareSensitivity answer: terminalAssumption");
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

console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : failures + " TEST(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
