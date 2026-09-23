#pragma once
// ============================================================
//  FeedbackSuppressor.h  —  ClariHear DSP Core
//  Acoustic Feedback Cancellation (AFC) using a variable delay
//  line with phase inversion on the estimated feedback signal.
//
//  Strategy (Phase 1 stub):
//    1. Maintain a circular delay buffer (max ~50ms @ 48kHz = 2400 samples)
//    2. The delay length is configurable in real-time
//    3. The delayed signal is phase-inverted and summed with the
//       microphone input to cancel the loopback path
//    4. Phase 2 will add an adaptive LMS filter to estimate the
//       room's transfer function dynamically
//
//  STRICT RULE: No heap allocation in process().
//  Buffer is stack/pre-allocated with a fixed max size.
// ============================================================

#include <cstring>
#include <array>
#include <cstdint>

namespace clarihear {

/// Maximum delay line length: 50ms @ 48kHz
static constexpr int kMaxDelayFrames = 2400;

class FeedbackSuppressor {
public:
    explicit FeedbackSuppressor(float sampleRate) noexcept
        : _sampleRate(sampleRate) {
        reset();
        setDelayMs(5.f);  // default: ~5ms matches typical loudspeaker distance
    }

    /// Set delay length in milliseconds [0, 50].
    /// Can be called from any thread; applied on next audio callback.
    void setDelayMs(float ms) noexcept {
        int frames = static_cast<int>((ms / 1000.f) * _sampleRate);
        _delaySamples = (frames < 1) ? 1
                      : (frames > kMaxDelayFrames) ? kMaxDelayFrames
                      : frames;
    }

    /// Enable / disable suppression without resetting state.
    void setEnabled(bool enabled) noexcept { _enabled = enabled; }

    /// Reset delay line and all internal state.
    void reset() noexcept {
        _buffer.fill(0.f);
        _writeIndex = 0;
    }

    /// Process one sample.
    /// Returns the input with the estimated feedback component subtracted.
    inline float process(float x) noexcept {
        if (!_enabled) return x;

        // Write current sample into the delay line
        _buffer[_writeIndex] = x;

        // Read the delayed sample (this approximates the loudspeaker signal
        // heard by the microphone after travelling through the air gap)
        int readIndex = _writeIndex - _delaySamples;
        if (readIndex < 0) readIndex += kMaxDelayFrames;
        float feedbackEst = _buffer[readIndex];

        // Advance write pointer
        _writeIndex = (_writeIndex + 1) % kMaxDelayFrames;

        // Phase-invert the estimated feedback and subtract
        return x - feedbackEst;
    }

private:
    float _sampleRate;
    std::array<float, kMaxDelayFrames> _buffer{};
    int   _writeIndex   = 0;
    int   _delaySamples = 240;  // 5ms default
    bool  _enabled      = true;
};

} // namespace clarihear
