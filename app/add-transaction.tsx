import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { expenseCategories, incomeCategories } from '@/lib/categories';
import { useLanguage } from '@/lib/LanguageContext';
import { getCategoryName } from '@/lib/i18n';
import { Transaction } from '@/lib/storage';

type TransactionType = 'expense' | 'income';

export default function AddTransactionScreen() {
  const insets = useSafeAreaInsets();
  const { addTransaction, selectedWallet, currencySymbol } = useTransactions();
  const { t, language } = useLanguage();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const now = new Date();
  const [selectedHour, setSelectedHour] = useState(now.getHours() % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(now.getMinutes());
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(now.getHours() >= 12 ? 'PM' : 'AM');

  const categories = type === 'expense' ? expenseCategories : incomeCategories;

  const handleTypeSwitch = (newType: TransactionType) => {
    Haptics.selectionAsync();
    setType(newType);
    setSelectedCategory('');
  };

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t.error, t.enterAmount);
      return;
    }
    if (!selectedCategory) {
      Alert.alert(t.error, t.selectCategory);
      return;
    }
    if (!selectedWallet) {
      Alert.alert(t.error, t.noWalletSelected);
      return;
    }

    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const transactionDate = new Date();
    let hours24 = selectedHour % 12;
    if (selectedPeriod === 'PM') hours24 += 12;
    if (selectedPeriod === 'AM' && selectedHour === 12) hours24 = 0;
    transactionDate.setHours(hours24, selectedMinute, 0, 0);

    const transaction: Transaction = {
      id: Crypto.randomUUID(),
      type,
      amount: parseFloat(amount),
      category: selectedCategory,
      description: description.trim(),
      date: transactionDate.toISOString(),
      createdAt: new Date().toISOString(),
      walletId: selectedWallet.id,
    };

    await addTransaction(transaction);
    setIsSaving(false);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.sheetTitle}>{t.newTransaction}</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {selectedWallet && (
          <View style={styles.walletBadge}>
            <MaterialIcons name={selectedWallet.icon as any} size={16} color={selectedWallet.color} />
            <Text style={[styles.walletBadgeText, { color: selectedWallet.color }]}>
              {selectedWallet.name} ({currencySymbol})
            </Text>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.typeToggle}>
            <Pressable
              onPress={() => handleTypeSwitch('expense')}
              style={[styles.typeBtn, type === 'expense' && styles.typeBtnActiveExpense]}
            >
              <Ionicons name="arrow-up" size={18} color={type === 'expense' ? '#fff' : Colors.expense} />
              <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>{t.expense}</Text>
            </Pressable>
            <Pressable
              onPress={() => handleTypeSwitch('income')}
              style={[styles.typeBtn, type === 'income' && styles.typeBtnActiveIncome]}
            >
              <Ionicons name="arrow-down" size={18} color={type === 'income' ? '#fff' : Colors.income} />
              <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>{t.incomeType}</Text>
            </Pressable>
          </View>

          <View style={styles.amountSection}>
            <Text style={styles.label}>{t.amount}</Text>
            <View style={styles.amountInputWrap}>
              <View style={styles.currencyTag}>
                <Text style={[styles.currencyTagCode, { color: selectedWallet?.color || Colors.primary }]}>
                  {selectedWallet?.currency || 'EGP'}
                </Text>
                <Text style={styles.currencyTagSymbol}>{currencySymbol}</Text>
              </View>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                textAlign="right"
              />
            </View>
          </View>

          <View style={styles.categorySection}>
            <Text style={styles.label}>{t.category}</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCategory(cat.id);
                  }}
                  style={[
                    styles.categoryItem,
                    selectedCategory === cat.id && { borderColor: cat.color, borderWidth: 2 },
                  ]}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: cat.color + '18' }]}>
                    <MaterialIcons name={cat.icon as any} size={22} color={cat.color} />
                  </View>
                  <Text style={[
                    styles.categoryName,
                    selectedCategory === cat.id && { color: cat.color, fontFamily: 'Cairo_700Bold' as const },
                  ]}>
                    {getCategoryName(cat.id, language)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.descSection}>
            <Text style={styles.label}>{t.noteOptional}</Text>
            <TextInput
              style={styles.descInput}
              placeholder={t.notePlaceholder}
              placeholderTextColor={Colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.timeSection}>
            <Text style={styles.label}>{t.time}</Text>
            <View style={styles.timeRow}>
              <View style={styles.timePicker}>
                <Pressable
                  onPress={() => setSelectedHour(h => h >= 12 ? 1 : h + 1)}
                  style={styles.timeArrow}
                >
                  <Ionicons name="chevron-up" size={18} color={Colors.textSecondary} />
                </Pressable>
                <Text style={styles.timeValue}>{selectedHour}</Text>
                <Pressable
                  onPress={() => setSelectedHour(h => h <= 1 ? 12 : h - 1)}
                  style={styles.timeArrow}
                >
                  <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              <View style={styles.timePicker}>
                <Pressable
                  onPress={() => setSelectedMinute(m => m >= 59 ? 0 : m + 1)}
                  style={styles.timeArrow}
                >
                  <Ionicons name="chevron-up" size={18} color={Colors.textSecondary} />
                </Pressable>
                <Text style={styles.timeValue}>{selectedMinute.toString().padStart(2, '0')}</Text>
                <Pressable
                  onPress={() => setSelectedMinute(m => m <= 0 ? 59 : m - 1)}
                  style={styles.timeArrow}
                >
                  <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedPeriod(p => p === 'AM' ? 'PM' : 'AM');
                }}
                style={styles.periodToggle}
              >
                <Text style={styles.periodText}>
                  {language === 'ar' ? (selectedPeriod === 'AM' ? 'ص' : 'م') : selectedPeriod}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={isSaving || !amount || !selectedCategory}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: type === 'expense' ? Colors.expense : Colors.income,
                opacity: (isSaving || !amount || !selectedCategory) ? 0.5 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <Ionicons name="checkmark" size={22} color="#fff" />
            <Text style={styles.saveText}>{t.save}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: Colors.text,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  walletBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    marginTop: 8,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  typeBtnActiveExpense: {
    backgroundColor: Colors.expense,
  },
  typeBtnActiveIncome: {
    backgroundColor: Colors.income,
  },
  typeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  typeTextActive: {
    color: '#fff',
  },
  amountSection: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 16,
    paddingRight: 16,
    paddingLeft: 4,
    height: 72,
    gap: 12,
  },
  currencyTag: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 0,
  },
  currencyTagCode: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  currencyTagSymbol: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  amountInput: {
    flex: 1,
    fontFamily: 'Cairo_700Bold',
    fontSize: 32,
    color: Colors.text,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryItem: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: Colors.text,
    textAlign: 'center',
  },
  descSection: {
    marginBottom: 16,
  },
  descInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    color: Colors.text,
    minHeight: 60,
  },
  timeSection: {
    marginBottom: 24,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  timePicker: {
    alignItems: 'center',
    gap: 2,
  },
  timeArrow: {
    padding: 4,
  },
  timeValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    color: Colors.text,
    minWidth: 44,
    textAlign: 'center',
  },
  timeSeparator: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  periodToggle: {
    backgroundColor: Colors.primary + '18',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 4,
  },
  periodText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: Colors.primary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginBottom: 20,
  },
  saveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: '#fff',
  },
});
