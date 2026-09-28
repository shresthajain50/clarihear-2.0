import React from 'react';
import {render, screen} from '@testing-library/react-native';
import OnboardingScreen, {ONBOARDING_FOOTER} from '../OnboardingScreen';

const allText = (node: unknown): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(allText).join(' ');
  if (node && typeof node === 'object' && 'children' in node) return allText((node as {children: unknown}).children);
  return '';
};

describe('OnboardingScreen (PRD §8)', () => {
  it('uses the PRD copy and always shows the not-a-medical-evaluation footer', () => {
    render(<OnboardingScreen onComplete={() => {}} />);
    for (const t of ['Hear what matters.', 'Check', 'Personalize', 'Assist', ONBOARDING_FOOTER]) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });

  it('makes no diagnosis, clinical, accuracy or unmeasured performance claims', () => {
    render(<OnboardingScreen onComplete={() => {}} />);
    const text = allText(screen.toJSON()).replace(ONBOARDING_FOOTER, '');
    for (const banned of [/diagnos/i, /clinical/i, /exact/i, /\d+\s*ms\b/i, /latency/i, /\bEQ\b/, /cure|treat/i, /hearing aid/i]) {
      expect(text).not.toMatch(banned);
    }
  });
});
