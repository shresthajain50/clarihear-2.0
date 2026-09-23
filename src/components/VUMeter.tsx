// ============================================================
//  components/VUMeter.tsx
//  Animated vertical level meter — input and output dBFS bars.
// ============================================================

import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View, Text} from 'react-native';
import {Colors, Fonts, Radius, Spacing} from '../theme';

interface VUBarProps {
  db: number;          // current level in dBFS  (e.g. -20.0)
  label: string;
  color: string;
}

const DB_MIN = -60;
const DB_MAX = 0;

function dbToFraction(db: number): number {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db));
  return (clamped - DB_MIN) / (DB_MAX - DB_MIN);
}

function VUBar({db, label, color}: VUBarProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: dbToFraction(db),
      duration: 60,           // fast enough to track speech transients
      useNativeDriver: false, // height interpolation needs JS driver
    }).start();
  }, [db, anim]);

  const barHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Change bar color: green → yellow → red based on level
  const barColor = db > -6  ? Colors.danger
                 : db > -18 ? Colors.warning
                 : color;

  return (
    <View style={styles.barContainer}>
      <View style={styles.track}>
        {/* Grid lines at -12, -24, -36, -48 dBFS */}
        {[-12, -24, -36, -48].map(gridDb => (
          <View
            key={gridDb}
            style={[
              styles.gridLine,
              {bottom: `${dbToFraction(gridDb) * 100}%` as any},
            ]}
          />
        ))}

        {/* Level fill bar */}
        <Animated.View
          style={[
            styles.fill,
            {height: barHeight, backgroundColor: barColor},
          ]}
        />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {db <= DB_MIN ? '—' : `${Math.round(db)}`}
        <Text style={styles.unit}> dB</Text>
      </Text>
    </View>
  );
}

interface VUMeterProps {
  inputDb: number;
  outputDb: number;
}

export default function VUMeter({inputDb, outputDb}: VUMeterProps) {
  return (
    <View style={styles.container}>
      <VUBar db={inputDb}  label="IN"  color={Colors.primary} />
      <View style={styles.separator} />
      <VUBar db={outputDb} label="OUT" color={Colors.secondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  separator: {
    width: 1,
    height: '80%',
    backgroundColor: Colors.glassBorder,
    alignSelf: 'center',
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  track: {
    flex: 1,
    width: 18,
    backgroundColor: Colors.bg0,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  fill: {
    width: '100%',
    borderRadius: Radius.sm,
  },
  gridLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    left: 0,
  },
  label: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.xs,
    fontFamily: Fonts.mono,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  value: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.xs,
    fontFamily: Fonts.mono,
  },
  unit: {
    color: Colors.textMuted,
    fontSize: 9,
  },
});
