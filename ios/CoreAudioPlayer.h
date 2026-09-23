#pragma once
// ============================================================
//  CoreAudioPlayer.h  —  ClariHear iOS Audio I/O
//  Wraps AVAudioEngine for mic-to-speaker real-time processing.
//
//  Design matches the existing ClariHear_iOS/AudioEngineManager.swift
//  but is written in Objective-C++ so it can directly call the
//  shared C++ AudioEngine without a Swift/ObjC bridge.
//
//  Phase 3 will implement the full AVAudioEngine graph.
//  This header defines the stable interface used by JSI bindings.
// ============================================================

#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>

namespace clarihear { class AudioEngine; }

NS_ASSUME_NONNULL_BEGIN

@interface CoreAudioPlayer : NSObject

/// Singleton — share one engine across the RN module lifetime
+ (instancetype)shared;

/// Start the audio engine (mic → DSP → speaker).
/// Requests microphone permission if not already granted.
/// Completion block is called on the main thread with success flag.
- (void)startWithCompletion:(void(^)(BOOL success, NSError * _Nullable error))completion;

/// Stop the audio engine gracefully.
- (void)stop;

/// Direct access to the shared C++ DSP engine.
/// Used by the JSI bindings (ClarihearJSI.mm) to call setEqBandGain etc.
- (clarihear::AudioEngine *)dspEngine;

// ── Observable state (KVO-compatible / used by SwiftUI if needed) ─────────
@property (nonatomic, readonly) BOOL isRunning;
@property (nonatomic, readonly) float inputLevelDb;   ///< Updated every render cycle
@property (nonatomic, readonly) float outputLevelDb;

@end

NS_ASSUME_NONNULL_END
