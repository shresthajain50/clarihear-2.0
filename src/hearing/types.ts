// Hearing / DSP profile domain types (PRD §22, §35).
//
// dB HL (a hearing threshold) and dB gain (a DSP setting) are different units, and
// confusing them is PRD §6 issue 2. They are branded so the compiler rejects passing
// one where the other is expected: the only way from DbHL to GainDb is fitting.ts.

declare const unit: unique symbol;
export type DbHL = number & {readonly [unit]: 'dB HL'};
export type GainDb = number & {readonly [unit]: 'dB gain'};

export const dbHL = (v: number) => v as DbHL;

/** Per-band gain range the engine accepts (cpp/GainConstraints.h kMinBandGainDb..kMaxBandGainDb). */
export const BAND_GAIN_RANGE_DB = {min: -12, max: 20} as const;

/** The only way to make a GainDb outside fitting (developer UI): clamped, non-finite → 0. */
export const gainDb = (v: number) =>
  (Number.isFinite(v) ? Math.min(BAND_GAIN_RANGE_DB.max, Math.max(BAND_GAIN_RANGE_DB.min, v)) : 0) as GainDb;

/** Audiogram frequencies (Hz), index-aligned with every per-band array. */
export const FREQUENCIES_HZ = [250, 500, 1000, 2000, 4000, 8000] as const;
export const BAND_COUNT = FREQUENCIES_HZ.length;

type Six<T> = readonly [T, T, T, T, T, T];
export type FrequencyThresholds = Six<DbHL>;
export type BandGains = Six<GainDb>;

export interface HearingProfile {
  left: FrequencyThresholds;
  right: FrequencyThresholds;
  source: 'screening' | 'audiogram_import' | 'calibrated_test';
  confidence: number;
  fittingVersion: string;
}

export type ListeningMode = 'everyday' | 'conversation' | 'quiet';

/** WDRC settings. Values are engineering placeholders, not a clinical prescription (PRD §6 issue 5). */
export interface CompressionProfile {
  source: 'engineering_placeholder';
  thresholdDbfs: number;
  ratio: number;
  kneeDb: number;
  attackMs: number;
  releaseMs: number;
}

export interface OutputLimit {
  /** Level 1: digital peak ceiling. */
  ceilingDbfs: number;
  /** Level 2: max DSP gain at any frequency. */
  maxGainDb: number;
  /** Level 3 needs a calibrated transducer; always false until one is supported (PRD §23). */
  acousticCeilingCalibrated: false;
}

export interface DspProfile {
  bandGainsLeft: BandGains;
  bandGainsRight: BandGains;
  compression: CompressionProfile;
  outputLimit: OutputLimit;
  mode: ListeningMode;
  fittingVersion: string;
}
