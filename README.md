# Clarihear

A mobile hearing-assistance app: it screens speech-in-noise ability, turns a
screening result or an imported audiogram into a bounded, versioned listening
profile, and applies that profile to a live microphone-to-headphone signal in
real time. It is a hearing-*assistance* tool, not a diagnostic device and not
a substitute for a professional hearing evaluation.

- **Product spec:** [`docs/product/PRD.md`](docs/product/PRD.md)
- **Hard engineering/safety rules:** [`docs/product/ENGINEERING_SKILL.md`](docs/product/ENGINEERING_SKILL.md)
- **Architecture:** [`docs/AUDIO_ARCHITECTURE.md`](docs/AUDIO_ARCHITECTURE.md)
- **Safety model:** [`docs/SAFETY.md`](docs/SAFETY.md)
- **Open product questions + the conservative defaults the code uses today:**
  [`docs/product/OPEN_QUESTIONS.md`](docs/product/OPEN_QUESTIONS.md)
- **Work tracking:** the [wayfinder map](https://github.com/shresthajain50/clarihear-2.0/issues/1)
  on GitHub Issues (label `wayfinder:map`)

Read `docs/product/ENGINEERING_SKILL.md` before touching hearing, fitting, or
DSP code — its rules (never map dB HL straight to dB gain, never claim
clinical calibration for arbitrary hardware, no allocation/locks/logging/I/O
in the audio callback, always keep a hard bypass path, version every profile,
fixture-test every DSP change) are enforced in code and tests, not only by
convention. `CLAUDE.md` has the short version and the exact enforcement
points in the codebase.

## Architecture at a glance

```
React Native UI  →  Native audio manager (Kotlin / Swift+ObjC++)  →  shared C++ DSP core  →  platform audio I/O
```

- **Android:** Oboe/AAudio for low-latency I/O, Kotlin for lifecycle/routing.
- **iOS:** AVAudioSession/AVAudioEngine, Swift/Objective-C++ bridge.
- **DSP:** one C++17 core (`cpp/`) shared by both platforms — safety gate,
  high-pass, personalized frequency shaping (via the fitting module, not raw
  dB HL), gentle WDRC, output gain, peak limiter, hard bypass/mute.
- **Fitting:** `src/hearing/fitting.ts` turns an audiogram into bounded,
  versioned gain; the C++ engine independently clamps whatever it's given.

## Prerequisites

| Tool | Version used in this repo | Check |
|---|---|---|
| Node.js | 18+ (built/tested here on 26.5) | `node --version` |
| npm | 9+ | `npm --version` |
| CMake | 3.16+ | `cmake --version` |
| A C++17 compiler (gcc/clang) | any recent | `g++ --version` |
| Xcode | 15+ (iOS builds only, macOS only) | `xcodebuild -version` |
| Android Studio + NDK matching Oboe's Prefab AAR | see `android/gradle.properties` | `sdkmanager --list` |
| CocoaPods | recent (iOS builds only) | `pod --version` |
| watchman | recommended for Metro | `watchman --version` |

The C++ DSP core and its tests, and all TypeScript/React Native logic and
unit tests, build and run on plain Linux or macOS with no mobile toolchain.
Only the actual iOS/Android app binaries and on-device behavior (audio
routing, Bluetooth, headset disconnect, real latency) need Xcode/Android
Studio/a simulator or device — see "What can't be verified headlessly" below.

## Setup

```sh
git clone https://github.com/shresthajain50/clarihear-2.0.git
cd clarihear-2.0
npm install
```

iOS only, on macOS:

```sh
cd ios && pod install && cd ..
```

## Running the app

```sh
# start Metro
npm start

# in another terminal
npm run android   # requires an emulator/device and Android Studio + NDK set up
npm run ios       # requires Xcode + CocoaPods, macOS only
```

`newArchEnabled=true` and `hermesEnabled=true` are required (they're already
set in `android/gradle.properties`) — the JSI audio-parameter bridge depends
on the New Architecture.

## Tests

```sh
# C++ DSP: headless, no RN/NDK/mobile toolchain needed
cmake -S cpp -B build/cpp
cmake --build build/cpp
ctest --test-dir build/cpp --output-on-failure

# TypeScript: unit tests, types, lint
npm test
npx tsc --noEmit
npm run lint
```

Every DSP change must ship with a fixture-based regression test under
`cpp/test/` (golden WAV fixtures in `cpp/test/fixtures/`) — this is a hard
rule from `docs/product/ENGINEERING_SKILL.md`, not a suggestion.

## What can't be verified headlessly

This repo is developed partly in a headless Linux environment with no Xcode,
no Android emulator, and no real audio hardware. The C++ DSP core, its tests,
and all TypeScript logic and tests run there and are genuinely verified. The
following are **not** verified until run on real tooling/hardware, and any
commit touching them ships with a manual checklist instead of a claim of
having run it:

- Actual Xcode/Gradle builds of the iOS and Android apps
- Simulator/device behavior: real audio latency, Bluetooth routing, headset
  disconnect/reconnect, backgrounding, low-battery behavior
- The full device verification checklist: [`docs/DEVICE_VERIFICATION.md`](docs/DEVICE_VERIFICATION.md)

## Project structure

```
clarihear-2.0/
├── android/              # Kotlin + JNI, Oboe/AAudio audio I/O
├── ios/                  # Swift/ObjC++ bridge, AVAudioEngine, JSI
├── cpp/                  # Shared C++17 DSP core + headless CMake/ctest harness
│   └── test/             #   golden-fixture regression tests
├── src/
│   ├── app/               # App state machine
│   ├── screens/           # Onboarding, safety, screening, listening, settings
│   ├── hearing/            # Fitting engine, screening engine, listening controls
│   ├── storage/            # Versioned profile store
│   ├── native/             # JS↔native audio bridge types
│   ├── components/, hooks/, theme/
│   └── __tests__/
├── research/             # Fitting-rule and DIN-protocol research notes
├── docs/
│   ├── product/           # PRD, engineering skill, open questions
│   ├── agents/            # Issue tracker / triage-label / domain-doc config
│   ├── AUDIO_ARCHITECTURE.md, SAFETY.md, DEVICE_VERIFICATION.md
└── CLAUDE.md             # Short-form rules + enforcement pointers for agents
```

## Contributing / agent workflow

Work is planned as a [wayfinder map](https://github.com/shresthajain50/clarihear-2.0/issues/1)
of decision/implementation tickets on GitHub Issues (see `docs/agents/issue-tracker.md`
and `docs/agents/triage-labels.md` for the exact conventions). Product
questions that need a human call (audiologist sign-off, licensing decisions,
etc.) are logged in `docs/product/OPEN_QUESTIONS.md` together with the
conservative default the code currently ships with — check there before
assuming a behavior is final.

## Status

MVP rebuild in progress against the PRD. See the wayfinder map for what's
closed vs. open, and `docs/product/OPEN_QUESTIONS.md` for what's still
waiting on a human decision (fitting constants, DIN test recordings, secure
storage library, full device verification).
