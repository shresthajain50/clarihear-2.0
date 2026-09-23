// ============================================================
//  BiquadFilter.cpp  —  ClariHear DSP Core
//  Coefficient computation via the bilinear transform (BLT).
//
//  Reference: Audio EQ Cookbook, Robert Bristow-Johnson
//  https://webaudio.github.io/Audio-EQ-Cookbook/audio-eq-cookbook.html
//
//  The BLT maps an analog prototype filter H(s) to a digital
//  filter H(z) by substituting:
//      s  →  (2/T) * (z-1)/(z+1)
//  where T = 1/sampleRate. The pre-warping constant:
//      w0 = 2π * freq / sampleRate
//  ensures the digital filter's centre frequency exactly matches
//  the specified analogue frequency.
// ============================================================

#include "BiquadFilter.h"
#include <cmath>

namespace clarihear {

// ── Internal helper: prevent NaN / denormals ────────────────
static constexpr float kDenormalFloor = 1e-15f;
static inline float sanitize(float x) noexcept {
    return (x > kDenormalFloor || x < -kDenormalFloor) ? x : 0.f;
}

// ============================================================
//  makeBiquadCoeffs
//  All formulas directly from the EQ Cookbook.
//  Every coefficient is normalised so a0 = 1.0.
// ============================================================
BiquadCoeffs makeBiquadCoeffs(BiquadType type,
                               float sampleRate,
                               float freq,
                               float Q,
                               float gainDb) noexcept {
    // Guard: clamp to Nyquist minus a small margin
    const float nyquist = sampleRate * 0.5f;
    freq = (freq < 1.f) ? 1.f : (freq >= nyquist) ? nyquist - 1.f : freq;
    Q    = (Q < 0.01f) ? 0.01f : Q;

    const float w0    = 2.f * static_cast<float>(M_PI) * freq / sampleRate;
    const float cosW0 = std::cos(w0);
    const float sinW0 = std::sin(w0);
    const float alpha = sinW0 / (2.f * Q);    // bandwidth term

    // Linear gain from dB (used only by shelf + peak filters)
    const float A     = std::pow(10.f, gainDb / 40.f);  // sqrt of power gain
    const float sqrtA = std::sqrt(A);

    BiquadCoeffs c{};
    float a0 = 1.f;  // will be divided out below

    switch (type) {

    // ── Peak (Parametric Bell) ─────────────────────────────
    // Used for all 6 audiogram EQ bands.
    // At freq: gain = A² (i.e., gainDb)
    // At DC and Nyquist: gain = 0 dB (unity)
    case BiquadType::Peak: {
        const float alphaA  = alpha * A;
        const float alphaOA = alpha / A;
        c.b0 =  1.f + alphaA;
        c.b1 = -2.f * cosW0;
        c.b2 =  1.f - alphaA;
        a0   =  1.f + alphaOA;
        c.a1 = -2.f * cosW0;
        c.a2 =  1.f - alphaOA;
        break;
    }

    // ── Low Shelf ──────────────────────────────────────────
    // Boosts/cuts all frequencies below freq by gainDb.
    // Used for the 250 Hz and 500 Hz audiogram bands.
    case BiquadType::LowShelf: {
        const float cosP1  = cosW0 + 1.f;
        const float cosM1  = cosW0 - 1.f;
        const float beta   = sqrtA / Q;          // shelf slope term
        const float betaSin = beta * sinW0;

        c.b0 =        A * ((A + 1.f) - cosM1 * A + betaSin);   // actually:
        // Full low-shelf from EQ Cookbook:
        c.b0 =  A * ( (A+1.f) - (A-1.f)*cosW0 + betaSin );
        c.b1 =  2.f*A*( (A-1.f) - (A+1.f)*cosW0 );
        c.b2 =  A * ( (A+1.f) - (A-1.f)*cosW0 - betaSin );
        a0   =        (A+1.f) + (A-1.f)*cosW0 + betaSin;
        c.a1 = -2.f*( (A-1.f) + (A+1.f)*cosW0 );
        c.a2 =        (A+1.f) + (A-1.f)*cosW0 - betaSin;
        break;
    }

    // ── High Shelf ─────────────────────────────────────────
    // Boosts/cuts all frequencies above freq by gainDb.
    // Used for the 8000 Hz audiogram band.
    case BiquadType::HighShelf: {
        const float beta    = sqrtA / Q;
        const float betaSin = beta * sinW0;
        c.b0 =  A * ( (A+1.f) + (A-1.f)*cosW0 + betaSin );
        c.b1 = -2.f*A*( (A-1.f) + (A+1.f)*cosW0 );
        c.b2 =  A * ( (A+1.f) + (A-1.f)*cosW0 - betaSin );
        a0   =        (A+1.f) - (A-1.f)*cosW0 + betaSin;
        c.a1 =  2.f*( (A-1.f) - (A+1.f)*cosW0 );
        c.a2 =        (A+1.f) - (A-1.f)*cosW0 - betaSin;
        break;
    }

    // ── Low Pass ───────────────────────────────────────────
    // Roll off frequencies above freq. Used for noise reduction.
    case BiquadType::LowPass: {
        c.b0 = (1.f - cosW0) * 0.5f;
        c.b1 =  1.f - cosW0;
        c.b2 = (1.f - cosW0) * 0.5f;
        a0   =  1.f + alpha;
        c.a1 = -2.f * cosW0;
        c.a2 =  1.f - alpha;
        break;
    }

    // ── High Pass ──────────────────────────────────────────
    // Roll off frequencies below freq. Used to remove DC / wind rumble.
    case BiquadType::HighPass: {
        c.b0 =  (1.f + cosW0) * 0.5f;
        c.b1 = -(1.f + cosW0);
        c.b2 =  (1.f + cosW0) * 0.5f;
        a0   =   1.f + alpha;
        c.a1 =  -2.f * cosW0;
        c.a2 =   1.f - alpha;
        break;
    }

    // ── Notch ──────────────────────────────────────────────
    // Deep null at freq. Used for narrow feedback squeal rejection.
    case BiquadType::Notch: {
        c.b0 =  1.f;
        c.b1 = -2.f * cosW0;
        c.b2 =  1.f;
        a0   =  1.f + alpha;
        c.a1 = -2.f * cosW0;
        c.a2 =  1.f - alpha;
        break;
    }

    } // switch

    // Normalise: divide all coefficients by a0
    const float inv_a0 = 1.f / a0;
    c.b0 *= inv_a0;
    c.b1 *= inv_a0;
    c.b2 *= inv_a0;
    c.a1 *= inv_a0;
    c.a2 *= inv_a0;

    return c;
}

} // namespace clarihear
