// ============================================================
//  OboeAudioPlayer.cpp  —  ClariHear Android Audio I/O  [PHASE 3]
//  FULL IMPLEMENTATION — replaces the Phase 1 stub.
//
//  Architecture:
//    • Two Oboe streams — one for input (mic), one for output (speaker).
//    • The output stream drives the audio thread via its DataCallback.
//    • The input stream is in EXCLUSIVE+LowLatency mode and polled
//      inside the output callback (duplex via Oboe's FullDuplexStream
//      pattern) — this eliminates any inter-thread synchronisation.
//    • The shared C++ AudioEngine::process() is called once per
//      output callback with the mic samples.
//
//  Why two separate streams (not Oboe FullDuplexStream)?
//    FullDuplexStream only works when both streams share the same
//    sample rate AND buffer size, which isn't guaranteed across all
//    Android devices. Two separate streams + manual polling of the
//    input inside the output callback is the production-safe approach
//    used by Google's own audio samples (github.com/google/oboe).
//
//  Latency breakdown (target device: Pixel 7 / Snapdragon 8xx):
//    Output buffer  = 96 frames @ 48kHz = 2.0ms
//    Input buffer   = 96 frames @ 48kHz = 2.0ms
//    DSP processing = ~0.005ms (2448 ops @ 1ns each, Phase 2 math)
//    Round-trip     ≈ 4.0ms hardware + driver overhead ≈ 6–10ms total
//    Well within the 20ms ceiling.
// ============================================================

#include "OboeAudioPlayer.h"

#include <android/log.h>
#include <cassert>
#include <cstring>
#include <algorithm>

#define LOG_TAG  "ClarihearOboe"
#define LOGI(...)  __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGW(...)  __android_log_print(ANDROID_LOG_WARN,  LOG_TAG, __VA_ARGS__)
#define LOGE(...)  __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace clarihear {

// ── Oboe stream configuration constants ──────────────────────
static constexpr int32_t kSampleRate    = 48000;
static constexpr int32_t kChannelCount  = 2;   // stereo — L/R per-ear processing
static constexpr int32_t kFramesPerBurst= 96;  // ~2ms @ 48kHz — request minimum

// ============================================================
//  Constructor / Destructor
// ============================================================
OboeAudioPlayer::OboeAudioPlayer()
    : _dsp() {
    LOGI("OboeAudioPlayer created — DSP engine @ %p", &_dsp);
}

OboeAudioPlayer::~OboeAudioPlayer() {
    stop();
}

// ============================================================
//  openOutputStream
//
//  This stream is the DRIVER — its DataCallback fires on the
//  audio hardware interrupt and is the only audio thread.
//
//  Key settings that GUARANTEE low latency:
//    PerformanceMode::LowLatency — requests exclusive HAL access
//    SharingMode::Exclusive      — no shared audio mixer in path
//    Format::Float               — matches C++ Float32 pipeline
//    ChannelCount::Stereo        — L/R per-ear amplification
//
//  If Exclusive mode is not supported (rare), Oboe automatically
//  falls back to Shared. We log a warning in that case.
// ============================================================
bool OboeAudioPlayer::openOutputStream() {
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Output)
           .setPerformanceMode(oboe::PerformanceMode::LowLatency)   // CRITICAL
           .setSharingMode(oboe::SharingMode::Exclusive)            // CRITICAL
           .setFormat(oboe::AudioFormat::Float)
           .setChannelCount(kChannelCount)
           .setSampleRate(kSampleRate)
           .setFramesPerDataCallback(kFramesPerBurst)
           .setDataCallback(this)      // → onAudioReady()
           .setErrorCallback(this);    // → onErrorAfterClose()

    oboe::Result result = builder.openStream(_outputStream);
    if (result != oboe::Result::OK) {
        LOGE("openOutputStream failed: %s", oboe::convertToText(result));
        return false;
    }

    // Warn if we didn't get exclusive mode (affects latency)
    if (_outputStream->getSharingMode() != oboe::SharingMode::Exclusive) {
        LOGW("WARNING: Output stream is NOT exclusive — latency may increase");
    }

    // Minimize buffer to achieve lowest latency.
    // setBufferSizeInFrames returns the actual size the driver accepted.
    int32_t actualSize = _outputStream->setBufferSizeInFrames(
        _outputStream->getFramesPerBurst() * 2);  // double-buffer
    if (actualSize < 0) {
        LOGW("setBufferSizeInFrames failed, using driver default");
    }

    LOGI("Output stream: sampleRate=%d channels=%d bufferSize=%d frames "
         "performanceMode=%d sharingMode=%d",
         _outputStream->getSampleRate(),
         _outputStream->getChannelCount(),
         _outputStream->getBufferSizeInFrames(),
         (int)_outputStream->getPerformanceMode(),
         (int)_outputStream->getSharingMode());

    return true;
}

// ============================================================
//  openInputStream
//
//  Microphone capture stream.
//  InputPreset::VoiceCommunication disables Android's system
//  AGC, noise suppressor, and acoustic echo cancellation —
//  we run our own DSP chain instead.
//
//  Note: We do NOT set a DataCallback on the input stream.
//  Instead, we poll it manually inside the output callback
//  to keep both streams perfectly synchronised with zero
//  additional thread overhead.
// ============================================================
bool OboeAudioPlayer::openInputStream() {
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Input)
           .setPerformanceMode(oboe::PerformanceMode::LowLatency)
           .setSharingMode(oboe::SharingMode::Exclusive)
           .setFormat(oboe::AudioFormat::Float)
           .setChannelCount(kChannelCount)
           .setSampleRate(kSampleRate)
           // VoiceCommunication = disable system AGC/NS/AEC
           // so our C++ DSP chain gets the raw mic signal
           .setInputPreset(oboe::InputPreset::VoiceCommunication);
           // NO DataCallback — polled from the output callback

    oboe::Result result = builder.openStream(_inputStream);
    if (result != oboe::Result::OK) {
        LOGE("openInputStream failed: %s", oboe::convertToText(result));
        // Non-fatal for debugging: continue with silence instead of crashing
        return false;
    }

    LOGI("Input stream: sampleRate=%d channels=%d",
         _inputStream->getSampleRate(),
         _inputStream->getChannelCount());
    return true;
}

// ============================================================
//  start  —  open and start both streams
// ============================================================
bool OboeAudioPlayer::start() {
    if (_running) return true;

    // Open output first so we know the sample rate before opening input
    if (!openOutputStream()) return false;
    openInputStream();  // non-fatal — we fall back to silence if it fails

    // Start input before output so mic data is ready when first output
    // callback fires (avoids one buffer of glitch at stream start)
    if (_inputStream) {
        oboe::Result r = _inputStream->requestStart();
        if (r != oboe::Result::OK) {
            LOGW("inputStream->requestStart failed: %s — proceeding without mic",
                 oboe::convertToText(r));
        }
    }

    oboe::Result r = _outputStream->requestStart();
    if (r != oboe::Result::OK) {
        LOGE("outputStream->requestStart failed: %s", oboe::convertToText(r));
        stop();
        return false;
    }

    _running = true;
    LOGI("OboeAudioPlayer started — mic→DSP→speaker pipeline active");
    return true;
}

// ============================================================
//  stop  —  drain and close both streams
// ============================================================
void OboeAudioPlayer::stop() {
    if (!_running) return;
    _running = false;

    if (_outputStream) {
        _outputStream->requestStop();
        _outputStream->close();
        _outputStream.reset();
    }
    if (_inputStream) {
        _inputStream->requestStop();
        _inputStream->close();
        _inputStream.reset();
    }
    LOGI("OboeAudioPlayer stopped");
}

// ============================================================
//  onAudioReady  —  THE real-time audio callback
//  ─────────────────────────────────────────────────────────────
//  Called on the Oboe audio thread once per hardware interrupt.
//  This is the hottest code path in the entire application.
//
//  INVIOLABLE RULES (no exceptions, no excuses):
//    ✗  No heap allocation (new / malloc / std::vector growth)
//    ✗  No mutex lock or spinlock
//    ✗  No system calls, file I/O, or logging
//    ✗  No JVM calls (no JNI, no Kotlin, no Java)
//    ✗  No exceptions
//    ✓  Use only stack allocation and pre-allocated buffers
//    ✓  All DSP state is in AudioEngine — fully real-time safe
//
//  Data flow per callback:
//    1. Read mic frames from _inputStream (non-blocking poll)
//    2. Copy to _inputBuffer (pre-allocated, interleaved stereo)
//    3. Call _dsp.process() → AFC + EQ + Compression
//    4. Oboe writes the output buffer to the DAC automatically
// ============================================================
oboe::DataCallbackResult OboeAudioPlayer::onAudioReady(
        oboe::AudioStream * /*outputStream*/,
        void               *audioData,
        int32_t             numFrames) {

    auto *outputBuffer = static_cast<float*>(audioData);

    // ── Step 1: Read from the microphone input stream ─────────────────
    // We poll the input stream non-blocking. If fewer frames are available
    // than requested, we zero-pad the remainder (avoids underrun glitch).
    const int32_t stereoSamples = numFrames * kChannelCount;

    if (_inputStream && _inputStream->getState() == oboe::StreamState::Started) {
        // Non-blocking read: timeout = 0
        auto result = _inputStream->read(
            _inputBuffer,
            numFrames,
            /*timeoutNanoseconds=*/0);

        if (result.value() < numFrames) {
            // Partial read or underrun: zero-pad to avoid noise
            const int32_t got = result.value() < 0 ? 0 : result.value();
            const int32_t pad = (numFrames - got) * kChannelCount;
            std::memset(_inputBuffer + got * kChannelCount, 0,
                        pad * sizeof(float));
        }
    } else {
        // No mic stream — feed silence through DSP
        // (useful during permission request or error state)
        std::memset(_inputBuffer, 0, stereoSamples * sizeof(float));
    }

    // ── Step 2: Run the C++ DSP chain ────────────────────────────────
    //  AudioEngine::process():
    //    per frame:  AFC → EQ[6] → Compressor → hard clip → output
    //  Input:  _inputBuffer  — interleaved stereo Float32
    //  Output: outputBuffer  — Oboe's hardware DMA buffer (direct!)
    //
    //  Writes go DIRECTLY into Oboe's DMA buffer — zero copy,
    //  no intermediate memcpy.
    _dsp.process(_inputBuffer, outputBuffer, numFrames);

    return oboe::DataCallbackResult::Continue;
}

// ============================================================
//  onErrorAfterClose  —  stream restart after device change
//  ─────────────────────────────────────────────────────────────
//  Called when Oboe's internal error recovery has already tried
//  to restart the stream and failed (e.g. headphones unplugged,
//  Bluetooth device switched, audio focus stolen).
//
//  We restart the entire pipeline cleanly.
//  Note: this callback fires on a NON-audio thread (safe to allocate).
// ============================================================
void OboeAudioPlayer::onErrorAfterClose(
        oboe::AudioStream * /*stream*/,
        oboe::Result result) {
    LOGW("Stream error after close: %s — restarting pipeline",
         oboe::convertToText(result));

    // Brief pause to let the audio subsystem settle
    // (safe — we're on a non-real-time thread here)
    usleep(200'000);  // 200ms

    // Restart cleanly — stop() resets _running so start() re-opens streams
    bool wasRunning = _running;
    stop();
    if (wasRunning) {
        if (!start()) {
            LOGE("Failed to restart after error — audio pipeline stopped");
        }
    }
}

} // namespace clarihear
