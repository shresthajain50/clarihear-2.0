// ============================================================
//  screens/DashboardScreen.tsx  —  Live Mode UI  [Phase 5]
//
//  The main screen after onboarding. Everything here is live
//  audio — slider drags go through JSI to the C++ engine in
//  real-time. VU meters update at 30fps via requestAnimationFrame.
// ============================================================

import React, {useState, useCallback, useRef} from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {Colors, Fonts, Radius, Spacing, Styles} from '../theme';
import PowerButton from '../components/PowerButton';
import VUMeter from '../components/VUMeter';
import EQBand from '../components/EQBand';
import {useAudio, useLevel} from '../hooks/useAudio';
import type {EqBand} from '../native/types';
import {DEFAULT_COMPRESSOR} from '../native/ClarihearAudio';

// ── EQ band labels ────────────────────────────────────────────
const BAND_LABELS = ['250', '500', '1k', '2k', '4k', '8k'];

// ── Initial EQ state (flat) ───────────────────────────────────
type EqGains = {l: number; r: number}[];
const FLAT_EQ: EqGains = Array.from({length: 6}, () => ({l: 0, r: 0}));

interface Props {
  audiogram?: {left: number[]; right: number[]};
  onOpenSettings?: () => void;
}

export default function DashboardScreen({audiogram, onOpenSettings}: Props) {
  const audio = useAudio();
  const {inputDb, outputDb} = useLevel(audio.isRunning);

  // ── UI state ──────────────────────────────────────────────────
  const [eqGains, setEqGains] = useState<EqGains>(() => {
    if (audiogram) {
      return Array.from({length: 6}, (_, i) => ({
        l: audiogram.left[i]  ?? 0,
        r: audiogram.right[i] ?? 0,
      }));
    }
    return FLAT_EQ;
  });

  const [dualEar, setDualEar] = useState(true);
  const [afc, setAfc]         = useState(true);
  const [volume, setVolume]   = useState(0.85);
  const [activeTab, setActiveTab] = useState<'eq' | 'comp'>('eq');

  // Compressor params
  const [comp, setComp] = useState(DEFAULT_COMPRESSOR);

  // Animated tab indicator
  const tabAnim = useRef(new Animated.Value(0)).current;
  const switchTab = (tab: 'eq' | 'comp') => {
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: tab === 'eq' ? 0 : 1,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  // ── EQ change handler — called on every drag frame ────────────
  const onEqChange = useCallback((band: EqBand, gainL: number, gainR: number) => {
    setEqGains(prev => {
      const next = [...prev];
      next[band] = {l: gainL, r: gainR};
      return next;
    });
    audio.setEqBand(band, gainL, gainR);  // → JSI → C++ AudioEngine (sync)
  }, [audio]);

  // ── Volume slider ─────────────────────────────────────────────
  const onVolumeChange = useCallback((v: number) => {
    setVolume(v);
    audio.setVolume(v);
  }, [audio]);

  // ── AFC toggle ────────────────────────────────────────────────
  const onAfcToggle = useCallback((val: boolean) => {
    setAfc(val);
    audio.setFeedbackSuppression(val);
  }, [audio]);

  // ── Tab indicator X position ──────────────────────────────────
  const tabX = tabAnim.interpolate({inputRange: [0, 1], outputRange: [0, 120]});

  return (
    <SafeAreaView style={Styles.screen}>
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>ClariHear</Text>
            <Text style={styles.appSub}>Precision Hearing Assistance</Text>
          </View>
          <Pressable
            onPress={onOpenSettings}
            style={({pressed}) => [styles.settingsBtn, pressed && {opacity: 0.6}]}>
            <SettingsIcon />
          </Pressable>
        </View>

        {/* ── Power + VU row ───────────────────────────────────── */}
        <View style={[Styles.glassCard, styles.topCard]}>
          {/* JSI badge */}
          <View style={styles.badge}>
            <View style={[styles.dot, {backgroundColor: audio.jsiAvailable ? Colors.success : Colors.warning}]} />
            <Text style={styles.badgeText}>
              {audio.jsiAvailable ? 'JSI Active' : 'Bridge Mode'}
            </Text>
          </View>

          <View style={styles.powerRow}>
            {/* Power button */}
            <View style={styles.powerWrap}>
              <PowerButton
                on={audio.isRunning}
                loading={audio.isLoading}
                onPress={audio.toggle}
                size={96}
              />
              <Text style={[styles.powerLabel, audio.isRunning && styles.powerLabelOn]}>
                {audio.isLoading ? 'Starting…' : audio.isRunning ? 'LIVE' : 'TAP TO START'}
              </Text>
            </View>

            {/* VU Meters */}
            <VUMeter inputDb={inputDb} outputDb={outputDb} />
          </View>

          {/* Volume slider */}
          <View style={styles.volumeRow}>
            <Text style={styles.volLabel}>🔈</Text>
            <VolumeSlider value={volume} onChange={onVolumeChange} />
            <Text style={styles.volLabel}>🔊</Text>
          </View>
        </View>

        {/* ── Dual-ear toggle + AFC ────────────────────────────── */}
        <View style={styles.toggleRow}>
          <TogglePill label="Dual Ear" value={dualEar} onChange={setDualEar} />
          <TogglePill
            label="Feedback Cancel"
            value={afc}
            onChange={onAfcToggle}
            color={Colors.secondary}
          />
        </View>

        {/* ── Tab bar: EQ | Compressor ─────────────────────────── */}
        <View style={[Styles.glassCard, styles.mainCard]}>
          <View style={styles.tabBar}>
            <View style={styles.tabTrack}>
              <Animated.View
                style={[styles.tabIndicator, {transform: [{translateX: tabX}]}]}
              />
              {(['eq', 'comp'] as const).map(tab => (
                <Pressable
                  key={tab}
                  onPress={() => switchTab(tab)}
                  style={styles.tabButton}>
                  <Text style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}>
                    {tab === 'eq' ? 'Equalizer' : 'Compressor'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── EQ Panel ──────────────────────────────────────── */}
          {activeTab === 'eq' && (
            <View style={styles.eqPanel}>
              <View style={styles.eqBands}>
                {eqGains.map((g, i) => (
                  <EQBand
                    key={i}
                    band={i as EqBand}
                    label={BAND_LABELS[i]}
                    color={Colors.eq[i]}
                    gainL={g.l}
                    gainR={g.r}
                    showRight={dualEar}
                    onChange={onEqChange}
                  />
                ))}
              </View>

              {/* Frequency axis labels */}
              <View style={styles.freqAxis}>
                <Text style={styles.axisLabel}>LOW</Text>
                <Text style={styles.axisLabel}>HIGH</Text>
              </View>

              {/* EQ presets quick row */}
              <View style={styles.presetRow}>
                {['Flat', 'Speech', 'Music', 'Audiogram'].map(preset => (
                  <Pressable
                    key={preset}
                    onPress={() => {
                      if (preset === 'Flat') {
                        setEqGains(FLAT_EQ);
                        for (let b = 0; b < 6; b++) onEqChange(b as EqBand, 0, 0);
                      }
                      // Other presets would set specific gain curves
                    }}
                    style={({pressed}) => [styles.preset, pressed && {opacity: 0.6}]}>
                    <Text style={styles.presetText}>{preset}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ── Compressor Panel ──────────────────────────────── */}
          {activeTab === 'comp' && (
            <View style={styles.compPanel}>
              <CompSlider
                label="Threshold"
                unit="dBFS"
                value={comp.thresholdDb}
                min={-80} max={0}
                color={Colors.primary}
                onChange={v => {
                  const p = {...comp, thresholdDb: v};
                  setComp(p);
                  audio.setCompressor(p);
                }}
              />
              <CompSlider
                label="Ratio"
                unit=":1"
                value={comp.ratio}
                min={1} max={20}
                color={Colors.secondary}
                onChange={v => {
                  const p = {...comp, ratio: v};
                  setComp(p);
                  audio.setCompressor(p);
                }}
              />
              <CompSlider
                label="Attack"
                unit="ms"
                value={comp.attackMs}
                min={0.1} max={50}
                color={Colors.success}
                onChange={v => {
                  const p = {...comp, attackMs: v};
                  setComp(p);
                  audio.setCompressor(p);
                }}
              />
              <CompSlider
                label="Release"
                unit="ms"
                value={comp.releaseMs}
                min={10} max={500}
                color={Colors.warning}
                onChange={v => {
                  const p = {...comp, releaseMs: v};
                  setComp(p);
                  audio.setCompressor(p);
                }}
              />
              <CompSlider
                label="Makeup Gain"
                unit="dB"
                value={comp.makeupGainDb}
                min={0} max={40}
                color={Colors.eq[3]}
                onChange={v => {
                  const p = {...comp, makeupGainDb: v};
                  setComp(p);
                  audio.setCompressor(p);
                }}
              />

              {/* Compressor curve visualisation */}
              <CompressorCurve threshold={comp.thresholdDb} ratio={comp.ratio} />
            </View>
          )}
        </View>

        {/* Error bar */}
        {audio.error && (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>⚠ {audio.error}</Text>
          </View>
        )}

        <View style={{height: Spacing.xxl}} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────

function TogglePill({label, value, onChange, color = Colors.primary}: {
  label: string; value: boolean; onChange: (v: boolean) => void; color?: string;
}) {
  return (
    <View style={styles.togglePill}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{false: Colors.bg0, true: color + '55'}}
        thumbColor={value ? color : Colors.textMuted}
      />
    </View>
  );
}

function VolumeSlider({value, onChange}: {value: number; onChange: (v: number) => void}) {
  const width = useRef(0);
  const handleLayout = useCallback((e: any) => {
    width.current = e.nativeEvent.layout.width;
  }, []);

  return (
    <Pressable
      style={styles.volTrack}
      onLayout={handleLayout}
      onStartShouldSetResponder={() => true}
      onResponderMove={e => {
        if (!width.current) return;
        const x = e.nativeEvent.locationX;
        onChange(Math.max(0, Math.min(1, x / width.current)));
      }}>
      <View style={[styles.volFill, {width: `${value * 100}%`}]} />
      <View style={[styles.volThumb, {left: `${value * 100}%`}]} />
    </Pressable>
  );
}

function CompSlider({label, unit, value, min, max, color, onChange}: {
  label: string; unit: string; value: number;
  min: number; max: number; color: string;
  onChange: (v: number) => void;
}) {
  const w = useRef(0);
  const frac = (value - min) / (max - min);

  return (
    <View style={styles.compSlider}>
      <View style={styles.compSliderHeader}>
        <Text style={styles.compLabel}>{label}</Text>
        <Text style={[styles.compValue, {color}]}>
          {value.toFixed(label === 'Ratio' ? 1 : 0)}{unit}
        </Text>
      </View>
      <Pressable
        style={styles.compTrack}
        onLayout={e => { w.current = e.nativeEvent.layout.width; }}
        onStartShouldSetResponder={() => true}
        onResponderMove={e => {
          if (!w.current) return;
          const x = e.nativeEvent.locationX;
          const f = Math.max(0, Math.min(1, x / w.current));
          onChange(f * (max - min) + min);
        }}>
        <View style={[styles.compFill, {width: `${frac * 100}%`, backgroundColor: color}]} />
      </Pressable>
    </View>
  );
}

// Transfer function curve visualisation
function CompressorCurve({threshold, ratio}: {threshold: number; ratio: number}) {
  const points = [];
  for (let i = 0; i <= 100; i++) {
    const inDb = -80 + i * 0.8;
    const outDb = inDb < threshold
      ? inDb
      : threshold + (inDb - threshold) / ratio;
    points.push({x: i, y: 100 - ((outDb + 80) / 80) * 100});
  }

  // Simple sparkline representation using Views
  return (
    <View style={styles.curveContainer}>
      <Text style={styles.curveLabel}>Transfer Curve</Text>
      <View style={styles.curve}>
        {points.filter((_, i) => i % 5 === 0).map((p, i) => (
          <View
            key={i}
            style={[styles.curveDot, {left: `${p.x}%`, top: `${p.y}%`}]}
          />
        ))}
        {/* Unity-gain reference */}
        <View style={styles.unityLine} />
      </View>
    </View>
  );
}

// Settings icon (pure View)
function SettingsIcon() {
  return (
    <View style={{width: 24, height: 24, alignItems: 'center', justifyContent: 'center'}}>
      {[0, 60, 120].map(deg => (
        <View key={deg} style={{
          position: 'absolute',
          width: 18, height: 3,
          backgroundColor: Colors.textSecondary,
          borderRadius: 2,
          transform: [{rotate: `${deg}deg`}],
        }} />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  appTitle: {
    fontSize: Fonts.sizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    letterSpacing: 0.5,
  },
  settingsBtn: {
    width: 40, height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.glass,
    borderWidth: 1, borderColor: Colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  topCard: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5,
    backgroundColor: Colors.bg0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  dot: {width: 6, height: 6, borderRadius: 3},
  badgeText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
  },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  powerWrap: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  powerLabel: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    letterSpacing: 2,
  },
  powerLabelOn: {
    color: Colors.primary,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  volLabel: {fontSize: 16},
  volTrack: {
    flex: 1, height: 6,
    backgroundColor: Colors.bg0,
    borderRadius: Radius.pill,
    overflow: 'visible',
    justifyContent: 'center',
  },
  volFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
  },
  volThumb: {
    position: 'absolute',
    width: 18, height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    top: -6,
    marginLeft: -9,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.glass,
    borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  toggleLabel: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
  },
  mainCard: {
    overflow: 'hidden',
  },
  tabBar: {
    padding: Spacing.sm,
    paddingBottom: 0,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.bg0,
    borderRadius: Radius.sm,
    padding: 3,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    left: 3, top: 3,
    width: 120, height: 34,
    backgroundColor: Colors.bg3,
    borderRadius: Radius.sm - 1,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  tabButton: {
    width: 120, height: 34,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  tabText: {
    fontSize: Fonts.sizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.textPrimary,
  },
  eqPanel: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  eqBands: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    height: 220,
    alignItems: 'flex-end',
  },
  freqAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    letterSpacing: 1,
  },
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  preset: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.bg0,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  presetText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
  },
  compPanel: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  compSlider: {gap: 6},
  compSliderHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  compLabel: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
  },
  compValue: {
    fontSize: Fonts.sizes.sm,
    fontFamily: Fonts.mono,
  },
  compTrack: {
    height: 6,
    backgroundColor: Colors.bg0,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  compFill: {
    height: '100%',
    borderRadius: Radius.pill,
    opacity: 0.85,
  },
  curveContainer: {gap: 8},
  curveLabel: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    letterSpacing: 1,
  },
  curve: {
    height: 100,
    backgroundColor: Colors.bg0,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  curveDot: {
    position: 'absolute',
    width: 3, height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.primary,
    opacity: 0.8,
  },
  unityLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 0,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    transform: [{rotate: '-45deg'}, {scaleX: 2}],
  },
  errorBar: {
    backgroundColor: Colors.danger + '22',
    borderColor: Colors.danger + '55',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Fonts.sizes.sm,
    fontFamily: Fonts.medium,
  },
});
