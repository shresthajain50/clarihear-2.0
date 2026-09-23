#pragma once
// ============================================================
//  Compressor.h  —  ClariHear DSP Core
//  Wide Dynamic Range Compression (WDRC) for hearing assistance.
//
//  Design goals:
//    • Amplify quiet environmental sounds  (hearing compensation)
//    • Prevent loud transients from reaching dangerous SPL levels
//    • Fast attack / medium release — "transparent" character
//    • Per-channel (L/R) state, no shared mutable data
//
//  Reference: Kates, J.M. "Digital Hearing Aids" (2008) Ch.5
// ============================================================

#include <cmath>
#include <algorithm>

namespace clarihear {

/// Parameters exposed to the UI via JSI (all in linear or dB as noted)
struct CompressorParams {
    float thresholdDb  = -40.f;  ///< Level above which gain reduction starts (dBFS)
    float ratio        =   4.f;  ///< Compression ratio  (e.g. 4 → 4:1)
    float kneeDb       =   6.f;  ///< Soft-knee width in dB
    float attackMs     =   5.f;  ///< Gain reduction attack time in milliseconds
    float releaseMs    = 100.f;  ///< Gain recovery release time in milliseconds
    float makeupGainDb =  20.f;  ///< Make-up gain applied after compression (dB)
};

// ============================================================
//  Compressor — feed-forward RMS level detector + gain smoother
//  Phase 2 will implement process(); this stub shows the full API.
// ============================================================
class Compressor {
public:
    explicit Compressor(float sampleRate) noexcept
        : _sampleRate(sampleRate) {
        setParams(_params);
    }

    /// Apply new parameters (safe to call from any thread).
    void setParams(const CompressorParams& p) noexcept;

    /// Reset envelope state (call when audio stream starts/stops).
    void reset() noexcept { _envelope = 0.f; _gainSmoothed = 1.f; }

    /// Process one sample — real-time safe, lock-free.
    float process(float x) noexcept;

    // ── Getters for metering ─────────────────────────────────
    float currentGainDb()   const noexcept { return _currentGainDb; }
    float envelopeLinear()  const noexcept { return _envelope; }

private:
    float _sampleRate;
    CompressorParams _params;

    // Derived time-constants (recomputed in setParams)
    float _attackCoeff   = 0.f;
    float _releaseCoeff  = 0.f;
    float _makeupLinear  = 1.f;

    // Per-sample state
    float _envelope      = 0.f;
    float _gainSmoothed  = 1.f;
    float _currentGainDb = 0.f;

    /// Compute gain reduction in dB for a given input level (dBFS)
    float computeGainDb(float inputDb) const noexcept;
};

} // namespace clarihear
