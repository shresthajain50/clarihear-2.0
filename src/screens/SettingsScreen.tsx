// screens/SettingsScreen.tsx — minimal settings (PRD §31). Developer diagnostics
// appear only when developer mode is available (debug builds).
import React from 'react';
import {Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import {Colors, Fonts, Radius, Spacing, Styles} from '../theme';

interface Props {
  devModeAvailable: boolean;
  onBack: () => void;
  onRepeatCheck: () => void;
  onOpenDeveloper: () => void;
}

export default function SettingsScreen({devModeAvailable, onBack, onRepeatCheck, onOpenDeveloper}: Props) {
  const items: [string, () => void][] = [
    ['Back to listening', onBack],
    ['Repeat hearing check', onRepeatCheck],
    ...(devModeAvailable ? ([['Developer diagnostics', onOpenDeveloper]] as [string, () => void][]) : []),
  ];
  return (
    <SafeAreaView style={Styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header">Settings</Text>
        {items.map(([label, onPress]) => (
          <Pressable key={label} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.item}>
            <Text style={styles.itemText}>{label}</Text>
          </Pressable>
        ))}
        <Text style={styles.foot}>
          Clarihear is a screening and hearing-assistance tool. It does not replace a medical hearing evaluation.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {flex: 1, padding: Spacing.md, gap: Spacing.sm},
  title: {color: Colors.textPrimary, fontSize: 28, fontFamily: Fonts.bold, paddingVertical: Spacing.md},
  item: {minHeight: 60, borderRadius: Radius.md, backgroundColor: Colors.glass, justifyContent: 'center', paddingHorizontal: Spacing.md},
  itemText: {color: Colors.textPrimary, fontSize: 20},
  foot: {color: Colors.textSecondary, fontSize: 15, marginTop: Spacing.lg},
});
