// ============================================================
//  screens/PermissionScreen.tsx  —  Microphone access request
// ============================================================

import React, {useRef, useEffect} from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Colors, Fonts, Radius, Spacing, Styles} from '../theme';

interface Props {
  onGranted: () => void;
  onDenied:  () => void;
}

export default function PermissionScreen({onGranted, onDenied}: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const fade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fade, {toValue: 1, duration: 600, useNativeDriver: true}).start();

    // Pulse the mic icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1.08, duration: 1200, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 1.0,  duration: 1200, useNativeDriver: true}),
      ]),
    ).start();
  }, [fade, pulse]);

  return (
    <SafeAreaView style={Styles.screen}>
      <Animated.View style={[styles.container, {opacity: fade}]}>

        {/* Decorative glow rings */}
        <View style={styles.glowWrap}>
          {[1.0, 0.6, 0.3].map((opacity, i) => (
            <View
              key={i}
              style={[
                styles.glowRing,
                {
                  width:  160 + i * 50,
                  height: 160 + i * 50,
                  borderRadius: 80 + i * 25,
                  borderColor: `rgba(0,212,255,${opacity * 0.25})`,
                  backgroundColor: `rgba(0,212,255,${opacity * 0.04})`,
                },
              ]}
            />
          ))}

          {/* Mic icon */}
          <Animated.View style={[styles.micButton, {transform: [{scale: pulse}]}]}>
            <MicIcon size={44} color={Colors.primary} />
          </Animated.View>
        </View>

        {/* Text content */}
        <View style={styles.textBlock}>
          <Text style={styles.title}>Microphone Access</Text>
          <Text style={styles.body}>
            ClariHear needs access to your microphone to process live audio.
          </Text>
          <Text style={styles.body}>
            Your audio is{' '}
            <Text style={styles.accent}>processed entirely on-device</Text>
            {' '}— nothing is sent to any server.
          </Text>
        </View>

        {/* Privacy card */}
        <View style={[Styles.glassCard, styles.privacyCard]}>
          {['🔒  On-device only — no cloud processing',
            '🚫  Never recorded or stored',
            '🎛  You control when the mic is active',
          ].map(item => (
            <Text key={item} style={styles.privacyItem}>{item}</Text>
          ))}
        </View>

        {/* CTA buttons */}
        <Pressable
          onPress={onGranted}
          style={({pressed}) => [styles.grantBtn, pressed && {opacity: 0.85}]}>
          <Text style={styles.grantText}>Allow Microphone Access</Text>
        </Pressable>

        <Pressable
          onPress={onDenied}
          style={({pressed}) => [styles.denyBtn, pressed && {opacity: 0.6}]}>
          <Text style={styles.denyText}>Not Now</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

// Mic icon built from Views (no SVG dependency)
function MicIcon({size, color}: {size: number; color: string}) {
  const w = size * 0.42;
  const h = size * 0.6;
  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      {/* Mic body */}
      <View style={{
        width: w, height: h,
        borderRadius: w / 2,
        backgroundColor: color,
        position: 'absolute', top: size * 0.04,
      }} />
      {/* Mic stand arc */}
      <View style={{
        position: 'absolute', bottom: 0,
        width: size * 0.7, height: size * 0.4,
        borderBottomLeftRadius: size * 0.35,
        borderBottomRightRadius: size * 0.35,
        borderWidth: size * 0.06,
        borderColor: color,
        borderTopWidth: 0,
      }} />
      {/* Stand base */}
      <View style={{
        position: 'absolute', bottom: 0,
        width: size * 0.45, height: size * 0.07,
        backgroundColor: color,
        borderRadius: 2,
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  glowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  micButton: {
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryGlow2,
    borderWidth: 1.5, borderColor: Colors.primary + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  title: {
    fontSize: Fonts.sizes.xxl,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: {
    fontSize: Fonts.sizes.base,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  accent: {color: Colors.primary, fontFamily: Fonts.medium},
  privacyCard: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    alignSelf: 'stretch',
  },
  privacyItem: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    lineHeight: 20,
  },
  grantBtn: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md + 4,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  grantText: {
    color: Colors.bg0,
    fontSize: Fonts.sizes.md,
    fontFamily: Fonts.bold,
  },
  denyBtn: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  denyText: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.sm,
    fontFamily: Fonts.regular,
  },
});
