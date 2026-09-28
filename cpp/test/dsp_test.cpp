// ============================================================
//  dsp_test.cpp  —  ClariHear DSP unit + golden-fixture tests
//  Build & run headlessly (no React Native / iOS / Android):
//    cmake -S cpp -B build/cpp && cmake --build build/cpp && ctest --test-dir build/cpp --output-on-failure
//  Regenerate golden fixtures after an intentional DSP change:
//    CLARIHEAR_UPDATE_GOLDEN=1 ./build/cpp/dsp_test
// ============================================================
#include "BiquadFilter.h"
#include "Compressor.h"
#include "test_util.h"

using namespace clarihear;
using namespace testutil;

static std::vector<float> makeSine(float freq, int n, float amp = 0.5f) { return sine(freq, n, amp); }
static float rms(const std::vector<float>& b) { return testutil::rms(b.data(), b.size()); }

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

void test_biquad_golden_noise() {
    // Golden: +12 dB peak @ 2 kHz on 0.5 s of fixed-seed noise must match the fixture.
    BiquadFilter flt;
    flt.setCoeffs(makeBiquadCoeffs(BiquadType::Peak, kSr, 2000.f, 0.7f, 12.f));
    auto in = noise(24000, 0.1f);
    for (float& x : in) x = flt.process(x);
    EXPECT_TRUE(matchesGolden("biquad_peak2k_12db_noise", stereo(in)),
                "BiquadFilter: golden fixture (peak 2 kHz +12 dB on noise)");
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

void test_compressor_static_curve() {
    // Steady tones from -70 to 0 dBFS (0.5 dB steps), default ratio 2 / knee 6 dB and the
    // clamp maxima ratio 3 / knee 12 dB: a compressor may only ever REDUCE gain (makeup 0),
    // and output level must never fall as input rises (no knee discontinuity).
    for (float ratio : {2.f, 3.f}) {
        const float knee = ratio == 2.f ? 6.f : 12.f;
        float worstBoost = -100.f, prevOut = -1e9f, worstDrop = 0.f;
        for (float inDb = -70.f; inDb <= 0.f; inDb += 0.5f) {
            Compressor comp(48000.f);
            CompressorParams p;
            p.thresholdDb = -40.f; p.ratio = ratio; p.kneeDb = knee; p.makeupGainDb = 0.f;
            comp.setParams(p);
            auto s = makeSine(1000.f, 24000, std::pow(10.f, inDb / 20.f));
            std::vector<float> out(s.size());
            for (size_t i = 0; i < s.size(); ++i) out[i] = comp.process(s[i]);
            const float outDb = 20.f * std::log10(rms(std::vector<float>(out.end() - 4800, out.end())) /
                                                  rms(std::vector<float>(s.end() - 4800, s.end()))) + inDb;
            worstBoost = std::fmax(worstBoost, outDb - inDb);
            worstDrop = std::fmin(worstDrop, outDb - prevOut);
            prevOut = outDb;
        }
        printf("       ratio %.0f knee %.0f: max gain %.2f dB, worst output step %.2f dB\n", ratio, knee, worstBoost, worstDrop);
        EXPECT_TRUE(worstBoost <= 0.1f, "Compressor: never boosts (soft knee included)");
        EXPECT_TRUE(worstDrop >= -0.1f, "Compressor: output level monotonic in input level (continuous knee)");
    }
}

// ── main ──────────────────────────────────────────────────────
int main() {
    printf("=== ClariHear DSP Unit Tests ===\n\n");

    test_biquad_peak_dc();
    test_biquad_peak_centre();
    test_biquad_golden_noise();
    test_compressor_below_threshold();
    test_compressor_above_threshold();
    test_compressor_static_curve();

    printf("\n%d passed, %d failed.\n", gPassed, gFailed);
    return gFailed > 0 ? 1 : 0;
}
