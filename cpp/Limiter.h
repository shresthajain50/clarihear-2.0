#pragma once
// ============================================================
//  Limiter.h  —  ClariHear output safety limiter (Level 1)
//
//  Stereo-linked sample-peak limiter with instant attack and
//  exponential release. Instant attack means the gain is always
//  <= ceiling/|x| on the sample being output, so no sample can
//  exceed the ceiling. Linking both ears keeps the stereo image
//  stable while limiting.
//
//  This prevents DIGITAL clipping only. It is not an acoustic
//  SPL limit (PRD §23 Level 3 — needs calibrated hardware).
//
//  Real-time safe: no allocation, no locks, no I/O.
// ============================================================

#include <cmath>
#include "GainConstraints.h"

namespace clarihear {

class PeakLimiter {
public:
    explicit PeakLimiter(float sampleRate,
                         float ceilingLin = limits::kLimiterCeilingLin,
                         float releaseMs  = 50.f) noexcept
        : _ceiling(ceilingLin),
          _releaseCoeff(std::exp(-1.f / (releaseMs * 0.001f * sampleRate))) {}

    void reset() noexcept { _gain = 1.f; }

    /// Limit one stereo frame in place. Returns true if gain reduction was applied.
    inline bool process(float& l, float& r) noexcept {
        const float al = l < 0.f ? -l : l;
        const float ar = r < 0.f ? -r : r;
        const float peak = al > ar ? al : ar;
        const float needed = peak > _ceiling ? _ceiling / peak : 1.f;
        if (needed < _gain) {
            _gain = needed;                                          // instant attack
        } else {
            _gain = needed + _releaseCoeff * (_gain - needed);       // smooth release
            // Float release toward 1 stalls at 1-ulp; snap so an idle limiter is bit-transparent.
            if (_gain > 0.99999f && needed == 1.f) _gain = 1.f;
        }
        l *= _gain;
        r *= _gain;
        return needed < 1.f;
    }

    float ceiling() const noexcept { return _ceiling; }

private:
    float _ceiling;
    float _releaseCoeff;
    float _gain = 1.f;
};

} // namespace clarihear
