// Bounded adaptation loop (PRD §21, §28): post-listening 1–5 ratings → ONE small step on the
// consumer controls. Discomfort always wins and only reduces; feedback never raises loudness.
// The controls module then clamps everything to ±6 dB around the fit.
// Step sizes and thresholds are provisional (docs/product/OPEN_QUESTIONS.md Q11).

import type {ListeningControls} from './controls';

export const FEEDBACK_VERSION = 'clarihear-feedback-0.1.0';
export const FEEDBACK = {
  /** Step on the −1..+1 control scale (clarity 0.25 ≈ 1 dB HF tilt). */
  step: 0.25,
  /** Ratings at or below this are "a problem". */
  problemAtOrBelow: 2,
} as const;

/** PRD §28 fields, each 1 (worst) … 5 (best). `effort` is recorded, not acted on. */
export interface Ratings {
  clarity: number;
  comfort: number;
  background_noise: number;
  effort: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function nudgeControls(c: ListeningControls, r: Ratings) {
  for (const [k, v] of Object.entries(r)) {
    if (!Number.isInteger(v) || v < 1 || v > 5) throw new RangeError(`${k} rating must be an integer 1..5`);
  }
  const bad = (v: number) => v <= FEEDBACK.problemAtOrBelow;
  const s = FEEDBACK.step;
  const next = {...c};
  const changed: (keyof ListeningControls)[] = [];
  const set = (k: keyof ListeningControls, v: number, lo: number, hi: number) => {
    const nv = clamp(v, lo, hi);
    if (nv !== next[k]) {
      next[k] = nv;
      changed.push(k);
    }
  };

  if (bad(r.comfort)) {
    // Uncomfortable: back off everything that adds gain; never add any.
    set('loudness', next.loudness - s, 0, 1);
    if (next.clarity > 0) set('clarity', next.clarity - s, -1, 1);
    if (next.background > 0) set('background', next.background - s, -1, 1);
  } else {
    if (bad(r.clarity)) set('clarity', next.clarity + s, -1, 1);
    if (bad(r.background_noise)) set('background', next.background - s, -1, 1);
  }
  return {controls: next, changed, version: FEEDBACK_VERSION};
}
