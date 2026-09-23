// ============================================================
//  components/PowerButton.tsx
//  Animated power toggle with pulsing glow ring.
// ============================================================

import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {Colors, Shadow} from '../theme';

interface Props {
  on: boolean;
  loading?: boolean;
  onPress: () => void;
  size?: number;
}

export default function PowerButton({on, loading = false, onPress, size = 88}: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0)).current;
  const spin  = useRef(new Animated.Value(0)).current;

  // Pulsing glow when active
  useEffect(() => {
    if (on) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {toValue: 1.12, duration: 900, useNativeDriver: true}),
          Animated.timing(pulse, {toValue: 1.0,  duration: 900, useNativeDriver: true}),
        ]),
      ).start();
      Animated.timing(glow, {toValue: 1, duration: 400, useNativeDriver: false}).start();
    } else {
      pulse.stopAnimation();
      Animated.timing(pulse, {toValue: 1, duration: 200, useNativeDriver: true}).start();
      Animated.timing(glow, {toValue: 0, duration: 400, useNativeDriver: false}).start();
    }
  }, [on, glow, pulse]);

  // Spinner while loading
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(spin, {toValue: 1, duration: 1000, useNativeDriver: true}),
      ).start();
    } else {
      spin.stopAnimation();
      spin.setValue(0);
    }
  }, [loading, spin]);

  const rotate = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});
  const glowColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,212,255,0)', 'rgba(0,212,255,0.35)'],
  });
  const ringColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.bg3, Colors.primary],
  });

  const btnSize  = size;
  const ringSize = size + 28;

  return (
    <View style={styles.container}>
      {/* Outer pulse ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            transform: [{scale: pulse}],
            borderColor: ringColor,
            backgroundColor: glowColor,
          },
        ]}
      />

      {/* Button core */}
      <Pressable
        onPress={onPress}
        style={({pressed}) => [
          styles.button,
          {
            width: btnSize,
            height: btnSize,
            borderRadius: btnSize / 2,
            backgroundColor: on ? Colors.primaryDim : Colors.bg3,
            transform: [{scale: pressed ? 0.93 : 1}],
          },
          on ? (Shadow.glow as object) : {},
        ]}>
        <Animated.View style={{transform: [{rotate}]}}>
          {/* SVG-style power icon built from Views */}
          <PowerIcon color={on ? '#fff' : Colors.textMuted} size={size * 0.38} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

// Pure-View power icon (no SVG dependency)
function PowerIcon({color, size}: {color: string; size: number}) {
  const stroke = Math.max(2, size * 0.12);
  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      {/* Vertical bar at top */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: stroke,
          height: size * 0.42,
          backgroundColor: color,
          borderRadius: stroke,
        }}
      />
      {/* Arc — simulated with a thick ring cut off at top */}
      <View
        style={{
          width: size * 0.7,
          height: size * 0.7,
          borderRadius: size * 0.35,
          borderWidth: stroke,
          borderColor: color,
          borderTopColor: 'transparent',
          transform: [{rotate: '20deg'}],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});
