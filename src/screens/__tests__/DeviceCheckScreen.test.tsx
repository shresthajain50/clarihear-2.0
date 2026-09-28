import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import DeviceCheckScreen from '../DeviceCheckScreen';
import * as Audio from '../../native/ClarihearAudio';
import {NOISY_MESSAGE, UNCALIBRATED_NOTICE} from '../../hearing/deviceCheck';

jest.mock('../../native/ClarihearAudio', () => ({
  startAudio: jest.fn(async () => true),
  stopAudio: jest.fn(),
  setMuted: jest.fn(),
  setTestTone: jest.fn(),
  getInputLevel: jest.fn(() => -60),
  getSessionStatus: jest.fn(() => 'running'),
}));
const A = Audio as jest.Mocked<typeof Audio>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

async function begin() {
  render(<DeviceCheckScreen onDone={onDone} />);
  await act(async () => fireEvent.press(screen.getByLabelText('Start check')));
  await act(async () => jest.advanceTimersByTime(3500));
}
const onDone = jest.fn();

describe('DeviceCheckScreen (PRD §10, §11)', () => {
  it('quiet room + correct ears → uncalibrated notice → done; tones go to one ear each', async () => {
    await begin();
    expect(A.setMuted).toHaveBeenCalledWith(true); // ambient capture never plays mic to the ears
    expect(A.setTestTone).toHaveBeenLastCalledWith('left');
    fireEvent.press(screen.getByLabelText('I heard it in my left ear'));
    expect(A.setTestTone).toHaveBeenLastCalledWith('right');
    fireEvent.press(screen.getByLabelText('I heard it in my right ear'));
    expect(A.setTestTone).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(UNCALIBRATED_NOTICE)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(A.stopAudio).toHaveBeenCalled();
  });

  it('noisy room: shows the PRD copy and does not continue', async () => {
    A.getInputLevel.mockReturnValue(-20);
    await begin();
    expect(screen.getByText(NOISY_MESSAGE)).toBeTruthy();
    expect(A.setTestTone).not.toHaveBeenCalledWith('left');
    expect(screen.getByLabelText('Try again')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    A.getInputLevel.mockReturnValue(-60);
  });

  it('swapped channels: explains and does not continue', async () => {
    await begin();
    fireEvent.press(screen.getByLabelText('I heard it in my right ear'));
    fireEvent.press(screen.getByLabelText('I heard it in my left ear'));
    expect(screen.getByText(/swapped/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('no headphones: says so and does not continue', async () => {
    A.startAudio.mockResolvedValueOnce(false);
    A.getSessionStatus.mockReturnValueOnce('no_headphones');
    render(<DeviceCheckScreen onDone={onDone} />);
    await act(async () => fireEvent.press(screen.getByLabelText('Start check')));
    expect(screen.getByText(/Connect headphones/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('turns the tone off and stops audio if left mid-check', async () => {
    const {unmount} = render(<DeviceCheckScreen onDone={onDone} />);
    await act(async () => fireEvent.press(screen.getByLabelText('Start check')));
    unmount();
    expect(A.setTestTone).toHaveBeenLastCalledWith(null);
    expect(A.stopAudio).toHaveBeenCalled();
  });
});
