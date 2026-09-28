// screens/ReferralScreen.tsx — professional referral (PRD §9, §52). Not dismissible by accident:
// the only way on is "Start over", which needs a second, explicit confirmation.
import React, {useState} from 'react';
import {Linking, Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import {REFERRAL_MESSAGE, URGENT_MESSAGE} from '../hearing/eligibility';
import {Colors, Fonts, Radius, Spacing, Styles} from '../theme';

interface Props {
  urgent: boolean;
  onRestart: () => void;
}

export default function ReferralScreen({urgent, onRestart}: Props) {
  const [confirming, setConfirming] = useState(false);
  return (
    <SafeAreaView style={Styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header">A professional check is the best next step</Text>
        <Text style={styles.msg}>{REFERRAL_MESSAGE}</Text>
        {urgent && <Text style={styles.urgent}>{URGENT_MESSAGE}</Text>}
        <Text style={styles.sub}>Clarihear won't set up personalized amplification for now. Your answers stay on this device.</Text>

        <Pressable
          onPress={() => Linking.openURL('https://www.google.com/search?q=audiologist+near+me')}
          accessibilityRole="link"
          accessibilityLabel="Find an audiologist or ENT near me"
          style={styles.cta}>
          <Text style={styles.ctaText}>Find an audiologist or ENT</Text>
        </Pressable>

        {confirming ? (
          <View style={styles.confirm}>
            <Text style={styles.sub}>Only start over if you answered a question by mistake.</Text>
            <View style={styles.row}>
              <Pressable onPress={() => setConfirming(false)} accessibilityRole="button" accessibilityLabel="Cancel" style={styles.secondary}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onRestart} accessibilityRole="button" accessibilityLabel="Yes, start over" style={styles.secondary}>
                <Text style={styles.secondaryText}>Yes, start over</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setConfirming(true)} accessibilityRole="button" accessibilityLabel="Start over" style={styles.secondary}>
            <Text style={styles.secondaryText}>Start over</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {flex: 1, padding: Spacing.lg, gap: Spacing.md, justifyContent: 'center'},
  title: {color: Colors.textPrimary, fontSize: 28, fontFamily: Fonts.bold},
  msg: {color: Colors.textPrimary, fontSize: 20},
  urgent: {color: Colors.warning, fontSize: 20, fontFamily: Fonts.bold},
  sub: {color: Colors.textSecondary, fontSize: 17},
  cta: {minHeight: 60, borderRadius: Radius.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center'},
  ctaText: {color: Colors.bg1, fontSize: 20, fontFamily: Fonts.bold},
  confirm: {gap: Spacing.sm},
  row: {flexDirection: 'row', gap: Spacing.sm},
  secondary: {flex: 1, minHeight: 52, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.glassBorder, alignItems: 'center', justifyContent: 'center'},
  secondaryText: {color: Colors.textPrimary, fontSize: 18, fontFamily: Fonts.medium},
});
