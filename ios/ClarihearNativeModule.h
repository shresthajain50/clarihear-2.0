#pragma once
// ============================================================
//  ClarihearNativeModule.h  —  iOS React Native Bridge (Phase 3)
//  Standard RCTBridgeModule wrapper around CoreAudioPlayer.
//  Phase 4 will replace this with a JSI HostObject for
//  synchronous access — this module handles non-realtime calls
//  (start, stop, applyAudiogram) that don't need <1µs latency.
// ============================================================

#import <React/RCTBridgeModule.h>

@interface ClarihearNativeModule : NSObject <RCTBridgeModule>
@end
