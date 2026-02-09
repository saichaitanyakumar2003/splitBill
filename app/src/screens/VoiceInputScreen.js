import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const isAndroid = Platform.OS === 'android';

// Load Voice only on Android to avoid crashes on web/iOS or when native module isn't built yet
let Voice = null;
if (isAndroid) {
  try {
    Voice = require('@react-native-voice/voice').default;
  } catch (e) {
    // Module not available (e.g. old binary, Expo Go)
  }
}

export default function VoiceInputScreen() {
  const navigation = useNavigation();
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [speechError, setSpeechError] = useState(null);
  const listenersRef = useRef([]);

  // Same pattern as Upload Photo: check/request permission on tap, then proceed or show Alert.
  const ensureMicPermission = async () => {
    if (!isAndroid) return true;
    let PermissionsAndroid;
    try {
      const RN = require('react-native');
      PermissionsAndroid = RN.PermissionsAndroid;
    } catch (e) {
      return false;
    }
    if (!PermissionsAndroid) return false;
    try {
      const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
      const existing = await PermissionsAndroid.check(permission);
      if (existing) {
        setPermissionGranted(true);
        setPermissionError(null);
        return true;
      }
      const granted = await PermissionsAndroid.request(permission, {
        title: 'Microphone permission',
        message: 'SplitBill needs microphone access for voice input.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      });
      const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
      setPermissionGranted(ok);
      setPermissionError(ok ? null : 'Microphone permission is required for voice input.');
      return ok;
    } catch (e) {
      setPermissionError('Could not request microphone permission.');
      return false;
    }
  };

  // Permission is requested when user taps the record button (not on screen load)
  useEffect(() => {
    return () => {
      if (Voice) {
        Voice.removeAllListeners?.();
        Voice.destroy?.();
      }
    };
  }, []);

  // Attach Voice listeners as soon as Voice is available so they're ready before first start()
  useEffect(() => {
    if (!Voice) return;

    const onSpeechStart = () => {
      setSpeechError(null);
      setIsRecording(true);
    };
    const onSpeechEnd = () => {
      setIsRecording(false);
    };
    const onSpeechResults = (e) => {
      const value = e?.value ?? e?.results?.[0]?.value;
      if (Array.isArray(value) && value.length > 0) {
        const text = value.map((t) => (typeof t === 'string' ? t : t?.transcript ?? '')).filter(Boolean).join(' ');
        if (text) {
          setTranscript((prev) => (prev ? prev + ' ' + text : text));
        }
      } else if (typeof value === 'string' && value.trim()) {
        setTranscript((prev) => (prev ? prev + ' ' + value : value));
      }
    };
    const onSpeechError = (e) => {
      setSpeechError(e.error?.message || e.error || 'Speech recognition error');
      setIsRecording(false);
    };

    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;
    listenersRef.current = [onSpeechStart, onSpeechEnd, onSpeechResults, onSpeechError];

    return () => {
      Voice.removeAllListeners?.();
    };
  }, []);

  const toggleRecording = async () => {
    if (!Voice) {
      Alert.alert('Not available', 'Voice input is only available on Android with a development build.');
      return;
    }
    if (isRecording) {
      setSpeechError(null);
      try {
        await Voice.stop();
      } catch (e) {
        setSpeechError(e.message || 'Failed to stop recording');
        setIsRecording(false);
      }
      return;
    }
    // Starting: same as Upload Photo — check/request permission, then proceed or show Alert
    try {
      const hasPermission = await ensureMicPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please allow microphone access to use voice input for expenses.',
          [{ text: 'OK' }]
        );
        return;
      }
      setSpeechError(null);
      await Voice.start('en-US');
    } catch (e) {
      setSpeechError(e.message || 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const canContinue = transcript.trim().length > 0 && !isRecording;
  const voiceUnavailable = !Voice;

  const handleBack = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  // Unavailable state: orange top + white card with message
  if (voiceUnavailable) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#F57C3A', '#E85A24', '#D84315']}
          style={styles.gradient}
        >
          <StatusBar style="light" />
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
              onPress={handleBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {({ pressed }) => (
                <Ionicons name="arrow-back" size={24} color="#E85A24" style={pressed && { opacity: 0.7 }} />
              )}
            </Pressable>
<Text style={styles.headerTitleCentered} pointerEvents="none">Voice input</Text>
        </View>
        <View style={styles.whiteContentArea}>
          <View style={styles.unavailableBox}>
              <View style={styles.unavailableIconCircle}>
                <Ionicons name="mic-off-outline" size={32} color="#E85A24" />
              </View>
              <Text style={styles.unavailableTitle}>Not available</Text>
              <Text style={styles.unavailableText}>
                Voice input is only available on the Android app. Please use a development build.
              </Text>
              <Pressable style={({ pressed }) => [styles.backLinkButton, pressed && { opacity: 0.8 }]} onPress={handleBack}>
                <Text style={styles.backLinkButtonText}>Go back</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Main layout: orange top + white card at bottom
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F57C3A', '#E85A24', '#D84315']}
        style={styles.gradient}
      >
        <StatusBar style="light" />

        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {({ pressed }) => (
              <Ionicons name="arrow-back" size={24} color="#E85A24" style={pressed && { opacity: 0.7 }} />
            )}
          </Pressable>
          <Text style={styles.headerTitleCentered} pointerEvents="none">Voice input</Text>
        </View>

        <View style={styles.decorativeIconContainer}>
          <View style={styles.decorativeIconCircle}>
            <Ionicons name="mic" size={26} color="#E85A24" />
          </View>
        </View>

        <View style={styles.whiteContentArea}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {permissionError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{permissionError}</Text>
                  <TouchableOpacity onPress={ensureMicPermission}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.recordSection}>
                <Pressable
                  style={({ pressed }) => [
                    styles.recordButton,
                    isRecording && styles.recordButtonActive,
                    pressed && !isRecording && styles.recordButtonPressed,
                  ]}
                  onPress={toggleRecording}
                  disabled={!Voice}
                >
                  <Ionicons name={isRecording ? 'stop' : 'mic'} size={40} color="#FFF" />
                </Pressable>
                <Text style={styles.recordLabel}>{isRecording ? 'Stop recording' : 'Tap to record'}</Text>
              </View>

              {speechError ? (
                <Text style={styles.speechErrorText}>{speechError}</Text>
              ) : null}

              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>Preview (editable)</Text>
                <TextInput
                  style={styles.previewInput}
                  placeholder="Tap record, speak, then stop. Your speech will appear here. You can edit the text. Please mention the expense name, paid by whom and split members, amounts clearly."
                  placeholderTextColor="#999"
                  value={transcript}
                  onChangeText={setTranscript}
                  multiline
                  editable={true}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Continue is intentionally non-functional for now - fixed at bottom */}
            <View style={styles.continueButtonContainer}>
              <Pressable
                style={[
                  styles.continueButton,
                  canContinue && styles.continueButtonEnabled,
                  !canContinue && styles.continueButtonDisabled,
                ]}
                onPress={() => {}}
                disabled={!canContinue}
              >
                <Text style={[styles.continueButtonText, canContinue && styles.continueButtonTextEnabled]}>
                  Continue
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 55,
    paddingHorizontal: 20,
    paddingBottom: 24,
    position: 'relative',
  },
  headerTitleCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPressed: {
    backgroundColor: '#F5F5F5',
    opacity: 0.9,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 12,
  },
  decorativeIconContainer: {
    alignItems: 'center',
    marginTop: 5,
    marginBottom: -25,
    zIndex: 20,
  },
  decorativeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  whiteContentArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 0,
    overflow: 'hidden',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  continueButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 71, 87, 0.12)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#C62828',
    flex: 1,
    fontSize: 14,
  },
  retryText: {
    color: '#E85A24',
    fontWeight: '600',
    fontSize: 14,
  },
  recordSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E85A24',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  recordButtonActive: {
    backgroundColor: '#C62828',
  },
  recordButtonPressed: {
    opacity: 0.9,
  },
  recordLabel: {
    marginTop: 10,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  speechErrorText: {
    color: '#C62828',
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 13,
  },
  previewSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  previewInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    color: '#333',
    fontSize: 16,
    minHeight: 260,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonEnabled: {
    backgroundColor: '#E85A24',
  },
  continueButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  continueButtonTextEnabled: {
    color: '#FFF',
  },
  continueButtonTextDisabled: {
    color: '#999',
  },
  // Unavailable state
  unavailableBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingTop: 60,
  },
  unavailableIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(232, 90, 36, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  unavailableText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  backLinkButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#E85A24',
    borderRadius: 12,
  },
  backLinkButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
