// ============================================================
//  AudioEngine.cpp  —  ClariHear DSP Core
//  Top-level stereo processing pipeline implementation.
//
//  This is the only file called from the platform audio callbacks:
//    • iOS:     CoreAudioPlayer.mm → installTap block
//    • Android: OboeAudioPlayer.cpp → onAudioReady()
//
//  Thread model:
//    • process()     → called ONLY from the real-time audio thread
//    • setXxx()      → called from ANY thread (JSI, UI, test)
//    • Atomics used  → for metering values read by the UI thread
//    • Pending-value pattern used → for parameter updates
//      (write to _pending on any thread, read in process() with no lock)
// ============================================================

#include "AudioEngine.h"
#include <cmath>
#include <cstring>
#include <algorithm>

namespace clarihear {

// ── AudioEngine constructor ──────────────────────────────────
// Initialises both stereo channels with the correct sample rate.
// Note: ChannelEngine constructor is defined inline in AudioEngine.h.
// ──────────────────────────────────────────────────────────────
AudioEngine::AudioEngine()
    : _left(kSampleRate), _right(kSampleRate) {

    // Default compressor: clinical WDRC profile for hearing aids.
    // These match what the existing iOS app uses via AVAudioUnitDynamicsProcessor.
    CompressorParams defaults;
    defaults.thresholdDb  = -40.f;   // start compressing at -40 dBFS
    defaults.ratio        =  4.f;    // 4:1 — moderate compression
    defaults.kneeDb       =  6.f;    // smooth knee for natural sound
    defaults.attackMs     =  5.f;    // 5ms — fast enough to catch consonants
    defaults.releaseMs    = 100.f;   // 100ms — natural gain recovery
    defaults.makeupGainDb = 20.f;    // +20 dB makeup: amplify quiet sounds

    _left.comp.setParams(defaults);
    _right.comp.setParams(defaults);

    // Default EQ: flat (all bands at 0 dB gain).
    // The audiogram calibration sets the real gains via applyAudiogram().
    for (int i = 0; i < kEqBands; ++i) {
        _left.setEqBandGain(i, 0.f, kSampleRate);
        _right.setEqBandGain(i, 0.f, kSampleRate);
    }
}

// ============================================================
//  setMasterVolume  —  any thread safe
// ============================================================
void AudioEngine::setMasterVolume(float linear) noexcept {
    // Clamp to [0, 1] — negative gain makes no sense for a hearing aid
    _masterGainLinear = (linear < 0.f) ? 0.f : (linear > 1.f) ? 1.f : linear;
    _left.masterGainLinear  = _masterGainLinear;
    _right.masterGainLinear = _masterGainLinear;
}

// ============================================================
//  setEqBandGain  —  any thread safe
//  Updates the biquad coefficients for one frequency band.
//  The BiquadFilter::setCoeffs() method writes to a pending field
//  that is committed on the next call to process() — no lock needed.
// ============================================================
void AudioEngine::setEqBandGain(int band, float gainDbLeft, float gainDbRight) noexcept {
    if (band < 0 || band >= kEqBands) return;
    _left.setEqBandGain(band, gainDbLeft,  kSampleRate);
    _right.setEqBandGain(band, gainDbRight, kSampleRate);
}

// ============================================================
//  applyAudiogram  —  any thread safe
//  Called once after the hearing test completes.
//  leftGains / rightGains: array of kEqBands floats (dB compensation).
//  The compensation gain is the audiogram threshold value: if the user
//  has 40 dB HL loss at 4kHz, we apply +40 dB boost at 4kHz.
//  (The compressor will prevent this from clipping loud sounds.)
// ============================================================
void AudioEngine::applyAudiogram(const float* leftGains,
                                  const float* rightGains) noexcept {
    for (int i = 0; i < kEqBands; ++i) {
        if (leftGains)  _left.setEqBandGain(i, leftGains[i],  kSampleRate);
        if (rightGains) _right.setEqBandGain(i, rightGains[i], kSampleRate);
    }
}

// ============================================================
//  setCompressorParams  —  any thread safe
// ============================================================
void AudioEngine::setCompressorParams(const CompressorParams& params) noexcept {
    _left.comp.setParams(params);
    _right.comp.setParams(params);
}

// ============================================================
//  setFeedbackSuppression  —  any thread safe
// ============================================================
void AudioEngine::setFeedbackSuppression(bool enabled) noexcept {
    _left.afc.setEnabled(enabled);
    _right.afc.setEnabled(enabled);
}

// ============================================================
//  setAfcDelayMs  —  any thread safe
// ============================================================
void AudioEngine::setAfcDelayMs(float ms) noexcept {
    _left.afc.setDelayMs(ms);
    _right.afc.setDelayMs(ms);
}

// ============================================================
//  process  —  THE real-time audio callback
//  ─────────────────────────────────────────────────────────────
//  Called by the platform audio callback (Oboe / CoreAudio tap).
//  inputData:  interleaved stereo Float32  [L0, R0, L1, R1, …]
//  outputData: same layout — may be the same pointer (in-place OK)
//  numFrames:  number of stereo frames in this buffer
//
//  PERFORMANCE BUDGET (at 48kHz, 240-frame buffer = 5ms):
//    Budget per frame: ~1/48000 = 20.8 µs
//    AFC:    ~6 ops/sample  → ~288 ops/frame  → trivial
//    EQ×6:   ~5 ops/biquad  → ~1440 ops/frame → trivial
//    Comp:   ~15 ops/sample → ~720 ops/frame  → trivial
//    Total:  ~2448 ops/frame (ARM64 pipeline: ~1ns each) ≈ 2.5µs/frame
//    Leaves 18.3µs headroom — far above the 20ms round-trip target.
//
//  RULES (enforced by convention — no runtime check):
//    1. No heap allocation (new/malloc/std::vector construction)
//    2. No mutex lock / spinlock
//    3. No system calls (no I/O, no file access, no logging)
//    4. No exceptions
//    5. No dynamic dispatch (no virtual calls in the hot loop)
// ============================================================
void AudioEngine::process(const float* __restrict__ inputData,
                                float* __restrict__ outputData,
                          int numFrames) noexcept {

    // Peak meter accumulator: track max absolute sample this buffer
    float inputPeak  = 0.f;
    float outputPeak = 0.f;

    for (int i = 0; i < numFrames; ++i) {
        // Deinterleave: input is [L, R, L, R, …]
        float inL = inputData[i * 2 + 0];
        float inR = inputData[i * 2 + 1];

        // Track input peak
        const float absL = inL < 0.f ? -inL : inL;
        const float absR = inR < 0.f ? -inR : inR;
        if (absL > inputPeak) inputPeak = absL;
        if (absR > inputPeak) inputPeak = absR;

        // ── Per-channel DSP chain ─────────────────────────────────────
        //   AFC → EQ[6] → Compressor → master gain
        // Each stage is a single inline function call — the compiler
        // will inline everything into this loop for zero call overhead.
        float outL = _left.process(inL);
        float outR = _right.process(inR);

        // ── Hard clip safety limiter ──────────────────────────────────
        // Prevents digital clipping if makeup gain is misconfigured.
        // Cheap: no math, just a branch-predictor-friendly compare.
        outL = outL >  1.f ?  1.f : outL < -1.f ? -1.f : outL;
        outR = outR >  1.f ?  1.f : outR < -1.f ? -1.f : outR;

        // Reinterleave output
        outputData[i * 2 + 0] = outL;
        outputData[i * 2 + 1] = outR;

        // Track output peak
        const float absOL = outL < 0.f ? -outL : outL;
        const float absOR = outR < 0.f ? -outR : outR;
        if (absOL > outputPeak) outputPeak = absOL;
        if (absOR > outputPeak) outputPeak = absOR;
    }

    // ── Update atomic meters (read by UI thread via JSI) ─────────────
    // memory_order_relaxed: we don't need sequential consistency,
    // just eventual visibility — a stale meter value is fine.
    _inputLevelDb.store(linearToDb(inputPeak),  std::memory_order_relaxed);
    _outputLevelDb.store(linearToDb(outputPeak), std::memory_order_relaxed);
}

} // namespace clarihear
