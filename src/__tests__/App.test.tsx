import React from 'react';
import {render, screen} from '@testing-library/react-native';
import App from '../App';

it('renders the welcome screen first (smoke test of the flow wiring)', () => {
  render(<App />);
  expect(screen.toJSON()).toBeTruthy();
  expect(screen.queryByText('Developer diagnostics')).toBeNull();
  expect(screen.queryByText(/Equalizer/i)).toBeNull();
});
