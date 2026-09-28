// screens/DeviceCheckScreen.tsx — environment + headphone check (PRD §10, §11).
// Decisions live in hearing/deviceCheck.ts. Output stays muted while measuring the room;
// tones play to one ear at a bounded level; audio stops when the check ends or is left.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import * as Audio from '../native/ClarihearAudio';
import {AMBIENT_CHECK, UNCALIBRATED_NOTICE, assessAmbient, assessChannels, type HeardIn} from '../hearing/deviceCheck';
import {Colors, Fonts, Radius, Spacing, Styles} from '../theme';

type Step =
  | {kind: 'intro'}
  | {kind: 'measuring'}
  | {kind: 'problem'; message: string}
  | {kind: 'ear'; ear: 'left' | 'right'}
  | {kind: 'ready'};

const ANSWERS: {heard: HeardIn; text: string; label: string}[] = [
  {heard: 'left', text: 'Left', label: 'I heard it in my left ear'},
  {heard: 'right', text: 'Right', label: 'I heard it in my right ear'},
  {heard: 'both', text: 'Both ears', label: 'I heard it in both ears'},
  {heard: 'none', text: "I can't hear it", label: "I can't hear it"},
];

export default function DeviceCheckScreen({onDone}: {onDone: () => void}) {
  const [step, setStep] = useState<Step>({kind: 'intro'});
  const heardLeft = useRef<HeardIn>('none');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    Audio.setTestTone(null);
    Audio.stopAudio();
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    Audio.setMuted(true); // measure the room without playing it back
    if (!(await Audio.startAudio())) {
      setStep({
        kind: 'problem',
        message:
          Audio.getSessionStatus() === 'no_headphones'
            ? "Connect headphones to continue. Clarihear doesn't use the phone speaker."
            : "Clarihear couldn't start the microphone. Check your headphones and try again.",
      });
      return;
    }
    setStep({kind: 'measuring'});
    const levels: number[] = [];
    timer.current = setInterval(() => {
      levels.push(Audio.getInputLevel());
      if (levels.length < AMBIENT_CHECK.minReadings + 10) return;
      clearInterval(timer.current!);
      timer.current = null;
      const r = assessAmbient(levels);
      if (r.kind !== 'ok') {
        Audio.stopAudio();
        setStep({kind: 'problem', message: r.message});
        return;
      }
      Audio.setMuted(false);
      Audio.setTestTone('left');
      setStep({kind: 'ear', ear: 'left'});
    }, 100);
  }, []);

  const answer = (heard: HeardIn) => {
    if (step.kind !== 'ear') return;
    if (step.ear === 'left') {
      heardLeft.current = heard;
      Audio.setTestTone('right');
      setStep({kind: 'ear', ear: 'right'});
      return;
    }
    Audio.setTestTone(null);
    const r = assessChannels({left: heardLeft.current, right: heard});
    if (r.kind === 'ok') {
      setStep({kind: 'ready'});
    } else {
      Audio.stopAudio();
      setStep({kind: 'problem', message: r.message});
    }
  };

  return (
    <SafeAreaView style={Styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header">Headphone check</Text>
        {step.kind === 'intro' && (
          <>
            <Text style={styles.text}>Put on your headphones and sit somewhere quiet. We'll listen to the room for a few seconds, then play a short tone in each ear.</Text>
            <Btn label="Start check" onPress={start} />
          </>
        )}
        {step.kind === 'measuring' && (
          <Text style={styles.text} accessibilityLiveRegion="polite">Listening to the room… please stay quiet.</Text>
        )}
        {step.kind === 'ear' && (
          <>
            <Text style={styles.text} accessibilityLiveRegion="polite">Where do you hear the tone?</Text>
            {ANSWERS.map(a => (
              <Btn key={a.heard} label={a.label} text={a.text} onPress={() => answer(a.heard)} />
            ))}
          </>
        )}
        {step.kind === 'problem' && (
          <>
            <Text style={styles.warn} accessibilityLiveRegion="assertive">{step.message}</Text>
            <Btn label="Try again" onPress={() => setStep({kind: 'intro'})} />
          </>
        )}
        {step.kind === 'ready' && (
          <>
            <Text style={styles.text}>Your headphones are working in both ears.</Text>
            <Text style={styles.note}>{UNCALIBRATED_NOTICE}</Text>
            <Btn
              label="Continue"
              onPress={() => {
                cleanup();
                onDone();
              }}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Btn({label, text, onPress}: {label: string; text?: string; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.btn}>
      <Text style={styles.btnText}>{text ?? label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {flex: 1, padding: Spacing.lg, gap: Spacing.md, justifyContent: 'center'},
  title: {color: Colors.textPrimary, fontSize: 28, fontFamily: Fonts.bold},
  text: {color: Colors.textPrimary, fontSize: 20},
  warn: {color: Colors.warning, fontSize: 20},
  note: {color: Colors.textSecondary, fontSize: 16},
  btn: {minHeight: 60, borderRadius: Radius.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md},
  btnText: {color: Colors.bg1, fontSize: 20, fontFamily: Fonts.bold},
});
