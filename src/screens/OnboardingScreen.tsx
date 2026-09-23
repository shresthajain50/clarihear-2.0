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

const SLIDES = [
  {
    emoji:    '🎙',
    title:    'Hear Every Word',
    subtitle: 'ClariHear amplifies and clarifies speech in real-time using advanced DSP — running entirely on your device.',
    accent:   Colors.primary,
  },
  {
    emoji:    '🎛',
    title:    'Tuned to Your Hearing',
    subtitle: 'Import your audiogram or run a quick screening. The 6-band EQ adapts to your exact hearing thresholds, per ear.',
    accent:   Colors.secondary,
  },
  {
    emoji:    '⚡',
    title:    'Under 10ms Latency',
    subtitle: 'No echo, no delay. The mic-to-speaker path is < 10ms — so you hear the world naturally, just clearer.',
    accent:   Colors.success,
  },
];

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
            <Pressable onPress={onComplete} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable
              onPress={() => goTo(page + 1)}
              style={[styles.nextBtn, {backgroundColor: slide.accent}]}>
              <Text style={styles.nextText}>Next →</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onComplete}
            style={({pressed}) => [styles.startBtn, {opacity: pressed ? 0.85 : 1}]}>
            <Text style={styles.startText}>Get Started  →</Text>
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
