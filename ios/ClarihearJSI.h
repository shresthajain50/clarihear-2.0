#pragma once
// ============================================================
//  ClarihearJSI.h  —  iOS JSI Installer (Phase 4)
//  Called once from AppDelegate.mm after the RCT bridge starts.
// ============================================================

#import <Foundation/Foundation.h>
#import <React/RCTBridge.h>

NS_ASSUME_NONNULL_BEGIN

/// Installs the `global.clarihear` JSI host object into the JS runtime.
/// Call this from AppDelegate after the bridge initialises.
void ClarihearJSI_install(RCTBridge* bridge);

NS_ASSUME_NONNULL_END
