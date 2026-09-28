import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import SafetyScreen from '../SafetyScreen';
import ReferralScreen from '../ReferralScreen';
import SettingsScreen from '../SettingsScreen';
import {SAFETY_QUESTIONS, URGENT_MESSAGE} from '../../hearing/eligibility';

describe('SafetyScreen', () => {
  it('reports eligible only after every question is answered safely', () => {
    const onResult = jest.fn();
    render(<SafetyScreen onResult={onResult} />);
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({kind: 'incomplete'}));
    expect(screen.getByText('Please answer every question.')).toBeTruthy();
    for (const q of SAFETY_QUESTIONS) fireEvent.press(screen.getByLabelText(`${q.text} ${q.safeAnswer ? 'Yes' : 'No'}`));
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(onResult).toHaveBeenLastCalledWith({kind: 'eligible'});
  });

  it('a red-flag answer produces a referral', () => {
    const onResult = jest.fn();
    render(<SafetyScreen onResult={onResult} />);
    fireEvent.press(screen.getByLabelText('Do you have severe dizziness or vertigo? Yes'));
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({kind: 'refer', reasons: ['vertigo']}));
  });
});

describe('ReferralScreen', () => {
  it('cannot be left with a single accidental tap', () => {
    const onRestart = jest.fn();
    render(<ReferralScreen urgent={false} onRestart={onRestart} />);
    fireEvent.press(screen.getByLabelText('Start over'));
    expect(onRestart).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onRestart).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Start over'));
    fireEvent.press(screen.getByLabelText('Yes, start over'));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('shows the urgent line only for urgent referrals', () => {
    const {rerender} = render(<ReferralScreen urgent={false} onRestart={() => {}} />);
    expect(screen.queryByText(URGENT_MESSAGE)).toBeNull();
    rerender(<ReferralScreen urgent onRestart={() => {}} />);
    expect(screen.getByText(URGENT_MESSAGE)).toBeTruthy();
  });
});

describe('SettingsScreen', () => {
  it('hides developer diagnostics unless developer mode is available', () => {
    const noop = () => {};
    const {rerender} = render(<SettingsScreen devModeAvailable={false} onBack={noop} onRepeatCheck={noop} onOpenDeveloper={noop} />);
    expect(screen.queryByLabelText('Developer diagnostics')).toBeNull();
    rerender(<SettingsScreen devModeAvailable onBack={noop} onRepeatCheck={noop} onOpenDeveloper={noop} />);
    expect(screen.getByLabelText('Developer diagnostics')).toBeTruthy();
  });
});
