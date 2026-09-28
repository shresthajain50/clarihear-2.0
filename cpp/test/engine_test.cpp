// ============================================================
//  engine_test.cpp  —  AudioEngine safety-chain tests (PRD §19, §23, §46, §50)
//  Separate binary because it interposes operator new and pthread_mutex_lock
//  to prove process() never allocates or locks.
// ============================================================
#include "AudioEngine.h"
#include "GainConstraints.h"
#include "test_util.h"

#include <atomic>
#include <dlfcn.h>
#include <limits>
#include <new>
#include <pthread.h>

using namespace clarihear;
using namespace testutil;

// ── Allocation / lock interposition (only counted while gInCallback) ──
static bool gInCallback = false;
static long gAllocs = 0, gLocks = 0;

void* operator new(size_t n) {
    if (gInCallback) ++gAllocs;
    void* p = std::malloc(n ? n : 1);
    if (!p) std::abort();
    return p;
}
void* operator new[](size_t n) { return operator new(n); }
void operator delete(void* p) noexcept { std::free(p); }
void operator delete[](void* p) noexcept { std::free(p); }
void operator delete(void* p, size_t) noexcept { std::free(p); }
void operator delete[](void* p, size_t) noexcept { std::free(p); }

extern "C" int pthread_mutex_lock(pthread_mutex_t* m) {
    using Fn = int (*)(pthread_mutex_t*);
    static Fn real = reinterpret_cast<Fn>(dlsym(RTLD_NEXT, "pthread_mutex_lock"));
    if (gInCallback) ++gLocks;
    return real(m);
}

// ── helpers ─────────────────────────────────────────────────
constexpr int kBlock = 256;

/// Run interleaved stereo `in` through the engine in kBlock-frame callbacks.
static std::vector<float> run(AudioEngine& e, const std::vector<float>& in) {
    std::vector<float> out(in.size());
    const int frames = int(in.size() / 2);
    for (int f = 0; f < frames; f += kBlock) {
        const int n = std::min(kBlock, frames - f);
        gInCallback = true;
        e.process(in.data() + 2 * f, out.data() + 2 * f, n);
        gInCallback = false;
    }
    return out;
}

/// Run one continuous signal, applying `change` at block-aligned frame `split`, and
/// return the whole output so the measurement spans the join (where a click would be).
template <class Fn>
static std::vector<float> runWithChange(AudioEngine& e, const std::vector<float>& in, int split, Fn change) {
    std::vector<float> a(in.begin(), in.begin() + 2 * split), b(in.begin() + 2 * split, in.end());
    auto out = run(e, a);
    change();
    auto tail = run(e, b);
    out.insert(out.end(), tail.begin(), tail.end());
    return out;
}

static float gainDbAt(AudioEngine& e, float freq, float amp = 0.001f /* -60 dBFS, below WDRC threshold */) {
    auto in = stereo(sine(freq, 24000, amp));
    auto out = run(e, in);
    const size_t tail = 2 * 12000;  // last 0.25 s, after ramps/transients settle
    return 20.f * std::log10(rms(out.data() + out.size() - tail, tail, 2) / rms(in.data() + in.size() - tail, tail, 2));
}

static float maxStep(const std::vector<float>& b, size_t from = 0) {
    float m = 0.f;
    for (size_t i = from + 2; i < b.size(); i += 2) m = std::fmax(m, std::fabs(b[i] - b[i - 2]));
    return m;
}

/// Max |second difference|: a click is a curvature spike; a low tone has almost none.
static float maxCurvature(const std::vector<float>& b, size_t from = 0) {
    float m = 0.f;
    for (size_t i = from + 4; i < b.size(); i += 2) m = std::fmax(m, std::fabs(b[i] - 2.f * b[i - 2] + b[i - 4]));
    return m;
}

static const float kFlat[kEqBands] = {0, 0, 0, 0, 0, 0};
static const float kMax[kEqBands]  = {40, 40, 40, 40, 40, 40};  // asks for far more than allowed

// ── tests ───────────────────────────────────────────────────
void test_silence() {
    AudioEngine e;
    e.setBandGains(kMax, kMax);
    auto out = run(e, std::vector<float>(2 * 4096, 0.f));
    EXPECT_NEAR(peakAbs(out), 0.f, 1e-9f, "Engine: silence in → silence out (max gains)");
}

void test_limiter_ceiling() {
    AudioEngine e;
    e.setBandGains(kMax, kMax);
    auto in = stereo(noise(48000, 100.f));   // +40 dBFS garbage
    auto out = run(e, in);
    EXPECT_TRUE(peakAbs(out) <= limits::kLimiterCeilingLin + 1e-6f, "Engine: Level-1 limiter holds -1 dBFS for +40 dBFS input");
    EXPECT_TRUE(e.limiterEngagedCount() > 0, "Engine: limiter engagement is counted (for PRD §52 message)");
}

void test_level2_total_gain() {
    AudioEngine e;
    e.setBandGains(kMax, kMax);
    float worst = -100.f;
    for (float f : {150.f, 250.f, 354.f, 500.f, 707.f, 1000.f, 1414.f, 2000.f, 2828.f, 4000.f, 5657.f, 8000.f, 11000.f})
        worst = std::fmax(worst, gainDbAt(e, f));
    printf("       worst-case small-signal gain = %.2f dB\n", worst);
    EXPECT_TRUE(worst <= limits::kMaxTotalGainDb + 0.5f, "Engine: Level-2 combined EQ gain ≤ ceiling at every frequency");
    EXPECT_TRUE(worst >= limits::kMaxTotalGainDb - 3.f, "Engine: Level-2 scaling doesn't collapse gain far below the ceiling");
}

void test_band_gain_applied() {
    AudioEngine e;
    const float g[kEqBands] = {0, 0, 10, 0, 0, 0};
    e.setBandGains(g, kFlat);
    const float l = gainDbAt(e, 1000.f);
    EXPECT_NEAR(l, 10.f, 1.f, "Engine: +10 dB at 1 kHz band is applied (left)");
    // right ear flat, measured on the right channel only
    auto in = stereo(sine(1000.f, 24000, 0.001f));
    auto out = run(e, in);
    const size_t tail = 2 * 12000;
    const float r = 20.f * std::log10(rms(out.data() + out.size() - tail + 1, tail, 2) / rms(in.data() + in.size() - tail + 1, tail, 2));
    EXPECT_NEAR(r, 0.f, 0.5f, "Engine: left/right band gains are independent");
}

void test_bypass_bit_exact() {
    AudioEngine e;
    e.setBandGains(kMax, kMax);
    e.setBypass(true);
    auto in = stereo(noise(48000, 0.5f));
    auto out = run(e, in);
    bool exact = true;
    for (size_t i = 2 * 4800; i < in.size(); ++i) exact &= (out[i] == in[i]);  // after the 10 ms crossfade
    EXPECT_TRUE(exact, "Engine: bypass is bit-exact passthrough (in-range input)");
}

void test_mute_immediate_and_wins() {
    AudioEngine e;
    e.setBandGains(kMax, kMax);
    auto in = stereo(noise(48000, 0.5f));
    run(e, in);
    e.setBypass(true);
    e.setMuted(true);
    auto out = run(e, in);
    bool silentAfterOneBuffer = true;
    for (size_t i = 2 * kBlock; i < out.size(); ++i) silentAfterOneBuffer &= (out[i] == 0.f);
    EXPECT_TRUE(silentAfterOneBuffer, "Engine: mute silences within one buffer and beats bypass");

    // Click check on a low tone (noise already has full-scale sample-to-sample jumps).
    AudioEngine e2;
    auto tone = stereo(sine(200.f, 2 * 9600, 0.5f, float(M_PI) / 2));  // split lands on a peak
    auto muted = runWithChange(e2, tone, 9600, [&] { e2.setMuted(true); });
    const float bound = 2.f * float(M_PI) * 200.f / kSr * 0.5f + 0.5f / 96.f + 1e-3f;  // tone slope + 2 ms ramp
    EXPECT_TRUE(maxStep(muted) <= bound, "Engine: mute ramps over ~2 ms (no click)");
}

void test_volume_zero_and_click_free() {
    AudioEngine e;
    e.setMasterVolume(0.f);
    auto in = stereo(sine(1000.f, 24000, 0.01f));
    auto out = run(e, in);
    EXPECT_NEAR(peakAbs(std::vector<float>(out.begin() + 2 * 4800, out.end())), 0.f, 1e-9f, "Engine: volume 0 → silence");

    // Abrupt 0.1 → 1.0 volume jump must be ramped: sample-to-sample step stays near the sine's own slope.
    AudioEngine e2;
    e2.setMasterVolume(0.1f);
    auto a = stereo(sine(1000.f, 24000, 0.001f, float(M_PI) / 2));
    auto out2 = runWithChange(e2, a, 12000, [&] { e2.setMasterVolume(1.f); });
    const float sineSlope = 2.f * float(M_PI) * 1000.f / kSr * 0.001f;  // max |Δ| of a unity-gain sine
    EXPECT_TRUE(maxStep(out2) <= sineSlope * 1.1f, "Engine: volume change is click-free (ramped)");
}

void test_eq_change_click_free() {
    // 250 Hz tone, +12 dB step on the 250 Hz band. An instant coefficient swap puts a
    // curvature spike ~8x the tone's own; the 10 ms glide keeps it at the steady level.
    AudioEngine e;
    auto a = stereo(sine(250.f, 24000, 0.001f, float(M_PI) / 2));
    const float g[kEqBands] = {12, 0, 0, 0, 0, 0};
    auto out = runWithChange(e, a, 12000, [&] { e.setBandGains(g, g); });
    const float steady = maxCurvature(out, out.size() - 2 * 2400);
    printf("       EQ step curvature: transition %.2e vs steady %.2e\n", maxCurvature(out), steady);
    EXPECT_TRUE(maxCurvature(out) <= steady * 1.5f, "Engine: EQ gain change is click-free (coefficient ramp)");
}

void test_non_finite() {
    AudioEngine e;
    const float nanG[kEqBands] = {NAN, INFINITY, -INFINITY, 5, 5, 5};
    e.setBandGains(nanG, nanG);
    e.setMasterVolume(NAN);
    CompressorParams p;
    p.ratio = NAN; p.makeupGainDb = INFINITY; p.attackMs = -1.f;
    e.setCompressorParams(p);
    auto in = stereo(noise(9600, 0.3f));
    in[100] = NAN; in[201] = INFINITY;
    auto out = run(e, in);
    bool finite = true;
    for (float x : out) finite &= limits::isFiniteBits(x);
    EXPECT_TRUE(finite, "Engine: non-finite params and input samples never reach the output");
}

void test_makeup_clamped() {
    AudioEngine e;
    CompressorParams p;
    p.makeupGainDb = 20.f;   // old placeholder default
    e.setCompressorParams(p);
    EXPECT_TRUE(gainDbAt(e, 1000.f) <= limits::kMaxMakeupGainDb + 0.5f, "Engine: compressor makeup clamped to kMaxMakeupGainDb");
}

void test_highpass() {
    AudioEngine e;
    EXPECT_TRUE(gainDbAt(e, 30.f) < -12.f, "Engine: high-pass removes 30 Hz rumble (> 12 dB)");
    EXPECT_NEAR(gainDbAt(e, 1000.f), 0.f, 0.5f, "Engine: high-pass leaves speech band at unity");
}

void test_rt_safety() {
    AudioEngine e;
    gAllocs = gLocks = 0;
    auto in = stereo(noise(4800, 0.3f));
    for (int i = 0; i < 20; ++i) {   // interleave parameter changes with callbacks
        const float g[kEqBands] = {float(i % 7), 3, 6, 9, 12, 15};
        e.setBandGains(g, g);
        e.setMasterVolume(0.05f * i);
        e.setBypass(i % 3 == 0);
        e.setMuted(i % 5 == 0);
        run(e, in);
    }
    printf("       allocations in process(): %ld, mutex locks in process(): %ld\n", gAllocs, gLocks);
    EXPECT_TRUE(gAllocs == 0, "Engine: process() never allocates");
    EXPECT_TRUE(gLocks == 0, "Engine: process() never locks a mutex");
}

void test_golden_chain() {
    AudioEngine e;
    const float l[kEqBands] = {0, 2, 5, 9, 12, 12}, r[kEqBands] = {0, 1, 4, 7, 10, 10};
    e.setBandGains(l, r);
    auto s = sine(440.f, 24000, 0.05f), n = noise(24000, 0.05f);
    for (size_t i = 0; i < s.size(); ++i) s[i] += n[i];
    EXPECT_TRUE(matchesGolden("engine_sloping_fit_speechband", run(e, stereo(s))), "Engine: golden fixture (sloping fit, tone + noise)");
}

void test_golden_limiter() {
    AudioEngine e;
    e.setBandGains(kMax, kMax);
    auto in = stereo(impulse(4800, 1.f));
    for (int k = 1; k < 10; ++k) in[2 * 480 * k] = in[2 * 480 * k + 1] = 1.f;  // 100 Hz click train at 0 dBFS
    EXPECT_TRUE(matchesGolden("engine_limiter_click_train", run(e, in)), "Engine: golden fixture (limiter on click train)");
}

int main() {
    printf("=== ClariHear AudioEngine safety-chain tests ===\n\n");
    test_silence();
    test_limiter_ceiling();
    test_level2_total_gain();
    test_band_gain_applied();
    test_bypass_bit_exact();
    test_mute_immediate_and_wins();
    test_volume_zero_and_click_free();
    test_eq_change_click_free();
    test_non_finite();
    test_makeup_clamped();
    test_highpass();
    test_rt_safety();
    test_golden_chain();
    test_golden_limiter();
    printf("\n%d passed, %d failed.\n", gPassed, gFailed);
    return gFailed > 0 ? 1 : 0;
}
