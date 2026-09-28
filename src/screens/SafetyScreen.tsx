// screens/SafetyScreen.tsx — safety / eligibility questions (PRD §9). Logic lives in
// hearing/eligibility.ts; this screen only collects answers.
import React, {useState} from 'react';
import {Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SAFETY_QUESTIONS, assessEligibility, type EligibilityResult, type SafetyAnswers} from '../hearing/eligibility';
import {Colors, Fonts, Radius, Spacing, Styles} from '../theme';

export default function SafetyScreen({onResult}: {onResult: (r: EligibilityResult) => void}) {
  const [answers, setAnswers] = useState<SafetyAnswers>({});
  const [missing, setMissing] = useState(false);

  const submit = () => {
    const r = assessEligibility(answers);
    setMissing(r.kind === 'incomplete');
    onResult(r);
  };

  return (
    <SafeAreaView style={Styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title} accessibilityRole="header">A few safety questions</Text>
        <Text style={styles.sub}>These help us check whether Clarihear is right for you.</Text>
        {SAFETY_QUESTIONS.map(q => (
          <View key={q.id} style={[Styles.glassCard, styles.card]}>
            <Text style={styles.q}>{q.text}</Text>
            <View style={styles.row}>
              {[true, false].map(v => (
                <Pressable
                  key={String(v)}
                  onPress={() => setAnswers(a => ({...a, [q.id]: v}))}
                  accessibilityRole="radio"
                  accessibilityLabel={`${q.text} ${v ? 'Yes' : 'No'}`}
                  accessibilityState={{checked: answers[q.id] === v}}
                  style={[styles.opt, answers[q.id] === v && styles.optOn]}>
                  <Text style={styles.optText}>{v ? 'Yes' : 'No'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        {missing && <Text style={styles.warn} accessibilityLiveRegion="assertive">Please answer every question.</Text>}
        <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Continue" style={styles.cta}>
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: Spacing.md, gap: Spacing.md},
  title: {color: Colors.textPrimary, fontSize: 28, fontFamily: Fonts.bold, paddingTop: Spacing.md},
  sub: {color: Colors.textSecondary, fontSize: 18},
  card: {padding: Spacing.md, gap: Spacing.sm},
  q: {color: Colors.textPrimary, fontSize: 20},
  row: {flexDirection: 'row', gap: Spacing.sm},
  opt: {flex: 1, minHeight: 52, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.glassBorder, alignItems: 'center', justifyContent: 'center'},
  optOn: {backgroundColor: Colors.primary, borderColor: Colors.primary},
  optText: {color: Colors.textPrimary, fontSize: 18, fontFamily: Fonts.bold},
  warn: {color: Colors.warning, fontSize: 18},
  cta: {minHeight: 60, borderRadius: Radius.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center'},
  ctaText: {color: Colors.bg1, fontSize: 20, fontFamily: Fonts.bold},
});
