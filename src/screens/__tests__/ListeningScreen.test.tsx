import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import ListeningScreen from '../ListeningScreen';
import * as Audio from '../../native/ClarihearAudio';
import {FITTING_VERSION, fitHearingProfile} from '../../hearing/fitting';
import {dbHL, type FrequencyThresholds} from '../../hearing/types';

jest.mock('../../native/ClarihearAudio', () => ({
  startAudio: jest.fn(async () => true),
  stopAudio: jest.fn(),
  setMasterVolume: jest.fn(),
  applyDspProfile: jest.fn(),
  setBypass: jest.fn(),
  setMuted: jest.fn(),
  getLimiterEngagedCount: jest.fn(() => 0),
  getSessionStatus: jest.fn(() => 'running'),
  getInputLevel: jest.fn(() => -96),
  getOutputLevel: jest.fn(() => -96),
  isJSIAvailable: jest.fn(() => true),
  developer: {setEqBandGain: jest.fn(), setCompressorParams: jest.fn(), setFeedbackSuppression: jest.fn()},
}));
const A = Audio as jest.Mocked<typeof Audio>;

const t = [30, 35, 40, 45, 50, 55].map(dbHL) as unknown as FrequencyThresholds;
const fit = fitHearingProfile({left: t, right: t, source: 'audiogram_import', confidence: 1, fittingVersion: FITTING_VERSION});
if (fit.kind !== 'fitted') throw new Error('fixture must fit');
const dsp = fit.dsp;

beforeEach(() => jest.clearAllMocks());

describe('ListeningScreen (PRD §16)', () => {
  it('shows no EQ, compressor or technical jargon', () => {
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    for (const jargon of [/equali[sz]er/i, /compressor/i, /\bdB\b/, /ratio/i, /threshold/i, /attack/i, /release/i, /makeup/i, /\bHz\b/, /AFC/]) {
      expect(screen.queryByText(jargon)).toBeNull();
    }
    expect(A.developer.setEqBandGain).not.toHaveBeenCalled();
    expect(A.developer.setCompressorParams).not.toHaveBeenCalled();
  });

  it('always shows the safety indicator and the uncalibrated-output notice', () => {
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    expect(screen.getByText('Safe listening enabled')).toBeTruthy();
    expect(screen.getByText(/can't guarantee the exact sound level/i)).toBeTruthy();
  });

  it('applies the fitted profile through the bounded controls on mount', () => {
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    const applied = A.applyDspProfile.mock.calls.at(-1)![0];
    expect(applied.bandGainsLeft).toEqual(dsp.bandGainsLeft);
    expect(applied.mode).toBe('everyday');
  });

  it('turns on with one tap and says so', async () => {
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    await act(async () => fireEvent.press(screen.getByLabelText('Turn listening assistance on')));
    expect(A.startAudio).toHaveBeenCalled();
    expect(screen.getByText('Clarihear is helping you hear.')).toBeTruthy();
  });

  it('mute is always reachable and immediate', async () => {
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    fireEvent.press(screen.getByLabelText('Mute'));
    expect(A.setMuted).toHaveBeenLastCalledWith(true);
    fireEvent.press(screen.getByLabelText('Unmute'));
    expect(A.setMuted).toHaveBeenLastCalledWith(false);
  });

  it('volume can always be turned down, to silence', () => {
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    const down = screen.getByLabelText('Volume down');
    for (let i = 0; i < 12; i++) fireEvent.press(down);
    expect(A.setMasterVolume).toHaveBeenLastCalledWith(0);
  });

  it('clarity + lifts high-frequency gain, within bounds', () => {
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    fireEvent.press(screen.getByLabelText('More clarity'));
    const applied = A.applyDspProfile.mock.calls.at(-1)![0];
    expect(applied.bandGainsLeft[4]).toBeGreaterThan(dsp.bandGainsLeft[4]);
    expect(applied.bandGainsLeft[4] - dsp.bandGainsLeft[4]).toBeLessThanOrEqual(6);
  });

  it('has exactly three modes and switching applies it', () => {
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    for (const m of ['Everyday', 'Conversation', 'Quiet']) expect(screen.getByRole('button', {name: m})).toBeTruthy();
    fireEvent.press(screen.getByRole('button', {name: 'Conversation'}));
    expect(A.applyDspProfile.mock.calls.at(-1)![0].mode).toBe('conversation');
  });

  it('on headset disconnect: shows the PRD copy and switches to OFF (no silent continue)', async () => {
    jest.useFakeTimers();
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    await act(async () => fireEvent.press(screen.getByLabelText('Turn listening assistance on')));
    A.getSessionStatus.mockReturnValue('paused_route_lost');
    await act(async () => jest.advanceTimersByTime(1100));
    expect(screen.getByText('Your headphones were disconnected. Listening assistance is paused.')).toBeTruthy();
    expect(screen.getByLabelText('Turn listening assistance on')).toBeTruthy();
    A.getSessionStatus.mockReturnValue('running');
    jest.useRealTimers();
  });

  it('explains that it will not start without headphones', async () => {
    A.startAudio.mockResolvedValueOnce(false);
    A.getSessionStatus.mockReturnValueOnce('no_headphones');
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    await act(async () => fireEvent.press(screen.getByLabelText('Turn listening assistance on')));
    expect(screen.getByText(/Connect headphones to start listening/)).toBeTruthy();
  });

  it('shows the PRD failure copy when audio cannot start', async () => {
    A.startAudio.mockResolvedValueOnce(false);
    render(<ListeningScreen dsp={dsp} onOpenSettings={() => {}} />);
    await act(async () => fireEvent.press(screen.getByLabelText('Turn listening assistance on')));
    expect(screen.getByText("Clarihear couldn't start live listening. Check your headphones and try again.")).toBeTruthy();
  });
});
