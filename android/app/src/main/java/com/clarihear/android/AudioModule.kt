package com.clarihear.android

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactContext

/**
 * AudioModule — Kotlin JNI wrapper + JSI installer for ClariHear.
 *
 * Responsibilities:
 *   1. Load the clarihear_dsp.so native library
 *   2. Install global.clarihear JSI host object into Hermes (Phase 4)
 *   3. Bridge permission checks to native audio code
 *   4. Expose start/stop/setBandGains/bypass/mute (JSI is the primary path on Android)
 *
 * The JSI path (installJSI) is the production path for latency-critical
 * calls. The RN bridge path (nativeSetEqBandGain, etc.) is kept for
 * non-realtime control from React Native's async bridge.
 */
class AudioModule(private val context: Context) {

    companion object {
        init {
            System.loadLibrary("clarihear_dsp")
        }

        /**
         * Install global.clarihear JSI host object.
         * Call this from a ReactContext.OnReactContextInitializedListener
         * AFTER the JS runtime is ready.
         *
         * Example usage in MainApplication.kt:
         *
         *   reactInstanceManager.addReactInstanceEventListener { ctx ->
         *       val rtPtr = ctx.catalystInstance?.jsIRuntime ?: return@add
         *       AudioModule(ctx).installJSI(rtPtr)
         *   }
         */
        /** Outputs that are safe for mic→DSP→ear. Never the built-in speaker/earpiece (feedback). */
        private val HEADSET_TYPES = setOf(
            AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_USB_DEVICE,
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BLE_HEADSET,
        )
        @Volatile private var headsetMonitorStarted = false

        /**
         * Oboe can't see device types, so Kotlin tells native whether a headset-type output
         * exists. Native refuses to start without one, and silences + stops the moment the
         * last one disappears (PRD §52). Registered once.
         */
        fun startHeadsetMonitor(context: Context) {
            if (headsetMonitorStarted) return
            headsetMonitorStarted = true
            val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val module = AudioModule(context)
            fun push() = module.nativeSetHeadsetConnected(
                am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { it.type in HEADSET_TYPES })
            am.registerAudioDeviceCallback(object : AudioDeviceCallback() {
                override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>) = push()
                override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>) = push()
            }, Handler(Looper.getMainLooper()))
            push()
        }

        fun installFromContext(reactContext: ReactContext) {
            startHeadsetMonitor(reactContext.applicationContext)
            try {
                val catalystInstance = reactContext.catalystInstance
                    ?: run { android.util.Log.e("AudioModule", "No CatalystInstance"); return }

                // jsIRuntime is the raw Hermes runtime pointer as a Long.
                // Available in React Native 0.71+ New Architecture.
                val runtimeField = catalystInstance.javaClass.getDeclaredField("mHybridData")
                    .also { it.isAccessible = true }
                // The cleanest way: use the public API if available
                val runtimePtr: Long = try {
                    val method = catalystInstance.javaClass.getMethod("getJSIRuntime")
                    method.invoke(catalystInstance) as? Long ?: 0L
                } catch (e: Exception) {
                    // Fallback: read through HybridData
                    android.util.Log.w("AudioModule",
                        "getJSIRuntime not found, trying HybridData: ${e.message}")
                    0L
                }

                if (runtimePtr != 0L) {
                    AudioModule(reactContext).nativeInstallJSI(runtimePtr)
                    android.util.Log.i("AudioModule", "✅ global.clarihear installed")
                } else {
                    android.util.Log.w("AudioModule",
                        "⚠️  Could not get JSI runtime pointer — JSI not available")
                }
            } catch (e: Exception) {
                android.util.Log.e("AudioModule", "JSI install failed: ${e.message}")
            }
        }
    }

    // ── Permission check ──────────────────────────────────────────────
    val hasMicPermission: Boolean
        get() = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

    // ── Audio pipeline control ────────────────────────────────────────
    fun start(): Boolean {
        if (!hasMicPermission) return false
        return nativeStart()
    }
    fun stop()              = nativeStop()
    fun isRunning(): Boolean= nativeIsRunning()

    // ── DSP parameter setters (async bridge path) ─────────────────────
    fun setEqBandGain(band: Int, gainDbL: Float, gainDbR: Float) =
        nativeSetEqBandGain(band, gainDbL, gainDbR)

    /** Fitted band gains in dB GAIN (never dB HL), 6 per ear. The engine clamps again. */
    fun setBandGains(leftGains: FloatArray, rightGains: FloatArray) {
        require(leftGains.size == 6 && rightGains.size == 6)
        nativeSetBandGains(leftGains, rightGains)
    }

    fun setBypass(on: Boolean) = nativeSetBypass(on)
    fun setMuted(on: Boolean)  = nativeSetMuted(on)

    fun setMasterVolume(linear: Float)         = nativeSetMasterVolume(linear)
    fun setFeedbackSuppression(enabled: Boolean) = nativeSetFeedbackSuppression(enabled)

    // ── Metering ──────────────────────────────────────────────────────
    fun getInputLevelDb():  Float = nativeGetInputLevelDb()
    fun getOutputLevelDb(): Float = nativeGetOutputLevelDb()

    // ── Native JNI declarations ───────────────────────────────────────
    private external fun nativeInstallJSI(jsiRuntimePtr: Long)   // ← Phase 4 JSI
    private external fun nativeStart(): Boolean
    private external fun nativeStop()
    private external fun nativeIsRunning(): Boolean
    private external fun nativeSetEqBandGain(band: Int, gainL: Float, gainR: Float)
    private external fun nativeSetBandGains(leftGains: FloatArray, rightGains: FloatArray)
    private external fun nativeSetBypass(on: Boolean)
    private external fun nativeSetHeadsetConnected(connected: Boolean)
    private external fun nativeSetMuted(on: Boolean)
    private external fun nativeSetMasterVolume(linear: Float)
    private external fun nativeSetFeedbackSuppression(enabled: Boolean)
    private external fun nativeGetInputLevelDb(): Float
    private external fun nativeGetOutputLevelDb(): Float
}
