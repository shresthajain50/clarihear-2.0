import * as fs from 'fs';
import * as path from 'path';
import {
  FITTING_LIMITS,
  FITTING_VERSION,
  fitHearingProfile,
  nalRInsertionGain,
} from '../fitting';
import {BAND_GAIN_RANGE_DB, dbHL, type BandGains, type FrequencyThresholds, type HearingProfile} from '../types';

const flat = (hl: number): FrequencyThresholds =>
  [hl, hl, hl, hl, hl, hl].map(dbHL) as unknown as FrequencyThresholds;
const ear = (...hl: number[]): FrequencyThresholds =>
  hl.map(dbHL) as unknown as FrequencyThresholds;

const profile = (left: FrequencyThresholds, right = left): HearingProfile => ({
  left,
  right,
  source: 'audiogram_import',
  confidence: 1,
  fittingVersion: FITTING_VERSION,
});

function fitted(p: HearingProfile, opts?: Parameters<typeof fitHearingProfile>[1]) {
  const r = fitHearingProfile(p, opts);
  if (r.kind !== 'fitted') throw new Error(`expected fitted, got ${JSON.stringify(r)}`);
  return r.dsp;
}

describe('NAL-R reference rule', () => {
  it('matches the published formula for a flat 40 dB HL loss', () => {
    // IG = 0.05*(H500+H1k+H2k) + 0.31*H + k(f); k = -17,-8,+1,-1,-2,-2
    expect(nalRInsertionGain(flat(40))).toEqual(
      [1.4, 10.4, 19.4, 17.4, 16.4, 16.4].map(v => expect.closeTo(v, 5)),
    );
  });
});

describe('fitHearingProfile', () => {
  it('cannot be bypassed at the type level: dB HL is not assignable to band gains', () => {
    const thresholds = flat(40);
    // @ts-expect-error dB HL thresholds must go through fitting before they are gains
    const gains: BandGains = thresholds;
    expect(gains).toBe(thresholds); // runtime no-op; `npx tsc` enforces the line above
  });

  it('never maps dB HL straight to gain (40 dB HL ≠ +40 dB, PRD §6 issue 2)', () => {
    const dsp = fitted(profile(flat(40)));
    for (const g of [...dsp.bandGainsLeft, ...dsp.bandGainsRight]) {
      expect(g).toBeLessThan(40);
      expect(g).toBeLessThanOrEqual(FITTING_LIMITS.maxBandGainDb);
    }
  });

  it('bounds every band by the Level-2 ceiling, whatever the loss', () => {
    const dsp = fitted(profile(flat(55)), {firstFit: false});
    for (const g of dsp.bandGainsLeft) {
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(FITTING_LIMITS.maxBandGainDb);
    }
  });

  it('gives no gain where hearing is within the normal range', () => {
    const dsp = fitted(profile(flat(15)), {firstFit: false});
    expect(dsp.bandGainsLeft).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('is frequency-dependent: a sloping high-frequency loss gets more high-frequency gain', () => {
    const dsp = fitted(profile(ear(20, 25, 30, 45, 55, 55)), {firstFit: false});
    expect(dsp.bandGainsLeft[4]).toBeGreaterThan(dsp.bandGainsLeft[1]);
  });

  it('reduces gain for first-time users', () => {
    const first = fitted(profile(flat(40)), {firstFit: true});
    const experienced = fitted(profile(flat(40)), {firstFit: false});
    const raw = nalRInsertionGain(flat(40));
    expect(first.bandGainsLeft[2]).toBeCloseTo(raw[2] * FITTING_LIMITS.firstFitFactor, 5);
    first.bandGainsLeft.forEach((g, i) => expect(g).toBeLessThanOrEqual(experienced.bandGainsLeft[i]));
    expect(fitted(profile(flat(40))).bandGainsLeft).toEqual(first.bandGainsLeft); // first fit is the default
  });

  it('keeps adjacent bands within the max inter-band step, only ever by lowering gain', () => {
    const raw = nalRInsertionGain(ear(20, 20, 20, 20, 55, 55)); // steep 2k→4k jump
    const dsp = fitted(profile(ear(20, 20, 20, 20, 55, 55)), {firstFit: false});
    const g = dsp.bandGainsLeft;
    for (let i = 1; i < g.length; i++) {
      expect(Math.abs(g[i] - g[i - 1])).toBeLessThanOrEqual(FITTING_LIMITS.maxInterBandStepDb + 1e-9);
    }
    g.forEach((v, i) => expect(v).toBeLessThanOrEqual(Math.max(0, Math.min(raw[i], FITTING_LIMITS.maxBandGainDb)) + 1e-9));
  });

  it('fits left and right ears independently', () => {
    const dsp = fitted(profile(flat(20), flat(30)), {firstFit: false});
    expect(dsp.bandGainsLeft).toEqual([0, 0, 0, 0, 0, 0]);
    expect(dsp.bandGainsRight[2]).toBeGreaterThan(0);
  });

  it('versions the output profile and labels compression defaults as placeholders', () => {
    const dsp = fitted(profile(flat(40)));
    expect(dsp.fittingVersion).toBe(FITTING_VERSION);
    expect(dsp.compression.source).toBe('engineering_placeholder');
    expect(dsp.outputLimit.acousticCeilingCalibrated).toBe(false);
    expect(dsp.mode).toBe('everyday');
  });

  it('refers instead of fitting when a loss is beyond the self-fit range', () => {
    const r = fitHearingProfile(profile(flat(75)));
    expect(r).toEqual({kind: 'refer', reasons: expect.arrayContaining(['beyond_self_fit_range'])});
  });

  it('refers instead of fitting a markedly asymmetric loss', () => {
    const r = fitHearingProfile(profile(flat(15), ear(15, 15, 40, 45, 45, 45)));
    expect(r).toEqual({kind: 'refer', reasons: expect.arrayContaining(['asymmetric'])});
  });

  it.each([NaN, Infinity, -20, 130])('rejects out-of-range or non-finite threshold %p', (bad: number) => {
    const l = ear(20, 20, 20, 20, 20, 20) as unknown as number[];
    l[3] = bad;
    expect(() => fitHearingProfile(profile(l as unknown as FrequencyThresholds))).toThrow(/threshold/i);
  });

  it('rejects a sparse audiogram (holes would otherwise fit to NaN)', () => {
    // eslint-disable-next-line no-sparse-arrays
    const holey = [20, , 20, 20, 20, 20] as unknown as FrequencyThresholds;
    expect(() => fitHearingProfile(profile(holey))).toThrow(/threshold\[1\]/);
  });

  it('refers a loss confined to 250 Hz or 8 kHz once it reaches 90 dB HL', () => {
    expect(fitHearingProfile(profile(ear(20, 25, 30, 40, 50, 90))).kind).toBe('refer');
    expect(fitHearingProfile(profile(ear(90, 20, 20, 20, 20, 20))).kind).toBe('refer');
    expect(fitHearingProfile(profile(ear(20, 25, 30, 40, 50, 85))).kind).toBe('fitted'); // steep presbycusis still self-fits
  });

  it.each([
    ['PTA4 exactly 55 fits', ear(30, 55, 55, 55, 55, 55), 'fitted'],
    ['PTA4 55.25 refers', ear(30, 55, 55, 55, 56, 55), 'refer'],
    ['single 70 at 2k fits', ear(20, 40, 40, 70, 50, 50), 'fitted'],
    ['single 71 at 2k refers', ear(20, 40, 40, 71, 50, 50), 'refer'],
  ])('severity boundary: %s', (_label, h, kind) => {
    expect(fitHearingProfile(profile(h as FrequencyThresholds)).kind).toBe(kind);
  });

  it.each([
    ['19 dB at one frequency fits', ear(30, 30, 30, 30, 30, 30), ear(30, 30, 30, 49, 30, 30), 'fitted'],
    ['20 dB at one frequency refers', ear(30, 30, 30, 30, 30, 30), ear(30, 30, 30, 50, 30, 30), 'refer'],
    ['15 dB at one frequency fits', ear(30, 30, 30, 30, 30, 30), ear(30, 30, 45, 30, 30, 30), 'fitted'],
    ['15 dB at two frequencies refers', ear(30, 30, 30, 30, 30, 30), ear(30, 30, 45, 30, 45, 30), 'refer'],
  ])('asymmetry boundary: %s', (_label, l, r, kind) => {
    expect(fitHearingProfile(profile(l as FrequencyThresholds, r as FrequencyThresholds)).kind).toBe(kind);
  });

  it('every fitted gain is finite and within 0..ceiling across the whole valid audiogram grid', () => {
    let fittedCount = 0;
    for (let a = -10; a <= 120; a += 10)
      for (let b = -10; b <= 120; b += 10)
        for (const firstFit of [true, false]) {
          const r = fitHearingProfile(profile(ear(a, b, a, b, a, b)), {firstFit});
          if (r.kind !== 'fitted') continue;
          fittedCount++;
          for (const g of [...r.dsp.bandGainsLeft, ...r.dsp.bandGainsRight]) {
            expect(Number.isFinite(g) && g >= 0 && g <= FITTING_LIMITS.maxBandGainDb).toBe(true);
          }
        }
    expect(fittedCount).toBeGreaterThan(20);
  });

  it('rejects an audiogram with the wrong number of frequencies', () => {
    expect(() => fitHearingProfile(profile(ear(20, 20, 20)))).toThrow(/6 thresholds/);
  });
});

describe('limits stay in sync with the C++ engine (defence in depth)', () => {
  const header = fs.readFileSync(path.join(__dirname, '../../../cpp/GainConstraints.h'), 'utf8');
  const cpp = (name: string) => Number(new RegExp(`${name}\\s*=\\s*(-?[\\d.]+)f`).exec(header)?.[1]);

  it('uses the same per-band ceiling and floor as GainConstraints.h', () => {
    expect(FITTING_LIMITS.maxBandGainDb).toBe(cpp('kMaxBandGainDb'));
    expect(BAND_GAIN_RANGE_DB).toEqual({min: cpp('kMinBandGainDb'), max: cpp('kMaxBandGainDb')});
    expect(FITTING_LIMITS.maxBandGainDb).toBeLessThanOrEqual(cpp('kMaxTotalGainDb'));
  });
});
