# Audio architecture

```text
React Native UI (screens render app/appFlow.ts state)
  │  hearing/fitting.ts → hearing/controls.ts → DspProfile (bounded, versioned)
  ▼
native/ClarihearAudio.ts  ── the only UI→engine module. Consumer API + `developer.*`
  │  JSI (sync): global.clarihear = cpp/jsi/ClarihearHostObject   ← trust boundary
  │  async fallback: iOS ClarihearNativeModule.mm (Android has no RN module; JSI only)
  ▼
AudioEngine setters (any NON-audio thread)
  │  writer-side mutex → precompute coefficients + Level-2 bound → TripleBuffer.write
  ▼
AudioEngine::process()  (real-time audio thread only)
  ▲  iOS: ios/CoreAudioPlayer.mm (AVAudioEngine input tap, interleaves → process)
  ▲  Android: android/app/src/main/cpp/OboeAudioPlayer.cpp (Oboe onAudioReady)
```

## Threads

| Thread | May do | Never does |
|---|---|---|
| JS | call `ClarihearAudio`, which calls JSI setters | touch samples or audio-thread state |
| Setter (JS/UI/JNI caller) | lock `_writeMutex`, compute biquad coefficients, run the Level-2 bound, `TripleBuffer::write` | run `process()` |
| Audio callback | `TripleBuffer::read` (wait-free), DSP, relaxed atomic meter stores | allocate, lock, log, do I/O, throw, call JS |

- Mute, bypass and the AFC toggle are plain atomics, so they take effect on the next callback.
- `cpp/test/engine_test.cpp` interposes `operator new` and `pthread_mutex_lock`, and asserts 0 of each inside `process()`. This is proven on glibc/x86 only.

## DSP chain (per ear, 48 kHz Float32, interleaved stereo)

```text
input sanitize (non-finite → 0)
→ FeedbackSuppressor   prototype, OFF unless developer mode (PRD §24; not AFC)
→ high-pass 100 Hz     2nd-order Butterworth
→ 6 × peaking EQ       250…8k, Q 0.7, fitted gains; 10 ms coefficient glide
→ WDRC                 placeholder params clamped (ratio 1–3, makeup ≤ 6 dB)
→ volume               0..1, 10 ms ramp
→ bypass crossfade     10 ms, bit-exact raw input at mix = 1
→ mute ramp            2 ms, wins over everything
→ Level-1 limiter      stereo-linked peak limiter, −1 dBFS ceiling
```

Not yet in the chain: noise attenuation (PRD §25, not specified yet), and
directional processing and neural enhancement (Milestone 7, out of scope).

## Parameter flow

- Parameters go `setBandGains(dB gain ×6, ×6)` → clamp each band to −12…+20 → Level 2 (`boundTotalGain`).
- Level 2 scales positive gains until the **combined** EQ response plus makeup is ≤ +20 dB on a 1/12-octave grid.
- The coefficients go into `RtParams`, then the mailbox. The audio thread glides to them over 10 ms.

## Platform glue (not buildable headlessly)

- **iOS:** the `ios/CoreAudioPlayer.mm` input tap. The engine assumes 48 kHz, so a 44.1 kHz route is a known risk (see `DEVICE_VERIFICATION.md`).
- **Android:** `OboeAudioPlayer.cpp`, with the JNI bridge in `ClarihearJNI.cpp`. When adding a `.cpp` file, update `android/app/src/main/cpp/CMakeLists.txt` `DSP_SOURCES` as well as `cpp/CMakeLists.txt`.
- **Route changes and disconnect:** not handled yet (the route-change ticket).

## Tests

- **Commands:** see `CLAUDE.md`.
- **Golden fixtures:** `cpp/test/fixtures/*.wav`. They're float32 stereo, openable in any audio editor. Regenerate them only for intentional DSP changes (`CLARIHEAR_UPDATE_GOLDEN=1`), in the same commit as the change.
