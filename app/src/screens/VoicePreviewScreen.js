import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { authGet, authPost } from '../utils/apiHelper';

export default function VoicePreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const params = route.params || {};
  const {
    groupName,
    groupId: existingGroupId,
    expenseName,
    voiceResult,
  } = params;

  const [payerSelected, setPayerSelected] = useState(null);
  const [payerSearchQuery, setPayerSearchQuery] = useState('');
  const [payerSearchResults, setPayerSearchResults] = useState([]);
  const [isPayerSearching, setIsPayerSearching] = useState(false);
  const [isPayerDropdownOpen, setIsPayerDropdownOpen] = useState(false);

  // splitSelections: only non-payer members (payer excluded so they don't owe themselves)
  const [splitSelections, setSplitSelections] = useState(() => {
    const payerName = (voiceResult?.payer?.name ?? '').trim().toLowerCase();
    const excludePayer = (name) => {
      const n = (name || '').trim().toLowerCase();
      if (!n || n === 'me' || n === 'i' || n === 'myself') return true;
      if (n === payerName) return true;
      if (payerName && (n.includes(payerName) || payerName.includes(n))) return true;
      return false;
    };
    return (voiceResult?.splitMembers || [])
      .filter((m) => !excludePayer(m.name))
      .map((m) => ({
        nameFromVoice: m.name,
        amount: m.amount,
        selectedUser: null,
      }));
  });
  // Per-row search: index -> { query, results, searching, dropdownOpen }
  const [splitSearchState, setSplitSearchState] = useState({});
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const totalAmount = voiceResult?.totalAmount ?? 0;
  const payerNameFromVoice = (voiceResult?.payer?.name ?? '').trim().toLowerCase();

  const paramsValid = Boolean(groupName && expenseName && voiceResult?.payer && Array.isArray(voiceResult?.splitMembers));

  // Redirect if params missing
  useEffect(() => {
    if (!paramsValid) {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  }, [paramsValid, navigation]);

  // Auto-select payer if voice said "me"/"I" or name matches current user
  useEffect(() => {
    if (!user || payerSelected) return;
    const p = (payerNameFromVoice || '').trim().toLowerCase();
    const meMatch = p === 'me' || p === 'i' || p === 'myself';
    const nameMatch = user.name && p === user.name.trim().toLowerCase();
    const emailMatch = user.mailId && p === user.mailId.split('@')[0].toLowerCase();
    if (meMatch || nameMatch || emailMatch) {
      setPayerSelected({ mailId: user.mailId, name: user.name || 'You' });
    }
  }, [user, payerNameFromVoice, payerSelected]);

  // Fetch group members when existing group and try to auto-match split member names
  const [groupMembers, setGroupMembers] = useState([]);
  useEffect(() => {
    if (!existingGroupId) return;
    const fetchGroup = async () => {
      try {
        const response = await authGet(`/groups/${existingGroupId}`);
        const data = await response.json();
        if (data?.expenses) {
          const membersMap = new Map();
          data.expenses.forEach((exp) => {
            if (exp.payer) {
              const email = exp.payer.toLowerCase();
              if (!membersMap.has(email)) {
                membersMap.set(email, { mailId: email, name: email.split('@')[0] });
              }
            }
            (exp.payees || []).forEach((p) => {
              const mailId = (typeof p === 'object' ? p?.mailId : p)?.toLowerCase();
              const name = typeof p === 'object' ? p?.name : null;
              if (mailId && !membersMap.has(mailId)) {
                membersMap.set(mailId, { mailId, name: name || mailId.split('@')[0] });
              }
            });
          });
          setGroupMembers(Array.from(membersMap.values()));
        }
      } catch (e) {
        console.error('VoicePreview: fetch group error', e);
      }
    };
    fetchGroup();
  }, [existingGroupId]);

  // Levenshtein edit distance
  const levenshtein = useCallback((a, b) => {
    const sa = (a || '').toLowerCase();
    const sb = (b || '').toLowerCase();
    if (sa.length === 0) return sb.length;
    if (sb.length === 0) return sa.length;
    const matrix = [];
    for (let i = 0; i <= sb.length; i++) matrix[i] = [i];
    for (let j = 0; j <= sa.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= sb.length; i++) {
      for (let j = 1; j <= sa.length; j++) {
        const cost = sa[j - 1] === sb[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[sb.length][sa.length];
  }, []);

  // Similarity score 0–1: exact/contains get high score; else based on edit distance
  const getSimilarityScore = useCallback((query, candidate) => {
    const q = (query || '').trim().toLowerCase();
    const c = (candidate || '').trim().toLowerCase();
    if (!q || !c) return 0;
    if (q === c) return 1;
    if (c.includes(q) || q.includes(c)) return 0.95;
    const maxLen = Math.max(q.length, c.length);
    const dist = levenshtein(q, c);
    return Math.max(0, 1 - dist / maxLen);
  }, [levenshtein]);

  // Pick best match: score each result and return the one with highest score (if above threshold)
  const SIMILARITY_THRESHOLD = 0.35;
  const pickBestMatch = useCallback((query, results) => {
    if (!results || results.length === 0) return null;
    if (results.length === 1) {
      const r = results[0];
      const nameScore = getSimilarityScore(query, r.name || '');
      const emailScore = getSimilarityScore(query, (r.mailId || '').split('@')[0] || '');
      return (nameScore >= SIMILARITY_THRESHOLD || emailScore >= SIMILARITY_THRESHOLD) ? r : null;
    }
    const scored = results.map((r) => {
      const nameScore = getSimilarityScore(query, r.name || '');
      const emailScore = getSimilarityScore(query, (r.mailId || '').split('@')[0] || '');
      const score = Math.max(nameScore, emailScore);
      return { result: r, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    return best && best.score >= SIMILARITY_THRESHOLD ? best.result : null;
  }, [getSimilarityScore]);

  // Auto-select payer by similarity (when not "me"/"I" or exact match) and split members (runs once)
  const autoSelectAttempted = React.useRef(false);
  useEffect(() => {
    if (autoSelectAttempted.current) return;
    if (existingGroupId && groupMembers.length === 0) return;
    const run = async () => {
      // Payer: if not yet selected and voice gave a name that isn't "me"/"I", pick by similarity
      const p = (payerNameFromVoice || '').trim().toLowerCase();
      const isMe = p === 'me' || p === 'i' || p === 'myself';
      if (!payerSelected && p && !isMe && user) {
        let payerCandidates = [];
        if (groupMembers.length > 0) {
          payerCandidates = [...groupMembers];
          const userInGroup = payerCandidates.some((m) => m.mailId === user.mailId);
          if (!userInGroup) {
            payerCandidates.push({ mailId: user.mailId, name: user.name || user.mailId.split('@')[0] });
          }
        } else {
          try {
            const response = await authGet(`/auth/search?q=${encodeURIComponent(payerNameFromVoice.trim())}&forPayer=true`);
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
              payerCandidates = data.data;
            }
          } catch (e) {
            console.warn('Payer auto-select search error', e);
          }
        }
        if (payerCandidates.length > 0) {
          const bestPayer = pickBestMatch(payerNameFromVoice.trim(), payerCandidates);
          if (bestPayer) {
            setPayerSelected({ mailId: bestPayer.mailId, name: bestPayer.name || bestPayer.mailId });
          }
        }
      }

      let next = [...splitSelections];
      for (let i = 0; i < next.length; i++) {
        if (next[i].selectedUser) continue;
        const nameFromVoice = (next[i].nameFromVoice || '').trim();
        const nameLower = nameFromVoice.toLowerCase();
        if (!nameLower) continue;
        if ((nameLower === 'me' || nameLower === 'i') && user) {
          next[i] = { ...next[i], selectedUser: { mailId: user.mailId, name: user.name || 'You' } };
          continue;
        }
        if (groupMembers.length > 0) {
          const best = pickBestMatch(nameFromVoice, groupMembers);
          if (best) {
            next[i] = { ...next[i], selectedUser: { mailId: best.mailId, name: best.name || best.mailId } };
          }
          continue;
        }
        try {
          const response = await authGet(`/auth/search?q=${encodeURIComponent(nameFromVoice)}&forPayer=true`);
          const data = await response.json();
          if (data.success && data.data && data.data.length > 0) {
            const best = pickBestMatch(nameFromVoice, data.data);
            if (best) {
              next[i] = { ...next[i], selectedUser: { mailId: best.mailId, name: best.name || best.mailId } };
            }
          }
        } catch (e) {
          console.warn('Auto-select search error', e);
        }
      }
      setSplitSelections(next);
      autoSelectAttempted.current = true;
    };
    run();
  }, [existingGroupId, groupMembers.length, splitSelections.length, user, pickBestMatch]);

  // Payer search
  useEffect(() => {
    const search = async () => {
      if (payerSearchQuery.trim().length < 2) {
        setPayerSearchResults([]);
        return;
      }
      setIsPayerSearching(true);
      try {
        const response = await authGet(
          `/auth/search?q=${encodeURIComponent(payerSearchQuery.trim())}&forPayer=true`
        );
        const data = await response.json();
        if (data.success) {
          setPayerSearchResults(data.data || []);
        }
      } catch (e) {
        console.error('Payer search error', e);
      } finally {
        setIsPayerSearching(false);
      }
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [payerSearchQuery]);

  const selectPayer = (payer) => {
    setPayerSelected(payer);
    setPayerSearchQuery('');
    setPayerSearchResults([]);
    setIsPayerDropdownOpen(false);
  };

  const setSplitSelection = (index, selectedUser) => {
    setSplitSelections((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], selectedUser: selectedUser ?? null };
      return next;
    });
    setSplitSearchState((prev) => ({ ...prev, [index]: { ...prev[index], dropdownOpen: selectedUser ? false : true } }));
  };

  const setSplitAmount = (index, value) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const num = cleaned === '' ? 0 : parseFloat(cleaned);
    if (cleaned !== '' && Number.isNaN(num)) return;
    setSplitSelections((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], amount: cleaned === '' ? 0 : num };
      return next;
    });
  };

  const setSplitSearch = (index, query, results, searching, dropdownOpen) => {
    setSplitSearchState((prev) => ({
      ...prev,
      [index]: { query, results, searching, dropdownOpen: dropdownOpen ?? prev[index]?.dropdownOpen },
    }));
  };

  const payerHasError = false;
  const splitMemberHasError = (index) => !splitSelections[index]?.selectedUser;
  const allSplitMembersSelected = splitSelections.length > 0 && splitSelections.every((s) => s.selectedUser);
  const hasZeroAmount = splitSelections.some((s) => !s.amount || s.amount <= 0);
  const canCheckout =
    payerSelected &&
    allSplitMembersSelected &&
    !hasZeroAmount &&
    splitSelections.length > 0;

  const addSplitMember = () => {
    setSplitSelections((prev) => [...prev, { nameFromVoice: 'New member', amount: 0, selectedUser: null }]);
  };

  const removeSplitMember = (index) => {
    setSplitSelections((prev) => prev.filter((_, i) => i !== index));
    setSplitSearchState((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx < index) next[idx] = v;
        if (idx > index) next[idx - 1] = v;
      });
      return next;
    });
  };

  const handleCheckout = async () => {
    if (!canCheckout) {
      if (!payerSelected) setError('Please select who paid.');
      else if (!allSplitMembersSelected) setError('Please select a user for every split member.');
      else if (hasZeroAmount) setError('Please enter an amount greater than 0 for each split member.');
      else setError('Please complete all fields.');
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      const membersSet = new Set([payerSelected.mailId, ...splitSelections.map((s) => s.selectedUser.mailId)]);
      const members = Array.from(membersSet);
      const splits = {};
      splitSelections.forEach((s) => {
        if (s.selectedUser) splits[s.selectedUser.mailId] = s.amount;
      });
      const response = await authPost('/groups/checkout', {
        ...(existingGroupId && { groupId: existingGroupId }),
        groupName,
        members,
        expenses: [
          {
            title: expenseName,
            totalAmount,
            paidBy: payerSelected.mailId,
            splits,
          },
        ],
      });
      const data = await response.json();
      if (data.success) {
        const membersList = [payerSelected, ...splitSelections.map((s) => s.selectedUser).filter(Boolean)];
        navigation.navigate('SplitSummary', {
          groupId: data.data.groupId,
          groupName: data.data.groupName,
          consolidatedExpenses: data.data.consolidatedExpenses || [],
          expenses: [
            {
              title: expenseName,
              totalAmount,
              paidBy: payerSelected.mailId,
              paidByName: payerSelected.name,
              memberCount: membersList.length,
              splits,
              members: membersList,
            },
          ],
        });
      } else {
        setError(data.message || 'Checkout failed');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  if (!paramsValid) {
    return (
      <View style={styles.container}>
        <Text style={styles.redirectText}>Redirecting...</Text>
      </View>
    );
  }

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
            <Ionicons name="arrow-back" size={24} color="#E85A24" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Voice preview
          </Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.decorativeIconContainer}>
          <View style={styles.decorativeIconCircle}>
            <Ionicons name="eye-outline" size={26} color="#E85A24" />
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
              <View style={styles.groupNameSection}>
                <Text style={styles.sectionLabel}>Group</Text>
                <View style={styles.readOnlyBox}>
                  <Text style={styles.readOnlyText} numberOfLines={1}>{groupName}</Text>
                </View>
              </View>

              <View style={styles.expenseNameSection}>
                <Text style={styles.sectionLabel}>Expense name</Text>
                <View style={styles.readOnlyBox}>
                  <Text style={styles.readOnlyText} numberOfLines={1}>{expenseName}</Text>
                </View>
              </View>

              {/* Payer: same pattern as AddExpenseScreen, with total paid beside */}
              <View style={styles.payerSection}>
                <View style={styles.payerLabelRow}>
                  <Text style={styles.sectionLabel}>Paid by</Text>
                  <Text style={styles.totalPaidText}>Total paid: ₹{Number(totalAmount).toFixed(2)}</Text>
                </View>
                <View style={[
                  styles.payerDropdownTrigger,
                  isPayerDropdownOpen && styles.payerDropdownTriggerOpen,
                  payerHasError && styles.inputError,
                ]}>
                  <TouchableOpacity
                    style={styles.payerTriggerTouchable}
                    onPress={() => setIsPayerDropdownOpen(!isPayerDropdownOpen)}
                    activeOpacity={0.8}
                  >
                    {payerSelected ? (
                      <Text style={styles.payerChipText} numberOfLines={1}>
                        {payerSelected.mailId === user?.mailId ? `${payerSelected.name} (You)` : payerSelected.name}
                      </Text>
                    ) : (
                      <Text style={styles.placeholderText} numberOfLines={1}>
                        Search &quot;{payerNameFromVoice}&quot; or select who paid
                      </Text>
                    )}
                    <Text style={styles.dropdownArrow}>{isPayerDropdownOpen ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                </View>

                {isPayerDropdownOpen && (
                  <View style={styles.dropdownContent}>
                    <View style={styles.dropdownSearchBar}>
                      <Ionicons name="search" size={18} color="#999" />
                      <TextInput
                        style={styles.dropdownSearchInput}
                        placeholder="Search by name or email"
                        placeholderTextColor="#999"
                        value={payerSearchQuery}
                        onChangeText={setPayerSearchQuery}
                        autoCapitalize="none"
                      />
                      {isPayerSearching && <ActivityIndicator size="small" color="#E85A24" />}
                    </View>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {user && payerSelected?.mailId !== user.mailId && (
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => selectPayer({ mailId: user.mailId, name: user.name || 'You' })}
                        >
                          <Text style={styles.dropdownItemName}>{user.name || 'You'} (You)</Text>
                          <Text style={styles.dropdownItemEmail}>{user.mailId}</Text>
                        </TouchableOpacity>
                      )}
                      {payerSearchResults.map((u) => (
                        <TouchableOpacity
                          key={u.mailId}
                          style={styles.dropdownItem}
                          onPress={() => selectPayer({ mailId: u.mailId, name: u.name || u.mailId })}
                        >
                          <Text style={styles.dropdownItemName} numberOfLines={1}>{u.name || u.mailId}</Text>
                          <Text style={styles.dropdownItemEmail}>{u.mailId}</Text>
                        </TouchableOpacity>
                      ))}
                      {payerSearchQuery.length >= 2 && payerSearchResults.length === 0 && !isPayerSearching && (
                        <Text style={styles.emptyText}>No users found</Text>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Split details: payer first, then split members (who owe what) */}
              <View style={styles.splitSection}>
                <View style={styles.splitSectionHeader}>
                  <Text style={styles.sectionLabel}>Split details</Text>
                  <Pressable onPress={addSplitMember} style={styles.addMemberButton} hitSlop={8}>
                    <Ionicons name="add-circle" size={28} color="#FF6B35" />
                  </Pressable>
                </View>
                {/* Payer row: show who paid and total (so payer is part of split details) */}
                {payerSelected && (
                  <View style={styles.splitPayerDetailCard}>
                    <View style={styles.splitPayerDetailRow}>
                      <Text style={styles.splitPayerDetailLabel}>Payer</Text>
                      <Text style={styles.splitPayerDetailName} numberOfLines={1}>
                        {payerSelected.mailId === user?.mailId ? `${payerSelected.name} (You)` : payerSelected.name}
                      </Text>
                    </View>
                    <View style={styles.splitPayerDetailRow}>
                      <Text style={styles.splitPayerDetailLabel}>Paid</Text>
                      <Text style={styles.splitPayerDetailAmount}>₹{Number(totalAmount).toFixed(2)}</Text>
                    </View>
                  </View>
                )}
                <Text style={styles.splitMembersSubLabel}>Split members (who owe)</Text>
                {splitSelections.map((item, index) => {
                  const state = splitSearchState[index] || {};
                  const hasError = splitMemberHasError(index);
                  const otherSelectedMailIds = splitSelections
                    .map((s, idx) => (idx !== index ? s.selectedUser?.mailId : null))
                    .filter(Boolean);
                  return (
                    <View key={index} style={styles.splitMemberCard}>
                      {/* Line 1: user selection + delete icon */}
                      <View style={styles.splitMemberRow}>
                        <View style={styles.splitMemberLeft}>
                          <View style={[styles.memberSelectTrigger, hasError && styles.inputError]}>
                            <TouchableOpacity
                              style={styles.memberSelectTouchable}
                              onPress={() =>
                                setSplitSearchState((prev) => ({
                                  ...prev,
                                  [index]: { ...prev[index], dropdownOpen: !prev[index]?.dropdownOpen },
                                }))
                              }
                              activeOpacity={0.7}
                            >
                              {item.selectedUser ? (
                                <Text style={styles.memberSelectText} numberOfLines={1}>
                                  {item.selectedUser.name}
                                </Text>
                              ) : (
                                <Text style={styles.placeholderText} numberOfLines={1}>
                                  {item.nameFromVoice} — select user
                                </Text>
                              )}
                              <Text style={styles.dropdownArrow}>
                                {state.dropdownOpen ? '▲' : '▼'}
                              </Text>
                            </TouchableOpacity>
                            {item.selectedUser ? (
                              <Pressable
                                onPress={() => setSplitSelection(index, null)}
                                style={styles.deselectButton}
                                hitSlop={8}
                              >
                                <Ionicons name="close-circle" size={22} color="#999" />
                              </Pressable>
                            ) : null}
                          </View>

                          {state.dropdownOpen && (
                            <SplitMemberSearch
                              nameFromVoice={item.nameFromVoice}
                              onSelect={(user) => setSplitSelection(index, user)}
                              payerMailId={payerSelected?.mailId}
                              selectedMailIds={otherSelectedMailIds}
                            />
                          )}
                        </View>
                        <Pressable
                          onPress={() => removeSplitMember(index)}
                          style={styles.deleteMemberButton}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={22} color="#C62828" />
                        </Pressable>
                      </View>
                      {/* Line 2: Amount to be paid label (orange) + number box */}
                      <View style={styles.splitAmountSection}>
                        <Text style={styles.splitAmountLabel}>Amount to be paid:</Text>
                        <View style={styles.splitAmountInputRow}>
                          <Text style={styles.splitAmountPrefix}>₹</Text>
                          <TextInput
                            style={styles.splitAmountInput}
                            value={item.amount === 0 ? '' : String(item.amount)}
                            onChangeText={(v) => setSplitAmount(index, v)}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor="#999"
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              ) : null}
            </ScrollView>

            {/* Checkout Button - outside scroll, fixed at bottom like GroupPreview */}
            <View style={styles.checkoutButtonContainer}>
              <TouchableOpacity
                style={[styles.createButton, (!canCheckout || isCreating) && styles.createButtonDisabled]}
                onPress={handleCheckout}
                disabled={!canCheckout || isCreating}
                activeOpacity={0.8}
              >
                {isCreating ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.createButtonText}>Checkout</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </LinearGradient>
    </View>
  );
}

function SplitMemberSearch({
  nameFromVoice,
  onSelect,
  payerMailId,
  selectedMailIds,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const response = await authGet(
          `/auth/search?q=${encodeURIComponent(query.trim())}&forPayer=true`
        );
        const data = await response.json();
        if (data.success) {
          const filtered = (data.data || []).filter(
            (u) => u.mailId !== payerMailId && !selectedMailIds.includes(u.mailId)
          );
          setResults(filtered);
        }
      } catch (e) {
        console.error('Split member search error', e);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, payerMailId, selectedMailIds]);

  return (
    <View style={styles.splitMemberDropdown}>
      <View style={styles.dropdownSearchBar}>
        <Ionicons name="search" size={18} color="#999" />
        <TextInput
          style={styles.dropdownSearchInput}
          placeholder={`Search for "${nameFromVoice}"`}
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator size="small" color="#E85A24" />}
      </View>
      <ScrollView style={styles.dropdownScrollSmall} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {results.map((u) => (
          <TouchableOpacity
            key={u.mailId}
            style={styles.dropdownItem}
            onPress={() => onSelect({ mailId: u.mailId, name: u.name || u.mailId })}
          >
            <Text style={styles.dropdownItemName} numberOfLines={1}>{u.name || u.mailId}</Text>
            <Text style={styles.dropdownItemEmail}>{u.mailId}</Text>
          </TouchableOpacity>
        ))}
        {query.length >= 2 && results.length === 0 && !searching && (
          <Text style={styles.emptyText}>No users found</Text>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 55,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  headerRight: {
    width: 44,
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
  redirectText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 60,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  groupNameSection: {
    marginBottom: 16,
  },
  expenseNameSection: {
    marginBottom: 16,
  },
  readOnlyBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#333',
  },
  payerSection: {
    marginBottom: 20,
  },
  payerLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalPaidText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E85A24',
  },
  payerDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  payerDropdownTriggerOpen: {
    borderColor: '#E85A24',
  },
  payerTriggerTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payerChipText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    minWidth: 0,
  },
  deselectButton: {
    padding: 4,
    marginLeft: 4,
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
    flex: 1,
    minWidth: 0,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    alignSelf: 'center',
  },
  dropdownContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 4,
    maxHeight: 220,
    overflow: 'hidden',
  },
  dropdownSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 6,
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownScrollSmall: {
    maxHeight: 160,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemName: {
    fontSize: 15,
    color: '#333',
  },
  dropdownItemEmail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    padding: 12,
    textAlign: 'center',
  },
  splitSection: {
    marginBottom: 24,
  },
  splitSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  splitPayerDetailCard: {
    backgroundColor: 'rgba(232, 90, 36, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 90, 36, 0.25)',
  },
  splitPayerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  splitPayerDetailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  splitPayerDetailName: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
    textAlign: 'right',
  },
  splitPayerDetailAmount: {
    fontSize: 16,
    color: '#E85A24',
    fontWeight: '700',
  },
  splitMembersSubLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  addMemberButton: {
    padding: 4,
  },
  splitMemberCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  splitMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteMemberButton: {
    padding: 4,
    marginLeft: 8,
  },
  splitMemberLeft: {
    flex: 1,
    marginRight: 12,
  },
  memberSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  memberSelectTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberSelectText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    minWidth: 0,
  },
  splitMemberDropdown: {
    marginTop: 4,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 200,
    overflow: 'hidden',
  },
  splitAmountSection: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitAmountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E85A24',
  },
  splitAmountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 100,
    marginLeft: 8,
  },
  splitAmountPrefix: {
    fontSize: 14,
    color: '#333',
    marginRight: 4,
  },
  splitAmountInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 56,
    padding: 0,
  },
  inputError: {
    borderColor: '#C62828',
    borderWidth: 2,
  },
  errorContainer: {
    marginBottom: 16,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  checkoutButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  createButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
