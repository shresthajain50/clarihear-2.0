#pragma once
// ============================================================
//  AudioEngine.h  —  ClariHear DSP Core
//  Top-level DSP pipeline. Owns all processing stages and
//  exposes the single entry-point called by the platform audio
//  callbacks (Oboe on Android, RemoteIO/AVAudioEngine on iOS).
//
//  Pipeline (per channel):
//    mic input
//      → FeedbackSuppressor  (AFC: remove acoustic loopback)
//      → BiquadFilter[6]     (6-band audiogram-driven EQ)
//      → Compressor          (WDRC: amplify quiet, limit loud)
//      → output buffer
//
//  Audio format: 48000 Hz, Float32, interleaved stereo (L/R)
//
//  Thread safety:
//    • process() is called ONLY from the real-time audio thread.
//    • All setXxx() methods are safe to call from ANY thread
//      (JSI thread, UI thread) because they only write to
//      atomic/pending-value fields that process() reads once
//      per call, with no locks.
// ============================================================

#include "BiquadFilter.h"
#include "Compressor.h"
#include "FeedbackSuppressor.h"

#include <array>
#include <cstdint>
#include <atomic>

namespace clarihear {

/// Number of EQ bands matching clinical audiogram frequencies:
/// 250, 500, 1000, 2000, 4000, 8000 Hz
static constexpr int kEqBands = 6;

/// Audiogram EQ band frequencies (Hz) — matches iOS AudioEngineManager
static constexpr float kEqFrequencies[kEqBands] = {250.f, 500.f, 1000.f,
                                                     2000.f, 4000.f, 8000.f};

// ============================================================
//  ChannelEngine  — per-ear (L or R) processing chain
// ============================================================
struct ChannelEngine {
    FeedbackSuppressor  afc;
    BiquadFilter        eq[kEqBands];
    Compressor          comp;
    float               masterGainLinear = 1.f;

    explicit ChannelEngine(float sr)
        : afc(sr), comp(sr) {}

    /// Update a single EQ band gain (called via JSI from UI).
    /// bandIndex: 0–5, gainDb: dB gain to apply (typically 0–40 dB)
    void setEqBandGain(int bandIndex, float gainDb, float sampleRate) noexcept {
        if (bandIndex < 0 || bandIndex >= kEqBands) return;
        BiquadCoeffs c = makeBiquadCoeffs(BiquadType::Peak,
                                           sampleRate,
                                           kEqFrequencies[bandIndex],
                                           /*Q=*/0.7f,
                                           gainDb);
        eq[bandIndex].setCoeffs(c);
    }

    /// Process a single Float32 sample through the full chain.
    inline float process(float x) noexcept {
        x = afc.process(x);
        for (int i = 0; i < kEqBands; ++i) x = eq[i].process(x);
        x = comp.process(x);
        return x * masterGainLinear;
    }
};

// ============================================================
//  AudioEngine  — stereo pipeline, platform-independent
// ============================================================
class AudioEngine {
public:
    static constexpr float kSampleRate = 48000.f;

    AudioEngine();
    ~AudioEngine() = default;

    // Prevent copy/move (singleton-style ownership)
    AudioEngine(const AudioEngine&)            = delete;
    AudioEngine& operator=(const AudioEngine&) = delete;

    // ─── JSI-callable API (any thread) ─────────────────────

    /// Set master volume [0.0 .. 1.0]
    void setMasterVolume(float linear) noexcept;

    /// Set EQ band gain for left and/or right channel.
    /// gainDb is the audiogram threshold converted to a compensation gain.
    void setEqBandGain(int band, float gainDbLeft, float gainDbRight) noexcept;

    /// Apply a full audiogram in one call (called after hearing test).
    /// leftGains / rightGains: arrays of kEqBands floats (dB compensation)
    void applyAudiogram(const float* leftGains,
                        const float* rightGains) noexcept;

    /// Configure compressor parameters for one or both channels.
    void setCompressorParams(const CompressorParams& params) noexcept;

    /// Enable / disable feedback suppression.
    void setFeedbackSuppression(bool enabled) noexcept;

    /// Set AFC delay in milliseconds.
    void setAfcDelayMs(float ms) noexcept;

    // ─── Real-time audio callback ───────────────────────────

    /// Process one buffer of interleaved stereo Float32 audio.
    /// inputData:  pointer to [numFrames * 2] Float32 samples (L0,R0,L1,R1,…)
    /// outputData: pointer to same layout — may alias inputData (in-place OK)
    /// numFrames:  number of sample frames in this callback
    ///
    /// Called from the real-time audio thread. Must complete in
    /// < (numFrames / sampleRate) seconds. No alloc, no I/O, no locks.
    void process(const float* __restrict__ inputData,
                       float* __restrict__ outputData,
                 int numFrames) noexcept;

    // ─── Metering (read from UI thread) ────────────────────

    float inputLevelDb()  const noexcept { return _inputLevelDb.load(std::memory_order_relaxed); }
    float outputLevelDb() const noexcept { return _outputLevelDb.load(std::memory_order_relaxed); }

private:
    ChannelEngine _left;
    ChannelEngine _right;

    std::atomic<float> _inputLevelDb{-96.f};
    std::atomic<float> _outputLevelDb{-96.f};

    float _masterGainLinear = 1.f;

    /// Convert dBFS to linear, with floor at -96 dBFS.
    static float dbToLinear(float db) noexcept {
        return (db <= -96.f) ? 0.f : std::pow(10.f, db / 20.f);
    }
    static float linearToDb(float lin) noexcept {
        return (lin < 1e-10f) ? -96.f : 20.f * std::log10(lin);
    }
};

} // namespace clarihear
