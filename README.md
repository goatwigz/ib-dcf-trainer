# IB DCF Trainer

A free, no-login interview-practice drill tool for investment banking
DCF (Discounted Cash Flow) questions. Every problem uses freshly
randomized, realistic numbers — never a fixed scenario — and is solved
step-by-step in a guided table, with each entry checked as you go.

This is a training tool, not a valuation calculator: the audience is
students preparing for IB interviews.

## Status

Early build. Core calculation engine (number generation + answer
checking) is complete and tested — see `docs/formulas.md` for the full
formula reference and hand-verified worked examples. UI is next.

## Project structure

- `js/dcf-engine.js` — all finance logic: randomized problem generation,
  per-step answer checking, follow-up question logic. No UI code here.
- `js/test-engine.js` — automated tests verifying the engine against
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
