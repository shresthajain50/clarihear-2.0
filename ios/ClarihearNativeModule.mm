// ============================================================
//  ClarihearNativeModule.mm  —  iOS React Native Bridge (Phase 3)
//  Exposes CoreAudioPlayer to React Native JS.
//  Phase 4 replaces this with a JSI host object for sync access.
// ============================================================

#import "ClarihearNativeModule.h"
#import "CoreAudioPlayer.h"
#import "../cpp/AudioEngine.h"

@implementation ClarihearNativeModule

// Register this module with the RN bridge under the name "ClarihearAudio"
RCT_EXPORT_MODULE(ClarihearAudio);

// ── Audio lifecycle ───────────────────────────────────────────

RCT_EXPORT_METHOD(start:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [[CoreAudioPlayer shared] startWithCompletion:^(BOOL success, NSError *err) {
        if (success) {
            resolve(@YES);
        } else {
            reject(@"AUDIO_START_FAILED",
                   err.localizedDescription ?: @"Unknown error",
                   err);
        }
    }];
}

RCT_EXPORT_METHOD(stop) {
    [[CoreAudioPlayer shared] stop];
}

RCT_EXPORT_METHOD(isRunning:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@([CoreAudioPlayer shared].isRunning));
}

// ── DSP parameter control ─────────────────────────────────────
// Note: these go through the async bridge (non-realtime use only).
// Phase 4's JSI host object provides synchronous access for sliders.

RCT_EXPORT_METHOD(setEqBandGain:(int)band
                  gainLeft:(float)gainL
                  gainRight:(float)gainR) {
    [[CoreAudioPlayer shared].dspEngine setEqBandGain:band
                                          gainDbLeft:gainL
                                         gainDbRight:gainR];
}

RCT_EXPORT_METHOD(setMasterVolume:(float)linear) {
    [[CoreAudioPlayer shared].dspEngine setMasterVolume:linear];
}

RCT_EXPORT_METHOD(setFeedbackSuppression:(BOOL)enabled) {
    [[CoreAudioPlayer shared].dspEngine setFeedbackSuppression:enabled];
}

RCT_EXPORT_METHOD(applyAudiogram:(NSArray<NSNumber*>*)leftGains
                  rightGains:(NSArray<NSNumber*>*)rightGains) {
    if (leftGains.count != 6 || rightGains.count != 6) return;

    float l[6], r[6];
    for (int i = 0; i < 6; ++i) {
        l[i] = leftGains[i].floatValue;
        r[i] = rightGains[i].floatValue;
    }
    [[CoreAudioPlayer shared].dspEngine applyAudiogram:l rightGains:r];
}

// ── Metering ──────────────────────────────────────────────────
RCT_EXPORT_METHOD(getLevels:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    auto *eng = [CoreAudioPlayer shared].dspEngine;
    resolve(@{
        @"inputDb":  @(eng->inputLevelDb()),
        @"outputDb": @(eng->outputLevelDb()),
    });
}

// Module runs on the main queue by default
// (Phase 4 JSI will bypass the queue entirely for sync calls)
+ (BOOL)requiresMainQueueSetup { return NO; }

@end
