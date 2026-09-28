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

---

## Q4 — update (2026-09-28, second session)

The tooling block is resolved: `gh`, `git`, `g++`/`cmake` and `npm` all run now.
The wayfinder map is published as GitHub issue #1, with child tickets #2–#18.
`docs/product/WAYFINDER_MAP.md` was never committed and is superseded by the
issue map. Q2's reference to `src/hearing/fitting.ts` became true with the
fitting-engine ticket (#3).

---

## Q2 — addendum: the rule is NAL-R

**Context:** Q2 said "half-gain family / NAL-R-style". The implementation uses
the published NAL-R formula (Byrne & Dillon 1986):
`IG(f) = 0.05·(H500+H1k+H2k) + 0.31·H(f) + k(f)`, with k = −17, −8, +1, −1, −2
at 250/500/1k/2k/4k, and the 6 kHz value (−2) reused at 8 kHz. It is
non-proprietary. It is used as a research reference only, never as a claim of
NAL-NL2 or DSL v5.

**Default:** after NAL-R the pipeline applies the first-fit factor 0.6 (on by
default), zero gain at or below 20 dB HL, a per-band ceiling of 20 dB, and
smoothing that only lowers gain to keep neighbouring bands within 8 dB.
`FITTING_VERSION = 'clarihear-research-0.1.0'`.

**Needs:** audiologist review of the constants, and of the 8 kHz extrapolation.

---

## Q5 — Self-fit eligibility cut-offs from an audiogram

**Context:** PRD §3 limits self-fitting to mild-to-moderate losses. Severe,
profound or unilateral/asymmetric losses go to professional care. The PRD
gives no numbers.

**Default** (`REFERRAL_CRITERIA` in `src/hearing/fitting.ts`): refer instead
of fitting when either of these holds:
- **Beyond self-fit range:** either ear's 4-frequency PTA (500/1k/2k/4k) is
  above 55 dB HL, or any single threshold at 500–4k is above 70 dB HL.
- **Asymmetric:** the inter-ear difference is ≥ 20 dB at any one frequency, or
  ≥ 15 dB at two or more frequencies. This is stricter than the common
  AAO-HNS-style ≥ 15 dB-at-2-adjacent rule because it doesn't require the
  frequencies to be adjacent.

On referral the app shows the PRD §9 copy and applies no gain.

**Needs:** audiologist sign-off on both cut-offs.
