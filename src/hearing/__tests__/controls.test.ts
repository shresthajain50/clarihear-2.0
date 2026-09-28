import {CONTROLS, CONTROLS_VERSION, MODE_PRESETS, applyListeningControls} from '../controls';
import {FITTING_LIMITS, FITTING_VERSION, fitHearingProfile} from '../fitting';
import {BAND_GAIN_RANGE_DB, dbHL, type FrequencyThresholds} from '../types';

const ear = (...hl: number[]) => hl.map(dbHL) as unknown as FrequencyThresholds;
const fitted = (h: FrequencyThresholds) => {
  const r = fitHearingProfile({left: h, right: h, source: 'audiogram_import', confidence: 1, fittingVersion: FITTING_VERSION}, {firstFit: false});
  if (r.kind !== 'fitted') throw new Error('fixture must fit');
  return r.dsp;
};
const base = fitted(ear(30, 35, 40, 45, 50, 55));
const neutral = {clarity: 0, background: 0, loudness: 0};

describe('listening controls → bounded DSP offsets', () => {
  it('everyday + neutral controls leave the fitted gains untouched', () => {
    const out = applyListeningControls(base, 'everyday', neutral);
    expect(out.bandGainsLeft).toEqual(base.bandGainsLeft);
    expect(out).toMatchObject({mode: 'everyday', controlsVersion: CONTROLS_VERSION, fittingVersion: FITTING_VERSION});
  });

  it('more clarity raises high bands, never low bands', () => {
    const out = applyListeningControls(base, 'everyday', {...neutral, clarity: 1});
    expect(out.bandGainsLeft[4] - base.bandGainsLeft[4]).toBeGreaterThan(0);
    expect(out.bandGainsLeft[0]).toBe(base.bandGainsLeft[0]);
  });

  it('less background cuts low-frequency gain', () => {
    const out = applyListeningControls(base, 'everyday', {...neutral, background: -1});
    expect(out.bandGainsLeft[0]).toBeLessThan(base.bandGainsLeft[0] + 1e-9);
    expect(out.bandGainsLeft[1]).toBeLessThan(base.bandGainsLeft[1]);
    expect(out.bandGainsLeft[4]).toBe(base.bandGainsLeft[4]);
  });

  it('never moves any band more than ±maxUserOffsetDb from the fit, even with every control and mode maxed', () => {
    for (const mode of ['everyday', 'conversation', 'quiet'] as const)
      for (const c of [-1, 1])
        for (const b of [-1, 1])
          for (const l of [0, 1]) {
            const out = applyListeningControls(base, mode, {clarity: c, background: b, loudness: l});
            out.bandGainsLeft.forEach((g, i) => {
              expect(Math.abs(g - base.bandGainsLeft[i])).toBeLessThanOrEqual(CONTROLS.maxUserOffsetDb + 1e-9);
              expect(g).toBeLessThanOrEqual(FITTING_LIMITS.maxBandGainDb);
              expect(g).toBeGreaterThanOrEqual(BAND_GAIN_RANGE_DB.min);
            });
          }
  });

  it('still respects the Level-2 ceiling when the fit is already near it', () => {
    const loud = fitted(ear(50, 55, 55, 55, 55, 60));
    const out = applyListeningControls(loud, 'conversation', {clarity: 1, background: 1, loudness: 1});
    for (const g of [...out.bandGainsLeft, ...out.bandGainsRight]) expect(g).toBeLessThanOrEqual(FITTING_LIMITS.maxBandGainDb);
  });

  it('clamps out-of-range and non-finite control values', () => {
    const wild = applyListeningControls(base, 'everyday', {clarity: 50, background: -Infinity, loudness: NaN});
    const max = applyListeningControls(base, 'everyday', {clarity: 1, background: 0, loudness: 0});
    expect(wild.bandGainsLeft[4]).toBe(max.bandGainsLeft[4]);
    expect(wild.bandGainsLeft.every(Number.isFinite)).toBe(true);
  });

  it('modes differ: conversation trims low frequencies, quiet compresses more gently', () => {
    const conv = applyListeningControls(base, 'conversation', neutral);
    const quiet = applyListeningControls(base, 'quiet', neutral);
    expect(conv.bandGainsLeft[0]).toBeLessThanOrEqual(base.bandGainsLeft[0]);
    expect(conv.bandGainsLeft[1]).toBeLessThan(base.bandGainsLeft[1]);
    expect(quiet.compression.ratio).toBeLessThan(base.compression.ratio);
    expect(MODE_PRESETS.everyday).toEqual({clarity: 0, background: 0, loudness: 0, compressionRatio: base.compression.ratio});
  });

  it('keeps left and right independent', () => {
    const asym = {...base, bandGainsRight: fitted(ear(20, 20, 30, 30, 30, 30)).bandGainsRight};
    const out = applyListeningControls(asym, 'everyday', {...neutral, loudness: 1});
    expect(out.bandGainsRight).not.toEqual(out.bandGainsLeft);
  });
});
