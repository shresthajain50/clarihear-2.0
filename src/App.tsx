// ============================================================
//  App.tsx  —  Clarihear root
//
//  Navigation is the pure state machine in app/appFlow.ts (PRD §7, §35):
//    welcome → safety → device check → [DIN, when stimuli exist] → profile → listening
//                 ↘ professional referral (sticky) ↙
//  Screens only render state and dispatch events.
//
//  ponytail: profile is not persisted yet — storage/profileStore.ts is ready, but its
//  secure backend needs a device build (OPEN_QUESTIONS Q8).
// ============================================================

import React, {useCallback, useReducer, useState} from 'react';
import {Alert, Linking, PermissionsAndroid, Platform, StatusBar, StyleSheet, Text, View} from 'react-native';
import {Colors} from './theme';
import {appFlow, initialFlow} from './app/appFlow';
import {FITTING_VERSION, fitHearingProfile} from './hearing/fitting';
import {dbHL, type FrequencyThresholds} from './hearing/types';
import type {Audiogram} from './native/types';
import OnboardingScreen from './screens/OnboardingScreen';
import SafetyScreen from './screens/SafetyScreen';
import PermissionScreen from './screens/PermissionScreen';
import DeviceCheckScreen from './screens/DeviceCheckScreen';
import AudiogramScreen from './screens/AudiogramScreen';
import ReferralScreen from './screens/ReferralScreen';
import ListeningScreen from './screens/ListeningScreen';
import SettingsScreen from './screens/SettingsScreen';
import DeveloperScreen from './screens/DeveloperScreen';

const toThresholds = (hl: readonly number[]) => hl.map(dbHL) as unknown as FrequencyThresholds;

const micNeeded = () =>
  Alert.alert('Microphone needed', 'Live listening needs microphone access. You can allow it in Settings.', [
    {text: 'Not now', style: 'cancel'},
    {text: 'Open Settings', onPress: () => Linking.openSettings()},
  ]);

async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS prompts when audio starts
  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Microphone access',
      message: 'Clarihear needs your microphone to help you hear. Audio stays on this device.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    return r === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export default function App() {
  const [flow, dispatch] = useReducer(appFlow, initialFlow({devModeAvailable: __DEV__}));
  const [micGranted, setMicGranted] = useState(false);

  const onPermission = useCallback(async () => {
    if (await requestMicPermission()) setMicGranted(true);
    else micNeeded();
  }, []);

  const onAudiogram = useCallback((ag: Audiogram) => {
    try {
      const result = fitHearingProfile({
        left: toThresholds(ag.left),
        right: toThresholds(ag.right),
        source: 'audiogram_import',
        confidence: 1,
        fittingVersion: FITTING_VERSION,
      });
      dispatch({type: 'FIT_RESULT', result});
    } catch {
      Alert.alert('Check your audiogram', 'Some values look out of range. Please re-enter them from your report.');
    }
  }, []);

  const screen = (() => {
    switch (flow.state) {
      case 'first_launch':
        return <OnboardingScreen onComplete={() => dispatch({type: 'START'})} />;
      case 'safety_check':
        return <SafetyScreen onResult={result => dispatch({type: 'SAFETY_RESULT', result})} />;
      case 'device_check':
        if (micGranted) return <DeviceCheckScreen onDone={() => dispatch({type: 'DEVICE_READY'})} />;
        return (
          <PermissionScreen
            onGranted={onPermission}
            onDenied={() => micNeeded()}
          />
        );
      case 'screening':
      case 'screening_result':
        // Unreachable until validated DIN stimuli exist (flow.screeningAvailable, Q6).
        return <Text style={styles.fallback}>Hearing screening isn't available in this version.</Text>;
      case 'profile_setup':
        return <AudiogramScreen onComplete={onAudiogram} onSkip={() => dispatch({type: 'SKIP_PROFILE'})} />;
      case 'professional_referral':
        return <ReferralScreen urgent={Boolean(flow.urgent)} onRestart={() => dispatch({type: 'RESTART'})} />;
      case 'listening':
        return <ListeningScreen dsp={flow.dsp!} onOpenSettings={() => dispatch({type: 'OPEN_SETTINGS'})} />;
      case 'settings':
        return (
          <SettingsScreen
            devModeAvailable={flow.devModeAvailable}
            onBack={() => dispatch({type: 'CLOSE_SETTINGS'})}
            onRepeatCheck={() => dispatch({type: 'REPEAT_CHECK'})}
            onOpenDeveloper={() => dispatch({type: 'OPEN_DEVELOPER'})}
          />
        );
      case 'developer':
        return <DeveloperScreen dspProfile={flow.dsp} onClose={() => dispatch({type: 'CLOSE_DEVELOPER'})} />;
    }
  })();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg1} translucent={false} />
      {screen}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: Colors.bg1},
  fallback: {color: Colors.textPrimary, fontSize: 20, padding: 24},
});
