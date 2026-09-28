# Safety model

What Clarihear enforces in code, and what it deliberately doesn't claim.
The rules come from `docs/product/ENGINEERING_SKILL.md`, and the open numbers
from `docs/product/OPEN_QUESTIONS.md`.

## Claims we never make

- **No diagnosis.** Screening results are `classification: 'unvalidated'` and
  carry "This screening does not diagnose hearing loss." The audiogram screen
  shows no severity labels. (`hearing/din.ts`, `screens/AudiogramScreen.tsx`)
- **Not a clinical fitting.** NAL-R is a *research* reference, not NAL-NL2 or DSL v5.
  (`hearing/fitting.ts`, Q2)
- **No calibration claim.** `acousticCeilingCalibrated` is typed as `false`, and the
  profile store rejects anything else. The Listening screen always says the level
  at the ear can't be guaranteed.
- **The AFC prototype is not feedback cancellation.** It is off by default and dev-mode only.

## Three limiter levels (PRD §23)

| Level | What | Where | Verified by |
|---|---|---|---|
| 1: digital peak | stereo-linked limiter at −1 dBFS, always on (bypass too), mute excepted | `cpp/Limiter.h`, `AudioEngine::process` | engine_test: +40 dBFS noise gives peak ≤ ceiling; golden click train |
| 2: gain ceiling | fitting clamps 0…20 dB per band; controls add ≤ ±6 dB; engine clamps −12…+20 per band **and** bounds the combined EQ + makeup response to +20 dB | `fitting.ts`, `controls.ts`, `GainConstraints.h`, `boundTotalGain` | jest bounds/grid tests; engine_test sweep over frequency × level (worst 18.85 dB); jest sync test TS ↔ C++ |
| 3: acoustic SPL | **not available**: needs a calibrated transducer profile | — | UI notice |

Regulatory context (research #4): 21 CFR 800.30 limits OTC output to
111 dB SPL (117 with input-controlled compression). It doesn't limit gain. A real
Level 3 needs bundled, calibrated hardware.

## No path from dB HL to gain except fitting

- `DbHL` and `GainDb` are branded types. `tsc` fails if thresholds are assigned to gains (`@ts-expect-error` tests).
- The consumer bridge only accepts a `DspProfile`. Raw EQ lives under `developer.*` and takes `GainDb`.
- JSI `setBandGains` accepts exactly 6 numbers per ear. Every JSI argument is type-checked, because Android builds with `-fno-exceptions`.

## Always-available user safety controls

- **Mute** takes effect within one buffer (2 ms ramp) and wins over everything.
- **Natural sound** (bypass) is bit-exact passthrough, still limited.
- **Volume** can always reach 0.
- `screens/ListeningScreen.tsx` tests cover all three.

## Referral (ENGINEERING_SKILL rule 10)

- **Referral triggers:**
  - any of the 7 PRD §9 red flags (`hearing/eligibility.ts`)
  - an audiogram beyond the self-fit range: PTA4 > 55, 500–4k > 70, or any band ≥ 90 (Q5)
  - an asymmetric audiogram
- **The referral is sticky** in `app/appFlow.ts`: no event reaches setup or listening, and "start over" takes two explicit taps.
- **Sudden change** adds an urgent line (Q7).

## Robustness

- Non-finite values never reach the output: engine input, parameters and output are sanitised, and fitting and the store validate their inputs.
- Corrupt or tampered stored profiles are rejected whole (`storage/profileStore.ts`).
