import {appFlow, initialFlow, type FlowEvent, type FlowState} from '../appFlow';
import {assessEligibility, SAFETY_QUESTIONS, type SafetyAnswers} from '../../hearing/eligibility';
import {FITTING_VERSION, fitHearingProfile} from '../../hearing/fitting';
import {dbHL, type FrequencyThresholds} from '../../hearing/types';

const safe = Object.fromEntries(SAFETY_QUESTIONS.map(q => [q.id, q.safeAnswer])) as SafetyAnswers;
const ear = (...hl: number[]) => hl.map(dbHL) as unknown as FrequencyThresholds;
const fit = (h: FrequencyThresholds, r = h) =>
  fitHearingProfile({left: h, right: r, source: 'audiogram_import', confidence: 1, fittingVersion: FITTING_VERSION});

const run = (events: FlowEvent[], start: FlowState = initialFlow()) => events.reduce(appFlow, start);
const toSetup: FlowEvent[] = [{type: 'START'}, {type: 'SAFETY_RESULT', result: assessEligibility(safe)}, {type: 'DEVICE_READY'}];

describe('app flow (PRD §7, §35)', () => {
  it('walks the happy path: welcome → safety → device → profile → listening', () => {
    const s = run([...toSetup, {type: 'FIT_RESULT', result: fit(ear(30, 35, 40, 45, 50, 55))}]);
    expect(s.state).toBe('listening');
    expect(s.dsp?.fittingVersion).toBe(FITTING_VERSION);
  });

  it('skips DIN screening while no validated stimuli exist (Q6), and uses it once they do', () => {
    expect(run(toSetup).state).toBe('profile_setup');
    const withDin = run(toSetup, initialFlow({screeningAvailable: true}));
    expect(withDin.state).toBe('screening');
  });

  it('a safety red flag routes to professional referral', () => {
    const s = run([{type: 'START'}, {type: 'SAFETY_RESULT', result: assessEligibility({...safe, vertigo: true})}]);
    expect(s.state).toBe('professional_referral');
    expect(s.referralReasons).toEqual(['vertigo']);
  });

  it('an audiogram beyond the self-fit range routes to professional referral', () => {
    const s = run([...toSetup, {type: 'FIT_RESULT', result: fit(ear(75, 75, 75, 75, 75, 75))}]);
    expect(s.state).toBe('professional_referral');
    expect(s.dsp).toBeUndefined();
  });

  it('an incomplete questionnaire stays on the safety check', () => {
    expect(run([{type: 'START'}, {type: 'SAFETY_RESULT', result: assessEligibility({adult: true})}]).state).toBe('safety_check');
  });

  it('from referral, NO event reaches listening or setup; only a deliberate restart leaves', () => {
    const referred = run([{type: 'START'}, {type: 'SAFETY_RESULT', result: assessEligibility({...safe, earwax: true})}]);
    const every: FlowEvent[] = [
      {type: 'START'}, {type: 'DEVICE_READY'}, {type: 'SKIP_PROFILE'}, {type: 'CONTINUE'},
      {type: 'FIT_RESULT', result: fit(ear(30, 30, 30, 30, 30, 30))}, {type: 'SAFETY_RESULT', result: assessEligibility(safe)},
      {type: 'OPEN_SETTINGS'}, {type: 'CLOSE_SETTINGS'}, {type: 'OPEN_DEVELOPER'}, {type: 'CLOSE_DEVELOPER'},
    ];
    for (const e of every) expect(appFlow(referred, e).state).toBe('professional_referral');
    expect(appFlow(referred, {type: 'RESTART'}).state).toBe('first_launch');
  });

  it('listening without a profile is only the flat (no-amplification) profile, and only after safety', () => {
    const s = run([...toSetup, {type: 'SKIP_PROFILE'}]);
    expect(s.state).toBe('listening');
    expect([...s.dsp!.bandGainsLeft, ...s.dsp!.bandGainsRight].every(g => g === 0)).toBe(true);
    expect(run([{type: 'SKIP_PROFILE'}]).state).toBe('first_launch');
  });

  it('developer mode is unreachable unless available (never in release builds)', () => {
    const listening = run([...toSetup, {type: 'SKIP_PROFILE'}, {type: 'OPEN_SETTINGS'}]);
    expect(appFlow(listening, {type: 'OPEN_DEVELOPER'}).state).toBe('settings');
    const dev = run([...toSetup, {type: 'SKIP_PROFILE'}, {type: 'OPEN_SETTINGS'}], initialFlow({devModeAvailable: true}));
    expect(appFlow(dev, {type: 'OPEN_DEVELOPER'}).state).toBe('developer');
  });

  it('settings can repeat the hearing check (back through safety)', () => {
    const s = run([...toSetup, {type: 'SKIP_PROFILE'}, {type: 'OPEN_SETTINGS'}, {type: 'REPEAT_CHECK'}]);
    expect(s.state).toBe('safety_check');
  });

  it('ignores events that do not apply to the current state', () => {
    const s = initialFlow();
    expect(appFlow(s, {type: 'DEVICE_READY'})).toBe(s);
  });
});
