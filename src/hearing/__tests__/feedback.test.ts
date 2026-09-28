import {FEEDBACK, FEEDBACK_VERSION, nudgeControls, type Ratings} from '../feedback';
import {CONTROLS, applyListeningControls} from '../controls';
import {FITTING_VERSION, fitHearingProfile} from '../fitting';
import {dbHL, type FrequencyThresholds} from '../types';

const neutral = {clarity: 0, background: 0, loudness: 0};
const ok: Ratings = {clarity: 4, comfort: 4, background_noise: 4, effort: 4};

describe('feedback loop (PRD §21, §28)', () => {
  it('good ratings change nothing', () => {
    expect(nudgeControls(neutral, ok)).toEqual({controls: neutral, changed: [], version: FEEDBACK_VERSION});
  });

  it('unclear speech (comfortable) → one small clarity step up', () => {
    const r = nudgeControls(neutral, {...ok, clarity: 2});
    expect(r.controls.clarity).toBeCloseTo(FEEDBACK.step);
    expect(r.changed).toEqual(['clarity']);
  });

  it('discomfort always wins and only ever reduces', () => {
    const start = {clarity: 0.5, background: 0.5, loudness: 0.5};
    const r = nudgeControls(start, {clarity: 1, comfort: 1, background_noise: 1, effort: 1});
    expect(r.controls.loudness).toBeLessThan(start.loudness);
    expect(r.controls.clarity).toBeLessThanOrEqual(start.clarity);
    expect(r.controls.background).toBeLessThanOrEqual(start.background);
  });

  it('too much background noise (comfortable) → less background', () => {
    expect(nudgeControls(neutral, {...ok, background_noise: 2}).controls.background).toBeCloseTo(-FEEDBACK.step);
  });

  it('repeated "not clear" converges at the control bound; applied gain never exceeds ±6 dB of the fit', () => {
    const h = [30, 35, 40, 45, 50, 55].map(dbHL) as unknown as FrequencyThresholds;
    const fit = fitHearingProfile({left: h, right: h, source: 'audiogram_import', confidence: 1, fittingVersion: FITTING_VERSION});
    if (fit.kind !== 'fitted') throw new Error('fixture');
    let c = neutral;
    for (let i = 0; i < 100; i++) c = nudgeControls(c, {...ok, clarity: 1}).controls;
    expect(c.clarity).toBe(1);
    const out = applyListeningControls(fit.dsp, 'everyday', c);
    out.bandGainsLeft.forEach((g, i) => expect(Math.abs(g - fit.dsp.bandGainsLeft[i])).toBeLessThanOrEqual(CONTROLS.maxUserOffsetDb));
  });

  it('never raises loudness from feedback (volume is the user\'s own control)', () => {
    let c = neutral;
    for (let i = 0; i < 20; i++) c = nudgeControls(c, {clarity: 1, comfort: 5, background_noise: 1, effort: 1}).controls;
    expect(c.loudness).toBe(0);
  });

  it.each([0, 6, NaN, 2.5])('rejects rating %p outside 1..5 integers', bad => {
    expect(() => nudgeControls(neutral, {...ok, comfort: bad})).toThrow(/1\.\.5/);
  });
});
