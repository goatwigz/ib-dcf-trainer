# IB DCF Trainer

A free, no-login interview-practice drill tool for investment banking
DCF (Discounted Cash Flow) questions. Every problem uses freshly
randomized, realistic numbers — never a fixed scenario — and is solved
step-by-step in a guided table, with each entry checked as you go.

This is a training tool, not a valuation calculator: the audience is
students preparing for IB interviews.

## Status

Early build. Core calculation engine (number generation + answer
checking) is complete and tested for all five sub-types — see
`docs/formulas.md` for the full formula reference and hand-verified
worked examples. UI is next.

## Sub-types covered

- DCF table (Gordon Growth and Exit Multiple terminal value)
- WACC build-up (CAPM, after-tax cost of debt, capital weighting)
- Beta un-lever/re-lever (Hamada equation)
- Unlevered FCF build (EBITDA → EBIT → NOPAT → FCF)

## Project structure

- `js/dcf-engine.js` — DCF table logic: randomized problem generation,
  per-step checking, terminal value, equity bridge, and the follow-up
  question bank (rate sensitivity, terminal assumption sensitivity, TV
  cross-check, mid-year convention, sensitivity comparison).
- `js/wacc-engine.js` — WACC build-up logic.
- `js/beta-engine.js` — beta un-lever/re-lever logic.
- `js/fcf-engine.js` — unlevered FCF build logic.
- `js/test-engine.js` — automated tests verifying every engine against
  hand-worked examples (`node js/test-engine.js`).
- `docs/formulas.md` — plain-English formula reference and worked
  examples, for verifying the finance methodology without reading code.

## Running the tests

```
node js/test-engine.js
```

## Disclaimer

This is an independent educational practice tool. It is not affiliated
with any bank or existing interview-prep platform, and does not
guarantee interview outcomes.
