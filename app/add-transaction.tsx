import React, { useState, useRef } from 'react';
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
import { expenseCategories, incomeCategories, Category } from '@/lib/categories';
import { Transaction } from '@/lib/storage';

type TransactionType = 'expense' | 'income';

export default function AddTransactionScreen() {
  const insets = useSafeAreaInsets();
  const { addTransaction } = useTransactions();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const categories = type === 'expense' ? expenseCategories : incomeCategories;

  const handleTypeSwitch = (newType: TransactionType) => {
    Haptics.selectionAsync();
    setType(newType);
    setSelectedCategory('');
  };

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('خطأ', 'أدخل المبلغ');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('خطأ', 'اختر الفئة');
      return;
    }

    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const transaction: Transaction = {
      id: Crypto.randomUUID(),
      type,
      amount: parseFloat(amount),
      category: selectedCategory,
      description: description.trim(),
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
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
          <Text style={styles.sheetTitle}>معاملة جديدة</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

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
              <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>مصروف</Text>
            </Pressable>
            <Pressable
              onPress={() => handleTypeSwitch('income')}
              style={[styles.typeBtn, type === 'income' && styles.typeBtnActiveIncome]}
            >
              <Ionicons name="arrow-down" size={18} color={type === 'income' ? '#fff' : Colors.income} />
              <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>دخل</Text>
            </Pressable>
          </View>

          <View style={styles.amountSection}>
            <Text style={styles.label}>المبلغ</Text>
            <View style={styles.amountInputWrap}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                textAlign="center"
              />
              <Text style={styles.amountCurrency}>ج.م</Text>
            </View>
          </View>

          <View style={styles.categorySection}>
            <Text style={styles.label}>الفئة</Text>
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
                    selectedCategory === cat.id && { color: cat.color, fontFamily: 'Cairo_700Bold' },
                  ]}>
                    {cat.nameAr}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.descSection}>
            <Text style={styles.label}>ملاحظة (اختياري)</Text>
            <TextInput
              style={styles.descInput}
              placeholder="وصف المعاملة..."
              placeholderTextColor={Colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              textAlign="right"
            />
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
            <Text style={styles.saveText}>حفظ</Text>
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
    paddingBottom: 8,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: Colors.text,
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
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 64,
    gap: 8,
  },
  amountInput: {
    flex: 1,
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    color: Colors.text,
  },
  amountCurrency: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 18,
    color: Colors.textSecondary,
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
    marginBottom: 24,
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
