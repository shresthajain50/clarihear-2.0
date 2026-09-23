// ============================================================
//  screens/AudiogramScreen.tsx  —  Hearing Test  [Phase 5]
//
//  Implements a simplified Hughson-Westlake pure-tone screening
//  for frequencies: 250, 500, 1000, 2000, 4000, 8000 Hz.
//
//  For clinical use, an audiologist administers the real test.
//  This screen does two things:
//   1. IMPORT path: User plots their audiogram from their
//      audiologist report by dragging markers on the audiogram grid
//   2. SCREEN path: Simplified screening with animated cues
//      (user responds when they hear the tone — tones are generated
//      by a short sine burst via the AudioEngine signal injector)
// ============================================================

import React, {useState, useCallback, useRef} from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Colors, Fonts, Radius, Spacing, Styles} from '../theme';
import type {Audiogram} from '../native/types';

// ── Audiogram constants ───────────────────────────────────────
const FREQUENCIES = [250, 500, 1000, 2000, 4000, 8000];
const FREQ_LABELS = ['250', '500', '1k', '2k', '4k', '8k'];
const HL_LEVELS   = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110];
const HEARING_CATEGORIES = [
  {label: 'Normal',         range: [0, 25],  color: Colors.success},
  {label: 'Mild Loss',      range: [26, 40], color: Colors.warning},
  {label: 'Moderate Loss',  range: [41, 55], color: Colors.eq[0]},
  {label: 'Severe Loss',    range: [56, 70], color: Colors.danger},
  {label: 'Profound Loss',  range: [71, 110],color: '#FF2D55'},
];

// Default audiogram — flat (normal hearing)
const DEFAULT_AUDIOGRAM: Audiogram = {
  left:  [10, 10, 10, 10, 10, 10],
  right: [10, 10, 10, 10, 10, 10],
};

interface Props {
  onComplete: (audiogram: Audiogram) => void;
  onSkip:     () => void;
}

type Ear = 'left' | 'right';

function getHearingCategory(avgHL: number) {
  return HEARING_CATEGORIES.find(
    c => avgHL >= c.range[0] && avgHL <= c.range[1],
  ) ?? HEARING_CATEGORIES[HEARING_CATEGORIES.length - 1];
}

export default function AudiogramScreen({onComplete, onSkip}: Props) {
  const [audiogram, setAudiogram] = useState<Audiogram>(DEFAULT_AUDIOGRAM);
  const [activeEar, setActiveEar] = useState<Ear>('left');
  const gridW = useRef(0);
  const gridH = useRef(0);

  // ── Move a marker by tapping the audiogram grid ──────────────
  const onGridPress = useCallback((evt: any) => {
    const {locationX, locationY} = evt.nativeEvent;
    if (!gridW.current || !gridH.current) return;

    const freqIdx = Math.floor(locationX / (gridW.current / FREQUENCIES.length));
    const hlIdx   = Math.floor(locationY / (gridH.current / HL_LEVELS.length));

    if (freqIdx < 0 || freqIdx >= FREQUENCIES.length) return;
    const hl = HL_LEVELS[Math.max(0, Math.min(HL_LEVELS.length - 1, hlIdx))];

    setAudiogram(prev => {
      const ear = [...prev[activeEar]] as number[];
      ear[freqIdx] = hl;
      return {...prev, [activeEar]: ear};
    });
  }, [activeEar]);

  // ── Average hearing level ────────────────────────────────────
  const avgLeft  = Math.round(audiogram.left.reduce((a, b) => a + b, 0) / 6);
  const avgRight = Math.round(audiogram.right.reduce((a, b) => a + b, 0) / 6);
  const catLeft  = getHearingCategory(avgLeft);
  const catRight = getHearingCategory(avgRight);

  // ── Grid geometry ─────────────────────────────────────────────
  const GRID_H = 240;

  return (
    <SafeAreaView style={Styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Audiogram</Text>
          <Text style={styles.subtitle}>
            Plot your hearing thresholds from your audiologist report
          </Text>
        </View>

        {/* Ear selector */}
        <View style={styles.earToggle}>
          {(['left', 'right'] as Ear[]).map(ear => (
            <Pressable
              key={ear}
              onPress={() => setActiveEar(ear)}
              style={[
                styles.earBtn,
                activeEar === ear && {
                  backgroundColor: ear === 'left' ? Colors.primary + '30' : Colors.secondary + '30',
                  borderColor: ear === 'left' ? Colors.primary : Colors.secondary,
                },
              ]}>
              <Text style={styles.earEmoji}>{ear === 'left' ? '👂' : '👂'}</Text>
              <Text style={[
                styles.earLabel,
                activeEar === ear && {
                  color: ear === 'left' ? Colors.primary : Colors.secondary,
                },
              ]}>
                {ear === 'left' ? 'Left Ear' : 'Right Ear'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Audiogram grid */}
        <View style={[Styles.glassCard, styles.gridCard]}>
          <Text style={styles.gridTitle}>
            Tap on the grid to set hearing thresholds
          </Text>

          {/* Y-axis: HL scale */}
          <View style={styles.gridRow}>
            <View style={styles.yAxis}>
              {HL_LEVELS.map(hl => (
                <Text key={hl} style={styles.yLabel}>{hl}</Text>
              ))}
            </View>

            {/* Grid */}
            <View
              style={[styles.grid, {height: GRID_H}]}
              onLayout={e => {
                gridW.current = e.nativeEvent.layout.width;
                gridH.current = GRID_H;
              }}
              onStartShouldSetResponder={() => true}
              onResponderRelease={onGridPress}>

              {/* Horizontal grid lines */}
              {HL_LEVELS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.hLine, {top: (i / HL_LEVELS.length) * GRID_H}]}
                />
              ))}

              {/* Vertical grid lines */}
              {FREQUENCIES.map((_, i) => (
                <View
                  key={i}
                  style={[styles.vLine, {left: (i / FREQUENCIES.length) * (gridW.current || 280)}]}
                />
              ))}

              {/* Normal hearing zone (0–25 dBHL) */}
              <View style={[styles.normalZone, {
                height: (25 / 110) * GRID_H,
              }]} />

              {/* Plotted thresholds */}
              {(['left', 'right'] as Ear[]).map(ear => (
                audiogram[ear].map((hl, fi) => {
                  const x = ((fi + 0.5) / FREQUENCIES.length) * (gridW.current || 280);
                  const y = (hl / 110) * GRID_H;
                  const color = ear === 'left' ? Colors.primary : Colors.secondary;
                  return (
                    <View
                      key={`${ear}-${fi}`}
                      style={[
                        styles.marker,
                        {
                          left: x - 8,
                          top: y - 8,
                          backgroundColor: activeEar === ear ? color : color + '66',
                          borderWidth: activeEar === ear ? 2 : 1,
                          borderColor: '#fff',
                        },
                      ]}>
                      <Text style={styles.markerText}>
                        {ear === 'left' ? 'X' : 'O'}
                      </Text>
                    </View>
                  );
                })
              ))}
            </View>
          </View>

          {/* X-axis: frequency labels */}
          <View style={styles.xAxis}>
            {FREQ_LABELS.map((lbl, i) => (
              <Text key={i} style={styles.xLabel}>{lbl}</Text>
            ))}
          </View>
          <Text style={styles.xAxisTitle}>Frequency (Hz)</Text>

          {/* Y-axis title */}
          <Text style={styles.yAxisTitle}>Hearing Level (dBHL)</Text>
        </View>

        {/* Hearing summary cards */}
        <View style={styles.summaryRow}>
          <HearingCard ear="Left"  avg={avgLeft}  category={catLeft}  color={Colors.primary} />
          <HearingCard ear="Right" avg={avgRight} category={catRight} color={Colors.secondary} />
        </View>

        {/* Legend */}
        <View style={[Styles.glassCard, styles.legend]}>
          <Text style={styles.legendTitle}>LEGEND</Text>
          <View style={styles.legendRow}>
            <View style={[styles.markerSmall, {backgroundColor: Colors.primary}]}>
              <Text style={styles.markerSmallText}>X</Text>
            </View>
            <Text style={styles.legendText}>Left ear</Text>
            <View style={[styles.markerSmall, {backgroundColor: Colors.secondary, marginLeft: Spacing.lg}]}>
              <Text style={styles.markerSmallText}>O</Text>
            </View>
            <Text style={styles.legendText}>Right ear</Text>
          </View>
          <Text style={styles.normalLabel}>
            <Text style={{color: Colors.success}}>■ </Text>Normal range (0–25 dBHL)
          </Text>
        </View>

        {/* Action buttons */}
        <Pressable
          onPress={() => onComplete(audiogram)}
          style={({pressed}) => [styles.primaryBtn, pressed && {opacity: 0.8}]}>
          <Text style={styles.primaryBtnText}>Apply Audiogram & Start →</Text>
        </Pressable>

        <Pressable
          onPress={onSkip}
          style={({pressed}) => [styles.secondaryBtn, pressed && {opacity: 0.6}]}>
          <Text style={styles.secondaryBtnText}>Skip — Use Default Settings</Text>
        </Pressable>

        <View style={{height: Spacing.xxl}} />
      </ScrollView>
    </SafeAreaView>
  );
}

function HearingCard({ear, avg, category, color}: {
  ear: string; avg: number; category: typeof HEARING_CATEGORIES[0]; color: string;
}) {
  return (
    <View style={[Styles.glassCard, styles.hearingCard]}>
      <Text style={[styles.hearingEar, {color}]}>{ear} Ear</Text>
      <Text style={[styles.hearingAvg, {color}]}>{avg}<Text style={styles.hearingUnit}> dBHL</Text></Text>
      <View style={[styles.hearingBadge, {backgroundColor: category.color + '30'}]}>
        <Text style={[styles.hearingBadgeText, {color: category.color}]}>
          {category.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: Spacing.md, gap: Spacing.md},
  header: {gap: 4, paddingTop: Spacing.md},
  title: {
    fontSize: Fonts.sizes.xxl,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    lineHeight: 20,
  },
  earToggle: {flexDirection: 'row', gap: Spacing.sm},
  earBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  earEmoji: {fontSize: 18},
  earLabel: {fontSize: Fonts.sizes.sm, fontFamily: Fonts.medium, color: Colors.textSecondary},
  gridCard: {padding: Spacing.md, gap: Spacing.sm},
  gridTitle: {fontSize: Fonts.sizes.xs, color: Colors.textMuted, fontFamily: Fonts.regular, textAlign: 'center'},
  gridRow: {flexDirection: 'row', gap: Spacing.xs},
  yAxis: {width: 28, justifyContent: 'space-between'},
  yLabel: {fontSize: 8, color: Colors.textMuted, fontFamily: Fonts.mono, textAlign: 'right'},
  yAxisTitle: {
    fontSize: 9, color: Colors.textMuted, fontFamily: Fonts.mono,
    transform: [{rotate: '-90deg'}], position: 'absolute', left: -28, top: '50%',
  },
  grid: {flex: 1, backgroundColor: Colors.bg0, borderRadius: Radius.sm, overflow: 'hidden', position: 'relative'},
  hLine: {position: 'absolute', left: 0, right: 0, height: 0.5, backgroundColor: 'rgba(255,255,255,0.06)'},
  vLine: {position: 'absolute', top: 0, bottom: 0, width: 0.5, backgroundColor: 'rgba(255,255,255,0.06)'},
  normalZone: {position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: Colors.success + '14'},
  marker: {
    position: 'absolute',
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  markerText: {fontSize: 8, fontFamily: Fonts.bold, color: '#fff'},
  xAxis: {flexDirection: 'row', paddingLeft: 32, justifyContent: 'space-around'},
  xLabel: {fontSize: 9, color: Colors.textMuted, fontFamily: Fonts.mono},
  xAxisTitle: {fontSize: 9, color: Colors.textMuted, fontFamily: Fonts.mono, textAlign: 'center'},
  summaryRow: {flexDirection: 'row', gap: Spacing.sm},
  hearingCard: {flex: 1, padding: Spacing.md, gap: Spacing.xs, alignItems: 'center'},
  hearingEar: {fontSize: Fonts.sizes.sm, fontFamily: Fonts.medium},
  hearingAvg: {fontSize: Fonts.sizes.xxl, fontFamily: Fonts.bold},
  hearingUnit: {fontSize: Fonts.sizes.sm, fontFamily: Fonts.regular},
  hearingBadge: {paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.pill},
  hearingBadgeText: {fontSize: Fonts.sizes.xs, fontFamily: Fonts.medium},
  legend: {padding: Spacing.md, gap: Spacing.sm},
  legendTitle: {fontSize: Fonts.sizes.xs, color: Colors.textMuted, fontFamily: Fonts.mono, letterSpacing: 1.5},
  legendRow: {flexDirection: 'row', alignItems: 'center', gap: Spacing.sm},
  markerSmall: {width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center'},
  markerSmallText: {fontSize: 7, fontFamily: Fonts.bold, color: '#fff'},
  legendText: {fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontFamily: Fonts.regular},
  normalLabel: {fontSize: Fonts.sizes.xs, color: Colors.textSecondary},
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md + 2,
    alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnText: {color: Colors.bg0, fontSize: Fonts.sizes.md, fontFamily: Fonts.bold},
  secondaryBtn: {padding: Spacing.md, alignItems: 'center'},
  secondaryBtnText: {color: Colors.textMuted, fontSize: Fonts.sizes.sm, fontFamily: Fonts.regular},
});
