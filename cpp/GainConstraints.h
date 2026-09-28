#pragma once
// ============================================================
//  GainConstraints.h  —  ClariHear DSP safety bounds (Level 2)
//
//  Engine-side limits. They apply no matter what the caller sends:
//  the TS fitting module applies the same bounds, and the engine
//  enforces them again independently (defence in depth).
//
//  Values are PROVISIONAL — see docs/product/OPEN_QUESTIONS.md Q3.
//  They bound digital gain only. They do NOT establish a safe
//  acoustic SPL at the ear (PRD §23 Level 3 needs calibrated
//  hardware, which no supported device has yet).
// ============================================================

#include <cstdint>
#include <cstring>

namespace clarihear {
namespace limits {

constexpr float kMaxBandGainDb      =  20.f;  ///< per-band EQ gain ceiling
constexpr float kMinBandGainDb      = -12.f;  ///< per-band EQ floor
constexpr float kMaxTotalGainDb     =  20.f;  ///< max small-signal gain of the whole chain, any frequency
constexpr float kMaxMakeupGainDb    =   6.f;  ///< compressor makeup ceiling (counts toward kMaxTotalGainDb)
constexpr float kLimiterCeilingDbfs =  -1.f;  ///< Level 1 output peak ceiling
constexpr float kLimiterCeilingLin  = 0.891250938f;  ///< 10^(-1/20)
constexpr float kMaxToneDbfs        = -20.f;  ///< test-tone peak ceiling (L/R check), well below full scale

/// NaN/Inf check that survives -ffast-math (Android builds with it,
/// which lets the compiler assume std::isfinite() is always true).
inline bool isFiniteBits(float v) noexcept {
    uint32_t u;
    std::memcpy(&u, &v, sizeof u);
    return (u & 0x7f800000u) != 0x7f800000u;
}

/// Clamp to [lo, hi]; non-finite input maps to `fallback`.
inline float clampFinite(float v, float lo, float hi, float fallback) noexcept {
    if (!isFiniteBits(v)) return fallback;
    return v < lo ? lo : (v > hi ? hi : v);
}

inline float clampBandGainDb(float db) noexcept {
    return clampFinite(db, kMinBandGainDb, kMaxBandGainDb, 0.f);
}

} // namespace limits
} // namespace clarihear
