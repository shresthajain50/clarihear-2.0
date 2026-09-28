import {FITTING_VERSION, fitHearingProfile} from '../../hearing/fitting';
import {dbHL, gainDb, type FrequencyThresholds} from '../../hearing/types';
import type {ClarihearJSI} from '../types';

/** Load ClarihearAudio with a fake global.clarihear (it binds the JSI object at import time). */
function withFakeJsi() {
  const calls: Record<string, unknown[][]> = {};
  const rec = (name: string) => (...args: unknown[]) => void (calls[name] ??= []).push(args);
  const fake = new Proxy({} as ClarihearJSI, {get: (_t, name: string) => rec(name)});
  (globalThis as {clarihear?: ClarihearJSI}).clarihear = fake;
  let mod!: typeof import('../ClarihearAudio');
  jest.isolateModules(() => {
    mod = require('../ClarihearAudio');
  });
  return {mod, calls};
}

const t = [30, 35, 40, 45, 50, 55].map(dbHL) as unknown as FrequencyThresholds;
const fit = fitHearingProfile({left: t, right: t, source: 'audiogram_import', confidence: 1, fittingVersion: FITTING_VERSION});
if (fit.kind !== 'fitted') throw new Error('fixture must fit');

afterEach(() => delete (globalThis as {clarihear?: unknown}).clarihear);

describe('ClarihearAudio bridge', () => {
  it('applyDspProfile sends fitted gains and the placeholder compression, nothing else', () => {
    const {mod, calls} = withFakeJsi();
    mod.applyDspProfile(fit.dsp);
    expect(calls.setBandGains).toEqual([[[...fit.dsp.bandGainsLeft], [...fit.dsp.bandGainsRight]]]);
    expect(calls.setCompressorParams).toEqual([[{
      thresholdDb: -40, ratio: 2, kneeDb: 6, attackMs: 5, releaseMs: 100, makeupGainDb: 0,
    }]]);
    expect(calls.applyAudiogram).toBeUndefined();
  });

  it('exposes bypass, mute and the limiter counter', () => {
    const {mod, calls} = withFakeJsi();
    mod.setBypass(true);
    mod.setMuted(true);
    expect(calls.setBypass).toEqual([[true]]);
    expect(calls.setMuted).toEqual([[true]]);
  });

  it('clamps volume to 0..1 and maps non-finite to 0 before it leaves JS', () => {
    const {mod, calls} = withFakeJsi();
    mod.setMasterVolume(5);
    mod.setMasterVolume(-1);
    mod.setMasterVolume(NaN);
    expect(calls.setMasterVolume).toEqual([[1], [0], [0]]);
  });

  it('keeps raw DSP controls in the developer namespace only', () => {
    const {mod} = withFakeJsi();
    const exported = Object.keys(mod);
    for (const raw of ['setEqBandGain', 'setCompressorParams', 'setFeedbackSuppression', 'applyAudiogram']) {
      expect(exported).not.toContain(raw);
    }
    expect(Object.keys(mod.developer).sort()).toEqual(['setCompressorParams', 'setEqBandGain', 'setFeedbackSuppression']);
  });

  it('developer.setEqBandGain takes GainDb only (dB HL does not compile) and clamps', () => {
    const {mod, calls} = withFakeJsi();
    // @ts-expect-error a dB HL threshold is not a gain
    mod.developer.setEqBandGain(2, t[2], t[2]);
    mod.developer.setEqBandGain(2, gainDb(99), gainDb(-99));
    expect(calls.setEqBandGain[1]).toEqual([2, 20, -12]);
  });
});
