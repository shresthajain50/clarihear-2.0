// ============================================================
//  ClarihearAudio.ts  —  TypeScript API Layer (Phase 4)
//
//  This module is the ONLY way the React Native UI interacts
//  with the audio engine. All other layers are implementation details.
//
//  Architecture:
//    UI Component → ClarihearAudio.setEqBandGain(band, l, r)
//                 → global.clarihear.setEqBandGain(band, l, r)  [JSI — sync]
//                 → C++ AudioEngine::setEqBandGain()             [~200ns]
//                 → pending-value field picked up by audio thread [<1ms]
//
//  Fallback path (no JSI, e.g. debug/old-arch):
//    → ClarihearNativeModule.setEqBandGain()  [async bridge, ~16ms]
//
//  The UI never needs to know which path is taken.
// ============================================================

import {NativeModules} from 'react-native';
import type {Audiogram, CompressorParams, EqBand} from './types';

// ── Frequency bands (Hz) for each EQ band index ──────────────
export const EQ_FREQUENCIES: Record<EqBand, number> = {
  0: 250,
  1: 500,
  2: 1000,
  3: 2000,
  4: 4000,
  5: 8000,
};

// ── Access the JSI host object ────────────────────────────────
// global.clarihear is installed by ClarihearJSI.mm/ClarihearJSI.cpp
// before the JS bundle executes. If it's undefined, we fell back to
// the async NativeModule bridge (which is still functional, just slower).
const jsi = global.clarihear;

// Async bridge fallback (Phase 3 path — always available)
const nativeBridge = NativeModules.ClarihearAudio;

// ── Internal: dispatch to JSI if available, else async bridge ─
function callSync<T>(
  jsiMethod: ((jsi: NonNullable<typeof global.clarihear>) => T) | undefined,
  fallback: () => void,
): T | undefined {
  if (jsi && jsiMethod) {
    return jsiMethod(jsi);
  }
  fallback();
  return undefined;
}

// ============================================================
//  Public API
// ============================================================

/**
 * Start the mic→DSP→speaker pipeline.
 * Requests microphone permission if needed.
 * @returns true on success
 */
export async function startAudio(): Promise<boolean> {
  if (jsi) {
    try {
      return await jsi.startAudio();
    } catch (e) {
      console.warn('[ClarihearAudio] JSI startAudio failed:', e);
      return false;
    }
  }
  // Async bridge fallback
  try {
    return await nativeBridge?.start?.();
  } catch {
    return false;
  }
}

/**
 * Stop the audio pipeline. Safe to call multiple times.
 */
export function stopAudio(): void {
  if (jsi) {
    jsi.stopAudio();
  } else {
    nativeBridge?.stop?.();
  }
}

/**
 * Set the master output volume.
 * @param linear — 0.0 (mute) to 1.0 (full volume)
 *
 * ★ SYNCHRONOUS via JSI — call on every slider frame change.
 *    The latency from JS call to audio change: ~200ns.
 */
export function setMasterVolume(linear: number): void {
  callSync(
    jsi => jsi.setMasterVolume(Math.max(0, Math.min(1, linear))),
    () => nativeBridge?.setMasterVolume?.(linear),
  );
}

/**
 * Set the EQ gain for a single frequency band.
 * @param band      — EQ band index (0=250Hz … 5=8kHz)
 * @param gainDbL   — Left ear gain in dB (e.g. audiogram threshold value)
 * @param gainDbR   — Right ear gain in dB
 *
 * ★ SYNCHRONOUS via JSI — THE latency-critical call.
 *    Called on every slider drag frame at 60fps.
 *    Execution time: ~200 nanoseconds (JSI) vs ~16ms (async bridge).
 */
export function setEqBandGain(
  band: EqBand,
  gainDbL: number,
  gainDbR: number,
): void {
  callSync(
    jsi => jsi.setEqBandGain(band, gainDbL, gainDbR),
    () => nativeBridge?.setEqBandGain?.(band, gainDbL, gainDbR),
  );
}

/**
 * Apply a full audiogram result in one call.
 * The DSP engine will immediately update all 6 EQ bands per ear.
 *
 * @param audiogram — {left: [6 dB HL values], right: [6 dB HL values]}
 *
 * Example: if the user has 40 dB HL loss at 4kHz in the left ear,
 * pass left[4] = 40. The engine applies +40 dB boost at 4kHz.
 */
export function applyAudiogram(audiogram: Audiogram): void {
  const {left, right} = audiogram;
  if (jsi) {
    jsi.applyAudiogram([...left], [...right]);
  } else {
    nativeBridge?.applyAudiogram?.(left, right);
  }
}

/**
 * Set compressor parameters for the WDRC (Wide Dynamic Range Compression).
 * ★ SYNCHRONOUS via JSI.
 */
export function setCompressorParams(params: CompressorParams): void {
  callSync(
    jsi => jsi.setCompressorParams(params),
    () => {/* async bridge doesn't have this yet */},
  );
}

/**
 * Enable or disable acoustic feedback suppression (AFC).
 * ★ SYNCHRONOUS via JSI.
 */
export function setFeedbackSuppression(enabled: boolean): void {
  callSync(
    jsi => jsi.setFeedbackSuppression(enabled),
    () => nativeBridge?.setFeedbackSuppression?.(enabled),
  );
}

/**
 * Get the current input level in dBFS.
 * Returns -96 (silence) if audio is not running.
 * ★ SYNCHRONOUS — safe to call in requestAnimationFrame at 60fps.
 */
export function getInputLevel(): number {
  return jsi ? jsi.getInputLevel() : -96;
}

/**
 * Get the current output level in dBFS.
 * ★ SYNCHRONOUS.
 */
export function getOutputLevel(): number {
  return jsi ? jsi.getOutputLevel() : -96;
}

/**
 * Indicates whether the JSI host object is installed and available.
 * If false, the async bridge fallback is being used (higher latency).
 */
export function isJSIAvailable(): boolean {
  return jsi !== undefined;
}

/**
 * Get the Hz frequency for a band index.
 */
export function getBandHz(band: EqBand): number {
  return EQ_FREQUENCIES[band];
}

// ── Default compressor preset for clinical hearing aid use ────
export const DEFAULT_COMPRESSOR: CompressorParams = {
  thresholdDb:  -40,
  ratio:          4,
  kneeDb:         6,
  attackMs:       5,
  releaseMs:    100,
  makeupGainDb:  20,
};
