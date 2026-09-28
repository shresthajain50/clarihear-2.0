// ============================================================
//  ClarihearHostObject.cpp  —  JSI HostObject Implementation
//
//  This file implements every method that JavaScript can call on
//  `global.clarihear`. For synchronous methods (setEqBandGain,
//  setMasterVolume, etc.) the entire call chain is:
//
//    JS call → JSI dispatch → this lambda → AudioEngine setter
//
//  with no thread hops, no serialisation, no async queue.
//  The AudioEngine setter writes a pending-value (atomic store).
//  The audio thread reads it on the next hardware interrupt.
//
//  Execution time of a sync method: ~200–800 nanoseconds on A17/SD8.
//  Compare to legacy RN bridge async round-trip: ~16 milliseconds.
// ============================================================

#include "ClarihearHostObject.h"
#include <jsi/jsi.h>

using namespace facebook::jsi;

namespace clarihear {

// ── Convenience aliases to reduce verbosity ───────────────────
using RT   = facebook::jsi::Runtime;
using Prop = facebook::jsi::PropNameID;
using Val  = facebook::jsi::Value;

// ── Helper: create a JSI function from a C++ lambda ─────────
// This is what turns a C++ closure into a callable JS function.
// The lambda MUST be noexcept-compatible — JSI will not catch C++ exceptions.
template <typename Fn>
static Val makeFunction(RT& rt, const char* name, int argCount, Fn&& fn) {
    return Value(Function::createFromHostFunction(
        rt,
        PropNameID::forAscii(rt, name),
        argCount,
        std::forward<Fn>(fn)));
}

// ============================================================
//  ClarihearHostObject::getPropertyNames
//  Returns the list of methods exposed on global.clarihear.
//  Enables: Object.keys(global.clarihear) from JS.
// ============================================================
std::vector<PropNameID>
ClarihearHostObject::getPropertyNames(RT& rt) {
    static const char* const kMethodNames[] = {
        "startAudio",
        "stopAudio",
        "isRunning",
        "setMasterVolume",
        "setEqBandGain",
        "setCompressorParams",
        "setFeedbackSuppression",
        "setBandGains",
        "setBypass",
        "setMuted",
        "getLimiterEngagedCount",
        "getInputLevel",
        "getOutputLevel",
    };
    std::vector<PropNameID> names;
    names.reserve(sizeof(kMethodNames) / sizeof(kMethodNames[0]));
    for (const char* n : kMethodNames)
        names.push_back(PropNameID::forAscii(rt, n));
    return names;
}

// ============================================================
//  ClarihearHostObject::get
//  ─────────────────────────────────────────────────────────────
//  Called every time JS reads global.clarihear.<methodName>.
//  Returns a jsi::Function — when JS calls it, our lambda runs
//  synchronously on the JS thread.
//
//  IMPORTANT: The returned Function holds a captured reference
//  to `_engine`. This is safe because:
//    • _engine (AudioEngine) is allocated once in the platform
//      audio layer and lives until the app terminates.
//    • The JS runtime is destroyed before the audio engine.
//    • We pass _engine as a raw pointer (no shared_ptr ownership
//      in the hot path — avoids atomic refcount on every call).
// ============================================================
Val ClarihearHostObject::get(RT& rt, const Prop& name) {
    const std::string nameStr = name.utf8(rt);

    // ── startAudio() → Promise<boolean> ──────────────────────────────
    // Asynchronous — requests microphone permission, then starts Oboe/CoreAudio.
    // Returns a Promise because permission dialogs are async on both platforms.
    if (nameStr == "startAudio") {
        return makeFunction(rt, "startAudio", 0,
            [this](RT& rt, const Val& /*thisVal*/, const Val* /*args*/, size_t) -> Val {
                // Create a JS Promise using the Promise constructor
                auto promiseCtor = rt.global().getPropertyAsFunction(rt, "Promise");
                auto executor = Function::createFromHostFunction(rt,
                    PropNameID::forAscii(rt, "executor"), 2,
                    [this](RT& rt2, const Val&, const Val* args, size_t) -> Val {
                        auto resolve = args[0].getObject(rt2).asFunction(rt2);
                        auto reject  = args[1].getObject(rt2).asFunction(rt2);
                        // Call the platform-specific start function
                        bool success = _startFn ? _startFn() : false;
                        if (success) {
                            resolve.call(rt2, Val(success));
                        } else {
                            auto err = rt2.global()
                                .getPropertyAsFunction(rt2, "Error")
                                .call(rt2, String::createFromAscii(rt2,
                                      "Audio start failed — check mic permission"));
                            reject.call(rt2, err);
                        }
                        return Val::undefined();
                    });
                return promiseCtor.callAsConstructor(rt, executor);
            });
    }

    // ── stopAudio() → void ───────────────────────────────────────────
    if (nameStr == "stopAudio") {
        return makeFunction(rt, "stopAudio", 0,
            [this](RT&, const Val&, const Val*, size_t) -> Val {
                if (_stopFn) _stopFn();
                return Val::undefined();
            });
    }

    // ── isRunning() → boolean ────────────────────────────────────────
    if (nameStr == "isRunning") {
        return makeFunction(rt, "isRunning", 0,
            [this](RT&, const Val&, const Val*, size_t) -> Val {
                // AudioEngine doesn't track running state — platform layer does.
                // We return false here; platform callers override via startFn.
                // (Phase 5 UI uses startAudio promise + local state instead.)
                return Val(false);
            });
    }

    // ── setMasterVolume(linear: number) → void  ★ SYNC ───────────────
    // Called by the volume ring slider on every drag frame (~60fps).
    // The < 1µs cost makes this imperceptible even at 120fps.
    if (nameStr == "setMasterVolume") {
        return makeFunction(rt, "setMasterVolume", 1,
            [this](RT&, const Val&, const Val* args, size_t count) -> Val {
                if (count < 1 || !args[0].isNumber()) return Val::undefined();
                _engine->setMasterVolume(static_cast<float>(args[0].asNumber()));
                return Val::undefined();
            });
    }

    // ── setEqBandGain(band, gainL, gainR) → void  ★ SYNC ★ ──────────
    // THE latency-critical method — called on every EQ slider drag.
    // No async bridge. No queue. Writes directly to AudioEngine's
    // pending atomic field which the audio thread reads in <1ms.
    //
    // Usage from JS:
    //   global.clarihear.setEqBandGain(2, 25.0, 30.0)
    //   // band 2 = 1kHz, left ear +25dB, right ear +30dB
    if (nameStr == "setEqBandGain") {
        return makeFunction(rt, "setEqBandGain", 3,
            [this](RT&, const Val&, const Val* args, size_t count) -> Val {
                // Type-check first: asNumber() throws on non-numbers, and Android builds
                // with -fno-exceptions, so a bad JS call would otherwise abort the app.
                if (count < 3 || !args[0].isNumber() || !args[1].isNumber() || !args[2].isNumber())
                    return Val::undefined();
                const int   band  = static_cast<int>(args[0].asNumber());
                const float gainL = static_cast<float>(args[1].asNumber());
                const float gainR = static_cast<float>(args[2].asNumber());
                _engine->setEqBandGain(band, gainL, gainR);
                return Val::undefined();
            });
    }

    // ── setCompressorParams(params: object) → void  ★ SYNC ───────────
    // params: { thresholdDb, ratio, kneeDb, attackMs, releaseMs, makeupGainDb }
    // Called when the user adjusts the compressor settings screen.
    if (nameStr == "setCompressorParams") {
        return makeFunction(rt, "setCompressorParams", 1,
            [this](RT& rt, const Val&, const Val* args, size_t count) -> Val {
                if (count < 1 || !args[0].isObject()) return Val::undefined();
                auto obj = args[0].asObject(rt);

                CompressorParams p;
                auto getF = [&](const char* key, float def) -> float {
                    Val v = obj.getProperty(rt, key);
                    return v.isNumber() ? static_cast<float>(v.asNumber()) : def;
                };
                // Missing fields fall back to the gentle placeholder; the engine clamps all of them.
                const CompressorParams def;
                p.thresholdDb  = getF("thresholdDb",  def.thresholdDb);
                p.ratio        = getF("ratio",        def.ratio);
                p.kneeDb       = getF("kneeDb",       def.kneeDb);
                p.attackMs     = getF("attackMs",     def.attackMs);
                p.releaseMs    = getF("releaseMs",    def.releaseMs);
                p.makeupGainDb = getF("makeupGainDb", def.makeupGainDb);

                _engine->setCompressorParams(p);
                return Val::undefined();
            });
    }

    // ── setFeedbackSuppression(enabled: boolean) → void  ★ SYNC ─────
    if (nameStr == "setFeedbackSuppression") {
        return makeFunction(rt, "setFeedbackSuppression", 1,
            [this](RT&, const Val&, const Val* args, size_t count) -> Val {
                if (count < 1) return Val::undefined();
                _engine->setFeedbackSuppression(args[0].isBool() && args[0].getBool());
                return Val::undefined();
            });
    }

    // ── setBandGains(leftDb: number[6], rightDb: number[6]) → boolean ─────
    // Fitted band gains in dB GAIN from src/hearing/fitting.ts (never dB HL).
    // Trust boundary: exactly kEqBands numbers per ear, or nothing is applied.
    // The engine clamps each value and bounds the combined response (Level 2).
    if (nameStr == "setBandGains") {
        return makeFunction(rt, "setBandGains", 2,
            [this](RT& rt, const Val&, const Val* args, size_t count) -> Val {
                constexpr size_t kBands = clarihear::kEqBands;
                float gains[2][kBands] = {};
                if (count < 2) return Val(false);
                for (size_t ear = 0; ear < 2; ++ear) {
                    if (!args[ear].isObject()) return Val(false);
                    auto obj = args[ear].asObject(rt);
                    if (!obj.isArray(rt)) return Val(false);
                    auto arr = obj.asArray(rt);
                    if (arr.size(rt) != kBands) return Val(false);
                    for (size_t i = 0; i < kBands; ++i) {
                        Val v = arr.getValueAtIndex(rt, i);
                        if (!v.isNumber()) return Val(false);
                        gains[ear][i] = static_cast<float>(v.asNumber());
                    }
                }
                _engine->setBandGains(gains[0], gains[1]);
                return Val(true);
            });
    }

    // ── setBypass(on) / setMuted(on) → void ──────────────────────────
    // Plain atomics in the engine: effective on the next audio callback.
    if (nameStr == "setBypass" || nameStr == "setMuted") {
        const bool mute = nameStr == "setMuted";
        return makeFunction(rt, mute ? "setMuted" : "setBypass", 1,
            [this, mute](RT&, const Val&, const Val* args, size_t count) -> Val {
                const bool on = count >= 1 && args[0].isBool() && args[0].getBool();
                if (mute) _engine->setMuted(on);
                else      _engine->setBypass(on);
                return Val::undefined();
            });
    }

    // ── getLimiterEngagedCount() → number ────────────────────────────
    if (nameStr == "getLimiterEngagedCount") {
        return makeFunction(rt, "getLimiterEngagedCount", 0,
            [this](RT&, const Val&, const Val*, size_t) -> Val {
                return Val(static_cast<double>(_engine->limiterEngagedCount()));
            });
    }

    // ── getInputLevel() → number  ★ SYNC ─────────────────────────────
    // Returns the current input peak level in dBFS.
    // Called by the UI VU meter at ~30fps via requestAnimationFrame.
    // AudioEngine stores this in an atomic<float> — safe to read here.
    if (nameStr == "getInputLevel") {
        return makeFunction(rt, "getInputLevel", 0,
            [this](RT&, const Val&, const Val*, size_t) -> Val {
                return Val(static_cast<double>(_engine->inputLevelDb()));
            });
    }

    // ── getOutputLevel() → number  ★ SYNC ────────────────────────────
    if (nameStr == "getOutputLevel") {
        return makeFunction(rt, "getOutputLevel", 0,
            [this](RT&, const Val&, const Val*, size_t) -> Val {
                return Val(static_cast<double>(_engine->outputLevelDb()));
            });
    }

    // Unknown property — return undefined (JS-spec behaviour)
    return Val::undefined();
}

// ============================================================
//  installClarihearHostObject
//  The single entry point called from platform code at startup.
//
//  Sets global.clarihear = <ClarihearHostObject instance>
//  After this call, JS can synchronously call any method above.
// ============================================================
void installClarihearHostObject(RT&          runtime,
                                AudioEngine* engine,
                                StartFn      startFn,
                                StopFn       stopFn) {
    // Create the host object — JS runtime takes shared ownership
    auto hostObj = std::make_shared<ClarihearHostObject>(
        engine, std::move(startFn), std::move(stopFn));

    // Wrap in a jsi::Object with HostObject semantics
    Object jsObj = Object::createFromHostObject(runtime, hostObj);

    // Install as global.clarihear
    runtime.global().setProperty(
        runtime,
        PropNameID::forAscii(runtime, "clarihear"),
        std::move(jsObj));
}

} // namespace clarihear
