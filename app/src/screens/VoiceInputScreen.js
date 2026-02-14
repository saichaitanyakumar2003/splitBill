import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getVoiceInputDraft, setVoiceInputDraft, clearVoiceInputDraft } from '../store/voiceInputDraft';
import { authGet } from '../utils/apiHelper';
import { api } from '../api/client';
import { parseVoiceWithGemini } from '../utils/geminiVoiceParse';

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

// Ignore when user starts/stops with no voice (no match, client error, etc.) — do not show any error.
function isIgnorableSpeechError(error) {
  if (error == null) return true;
  if (typeof error === 'object' && [5, 7, 11].includes(Number(error.code))) return true;
  const msg = typeof error === 'string' ? error : (error.message || (error.code != null ? String(error.code) : '') || String(error));
  const lower = msg.toLowerCase();
  if (/^(5|7|11)(\/|\s|$)/.test(String(msg).trim())) return true;
  if (lower.includes('no match') || lower.includes('client error') || lower.includes("didn't understand") || lower.includes('didnt understand')) return true;
  return false;
}

export default function VoiceInputScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [transcript, setTranscript] = useState(() => getVoiceInputDraft());
  const [isRecording, setIsRecording] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const transcriptRef = useRef(transcript);
  const lastFinalRef = useRef('');

  // Group: active groups list, search query, selected group (or typed name = new group)
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null); // single selection only: { id, name } or null
  const [expenseName, setExpenseName] = useState('');
  const [geminiError, setGeminiError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    transcriptRef.current = transcript;
    setVoiceInputDraft(transcript);
  }, [transcript]);

  // Fetch active groups for group search
  const fetchGroups = useCallback(async () => {
    try {
      const response = await authGet('/groups');
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []);
      const activeGroups = list.filter((g) => g.status === 'active');
      setGroups(activeGroups);
    } catch (e) {
      console.error('VoiceInput: fetch groups error', e);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Show matching active groups only when user has typed something (not out of the box)
  const searchTrimmed = groupSearchQuery.trim();
  const filteredGroups = searchTrimmed
    ? groups.filter((g) => g.name.toLowerCase().includes(searchTrimmed.toLowerCase()))
    : [];

  const hasGroupOrName = selectedGroup !== null || groupSearchQuery.trim().length > 0;

  // Ask for mic permission only once. If already granted (e.g. after app restart), do not ask again.
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
    const permission = PermissionsAndroid.PERMISSIONS?.RECORD_AUDIO || 'android.permission.RECORD_AUDIO';
    try {
      const alreadyGranted = await PermissionsAndroid.check(permission);
      if (alreadyGranted === true || alreadyGranted === 'granted') {
        setPermissionGranted(true);
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
      return ok;
    } catch (e) {
      return false;
    }
  };

  // Voice listeners: same pattern as reference — lastFinalRef avoids duplicate result events.
  useEffect(() => {
    if (!Voice) return;

    Voice.removeAllListeners?.();

    Voice.onSpeechStart = () => {
      setSpeechError(null);
      setIsRecording(true);
    };

    Voice.onSpeechResults = (e) => {
      const raw = e?.value?.[0] ?? e?.results?.[0]?.value?.[0];
      const result = typeof raw === 'string' ? raw : (raw?.transcript ?? '');
      const trimmed = result ? String(result).trim() : '';

      if (!trimmed || trimmed === lastFinalRef.current) return;

      lastFinalRef.current = trimmed;
      setTranscript((prev) => (prev ? prev + ' ' + trimmed : trimmed));
    };

    Voice.onSpeechEnd = () => setIsRecording(false);

    Voice.onSpeechError = (e) => {
      setIsRecording(false);
      const err = e?.error ?? e;
      if (isIgnorableSpeechError(err)) {
        setSpeechError(null);
      } else {
        const msg = err?.message ?? err?.error ?? (typeof err === 'string' ? err : 'Speech recognition error');
        setSpeechError(msg);
      }
    };

    return () => {
      if (Voice) {
        const p = Voice.destroy?.();
        if (p && typeof p.then === 'function') {
          p.then(() => Voice.removeAllListeners?.());
        } else {
          Voice.removeAllListeners?.();
        }
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!Voice) return;
    lastFinalRef.current = '';
    setSpeechError(null);
    const hasPermission = await ensureMicPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Please allow microphone access to use voice input for expenses.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      await Voice.start('en-US');
    } catch (e) {
      setSpeechError(e?.message || 'Failed to start recording');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!Voice) return;
    setSpeechError(null);
    try {
      await Voice.stop();
    } catch (e) {
      setSpeechError(e?.message || 'Failed to stop recording');
      setIsRecording(false);
    }
  }, []);

  const toggleRecording = async () => {
    if (!Voice) {
      Alert.alert('Not available', 'Voice input is only available on Android with a development build.');
      return;
    }
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const displayValue = transcript;
  const canContinue =
    transcript.trim().length > 0 &&
    !isRecording &&
    hasGroupOrName &&
    expenseName.trim().length > 0;
  const voiceUnavailable = !Voice;

  const handleBack = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  // Error messages that mean Gemini couldn't produce valid JSON (hallucination / unclear preview)
  const PARSE_ERROR_MESSAGES = [
    'No response from Gemini',
    'Failed to parse voice response',
    'Invalid response: missing payer name',
    'Invalid response: totalAmount must be a positive number',
  ];
  const isParseOrHallucinationError = (msg) =>
    PARSE_ERROR_MESSAGES.some((m) => (msg || '').includes(m));

  const handleContinue = async () => {
    if (!canContinue || isSubmitting) return;
    setGeminiError(null);
    setIsSubmitting(true);
    try {
      const config = await api.getOcrConfig();
      const userName = user?.name || user?.mailId?.split('@')[0] || 'Me';
      const voiceResult = await parseVoiceWithGemini(displayValue, config.apiKey, userName);
      const groupName = selectedGroup ? selectedGroup.name : groupSearchQuery.trim();
      const groupId = selectedGroup ? selectedGroup.id : null;
      const isNewGroup = !selectedGroup;
      navigation.navigate('VoicePreview', {
        groupName,
        groupId,
        expenseName: expenseName.trim(),
        voiceResult,
        isNewGroup,
      });
    } catch (err) {
      const msg = err?.message || '';
      if (isParseOrHallucinationError(msg)) {
        setGeminiError('Please improve the preview to make better understanding.');
      } else if (/rate limit|resource_exhausted|quota/i.test(msg)) {
        setGeminiError('Rate limit reached. Please wait a minute and try again.');
      } else {
        setGeminiError(msg || 'Failed to parse voice input. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
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

              <View style={styles.groupSection}>
                <Text style={styles.groupLabel}>Group</Text>
                <View style={styles.groupSearchBox}>
                  <View style={styles.groupSearchInputRow}>
                    <View style={styles.groupSearchIconWrap}>
                      <Ionicons name="search" size={20} color="#E85A24" style={styles.groupSearchIcon} />
                    </View>
                    <TextInput
                      style={styles.groupSearchInput}
                      placeholder="Search active groups or enter name for new group"
                      placeholderTextColor="#999"
                      value={groupSearchQuery}
                      onChangeText={(text) => {
                        setGroupSearchQuery(text);
                        setSelectedGroup(null);
                      }}
                    />
                    <View style={styles.groupSearchClearWrap}>
                      {groupSearchQuery.length > 0 && (
                        <Pressable onPress={() => { setGroupSearchQuery(''); setSelectedGroup(null); }} hitSlop={8}>
                          <Ionicons name="close-circle" size={20} color="#999" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                  {searchTrimmed.length > 0 && filteredGroups.length > 0 ? (
                    <ScrollView
                      style={styles.groupListScroll}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {filteredGroups.map((g, index) => {
                        const id = String(g._id || g.id);
                        const isSelected = selectedGroup != null && String(selectedGroup.id) === id;
                        return (
                          <React.Fragment key={id}>
                            <Pressable
                              style={[styles.groupItem, isSelected && styles.groupItemSelected]}
                              onPress={() => {
                                setSelectedGroup({ id, name: g.name });
                                setGroupSearchQuery(g.name);
                              }}
                            >
                              <Text style={styles.groupItemName} numberOfLines={1}>{g.name}</Text>
                              {isSelected && <Ionicons name="checkmark-circle" size={22} color="#E85A24" />}
                            </Pressable>
                            {index < filteredGroups.length - 1 ? <View style={styles.groupItemSeparator} /> : null}
                          </React.Fragment>
                        );
                      })}
                    </ScrollView>
                  ) : searchTrimmed.length > 0 && !groupsLoading && filteredGroups.length === 0 ? (
                    <View style={styles.groupNewHint}>
                      <Text style={styles.groupNewHintText}>
                        No match. &quot;{searchTrimmed}&quot; will be created as new group.
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.expenseNameSection}>
                <Text style={styles.expenseNameLabel}>Expense name</Text>
                <TextInput
                  style={styles.expenseNameInput}
                  placeholder="Enter expense name"
                  placeholderTextColor="#999"
                  value={expenseName}
                  onChangeText={setExpenseName}
                />
              </View>

              <View style={styles.previewSection}>
                <View style={styles.previewLabelRow}>
                  <Text style={styles.previewLabel}>Preview (editable)</Text>
                  <Pressable onPress={() => { clearVoiceInputDraft(); setTranscript(''); }} hitSlop={8}>
                    <Text style={styles.clearLink}>Clear</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.previewInput}
                  placeholder="Tap record, speak, then stop. Your speech will appear here. You can edit the text. Please mention the expense name, paid by whom and split members, amounts clearly."
                  placeholderTextColor="#999"
                  value={displayValue}
                  onChangeText={setTranscript}
                  multiline
                  editable={true}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.continueButtonContainer}>
              <Pressable
                style={[
                  styles.continueButton,
                  canContinue && styles.continueButtonEnabled,
                  !canContinue && styles.continueButtonDisabled,
                ]}
                onPress={handleContinue}
                disabled={!canContinue || isSubmitting}
              >
                <Text style={[styles.continueButtonText, canContinue && styles.continueButtonTextEnabled]}>
                  Continue
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </LinearGradient>

      {/* Processing modal - same style as image processing */}
      <Modal
        visible={isSubmitting}
        transparent
        animationType="fade"
      >
        <View style={styles.processingOverlay}>
          <View style={styles.processingContent}>
            <ActivityIndicator size="large" color="#E85A24" />
            <Text style={styles.processingText}>Please wait while we are processing...</Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!geminiError}
        transparent
        animationType="fade"
        onRequestClose={() => setGeminiError(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Error</Text>
              <Pressable
                onPress={() => setGeminiError(null)}
                style={styles.modalCloseButton}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color="#333" />
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.modalErrorText}>{geminiError}</Text>
            </ScrollView>
            <Pressable
              style={styles.modalDismissButton}
              onPress={() => setGeminiError(null)}
            >
              <Text style={styles.modalDismissButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContent: {
    alignItems: 'center',
  },
  processingText: {
    marginTop: 20,
    fontSize: 18,
    color: '#FFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: 320,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 24,
  },
  modalErrorText: {
    fontSize: 14,
    color: '#C62828',
    lineHeight: 22,
  },
  modalDismissButton: {
    backgroundColor: '#E85A24',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDismissButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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
  groupSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  groupSearchBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  groupSearchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  groupSearchIconWrap: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupSearchIcon: {
    opacity: 1,
  },
  groupSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
    paddingRight: 8,
  },
  groupSearchClearWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupListScroll: {
    maxHeight: 160,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
  },
  groupItemSelected: {
    backgroundColor: 'rgba(232, 90, 36, 0.08)',
  },
  groupItemSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginLeft: 14,
    marginRight: 14,
  },
  groupItemName: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  groupNewHint: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(232, 90, 36, 0.08)',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  groupNewHintText: {
    fontSize: 14,
    color: '#333',
  },
  expenseNameSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  expenseNameLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  expenseNameInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  previewSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  previewLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  clearLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E85A24',
    marginRight: 12,
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
