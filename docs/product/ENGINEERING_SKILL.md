# Clarihear Engineering Skill

## Purpose

Build Clarihear as a safety-conscious mobile hearing-assistance product.
Optimize for speech intelligibility, low latency, conservative
personalization, and reproducible audio processing.

## Non-negotiable rules

1.  Never diagnose hearing loss.
2.  Never map dB HL directly to equal dB digital gain.
3.  Never treat arbitrary headphones as calibrated audiometry hardware.
4.  Never put cloud/network/LLM processing in the live audio path.
5.  Never run DSP sample processing on the React Native/JS thread.
6.  Never allocate, lock, log, perform I/O, or call JavaScript from the
    real-time audio callback.
7.  Never expose raw compressor/EQ parameters to normal users.
8.  Always maintain a hard bypass/mute path.
9.  Always use bounded gain and output safety.
10. Treat red-flag hearing symptoms as professional-referral conditions.
11. Version every hearing/fitting/DSP profile.
12. Every DSP change requires a regression test with fixed audio
    fixtures.

## Architecture

React Native UI → native platform audio manager → C++ DSP engine →
platform output

Android: - Oboe/AAudio for low-latency I/O. - Kotlin for
lifecycle/routing. - C++ DSP.

iOS: - AVAudioEngine/AVAudioSession. - Swift/Objective-C++ bridge. - C++
DSP.

## DSP order

MVP:

Input → safety/input gate → high-pass/preprocessing → personalized
frequency shaping → gentle WDRC → conservative noise attenuation →
output gain → limiter → output

Future:

microphone array → beamforming → causal neural speech enhancement →
personalized fitting → limiter → output

## Hearing test

Primary consumer screen: - validated Digits-in-Noise workflow.

Optional: - calibrated pure-tone test.

Professional audiogram: - import and validate.

Do not create a fake clinical audiogram from a generic headphone.

## Fitting

Audiogram: → fitting algorithm → target response → bounded gain → DSP
profile.

Research/reference algorithms: - NAL-NL2 - DSL v5

A production clinical implementation requires audiology validation and
appropriate regulatory review.

## UI

Normal user controls: - Start/Stop - Volume - Clarity - Listening mode -
Bypass

Modes: - Everyday - Conversation - Quiet

Developer-only: - EQ bands - compressor - raw levels - latency - buffer
size - CPU - route - JSI status

## Testing

Every DSP component needs: - unit tests, - deterministic fixture
tests, - numerical regression tests, - clipping tests, - latency
tests, - route-change tests.

Test hearing workflows for: - quiet, - moderate noise, - headphone
mismatch, - permission denial, - disconnect/reconnect, - interrupted
audio, - app backgrounding, - device rotation, - low battery.

## Research gate

Do not add AI speech enhancement until the classical DSP baseline has
been measured.

Do not claim benefit until speech-in-noise performance has been compared
against an unaided baseline.

The product KPI is intelligibility/listening ease, not loudness.
