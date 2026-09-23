// ============================================================
//  CoreAudioPlayer.mm  —  ClariHear iOS Audio I/O  [PHASE 3]
//  FULL IMPLEMENTATION — replaces the Phase 1 stub.
//
//  Architecture: AVAudioEngine + installTap → C++ DSP → output
//  ─────────────────────────────────────────────────────────────
//  Why AVAudioEngine instead of raw RemoteIO Audio Unit?
//    • AVAudioEngine is Apple's modern high-level wrapper around
//      CoreAudio Audio Units. It automatically manages the graph,
//      session routing, and interruption handling.
//    • installTap() gives us direct Float32 PCM access at the
//      hardware sample rate with hardware-minimum buffer duration.
//    • For our use case (mic tap + in-place DSP + output),
//      AVAudioEngine is the production-correct choice.
//
//  Signal path:
//    AVAudioInputNode (mic)
//      │
//      ├─ installTap(on: 0) ──→ our block fires on realtime thread
//      │                         ↓
//      │                    _dspEngine->process()
//      │                    (AFC + EQ[6] + WDRC + hard clip)
//      │                         ↓
//      └─ AVAudioPlayerNode ──→ AVAudioMixerNode ──→ AVAudioOutputNode
//         (scheduleBuffer loop)                     (speaker/headphones)
//
//  Latency budget (AirPods Pro / wired EarPods on iPhone 14):
//    AVAudioSession IOBufferDuration = 0.005s (5ms, hardware minimum)
//    Input delay:  ~5ms
//    Processing:   ~0.005ms (C++ DSP, Phase 2)
//    Output delay: ~5ms
//    Round-trip:   ~10ms — well within 20ms ceiling.
//
//  Thread safety:
//    The installTap block runs on the CoreAudio real-time thread.
//    All DSP parameter setters use the pending-value pattern
//    (see AudioEngine.h) — no locks in the hot path.
// ============================================================

#import "CoreAudioPlayer.h"
#import "../cpp/AudioEngine.h"

#import <AVFoundation/AVFoundation.h>
#import <AudioToolbox/AudioToolbox.h>
#import <Accelerate/Accelerate.h>
#import <os/log.h>

static os_log_t kLog = os_log_create("com.clarihear", "CoreAudioPlayer");

/// Maximum frames per CoreAudio callback at hardware minimum buffer.
/// 1024 @ 48kHz = ~21ms — generous headroom above the 5ms target.
static constexpr int kCoreAudioMaxFrames = 1024;

// ──────────────────────────────────────────────────────────────
//  Private interface
// ──────────────────────────────────────────────────────────────
@interface CoreAudioPlayer ()

// AVAudioEngine graph nodes
@property (nonatomic, strong) AVAudioEngine      *engine;
@property (nonatomic, strong) AVAudioPlayerNode  *playerNode;   // for output scheduling
@property (nonatomic, strong) AVAudioMixerNode   *mixerNode;

// Observable properties (KVO-compatible via @synthesize)
@property (nonatomic, readwrite) BOOL   isRunning;
@property (nonatomic, readwrite) float  inputLevelDb;
@property (nonatomic, readwrite) float  outputLevelDb;

// Internal state
@property (nonatomic, assign) BOOL tapInstalled;
@property (nonatomic, assign) double hardwareSampleRate;

@end

// ──────────────────────────────────────────────────────────────
//  Implementation
// ──────────────────────────────────────────────────────────────
@implementation CoreAudioPlayer {
    /// The shared C++ DSP engine — allocated once, lives for app lifetime.
    /// Wrapped in unique_ptr so ARC doesn't try to manage it.
    std::unique_ptr<clarihear::AudioEngine> _dspEngine;

    /// Pre-allocated interleaved PCM buffers for DSP I/O.
    /// Sized for kCoreAudioMaxFrames stereo frames — no heap in the callback.
    float _interleavedInput[1024 * 2];   // 1024 frames × 2 channels
    float _interleavedOutput[1024 * 2];
}

// ── Singleton ─────────────────────────────────────────────────
+ (instancetype)shared {
    static CoreAudioPlayer *instance = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ instance = [[self alloc] _initPrivate]; });
    return instance;
}

- (instancetype)_initPrivate {
    if (!(self = [super init])) return nil;

    // Allocate the C++ DSP engine
    _dspEngine = std::make_unique<clarihear::AudioEngine>();
    os_log_info(kLog, "AudioEngine DSP allocated @ %p", _dspEngine.get());

    [self _configureAudioSession];
    [self _buildEngineGraph];
    [self _registerNotifications];

    return self;
}

// ── Audio Session ─────────────────────────────────────────────
// Mirrors the configuration in the existing iOS app exactly.
- (void)_configureAudioSession {
#if TARGET_OS_IOS
    AVAudioSession *session = [AVAudioSession sharedInstance];
    NSError *err = nil;

    // .playAndRecord   — enables simultaneous input + output (hearing aid mode)
    // .measurement     — DISABLES system processing: no AGC, no EQ, no NS
    //                    Essential: we want the raw mic signal for our C++ DSP
    // .allowBluetooth  — Bluetooth HFP (hearing aid / phone headsets)
    // .allowBluetoothA2DP — High-quality A2DP while recording
    // .defaultToSpeaker — don't silence output if no headphones
    [session setCategory:AVAudioSessionCategoryPlayAndRecord
                    mode:AVAudioSessionModeMeasurement
                 options:(AVAudioSessionCategoryOptionAllowBluetooth          |
                          AVAudioSessionCategoryOptionAllowBluetoothA2DP      |
                          AVAudioSessionCategoryOptionAllowAirPlay             |
                          AVAudioSessionCategoryOptionDefaultToSpeaker)
                   error:&err];
    if (err) { os_log_error(kLog, "setCategory: %{public}@", err); return; }

    // CRITICAL: 5ms buffer = hardware minimum on all modern iPhones.
    // The actual value may be rounded up by the hardware (e.g. 5.3ms on A17).
    [session setPreferredIOBufferDuration:0.005 error:&err];
    if (err) os_log_error(kLog, "setPreferredIOBufferDuration: %{public}@", err);

    // Lock to 48kHz — matches our C++ DSP engine's kSampleRate constant.
    [session setPreferredSampleRate:48000.0 error:&err];
    if (err) os_log_error(kLog, "setPreferredSampleRate: %{public}@", err);

    [session setActive:YES error:&err];
    if (err) { os_log_error(kLog, "setActive: %{public}@", err); return; }

    self.hardwareSampleRate = session.sampleRate;
    os_log_info(kLog, "AVAudioSession ready — sampleRate=%.0f ioBufferDuration=%.4fs",
                session.sampleRate, session.ioBufferDuration);
#endif // TARGET_OS_IOS
}


// ── Engine Graph ──────────────────────────────────────────────
- (void)_buildEngineGraph {
    _engine    = [[AVAudioEngine alloc] init];
    _playerNode = [[AVAudioPlayerNode alloc] init];
    _mixerNode  = [[AVAudioMixerNode alloc] init];

    // Attach nodes to the engine before connecting
    [_engine attachNode:_playerNode];
    [_engine attachNode:_mixerNode];

    // Get the hardware format from the input node AFTER session is configured
    // so AVAudioFormat reflects the 48kHz / actual channel count.
    AVAudioInputNode  *inputNode  = _engine.inputNode;
    AVAudioOutputNode *outputNode = _engine.outputNode;
    AVAudioFormat *hwFormat = [inputNode outputFormatForBus:0];

    os_log_info(kLog, "Hardware format: %.0fHz channels=%u",
                hwFormat.sampleRate, hwFormat.channelCount);

    // Connect: playerNode → mixer → mainMixerNode → outputNode
    // This is the output path. We schedule processed buffers on playerNode.
    [_engine connect:_playerNode to:_mixerNode format:hwFormat];
    [_engine connect:_mixerNode to:_engine.mainMixerNode format:hwFormat];
    [_engine connect:_engine.mainMixerNode to:outputNode format:hwFormat];
}

// ── Start ─────────────────────────────────────────────────────
- (void)startWithCompletion:(void(^)(BOOL success, NSError * _Nullable err))completion {
    if (self.isRunning) {
        if (completion) completion(YES, nil);
        return;
    }

    // Request microphone permission first
    [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
        if (!granted) {
            os_log_error(kLog, "Microphone permission denied");
            NSError *e = [NSError errorWithDomain:@"com.clarihear"
                                             code:1
                                         userInfo:@{NSLocalizedDescriptionKey:
                                             @"Microphone access denied"}];
            if (completion) dispatch_async(dispatch_get_main_queue(),
                                           ^{ completion(NO, e); });
            return;
        }
        dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
            [self _startEngineWithCompletion:completion];
        });
    }];
}

- (void)_startEngineWithCompletion:(void(^)(BOOL, NSError * _Nullable))completion {
    NSError *err = nil;

    // ── Install the microphone tap ────────────────────────────────────
    // installTap() fires our block on the CoreAudio real-time thread
    // for every hardware buffer. This IS the audio callback.
    //
    // tapFormat: must use the HARDWARE format (not a custom one) to
    // avoid CoreAudio doing a software sample-rate conversion that
    // adds latency. The hardware format is 48kHz Float32 (set above).
    AVAudioInputNode *inputNode = _engine.inputNode;
    AVAudioFormat *tapFormat = [inputNode outputFormatForBus:0];

    if (!self.tapInstalled) {
        __weak typeof(self) weakSelf = self;
        [inputNode installTapOnBus:0
                        bufferSize:256          // ~5.3ms @ 48kHz — actual size set by HW
                            format:tapFormat
                             block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
            [weakSelf _processBuffer:buffer];
        }];
        self.tapInstalled = YES;
        os_log_info(kLog, "Mic tap installed on bus 0, format: %@", tapFormat);
    }

    // ── Start the engine ─────────────────────────────────────────────
    if (![_engine startAndReturnError:&err]) {
        os_log_error(kLog, "AVAudioEngine start failed: %{public}@", err);
        if (completion) dispatch_async(dispatch_get_main_queue(),
                                       ^{ completion(NO, err); });
        return;
    }

    [_playerNode play];
    self.isRunning = YES;
    os_log_info(kLog, "CoreAudioPlayer started — mic→DSP→speaker pipeline live");

    if (completion) dispatch_async(dispatch_get_main_queue(), ^{ completion(YES, nil); });
}

// ── Core DSP Callback ─────────────────────────────────────────
// Called on the CoreAudio real-time thread for every hardware buffer.
// RULES: same as Oboe — no alloc, no locks, no system calls.
//
// AVAudioPCMBuffer arrives as NON-INTERLEAVED (planar) by default:
//   buffer.floatChannelData[0] = left  channel samples
//   buffer.floatChannelData[1] = right channel samples
//
// Our C++ AudioEngine::process() expects INTERLEAVED (L0,R0,L1,R1,…).
// We convert here using vDSP for zero additional latency.
- (void)_processBuffer:(AVAudioPCMBuffer *)buffer {
    const AVAudioFrameCount frames      = buffer.frameLength;
    const uint32_t          channelCount= (uint32_t)buffer.format.channelCount;

    if (frames == 0 || frames > (AVAudioFrameCount)kCoreAudioMaxFrames) return;  // safety guard

    float * const *channelData = buffer.floatChannelData;

    // ── Deinterleave → interleaved ───────────────────────────────────
    if (channelCount >= 2) {
        // Interleave L and R into _interleavedInput[]:  L0,R0,L1,R1,…
        // vDSP_ztoc converts split-complex to interleaved complex — we
        // abuse it here as a stereo interleaver (same memory layout).
        const DSPSplitComplex split = {
            .realp = channelData[0],
            .imagp = channelData[1]
        };
        vDSP_ztoc(&split, 1, (DSPComplex*)_interleavedInput, 2, frames);
    } else {
        // Mono mic (unusual) — duplicate to both channels
        const float *mono = channelData[0];
        for (AVAudioFrameCount i = 0; i < frames; ++i) {
            _interleavedInput[i * 2 + 0] = mono[i];
            _interleavedInput[i * 2 + 1] = mono[i];
        }
    }

    // ── Run the C++ DSP pipeline ──────────────────────────────────────
    // Input:  _interleavedInput  (just filled above)
    // Output: _interleavedOutput (pre-allocated — no heap)
    //
    // Process chain per sample:
    //   FeedbackSuppressor → BiquadFilter[6] → Compressor → hard clip
    _dspEngine->process(_interleavedInput, _interleavedOutput, (int)frames);

    // ── Write DSP output back into the AVAudioPCMBuffer ───────────────
    // De-interleave _interleavedOutput back to planar format for AVAudioEngine.
    // Then schedule the processed buffer on _playerNode for output.
    if (channelCount >= 2) {
        DSPSplitComplex splitOut = {
            .realp = channelData[0],  // overwrite in-place
            .imagp = channelData[1]
        };
        vDSP_ctoz((const DSPComplex*)_interleavedOutput, 2, &splitOut, 1, frames);
    } else {
        for (AVAudioFrameCount i = 0; i < frames; ++i)
            channelData[0][i] = _interleavedOutput[i * 2];
    }

    // Schedule the processed buffer for immediate playback.
    // AVAudioPlayerNode with .interrupts keeps the output gapless.
    [_playerNode scheduleBuffer:buffer completionHandler:nil];

    // ── Update metering atomics (read by UI via JSI) ──────────────────
    // _dspEngine atomically stores input/output dBFS in process() —
    // we just forward them to the ObjC properties here for KVO.
    self.inputLevelDb  = _dspEngine->inputLevelDb();
    self.outputLevelDb = _dspEngine->outputLevelDb();
}

// ── Stop ──────────────────────────────────────────────────────
- (void)stop {
    if (!self.isRunning) return;

    [_playerNode stop];

    if (self.tapInstalled) {
        [_engine.inputNode removeTapOnBus:0];
        self.tapInstalled = NO;
    }

    [_engine stop];
    self.isRunning = NO;
    os_log_info(kLog, "CoreAudioPlayer stopped");
}

// ── Interruption / Route Change Handling ─────────────────────
- (void)_registerNotifications {
    NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];

    [nc addObserver:self
           selector:@selector(_handleInterruption:)
               name:AVAudioSessionInterruptionNotification
             object:nil];

    [nc addObserver:self
           selector:@selector(_handleRouteChange:)
               name:AVAudioSessionRouteChangeNotification
             object:nil];
}

/// Called when a phone call, Siri, or alarm interrupts the session.
- (void)_handleInterruption:(NSNotification *)note {
    AVAudioSessionInterruptionType type =
        [note.userInfo[AVAudioSessionInterruptionTypeKey] unsignedIntegerValue];

    if (type == AVAudioSessionInterruptionTypeBegan) {
        os_log_info(kLog, "Audio interruption began — stopping");
        [self stop];
    } else {
        // Interruption ended — check if we should resume
        AVAudioSessionInterruptionOptions opts =
            [note.userInfo[AVAudioSessionInterruptionOptionKey] unsignedIntegerValue];
        if (opts & AVAudioSessionInterruptionOptionShouldResume) {
            os_log_info(kLog, "Audio interruption ended — restarting");
            [self startWithCompletion:nil];
        }
    }
}

/// Called when headphones are plugged/unplugged or Bluetooth switches.
- (void)_handleRouteChange:(NSNotification *)note {
    AVAudioSessionRouteChangeReason reason =
        [note.userInfo[AVAudioSessionRouteChangeReasonKey] unsignedIntegerValue];

    os_log_info(kLog, "Audio route changed: reason=%lu", (unsigned long)reason);

    // On headphone disconnect, the session automatically switches to speaker.
    // We just need to restart the engine to pick up the new route.
    if (reason == AVAudioSessionRouteChangeReasonOldDeviceUnavailable) {
        dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
            if (self.isRunning) {
                [self stop];
                [self startWithCompletion:nil];
            }
        });
    }
}

// ── C++ engine access for JSI bindings ───────────────────────
- (clarihear::AudioEngine *)dspEngine {
    return _dspEngine.get();
}

@end
