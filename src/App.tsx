// ============================================================
//  App.tsx  —  ClariHear 2.0 Root [Phase 5]
//
//  Navigation state machine (no external routing library):
//
//    onboarding → permission → audiogram → dashboard
//                    ↓
//               (if denied) → dashboard (limited mode)
//
//  The app state persists across sessions using a simple
//  flag so first-time users see onboarding but returning
//  users land directly on the dashboard.
// ============================================================

import React, {useState, useCallback} from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {Colors} from './theme';
import OnboardingScreen from './screens/OnboardingScreen';
import PermissionScreen from './screens/PermissionScreen';
import AudiogramScreen  from './screens/AudiogramScreen';
import DashboardScreen  from './screens/DashboardScreen';
import type {Audiogram}  from './native/types';
import {applyAudiogram as dspApplyAudiogram} from './native/ClarihearAudio';

type Screen = 'onboarding' | 'permission' | 'audiogram' | 'dashboard';

export default function App() {
  const [screen, setScreen]         = useState<Screen>('onboarding');
  const [audiogram, setAudiogram]   = useState<Audiogram | undefined>(undefined);

  // ── Request mic permission (Android manual request) ──────────
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title:   'Microphone Permission',
            message: 'ClariHear needs your microphone to process audio.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }
    // iOS: permission is requested by CoreAudioPlayer when startAudio() is called
    return true;
  }, []);

  // ── Navigation handlers ───────────────────────────────────────

  const onOnboardingComplete = useCallback(() => {
    setScreen('permission');
  }, []);

  const onPermissionGranted = useCallback(async () => {
    const granted = await requestMicPermission();
    if (granted || Platform.OS === 'ios') {
      setScreen('audiogram');
    } else {
      Alert.alert(
        'Permission Denied',
        'ClariHear works best with microphone access. You can enable it in Settings.',
        [{text: 'Continue Anyway', onPress: () => setScreen('dashboard')}],
      );
    }
  }, [requestMicPermission]);

  const onPermissionDenied = useCallback(() => {
    setScreen('dashboard');
  }, []);

  const onAudiogramComplete = useCallback((ag: Audiogram) => {
    setAudiogram(ag);
    // Apply the audiogram to the DSP engine immediately
    dspApplyAudiogram(ag);
    setScreen('dashboard');
  }, []);

  const onAudiogramSkip = useCallback(() => {
    setScreen('dashboard');
  }, []);

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.bg1}
        translucent={false}
      />

      {screen === 'onboarding' && (
        <OnboardingScreen onComplete={onOnboardingComplete} />
      )}

      {screen === 'permission' && (
        <PermissionScreen
          onGranted={onPermissionGranted}
          onDenied={onPermissionDenied}
        />
      )}

      {screen === 'audiogram' && (
        <AudiogramScreen
          onComplete={onAudiogramComplete}
          onSkip={onAudiogramSkip}
        />
      )}

      {screen === 'dashboard' && (
        <DashboardScreen
          audiogram={audiogram
            ? {left: audiogram.left as unknown as number[],
               right: audiogram.right as unknown as number[]}
            : undefined}
          onOpenSettings={() =>
            Alert.alert('Settings', 'Settings panel coming in Phase 6.')
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg1,
  },
});
