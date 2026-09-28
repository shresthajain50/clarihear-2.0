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
