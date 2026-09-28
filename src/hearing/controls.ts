// Consumer listening controls → bounded DSP offsets (PRD §15, §16, §21).
// Users never see EQ or compression: Clarity, Background, Loudness and a mode are
// translated here into small, bounded changes around the FITTED profile.
// All numbers are provisional (docs/product/OPEN_QUESTIONS.md Q9).

import {FITTING_LIMITS} from './fitting';
import {BAND_GAIN_RANGE_DB, type BandGains, type DspProfile, type ListeningMode} from './types';

export const CONTROLS_VERSION = 'clarihear-controls-0.1.0';

export const CONTROLS = {
  /** Q3: user adjustment is ±6 dB total around the fitted profile, per band. */
  maxUserOffsetDb: 6,
  /** Clarity −1..+1 → high-frequency tilt; weight per band (250 … 8k) × clarityDb. */
  clarityDb: 4,
  clarityWeights: [0, 0, 0, 0.5, 1, 1],
  /** Background −1 (less) .. +1 (more) → low-frequency gain; weight per band × backgroundDb. */
  backgroundDb: 6,
  backgroundWeights: [1, 1, 0.5, 0, 0, 0],
  /** Loudness 0 (comfortable) .. 1 (stronger) → broadband boost. */
  loudnessDb: 4,
} as const;

export interface ListeningControls {
  clarity: number;
  background: number;
  loudness: number;
}

/** Each mode is a bias added to the user's controls (before clamping) plus a WDRC ratio. */
export const MODE_PRESETS: Record<ListeningMode, ListeningControls & {compressionRatio: number}> = {
  everyday: {clarity: 0, background: 0, loudness: 0, compressionRatio: 2},
  conversation: {clarity: 0.5, background: -0.5, loudness: 0, compressionRatio: 2},
  quiet: {clarity: 0, background: 0, loudness: 0, compressionRatio: 1.5},
};

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);

export type AdjustedDspProfile = DspProfile & {controlsVersion: string};

export function applyListeningControls(fit: DspProfile, mode: ListeningMode, user: ListeningControls): AdjustedDspProfile {
  const preset = MODE_PRESETS[mode];
  const clarity = clamp(clamp(user.clarity, -1, 1) + preset.clarity, -1, 1);
  const background = clamp(clamp(user.background, -1, 1) + preset.background, -1, 1);
  const loudness = clamp(clamp(user.loudness, 0, 1) + preset.loudness, 0, 1);

  const c = CONTROLS;
  const adjust = (gains: BandGains) =>
    gains.map((g, i) => {
      const offset = clarity * c.clarityDb * c.clarityWeights[i] + background * c.backgroundDb * c.backgroundWeights[i] + loudness * c.loudnessDb;
      const bounded = clamp(offset, -c.maxUserOffsetDb, c.maxUserOffsetDb);
      return clamp(g + bounded, BAND_GAIN_RANGE_DB.min, FITTING_LIMITS.maxBandGainDb);
    }) as unknown as BandGains;

  return {
    ...fit,
    bandGainsLeft: adjust(fit.bandGainsLeft),
    bandGainsRight: adjust(fit.bandGainsRight),
    compression: {...fit.compression, ratio: preset.compressionRatio},
    mode,
    controlsVersion: CONTROLS_VERSION,
  };
}
