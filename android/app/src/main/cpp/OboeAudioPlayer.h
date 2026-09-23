// ============================================================
//  OboeAudioPlayer.h  —  ClariHear Android Audio I/O
//  Phase 3 will implement the full Oboe stream + callback.
//  This header defines the stable interface used by JSI bindings.
// ============================================================
#pragma once

#include <oboe/Oboe.h>
#include "AudioEngine.h"   // shared C++17 DSP engine

namespace clarihear {

// ============================================================
//  OboeAudioPlayer
//  Implements oboe::AudioStreamDataCallback so it is called
//  directly from the Oboe audio thread with zero JVM overhead.
// ============================================================
class OboeAudioPlayer : public oboe::AudioStreamDataCallback,
                        public oboe::AudioStreamErrorCallback {
public:
    OboeAudioPlayer();
    ~OboeAudioPlayer() override;

    /// Open streams and start the audio loop.
    /// Must be called after Android RECORD_AUDIO permission is granted.
    bool start();

    /// Stop and close all streams.
    void stop();

    bool isRunning() const noexcept { return _running; }

    /// Direct access to the shared DSP engine (used by JSI bindings).
    AudioEngine& dspEngine() noexcept { return _dsp; }

    // ── oboe::AudioStreamDataCallback ─────────────────────────────────
    // Called on the Oboe real-time audio thread for each buffer.
    // RULES: no heap allocation, no locks, no JVM calls.
    oboe::DataCallbackResult onAudioReady(oboe::AudioStream *stream,
                                          void              *audioData,
                                          int32_t            numFrames) override;

    // ── oboe::AudioStreamErrorCallback ────────────────────────────────
    void onErrorAfterClose(oboe::AudioStream *stream, oboe::Result result) override;

private:
    AudioEngine _dsp;

    std::shared_ptr<oboe::AudioStream> _inputStream;   // mic
    std::shared_ptr<oboe::AudioStream> _outputStream;  // speaker

    bool _running = false;

    // Intermediate buffer: sized to hold one callback's worth of stereo Float32
    // Stack-allocated to avoid heap allocation in the audio thread.
    // Max: 96kHz × 32ms × 2ch = 6144 samples — choose generously.
    static constexpr int kMaxBufferFrames = 2048;
    float _processBuffer[kMaxBufferFrames * 2]{};   // interleaved stereo

    bool openInputStream();
    bool openOutputStream();
};

} // namespace clarihear
