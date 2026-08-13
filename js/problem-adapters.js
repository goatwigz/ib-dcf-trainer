/*
Adapters: turn each engine's problem object into a common shape the
renderer can display generically, without needing five bespoke UIs.

Two layouts:
  "table"    — DCF gordon/exitMultiple: year rows (Cash Flow, Discount
               Factor, Present Value) plus summary rows underneath.
  "steplist" — WACC, Beta, FCF: a panel of given (fixed) inputs, then an
               ordered, possibly-grouped list of blank fields to fill in.

Every field carries: key (matches the owning engine's checkStep key),
label, unit, decimals (for display formatting), given (fixed value,
already "filled in" and not editable) or blank (student must fill it).
*/

(function (root) {
  "use strict";

  function money(n) {
    return "$" + Number(n).toFixed(1) + "m";
  }
  function pct(n, decimals) {
    return (Number(n) * 100).toFixed(decimals === undefined ? 2 : decimals) + "%";
  }

  // ---- DCF table (gordon / exitMultiple) ----------------------------
  function dcfTableAdapter(problem) {
    const { subtype, tier, inputs, solution } = problem;
    const rows = solution.rows.map((row, i) => {
      const n = i + 1;
      const cfGiven = tier === "easy";
      return {
        label: "Year " + n,
        fields: [
          { key: "cf_" + n, label: "Cash Flow", unit: "$m", decimals: 1, given: cfGiven, value: cfGiven ? row.cashFlow : undefined },
          { key: "df_" + n, label: "Discount Factor", unit: "", decimals: 4, given: false },
          { key: "pv_" + n, label: "Present Value", unit: "$m", decimals: 1, given: false },
        ],
      };
    });

    const summaryFields = [
      { key: "terminalValue", label: "Terminal Value", unit: "$m", decimals: 1, given: false },
      { key: "pvTerminalValue", label: "PV of Terminal Value", unit: "$m", decimals: 1, given: false },
      { key: "enterpriseValue", label: "Enterprise Value", unit: "$m", decimals: 1, given: false },
    ];
    const groups = [...rows, { label: "Terminal Value", fields: summaryFields }];

    if (tier === "medium") {
      groups.push({
        label: "Equity Bridge",
        fields: [
          { key: "equityValue", label: "Equity Value", unit: "$m", decimals: 1, given: false },
          { key: "valuePerShare", label: "Value per Share", unit: "$", decimals: 2, given: false },
        ],
      });
    }

    const givenLines = [
      "Discount rate: " + pct(inputs.discountRate, 1),
      subtype === "gordon"
        ? "Terminal growth rate: " + pct(inputs.terminalGrowth, 1)
        : "Exit multiple: " + inputs.exitMultiple.toFixed(1) + "x on final-year EBITDA of " + money(inputs.finalYearMetric),
    ];
    if (tier === "medium") {
      givenLines.push(
        "Base cash flow: " + money(inputs.baseCashFlow) + " growing at " + pct(inputs.cashFlowGrowth, 1) + "/year"
      );
      givenLines.push(
        "Debt " + money(inputs.debt) + ", Preferred Stock " + money(inputs.preferredStock) +
        ", Noncontrolling Interests " + money(inputs.noncontrollingInterests) +
        ", Cash & Equivalents " + money(inputs.cashAndEquivalents) +
        ", Shares Outstanding " + inputs.sharesOutstanding + "m"
      );
    }

    return {
      layout: "table",
      title: subtype === "gordon" ? "DCF — Gordon Growth Terminal Value" : "DCF — Exit Multiple Terminal Value",
      givenLines,
      groups,
      checkStep: (p, key, val) => DCFEngine.checkStep(p, key, val),
      generateFollowUps: (p) => DCFEngine.generateFollowUps(p),
    };
  }

  // ---- WACC build-up --------------------------------------------------
  function waccAdapter(problem) {
    const { tier, inputs } = problem;
    const givenLines = [
      "Risk-free rate: " + pct(inputs.riskFreeRate, 2),
      "Equity risk premium: " + pct(inputs.erp, 2),
      "Pre-tax cost of debt: " + pct(inputs.costOfDebtPreTax, 2),
      "Tax rate: " + pct(inputs.taxRate, 0),
      "Equity value: " + money(inputs.equityValue),
      "Debt value: " + money(inputs.debtValue),
    ];
    const groups = [];
    if (tier === "easy") {
      givenLines.unshift("Beta: " + inputs.beta.toFixed(2));
    } else {
      givenLines.unshift("Comparable's levered beta: " + inputs.compBeta.toFixed(2) + " at D/E " + inputs.compDE.toFixed(2));
      groups.push({
        label: "Beta re-levering",
        fields: [
          { key: "targetDE", label: "Target D/E", unit: "", decimals: 3, given: false },
          { key: "unleveredBeta", label: "Un-levered Beta", unit: "", decimals: 3, given: false },
          { key: "releveredBeta", label: "Re-levered Beta", unit: "", decimals: 3, given: false },
        ],
      });
    }
    groups.push({
      label: "WACC build-up",
      fields: [
        { key: "costOfEquity", label: "Cost of Equity", unit: "", decimals: 4, given: false, isPercent: true },
        { key: "costOfDebtAfterTax", label: "After-tax Cost of Debt", unit: "", decimals: 4, given: false, isPercent: true },
        { key: "evWeight", label: "E / V", unit: "", decimals: 3, given: false },
        { key: "dvWeight", label: "D / V", unit: "", decimals: 3, given: false },
        { key: "wacc", label: "WACC", unit: "", decimals: 4, given: false, isPercent: true },
      ],
    });

    return {
      layout: "steplist",
      title: "WACC Build-Up",
      givenLines,
      groups,
      checkStep: (p, key, val) => WaccEngine.checkStep(p, key, val),
      generateFollowUps: (p) => WaccEngine.generateFollowUps(p),
    };
  }

  // ---- Beta un-lever / re-lever ---------------------------------------
  function betaAdapter(problem) {
    const { tier, inputs } = problem;
    const givenLines = ["Tax rate: " + pct(inputs.taxRate, 0), "Target D/E: " + inputs.targetDE.toFixed(2)];
    const groups = [];

    if (tier === "easy") {
      givenLines.unshift("Levered beta: " + inputs.leveredBeta.toFixed(2) + " at D/E " + inputs.de.toFixed(2));
      groups.push({
        label: "Un-lever / re-lever",
        fields: [
          { key: "unleveredBeta", label: "Un-levered Beta", unit: "", decimals: 3, given: false },
          { key: "releveredBeta", label: "Re-levered Beta", unit: "", decimals: 3, given: false },
        ],
      });
    } else {
      inputs.comps.forEach((c, i) => {
        givenLines.push("Comp " + (i + 1) + ": beta " + c.beta.toFixed(2) + " at D/E " + c.de.toFixed(2));
        groups.push({
          label: "Comp " + (i + 1),
          fields: [{ key: "unlevered_" + (i + 1), label: "Un-levered Beta", unit: "", decimals: 3, given: false }],
        });
      });
      groups.push({
        label: "Average & re-lever",
        fields: [
          { key: "averageUnleveredBeta", label: "Average Un-levered Beta", unit: "", decimals: 3, given: false },
          { key: "releveredBeta", label: "Re-levered Beta", unit: "", decimals: 3, given: false },
        ],
      });
    }

    return {
      layout: "steplist",
      title: "Beta Un-lever / Re-lever",
      givenLines,
      groups,
      checkStep: (p, key, val) => BetaEngine.checkStep(p, key, val),
      generateFollowUps: (p) => BetaEngine.generateFollowUps(p),
    };
  }

  // ---- Unlevered FCF build ---------------------------------------------
  function fcfAdapter(problem) {
    const { tier, inputs } = problem;
    const groups = [];
    let givenLines;

    if (tier === "easy") {
      givenLines = [
        "EBITDA: " + money(inputs.ebitda),
        "D&A: " + money(inputs.da),
        "Tax rate: " + pct(inputs.taxRate, 0),
        "CapEx: " + money(inputs.capex),
        "Δ Net Working Capital: " + money(inputs.deltaNwc),
      ];
      groups.push({
        label: "Build",
        fields: [
          { key: "ebit", label: "EBIT", unit: "$m", decimals: 1, given: false },
          { key: "nopat", label: "NOPAT", unit: "$m", decimals: 1, given: false },
          { key: "fcf", label: "Unlevered FCF", unit: "$m", decimals: 1, given: false },
        ],
      });
    } else {
      givenLines = [
        "Base EBITDA: " + money(inputs.baseEbitda) + " growing at " + pct(inputs.ebitdaGrowth, 1) + "/year",
        "D&A: " + pct(inputs.daPct, 1) + " of EBITDA",
        "CapEx: " + pct(inputs.capexPct, 1) + " of EBITDA",
        "Δ NWC: " + pct(inputs.nwcPct, 2) + " of EBITDA",
        "Tax rate: " + pct(inputs.taxRate, 0),
      ];
      for (let n = 1; n <= inputs.years; n++) {
        groups.push({
          label: "Year " + n,
          fields: [
            { key: "ebitda_" + n, label: "EBITDA", unit: "$m", decimals: 1, given: false },
            { key: "da_" + n, label: "D&A", unit: "$m", decimals: 1, given: false },
            { key: "ebit_" + n, label: "EBIT", unit: "$m", decimals: 1, given: false },
            { key: "nopat_" + n, label: "NOPAT", unit: "$m", decimals: 1, given: false },
            { key: "capex_" + n, label: "CapEx", unit: "$m", decimals: 1, given: false },
            { key: "nwc_" + n, label: "Δ NWC", unit: "$m", decimals: 1, given: false },
            { key: "fcf_" + n, label: "Unlevered FCF", unit: "$m", decimals: 1, given: false },
          ],
        });
      }
    }

    return {
      layout: "steplist",
      title: "Unlevered FCF Build",
      givenLines,
      groups,
      checkStep: (p, key, val) => FCFEngine.checkStep(p, key, val),
      generateFollowUps: (p) => FCFEngine.generateFollowUps(p),
    };
  }

  // ---- Dispatch ---------------------------------------------------------
  const PROBLEM_TYPES = [
    { category: "dcf", subtype: "gordon" },
    { category: "dcf", subtype: "exitMultiple" },
    { category: "wacc" },
    { category: "beta" },
    { category: "fcf" },
  ];

  function generateProblem(category, subtype, tier, seed) {
    if (category === "dcf") return { category, problem: DCFEngine.generateProblem(subtype, tier, seed) };
    if (category === "wacc") return { category, problem: WaccEngine.generateProblem(tier, seed) };
    if (category === "beta") return { category, problem: BetaEngine.generateProblem(tier, seed) };
    if (category === "fcf") return { category, problem: FCFEngine.generateProblem(tier, seed) };
    throw new Error("Unknown category: " + category);
  }

  function adapt(category, problem) {
    if (category === "dcf") return dcfTableAdapter(problem);
    if (category === "wacc") return waccAdapter(problem);
    if (category === "beta") return betaAdapter(problem);
    if (category === "fcf") return fcfAdapter(problem);
    throw new Error("Unknown category: " + category);
  }

  // A stable identity for "have I seen this kind of problem before" —
  // used to decide untimed-first vs. timed-after.
  function seenKey(category, problem, tier) {
    if (category === "dcf") return "dcf:" + problem.subtype + ":" + tier;
    return category + ":" + tier;
  }

  const ProblemAdapters = { PROBLEM_TYPES, generateProblem, adapt, seenKey };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ProblemAdapters;
  } else {
    root.ProblemAdapters = ProblemAdapters;
  }
})(typeof window !== "undefined" ? window : globalThis);
