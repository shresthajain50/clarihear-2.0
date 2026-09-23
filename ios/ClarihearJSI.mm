// ============================================================
//  ClarihearJSI.mm  —  iOS JSI Installer (Phase 4)
//
//  How JSI installation works on iOS (New Architecture):
//  ─────────────────────────────────────────────────────────────
//  1. AppDelegate.mm creates the RCTBridge.
//  2. The bridge fires a notification when the Hermes runtime
//     is fully initialised and the JS bundle has started loading.
//  3. We listen for that notification and call
//     installClarihearHostObject(runtime, engine, ...) which sets
//     global.clarihear = <ClarihearHostObject>
//  4. By the time any JS code runs after the bundle loads,
//     global.clarihear is already installed.
//
//  The key API:
//    RCTCxxBridge:             the New Architecture bridge variant
//    -[RCTCxxBridge runtime]:  returns a facebook::jsi::Runtime*
//                              (Hermes runtime, on the JS thread)
//    callInvoker:              schedules a block ON the JS thread
//                              so we safely touch the runtime
// ============================================================

#import "ClarihearJSI.h"
#import "CoreAudioPlayer.h"

#include "../../cpp/jsi/ClarihearHostObject.h"

// RCTCxxBridge is the New Architecture cxx bridge.
// It exposes `runtime` and `callInvoker` for JSI access.
#import <React/RCTCxxBridgeDelegate.h>
#import <React/RCTBridge+Private.h>
#import <ReactCommon/CallInvokerHolder.h>
#import <jsi/jsi.h>

#import <os/log.h>

static os_log_t kLog = os_log_create("com.clarihear", "JSI");

// ── Public installer ──────────────────────────────────────────
void ClarihearJSI_install(RCTBridge* bridge) {
    // Get the underlying cxx bridge (New Architecture)
    RCTCxxBridge* cxxBridge = (RCTCxxBridge*)bridge;
    if (!cxxBridge) {
        os_log_error(kLog, "ClarihearJSI: bridge is not RCTCxxBridge — cannot install");
        return;
    }

    // runtime is the live Hermes jsi::Runtime — only accessible on the JS thread.
    // We use callInvokerHolder to get onto the JS thread safely.
    if (!cxxBridge.runtime) {
        os_log_error(kLog, "ClarihearJSI: runtime is nil — bundle not yet loaded?");
        return;
    }

    // Get the raw jsi::Runtime* — this is the Hermes engine
    auto* runtime = (facebook::jsi::Runtime*)cxxBridge.runtime;

    // Get the CoreAudioPlayer's C++ DSP engine
    clarihear::AudioEngine* engine = [CoreAudioPlayer shared].dspEngine;

    // Platform start/stop functions — capture the ObjC player strongly
    __weak CoreAudioPlayer* weakPlayer = [CoreAudioPlayer shared];
    clarihear::StartFn startFn = [weakPlayer]() -> bool {
        __block bool result = false;
        dispatch_semaphore_t sem = dispatch_semaphore_create(0);
        [weakPlayer startWithCompletion:^(BOOL success, NSError* /*err*/) {
            result = success;
            dispatch_semaphore_signal(sem);
        }];
        dispatch_semaphore_wait(sem, dispatch_time(DISPATCH_TIME_NOW,
                                                    5 * NSEC_PER_SEC));
        return result;
    };

    clarihear::StopFn stopFn = [weakPlayer]() {
        [weakPlayer stop];
    };

    // Install the host object into the Hermes runtime
    clarihear::installClarihearHostObject(*runtime, engine,
                                          std::move(startFn),
                                          std::move(stopFn));

    os_log_info(kLog, "✅ global.clarihear installed into Hermes runtime");
}
