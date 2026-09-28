# Clarihear

React Native 0.74 hearing-assistance app with a shared C++ DSP core
(Android: Oboe, iOS: AVAudioEngine). The spec is `docs/product/PRD.md`, and
the hard rules are in `docs/product/ENGINEERING_SKILL.md`. Read both before
changing hearing, fitting, or DSP code.

## Hard invariants (enforced in code and tests, not only by convention)

- Never diagnose hearing loss. Screening copy always says it does not diagnose.
- Never map dB HL straight to dB gain. The only way from an audiogram to gain
  is the fitting module (`src/hearing/fitting.ts`), and the engine clamps
  whatever it receives (`cpp/GainConstraints.h`).
- Never treat arbitrary headphones as calibrated. Level 3 (acoustic SPL) safety
  is unavailable until a calibrated transducer profile exists.
- The audio callback (`AudioEngine::process`) never allocates, locks, logs,
  does I/O, throws, or calls JS. UI→DSP changes go through the engine's
  lock-free parameter mailbox.
- A hard bypass/mute path always exists and wins over everything else.
- Every hearing/fitting/DSP profile carries a version string.
- Every DSP change needs a fixture-based regression test in `cpp/test/`.

## Commands

```sh
# C++ DSP tests (headless, run in any Linux/macOS shell)
cmake -S cpp -B build/cpp && cmake --build build/cpp && ctest --test-dir build/cpp --output-on-failure

# TypeScript tests / types
npm test
npx tsc --noEmit
```

These cannot run in the headless dev container: Xcode/Gradle builds, simulators,
and on-device audio (latency, route changes, Bluetooth). Any change touching
them must ship with a manual verification checklist and must not claim to have
run on a device.

## Planning

Work is tracked in the wayfinder map on GitHub Issues (label `wayfinder:map`).
Unresolved product questions go to `docs/product/OPEN_QUESTIONS.md`
(append-only) along with the conservative default the code currently uses.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `shresthajain50/clarihear-2.0` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/`, created lazily. See `docs/agents/domain.md`.
