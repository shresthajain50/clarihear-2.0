// ============================================================
//  types.ts  —  ClariHear Native API Types
// ============================================================

/** EQ frequency band index. Maps to: 0=250Hz 1=500Hz 2=1kHz 3=2kHz 4=4kHz 5=8kHz */
export type EqBand = 0 | 1 | 2 | 3 | 4 | 5;

/** Audiogram hearing level per frequency band, in dB HL (0–120). */
export interface Audiogram {
  /** Left ear: hearing threshold per band in dB HL */
  left: [number, number, number, number, number, number];
  /** Right ear: hearing threshold per band in dB HL */
  right: [number, number, number, number, number, number];
}

/** Wide Dynamic Range Compressor parameters. */
export interface CompressorParams {
  /** Threshold below which no compression occurs (dBFS, e.g. -40) */
  thresholdDb: number;
  /** Compression ratio — e.g. 4 means 4:1 (4dB input → 1dB output above threshold) */
  ratio: number;
  /** Soft-knee width in dB — smooth transition between uncompressed/compressed zones */
  kneeDb: number;
  /** Attack time in milliseconds — how fast the compressor engages */
  attackMs: number;
  /** Release time in milliseconds — how fast gain recovers after a loud sound */
  releaseMs: number;
  /** Makeup gain in dB — applied after compression to restore loudness */
  makeupGainDb: number;
}

/** The raw global.clarihear JSI host object interface (do not use directly). */
export interface ClarihearJSI {
  startAudio(): Promise<boolean>;
  stopAudio(): void;
  isRunning(): boolean;
  setMasterVolume(linear: number): void;
  setEqBandGain(band: number, gainDbLeft: number, gainDbRight: number): void;
  setCompressorParams(params: CompressorParams): void;
  setFeedbackSuppression(enabled: boolean): void;
  applyAudiogram(leftGains: number[], rightGains: number[]): void;
  getInputLevel(): number;
  getOutputLevel(): number;
}

// Augment globalThis so TypeScript knows about global.clarihear
declare global {
  // eslint-disable-next-line no-var
  var clarihear: ClarihearJSI | undefined;
}
