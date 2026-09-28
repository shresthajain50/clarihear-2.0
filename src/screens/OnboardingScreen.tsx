// ============================================================
//  screens/OnboardingScreen.tsx  —  3-slide intro  [Phase 5]
// ============================================================

import React, {useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Colors, Fonts, Radius, Spacing} from '../theme';

const {width: SW} = Dimensions.get('window');

// Copy from PRD §8. No performance, latency or accuracy claims: none has been measured,
// and the product must never imply diagnosis or clinical fitting.
const SLIDES = [
  {
    emoji:    '👂',
    title:    'Hear what matters.',
    subtitle: 'Clarihear creates a personalized listening experience based on how you hear.',
    accent:   Colors.primary,
  },
  {
    emoji:    '✓',
    title:    'Check',
    subtitle: 'Understand your hearing profile.',
    accent:   Colors.secondary,
  },
  {
    emoji:    '◎',
    title:    'Personalize',
    subtitle: 'Create a listening profile for your needs.',
    accent:   Colors.primary,
  },
  {
    emoji:    '♪',
    title:    'Assist',
    subtitle: 'Use real-time sound processing to make conversations easier to follow.',
    accent:   Colors.success,
  },
];

export const ONBOARDING_FOOTER =
  'Clarihear is a screening and hearing-assistance tool. It does not replace a medical hearing evaluation.';

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({onComplete}: Props) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const dotAnim   = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const goTo = (idx: number) => {
    scrollRef.current?.scrollTo({x: idx * SW, animated: true});
    // animate dot
    Animated.parallel(
      dotAnim.map((a, i) =>
        Animated.spring(a, {
          toValue: i === idx ? 1 : 0,
          useNativeDriver: false,
          tension: 80, friction: 10,
        }),
      ),
    ).start();
    setPage(idx);
  };

  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (idx !== page) goTo(idx);
  };

  const slide = SLIDES[page];

  return (
    <View style={styles.screen}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{flex: 1}}>
        {SLIDES.map((s, i) => (
          <View key={i} style={styles.slide}>
            {/* Background glow blob */}
            <View style={[styles.glowBlob, {backgroundColor: s.accent + '18'}]} />

            <Text style={styles.emoji}>{s.emoji}</Text>
            <Text style={[styles.slideTitle, {color: s.accent}]}>{s.title}</Text>
            <Text style={styles.slideSubtitle}>{s.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View style={styles.bottom}>
        <Text style={styles.footer}>{ONBOARDING_FOOTER}</Text>

        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const w = dotAnim[i].interpolate({inputRange: [0, 1], outputRange: [6, 22]});
            return (
              <Animated.View
                key={i}
                style={[styles.dot, {width: w, backgroundColor: i === page ? slide.accent : Colors.bg3}]}
              />
            );
          })}
        </View>

        {/* CTA */}
        {page < SLIDES.length - 1 ? (
          <View style={styles.navRow}>
            <Pressable onPress={onComplete} accessibilityRole="button" accessibilityLabel="Skip introduction" style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable
              onPress={() => goTo(page + 1)}
              accessibilityRole="button"
              accessibilityLabel="Next"
              style={[styles.nextBtn, {backgroundColor: slide.accent}]}>
              <Text style={styles.nextText}>Next →</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onComplete}
            accessibilityRole="button"
            accessibilityLabel="Start hearing check"
            style={({pressed}) => [styles.startBtn, {opacity: pressed ? 0.85 : 1}]}>
            <Text style={styles.startText}>Start hearing check</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg1,
  },
  slide: {
    width: SW,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.lg,
    position: 'relative',
  },
  glowBlob: {
    position: 'absolute',
    width: 280, height: 280,
    borderRadius: 140,
    top: '20%',
  },
  emoji: {fontSize: 72},
  slideTitle: {
    fontSize: Fonts.sizes.xxl,
    fontFamily: Fonts.bold,
    textAlign: 'center',
    lineHeight: 34,
  },
  footer: {color: Colors.textSecondary, fontSize: 15, textAlign: 'center', paddingHorizontal: 24, marginBottom: 12},
  slideSubtitle: {
    fontSize: Fonts.sizes.base,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  dots: {flexDirection: 'row', gap: 6, alignItems: 'center'},
  dot:  {height: 6, borderRadius: 3},
  navRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipBtn: {padding: Spacing.md},
  skipText: {color: Colors.textMuted, fontSize: Fonts.sizes.base, fontFamily: Fonts.regular},
  nextBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
  },
  nextText: {color: '#fff', fontSize: Fonts.sizes.base, fontFamily: Fonts.bold},
  startBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md + 2,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  startText: {color: Colors.bg0, fontSize: Fonts.sizes.md, fontFamily: Fonts.bold, letterSpacing: 0.3},
});
