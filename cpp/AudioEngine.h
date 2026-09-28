#pragma once
// ============================================================
//  AudioEngine.h  —  ClariHear DSP Core
//  Platform-independent stereo pipeline, called from the platform
//  audio callbacks (Oboe on Android, AVAudioEngine tap on iOS).
//
//  Chain per ear (ENGINEERING_SKILL "DSP order", PRD §19):
//    input sanitize (non-finite → 0)          ← safety/input gate
//      → FeedbackSuppressor  (prototype, OFF unless developer mode)
//      → high-pass 100 Hz    (rumble/DC)
//      → 6-band EQ           (fitted gains from src/hearing/fitting.ts)
//      → gentle WDRC         (placeholder params, clamped)
//      → volume              (0..1, ramped)
//    → bypass crossfade (raw input) → mute ramp
//    → Level-1 stereo peak limiter (-1 dBFS) → output
//  Level 2 (gain ceiling) is enforced on the writer side before any
//  coefficients reach the audio thread. Level 3 (acoustic SPL) needs a
//  calibrated transducer and is NOT provided (PRD §23).
//
//  Threading (PRD §50):
//    • process() runs ONLY on the real-time audio thread. It never
//      allocates, locks, logs, does I/O, throws, or calls JS.
//    • setXxx() may be called from any non-audio thread. Setters serialise
//      among themselves with a writer-side mutex, precompute everything,
//      and publish through a wait-free triple buffer. Mute/bypass are
//      plain atomics so they take effect on the very next callback.
//
//  Audio format: 48000 Hz, Float32, interleaved stereo (L/R).
// ============================================================

#include "BiquadFilter.h"
#include "Compressor.h"
#include "FeedbackSuppressor.h"
#include "GainConstraints.h"
#include "Limiter.h"

#include <atomic>
#include <cstdint>
#include <mutex>

namespace clarihear {

/// EQ bands at the audiogram frequencies 250, 500, 1k, 2k, 4k, 8k Hz.
static constexpr int kEqBands = 6;
static constexpr float kEqFrequencies[kEqBands] = {250.f, 500.f, 1000.f, 2000.f, 4000.f, 8000.f};
static constexpr float kEqQ = 0.7f;
static constexpr float kHighPassHz = 100.f;

/// Platform-reported audio session state (route / interruption safety, PRD §52).
/// Paused states force silence inside process(): on headset loss the platform's FIRST
/// action is one atomic store, so nothing reaches a fallback speaker while it stops.
enum class SessionStatus : int {
    Stopped = 0,
    Running = 1,
    PausedRouteLost = 2,    ///< headphones disconnected
    PausedInterrupted = 3,  ///< call / Siri / audio focus lost
    NoHeadphones = 4,       ///< start refused: no headset-type output
};

/// Everything the audio thread needs, precomputed on the writer side.
struct RtParams {
    BiquadCoeffs eqL[kEqBands]{};
    BiquadCoeffs eqR[kEqBands]{};
    CompressorParams comp{};
    float volume = 1.f;
};

/// Single-producer / single-consumer triple buffer. write() and read() are wait-free.
template <class T>
class TripleBuffer {
public:
    void write(const T& v) noexcept {  // producer only
        _buf[_back] = v;
        _back = _mid.exchange(_back | kDirty, std::memory_order_acq_rel) & kIdx;
    }
    bool read(T& out) noexcept {  // consumer only
        if (!(_mid.load(std::memory_order_acquire) & kDirty)) return false;
        _front = _mid.exchange(_front, std::memory_order_acq_rel) & kIdx;
        out = _buf[_front];
        return true;
    }

private:
    static_assert(std::atomic<int>::is_always_lock_free, "mailbox must be lock-free");
    static constexpr int kIdx = 3, kDirty = 4;
    T _buf[3]{};
    std::atomic<int> _mid{1};
    int _front = 0, _back = 2;
};

/// Per-ear processing chain. Audio thread only.
struct ChannelEngine {
    FeedbackSuppressor afc;
    BiquadFilter hpf;
    BiquadFilter eq[kEqBands];
    Compressor comp;

    explicit ChannelEngine(float sr) noexcept : afc(sr), comp(sr) {}

    inline float process(float x) noexcept {
        x = afc.process(x);
        x = hpf.process(x);
        for (auto& f : eq) x = f.process(x);
        return comp.process(x);
    }
};

class AudioEngine {
public:
    static constexpr float kSampleRate = 48000.f;

    AudioEngine() noexcept;
    AudioEngine(const AudioEngine&) = delete;
    AudioEngine& operator=(const AudioEngine&) = delete;

    // ─── Control API (any NON-audio thread) ─────────────────
    /// Output volume, linear [0, 1]. Only ever attenuates. Non-finite → 0.
    void setMasterVolume(float linear) noexcept;
    /// Fitted per-band gains in dB GAIN (never dB HL), kEqBands each; null = leave that ear.
    /// Clamped per band, then scaled so the combined response stays under Level 2.
    void setBandGains(const float* leftDb, const float* rightDb) noexcept;
    /// Developer mode only: one band, same clamping.
    void setEqBandGain(int band, float leftDb, float rightDb) noexcept;
    /// Developer mode only: every field clamped to a gentle range.
    void setCompressorParams(const CompressorParams& params) noexcept;
    /// Developer mode only: prototype, not feedback cancellation (PRD §24).
    void setFeedbackSuppression(bool enabled) noexcept;
    void setAfcDelayMs(float ms) noexcept;
    /// Unprocessed passthrough (still limited). 10 ms crossfade.
    void setBypass(bool on) noexcept { _bypass.store(on, std::memory_order_relaxed); }
    /// Silence. Wins over everything. 2 ms ramp.
    void setMuted(bool on) noexcept { _muted.store(on, std::memory_order_relaxed); }
    /// Platform layer only. Paused states silence output (like mute, independent of it).
    void setSessionStatus(SessionStatus s) noexcept { _session.store(int(s), std::memory_order_relaxed); }
    SessionStatus sessionStatus() const noexcept { return SessionStatus(_session.load(std::memory_order_relaxed)); }

    // ─── Real-time callback ─────────────────────────────────
    /// Interleaved stereo in → out, numFrames frames. in and out may alias.
    void process(const float* input, float* output, int numFrames) noexcept;

    // ─── Metering (any thread) ──────────────────────────────
    float inputLevelDb() const noexcept { return _inputLevelDb.load(std::memory_order_relaxed); }
    float outputLevelDb() const noexcept { return _outputLevelDb.load(std::memory_order_relaxed); }
    /// Samples where the Level-1 limiter reduced gain (drives the PRD §52 message).
    uint32_t limiterEngagedCount() const noexcept { return _limiterEngaged.load(std::memory_order_relaxed); }

private:
    void publishLocked() noexcept;  // caller holds _writeMutex
    void applyRt(bool ramp) noexcept;

    // Writer side (guarded by _writeMutex; never touched by process()).
    std::mutex _writeMutex;
    float _gainL[kEqBands]{}, _gainR[kEqBands]{};
    CompressorParams _comp{};
    float _volumeReq = 1.f;
    TripleBuffer<RtParams> _mailbox;

    // Audio-thread state.
    ChannelEngine _left, _right;
    PeakLimiter _limiter;
    RtParams _rt;
    float _volume = 1.f, _volumeTarget = 1.f, _volumeStep = 0.f;
    int _volumeRampLeft = 0;
    float _muteGain = 1.f, _bypassMix = 0.f;

    std::atomic<bool> _muted{false}, _bypass{false};
    std::atomic<int> _session{int(SessionStatus::Stopped)};
    std::atomic<float> _inputLevelDb{-96.f}, _outputLevelDb{-96.f};
    std::atomic<uint32_t> _limiterEngaged{0};
};

} // namespace clarihear
