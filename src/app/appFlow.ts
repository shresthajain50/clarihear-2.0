// App navigation state machine (PRD §7, §35). Pure: screens render `state` and dispatch
// events; they never decide routing themselves (PRD §36 "do not put logic in components").
//
// Invariant: a professional referral is sticky. From it, no event reaches setup or
// listening; only an explicit RESTART (back to the welcome screen) leaves it.

import type {EligibilityResult, SafetyQuestionId} from '../hearing/eligibility';
import type {FitResult, ReferralReason} from '../hearing/fitting';
import {FITTING_VERSION, PLACEHOLDER_COMPRESSION} from '../hearing/fitting';
import type {ScreeningResult} from '../hearing/din';
import type {BandGains, DspProfile} from '../hearing/types';

export type AppState =
  | 'first_launch'
  | 'safety_check'
  | 'device_check'
  | 'screening'
  | 'screening_result'
  | 'professional_referral'
  | 'profile_setup'
  | 'listening'
  | 'settings'
  | 'developer';

export interface FlowState {
  state: AppState;
  dsp?: DspProfile;
  lastScreening?: ScreeningResult;
  referralReasons?: (SafetyQuestionId | ReferralReason)[];
  /** Referral for sudden change carries the urgent line (Q7). */
  urgent?: boolean;
  /** DIN needs licensed/validated stimuli (Q6); off until they exist. */
  screeningAvailable: boolean;
  /** Developer diagnostics (PRD §32). Pass __DEV__: never true in release builds. */
  devModeAvailable: boolean;
}

export type FlowEvent =
  | {type: 'START'}
  | {type: 'SAFETY_RESULT'; result: EligibilityResult}
  | {type: 'DEVICE_READY'}
  | {type: 'SCREENING_DONE'; result: ScreeningResult}
  | {type: 'CONTINUE'}
  | {type: 'FIT_RESULT'; result: FitResult}
  | {type: 'SKIP_PROFILE'}
  | {type: 'OPEN_SETTINGS'}
  | {type: 'CLOSE_SETTINGS'}
  | {type: 'OPEN_DEVELOPER'}
  | {type: 'CLOSE_DEVELOPER'}
  | {type: 'REPEAT_CHECK'}
  | {type: 'RESTART'};

const flat = [0, 0, 0, 0, 0, 0] as unknown as BandGains;
/** No amplification at all: unity gain through the limiter. Used when the user skips personalization. */
export const FLAT_PROFILE: DspProfile = {
  bandGainsLeft: flat,
  bandGainsRight: flat,
  compression: PLACEHOLDER_COMPRESSION,
  outputLimit: {ceilingDbfs: -1, maxGainDb: 0, acousticCeilingCalibrated: false},
  mode: 'everyday',
  fittingVersion: `${FITTING_VERSION}+flat`,
};

export function initialFlow(opts: Partial<Pick<FlowState, 'screeningAvailable' | 'devModeAvailable'>> = {}): FlowState {
  return {state: 'first_launch', screeningAvailable: false, devModeAvailable: false, ...opts};
}

export function appFlow(s: FlowState, e: FlowEvent): FlowState {
  const go = (state: AppState, patch: Partial<FlowState> = {}): FlowState => ({...s, ...patch, state});

  if (s.state === 'professional_referral') {
    return e.type === 'RESTART'
      ? initialFlow({screeningAvailable: s.screeningAvailable, devModeAvailable: s.devModeAvailable})
      : s;
  }

  switch (e.type) {
    case 'START':
      return s.state === 'first_launch' ? go('safety_check') : s;
    case 'SAFETY_RESULT':
      if (s.state !== 'safety_check') return s;
      if (e.result.kind === 'refer') return go('professional_referral', {referralReasons: e.result.reasons, urgent: e.result.urgent, dsp: undefined});
      return e.result.kind === 'eligible' ? go('device_check') : s;
    case 'DEVICE_READY':
      return s.state === 'device_check' ? go(s.screeningAvailable ? 'screening' : 'profile_setup') : s;
    case 'SCREENING_DONE':
      return s.state === 'screening' ? go('screening_result', {lastScreening: e.result}) : s;
    case 'CONTINUE':
      return s.state === 'screening_result' ? go('profile_setup') : s;
    case 'FIT_RESULT':
      if (s.state !== 'profile_setup') return s;
      return e.result.kind === 'fitted'
        ? go('listening', {dsp: e.result.dsp})
        : go('professional_referral', {referralReasons: e.result.reasons, urgent: false, dsp: undefined});
    case 'SKIP_PROFILE':
      return s.state === 'profile_setup' ? go('listening', {dsp: FLAT_PROFILE}) : s;
    case 'OPEN_SETTINGS':
      return s.state === 'listening' ? go('settings') : s;
    case 'CLOSE_SETTINGS':
      return s.state === 'settings' ? go('listening') : s;
    case 'OPEN_DEVELOPER':
      return s.state === 'settings' && s.devModeAvailable ? go('developer') : s;
    case 'CLOSE_DEVELOPER':
      return s.state === 'developer' ? go('settings') : s;
    case 'REPEAT_CHECK':
      return s.state === 'settings' ? go('safety_check') : s;
    case 'RESTART':
      return s;
  }
}
