// ============================================================
//  components/EQBand.tsx
//  Vertical EQ band slider — one per frequency (250Hz–8kHz).
//  Calls clarihear.setEqBandGain() synchronously via JSI on
//  every gesture frame, achieving <1µs audio parameter update.
// ============================================================

import React, {useCallback, useRef, useState} from 'react';
import {
  Animated,
  GestureResponderEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Colors, Fonts, Radius} from '../theme';
import type {EqBand} from '../native/types';

interface EQBandProps {
  band: EqBand;
  label: string;          // e.g. "250", "1k", "8k"
  color: string;          // per-band colour from theme
  gainL: number;          // left ear gain dB (−20 … +60)
  gainR: number;          // right ear gain dB
  showRight: boolean;     // dual-ear mode toggle
  maxGain?: number;       // default 60 dB (audiogram ceiling)
  minGain?: number;       // default −20 dB
  onChange: (band: EqBand, gainL: number, gainR: number) => void;
}

const TRACK_HEIGHT = 160;
const THUMB_H = 28;
const DRAG_RANGE = TRACK_HEIGHT - THUMB_H;

function gainToY(gain: number, min: number, max: number): number {
  // 0 = bottom of track, DRAG_RANGE = top — invert because Y grows downward
  const frac = (gain - min) / (max - min);
  return DRAG_RANGE - frac * DRAG_RANGE;
}

function yToGain(y: number, min: number, max: number): number {
  const frac = 1 - Math.max(0, Math.min(DRAG_RANGE, y)) / DRAG_RANGE;
  const raw  = frac * (max - min) + min;
  // Snap to integers for clean dB values
  return Math.round(raw);
}

export default function EQBand({
  band, label, color, gainL, gainR,
  showRight, maxGain = 60, minGain = -20,
  onChange,
}: EQBandProps) {
  const animL = useRef(new Animated.Value(gainToY(gainL, minGain, maxGain))).current;
  const animR = useRef(new Animated.Value(gainToY(gainR, minGain, maxGain))).current;

  // Track which thumb is being dragged: 'L' | 'R' | null
  const dragging = useRef<'L' | 'R' | null>(null);
  const startY   = useRef(0);
  const startGain= useRef(0);

  // Animated display value for the label
  const [dispL, setDispL] = useState(gainL);
  const [dispR, setDispR] = useState(gainR);

  // ── Gesture handlers ────────────────────────────────────────
  const onGrant = useCallback(
    (which: 'L' | 'R') =>
      (evt: GestureResponderEvent) => {
        dragging.current = which;
        startY.current   = evt.nativeEvent.pageY;
        startGain.current= which === 'L' ? gainL : gainR;
      },
    [gainL, gainR],
  );

  const onMove = useCallback((evt: GestureResponderEvent) => {
    if (!dragging.current) return;
    const dy      = evt.nativeEvent.pageY - startY.current;
    const newY    = gainToY(startGain.current, minGain, maxGain) + dy;
    const newGain = yToGain(newY, minGain, maxGain);

    if (dragging.current === 'L') {
      animL.setValue(gainToY(newGain, minGain, maxGain));
      setDispL(newGain);
      onChange(band, newGain, gainR);
    } else {
      animR.setValue(gainToY(newGain, minGain, maxGain));
      setDispR(newGain);
      onChange(band, gainL, newGain);
    }
  }, [band, gainL, gainR, minGain, maxGain, animL, animR, onChange]);

  const onRelease = useCallback(() => {
    dragging.current = null;
  }, []);

  // Value label helpers
  const fmtGain = (g: number) => (g >= 0 ? `+${g}` : `${g}`);

  return (
    <View
      style={styles.container}
      onStartShouldSetResponder={() => false}   // don't capture — children capture
    >
      {/* Frequency label */}
      <Text style={[styles.freqLabel, {color}]}>{label}</Text>
      <Text style={styles.hzLabel}>Hz</Text>

      {/* Track */}
      <View style={styles.trackWrap}>
        {/* Track background */}
        <View style={[styles.track, {backgroundColor: Colors.bg0}]}>
          {/* Zero line (0 dB reference) */}
          <View
            style={[
              styles.zeroLine,
              {bottom: gainToY(0, minGain, maxGain) + THUMB_H / 2},
            ]}
          />

          {/* Left ear thumb */}
          <Animated.View
            style={[
              styles.thumbL,
              {
                top: animL,
                backgroundColor: color,
                shadowColor: color,
              },
            ]}
            onStartShouldSetResponder={() => true}
            onResponderGrant={onGrant('L')}
            onResponderMove={onMove}
            onResponderRelease={onRelease}>
            <Text style={styles.thumbLabel}>L</Text>
          </Animated.View>

          {/* Right ear thumb (only in dual-ear mode) */}
          {showRight && (
            <Animated.View
              style={[
                styles.thumbR,
                {
                  top: animR,
                  borderColor: color,
                },
              ]}
              onStartShouldSetResponder={() => true}
              onResponderGrant={onGrant('R')}
              onResponderMove={onMove}
              onResponderRelease={onRelease}>
              <Text style={[styles.thumbLabel, {color}]}>R</Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Gain value */}
      <Text style={[styles.gainLabel, {color}]}>{fmtGain(dispL)}</Text>
      {showRight && (
        <Text style={[styles.gainLabelR, {color: color + '99'}]}>{fmtGain(dispR)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  freqLabel: {
    fontSize: Fonts.sizes.sm,
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
  },
  hzLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    marginTop: -2,
  },
  trackWrap: {
    width: 28,
    height: TRACK_HEIGHT,
    alignItems: 'center',
  },
  track: {
    width: 6,
    height: TRACK_HEIGHT,
    borderRadius: Radius.pill,
    position: 'relative',
  },
  zeroLine: {
    position: 'absolute',
    left: -4,
    width: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  thumbL: {
    position: 'absolute',
    left: -11,
    width: THUMB_H,
    height: THUMB_H,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
  },
  thumbR: {
    position: 'absolute',
    left: -11,
    width: THUMB_H,
    height: THUMB_H,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  thumbLabel: {
    color: '#fff',
    fontSize: 9,
    fontFamily: Fonts.bold,
  },
  gainLabel: {
    fontSize: Fonts.sizes.sm,
    fontFamily: Fonts.mono,
    marginTop: 2,
  },
  gainLabelR: {
    fontSize: 9,
    fontFamily: Fonts.mono,
    marginTop: -2,
  },
});
