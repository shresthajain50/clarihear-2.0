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

---

## Q1 — addendum: provisional protocol is De Sousa antiphasic (2026-09-28)

**Context:** research ticket #8 (`research/protocols/din-protocol-selection.md`).
The original Q1 default (24 triplets, 2 dB steps, SRT = mean of 5–24) doesn't
match any published protocol. With the antiphasic SRTs normal listeners reach
(about −16 to −18 dB SNR), a 0 dB start with fixed 2 dB steps biases the SRT
by about 1.3 dB (see `research/protocols/din_staircase_sim.py`).

**Default** (replaces the original Q1 default): the De Sousa et al. 2020/2022
antiphasic smartphone procedure (Ear Hear 41:442, 43:1037, the hearZA /
hearWHO lineage). 23 whole-triplet-scored triplets drawn from 120, no scored
practice, start at 0 dB SNR. The first 3 steps are −4 dB after a correct
response and +2 dB after a wrong one, then ±2 dB 1-up/1-down. SRT = mean SNR
of the last 19 presented triplets (5–23), with no virtual 24th. Speech-shaped
stationary noise. The noise level is fixed below 0 dB SNR and the speech
level fixed at or above it. Stereo output must be confirmed, because antiphasic
presentation breaks on mono downmix. Classification stays `'unvalidated'`: the
published cut-offs (−15.7 / −13.7 dB) belong to the South African English
recordings and population, and don't transfer to other stimuli.

**Needs:** (a) confirm with the authors or hearX whether the virtual 24th
trial is excluded (≤ 0.2 dB effect); (b) the stimuli decision (ticket #10 /
Q6): no validated English DIN recording set has an open licence.

---

## Q6 — DIN stimuli source (ticket #10)

**Context:** No validated English DIN recordings are openly licensed. The SA
English and US English (Cincinnati) sets are commercial via hearX Group.
Watson's US set is owned by Communication Disorders Technology. The Dutch
Smits set is shared by Amsterdam UMC on request. Recording our own speaker
means redoing digit homogenisation, norms, and validation against audiograms,
per accent.

**Default:** no stimuli ship. The engine is protocol- and stimulus-agnostic
and always reports `classification: 'unvalidated'`. The app must not present
DIN results as pass/refer until a licensed or validated stimulus set and its
matching cut-offs are adopted.

**Needs:** a business decision (licence from hearX vs record and validate
in-house) and a named owner for stimulus level calibration.

---

## Q5 — addendum: 250 Hz / 8 kHz severity rule (2026-09-28, clinical-safety review)

**Context:** The review found that the severity check only looked at 500–4k.
Bilateral `[85, 20, 20, 20, 20, 20]` or `[.., 110 at 8k]` was fitted, not referred.

**Default:** refer when any threshold at **any** frequency is ≥ 90 dB HL
(`REFERRAL_CRITERIA.maxAnyThresholdDbHL`). The research recommends this, and
it sits on top of the stricter 500–4k > 70 rule. It deliberately does not
refer an 8 kHz-only 70–85 dB loss, which is typical steep presbycusis and
still gets at most +20 dB, so as not to over-refer the core user group.

**Needs:** audiologist view on whether an isolated low-frequency (250 Hz)
loss should refer at a lower level, since it is a possible conductive/Ménière's
flag.

---

## Q7 — Urgent wording for sudden hearing change

**Context:** PRD §9 gives one referral message for every red flag. Sudden
hearing loss is treated as time-critical in clinical guidance (prompt medical
assessment), but the PRD has no urgency copy.

**Default:** when `sudden_change` is flagged, the referral also shows
`URGENT_MESSAGE` ("If your hearing changed suddenly, please seek medical care
as soon as possible."), and `urgent: true` is set (`src/hearing/eligibility.ts`).
No other red flag is marked urgent.

**Needs:** clinical and regulatory review of the wording, and of whether
pain/drainage or vertigo should also be urgent.

---

## Q8 — Secure local storage backend (ticket #14)

**Context:** PRD §38 asks for "secure local storage" for hearing and DSP
profiles, which are health-adjacent data. Options are Keychain/Keystore-backed
storage (e.g. `react-native-encrypted-storage` / `react-native-keychain`),
encrypted MMKV, or SQLite with SQLCipher. Any of them adds a native module,
and that can't be verified here (no `pod install` / Gradle).

**Default:** `src/storage/profileStore.ts` depends only on a 3-method
`KeyValueStore` adapter. The conservative production choice is
**Keychain (iOS) / EncryptedSharedPreferences (Android)** via
`react-native-encrypted-storage`. It gets added and wired together with the
first device build, and never plain AsyncStorage. The profile is one small
JSON document, so no database is needed. Export is the stored JSON envelope,
and delete removes the key.

**Needs:** confirmation of the library, plus a privacy decision on whether
export should strip `id`.

---

## Q9 — Listening modes and simple controls → DSP (ticket #12)

**Context:** PRD §15–16 names Everyday / Conversation / Quiet plus Clarity,
Background, Loudness and Volume, with no numbers. PRD §21 requires small,
bounded changes only.

**Default** (`src/hearing/controls.ts`, `CONTROLS_VERSION =
'clarihear-controls-0.1.0'`). All offsets are relative to the *fitted* gains.
The sum is clamped to **±6 dB per band** (Q3), then to the Level-2 ceiling
(the engine also bounds the combined response):
- **Clarity** (−1 … +1): high-frequency tilt of ±4 dB. The weights across
  250/500/1k/2k/4k/8k are 0/0/0/0.5/1/1.
- **Background** (−1 = less … +1 = more): low-frequency gain of ±6 dB, with
  weights 1/1/0.5/0/0/0. This is a classical noise-program approach, used
  instead of a no-op control until noise reduction exists.
- **Loudness** (0 … 1): +0 … +4 dB broadband.
- **Volume** is separate: output attenuation only, 0 … 1 linear.
- **Modes** add a bias to the controls:
  - Everyday: neutral, WDRC 2:1.
  - Conversation: clarity +0.5 and background −0.5, WDRC 2:1.
  - Quiet: neutral, gentler WDRC 1.5:1.

**Needs:** audiologist/UX review of the magnitudes, and a speech-in-noise check
(M6) that Conversation actually helps.

---

## Q10 — Ambient-noise gate threshold on an uncalibrated mic (ticket #16)

**Context:** PRD §10 says the test must reject noisy rooms. Phone mics are
uncalibrated, and dBFS→SPL varies by device and OS processing, so a fixed dBFS
threshold is only a coarse proxy.

**Default** (`AMBIENT_CHECK` in `src/hearing/deviceCheck.ts`): take the median
of at least 20 input-meter readings (about 3 s); median > −45 dBFS counts as
too noisy (PRD copy); median ≤ −95 dBFS, or too few readings, counts as "no
signal". A dead mic never counts as quiet. The median means a single door slam
doesn't fail the check.

**Needs:** per-device measurement (bench, PRD §47 Stage 2) relating dBFS to
dB(A), and the DIN protocol's own ambient limit once stimuli are chosen (Q6).
