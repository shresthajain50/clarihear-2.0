#pragma once
// ============================================================
//  BiquadFilter.h  —  ClariHear DSP Core
//  Implements a single second-order IIR (biquad) filter section
//  using the Direct Form II Transposed structure.
//
//  All audio processing runs on the real-time audio thread.
//  STRICT RULE: No heap allocation, no mutex, no system calls
//  inside process() or any method called from the audio callback.
// ============================================================

#include <cmath>
#include <cstring>

namespace clarihear {

/// Filter type tag — used by AudioEngine to configure EQ bands
enum class BiquadType {
    LowShelf,
    HighShelf,
    Peak,       ///< Parametric EQ bell filter (used for all 6 EQ bands)
    LowPass,
    HighPass,
    Notch,
};

/// Biquad coefficient set (a0 is always 1.0 after normalisation)
struct BiquadCoeffs {
    float b0, b1, b2;   ///< Feed-forward (numerator)
    float a1, a2;        ///< Feed-back (denominator), a0 normalised out
};

/// Compute biquad coefficients for a given filter type.
/// sampleRate: system sample rate in Hz (e.g. 48000)
/// freq:       centre / corner frequency in Hz
/// Q:          quality factor (bandwidth)
/// gainDb:     shelf/peak gain in dB (ignored for LP/HP/Notch)
BiquadCoeffs makeBiquadCoeffs(BiquadType type,
                               float sampleRate,
                               float freq,
                               float Q,
                               float gainDb) noexcept;

/// Magnitude response |H(e^jw)| in dB at `freq`. Pure math, any thread.
float biquadMagnitudeDb(const BiquadCoeffs& c, float sampleRate, float freq) noexcept;

/// ===========================================================
///  BiquadFilter — single biquad section, mono processing
///  NOT thread-safe: setCoeffs() and process() must be called from
///  the same thread (the audio thread). AudioEngine computes new
///  coefficients on the audio thread from its lock-free parameter
///  mailbox, so no cross-thread handoff happens here.
/// ===========================================================
class BiquadFilter {
public:
    BiquadFilter() noexcept { reset(); }

    /// Set coefficients. Filter state is kept so changes don't click.
    void setCoeffs(const BiquadCoeffs& c) noexcept { _current = c; }

    /// Reset delay-line state to zero (coefficients unchanged).
    void reset() noexcept { _state = {}; }

    /// Process one sample — called from the real-time audio thread.
    /// Direct Form II Transposed: one multiply-accumulate per tap.
    inline float process(float x) noexcept {
        float y = _current.b0 * x + _state.w1;
        _state.w1 = _current.b1 * x - _current.a1 * y + _state.w2;
        _state.w2 = _current.b2 * x - _current.a2 * y;
        return y;
    }

private:
    struct State { float w1 = 0.f, w2 = 0.f; } _state;
    BiquadCoeffs _current{1.f, 0.f, 0.f, 0.f, 0.f};  // passthrough until configured
};

} // namespace clarihear
