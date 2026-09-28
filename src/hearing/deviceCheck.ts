// Environment + headphone checks before a hearing screening (PRD §10, §11). Pure decisions;
// mic metering and L/R tone playback come from the audio layer.
// The ambient threshold is on an UNCALIBRATED mic level (dBFS), so it is a coarse,
// provisional gate (docs/product/OPEN_QUESTIONS.md Q10), never an SPL measurement.

export const AMBIENT_CHECK = {
  version: '0.1.0-provisional',
  /** Median input level (dBFS, from AudioEngine input meter) above this → too noisy. */
  maxMedianDbfs: -45,
  /** At or below this the mic is effectively silent/dead: cannot judge. */
  noSignalDbfs: -95,
  /** ~3 s of 10 Hz meter polling. */
  minReadings: 20,
} as const;

export const NOISY_MESSAGE = 'It is a little noisy here. Move somewhere quieter for a more reliable result.';
export const UNCALIBRATED_NOTICE =
  'Your headphones are not calibrated for threshold measurement. We can still run a hearing screening, ' +
  'but this should not be treated as a clinical audiogram.';

export type AmbientResult =
  | {kind: 'ok'; medianDbfs: number}
  | {kind: 'too_noisy'; medianDbfs: number; message: typeof NOISY_MESSAGE}
  | {kind: 'no_signal'; message: string};

export function assessAmbient(levelsDbfs: readonly number[]): AmbientResult {
  const v = levelsDbfs.filter(Number.isFinite).sort((a, b) => a - b);
  const noSignal = {kind: 'no_signal', message: "We couldn't hear anything from the microphone. Check that it's allowed and not covered."} as const;
  if (v.length < AMBIENT_CHECK.minReadings) return noSignal;
  const mid = v.length >> 1;
  const median = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  if (median <= AMBIENT_CHECK.noSignalDbfs) return noSignal;
  return median > AMBIENT_CHECK.maxMedianDbfs
    ? {kind: 'too_noisy', medianDbfs: median, message: NOISY_MESSAGE}
    : {kind: 'ok', medianDbfs: median};
}

export type HeardIn = 'left' | 'right' | 'both' | 'none';
export type ChannelResult = {kind: 'ok'} | {kind: 'swapped' | 'mono' | 'not_heard' | 'wrong'; message: string};

/** The user heard a tone played only in the LEFT channel, then one only in the RIGHT. */
export function assessChannels(a: {left: HeardIn; right: HeardIn}): ChannelResult {
  if (a.left === 'left' && a.right === 'right') return {kind: 'ok'};
  if (a.left === 'none' || a.right === 'none')
    return {kind: 'not_heard', message: 'Make sure both earpieces are in and the volume is up, then try again.'};
  if (a.left === 'both' || a.right === 'both')
    return {kind: 'mono', message: 'Sound is reaching both ears at once. Turn off mono audio in accessibility settings and use stereo headphones.'};
  if (a.left === 'right' && a.right === 'left')
    return {kind: 'swapped', message: 'Left and right seem swapped. Check your earpieces are in the correct ears.'};
  return {kind: 'wrong', message: "The sounds didn't reach the expected ears. Check your headphones and try again."};
}
