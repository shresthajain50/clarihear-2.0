#pragma once
// Tiny test harness: check macros, deterministic signals, float32 WAV golden fixtures.
// Golden files live in cpp/test/fixtures/. To (re)generate after an intentional DSP
// change, run with CLARIHEAR_UPDATE_GOLDEN=1 and commit the new .wav with the change.

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

static int gPassed = 0;
static int gFailed = 0;

#define EXPECT_NEAR(val, expected, tol, name)                                    \
    do {                                                                         \
        float _v = (val), _e = (expected);                                       \
        if (std::fabs(_v - _e) <= (tol)) { printf("[PASS] %s  (got %.4f)\n", name, _v); ++gPassed; } \
        else { printf("[FAIL] %s  expected %.4f ±%.4f, got %.4f\n", name, _e, (float)(tol), _v); ++gFailed; } \
    } while (0)

#define EXPECT_TRUE(cond, name)                                                  \
    do {                                                                         \
        if (cond) { printf("[PASS] %s\n", name); ++gPassed; }                    \
        else { printf("[FAIL] %s  (%s)\n", name, #cond); ++gFailed; }            \
    } while (0)

namespace testutil {

constexpr float kSr = 48000.f;

inline std::vector<float> sine(float freq, int n, float amp = 0.5f) {
    std::vector<float> b(n);
    for (int i = 0; i < n; ++i) b[i] = amp * std::sin(2.f * float(M_PI) * freq * i / kSr);
    return b;
}

/// Deterministic white noise in [-amp, amp] (fixed-seed LCG, identical on every platform).
inline std::vector<float> noise(int n, float amp = 0.5f, uint32_t seed = 12345u) {
    std::vector<float> b(n);
    for (int i = 0; i < n; ++i) {
        seed = seed * 1664525u + 1013904223u;
        b[i] = amp * (float(seed >> 8) / float(1u << 24) * 2.f - 1.f);
    }
    return b;
}

inline std::vector<float> impulse(int n, float amp = 0.5f) {
    std::vector<float> b(n, 0.f);
    b[0] = amp;
    return b;
}

/// Mono → interleaved stereo (same signal both ears).
inline std::vector<float> stereo(const std::vector<float>& m) {
    std::vector<float> s(m.size() * 2);
    for (size_t i = 0; i < m.size(); ++i) s[2 * i] = s[2 * i + 1] = m[i];
    return s;
}

inline float rms(const float* b, size_t n, size_t stride = 1) {
    double acc = 0;
    size_t k = 0;
    for (size_t i = 0; i < n; i += stride, ++k) acc += double(b[i]) * b[i];
    return k ? float(std::sqrt(acc / k)) : 0.f;
}

inline float peakAbs(const std::vector<float>& b) {
    float p = 0.f;
    for (float x : b) p = std::fmax(p, std::fabs(x));
    return p;
}

// ── float32 stereo WAV (fmt tag 3) ─────────────────────────────
inline bool writeWav(const std::string& path, const std::vector<float>& interleaved) {
    FILE* f = std::fopen(path.c_str(), "wb");
    if (!f) return false;
    const uint32_t dataBytes = uint32_t(interleaved.size() * 4), sr = 48000, byteRate = sr * 8, riff = 36 + dataBytes;
    const uint16_t fmt = 3, ch = 2, align = 8, bits = 32;
    const uint32_t fmtLen = 16;
    std::fwrite("RIFF", 1, 4, f); std::fwrite(&riff, 4, 1, f); std::fwrite("WAVEfmt ", 1, 8, f);
    std::fwrite(&fmtLen, 4, 1, f); std::fwrite(&fmt, 2, 1, f); std::fwrite(&ch, 2, 1, f);
    std::fwrite(&sr, 4, 1, f); std::fwrite(&byteRate, 4, 1, f); std::fwrite(&align, 2, 1, f);
    std::fwrite(&bits, 2, 1, f); std::fwrite("data", 1, 4, f); std::fwrite(&dataBytes, 4, 1, f);
    std::fwrite(interleaved.data(), 4, interleaved.size(), f);
    return std::fclose(f) == 0;
}

/// Reads only files written by writeWav (fixed 44-byte header).
inline bool readWav(const std::string& path, std::vector<float>& out) {
    FILE* f = std::fopen(path.c_str(), "rb");
    if (!f) return false;
    char hdr[44];
    uint32_t dataBytes = 0;
    bool ok = std::fread(hdr, 1, 44, f) == 44 && std::memcmp(hdr, "RIFF", 4) == 0;
    if (ok) {
        std::memcpy(&dataBytes, hdr + 40, 4);
        out.resize(dataBytes / 4);
        ok = std::fread(out.data(), 4, out.size(), f) == out.size();
    }
    std::fclose(f);
    return ok;
}

/// Compare `got` with fixtures/<name>.wav sample-by-sample. Missing golden = failure
/// (unless CLARIHEAR_UPDATE_GOLDEN=1), so a fixture can never be silently skipped.
inline bool matchesGolden(const char* name, const std::vector<float>& got, float tol = 1e-4f) {
    const std::string path = std::string(CLARIHEAR_FIXTURE_DIR) + "/" + name + ".wav";
    if (const char* u = std::getenv("CLARIHEAR_UPDATE_GOLDEN"); u && *u == '1') {
        const bool ok = writeWav(path, got);
        printf("       [golden] wrote %s\n", path.c_str());
        return ok;
    }
    std::vector<float> want;
    if (!readWav(path, want)) { printf("       [golden] missing %s\n", path.c_str()); return false; }
    if (want.size() != got.size()) { printf("       [golden] length %zu != %zu\n", got.size(), want.size()); return false; }
    for (size_t i = 0; i < got.size(); ++i) {
        if (!(std::fabs(got[i] - want[i]) <= tol)) {
            printf("       [golden] sample %zu: got %.7f want %.7f\n", i, got[i], want[i]);
            return false;
        }
    }
    return true;
}

} // namespace testutil
