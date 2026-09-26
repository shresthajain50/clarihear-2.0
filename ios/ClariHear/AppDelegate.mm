// ============================================================
//  AppDelegate.mm  —  ClariHear iOS App Entry Point (Phase 4)
//  Updated to install the JSI host object after bridge init.
// ============================================================

#import "AppDelegate.h"
#import "../ClarihearJSI.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTBridge.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    self.moduleName = @"clarihear";
    self.initialProps = @{};

    return [super application:application
           didFinishLaunchingWithOptions:launchOptions];
}

// ── JSI Installation Hook ─────────────────────────────────────
// RCTAppDelegate (RN's base AppDelegate class in 0.74) calls this
// method after the bridge is created and the JS runtime is ready.
// This is the guaranteed-safe point to install JSI host objects.
- (void)bridgeDidInitialize:(RCTBridge *)bridge {
    // Install global.clarihear synchronously — the JS bundle hasn't
    // executed yet, so global.clarihear will be available for the
    // very first line of JS code that runs.
    ClarihearJSI_install(bridge);
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
    return [[RCTBundleURLProvider sharedSettings]
            jsBundleURLForBundleRoot:@"index"];
#else
    return [[NSBundle mainBundle] URLForResource:@"main"
                                   withExtension:@"jsbundle"];
#endif
}

@end
