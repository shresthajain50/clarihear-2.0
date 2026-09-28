// ============================================================
//  AudioEngine.cpp  —  ClariHear DSP Core (see AudioEngine.h for the chain + threading)
// ============================================================

#include "AudioEngine.h"

#include <algorithm>
#include <cmath>

namespace clarihear {

namespace {

constexpr int kParamRampSamples  = 480;  // 10 ms: EQ + volume glide
constexpr int kBypassRampSamples = 480;  // 10 ms crossfade
constexpr int kMuteRampSamples   = 96;   //  2 ms: "immediate" but click-free

inline float sanitize(float x) noexcept { return limits::isFiniteBits(x) ? x : 0.f; }

inline float approach(float x, float target, float step) noexcept {
    return x < target ? std::min(target, x + step) : std::max(target, x - step);
}

inline float linearToDb(float lin) noexcept { return lin < 1e-5f ? -96.f : 20.f * std::log10(lin); }

/// Gentle WDRC bounds. Engineering placeholders, not a prescription (PRD §6 issue 5).
CompressorParams clampCompressor(CompressorParams p) noexcept {
    using limits::clampFinite;
    p.thresholdDb  = clampFinite(p.thresholdDb, -60.f, -10.f, -40.f);
    p.ratio        = clampFinite(p.ratio, 1.f, 3.f, 2.f);
    p.kneeDb       = clampFinite(p.kneeDb, 0.f, 12.f, 6.f);
    p.attackMs     = clampFinite(p.attackMs, 1.f, 50.f, 5.f);
    p.releaseMs    = clampFinite(p.releaseMs, 20.f, 1000.f, 100.f);
    p.makeupGainDb = clampFinite(p.makeupGainDb, 0.f, limits::kMaxMakeupGainDb, 0.f);
    return p;
}

/// Peak of the combined EQ magnitude response, 1/12-octave grid 20 Hz..20 kHz.
float eqPeakDb(const float g[kEqBands]) noexcept {
    BiquadCoeffs c[kEqBands];
    for (int i = 0; i < kEqBands; ++i)
        c[i] = makeBiquadCoeffs(BiquadType::Peak, AudioEngine::kSampleRate, kEqFrequencies[i], kEqQ, g[i]);
    float worst = -1e9f;
    for (float f = 20.f; f <= 20000.f; f *= 1.0594631f) {
        float db = 0.f;
        for (const auto& ci : c) db += biquadMagnitudeDb(ci, AudioEngine::kSampleRate, f);
        worst = std::max(worst, db);
    }
    return worst;
}

/// Level 2: overlapping bells sum, so bound the COMBINED response (+ makeup), not each band.
/// Scales positive gains down; if that somehow fails to converge, drops all boost.
void boundTotalGain(float g[kEqBands], float makeupDb) noexcept {
    const float allowed = limits::kMaxTotalGainDb - makeupDb;
    for (int iter = 0; iter < 12; ++iter) {
        const float peak = eqPeakDb(g);
        if (peak <= allowed + 0.05f) return;
        const float s = peak > 0.f && allowed > 0.f ? allowed / peak : 0.f;
        for (int i = 0; i < kEqBands; ++i) if (g[i] > 0.f) g[i] *= s;
    }
    if (eqPeakDb(g) > allowed + 0.05f)
        for (int i = 0; i < kEqBands; ++i) g[i] = std::min(g[i], 0.f);
}

} // namespace

AudioEngine::AudioEngine() noexcept
    : _left(kSampleRate), _right(kSampleRate), _limiter(kSampleRate) {
    const BiquadCoeffs hp = makeBiquadCoeffs(BiquadType::HighPass, kSampleRate, kHighPassHz, 0.7071f, 0.f);
    _left.hpf.setCoeffs(hp);
    _right.hpf.setCoeffs(hp);
    {
        std::lock_guard<std::mutex> lock(_writeMutex);
        publishLocked();
    }
    _mailbox.read(_rt);
    applyRt(/*ramp=*/false);
}

// ── Writer side ─────────────────────────────────────────────

void AudioEngine::publishLocked() noexcept {
    RtParams rt;
    rt.comp = clampCompressor(_comp);
    rt.volume = _volumeReq;
    const bool toneOk = (_toneChannelReq == 0 || _toneChannelReq == 1) &&
                        limits::isFiniteBits(_toneFreqReq) && limits::isFiniteBits(_toneDbfsReq);
    if (toneOk) {
        const float f = std::min(8000.f, std::max(125.f, _toneFreqReq));
        rt.toneChannel = _toneChannelReq;
        rt.tonePhaseInc = 2.f * float(M_PI) * f / kSampleRate;
        rt.toneAmp = std::pow(10.f, std::min(limits::kMaxToneDbfs, _toneDbfsReq) / 20.f);
    }
    float gl[kEqBands], gr[kEqBands];
    std::copy(_gainL, _gainL + kEqBands, gl);
    std::copy(_gainR, _gainR + kEqBands, gr);
    boundTotalGain(gl, rt.comp.makeupGainDb);
    boundTotalGain(gr, rt.comp.makeupGainDb);
    for (int i = 0; i < kEqBands; ++i) {
        rt.eqL[i] = makeBiquadCoeffs(BiquadType::Peak, kSampleRate, kEqFrequencies[i], kEqQ, gl[i]);
        rt.eqR[i] = makeBiquadCoeffs(BiquadType::Peak, kSampleRate, kEqFrequencies[i], kEqQ, gr[i]);
    }
    _mailbox.write(rt);
}

void AudioEngine::setMasterVolume(float linear) noexcept {
    std::lock_guard<std::mutex> lock(_writeMutex);
    _volumeReq = limits::clampFinite(linear, 0.f, 1.f, 0.f);
    publishLocked();
}

void AudioEngine::setBandGains(const float* leftDb, const float* rightDb) noexcept {
    std::lock_guard<std::mutex> lock(_writeMutex);
    for (int i = 0; i < kEqBands; ++i) {
        if (leftDb)  _gainL[i] = limits::clampBandGainDb(leftDb[i]);
        if (rightDb) _gainR[i] = limits::clampBandGainDb(rightDb[i]);
    }
    publishLocked();
}

void AudioEngine::setEqBandGain(int band, float leftDb, float rightDb) noexcept {
    if (band < 0 || band >= kEqBands) return;
    std::lock_guard<std::mutex> lock(_writeMutex);
    _gainL[band] = limits::clampBandGainDb(leftDb);
    _gainR[band] = limits::clampBandGainDb(rightDb);
    publishLocked();
}

void AudioEngine::setCompressorParams(const CompressorParams& params) noexcept {
    std::lock_guard<std::mutex> lock(_writeMutex);
    _comp = params;  // clamped in publishLocked
    publishLocked();
}

void AudioEngine::setTestTone(int channel, float freqHz, float levelDbfs) noexcept {
    std::lock_guard<std::mutex> lock(_writeMutex);
    _toneChannelReq = channel;
    _toneFreqReq = freqHz;
    _toneDbfsReq = levelDbfs;
    publishLocked();
}

void AudioEngine::setFeedbackSuppression(bool enabled) noexcept {
    _left.afc.setEnabled(enabled);   // atomics inside FeedbackSuppressor
    _right.afc.setEnabled(enabled);
}

void AudioEngine::setAfcDelayMs(float ms) noexcept {
    ms = limits::clampFinite(ms, 0.f, 50.f, 5.f);
    _left.afc.setDelayMs(ms);
    _right.afc.setDelayMs(ms);
}

// ── Audio thread ────────────────────────────────────────────

void AudioEngine::applyRt(bool ramp) noexcept {
    const int n = ramp ? kParamRampSamples : 0;
    for (int i = 0; i < kEqBands; ++i) {
        _left.eq[i].rampTo(_rt.eqL[i], n);
        _right.eq[i].rampTo(_rt.eqR[i], n);
    }
    _left.comp.setParams(_rt.comp);
    _right.comp.setParams(_rt.comp);
    if (_rt.volume != _volumeTarget || !ramp) {
        _volumeTarget = _rt.volume;
        if (ramp) {
            _volumeStep = (_volumeTarget - _volume) / float(kParamRampSamples);
            _volumeRampLeft = kParamRampSamples;
        } else {
            _volume = _volumeTarget;
            _volumeRampLeft = 0;
        }
    }
}

void AudioEngine::process(const float* input, float* output, int numFrames) noexcept {
    if (!output || numFrames <= 0) return;
    if (!input) {
        std::fill(output, output + 2 * numFrames, 0.f);
        return;
    }
    if (_mailbox.read(_rt)) applyRt(/*ramp=*/true);

    const bool paused = _session.load(std::memory_order_relaxed) >= int(SessionStatus::PausedRouteLost);
    const float muteTarget   = (_muted.load(std::memory_order_relaxed) || paused) ? 0.f : 1.f;
    const float bypassTarget = _bypass.load(std::memory_order_relaxed) ? 1.f : 0.f;
    float inPeak = 0.f, outPeak = 0.f;
    uint32_t limited = 0;

    for (int i = 0; i < numFrames; ++i) {
        // Read both samples before writing: input and output may alias.
        const float inL = sanitize(input[2 * i]);
        const float inR = sanitize(input[2 * i + 1]);
        inPeak = std::max(inPeak, std::max(std::fabs(inL), std::fabs(inR)));

        if (_volumeRampLeft > 0) _volume = --_volumeRampLeft ? _volume + _volumeStep : _volumeTarget;
        const float wetL = sanitize(_left.process(inL) * _volume);
        const float wetR = sanitize(_right.process(inR) * _volume);

        _bypassMix = approach(_bypassMix, bypassTarget, 1.f / kBypassRampSamples);
        _muteGain  = approach(_muteGain, muteTarget, 1.f / kMuteRampSamples);
        // At mix == 1 this is exactly inL (wet * 0 == 0), so bypass is bit-exact.
        float outL = inL * _bypassMix + wetL * (1.f - _bypassMix);
        float outR = inR * _bypassMix + wetR * (1.f - _bypassMix);

        // Test tone (L/R check): crossfade the mic out, ramp each ear's tone amplitude.
        const int ch = _rt.toneChannel;
        _toneMix  = approach(_toneMix, ch >= 0 ? 1.f : 0.f, 1.f / kParamRampSamples);
        _toneAmpL = approach(_toneAmpL, ch == 0 ? _rt.toneAmp : 0.f, _rt.toneAmp / kParamRampSamples + 1e-6f);
        _toneAmpR = approach(_toneAmpR, ch == 1 ? _rt.toneAmp : 0.f, _rt.toneAmp / kParamRampSamples + 1e-6f);
        if (_toneMix > 0.f || _toneAmpL > 0.f || _toneAmpR > 0.f) {
            const float s = std::sin(_tonePhase);
            _tonePhase += _rt.tonePhaseInc;
            if (_tonePhase > 2.f * float(M_PI)) _tonePhase -= 2.f * float(M_PI);
            outL = outL * (1.f - _toneMix) + _toneAmpL * s;
            outR = outR * (1.f - _toneMix) + _toneAmpR * s;
        }
        outL *= _muteGain;
        outR *= _muteGain;
        if (_limiter.process(outL, outR)) ++limited;

        output[2 * i]     = outL;
        output[2 * i + 1] = outR;
        outPeak = std::max(outPeak, std::max(std::fabs(outL), std::fabs(outR)));
    }

    _inputLevelDb.store(linearToDb(inPeak), std::memory_order_relaxed);
    _outputLevelDb.store(linearToDb(outPeak), std::memory_order_relaxed);
    if (limited) _limiterEngaged.fetch_add(limited, std::memory_order_relaxed);
}

} // namespace clarihear
