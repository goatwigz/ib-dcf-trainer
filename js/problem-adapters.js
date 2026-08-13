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
  // Wraps a formatted number in monospace styling for embedding inline
  // within a sentence — keeps "monospace for all numeric values" true
  // even when the numbers live inside prose instead of a table cell.
  function nm(s) {
    return '<span class="inline-num">' + s + "</span>";
  }

  // Builds the "debt is X, cash is Y, N shares outstanding" clause,
  // omitting preferred stock / noncontrolling interests when they're
  // zero (common — most companies don't carry them) so the sentence
  // doesn't read "preferred stock $0.0m."
  function bridgeClause(inputs) {
    const parts = ["debt is " + nm(money(inputs.debt))];
    if (inputs.preferredStock > 0) parts.push("preferred stock " + nm(money(inputs.preferredStock)));
    if (inputs.noncontrollingInterests > 0) parts.push("noncontrolling interests " + nm(money(inputs.noncontrollingInterests)));
    parts.push("cash is " + nm(money(inputs.cashAndEquivalents)));
    return parts.join(", ") + ", and there are " + nm(inputs.sharesOutstanding + "m") + " shares outstanding";
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

    let narrative;
    if (subtype === "gordon" && tier === "easy") {
      narrative =
        '<p>Your interviewer says: &ldquo;Let&rsquo;s do a quick DCF. This company will generate free cash flows of ' +
        nm(money(inputs.cashFlows[0])) + ", " + nm(money(inputs.cashFlows[1])) + ", and " + nm(money(inputs.cashFlows[2])) +
        " over the next three years. Discount those back at " + nm(pct(inputs.discountRate, 1)) +
        ", and assume cash flows grow at " + nm(pct(inputs.terminalGrowth, 1)) +
        " forever after that. Walk me through getting to Enterprise Value.&rdquo;</p>";
    } else if (subtype === "gordon" && tier === "medium") {
      narrative =
        '<p>Your interviewer says: &ldquo;Let&rsquo;s build a 5-year DCF. Current free cash flow is ' +
        nm(money(inputs.baseCashFlow)) + " growing at " + nm(pct(inputs.cashFlowGrowth, 1)) +
        " a year. Discount it at " + nm(pct(inputs.discountRate, 1)) + ", with a " + nm(pct(inputs.terminalGrowth, 1)) +
        " terminal growth rate. Then bridge down to a per-share value — " + bridgeClause(inputs) + ".&rdquo;</p>";
    } else if (subtype === "exitMultiple" && tier === "easy") {
      narrative =
        '<p>Your interviewer says: &ldquo;Same idea, but use an exit multiple this time. Free cash flows are ' +
        nm(money(inputs.cashFlows[0])) + ", " + nm(money(inputs.cashFlows[1])) + ", and " + nm(money(inputs.cashFlows[2])) +
        " over three years, discounted at " + nm(pct(inputs.discountRate, 1)) +
        ". For terminal value, apply a " + nm(inputs.exitMultiple.toFixed(1) + "x") +
        " multiple to a final-year EBITDA of " + nm(money(inputs.finalYearMetric)) + ".&rdquo;</p>";
    } else {
      narrative =
        '<p>Your interviewer says: &ldquo;5-year DCF again, exit multiple this time. Current free cash flow is ' +
        nm(money(inputs.baseCashFlow)) + " growing at " + nm(pct(inputs.cashFlowGrowth, 1)) +
        " a year, discounted at " + nm(pct(inputs.discountRate, 1)) + ". Terminal value comes from a " +
        nm(inputs.exitMultiple.toFixed(1) + "x") + " multiple on a final-year EBITDA of " + nm(money(inputs.finalYearMetric)) +
        ". Then bridge to per-share — " + bridgeClause(inputs) + ".&rdquo;</p>";
    }

    return {
      layout: "table",
      title: subtype === "gordon" ? "DCF — Gordon Growth Terminal Value" : "DCF — Exit Multiple Terminal Value",
      narrative,
      groups,
      checkStep: (p, key, val) => DCFEngine.checkStep(p, key, val),
      generateFollowUps: (p) => DCFEngine.generateFollowUps(p),
    };
  }

  // ---- WACC build-up --------------------------------------------------
  function waccAdapter(problem) {
    const { tier, inputs } = problem;
    const groups = [];
    let narrative;

    if (tier === "easy") {
      narrative =
        '<p>Your interviewer says: &ldquo;Walk me through WACC. Beta is ' + nm(inputs.beta.toFixed(2)) +
        ", the risk-free rate is " + nm(pct(inputs.riskFreeRate, 2)) + ", and the equity risk premium is " +
        nm(pct(inputs.erp, 2)) + ". Pre-tax cost of debt is " + nm(pct(inputs.costOfDebtPreTax, 2)) + ", taxed at " +
        nm(pct(inputs.taxRate, 0)) + ". Equity is worth " + nm(money(inputs.equityValue)) + " and debt " +
        nm(money(inputs.debtValue)) + ".&rdquo;</p>";
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
    } else {
      narrative =
        '<p>Your interviewer says: &ldquo;This company doesn&rsquo;t have its own trading history, so use a comparable — levered beta of ' +
        nm(inputs.compBeta.toFixed(2)) + " at a D/E of " + nm(inputs.compDE.toFixed(2)) +
        ". Un-lever it, then re-lever it to this company's own capital structure: equity of " + nm(money(inputs.equityValue)) +
        " and debt of " + nm(money(inputs.debtValue)) + ". Risk-free rate is " + nm(pct(inputs.riskFreeRate, 2)) +
        ", equity risk premium " + nm(pct(inputs.erp, 2)) + ", pre-tax cost of debt " + nm(pct(inputs.costOfDebtPreTax, 2)) +
        ", tax rate " + nm(pct(inputs.taxRate, 0)) + ". Build up to WACC.&rdquo;</p>";
      groups.push({
        label: "Beta re-levering",
        fields: [
          { key: "targetDE", label: "Target D/E", unit: "", decimals: 3, given: false },
          { key: "unleveredBeta", label: "Un-levered Beta", unit: "", decimals: 3, given: false },
          { key: "releveredBeta", label: "Re-levered Beta", unit: "", decimals: 3, given: false },
        ],
      });
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
    }

    return {
      layout: "steplist",
      title: "WACC Build-Up",
      narrative,
      groups,
      checkStep: (p, key, val) => WaccEngine.checkStep(p, key, val),
      generateFollowUps: (p) => WaccEngine.generateFollowUps(p),
    };
  }

  // ---- Beta un-lever / re-lever ---------------------------------------
  function betaAdapter(problem) {
    const { tier, inputs } = problem;
    const groups = [];
    let narrative;

    if (tier === "easy") {
      narrative =
        '<p>Your interviewer says: &ldquo;A comparable has a levered beta of ' + nm(inputs.leveredBeta.toFixed(2)) +
        " at a D/E of " + nm(inputs.de.toFixed(2)) + ", taxed at " + nm(pct(inputs.taxRate, 0)) +
        ". Un-lever that beta, then re-lever it to our target company's D/E of " + nm(inputs.targetDE.toFixed(2)) + ".&rdquo;</p>";
      groups.push({
        label: "Un-lever / re-lever",
        fields: [
          { key: "unleveredBeta", label: "Un-levered Beta", unit: "", decimals: 3, given: false },
          { key: "releveredBeta", label: "Re-levered Beta", unit: "", decimals: 3, given: false },
        ],
      });
    } else {
      const c = inputs.comps;
      narrative =
        '<p>Your interviewer says: &ldquo;Here are three comparables: beta ' + nm(c[0].beta.toFixed(2)) +
        " at D/E " + nm(c[0].de.toFixed(2)) + ", beta " + nm(c[1].beta.toFixed(2)) + " at D/E " + nm(c[1].de.toFixed(2)) +
        ", and beta " + nm(c[2].beta.toFixed(2)) + " at D/E " + nm(c[2].de.toFixed(2)) + ", all taxed at " +
        nm(pct(inputs.taxRate, 0)) + ". Un-lever each one, average the results, and re-lever to our target D/E of " +
        nm(inputs.targetDE.toFixed(2)) + ".&rdquo;</p>";
      inputs.comps.forEach((comp, i) => {
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
      narrative,
      groups,
      checkStep: (p, key, val) => BetaEngine.checkStep(p, key, val),
      generateFollowUps: (p) => BetaEngine.generateFollowUps(p),
    };
  }

  // ---- Unlevered FCF build ---------------------------------------------
  function fcfAdapter(problem) {
    const { tier, inputs } = problem;
    const groups = [];
    let narrative;

    if (tier === "easy") {
      narrative =
        '<p>Your interviewer says: &ldquo;Quick one — EBITDA is ' + nm(money(inputs.ebitda)) + ", D&amp;A is " +
        nm(money(inputs.da)) + ", taxed at " + nm(pct(inputs.taxRate, 0)) + ". CapEx is " + nm(money(inputs.capex)) +
        " and the change in net working capital is " + nm(money(inputs.deltaNwc)) +
        ". Walk me through Unlevered Free Cash Flow.&rdquo;</p>";
      groups.push({
        label: "Build",
        fields: [
          { key: "ebit", label: "EBIT", unit: "$m", decimals: 1, given: false },
          { key: "nopat", label: "NOPAT", unit: "$m", decimals: 1, given: false },
          { key: "fcf", label: "Unlevered FCF", unit: "$m", decimals: 1, given: false },
        ],
      });
    } else {
      narrative =
        '<p>Your interviewer says: &ldquo;Project this three years out. EBITDA starts at ' + nm(money(inputs.baseEbitda)) +
        ", growing " + nm(pct(inputs.ebitdaGrowth, 1)) + " a year. D&amp;A runs " + nm(pct(inputs.daPct, 1)) +
        " of EBITDA, CapEx " + nm(pct(inputs.capexPct, 1)) + ", and the change in net working capital " +
        nm(pct(inputs.nwcPct, 2)) + ", all taxed at " + nm(pct(inputs.taxRate, 0)) +
        ". Build unlevered FCF for each year.&rdquo;</p>";
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
      narrative,
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

  // Deterministically rebuild the exact same problem from its stored
  // (already-randomized) inputs — used to restore an in-progress session
  // after a refresh, without needing to persist a random seed.
  function rebuildProblem(category, subtype, tier, inputs) {
    if (category === "dcf") return DCFEngine.buildProblem(subtype, tier, inputs);
    if (category === "wacc") return WaccEngine.buildProblem(tier, inputs);
    if (category === "beta") return BetaEngine.buildProblem(tier, inputs);
    if (category === "fcf") return FCFEngine.buildProblem(tier, inputs);
    throw new Error("Unknown category: " + category);
  }

  // A stable identity for "have I seen this kind of problem before" —
  // used to decide untimed-first vs. timed-after.
  function seenKey(category, problem, tier) {
    if (category === "dcf") return "dcf:" + problem.subtype + ":" + tier;
    return category + ":" + tier;
  }

  const ProblemAdapters = { PROBLEM_TYPES, generateProblem, adapt, seenKey, rebuildProblem };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ProblemAdapters;
  } else {
    root.ProblemAdapters = ProblemAdapters;
  }
})(typeof window !== "undefined" ? window : globalThis);
