// ============================================================
//  screens/ListeningScreen.tsx  —  Live Hearing (PRD §16)
//  The primary screen: ON, three modes, volume, clarity, mute, bypass,
//  and a persistent safety indicator. No EQ, no compressor, no jargon.
//  Every control goes through hearing/controls.ts (bounded offsets around
//  the fitted profile) before reaching the engine.
// ============================================================

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';
import PowerButton from '../components/PowerButton';
import * as Audio from '../native/ClarihearAudio';
import {applyListeningControls} from '../hearing/controls';
import type {DspProfile, ListeningMode} from '../hearing/types';
import {Colors, Fonts, Radius, Spacing, Styles} from '../theme';

const MODES: {id: ListeningMode; label: string}[] = [
  {id: 'everyday', label: 'Everyday'},
  {id: 'conversation', label: 'Conversation'},
  {id: 'quiet', label: 'Quiet'},
];
const VOLUME_STEPS = 10;
const CLARITY_LABELS = ['Softer', 'A little softer', 'Balanced', 'A little crisper', 'Crisper'];

interface Props {
  dsp: DspProfile;
  onOpenSettings: () => void;
}

export default function ListeningScreen({dsp, onOpenSettings}: Props) {
  const [on, setOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ListeningMode>('everyday');
  const [volume, setVolume] = useState(5);
  const [clarity, setClarity] = useState(0); // −2..+2
  const [muted, setMuted] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [reduced, setReduced] = useState(false);
  const lastLimiterCount = useRef(0);

  useEffect(() => {
    Audio.applyDspProfile(applyListeningControls(dsp, mode, {clarity: clarity / 2, background: 0, loudness: 0}));
  }, [dsp, mode, clarity]);
  useEffect(() => Audio.setMasterVolume(volume / VOLUME_STEPS), [volume]);
  useEffect(() => Audio.setMuted(muted), [muted]);
  useEffect(() => Audio.setBypass(bypass), [bypass]);

  // PRD §52: tell the user when the limiter had to step in.
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      const n = Audio.getLimiterEngagedCount();
      setReduced(n > lastLimiterCount.current);
      lastLimiterCount.current = n;
    }, 1000);
    return () => clearInterval(id);
  }, [on]);

  const toggle = useCallback(async () => {
    if (on) {
      Audio.stopAudio();
      setOn(false);
      return;
    }
    setStarting(true);
    setError(null);
    const ok = await Audio.startAudio();
    setStarting(false);
    setOn(ok);
    if (!ok) setError("Clarihear couldn't start live listening. Check your headphones and try again.");
  }, [on]);

  return (
    <SafeAreaView style={Styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Clarihear</Text>
          <Pressable onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12}>
            <Text style={styles.link}>Settings</Text>
          </Pressable>
        </View>

        <View style={styles.center}>
          <PowerButton
            on={on}
            loading={starting}
            onPress={toggle}
            size={140}
            accessibilityLabel={on ? 'Turn listening assistance off' : 'Turn listening assistance on'}
          />
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {muted ? 'Muted.' : on ? 'Clarihear is helping you hear.' : 'Listening assistance is off.'}
          </Text>
          {error && <Text style={styles.error} accessibilityLiveRegion="assertive">{error}</Text>}
          {reduced && on && (
            <Text style={styles.notice} accessibilityLiveRegion="polite">
              Clarihear reduced amplification to keep listening comfortable.
            </Text>
          )}
        </View>

        <View style={[Styles.glassCard, styles.card]}>
          <Text style={styles.label}>Mode</Text>
          <View style={styles.row}>
            {MODES.map(m => (
              <Pressable
                key={m.id}
                onPress={() => setMode(m.id)}
                accessibilityRole="button"
                accessibilityLabel={m.label}
                accessibilityState={{selected: mode === m.id}}
                style={[styles.chip, mode === m.id && styles.chipOn]}>
                <Text style={[styles.chipText, mode === m.id && styles.chipTextOn]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Stepper
          label="Volume"
          value={`${volume} of ${VOLUME_STEPS}`}
          downLabel="Volume down"
          upLabel="Volume up"
          onDown={() => setVolume(v => Math.max(0, v - 1))}
          onUp={() => setVolume(v => Math.min(VOLUME_STEPS, v + 1))}
        />
        <Stepper
          label="Clarity"
          value={CLARITY_LABELS[clarity + 2]}
          downLabel="Less clarity"
          upLabel="More clarity"
          onDown={() => setClarity(c => Math.max(-2, c - 1))}
          onUp={() => setClarity(c => Math.min(2, c + 1))}
        />

        <View style={styles.row}>
          <BigButton label={muted ? 'Unmute' : 'Mute'} active={muted} onPress={() => setMuted(m => !m)} />
          <BigButton
            label={bypass ? 'Resume processing' : 'Natural sound'}
            active={bypass}
            onPress={() => setBypass(b => !b)}
          />
        </View>

        <View style={styles.safety} accessible accessibilityLabel="Safe listening enabled. Clarihear limits amplification, but can't guarantee the exact sound level in your ears with these headphones.">
          <Text style={styles.safetyTitle}>Safe listening enabled</Text>
          <Text style={styles.safetyText}>
            Clarihear limits amplification, but can't guarantee the exact sound level in your ears with these headphones.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stepper(p: {label: string; value: string; downLabel: string; upLabel: string; onDown: () => void; onUp: () => void}) {
  return (
    <View style={[Styles.glassCard, styles.card, styles.stepper]}>
      <Pressable onPress={p.onDown} accessibilityRole="button" accessibilityLabel={p.downLabel} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <View style={styles.stepValue} accessible accessibilityLabel={`${p.label}: ${p.value}`}>
        <Text style={styles.label}>{p.label}</Text>
        <Text style={styles.value}>{p.value}</Text>
      </View>
      <Pressable onPress={p.onUp} accessibilityRole="button" accessibilityLabel={p.upLabel} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function BigButton({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{selected: active}}
      style={[styles.big, active && styles.bigOn]}>
      <Text style={styles.bigText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: Spacing.md, gap: Spacing.md},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.md},
  title: {color: Colors.textPrimary, fontSize: 28, fontFamily: Fonts.bold},
  link: {color: Colors.textAccent, fontSize: 18, fontFamily: Fonts.medium},
  center: {alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg},
  status: {color: Colors.textPrimary, fontSize: 22, fontFamily: Fonts.medium, textAlign: 'center'},
  error: {color: Colors.danger, fontSize: 18, textAlign: 'center'},
  notice: {color: Colors.warning, fontSize: 18, textAlign: 'center'},
  card: {padding: Spacing.md, gap: Spacing.sm},
  label: {color: Colors.textSecondary, fontSize: 18, fontFamily: Fonts.medium},
  value: {color: Colors.textPrimary, fontSize: 22, fontFamily: Fonts.bold},
  row: {flexDirection: 'row', gap: Spacing.sm},
  chip: {flex: 1, minHeight: 48, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.glassBorder, alignItems: 'center', justifyContent: 'center'},
  chipOn: {backgroundColor: Colors.primary, borderColor: Colors.primary},
  chipText: {color: Colors.textPrimary, fontSize: 16, fontFamily: Fonts.medium},
  chipTextOn: {color: Colors.bg1},
  stepper: {flexDirection: 'row', alignItems: 'center'},
  stepBtn: {width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.glass, alignItems: 'center', justifyContent: 'center'},
  stepBtnText: {color: Colors.textPrimary, fontSize: 30},
  stepValue: {flex: 1, alignItems: 'center'},
  big: {flex: 1, minHeight: 64, borderRadius: Radius.md, backgroundColor: Colors.glass, alignItems: 'center', justifyContent: 'center', padding: Spacing.sm},
  bigOn: {backgroundColor: Colors.secondary},
  bigText: {color: Colors.textPrimary, fontSize: 20, fontFamily: Fonts.bold, textAlign: 'center'},
  safety: {alignItems: 'center', gap: 4, paddingVertical: Spacing.md},
  safetyTitle: {color: Colors.success, fontSize: 18, fontFamily: Fonts.bold},
  safetyText: {color: Colors.textSecondary, fontSize: 15, textAlign: 'center'},
});
