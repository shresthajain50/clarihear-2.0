# Device verification checklist

The dev container is headless Linux: no Xcode, Gradle, simulator, or audio
hardware. Everything below was written but **not run**. A human with a device
ticks each box and notes the device, OS, and headset. Every
`device-verification` ticket appends its section here.

Already verified headlessly (see `CLAUDE.md` Commands): DSP numerics, limiter
ceiling, Level-2 gain bound, bypass/mute behaviour, click-free ramps, and no
allocation or mutex locks in `AudioEngine::process()` (x86, `-ffast-math`).

## Engine safety chain (#6)

Build:
- [ ] iOS builds in Xcode. `ios/ClarihearNativeModule.mm` changed from
      Objective-C message syntax on a C++ pointer, which could never have
      compiled, to `dspEngine->…` calls, and `applyAudiogram` became `setBandGains`.
- [ ] Android builds with Gradle. `ClarihearJNI.cpp` now length-checks the
      gain arrays and calls `setBandGains`. No new `.cpp` was added, so
      `android/app/src/main/cpp/CMakeLists.txt` needs no change.

With wired headphones, at a quiet room level, volume starting low:
- [ ] Start listening: the mic is audible and there is no crackle or dropout for 5 minutes.
- [ ] Mute: silence within ~one buffer, no click.
- [ ] Bypass on/off: the change is audible and there is no click (10 ms crossfade).
- [ ] Drag volume 0→max quickly: no zipper noise, and output never gets louder than at max.
- [ ] Clap or tap near the mic at max gains: output is limited, with no harsh digital clipping.
- [ ] Rub the mic, or blow across it for wind rumble: the 100 Hz high-pass stops a boomy low end.
- [ ] Change the audiogram/profile while listening: the transition is smooth, with no pop.
- [ ] iOS: confirm the tap delivers 48 kHz. The engine assumes 48 kHz, and 44.1 kHz
      routes (some Bluetooth) would shift every EQ band by about 8%.
- [ ] Watch for denormal CPU spikes after long silence (the profiler should stay flat).

## Bridge: applyDspProfile / developer API (#7)

`ClarihearHostObject.cpp` compiles (`-fsyntax-only -Wall -Wextra`) against
`node_modules/react-native/ReactCommon/jsi`. Its behaviour inside Hermes,
the ObjC module, Kotlin and JNI has **not** been run.

- [ ] iOS: `global.clarihear` exists. `Object.keys(global.clarihear)` lists `setBandGains`,
      `setBypass`, `setMuted`, `getLimiterEngagedCount`, and no longer lists `applyAudiogram`.
- [ ] Android: the same, via `AudioModule.installFromContext`. Also rebuild so the JNI
      symbols `nativeSetBandGains`, `nativeSetBypass` and `nativeSetMuted` link. A
      mismatched name fails at call time with `UnsatisfiedLinkError`, not at build time.
- [ ] From the JS console: `global.clarihear.setBandGains([1,2,3], [1,2,3])` returns
      `false` and doesn't crash. `setEqBandGain('a', null, {})` does nothing and
      doesn't crash, which matters on Android because the build uses `-fno-exceptions`.
- [ ] Apply a fitted profile, then dump the engine state in developer mode: the gains
      are the fitted values, not the audiogram dB HL values.
- [ ] `setMuted(true)` while listening: silence immediately. `setBypass(true)`: raw mic
      sound at unity gain.

## Consumer Live Hearing screen + flow (#13)

Component and reducer tests run headlessly (jest with RN Testing Library). Real
rendering, TalkBack/VoiceOver and gestures have **not** been checked on a device.

- [ ] First launch shows Welcome, then the safety questions. Any "risky" answer
      leads to the referral screen, and there's no way to listening from it except
      Start over, then Yes, start over.
- [ ] Listening screen: ON, the three modes, Volume −/+, Clarity −/+, Mute and
      Natural sound are all reachable with one hand. The text is readable at the
      largest system font size.
- [ ] VoiceOver / TalkBack reads every control's label. The ON button is
      announced as a switch with its checked state.
- [ ] Release build: Settings shows **no** "Developer diagnostics" entry
      (`__DEV__` is false).
- [ ] Debug build: Settings, then Developer diagnostics, opens the old
      dashboard. EQ sliders go from −12 to +20 and makeup from 0 to 6, and AFC
      shows off.
- [ ] Clap near the mic at max clarity/volume: "Clarihear reduced amplification…"
      appears within about a second.

## Route change / interruption / headset disconnect (#17)

What ran headlessly: the engine's `SessionStatus` gate (paused → silent within one
buffer; audio returns only on `Running`), the JSI syntax check, and the UI's
reaction to a paused status (jest). **None of the iOS/Android route code has run.**
It is the highest-risk unverified code in the repo, so test it first.

Both platforms: before this change, unplugging the headset **auto-restarted audio
on the phone speaker** (mic → gain → speaker: feedback howl). Now:

- [ ] Start with **no headphones**: ON is refused, with "Connect headphones to start
      listening…". No sound comes from the speaker at any point.
- [ ] Listening on wired headphones, then **unplug**: silence immediately (nothing
      from the speaker, not even a blip), and within about 1 s the UI shows "Your
      headphones were disconnected. Listening assistance is paused." with ON off.
- [ ] Re-plug and tap ON: it resumes. The UI mute state and the engine agree (if
      Mute was on before unplugging, it's still on).
- [ ] Bluetooth headset: connect, start, then switch the BT device off. Same result as unplugging.
- [ ] iOS: incoming call while listening: pauses with the interruption copy, and
      does **not** auto-resume after the call.
- [ ] Android: another app takes audio focus or the stream errors: pauses, with no
      auto-restart (`onErrorAfterClose`).
- [ ] Rapid unplug/replug ×10 on Android: no crash or stuck state. `_running` is a
      plain bool shared across threads (see the `ponytail:` note in `OboeAudioPlayer.cpp`).
- [ ] Android: a failed start (e.g. mic denied) no longer leaks open streams; check
      that a second start works.
- [ ] Kotlin: `AudioModule.installFromContext` registers the headset monitor once.
      A USB-C DAC and a BLE headset (API 31+) count as headsets.
