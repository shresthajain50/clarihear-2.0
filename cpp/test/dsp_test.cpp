// ============================================================
//  dsp_test.cpp  —  ClariHear DSP Unit Tests
//  Compile and run WITHOUT React Native / iOS / Android:
//
//    cd "/Users/shresthajain/clarihear 2.0"
//    clang++ -std=c++17 -O2 -I cpp \
//        cpp/BiquadFilter.cpp cpp/Compressor.cpp cpp/AudioEngine.cpp \
//        cpp/test/dsp_test.cpp -o dsp_test && ./dsp_test
//
//  Expected output:
//    [PASS] BiquadFilter: 1kHz peak filter unity gain at DC
//    [PASS] BiquadFilter: 1kHz peak filter boosts at centre freq
//    [PASS] Compressor: below threshold → unity gain
//    [PASS] Compressor: above threshold → gain reduction
//    [PASS] AudioEngine: process() runs without crash
//    [PASS] AudioEngine: silence in → silence out
//    [PASS] AudioEngine: no sample exceeds ±1.0 (hard clip safety)
//    All 7 tests passed.
// ============================================================

#include "AudioEngine.h"
#include "BiquadFilter.h"
#include "Compressor.h"

#include <cmath>
#include <cstdio>
#include <cassert>
#include <array>
#include <numeric>

using namespace clarihear;

// ── Test harness ─────────────────────────────────────────────
static int gPassed = 0;
static int gFailed = 0;

#define EXPECT_NEAR(val, expected, tol, name)              \
    do {                                                    \
        float _v = (val), _e = (expected);                 \
        if (std::abs(_v - _e) <= (tol)) {                  \
            printf("[PASS] %s  (got %.4f)\n", name, _v);   \
            ++gPassed;                                      \
        } else {                                            \
            printf("[FAIL] %s  expected %.4f ±%.4f, got %.4f\n", \
                   name, _e, (float)(tol), _v);            \
            ++gFailed;                                      \
        }                                                   \
    } while(0)

#define EXPECT_TRUE(cond, name)                            \
    do {                                                    \
        if (cond) {                                         \
            printf("[PASS] %s\n", name);                   \
            ++gPassed;                                      \
        } else {                                            \
            printf("[FAIL] %s\n", name);                   \
            ++gFailed;                                      \
        }                                                   \
    } while(0)

// ── Helpers ───────────────────────────────────────────────────

/// Generate numSamples of a sine wave at freq Hz, sample rate 48kHz.
static std::vector<float> makeSine(float freq, int numSamples,
                                    float amplitude = 0.5f) {
    std::vector<float> buf(numSamples);
    for (int i = 0; i < numSamples; ++i)
        buf[i] = amplitude * std::sin(2.f * M_PI * freq * i / 48000.f);
    return buf;
}

/// Measure RMS of a buffer.
static float rms(const std::vector<float>& buf) {
    float sum = 0.f;
    for (float x : buf) sum += x * x;
    return std::sqrt(sum / static_cast<float>(buf.size()));
}

// ── Test: BiquadFilter ────────────────────────────────────────

void test_biquad_peak_dc() {
    // A peak filter at 1kHz should pass DC (0 Hz) at unity gain.
    BiquadFilter flt;
    BiquadCoeffs c = makeBiquadCoeffs(BiquadType::Peak, 48000.f, 1000.f, 0.7f, 20.f);
    flt.setCoeffs(c);

    // Feed a constant signal (DC = 1.0) for 2048 samples
    float out = 0.f;
    for (int i = 0; i < 2048; ++i)
        out = flt.process(1.f);

    // After settling, output should be ~1.0 (0 dB at DC for a peak filter)
    EXPECT_NEAR(out, 1.f, 0.02f, "BiquadFilter: 1kHz peak filter unity gain at DC");
}

void test_biquad_peak_centre() {
    // A +20dB peak filter at 1kHz should boost a 1kHz sine.
    BiquadFilter flt;
    BiquadCoeffs c = makeBiquadCoeffs(BiquadType::Peak, 48000.f, 1000.f, 0.7f, 20.f);
    flt.setCoeffs(c);

    auto sine = makeSine(1000.f, 48000);  // 1 second

    // Warm-up pass (flush transient)
    std::vector<float> out(48000);
    for (int i = 0; i < 48000; ++i) out[i] = flt.process(sine[i]);

    // Measure last 0.5s
    float inputRms  = rms(std::vector<float>(sine.end() - 24000, sine.end()));
    float outputRms = rms(std::vector<float>(out.end()  - 24000, out.end()));
    float gainDb    = 20.f * std::log10(outputRms / inputRms);

    // Should be close to +20 dB
    EXPECT_NEAR(gainDb, 20.f, 1.5f, "BiquadFilter: 1kHz peak filter boosts at centre freq");
}

// ── Test: Compressor ──────────────────────────────────────────

void test_compressor_below_threshold() {
    // Below threshold: output should equal input × makeupGain
    Compressor comp(48000.f);
    CompressorParams p;
    p.thresholdDb  = -20.f;
    p.ratio        = 4.f;
    p.attackMs     = 0.f;    // instant — for deterministic test
    p.releaseMs    = 0.f;
    p.makeupGainDb = 0.f;    // 0dB makeup for simple math
    comp.setParams(p);
    comp.reset();

    // Feed a -40 dBFS sine (well below -20 dB threshold)
    float amp = std::pow(10.f, -40.f / 20.f);   // -40 dBFS
    auto sine = makeSine(100.f, 48000, amp);
    std::vector<float> out(48000);
    for (int i = 0; i < 48000; ++i) out[i] = comp.process(sine[i]);

    float inputRms  = rms(sine);
    float outputRms = rms(std::vector<float>(out.end() - 12000, out.end()));
    float gainDb    = 20.f * std::log10(outputRms / inputRms);

    // Should be 0 dB ± small amount (no compression, 0dB makeup)
    EXPECT_NEAR(gainDb, 0.f, 1.f, "Compressor: below threshold → unity gain");
}

void test_compressor_above_threshold() {
    // Above threshold: output should be attenuated by ratio
    Compressor comp(48000.f);
    CompressorParams p;
    p.thresholdDb  = -30.f;
    p.ratio        = 10.f;   // aggressive: 10:1
    p.kneeDb       = 0.f;    // hard knee for predictable test
    p.attackMs     = 0.f;    // instant
    p.releaseMs    = 0.f;
    p.makeupGainDb = 0.f;
    comp.setParams(p);
    comp.reset();

    // Feed a -10 dBFS sine (20 dB above threshold)
    float amp = std::pow(10.f, -10.f / 20.f);
    auto sine = makeSine(100.f, 96000, amp);   // 2 seconds
    std::vector<float> out(96000);
    for (int i = 0; i < 96000; ++i) out[i] = comp.process(sine[i]);

    float inputRms  = rms(std::vector<float>(sine.end() - 24000, sine.end()));
    float outputRms = rms(std::vector<float>(out.end()  - 24000, out.end()));
    float gainDb    = 20.f * std::log10(outputRms / inputRms);

    // Expected gain reduction: (1/ratio - 1) × overshoot
    // overshoot = -10 - (-30) = +20 dB
    // reduction = (1/10 - 1) × 20 = -18 dB → output ≈ -28 dBFS
    // So gain applied ≈ -18 dB
    EXPECT_NEAR(gainDb, -18.f, 3.f, "Compressor: above threshold → gain reduction");
}

// ── Test: AudioEngine ─────────────────────────────────────────

void test_engine_no_crash() {
    AudioEngine eng;
    const int kFrames = 256;
    float input[kFrames * 2]  = {};
    float output[kFrames * 2] = {};

    // Should not crash or throw
    eng.process(input, output, kFrames);
    EXPECT_TRUE(true, "AudioEngine: process() runs without crash");
}

void test_engine_silence_in_silence_out() {
    AudioEngine eng;
    const int kFrames = 1024;
    float input[kFrames * 2]  = {};  // silence
    float output[kFrames * 2] = {};
    eng.process(input, output, kFrames);

    float peak = 0.f;
    for (int i = 0; i < kFrames * 2; ++i)
        if (std::abs(output[i]) > peak) peak = std::abs(output[i]);

    EXPECT_NEAR(peak, 0.f, 0.0001f, "AudioEngine: silence in → silence out");
}

void test_engine_hard_clip() {
    // Feed a massive signal and verify hard clip safety limiter works
    AudioEngine eng;
    const int kFrames = 4096;
    std::vector<float> input(kFrames * 2, 100.f);   // +40 dBFS: should be clipped
    std::vector<float> output(kFrames * 2, 0.f);

    eng.process(input.data(), output.data(), kFrames);

    float peak = 0.f;
    for (float x : output) if (std::abs(x) > peak) peak = std::abs(x);

    EXPECT_TRUE(peak <= 1.0f, "AudioEngine: no sample exceeds ±1.0 (hard clip safety)");
}

// ── main ──────────────────────────────────────────────────────
int main() {
    printf("=== ClariHear DSP Unit Tests ===\n\n");

    test_biquad_peak_dc();
    test_biquad_peak_centre();
    test_compressor_below_threshold();
    test_compressor_above_threshold();
    test_engine_no_crash();
    test_engine_silence_in_silence_out();
    test_engine_hard_clip();

    printf("\n%d passed, %d failed.\n", gPassed, gFailed);
    return gFailed > 0 ? 1 : 0;
}
