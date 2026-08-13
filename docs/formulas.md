# DCF Drill — Formula Reference & Worked Examples

This document exists so you can check the finance methodology is correct
**without reading any code.** Every formula the tool uses is listed here,
followed by fully worked, hand-checkable examples for every sub-type,
matching the actual engine output exactly.

## All sub-types

The DCF topic is covered by five drill types, not just the discounting
table itself:

1. **DCF table — Gordon Growth** — terminal value from a perpetuity
   growth formula. The standard "walk me through a DCF" answer.
2. **DCF table — Exit Multiple** — terminal value from applying a
   multiple to a final-year metric (EBITDA).
3. **WACC build-up** — cost of equity (CAPM), after-tax cost of debt,
   and capital-structure weighting, producing the discount rate that
   feeds into the table above.
4. **Beta un-lever / re-lever** — the Hamada equation, used to strip a
   comparable company's beta of its capital structure and re-lever it
   to the target company's — often asked as its own rapid-fire
   technical question, and also embedded in the medium-tier WACC
   build-up.
5. **Unlevered FCF build** — deriving the cash flow itself from
   EBITDA/EBIT down to unlevered free cash flow, instead of being
   handed a cash flow figure directly.

Sections 3–5 below cover the new sub-types. The DCF table sections
(discounting, terminal value, equity bridge) are unchanged from before.

## The two tiers (DCF table)

|                              | Easy                      | Medium                                   |
|------------------------------|---------------------------|-------------------------------------------|
| Projection years              | 3                         | 5                                         |
| Cash flow                     | given directly, each year | must be grown from a base + growth rate  |
| Discount rate                 | whole %, 8–12%            | half-points, 6–15%                       |
| Terminal growth rate (Gordon) | 2–3%                      | 1.5–3.5%                                  |
| Equity bridge (debt, preferred, NCI, cash → per-share) | not included | included                        |

**Safety rule:** the terminal growth rate is always kept at least 2
percentage points below the discount rate, so the perpetuity formula
never approaches division by a near-zero number.

## Formulas

1. **Discount factor, year n** = 1 ÷ (1 + r)ⁿ
   r = discount rate, n = year number (1, 2, 3, …)

2. **Present value, year n** = Cash Flow(n) × Discount Factor(n)

3. **Cash flow, year n** *(medium tier only — easy tier gives these directly)*
   = Base Cash Flow × (1 + growth rate)ⁿ

4. **Terminal Value — Gordon Growth method**
   = Final-year Cash Flow × (1 + g) ÷ (r − g)
   g = terminal growth rate. Must be less than r.

5. **Terminal Value — Exit Multiple method**
   = Final-year EBITDA × Exit Multiple

6. **PV of Terminal Value** = Terminal Value × Discount Factor(final year)
   *(same discount factor as the last projection year — standard
   end-of-year convention, no mid-year adjustment.)*

7. **Enterprise Value** = Σ (PV of each year's cash flow) + PV of Terminal Value

8. **Equity Value** *(medium tier only)* = Enterprise Value − Debt − Preferred Stock
   − Noncontrolling Interests + Cash & Cash Equivalents

   This is the full EV-to-equity bridge, not a collapsed "net debt"
   shortcut. Preferred stock and noncontrolling interests are randomly
   zero about half the time (most companies don't carry them), but
   they're always shown as explicit line items — the drill is testing
   whether the student knows to include every term of the bridge, not
   just whether they can subtract two numbers.

9. **Value per Share** *(medium tier only)* = Equity Value ÷ Shares Outstanding

## Grading tolerance

A student's entry is marked correct if it's within:

- **Discount factor:** ± 0.001
- **Any dollar figure** (cash flow, PV, terminal value, EV, equity value):
  ± 0.5% of the correct value, or ± $0.1m, whichever is bigger
- **Value per share:** ± 1% of the correct value, or ± $0.01, whichever is bigger

This exists so a student who rounds sensibly isn't marked wrong for a
rounding difference — it does not loosen what counts as understanding
the method.

## Follow-up questions (DCF table)

Rate sensitivity always appears first. The rest are drawn at random
from a bank (without repeats within one problem), so repeated drilling
surfaces variety instead of stacking every follow-up type onto one
problem. Easy tier gets 2 follow-ups total; medium gets 3.

1. **Discount rate +1.0 point** *(always included)* — recompute
   Enterprise Value with the higher rate; correct answer requires both
   the right direction (always down) and the new EV within tolerance.
2. **Terminal assumption +0.5 point/0.5x** — same idea, for terminal
   growth rate (Gordon) or exit multiple (Exit Multiple); correct
   direction is always up.
3. **Terminal value cross-check** — given the terminal value already
   computed, what does it imply about the *other* method's assumption?
   - Gordon Growth problems: **Implied Exit Multiple = Terminal Value ÷
     final-year EBITDA** (EBITDA given separately, just for this check).
   - Exit Multiple problems: **Implied growth rate**, found by
     rearranging the Gordon Growth formula for g:
     g = (TV × r − final-year Cash Flow) ÷ (TV + final-year Cash Flow)
4. **Mid-year convention** — recompute the whole DCF using
   1 ÷ (1+r)^(n−0.5) instead of 1 ÷ (1+r)ⁿ for every discount factor,
   including the terminal value's. Mid-year discounting always
   *increases* EV (cash flows are treated as arriving mid-year instead
   of at year-end, so they're discounted less).
5. **Medium tier only — sensitivity comparison** — recompute EV for a
   1-point rise in the discount rate AND a 1-point/1x rise in the
   terminal assumption, then ask which moved EV more. The "correct"
   answer is whichever produces the bigger dollar swing for *that*
   specific problem's numbers — this is calculated fresh each time, not
   assumed.

---

## Worked Example 1 — Easy tier, Gordon Growth

**Given:** discount rate = 10%, terminal growth = 2.5%, 3 years, cash
flows given directly as $100m / $110m / $120m.

| Year | Cash Flow | Discount Factor | Present Value |
|------|-----------|------------------|----------------|
| 1 | 100 | 1/1.10¹ = 0.9091 | 100 × 0.9091 = 90.91 |
| 2 | 110 | 1/1.10² = 0.8264 | 110 × 0.8264 = 90.91 |
| 3 | 120 | 1/1.10³ = 0.7513 | 120 × 0.7513 = 90.16 |

- Terminal Value = 120 × 1.025 ÷ (0.10 − 0.025) = 123 ÷ 0.075 = **1,640.00**
- PV of Terminal Value = 1,640.00 × 0.7513 = **1,232.16**
- Enterprise Value = (90.91 + 90.91 + 90.16) + 1,232.16 = **1,504.13**

**Follow-up check:**
- Discount rate → 11%: new EV = **1,325.19** (down $178.94m) ✓ direction down
- Terminal growth → 3.0%: new EV = **1,598.58** (up $94.45m) ✓ direction up

## Worked Example 2 — Medium tier, Exit Multiple (with equity bridge)

**Given:** discount rate = 9.5%, 5 years, base cash flow = $200m growing
at 6%/year, exit multiple = 8.0x applied to final-year EBITDA of $350m,
debt = $150m, preferred stock = $20m, noncontrolling interests = $15m,
cash & equivalents = $70m, shares outstanding = 100m.

| Year | Cash Flow | Discount Factor | Present Value |
|------|-----------|------------------|----------------|
| 1 | 200×1.06¹ = 212.00 | 1/1.095¹ = 0.9132 | 193.61 |
| 2 | 200×1.06² = 224.72 | 1/1.095² = 0.8340 | 187.42 |
| 3 | 200×1.06³ = 238.20 | 1/1.095³ = 0.7617 | 181.43 |
| 4 | 200×1.06⁴ = 252.50 | 1/1.095⁴ = 0.6956 | 175.63 |
| 5 | 200×1.06⁵ = 267.65 | 1/1.095⁵ = 0.6352 | 170.02 |

- Terminal Value = 350 × 8.0 = **2,800.00**
- PV of Terminal Value = 2,800.00 × 0.6352 = **1,778.64**
- Enterprise Value = (193.61+187.42+181.43+175.63+170.02) + 1,778.64 = **2,686.74**
- Equity Value = 2,686.74 − 150 (debt) − 20 (preferred) − 15 (NCI) + 70 (cash) = **2,571.74**
- Value per Share = 2,571.74 ÷ 100 = **$25.72**

**Follow-up check:**
- Discount rate → 10.5%: new EV = **2,583.86** (down $102.87m) ✓ direction down
- Exit multiple → 8.5x: new EV = **2,797.90** (up $111.16m) ✓ direction up
- Sensitivity comparison: a 1-point rate rise moves EV by $102.87m; a 1x
  multiple rise moves EV by $222.33m → for this specific problem, the
  **terminal assumption (exit multiple) is the bigger mover**, and the
  engine computes this fresh each time rather than assuming rate
  sensitivity always wins.

### Cross-check and mid-year examples (using the numbers above)

- **TV cross-check (Example 1, Gordon):** given final-year EBITDA of
  $205m, implied exit multiple = 1,640.00 ÷ 205 = **8.0x**
- **TV cross-check (Exit Multiple, illustrative):** r = 9.5%, final-year
  EBITDA = $380m, exit multiple = 9.0x → TV = 3,420.00. Final-year cash
  flow = $267.65m (same growth path as Example 2).
  Implied g = (3,420.00×0.095 − 267.65) ÷ (3,420.00 + 267.65) = **1.55%**
  (sanity check: plugging 1.55% back into the Gordon Growth formula
  returns 3,420.00 — confirms the algebra)
- **Mid-year convention (Example 1):** discount factors become
  1/1.10^0.5, 1/1.10^1.5, 1/1.10^2.5 = 0.9535, 0.8668, 0.7880.
  New EV = **1,577.55** (up $73.42m from the end-of-year EV of 1,504.13,
  as expected — mid-year discounting always increases value)

---

## WACC Build-Up

**Formulas:**

1. **Cost of Equity (CAPM)** = Risk-free rate + Beta × Equity Risk Premium
2. **Un-levered Beta** *(medium tier only)* = Comp's Levered Beta ÷
   [1 + (1 − Tax Rate) × Comp's D/E]
3. **Re-levered Beta** *(medium tier only)* = Un-levered Beta ×
   [1 + (1 − Tax Rate) × Target D/E]
   *(Target D/E is the target company's own Debt ÷ Equity, computed
   from the market values of debt and equity given in the problem.)*
4. **After-tax Cost of Debt** = Pre-tax Cost of Debt × (1 − Tax Rate)
5. **E/V** = Equity Value ÷ (Equity Value + Debt Value); **D/V** = Debt
   Value ÷ (Equity Value + Debt Value)
6. **WACC** = E/V × Cost of Equity + D/V × After-tax Cost of Debt

Easy tier gives the levered beta directly and skips steps 2–3. Medium
tier requires un-levering a comparable company's beta and re-levering
it to the target — this is the same Hamada equation as the standalone
Beta drill below.

**Grading tolerance:** ± 0.001 (0.1 percentage point) for cost of
equity, after-tax cost of debt, and WACC; ± 0.005 for the E/V and D/V
weights; ± 0.02 for beta values.

### Worked Example — Easy

**Given:** risk-free rate = 3.5%, ERP = 5.5%, beta = 1.2, pre-tax cost
of debt = 6.0%, tax rate = 25%, equity value = $800m, debt value = $200m.

- Cost of Equity = 3.5% + 1.2 × 5.5% = **10.10%**
- After-tax Cost of Debt = 6.0% × (1 − 25%) = **4.50%**
- E/V = 800 ÷ 1,000 = **0.80**; D/V = 200 ÷ 1,000 = **0.20**
- WACC = 0.80 × 10.10% + 0.20 × 4.50% = **8.98%**

**Follow-up:** beta rises to 1.4 → Cost of Equity = 11.20% → new WACC =
0.80×11.20% + 0.20×4.50% = **9.86%** (up 0.88pt) ✓ direction up

### Worked Example — Medium (with beta re-levering)

**Given:** risk-free rate = 4.0%, ERP = 6.0%, a comparable company's
levered beta = 1.5 at D/E = 0.8, tax rate = 24%, pre-tax cost of debt =
7.0%, target equity value = $900m, target debt value = $300m.

- Target D/E = 300 ÷ 900 = **0.3333**
- Un-levered Beta = 1.5 ÷ [1 + (1−0.24)×0.8] = 1.5 ÷ 1.608 = **0.9328**
- Re-levered Beta = 0.9328 × [1 + (1−0.24)×0.3333] = 0.9328 × 1.2533 = **1.1692**
- Cost of Equity = 4.0% + 1.1692 × 6.0% = **11.01%**
- After-tax Cost of Debt = 7.0% × (1−0.24) = **5.32%**
- E/V = 900÷1,200 = **0.75**; D/V = 300÷1,200 = **0.25**
- WACC = 0.75×11.01% + 0.25×5.32% = **9.59%**

**Follow-up:** tax rate rises 3 points (to 27%) → recomputing the whole
chain gives a new WACC of **9.58%** (down 0.015pt). This is a genuinely
small, non-obvious move — a higher tax rate cuts the after-tax cost of
debt (pulling WACC down) but also raises the re-levered beta slightly
(pulling it up), and the two nearly offset. The engine always
recomputes this fresh rather than assuming a direction.

---

## Beta Un-lever / Re-lever (Hamada Equation)

**Formulas:**

1. **Un-levered Beta** = Levered Beta ÷ [1 + (1 − Tax Rate) × D/E]
2. **Re-levered Beta** = Un-levered Beta × [1 + (1 − Tax Rate) × Target D/E]

Medium tier uses three comparable companies: un-lever each one
individually, average the results, then re-lever the average once to
the target's capital structure.

**Grading tolerance:** ± 0.02 for every beta value.

### Worked Example — Easy

**Given:** levered beta = 1.4, D/E = 0.6, tax rate = 25%, target D/E = 1.0.

- Un-levered Beta = 1.4 ÷ [1 + (1−0.25)×0.6] = 1.4 ÷ 1.45 = **0.9655**
- Re-levered Beta = 0.9655 × [1 + (1−0.25)×1.0] = 0.9655 × 1.75 = **1.6897**

### Worked Example — Medium (3 comps)

**Given:** tax rate = 25%, target D/E = 0.7, three comps:

| Comp | Levered Beta | D/E | Un-levered Beta |
|---|---|---|---|
| 1 | 1.3 | 0.5 | 1.3 ÷ [1+0.75×0.5] = **0.9455** |
| 2 | 1.6 | 0.9 | 1.6 ÷ [1+0.75×0.9] = **0.9552** |
| 3 | 1.1 | 0.3 | 1.1 ÷ [1+0.75×0.3] = **0.8980** |

- Average Un-levered Beta = (0.9455+0.9552+0.8980) ÷ 3 = **0.9329**
- Re-levered Beta = 0.9329 × [1 + 0.75×0.7] = 0.9329 × 1.525 = **1.4226**

**Follow-up:** if Comp 2's D/E is corrected from 0.9 to 1.3, its
un-levered beta drops to 1.6÷[1+0.75×1.3]=0.8791, pulling the new
average down to **0.8845** (down from 0.9329) ✓ direction down.

---

## Unlevered Free Cash Flow Build

**Formulas:**

1. **EBIT** = EBITDA − D&A
2. **NOPAT** (EBIT after tax) = EBIT × (1 − Tax Rate)
3. **Unlevered FCF** = NOPAT + D&A − CapEx − Δ Net Working Capital

Δ NWC follows the standard sign convention: a positive value is an
*increase* in working capital (a use of cash, so it's subtracted); a
negative value means working capital released cash, which effectively
adds back.

Medium tier repeats this build across a 3-year mini-projection: EBITDA
grows from a base at a given rate, and D&A/CapEx/ΔNWC are each a fixed
percentage of that year's EBITDA.

**Grading tolerance:** ± 0.5% of the correct value, or ± $0.1m,
whichever is bigger (same as the DCF table's dollar-figure tolerance).

### Worked Example — Easy

**Given:** EBITDA = $300m, D&A = $30m, tax rate = 25%, CapEx = $25m,
Δ NWC = $8m.

- EBIT = 300 − 30 = **270.00**
- NOPAT = 270 × (1−0.25) = **202.50**
- Unlevered FCF = 202.50 + 30 − 25 − 8 = **199.50**

**Follow-up — the tax-shield effect:** D&A rises 15% to $34.5m. EBIT
drops to 265.5, NOPAT drops to 199.125 — but the larger D&A add-back
more than compensates: new FCF = 199.125 + 34.5 − 25 − 8 = **200.625**
(up $1.125m). **D&A is a non-cash, tax-deductible expense, so more of
it always increases unlevered FCF**, even though intuition might say
"bigger expense, less cash" — this is exactly the kind of mechanism a
real interview follow-up is testing.

### Worked Example — Medium (3-year)

**Given:** base EBITDA = $250m growing at 7%/year, tax rate = 24%,
D&A = 10% of EBITDA, CapEx = 9% of EBITDA, Δ NWC = 1.5% of EBITDA.

| Year | EBITDA | D&A | EBIT | NOPAT | CapEx | Δ NWC | FCF |
|---|---|---|---|---|---|---|---|
| 1 | 267.50 | 26.75 | 240.75 | 182.97 | 24.075 | 4.0125 | **181.63** |
| 2 | 286.23 | 28.62 | 257.60 | 195.78 | 25.760 | 4.2934 | **194.35** |
| 3 | 306.26 | 30.63 | 275.63 | 209.48 | 27.564 | 4.5939 | **207.95** |

---

Every worked example above was computed two ways independently — once
by hand following the formulas, once by a separate Python reference
script — and the results matched to the cent (or, for beta values, to
four decimal places). The actual JavaScript engine files
(`js/dcf-engine.js`, `js/wacc-engine.js`, `js/beta-engine.js`,
`js/fcf-engine.js`) were then run through an automated test suite
(`node js/test-engine.js`) that checks every one of these worked
examples against real engine output, plus a stress test of 5,000
randomly generated problems across every sub-type and tier checking for
crashes or invalid numbers. All tests pass as of this writing.
