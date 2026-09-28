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

/// Compressor parameters.
/// DEFAULTS ARE ENGINEERING PLACEHOLDERS — gentle, uncalibrated values
/// chosen so the compressor does little harm. They are NOT a clinical
/// or prescriptive WDRC fitting (PRD §6 issue 5, §22). AudioEngine
/// clamps every field to a gentle range before use.
struct CompressorParams {
    float thresholdDb  = -40.f;  ///< Level above which gain reduction starts (dBFS)
    float ratio        =   2.f;  ///< Compression ratio  (e.g. 2 → 2:1)
    float kneeDb       =   6.f;  ///< Soft-knee width in dB
    float attackMs     =   5.f;  ///< Gain reduction attack time in milliseconds
    float releaseMs    = 100.f;  ///< Gain recovery release time in milliseconds
    float makeupGainDb =   0.f;  ///< Make-up gain (dB); counts toward limits::kMaxTotalGainDb
};

// ============================================================
//  Compressor — feed-forward envelope detector + gain smoother
// ============================================================
class Compressor {
public:
    explicit Compressor(float sampleRate) noexcept
        : _sampleRate(sampleRate) {
        setParams(_params);
    }

    /// Apply new parameters. Audio thread only (AudioEngine calls it after
    /// reading its parameter mailbox) — not safe to call concurrently with process().
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
