// Fitting engine: audiogram (dB HL) → bounded, smoothed, versioned band gains.
// The ONLY producer of band gains in the app (PRD §20, §46 Personalization).
//
// Rule: NAL-R (Byrne & Dillon 1986), a published, non-proprietary insertion-gain rule,
// used here as a *research* reference. This is NOT NAL-NL2 or DSL v5 and not a clinical
// prescription. All constants are provisional pending audiologist review
// (docs/product/OPEN_QUESTIONS.md Q2, Q3, Q5).

import {
  BAND_COUNT,
  BAND_GAIN_RANGE_DB,
  type BandGains,
  type CompressionProfile,
  type DspProfile,
  type FrequencyThresholds,
  type GainDb,
  type HearingProfile,
} from './types';

export const FITTING_VERSION = 'clarihear-research-0.1.0';

export const FITTING_LIMITS = {
  /** Level 2 per-band ceiling; must equal kMaxBandGainDb in cpp/GainConstraints.h. */
  maxBandGainDb: BAND_GAIN_RANGE_DB.max,
  /** Thresholds at or below this get no gain. */
  gainOnsetDbHL: 20,
  /** Acclimatization: first-time users start at this fraction of the target. */
  firstFitFactor: 0.6,
  maxInterBandStepDb: 8,
  /** Valid audiogram input range. */
  minThresholdDbHL: -10,
  maxThresholdDbHL: 120,
} as const;

/** Self-fit eligibility (PRD §3: mild-to-moderate only; asymmetric → professional). */
export const REFERRAL_CRITERIA = {
  /** 4-frequency average (500/1k/2k/4k) above this → beyond self-fit range. */
  maxPta4DbHL: 55,
  /** Any single threshold at 500–4k above this → beyond self-fit range. */
  maxSingleThresholdDbHL: 70,
  /** Any threshold at ANY frequency (incl. 250 Hz, 8 kHz) at or above this → beyond self-fit range. */
  maxAnyThresholdDbHL: 90,
  /** Inter-ear difference ≥ this at any one frequency → asymmetric. */
  asymmetrySingleDb: 20,
  /** …or ≥ this at two or more frequencies. */
  asymmetryPairDb: 15,
} as const;

/** Gentle WDRC placeholder (PRD §22). Never presented as clinical. */
export const PLACEHOLDER_COMPRESSION: CompressionProfile = {
  source: 'engineering_placeholder',
  thresholdDbfs: -40,
  ratio: 2,
  kneeDb: 6,
  attackMs: 5,
  releaseMs: 100,
};

// NAL-R frequency corrections k(f) at 250/500/1k/2k/4k/8k. 8k reuses the 6k value (-2),
// since NAL-R is only published to 6 kHz.
const NAL_R_K = [-17, -8, 1, -1, -2, -2] as const;

export type ReferralReason = 'beyond_self_fit_range' | 'asymmetric';
export type FitResult = {kind: 'fitted'; dsp: DspProfile} | {kind: 'refer'; reasons: ReferralReason[]};

export interface FitOptions {
  /** First-time users get reduced gain (PRD §20). Defaults to true: the conservative choice. */
  firstFit?: boolean;
}

/** Raw NAL-R insertion gain (dB), unbounded. Exported for tests/research only; use fitHearingProfile. */
export function nalRInsertionGain(h: FrequencyThresholds): number[] {
  const x = 0.05 * (h[1] + h[2] + h[3]);
  return h.map((t, i) => x + 0.31 * t + NAL_R_K[i]);
}

export function fitHearingProfile(profile: HearingProfile, opts: FitOptions = {}): FitResult {
  validate(profile.left, 'left');
  validate(profile.right, 'right');

  const reasons = referralReasons(profile.left, profile.right);
  if (reasons.length) return {kind: 'refer', reasons};

  const factor = opts.firstFit === false ? 1 : FITTING_LIMITS.firstFitFactor;
  return {
    kind: 'fitted',
    dsp: {
      bandGainsLeft: fitEar(profile.left, factor),
      bandGainsRight: fitEar(profile.right, factor),
      compression: PLACEHOLDER_COMPRESSION,
      outputLimit: {ceilingDbfs: -1, maxGainDb: FITTING_LIMITS.maxBandGainDb, acousticCeilingCalibrated: false},
      mode: 'everyday',
      fittingVersion: FITTING_VERSION,
    },
  };
}

function fitEar(h: FrequencyThresholds, factor: number): BandGains {
  const {maxBandGainDb, gainOnsetDbHL, maxInterBandStepDb} = FITTING_LIMITS;
  const g = nalRInsertionGain(h).map((ig, i) =>
    h[i] <= gainOnsetDbHL ? 0 : Math.min(maxBandGainDb, Math.max(0, ig * factor)),
  );
  // Smooth by lowering whichever neighbour exceeds the step. Never raises gain.
  for (let i = 1; i < g.length; i++) g[i] = Math.min(g[i], g[i - 1] + maxInterBandStepDb);
  for (let i = g.length - 2; i >= 0; i--) g[i] = Math.min(g[i], g[i + 1] + maxInterBandStepDb);
  if (!g.every(v => Number.isFinite(v) && v >= 0 && v <= maxBandGainDb)) throw new Error('fitting produced out-of-bounds gain');
  return g as unknown as BandGains & GainDb[];
}

function validate(h: FrequencyThresholds, side: string) {
  if (!Array.isArray(h) || h.length !== BAND_COUNT) {
    throw new RangeError(`${side} ear: expected ${BAND_COUNT} thresholds`);
  }
  const {minThresholdDbHL: lo, maxThresholdDbHL: hi} = FITTING_LIMITS;
  // Index loop, not forEach: forEach skips holes, so [20, , 20, …] would pass and fit to NaN.
  for (let i = 0; i < BAND_COUNT; i++) {
    const t = h[i];
    if (typeof t !== 'number' || !Number.isFinite(t) || t < lo || t > hi) {
      throw new RangeError(`${side} ear: threshold[${i}] = ${t} dB HL is outside ${lo}..${hi}`);
    }
  }
}

function referralReasons(l: FrequencyThresholds, r: FrequencyThresholds): ReferralReason[] {
  const c = REFERRAL_CRITERIA;
  const reasons: ReferralReason[] = [];
  const pta4 = (h: FrequencyThresholds) => (h[1] + h[2] + h[3] + h[4]) / 4;
  const severe = (h: FrequencyThresholds) =>
    pta4(h) > c.maxPta4DbHL ||
    h.slice(1, 5).some(t => t > c.maxSingleThresholdDbHL) ||
    h.some(t => t >= c.maxAnyThresholdDbHL);
  if (severe(l) || severe(r)) reasons.push('beyond_self_fit_range');

  const diffs = l.map((t, i) => Math.abs(t - r[i]));
  if (diffs.some(d => d >= c.asymmetrySingleDb) || diffs.filter(d => d >= c.asymmetryPairDb).length >= 2) {
    reasons.push('asymmetric');
  }
  return reasons;
}
