import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';

export default function CustomSplitScreen({ navigation }) {
  const [billName, setBillName] = useState('');
  const [items, setItems] = useState([
    { id: '1', name: '', price: '' },
  ]);
  const [tax, setTax] = useState('');
  const [tip, setTip] = useState('');

  const addItem = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setItems(prev => [...prev, { id: Date.now().toString(), name: '', price: '' }]);
  };

  const removeItem = (id) => {
    if (items.length <= 1) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      return sum + price;
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const taxAmount = parseFloat(tax) || 0;
    const tipAmount = parseFloat(tip) || 0;
    return subtotal + taxAmount + tipAmount;
  };

  const handleContinue = () => {
    const validItems = items.filter(item => item.name.trim() && item.price);
    
    if (validItems.length === 0) {
      return; // Could show an alert
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const bill = {
      id: Date.now().toString(),
      name: billName.trim() || 'Custom Split',
      items: validItems.map((item, idx) => ({
        id: `item-${idx}`,
        name: item.name.trim(),
        price: parseFloat(item.price) || 0,
        quantity: 1,
        totalPrice: parseFloat(item.price) || 0,
        assignedTo: [],
      })),
      subtotal: calculateSubtotal(),
      tax: parseFloat(tax) || 0,
      tip: parseFloat(tip) || 0,
      total: calculateTotal(),
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    navigation.navigate('BillDetail', { bill });
  };

  const isValid = items.some(item => item.name.trim() && item.price);

  return (
    <LinearGradient
      colors={[theme.colors.backgroundGradientStart, theme.colors.backgroundGradientEnd]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Custom Split</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Bill Name */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Bill Name (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Dinner at Joe's"
              placeholderTextColor={theme.colors.cardTextSecondary}
              value={billName}
              onChangeText={setBillName}
            />
          </View>

          {/* Items */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Items</Text>
            
            {items.map((item, index) => (
              <View key={item.id} style={styles.itemRow}>
                <TextInput
                  style={[styles.input, styles.itemNameInput]}
                  placeholder={`Item ${index + 1}`}
                  placeholderTextColor={theme.colors.cardTextSecondary}
                  value={item.name}
                  onChangeText={(text) => updateItem(item.id, 'name', text)}
                />
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.input, styles.priceInput]}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.cardTextSecondary}
                    keyboardType="decimal-pad"
                    value={item.price}
                    onChangeText={(text) => updateItem(item.id, 'price', text)}
                  />
                </View>
                {items.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeItem(item.id)}
                  >
                    <Ionicons name="close-circle" size={24} color={theme.colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
              <Ionicons name="add-circle" size={22} color={theme.colors.background} />
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* Tax & Tip */}
          <View style={styles.card}>
            <View style={styles.taxTipRow}>
              <View style={styles.taxTipField}>
                <Text style={styles.cardLabel}>Tax</Text>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.input, styles.priceInput, styles.fullWidth]}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.cardTextSecondary}
                    keyboardType="decimal-pad"
                    value={tax}
                    onChangeText={setTax}
                  />
                </View>
              </View>
              <View style={styles.taxTipField}>
                <Text style={styles.cardLabel}>Tip</Text>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.input, styles.priceInput, styles.fullWidth]}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.cardTextSecondary}
                    keyboardType="decimal-pad"
                    value={tip}
                    onChangeText={setTip}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>${calculateSubtotal().toFixed(2)}</Text>
            </View>
            {(parseFloat(tax) > 0) && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>${parseFloat(tax).toFixed(2)}</Text>
              </View>
            )}
            {(parseFloat(tip) > 0) && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tip</Text>
                <Text style={styles.summaryValue}>${parseFloat(tip).toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${calculateTotal().toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!isValid}
          >
            <Text style={styles.continueButtonText}>Continue to Split</Text>
            <Ionicons name="arrow-forward" size={20} color={theme.colors.background} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.cardTextSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.cardText,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  itemNameInput: {
    flex: 1,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: theme.borderRadius.md,
    paddingLeft: theme.spacing.sm,
  },
  currencySymbol: {
    fontSize: 16,
    color: theme.colors.cardTextSecondary,
    fontWeight: '600',
  },
  priceInput: {
    width: 80,
    backgroundColor: 'transparent',
    paddingLeft: theme.spacing.xs,
  },
  fullWidth: {
    flex: 1,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
  },
  addItemText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  taxTipRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  taxTipField: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  summaryLabel: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.sm,
    ...theme.shadows.md,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.background,
  },
});

