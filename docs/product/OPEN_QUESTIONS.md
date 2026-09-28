# Open Questions

Append-only. Each entry: the question, context, the conservative PRD-compliant
default the build proceeds with, and where that default lives in code. A
supervising reviewer can override a default with a follow-up commit.

---

## Q1 — DIN protocol source (trial count, SNR steps, scoring)

**Context:** PRD §12 says "~23 adaptive trials" and "the exact trial count and
scoring algorithm should follow the validated test protocol selected for
implementation. Do not invent a new clinical scoring system." No protocol has
been selected yet. Validated DIN tests (e.g. Smits et al. 2013 Dutch/English
DIN; hearWHO) differ in step size, start SNR, number of trials averaged and
pass/refer cut-offs, and their cut-offs are tied to *their* calibrated
recordings and noise.

**Default:** Engine implements the widely published structure — 1-up/1-down
adaptive staircase on triplet-correct, 2 dB steps, start SNR 0 dB, 24
triplets, SRT = mean SNR of trials 5–24 (first 4 discarded). All of these are
config values in one `DIN_PROTOCOL` constant marked `provisional`.
Pass/refer cut-off is **not** set: the engine reports SRT and a
`classification: 'unvalidated'` until a protocol + recorded stimuli with
published norms are chosen. The UI then shows the neutral "screening result"
copy plus the "this does not diagnose" disclaimer and never labels a user as
normal/impaired from an unvalidated cut-off.

**Needs:** a decision on which validated protocol + licensed digit/noise
recordings to adopt; its cut-offs replace the `unvalidated` classification.

---

## Q2 — Fitting rule parameters (NAL-NL2 / DSL v5 are proprietary)

**Context:** PRD §20 requires a fitting layer, not `gain = dB HL`, and says to
investigate NAL-NL2 and DSL v5 but not claim either clinically. NAL-NL2's
formula is distributed as a licensed DLL; DSL v5 likewise. Neither can be
reproduced here.

**Default:** A conservative *research* profile derived from the public
half-gain family (Lybarger half-gain / NAL-R-style shaping), reduced further
for first-fit acclimatization. See `src/hearing/fitting.ts` for the exact
constants: first-fit factor 0.6, per-band hard ceiling 20 dB, max inter-band
step 8 dB, no gain below 20 dB HL. Tagged `fittingVersion:
'clarihear-research-0.1.0'`. Explicitly labelled as not NAL-NL2/DSL v5 and not
a clinical prescription.

**Needs:** audiologist review of the constants; decision whether to license
NAL-NL2 for a later version.

---

## Q3 — Maximum DSP gain ceiling (Level 2 limiter)

**Context:** PRD §23 Level 2 = "maximum allowable DSP gain". No number given.

**Default:** Per-band gain (fitting + user Clarity/Loudness offsets) hard-capped
at **+20 dB** in both the TS fitting module and the C++ engine (independently —
the engine clamps whatever it is sent). User adjustment is ±6 dB total around
the fitted profile. Output peak limiter ceiling −1 dBFS. Level 3 (calibrated
SPL ceiling) is not available for any hardware yet, so the UI must always state
that acoustic output level cannot be guaranteed.

**Needs:** audiologist sign-off; per-transducer Level 3 values once bundled
hardware exists.

---

## Q4 — Tooling permissions for the 2026-09-28 build session

**Context:** That session ran under a permission policy that blocked `gh`,
`git add/commit/push`, `g++`, `cmake` and `npm`/`npx`. Issues could not be
created, and code could not be compiled, tested or committed from inside the
session.

**Default:** The wayfinder map was written to `docs/product/WAYFINDER_MAP.md`
in a form that maps one-to-one onto GitHub Issues. Code was written with tests,
but every ticket's "verified" box stays unchecked until the commands listed in
the map are actually run and their output pasted.

**Needs:** rerun with `gh`, `git`, `g++`/`cmake` and `npm` allowed (or a human
runs the listed commands), then publish the map to Issues.
