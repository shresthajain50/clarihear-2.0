// ============================================================
//  Compressor.cpp  —  ClariHear DSP Core
//  Wide Dynamic Range Compression (WDRC) for hearing assistance.
//
//  Algorithm: Feed-forward RMS level detector + static gain curve
//
//  Signal flow per sample:
//    1. Measure input level:  RMS envelope via 1-pole IIR smoother
//    2. Compute gain:         Apply threshold/ratio/knee curve in log domain
//    3. Smooth gain:          Attack/release time constants (prevents clicks)
//    4. Apply gain + makeup:  Output = input × gainSmoothed × makeupLinear
//
//  Why feed-forward (not feedback)?
//    Feed-forward reads the INPUT level to predict gain reduction before
//    the compressor acts on the signal. This is better for hearing aids
//    because it allows faster attack without distortion — we need to
//    attenuate a loud transient BEFORE it hits the output, not after.
//
//  Why RMS, not peak?
//    RMS correlates with perceived loudness. For a hearing aid, we care
//    about sustained loudness (speech intelligibility), not peak amplitude.
//    Peak detection would over-compress speech and sound unnatural.
//
//  Reference:
//    Zölzer, U. "Digital Audio Signal Processing" 2nd ed., Ch.4
//    Kates, J.M. "Digital Hearing Aids" (2008) Ch.5
// ============================================================

#include "Compressor.h"
#include <cmath>
#include <algorithm>

namespace clarihear {

// ── Small-number guard ───────────────────────────────────────
static constexpr float kEps = 1e-10f;  // -200 dBFS — floor for log safety

// ── dB ↔ linear conversions ─────────────────────────────────
static inline float lin2db(float x) noexcept {
    return 20.f * std::log10(x < kEps ? kEps : x);
}
static inline float db2lin(float db) noexcept {
    return std::pow(10.f, db * 0.05f);  // 0.05 = 1/20
}

// ============================================================
//  setParams — convert time-constants to per-sample coefficients
//
//  The standard 1-pole smoother coefficient for time-constant τ is:
//      coeff = exp(-1 / (τ × sampleRate))
//  This gives the smoothing filter:
//      y[n] = coeff × y[n-1] + (1-coeff) × x[n]
//  At τ=0, coeff=0 → instantaneous (no smoothing).
//  At τ=∞, coeff=1 → no response (fully frozen).
// ============================================================
void Compressor::setParams(const CompressorParams& p) noexcept {
    _params = p;

    // Time-constant → per-sample smoothing coefficient
    const float sr = _sampleRate;
    _attackCoeff  = (p.attackMs  < 0.01f) ? 0.f
                  : std::exp(-1.f / (p.attackMs  * 0.001f * sr));
    _releaseCoeff = (p.releaseMs < 0.01f) ? 0.f
                  : std::exp(-1.f / (p.releaseMs * 0.001f * sr));

    // Makeup gain: convert dB to linear once — avoid pow() in process()
    _makeupLinear = db2lin(p.makeupGainDb);
}

// ============================================================
//  computeGainDb  —  static gain curve (threshold / ratio / knee)
//
//  Three regions of the transfer function:
//
//   Gain (dB)  │
//              │          /  (1:1 below threshold)
//              │         /
//              │        / ← soft-knee zone
//              │       /──────────────── compressed zone (ratio)
//              │      /
//  ────────────┼─────/──────────────────────────────  Input (dB)
//              │
//
//  Soft-knee formula (from Zölzer p.110):
//    If (inputDb - threshold) is within ±halfKnee:
//      gainDb = (ratio-1) × (inputDb - threshold + halfKnee)² / (2 × kneeDb)
//    This smoothly blends the compressed and uncompressed regions.
// ============================================================
float Compressor::computeGainDb(float inputDb) const noexcept {
    const float thresh    = _params.thresholdDb;
    const float ratio     = _params.ratio;
    const float kneeDbl   = _params.kneeDb;
    const float halfKnee  = kneeDbl * 0.5f;
    const float overshoot = inputDb - thresh;   // positive → above threshold

    float gainReductionDb = 0.f;

    if (kneeDbl > 0.f && overshoot > -halfKnee && overshoot < halfKnee) {
        // ── Soft knee zone ──────────────────────────────────────────────
        // Quadratic blend between 1:1 and ratio:1
        const float x = overshoot + halfKnee;
        gainReductionDb = (ratio - 1.f) * x * x / (2.f * kneeDbl);
    } else if (overshoot >= halfKnee) {
        // ── Above threshold (compressed zone) ───────────────────────────
        // Standard compressor formula: output = threshold + overshoot/ratio
        // So gain = (1/ratio - 1) × overshoot
        gainReductionDb = (1.f / ratio - 1.f) * overshoot;
    }
    // Below threshold: gainReductionDb stays 0 (unity gain)

    return gainReductionDb;  // always ≤ 0 dB (gain reduction, never boost)
}

// ============================================================
//  process  —  per-sample audio callback (real-time safe)
//
//  Called on the audio thread. No heap allocation, no system calls.
//
//  Step-by-step:
//    1. Envelope:  1-pole IIR on |x| — tracks input loudness
//    2. Level dB:  convert envelope to dBFS for the gain curve
//    3. Gain curve: soft-knee threshold/ratio applied in log domain
//    4. Gain smooth: attack when compressing, release when recovering
//    5. Output:    x × linearGain × makeupLinear
// ============================================================
float Compressor::process(float x) noexcept {
    // ── Step 1: RMS envelope (simplified: 1-pole on absolute value) ─────
    // A true RMS would square, smooth, then sqrt.
    // For hearing aids, a fast absolute-value envelope is perceptually
    // equivalent and much cheaper (no sqrt in the hot path).
    const float absX = (x < 0.f) ? -x : x;
    if (absX > _envelope) {
        // Attack: envelope rises quickly when a loud transient arrives
        _envelope = _attackCoeff * _envelope + (1.f - _attackCoeff) * absX;
    } else {
        // Release: envelope decays slowly so we don't un-compress too fast
        _envelope = _releaseCoeff * _envelope + (1.f - _releaseCoeff) * absX;
    }

    // ── Step 2: Convert envelope to dBFS ────────────────────────────────
    const float inputDb = lin2db(_envelope);

    // ── Step 3: Compute target gain reduction in dB ──────────────────────
    const float targetGainDb = computeGainDb(inputDb);  // ≤ 0 dB

    // ── Step 4: Smooth the gain reduction with its own attack/release ────
    // This prevents "zipper noise" when the compressor engages or releases.
    // We use the SAME attack/release coefficients as the envelope, but the
    // gain smoother tracks targetGainDb (in log domain — sounds more natural).
    const float targetGainLin = db2lin(targetGainDb) * _makeupLinear;
    if (targetGainLin < _gainSmoothed) {
        // Compressor engaging → use attack coefficient
        _gainSmoothed = _attackCoeff  * _gainSmoothed + (1.f - _attackCoeff)  * targetGainLin;
    } else {
        // Compressor releasing → use release coefficient
        _gainSmoothed = _releaseCoeff * _gainSmoothed + (1.f - _releaseCoeff) * targetGainLin;
    }

    // ── Step 5: Apply smoothed gain ──────────────────────────────────────
    const float output = x * _gainSmoothed;

    // Update metering value (approximate dBFS of current gain — for UI)
    _currentGainDb = lin2db(_gainSmoothed / (_makeupLinear < kEps ? kEps : _makeupLinear));

    return output;
}

} // namespace clarihear
