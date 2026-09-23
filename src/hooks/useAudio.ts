// ============================================================
//  hooks/useAudio.ts  —  React hook wrapping ClarihearAudio API
// ============================================================

import {useState, useCallback, useEffect, useRef} from 'react';
import * as Audio from '../native/ClarihearAudio';
import type {Audiogram, CompressorParams, EqBand} from '../native/types';

interface AudioState {
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;
  jsiAvailable: boolean;
}

interface UseAudioReturn extends AudioState {
  start: () => Promise<boolean>;
  stop: () => void;
  toggle: () => Promise<void>;
  setVolume: (linear: number) => void;
  setEqBand: (band: EqBand, gainL: number, gainR: number) => void;
  applyAudiogram: (audiogram: Audiogram) => void;
  setCompressor: (params: CompressorParams) => void;
  setFeedbackSuppression: (enabled: boolean) => void;
}

export function useAudio(): UseAudioReturn {
  const [state, setState] = useState<AudioState>({
    isRunning: false,
    isLoading: false,
    error: null,
    jsiAvailable: Audio.isJSIAvailable(),
  });

  const start = useCallback(async (): Promise<boolean> => {
    setState(s => ({...s, isLoading: true, error: null}));
    try {
      const success = await Audio.startAudio();
      setState(s => ({...s, isRunning: success, isLoading: false}));
      return success;
    } catch (e: any) {
      setState(s => ({...s, isLoading: false, error: e?.message ?? 'Failed to start'}));
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    Audio.stopAudio();
    setState(s => ({...s, isRunning: false}));
  }, []);

  const toggle = useCallback(async () => {
    if (state.isRunning) {
      stop();
    } else {
      await start();
    }
  }, [state.isRunning, start, stop]);

  const setVolume = useCallback((linear: number) => {
    Audio.setMasterVolume(linear);
  }, []);

  const setEqBand = useCallback((band: EqBand, gainL: number, gainR: number) => {
    Audio.setEqBandGain(band, gainL, gainR);
  }, []);

  const applyAudiogram = useCallback((audiogram: Audiogram) => {
    Audio.applyAudiogram(audiogram);
  }, []);

  const setCompressor = useCallback((params: CompressorParams) => {
    Audio.setCompressorParams(params);
  }, []);

  const setFeedbackSuppression = useCallback((enabled: boolean) => {
    Audio.setFeedbackSuppression(enabled);
  }, []);

  return {
    ...state,
    start,
    stop,
    toggle,
    setVolume,
    setEqBand,
    applyAudiogram,
    setCompressor,
    setFeedbackSuppression,
  };
}

// ── Level metering hook — polls at ~30fps ─────────────────────
export function useLevel(active: boolean) {
  const [inputDb, setInputDb] = useState(-96);
  const [outputDb, setOutputDb] = useState(-96);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setInputDb(-96);
      setOutputDb(-96);
      return;
    }

    const poll = (ts: number) => {
      // throttle to ~30fps for React state efficiency
      if (ts - lastRef.current > 33) {
        lastRef.current = ts;
        setInputDb(Audio.getInputLevel());
        setOutputDb(Audio.getOutputLevel());
      }
      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return {inputDb, outputDb};
}
