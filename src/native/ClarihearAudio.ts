// ============================================================
//  ClarihearAudio.ts  —  the only way the UI talks to the audio engine.
//
//    UI → ClarihearAudio → global.clarihear (JSI, sync) → C++ AudioEngine setters
//                        ↘ NativeModules.ClarihearAudio (async bridge fallback, iOS)
//  Setters publish through the engine's lock-free mailbox; JS never touches the
//  audio thread (PRD §50).
//
//  Consumer API: applyDspProfile, volume, bypass, mute, start/stop, meters.
//  Raw EQ / compressor / AFC live in `developer` only (ENGINEERING_SKILL rule 7).
//  Gains are GainDb: thresholds (DbHL) can't be passed here, only fitted profiles.
// ============================================================

import {NativeModules} from 'react-native';
import type {CompressorParams, EqBand} from './types';
import {gainDb, type DspProfile, type GainDb} from '../hearing/types';

export const EQ_FREQUENCIES: Record<EqBand, number> = {0: 250, 1: 500, 2: 1000, 3: 2000, 4: 4000, 5: 8000};

// Installed by ClarihearJSI (iOS) / AudioModule.installFromContext (Android) before the bundle runs.
const jsi = global.clarihear;
const nativeBridge = NativeModules.ClarihearAudio;

export async function startAudio(): Promise<boolean> {
  try {
    return jsi ? await jsi.startAudio() : Boolean(await nativeBridge?.start?.());
  } catch (e) {
    console.warn('[ClarihearAudio] startAudio failed:', e);
    return false;
  }
}

export function stopAudio(): void {
  if (jsi) jsi.stopAudio();
  else nativeBridge?.stop?.();
}

/** Output volume, linear 0..1 (only ever attenuates). Non-finite → 0. */
export function setMasterVolume(linear: number): void {
  const v = Number.isFinite(linear) ? Math.max(0, Math.min(1, linear)) : 0;
  if (jsi) jsi.setMasterVolume(v);
  else nativeBridge?.setMasterVolume?.(v);
}

/** Apply a fitted profile from hearing/fitting.ts. The engine clamps everything again. */
export function applyDspProfile(dsp: DspProfile): void {
  const left = [...dsp.bandGainsLeft];
  const right = [...dsp.bandGainsRight];
  const {thresholdDbfs, ratio, kneeDb, attackMs, releaseMs} = dsp.compression;
  const comp: CompressorParams = {thresholdDb: thresholdDbfs, ratio, kneeDb, attackMs, releaseMs, makeupGainDb: 0};
  if (jsi) {
    jsi.setBandGains(left, right);
    jsi.setCompressorParams(comp);
  } else {
    nativeBridge?.setBandGains?.(left, right);
  }
}

/** Unprocessed passthrough (still output-limited). */
export function setBypass(on: boolean): void {
  if (jsi) jsi.setBypass(on);
  else nativeBridge?.setBypass?.(on);
}

/** Instant silence. Wins over everything. */
export function setMuted(on: boolean): void {
  if (jsi) jsi.setMuted(on);
  else nativeBridge?.setMuted?.(on);
}

/** Samples the Level-1 limiter has reduced; a rising count drives the PRD §52 message. */
export function getLimiterEngagedCount(): number {
  return jsi ? jsi.getLimiterEngagedCount() : 0;
}

export function getInputLevel(): number {
  return jsi ? jsi.getInputLevel() : -96;
}

export function getOutputLevel(): number {
  return jsi ? jsi.getOutputLevel() : -96;
}

export function isJSIAvailable(): boolean {
  return jsi !== undefined;
}

export function getBandHz(band: EqBand): number {
  return EQ_FREQUENCIES[band];
}

/** Developer mode only. Never reachable from consumer screens. */
export const developer = {
  setEqBandGain(band: EqBand, left: GainDb, right: GainDb): void {
    const l = gainDb(left);
    const r = gainDb(right);
    if (jsi) jsi.setEqBandGain(band, l, r);
    else nativeBridge?.setEqBandGain?.(band, l, r);
  },
  setCompressorParams(params: CompressorParams): void {
    jsi?.setCompressorParams(params);
  },
  /** Prototype only: NOT feedback cancellation (PRD §24). Off by default. */
  setFeedbackSuppression(enabled: boolean): void {
    if (jsi) jsi.setFeedbackSuppression(enabled);
    else nativeBridge?.setFeedbackSuppression?.(enabled);
  },
};

/** Engineering placeholder compressor for developer mode (NOT a clinical prescription, PRD §6 issue 5). */
export const DEFAULT_COMPRESSOR: CompressorParams = {
  thresholdDb: -40,
  ratio: 2,
  kneeDb: 6,
  attackMs: 5,
  releaseMs: 100,
  makeupGainDb: 0,
};
