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

/// ===========================================================
///  BiquadFilter — single biquad section, mono processing
///  Thread-safe state update via atomic double-buffering
///  (see setCoeffs). process() is lock-free.
/// ===========================================================
class BiquadFilter {
public:
    BiquadFilter() noexcept { reset(); }

    /// Update coefficients (may be called from any thread).
    /// The next audio callback will pick up the new coefficients.
    void setCoeffs(const BiquadCoeffs& c) noexcept { _pending = c; _dirty = true; }

    /// Reset delay-line state to zero (call when stream starts/stops).
    void reset() noexcept {
        std::memset(&_state, 0, sizeof(_state));
        std::memset(&_current, 0, sizeof(_current));
        _dirty = false;
    }

    /// Process one sample — called from the real-time audio thread.
    /// Direct Form II Transposed: one multiply-accumulate per tap.
    inline float process(float x) noexcept {
        if (_dirty) { _current = _pending; _dirty = false; }
        float y = _current.b0 * x + _state.w1;
        _state.w1 = _current.b1 * x - _current.a1 * y + _state.w2;
        _state.w2 = _current.b2 * x - _current.a2 * y;
        return y;
    }

private:
    struct State { float w1 = 0.f, w2 = 0.f; } _state;
    BiquadCoeffs _current{};
    BiquadCoeffs _pending{};
    bool         _dirty  = false;
};

} // namespace clarihear
