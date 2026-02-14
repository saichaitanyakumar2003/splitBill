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

  // splitSelections: for each voice split member, { nameFromVoice, amount, selectedUser: { mailId, name } | null }
  const [splitSelections, setSplitSelections] = useState(() =>
    (voiceResult?.splitMembers || []).map((m) => ({
      nameFromVoice: m.name,
      amount: m.amount,
      selectedUser: null,
    }))
  );
  // Per-row search: index -> { query, results, searching, dropdownOpen }
  const [splitSearchState, setSplitSearchState] = useState({});
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const totalAmount = voiceResult?.totalAmount ?? 0;
  const payerNameFromVoice = voiceResult?.payer?.name ?? '';

  const paramsValid = Boolean(groupName && expenseName && voiceResult?.payer && Array.isArray(voiceResult?.splitMembers));

  // Redirect if params missing
  useEffect(() => {
    if (!paramsValid) {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  }, [paramsValid, navigation]);

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
      if (next[index]) next[index] = { ...next[index], selectedUser };
      return next;
    });
    setSplitSearchState((prev) => ({ ...prev, [index]: { ...prev[index], dropdownOpen: false } }));
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

  const handleCheckout = async () => {
    if (!payerSelected || !allSplitMembersSelected) {
      setError('Please select payer and match all split members.');
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
        navigation.navigate('SplitSummary', {
          groupId: data.data.groupId,
          groupName: data.data.groupName,
          consolidatedExpenses: data.data.consolidatedExpenses,
          expenses: [
            {
              title: expenseName,
              totalAmount,
              paidBy: payerSelected.mailId,
              paidByName: payerSelected.name,
              splits,
              members: [payerSelected, ...splitSelections.map((s) => s.selectedUser)],
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
          <Text style={styles.headerTitleCentered} pointerEvents="none">
            Voice preview
          </Text>
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
                <TouchableOpacity
                  style={[
                    styles.payerDropdownTrigger,
                    isPayerDropdownOpen && styles.payerDropdownTriggerOpen,
                    payerHasError && styles.inputError,
                  ]}
                  onPress={() => setIsPayerDropdownOpen(!isPayerDropdownOpen)}
                  activeOpacity={0.8}
                >
                  {payerSelected ? (
                    <Text style={styles.payerChipText} numberOfLines={1}>
                      {payerSelected.mailId === user?.mailId ? `${payerSelected.name} (You)` : payerSelected.name}
                    </Text>
                  ) : (
                    <Text style={styles.placeholderText}>
                      Search &quot;{payerNameFromVoice}&quot; or select who paid
                    </Text>
                  )}
                  <Text style={styles.dropdownArrow}>{isPayerDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

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

              {/* Split members: name from JSON + search/select + amount; red border if no match */}
              <View style={styles.splitSection}>
                <Text style={styles.sectionLabel}>Split members</Text>
                {splitSelections.map((item, index) => {
                  const state = splitSearchState[index] || {};
                  const hasError = splitMemberHasError(index);
                  const otherSelectedMailIds = splitSelections
                    .map((s, idx) => (idx !== index ? s.selectedUser?.mailId : null))
                    .filter(Boolean);
                  return (
                    <View key={index} style={[styles.splitMemberRow, hasError && styles.splitMemberRowError]}>
                      <View style={styles.splitMemberLeft}>
                        <TouchableOpacity
                          style={[styles.memberSelectTrigger, hasError && styles.inputError]}
                          onPress={() =>
                            setSplitSearchState((prev) => ({
                              ...prev,
                              [index]: { ...prev[index], dropdownOpen: !prev[index]?.dropdownOpen },
                            }))
                          }
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

                        {state.dropdownOpen && (
                          <SplitMemberSearch
                            nameFromVoice={item.nameFromVoice}
                            onSelect={(user) => setSplitSelection(index, user)}
                            payerMailId={payerSelected?.mailId}
                            selectedMailIds={otherSelectedMailIds}
                          />
                        )}
                      </View>
                      <View style={styles.splitAmountWrap}>
                        <Text style={styles.splitAmountLabel}>₹{Number(item.amount).toFixed(2)}</Text>
                        <Text style={styles.splitAmountHint}>to pay</Text>
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

              {/* Checkout Button - same as GroupPreviewScreen */}
              <TouchableOpacity
                style={[styles.createButton, isCreating && styles.createButtonDisabled]}
                onPress={handleCheckout}
                disabled={!payerSelected || !allSplitMembersSelected || isCreating}
                activeOpacity={0.8}
              >
                {isCreating ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.createButtonText}>Checkout</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
  payerChipText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
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
  splitMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 4,
  },
  splitMemberRowError: {
    borderWidth: 2,
    borderColor: '#C62828',
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    marginHorizontal: -4,
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
  memberSelectText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
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
  splitAmountWrap: {
    alignItems: 'flex-end',
  },
  splitAmountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  splitAmountHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  createButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
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
