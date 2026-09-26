Pod::Spec.new do |s|
  s.name             = 'ClarihearDSP'
  s.version          = '2.0.0'
  s.summary          = 'ClariHear real-time DSP engine: EQ, WDRC Compression, Feedback Suppression'
  s.description      = <<-DESC
    Shared C++17 DSP library for the ClariHear hearing assistance app.
    Implements a 6-band biquad equalizer, wide dynamic range compressor,
    and acoustic feedback suppressor. Runs on the real-time CoreAudio
    RemoteIO thread at 48kHz Float32.
  DESC

  s.homepage         = 'https://github.com/clarihear/clarihear'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { 'ClariHear' => 'dev@clarihear.app' }
  s.platform         = :ios, '15.0'
  s.source           = { :path => '.' }
  # ── Source files ───────────────────────────────────────────────────────────
  # Shared C++ DSP core (platform-independent)
  s.source_files = [
    '../cpp/**/*.{h,cpp}',        # Shared DSP headers + implementations
    'ios/**/*.{h,m,mm,cpp}',      # iOS-specific: CoreAudio wrapper + JSI bindings
  ]

  # ── Compiler settings ──────────────────────────────────────────────────────
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD'       => 'c++17',
    'CLANG_CXX_LIBRARY'                 => 'libc++',
    'OTHER_CPLUSPLUSFLAGS'              => '-O3 -ffast-math -fno-exceptions -fno-rtti',

    # React Native JSI headers — resolved by CocoaPods via RN's podspec
    'HEADER_SEARCH_PATHS' => [
      '$(PODS_ROOT)/Headers/Public/React-jsi',
      '$(PODS_ROOT)/Headers/Public/React-callinvoker',
      '$(PODS_ROOT)/Headers/Public/React-runtimescheduler',
      '$(PODS_ROOT)/Headers/Public/ReactCommon',
    ].join(' '),

    # Enable ARC for ObjC files, but C++ code does not use ARC
    'CLANG_ENABLE_OBJC_ARC' => 'YES',
  }

  # ── Frameworks ─────────────────────────────────────────────────────────────
  s.frameworks = [
    'AVFoundation',   # AVAudioEngine, AVAudioSession
    'AudioToolbox',   # RemoteIO Audio Unit (fallback / low-level)
    'Accelerate',     # vDSP — optional: SIMD for future FFT feedback cancellation
  ]

  # ── React Native New Architecture dependency ────────────────────────────────
  # These are declared as dependencies on React Native pods installed
  # by the parent app's Podfile.
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  s.dependency 'ReactCommon/turbomodule/core'
end
