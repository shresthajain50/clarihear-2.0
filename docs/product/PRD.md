# Clarihear --- Mobile Hearing Assistance MVP

## Product Requirements Document + Technical Build Specification

**Version:** 1.0\
**Date:** September 2026\
**Status:** Build-ready MVP specification\
**Reference implementation:** `shresthajain50/clarihear-2.0`

------------------------------------------------------------------------

# 1. Executive Summary

Clarihear is a mobile hearing-assistance application for adults who
experience mild-to-moderate difficulty hearing, especially speech in
everyday environments.

The MVP is intentionally narrow:

1.  Screen hearing ability.
2.  Identify whether the user should continue, repeat the test, or seek
    professional assessment.
3.  Create a personal hearing profile from a validated screening flow or
    an imported professional audiogram.
4.  Apply a conservative, personalized listening profile.
5.  Provide real-time microphone-to-headphone assistance with low
    latency.
6.  Give the user simple controls for volume, clarity, and listening
    mode.
7.  Measure whether the experience is actually useful through
    speech-in-noise tasks and user feedback.

Clarihear is **not** the first release of a full clinical hearing-aid
platform. It should not diagnose hearing loss, claim clinical
equivalence to an audiologist, or map dB HL directly to equal dB of
digital gain.

The product principle is:

> **Measure carefully. Personalize conservatively. Process locally. Keep
> the user safe. Prove benefit with speech intelligibility.**

------------------------------------------------------------------------

# 2. Product Thesis

A generic sound-amplification app is not enough.

A useful hearing-assistance system must combine:

-   a controlled hearing assessment,
-   an individual hearing profile,
-   frequency-dependent processing,
-   dynamic-range management,
-   low-latency audio routing,
-   output safety limits,
-   and a simple user experience.

The phone is excellent for onboarding, testing, personalization,
visualization, configuration and analytics.

The real-time audio path should be native and local.

For the MVP:

``` text
Microphone
    ↓
Native low-latency audio I/O
    ↓
Safety gate
    ↓
High-pass / preprocessing
    ↓
Personalized frequency shaping
    ↓
Gentle dynamic-range compression
    ↓
Optional simple noise reduction
    ↓
Output limiter
    ↓
Headphones
```

Advanced neural speech enhancement, remote microphones, bilateral
hardware, and Auracast are later phases.

------------------------------------------------------------------------

# 3. Target User

## Primary

Adults 18+ who report difficulty hearing speech, particularly:

-   in restaurants,
-   in meetings,
-   in classrooms,
-   while watching TV,
-   on phone/video calls,
-   in family conversations,
-   or when background noise is present.

## Initial clinical/product boundary

The MVP should focus on users whose profile is compatible with a
mild-to-moderate assistance use case.

Users with red-flag symptoms or potentially severe/unilateral/rapidly
changing hearing loss should be routed toward professional care instead
of being encouraged to self-fit.

## Explicitly out of scope

-   Children.
-   Sudden hearing loss.
-   Severe/profound hearing loss as a self-fitting target.
-   Unilateral unexplained hearing loss.
-   Diagnosis of conductive vs sensorineural vs mixed loss.
-   Medical treatment.
-   Tinnitus treatment.
-   Cochlear-implant fitting.
-   Custom prescription hearing-aid fitting.

------------------------------------------------------------------------

# 4. Product Positioning

Clarihear should not say:

> "We diagnose your hearing loss."

It should say:

> "Clarihear helps you understand how you hear and creates a
> personalized listening experience."

For screening:

> "This is a hearing screening, not a medical diagnosis."

For assistance:

> "Clarihear uses your hearing profile to shape sound within safe
> limits."

For escalation:

> "Your result suggests that a professional hearing evaluation would be
> a good next step."

------------------------------------------------------------------------

# 5. Evidence-Driven Product Decisions

## 5.1 Hearing screening

Use a validated Digits-in-Noise (DIN) experience as the primary consumer
screening layer.

The user hears three spoken digits in background noise and enters the
digits they understood.

The adaptive algorithm estimates speech-in-noise ability.

This is preferable to making the first screen a long clinical-style
pure-tone test because:

-   it is fast,
-   it tests a function that matters in real life,
-   it is easier to make robust across consumer devices,
-   and WHO already uses validated DIN technology in hearWHO.

## 5.2 Pure-tone testing

Pure-tone threshold testing can be included only as an
advanced/controlled test.

It requires:

-   known output transducer,
-   device-specific calibration,
-   quiet environment,
-   controlled volume,
-   frequency-specific output levels,
-   repeatability checks.

Do not claim that arbitrary phone + arbitrary Bluetooth earbuds produce
a clinical audiogram.

For MVP, the safest choices are:

### Path A --- recommended

Use DIN screening + optional professional audiogram import.

### Path B --- later

Add a bundled calibrated headphone/earphone mode and validated pure-tone
threshold measurement.

------------------------------------------------------------------------

# 6. The Most Important Correction to the Existing Repository

The existing repository currently has an audiogram data model with six
frequencies:

-   250 Hz
-   500 Hz
-   1 kHz
-   2 kHz
-   4 kHz
-   8 kHz

and a native C++ audio pipeline with:

-   six parametric EQ bands,
-   compressor,
-   feedback-suppression hook,
-   48 kHz Float32 stereo processing,
-   JSI parameter updates.

These are useful foundations.

However, the existing implementation has several issues that must be
corrected before it is treated as a hearing-assistance product.

### Issue 1 --- "Hearing test" is not actually implemented

`AudiogramScreen.tsx` describes a simplified Hughson-Westlake screen and
mentions tone generation, but the implementation shown is primarily an
audiogram plotting/import interface. It allows the user to tap a grid
and enter thresholds.

Therefore:

> Do not treat the current audiogram screen as a validated hearing test.

### Issue 2 --- dB HL is mapped directly to EQ dB

The current `applyAudiogram()` path effectively treats:

> 40 dB HL loss at 4 kHz → +40 dB EQ at 4 kHz.

That is not a clinically appropriate hearing-aid fitting rule.

The next implementation must replace this with a prescription/fitting
layer.

### Issue 3 --- current AFC is only a prototype

The current feedback suppressor uses a fixed delay line and subtracts a
delayed sample. That is not a validated adaptive acoustic feedback
canceller.

Do not market this as clinical-grade feedback cancellation.

### Issue 4 --- hard clipping is not acoustic safety

Digital clipping at ±1.0 prevents numerical overflow/clipping, but does
not establish a safe acoustic SPL at the user's ear.

Actual acoustic safety requires a calibrated output chain.

### Issue 5 --- compressor defaults are engineering placeholders

The current threshold/ratio/attack/release/makeup values must not be
presented as a clinical prescription.

### Issue 6 --- the dashboard exposes too much low-level control

The current dashboard exposes:

-   six-band EQ,
-   compressor threshold,
-   compressor ratio,
-   attack,
-   release,
-   makeup gain,
-   AFC toggle.

That is useful for engineering experiments but inappropriate as the
default consumer UX.

The user should not have to understand compression ratios.

------------------------------------------------------------------------

# 7. MVP User Journey

``` text
Install
  ↓
Welcome
  ↓
Explain what Clarihear does
  ↓
Safety / eligibility questions
  ↓
Headphone + environment check
  ↓
Hearing screening
  ↓
Result
  ├── Good / no obvious concern → listening profile
  ├── Possible hearing difficulty → continue + recommend evaluation
  └── Red flag → professional-care screen
  ↓
Personalize listening
  ↓
Live Hearing
  ↓
Simple controls
  ↓
Optional speech-in-noise check
  ↓
Profile saved
```

------------------------------------------------------------------------

# 8. Screen-by-Screen Product Specification

## Screen 1 --- Welcome

Headline:

> Hear what matters.

Subtext:

> Clarihear creates a personalized listening experience based on how you
> hear.

Primary CTA:

> Start hearing check

Secondary:

> I already have an audiogram

Do not overwhelm the user with technical information.

------------------------------------------------------------------------

## Screen 2 --- What Clarihear Can and Cannot Do

Three cards:

### Check

"Understand your hearing profile."

### Personalize

"Create a listening profile for your needs."

### Assist

"Use real-time sound processing to make conversations easier to follow."

Footer:

> Clarihear is a screening and hearing-assistance tool. It does not
> replace a medical hearing evaluation.

------------------------------------------------------------------------

# 9. Screen 3 --- Safety / Eligibility

Ask:

1.  Are you 18 or older?
2.  Has your hearing changed suddenly or rapidly?
3.  Is one ear noticeably worse than the other?
4.  Do you have significant ear pain or drainage?
5.  Do you have severe dizziness/vertigo?
6.  Do you have persistent ringing mainly in one ear?
7.  Do you suspect significant earwax blockage?

If any high-risk answer is detected:

### Stop self-fitting flow.

Show:

> "A professional hearing evaluation is recommended before using
> personalized amplification."

Provide:

-   find audiologist / ENT,
-   save screening for later,
-   exit.

Do not attempt to compensate these cases automatically.

------------------------------------------------------------------------

# 10. Screen 4 --- Environment Check

Before hearing testing:

-   microphone permission,
-   headphone permission/routing check,
-   headphone connected,
-   stereo output verified,
-   left/right channel check,
-   quietness check,
-   volume set to comfortable level.

The app should estimate ambient noise through the microphone and warn:

> "It is a little noisy here. Move somewhere quieter for a more reliable
> result."

The test should not silently continue under poor conditions.

------------------------------------------------------------------------

# 11. Screen 5 --- Headphone Check

Ask the user to confirm:

> "You should hear the sound in your LEFT ear."

Then:

> "You should hear the sound in your RIGHT ear."

Do not continue if channel routing is wrong.

If supported hardware is bundled, identify the exact hardware model and
load its calibration profile.

For unknown headphones:

> "Your headphones are not calibrated for threshold measurement. We can
> still run a hearing screening, but this should not be treated as a
> clinical audiogram."

------------------------------------------------------------------------

# 12. Screen 6 --- Hearing Screening

Recommended MVP test:

## Digits-in-Noise

Flow:

``` text
Practice
  ↓
23-ish adaptive trials
  ↓
Response collection
  ↓
Adaptive SNR
  ↓
Score
```

The exact trial count and scoring algorithm should follow the validated
test protocol selected for implementation.

Do not invent a new clinical scoring system.

Output:

### Hearing check result

Examples:

> Your speech-in-noise score suggests that you may have some difficulty
> understanding speech in background noise.

or

> Your screening result is within the expected range.

Always include:

> "This screening does not diagnose hearing loss."

------------------------------------------------------------------------

# 13. Screen 7 --- Optional Frequency Profile

Only show this after screening or when the user explicitly chooses:

> "Create a more personalized profile."

Two paths:

### Path A --- Import audiogram

User uploads a photo/PDF or manually enters values from an audiologist
report.

### Path B --- Controlled tone test

Only available when a validated headphone/device calibration profile
exists.

Frequencies:

-   250 Hz
-   500 Hz
-   1 kHz
-   2 kHz
-   4 kHz
-   8 kHz

Potential future additions:

-   3 kHz
-   6 kHz

The output should be stored as an audiogram, not directly as gain.

------------------------------------------------------------------------

# 14. Screen 8 --- Hearing Profile

Show a clean visualization.

Example:

``` text
YOUR HEARING PROFILE

                 Left       Right
250 Hz            ●           ●
500 Hz            ●           ●
1 kHz             ●           ●
2 kHz             ●           ●
4 kHz             ●           ●
8 kHz             ●           ●

Speech clarity
████████░░

Background noise
██████░░░░
```

Avoid alarming labels.

Instead of:

> "Your ear is damaged."

use:

> "You may benefit from additional support in higher-frequency sounds."

Provide:

> "How this affects everyday listening"

Examples:

-   following conversation in noise,
-   hearing consonants,
-   understanding people at a distance.

------------------------------------------------------------------------

# 15. Screen 9 --- Personalized Listening Setup

Do not expose raw EQ.

Show:

### Clarihear is ready to personalize your sound.

Three simple controls:

#### Clarity

More ↔ Less

#### Background

Less ↔ More

#### Loudness

Comfortable ↔ Stronger

The system translates these into bounded DSP parameters.

Never let the UI directly expose unrestricted gain.

------------------------------------------------------------------------

# 16. Screen 10 --- Live Hearing

This is the primary product screen.

Large central button:

> ON

Status:

> Clarihear is helping you hear.

Controls:

### Mode

-   Everyday
-   Conversation
-   Quiet

For MVP, keep only three.

### Volume

Simple slider.

### Clarity

Simple slider.

### Mute

Instant audio bypass.

### Safety

Persistent small indicator:

> Safe listening enabled

No EQ graph.

No compressor settings.

No technical jargon.

------------------------------------------------------------------------

# 17. Live Audio Pipeline

## Android

Use:

-   Kotlin/Java for platform lifecycle and routing.
-   C++ for DSP.
-   Oboe/AAudio for low-latency native audio.

Target:

-   48 kHz where supported,
-   Float32 internal processing,
-   small audio buffers,
-   single native audio stream,
-   no allocation in audio callback,
-   no locks in audio callback.

Android's official guidance recommends Oboe for lowest possible audio
latency.

Important:

Bluetooth should not be the primary MVP live-processing transport.

Bluetooth audio paths may introduce too much latency or may not expose
the low-latency mode required by the processing chain.

For the first real-time prototype:

> wired headphones or controlled USB audio.

------------------------------------------------------------------------

# 18. iOS

Use:

-   AVAudioSession
-   AVAudioEngine
-   native C++ DSP where shared code is valuable
-   Swift/Objective-C++ platform bridge

Keep the same DSP core between Android and iOS.

Architecture:

``` text
React Native UI
      ↓
Native Audio Manager
      ↓
C++ DSP Engine
      ↓
Platform Audio I/O
```

React Native must never sit inside the sample-by-sample audio path.

------------------------------------------------------------------------

# 19. DSP Architecture

## MVP DSP

``` text
INPUT
 ↓
Input level detector
 ↓
Safety gate
 ↓
High-pass filter
 ↓
Personalized frequency shaping
 ↓
Gentle WDRC
 ↓
Basic noise attenuation
 ↓
Output gain
 ↓
Safety limiter
 ↓
OUTPUT
```

Optional:

``` text
directional processing
```

only when the platform/hardware provides enough microphone channels.

------------------------------------------------------------------------

# 20. Personalized Frequency Shaping

Do not do:

``` text
gain = audiogram_dBHL
```

Instead:

``` text
Audiogram
    ↓
Fitting algorithm
    ↓
Target insertion/output response
    ↓
Safe gain curve
    ↓
DSP parameters
```

The first research implementation should investigate NAL-NL2 and DSL v5
as reference fitting approaches.

Do not claim to implement either clinically unless the implementation is
validated and legally appropriate.

For MVP, implement a conservative research fitting profile:

-   frequency-dependent,
-   bounded,
-   smooth between bands,
-   lower initial gain for first-time users,
-   user-adjustable within narrow safe limits.

------------------------------------------------------------------------

# 21. User Adaptation

Evidence suggests self-adjustment can be useful, but uncontrolled
adjustment can produce inadequate or excessive amplification.

Therefore:

### Use a bounded adaptation loop

``` text
Starting profile
      ↓
User listens
      ↓
“How clear was speech?”
      ↓
“How comfortable was the sound?”
      ↓
Small parameter adjustment
      ↓
Repeat
```

Adjustment step:

> small, bounded changes only.

Never allow:

> +30 dB → +40 dB → +50 dB

through a simple slider.

------------------------------------------------------------------------

# 22. Compression

MVP needs gentle dynamic-range compression.

Purpose:

-   make softer speech more audible,
-   avoid simply making everything louder,
-   preserve loud-sound comfort.

Do not call the default values "clinical."

Create a configuration object:

``` ts
interface HearingProfile {
  left: FrequencyThresholds;
  right: FrequencyThresholds;
  source: 'screening' | 'audiogram_import' | 'calibrated_test';
  confidence: number;
  fittingVersion: string;
}
```

And:

``` ts
interface DspProfile {
  bandGainsLeft: number[];
  bandGainsRight: number[];
  compression: CompressionProfile;
  outputLimit: OutputLimit;
  mode: 'everyday' | 'conversation' | 'quiet';
}
```

------------------------------------------------------------------------

# 23. Safety Limiter

The existing ±1.0 digital clamp is insufficient.

Implement three levels:

### Level 1 --- digital peak limiter

Prevents digital clipping.

### Level 2 --- gain ceiling

Maximum allowable DSP gain.

### Level 3 --- calibrated acoustic ceiling

Available only for known/calibrated hardware.

For unknown consumer headphones, clearly communicate that acoustic
output cannot be guaranteed to a precise SPL.

------------------------------------------------------------------------

# 24. Feedback Management

The current fixed-delay subtraction algorithm should remain only as a
prototype experiment.

Production research should evaluate:

-   adaptive feedback cancellation,
-   probe/fit testing,
-   frequency-dependent gain limits,
-   acoustic seal detection.

A proper adaptive filter should be evaluated offline before being
enabled in user testing.

------------------------------------------------------------------------

# 25. Noise Reduction

MVP:

Use conservative, low-latency noise attenuation.

Do not start with a large neural model.

First compare:

1.  no noise reduction,
2.  classical spectral attenuation,
3.  directional processing where available.

Measure speech-in-noise performance.

Only then introduce a neural model.

------------------------------------------------------------------------

# 26. Speech Enhancement --- Phase 2

When the baseline DSP works:

``` text
Microphone array
      ↓
VAD / speech detector
      ↓
noise estimator
      ↓
causal neural enhancement
      ↓
personalized gain
```

Candidate research families:

-   RNNoise-style lightweight models,
-   causal Conv-TasNet variants,
-   lightweight spectral-mask networks,
-   causal conformer/transformer models.

Model requirements:

-   causal,
-   low memory,
-   low CPU,
-   low algorithmic delay,
-   stable under variable device performance,
-   no cloud dependency.

Do not use speech-to-text-to-speech in the live hearing path.

------------------------------------------------------------------------

# 27. Speech-in-Noise Validation

This is the most important product metric.

Measure:

### Primary

Speech recognition / speech reception in noise.

### Secondary

-   listening effort,
-   perceived clarity,
-   comfort,
-   naturalness,
-   fatigue,
-   preference.

Compare:

``` text
Unaided
   vs
Basic Clarihear DSP
   vs
Clarihear DSP + noise reduction
```

Do not claim success because the processed audio sounds louder.

------------------------------------------------------------------------

# 28. Pre/Post Listening Check

After first setup:

> "Try a 60-second conversation exercise."

Then:

> "How easy was it to understand the speaker?"

Use a simple 1--5 scale.

Store:

``` text
clarity
comfort
background_noise
effort
```

This enables longitudinal personalization without requiring a
complicated AI system.

------------------------------------------------------------------------

# 29. Profile History

Home screen should show:

``` text
YOUR HEARING
Last check: 28 Sep 2026

Speech-in-noise
███████░░░

Listening profile
Personalized ✓

Last updated
Today
```

Do not create a medical-looking dashboard.

The goal is user comprehension.

------------------------------------------------------------------------

# 30. Home Screen

Recommended structure:

``` text
Clarihear

Good afternoon.

Your listening profile
Personalized ✓

[ Start Listening ]

──────────────

Today
Listening assistance
42 min

Clarity
Good

──────────────

Your tools

Hearing Check
Profile
How Clarihear Works
Settings
```

Primary CTA should always be:

> Start Listening

------------------------------------------------------------------------

# 31. Settings

Only expose:

-   headphone/device
-   listening mode
-   volume behavior
-   hearing profile
-   repeat hearing check
-   privacy
-   data export
-   accessibility
-   help
-   professional evaluation

Developer diagnostics should be hidden behind a developer mode.

------------------------------------------------------------------------

# 32. Developer Mode

The existing repository's detailed controls are valuable here.

Developer mode may expose:

-   raw input dBFS,
-   output dBFS,
-   EQ curves,
-   compressor curve,
-   latency,
-   buffer size,
-   sample rate,
-   CPU load,
-   JSI status,
-   audio route,
-   dropped callback count,
-   clipping events.

These controls must not be exposed to ordinary users.

------------------------------------------------------------------------

# 33. Architecture

``` text
                 React Native
                     │
          ┌──────────┴──────────┐
          │                     │
       Product UI           State Layer
          │                     │
          └──────────┬──────────┘
                     │
              Native Bridge
                     │
        ┌────────────┴────────────┐
        │                         │
   Android Audio             iOS Audio
      Oboe                   AVAudioEngine
        │                         │
        └────────────┬────────────┘
                     │
                 C++ DSP
                     │
        ┌────────────┼────────────┐
        │            │            │
       EQ          WDRC         Safety
        │            │            │
        └────────────┼────────────┘
                     │
                  Output
```

------------------------------------------------------------------------

# 34. Recommended Repository Structure

``` text
clarihear-2.0/
├── android/
├── ios/
├── cpp/
│   ├── dsp/
│   │   ├── BiquadFilter.*
│   │   ├── Compressor.*
│   │   ├── Limiter.*
│   │   ├── NoiseReducer.*
│   │   ├── FeedbackCanceller.*
│   │   └── AudioEngine.*
│   ├── fitting/
│   │   ├── Audiogram.*
│   │   ├── FittingEngine.*
│   │   └── GainConstraints.*
│   └── tests/
├── src/
│   ├── screens/
│   │   ├── Welcome/
│   │   ├── Safety/
│   │   ├── DeviceCheck/
│   │   ├── HearingScreen/
│   │   ├── HearingProfile/
│   │   ├── Listening/
│   │   └── Settings/
│   ├── audio/
│   ├── hearing/
│   ├── storage/
│   ├── analytics/
│   ├── native/
│   ├── components/
│   └── theme/
├── research/
│   ├── protocols/
│   ├── calibration/
│   ├── speech-in-noise/
│   └── fitting/
├── docs/
│   ├── PRD.md
│   ├── SAFETY.md
│   ├── AUDIO_ARCHITECTURE.md
│   └── VALIDATION.md
└── tests/
```

------------------------------------------------------------------------

# 35. State Model

``` ts
type AppState =
  | 'first_launch'
  | 'safety_check'
  | 'device_check'
  | 'screening'
  | 'screening_result'
  | 'professional_referral'
  | 'profile_setup'
  | 'listening'
  | 'settings';
```

Persistent data:

``` ts
interface UserProfile {
  id: string;
  createdAt: string;
  ageConfirmed: boolean;
  hearingProfile?: HearingProfile;
  dspProfile?: DspProfile;
  lastScreening?: ScreeningResult;
  preferences: UserPreferences;
}
```

------------------------------------------------------------------------

# 36. Hearing Test Engine

## DIN

Create a test-engine abstraction:

``` ts
interface HearingScreeningEngine {
  start(config: ScreeningConfig): Promise<void>;
  submitResponse(response: string): void;
  getProgress(): ScreeningProgress;
  finish(): ScreeningResult;
  cancel(): void;
}
```

Do not put test logic in React components.

React renders the state.

The hearing-test engine owns:

-   trial sequence,
-   randomization,
-   adaptive SNR,
-   scoring,
-   reliability,
-   completion.

------------------------------------------------------------------------

# 37. Pure-Tone Engine --- Future Controlled Mode

``` ts
interface ToneTestEngine {
  configure(transducer: CalibratedTransducer): void;
  startEar(ear: 'left' | 'right'): void;
  presentTone(freqHz: number, level: number): void;
  recordResponse(): void;
  calculateThreshold(): number;
}
```

Calibration object:

``` ts
interface TransducerCalibration {
  deviceModel: string;
  firmwareVersion?: string;
  frequencies: number[];
  referenceLevels: number[];
  calibrationVersion: string;
  validUntil?: string;
}
```

Never use arbitrary headphones as if they were calibrated transducers.

------------------------------------------------------------------------

# 38. Storage

MVP can be local-first.

Use secure local storage for:

-   hearing profile,
-   screening history,
-   DSP profile,
-   device configuration,
-   user preferences.

Cloud is optional.

No audio recordings should be uploaded by default.

------------------------------------------------------------------------

# 39. Privacy Principle

Default:

> **Audio stays on the device.**

The live microphone stream must not be uploaded to a server for basic
hearing assistance.

If future cloud features exist, they must be opt-in and clearly
separated from live hearing assistance.

Potential analytics:

-   test completion,
-   mode selected,
-   anonymous performance metrics,
-   crash diagnostics.

Avoid collecting raw conversations.

------------------------------------------------------------------------

# 40. Backend

MVP does not require a backend for core hearing assistance.

Optional backend later:

``` text
FastAPI
├── authentication
├── profile sync
├── device management
├── firmware metadata
├── research consent
├── clinical referral
└── analytics
```

Do not put live audio through FastAPI.

------------------------------------------------------------------------

# 41. Hardware Compatibility Strategy

### MVP

Preferred:

-   wired headphones,
-   known USB audio devices,
-   controlled transducers.

### Supported later

-   selected Bluetooth headsets,
-   LE Audio devices,
-   Clarihear dedicated hearing hardware.

### Long-term

Clarihear bilateral ear-level hardware.

The app should detect audio route and display:

``` text
Clarihear Device
✓ Optimized

Known wired headset
✓ Listening supported
⚠ Not calibrated for threshold testing

Unknown Bluetooth device
⚠ Live assistance may have higher latency
```

------------------------------------------------------------------------

# 42. Why Mobile App, Not Web App?

A web app is suitable for:

-   education,
-   screening experiments,
-   profile viewing,
-   appointment/referral,
-   research dashboards.

A native mobile app is required for the main product because live
hearing assistance needs:

-   predictable audio routing,
-   native audio sessions,
-   low latency,
-   foreground audio handling,
-   hardware route control,
-   native DSP,
-   platform-specific permissions.

Therefore:

> **Clarihear mobile app = product.**
>
> **Clarihear web = companion/research portal.**

------------------------------------------------------------------------

# 43. Technology Stack

## Mobile

React Native 0.74.x initially, with a controlled upgrade path later.

TypeScript.

## Android

Kotlin + C++ + Oboe/AAudio.

## iOS

Swift/Objective-C++ + C++ DSP + AVAudioEngine.

## DSP

C++17 or later supported by target toolchains.

## ML later

ONNX Runtime Mobile, TFLite, ExecuTorch, or platform-native inference
depending on model benchmarking.

## Backend

FastAPI.

## Storage

SQLite/secure key-value storage locally.

------------------------------------------------------------------------

# 44. Open-Source Research References

## openMHA

Use openMHA as a research reference and offline algorithm-validation
environment.

It is specifically designed for real-time hearing-aid signal-processing
research and supports configurable processing plugins and low-delay
real-time operation.

Do not copy GPL/AGPL code blindly into a commercial product.

Review licensing before incorporating any code.

Recommended use:

``` text
Research algorithm
      ↓
openMHA validation
      ↓
objective tests
      ↓
C++ production implementation
```

rather than making openMHA the mobile runtime.

------------------------------------------------------------------------

# 45. MVP Features

## Must Have

-   onboarding
-   safety screen
-   headphone/device check
-   ambient-noise check
-   DIN hearing screening
-   screening result
-   professional audiogram import
-   hearing profile
-   conservative personalized listening profile
-   live microphone-to-headphone mode
-   volume
-   clarity control
-   three listening modes
-   safety limiter
-   mute/bypass
-   local profile persistence
-   developer diagnostics
-   error recovery
-   accessibility
-   privacy controls

## Should Have

-   screening history
-   speech-in-noise recheck
-   user feedback loop
-   left/right profile support
-   calibration profiles for bundled hardware

## Not MVP

-   large neural speech model
-   remote microphone
-   Auracast
-   cloud audio
-   automatic diagnosis
-   tele-audiology
-   custom earbud hardware
-   full medical-grade audiometry
-   advanced clinical fitting
-   tinnitus therapy

------------------------------------------------------------------------

# 46. MVP Acceptance Criteria

## Hearing screening

-   Test completes without crashes.
-   Test can be repeated.
-   Test rejects obviously noisy environments.
-   Headphone channel check works.
-   Results are deterministic for the same stored response sequence.
-   Screening disclaimer is shown.
-   Red-flag routing works.

## Audio

-   Start/stop works reliably.
-   Mute is immediate.
-   Audio processing does not run on the JS thread.
-   No memory allocation in the real-time callback.
-   No locks in the real-time callback.
-   No audible clicks when parameters change.
-   Output limiter prevents digital clipping.
-   Audio route changes are handled safely.
-   App can recover from headset disconnect.

## Personalization

-   No raw dB HL → dB gain mapping.
-   Gain is generated through a dedicated fitting module.
-   Maximum gain is bounded.
-   Left/right values are independent.
-   Profile is versioned.

## UX

-   User can start live assistance within a few taps after setup.
-   User never needs to understand EQ or compression.
-   User can always bypass processing.
-   User can always reduce volume.
-   Accessibility text is readable.
-   Critical warnings cannot be dismissed accidentally.

------------------------------------------------------------------------

# 47. Validation Plan

## Stage 1 --- Engineering

Use synthetic signals:

-   sine waves,
-   speech,
-   white noise,
-   speech-shaped noise,
-   impulse signals.

Measure:

-   latency,
-   frequency response,
-   gain,
-   compression curve,
-   clipping,
-   stability,
-   CPU,
-   battery.

## Stage 2 --- Bench

Use:

-   calibrated headphones/transducers,
-   couplers,
-   sound-level measurement,
-   repeatability testing.

## Stage 3 --- Hearing-science pilot

With audiologist/research partner.

Compare:

``` text
Unaided
Basic Clarihear
Clarihear personalized
```

Metrics:

-   speech-in-noise,
-   clarity,
-   comfort,
-   listening effort.

## Stage 4 --- Controlled user study

Recruit adults with appropriate mild-to-moderate hearing difficulty.

Do not use the app as an unsupervised medical treatment during the
research phase.

------------------------------------------------------------------------

# 48. North-Star Metric

The product should optimize for:

> **Improvement in speech intelligibility and perceived listening ease,
> not raw loudness.**

Suggested primary product KPI:

``` text
Δ Speech-in-Noise Performance
```

Secondary:

``` text
Δ Listening Effort
Δ Clarity
Δ Comfort
Daily successful listening sessions
7-day retention
```

------------------------------------------------------------------------

# 49. Engineering Milestones

## Milestone 1

Refactor current repository.

Deliver:

-   clean architecture,
-   persistent state,
-   native audio abstraction,
-   developer diagnostics,
-   test harness.

## Milestone 2

Build real DIN screening.

Deliver:

-   audio test engine,
-   adaptive scoring,
-   noise validation,
-   result screen.

## Milestone 3

Build safe fitting engine.

Deliver:

-   audiogram model,
-   fitting abstraction,
-   bounded gain,
-   profile versioning.

## Milestone 4

Build simplified live listening.

Deliver:

``` text
mic
 ↓
EQ
 ↓
WDRC
 ↓
limiter
 ↓
headphones
```

## Milestone 5

User feedback loop.

Deliver:

-   clarity,
-   comfort,
-   background,
-   adaptive profile.

## Milestone 6

Validation.

Deliver:

-   automated DSP tests,
-   audio measurements,
-   speech-in-noise experiments,
-   clinician review.

## Milestone 7

Advanced processing.

Only after baseline benefit is demonstrated:

-   directional processing,
-   neural enhancement,
-   remote microphone.

------------------------------------------------------------------------

# 50. Code Quality Rules

The real-time audio callback must obey:

``` text
NO allocation
NO locks
NO logging
NO network
NO filesystem
NO JS calls
NO UI operations
NO exceptions
```

All UI-to-DSP changes should use:

``` text
UI
 ↓
Native parameter API
 ↓
atomic/pending state
 ↓
audio thread
```

The UI must never directly mutate audio-thread state.

------------------------------------------------------------------------

# 51. Testing Strategy

## Unit tests

-   audiogram parsing
-   fitting calculation
-   gain bounds
-   interpolation
-   compression
-   limiter
-   profile serialization
-   screening scoring

## DSP golden tests

For fixed input WAV files:

``` text
input.wav
   ↓
DSP version X
   ↓
output.wav
```

Compare against expected numerical output.

## Device tests

Matrix:

-   Android low-end
-   Android mid-range
-   Android flagship
-   iPhone older generation
-   iPhone current generation
-   wired headset
-   known calibrated transducer
-   supported Bluetooth device

------------------------------------------------------------------------

# 52. Failure Handling

If audio cannot start:

> "Clarihear couldn't start live listening. Check your headphones and
> try again."

If route changes:

> "Your headphones were disconnected. Listening assistance is paused."

If excessive output is detected:

> "Clarihear reduced amplification to keep listening comfortable."

If calibration is missing:

> "This device can support listening assistance, but it isn't calibrated
> for a hearing-threshold test."

Never silently continue in an unsafe state.

------------------------------------------------------------------------

# 53. Product Design Principles

1.  Calm, premium, non-medical appearance.
2.  Large typography.
3.  High contrast.
4.  Minimal controls.
5.  No scary medical terminology.
6.  No complicated graphs on the main listening screen.
7.  Always show whether assistance is ON.
8.  Always provide immediate bypass.
9.  Never hide important safety information.
10. Make the user feel assisted, not diagnosed.

------------------------------------------------------------------------

# 54. Final MVP Information Architecture

``` text
CLARIHEAR
│
├── Home
│   ├── Start Listening
│   ├── Hearing Profile
│   └── Last Check
│
├── Hearing Check
│   ├── Safety
│   ├── Environment
│   ├── Headphones
│   ├── DIN Screening
│   ├── Result
│   └── Optional Audiogram
│
├── Listening
│   ├── Everyday
│   ├── Conversation
│   ├── Quiet
│   ├── Volume
│   ├── Clarity
│   └── Bypass
│
├── Profile
│   ├── Hearing Profile
│   ├── Listening Profile
│   └── History
│
└── Settings
    ├── Device
    ├── Privacy
    ├── Accessibility
    ├── Repeat Check
    └── Help
```

------------------------------------------------------------------------

# 55. Final Product Definition

The first version of Clarihear should be:

> **A native mobile hearing-assistance application that screens
> speech-in-noise ability, optionally accepts a professional audiogram,
> creates a bounded personalized listening profile, and provides
> low-latency local microphone-to-headphone assistance.**

The MVP should **not** attempt to solve every problem in hearing
technology.

The product should prove one thing:

> **Can Clarihear make everyday speech easier to understand without
> simply making everything louder?**

If the answer is demonstrated through controlled testing, the next
product layer becomes compelling:

``` text
Clarihear App
      ↓
Personal Hearing Profile
      ↓
Dedicated Ear Hardware
      ↓
Directional Microphones
      ↓
Neural Speech Enhancement
      ↓
Remote Speaker Microphone
      ↓
LE Audio / Auracast
      ↓
Personal Hearing OS
```

That is the long-term platform.

------------------------------------------------------------------------

# 56. Definition of Done for the First Public Prototype

A build is ready for controlled external testing when:

-   a new user can install Clarihear,
-   complete safety screening,
-   complete a validated DIN screening,
-   understand their result,
-   import or create an eligible hearing profile,
-   receive a bounded personalized DSP profile,
-   start live assistance,
-   hear the microphone input through headphones with acceptable
    latency,
-   change volume and clarity without touching technical controls,
-   bypass processing instantly,
-   survive headset disconnect/reconnect,
-   persist their profile,
-   receive safe escalation messaging,
-   and complete a short speech-in-noise comparison demonstrating
    whether Clarihear actually helps.

That is the smallest version that can be meaningfully called a
hearing-assistance product rather than an audio-effects demo.
