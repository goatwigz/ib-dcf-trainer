# DCF Drill — Formula Reference & Worked Examples

This document exists so you can check the finance methodology is correct
**without reading any code.** Every formula the tool uses is listed here,
followed by two fully worked, hand-checkable examples (one per problem
sub-type) that match the actual engine output exactly.

## The two sub-types

- **Gordon Growth** — terminal value from a perpetuity growth formula.
  This is the standard "walk me through a DCF" answer.
- **Exit Multiple** — terminal value from applying a multiple to a
  final-year metric (EBITDA). This is what interviewers mean by "how
  would you do it with an exit multiple instead."

## The two tiers

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

## Follow-up questions

1. **Discount rate +1.0 point** — recompute Enterprise Value with the
   higher rate; correct answer requires both the right direction
   (always down) and the new EV within tolerance.
2. **Terminal assumption +0.5 point/0.5x** — same idea, for terminal
   growth rate (Gordon) or exit multiple (Exit Multiple); correct
   direction is always up.
3. **Medium tier only — sensitivity comparison** — recompute EV for a
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

---

Both examples above were computed twice independently (once by hand
following the formulas above, once by an independent Python script) and
the results matched to the cent. The actual JavaScript engine
(`js/dcf-engine.js`) was then traced line-by-line against these same
numbers and produces identical output. A fully automated test (running
the real engine file, not just tracing it) will be added once Node.js
finishes installing, and I'll report back once that's confirmed.
