// Digits-in-Noise screening engine (PRD §12, §36). Pure logic, no React, no audio:
// it owns the trial sequence, seeded randomisation, adaptive SNR, scoring and completion.
// The audio layer reads getProgress().current and plays that triplet at that SNR.
//
// Protocol: De Sousa et al. 2020/2022 antiphasic smartphone DIN (Ear Hear 41:442, 43:1037),
// PROVISIONAL (docs/product/OPEN_QUESTIONS.md Q1 addendum, research/protocols/).
// No pass/refer: published cut-offs belong to their recordings, so results are
// 'unvalidated' until licensed/validated stimuli and matching norms exist (Q6).

export const DIN_PROTOCOL = {
  id: 'desousa-2022-antiphasic',
  version: '0.1.0-provisional',
  presentation: 'antiphasic',
  triplets: 23,
  startSnrDb: 0,
  /** The first `initialSteps` adaptive steps are −initialDownDb when correct / +initialUpDb when wrong. */
  initialSteps: 3,
  initialDownDb: 4,
  initialUpDb: 2,
  /** Then plain 1-up/1-down. */
  stepDb: 2,
  /** SRT = mean SNR of the last N presented triplets (no virtual extra trial). */
  srtLastN: 19,
  digits: '0123456789',
  // Engineering bounds (not part of the published protocol) so a runaway track stays audible and safe.
  minSnrDb: -30,
  maxSnrDb: 20,
} as const;

export const SCREENING_DISCLAIMER = 'This screening does not diagnose hearing loss.';

export interface ScreeningConfig {
  seed: number;
  now?: () => Date;
}

export interface DinTrial {
  triplet: string;
  snrDb: number;
  response: string;
  correct: boolean;
}

export interface ScreeningProgress {
  trial: number;
  total: number;
  done: boolean;
  cancelled: boolean;
  /** What to present next; undefined when done or cancelled. */
  current?: {triplet: string; snrDb: number};
}

export type ScreeningFlag = 'snr_at_upper_bound' | 'snr_at_lower_bound';

export interface ScreeningResult {
  protocolId: string;
  protocolVersion: string;
  seed: number;
  srtDb: number;
  trials: DinTrial[];
  flags: ScreeningFlag[];
  classification: 'unvalidated';
  disclaimer: typeof SCREENING_DISCLAIMER;
  completedAt: string;
}

export interface HearingScreeningEngine {
  start(config: ScreeningConfig): Promise<void>;
  submitResponse(response: string): void;
  getProgress(): ScreeningProgress;
  finish(): ScreeningResult;
  cancel(): void;
}

/** mulberry32: tiny seeded PRNG, identical sequence on every JS engine. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class DinScreeningEngine implements HearingScreeningEngine {
  private p = DIN_PROTOCOL;
  private seed = 0;
  private now: () => Date = () => new Date();
  private rand = mulberry32(0);
  private trials: DinTrial[] = [];
  private current?: {triplet: string; snrDb: number};
  private running = false;
  private cancelled = false;

  async start(config: ScreeningConfig): Promise<void> {
    this.seed = config.seed;
    this.now = config.now ?? (() => new Date());
    this.rand = mulberry32(config.seed);
    this.trials = [];
    this.running = true;
    this.cancelled = false;
    this.current = {triplet: this.nextTriplet(), snrDb: this.p.startSnrDb};
  }

  submitResponse(response: string): void {
    if (!this.running || !this.current) throw new Error('DIN screening is not running');
    if (!/^[0-9]{3}$/.test(response)) throw new RangeError('response must be exactly 3 digits');

    const {triplet, snrDb} = this.current;
    const correct = response === triplet;
    this.trials.push({triplet, snrDb, response, correct});

    if (this.trials.length >= this.p.triplets) {
      this.running = false;
      this.current = undefined;
      return;
    }
    const initial = this.trials.length <= this.p.initialSteps;
    const step = correct ? -(initial ? this.p.initialDownDb : this.p.stepDb) : initial ? this.p.initialUpDb : this.p.stepDb;
    const next = Math.min(this.p.maxSnrDb, Math.max(this.p.minSnrDb, snrDb + step));
    this.current = {triplet: this.nextTriplet(), snrDb: next};
  }

  getProgress(): ScreeningProgress {
    return {
      trial: this.trials.length,
      total: this.p.triplets,
      done: !this.running && !this.cancelled && this.trials.length === this.p.triplets,
      cancelled: this.cancelled,
      current: this.current && {...this.current},
    };
  }

  finish(): ScreeningResult {
    if (this.cancelled || this.trials.length !== this.p.triplets) throw new Error('DIN screening is not complete');
    const lastN = this.trials.slice(-this.p.srtLastN).map(t => t.snrDb);
    const flags: ScreeningFlag[] = [];
    if (lastN.some(s => s >= this.p.maxSnrDb)) flags.push('snr_at_upper_bound');
    if (lastN.some(s => s <= this.p.minSnrDb)) flags.push('snr_at_lower_bound');
    return {
      protocolId: this.p.id,
      protocolVersion: this.p.version,
      seed: this.seed,
      srtDb: lastN.reduce((a, b) => a + b, 0) / lastN.length,
      trials: this.trials.map(t => ({...t})),
      flags,
      classification: 'unvalidated',
      disclaimer: SCREENING_DISCLAIMER,
      completedAt: this.now().toISOString(),
    };
  }

  cancel(): void {
    this.running = false;
    this.cancelled = true;
    this.current = undefined;
  }

  // ponytail: random digits, no repeat within a triplet; swap for the licensed 120-triplet list with the stimuli (Q6).
  private nextTriplet(): string {
    const pool = this.p.digits.split('');
    let t = '';
    for (let i = 0; i < 3; i++) t += pool.splice(Math.floor(this.rand() * pool.length), 1)[0];
    return t;
  }
}
