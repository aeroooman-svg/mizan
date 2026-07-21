import React, { useState, useEffect, useMemo } from 'react';
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
  Modal,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { expenseCategories, incomeCategories, formatCurrency, WALLET_COLORS } from '@/lib/categories';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { getCategoryName } from '@/lib/i18n';
import { saveRecurringTransaction, RecurringTransaction } from '@/lib/recurringStorage';
import { normalizeAmountInput } from '@/lib/arabicNumbers';

type TransactionType = 'expense' | 'income';
type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function AddRecurringScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { selectedWallet, currencySymbol, customCategories, addCustomCategory } = useTransactions();
  const { t, language } = useLanguage();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>('monthly');
  const [isSaving, setIsSaving] = useState(false);
  const [isVariable, setIsVariable] = useState(false);

  // Next Due Date selection
  const [showDatePicker, setShowDatePicker] = useState(false);
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // Calculator state
  const [calcModalVisible, setCalcModalVisible] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcResult, setCalcResult] = useState('');

  // Custom Category state
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customNameAr, setCustomNameAr] = useState('');
  const [customNameEn, setCustomNameEn] = useState('');
  const [customColor, setCustomColor] = useState(WALLET_COLORS[0]);
  const [customIcon, setCustomIcon] = useState('restaurant');

  const displayedCategories = useMemo(() => {
    const staticCats = type === 'expense' ? expenseCategories : incomeCategories;
    const userCats = customCategories.filter(c => c.type === type);
    return [...staticCats, ...userCats];
  }, [type, customCategories]);

  const handleTypeSwitch = (newType: TransactionType) => {
    Haptics.selectionAsync();
    setType(newType);
    setSelectedCategory('');
  };

  const getAvailableDates = () => {
    const dates: { day: number; month: number; year: number; label: string }[] = [];
    const base = new Date();
    // Allow selecting start date up to 30 days in the future
    for (let i = 0; i < 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      let label: string;
      if (i === 0) label = t.today;
      else if (i === 1) label = language === 'ar' ? 'غداً' : 'Tomorrow';
      else label = `${d.getDate()} ${t.months[d.getMonth()]} ${d.getFullYear()}`;
      dates.push({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), label });
    }
    return dates;
  };

  const availableDates = getAvailableDates();
  const selectedDateLabel = (() => {
    const idx = availableDates.findIndex(
      d => d.day === selectedDay && d.month === selectedMonth && d.year === selectedYear
    );
    if (idx === 0) return t.today;
    if (idx === 1) return language === 'ar' ? 'غداً' : 'Tomorrow';
    return `${selectedDay} ${t.months[selectedMonth]} ${selectedYear}`;
  })();

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

    const nextDueDate = new Date(selectedYear, selectedMonth, selectedDay);
    nextDueDate.setHours(9, 0, 0, 0); // Default run at 9:00 AM

    const recurring: RecurringTransaction = {
      id: Crypto.randomUUID(),
      walletId: selectedWallet.id,
      type,
      amount: parseFloat(amount),
      category: selectedCategory,
      description: description.trim(),
      frequency,
      nextDueDate: nextDueDate.toISOString(),
      isActive: true,
      isVariable,
      createdAt: new Date().toISOString(),
    };

    await saveRecurringTransaction(recurring);
    setIsSaving(false);
    router.back();
  };

  // Calculator logic
  const evaluateExpression = (expr: string): string => {
    try {
      const sanitized = expr.replace(/[^0-9.+\-*/\s]/g, '');
      if (!sanitized.trim()) return '';
      const fn = new Function(`return (${sanitized})`);
      const val = fn();
      if (typeof val === 'number' && isFinite(val)) {
        return Math.max(0, val).toFixed(2).replace(/\.00$/, '');
      }
      return '';
    } catch {
      return '';
    }
  };

  const handleCalcKeyPress = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let nextExpr = calcExpression;
    if (['+', '-', '*', '/'].includes(key)) {
      if (calcExpression.endsWith(' ') && !calcExpression.endsWith(' * ') && !calcExpression.endsWith(' / ') && !calcExpression.endsWith(' + ') && !calcExpression.endsWith(' - ')) return;
      if (calcExpression.length === 0) return;
      nextExpr = calcExpression + ` ${key} `;
    } else {
      nextExpr = calcExpression + key;
    }
    setCalcExpression(nextExpr);
    setCalcResult(evaluateExpression(nextExpr));
  };

  const handleCalcBackspace = () => {
    if (calcExpression.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let nextExpr = calcExpression;
    if (calcExpression.endsWith(' ')) {
      nextExpr = calcExpression.slice(0, -3);
    } else {
      nextExpr = calcExpression.slice(0, -1);
    }
    setCalcExpression(nextExpr);
    setCalcResult(evaluateExpression(nextExpr));
  };

  const handleCalcClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalcExpression('');
    setCalcResult('');
  };

  const handleCalcConfirm = () => {
    const finalVal = calcResult || evaluateExpression(calcExpression) || '0';
    if (parseFloat(finalVal) > 0) {
      setAmount(finalVal);
    }
    setCalcModalVisible(false);
  };

  // Custom Category creation
  const handleSaveCustomCategory = async () => {
    const nameAr = customNameAr.trim();
    const nameEn = customNameEn.trim();
    if (!nameAr || !nameEn) {
      Alert.alert(t.error, t.categoryName);
      return;
    }
    try {
      const newCat = await addCustomCategory(nameAr, nameEn, customIcon, customColor, type);
      setSelectedCategory(newCat.id);
      setCustomModalVisible(false);
      setCustomNameAr('');
      setCustomNameEn('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert(t.error, 'Could not save category');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <View style={[styles.headerRow, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12, zIndex: 10, elevation: 10 }]}>
          <Text style={styles.sheetTitle}>{t.addRecurring}</Text>
          <Pressable 
            onPress={() => {
              Haptics.selectionAsync();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }} 
            hitSlop={20}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} style={{ marginTop: 2 }} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20, paddingTop: 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          {selectedWallet && (
            <View style={[styles.walletBadge, { marginHorizontal: 0, marginBottom: 16, marginTop: 0 }]}>
              <MaterialIcons name={selectedWallet.icon as any} size={16} color={selectedWallet.color} />
              <Text style={[styles.walletBadgeText, { color: selectedWallet.color }]}>
                {selectedWallet.name} ({currencySymbol})
              </Text>
            </View>
          )}
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
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(text) => setAmount(normalizeAmountInput(text))}
                textAlign="right"
              />
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setCalcExpression(amount);
                  setCalcResult(amount);
                  setCalcModalVisible(true);
                }}
                style={({ pressed }) => [styles.calcTriggerBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="calculator-outline" size={24} color={selectedWallet?.color || Colors.primary} />
              </Pressable>
            </View>
          </View>

          {/* Variable Amount Toggle */}
          <View style={styles.section}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setIsVariable(!isVariable);
              }}
              style={styles.toggleRow}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.toggleLabel}>
                  {language === 'ar' ? 'مبلغ متغير كل شهر' : 'Variable amount each month'}
                </Text>
                <Text style={styles.toggleSub}>
                  {language === 'ar' 
                    ? 'سيطلب منك التطبيق تأكيد وتعديل المبلغ عند استحقاقه بدلاً من تسجيله تلقائياً.' 
                    : 'The app will ask you to confirm/edit the amount when due instead of logging it automatically.'}
                </Text>
              </View>
              <View style={[
                styles.customSwitch,
                isVariable ? { backgroundColor: selectedWallet?.color || Colors.primary, alignItems: 'flex-end' } : { backgroundColor: colors.surfaceAlt, alignItems: 'flex-start', borderWidth: 1, borderColor: colors.border }
              ]}>
                <View style={styles.customSwitchCircle} />
              </View>
            </Pressable>
          </View>

          {/* Frequency Section */}
          <View style={styles.section}>
            <Text style={styles.label}>{t.frequency}</Text>
            <View style={styles.frequencyRow}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as FrequencyType[]).map((f) => {
                const isActive = frequency === f;
                let text = '';
                if (f === 'daily') text = t.daily;
                else if (f === 'weekly') text = t.weekly;
                else if (f === 'monthly') text = t.monthly;
                else if (f === 'yearly') text = t.yearly;

                return (
                  <Pressable
                    key={f}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setFrequency(f);
                    }}
                    style={[
                      styles.frequencyChip,
                      isActive && { backgroundColor: selectedWallet?.color || Colors.primary, borderColor: selectedWallet?.color || Colors.primary }
                    ]}
                  >
                    <Text style={[styles.frequencyChipText, isActive && { color: '#fff' }]}>{text}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Next Due Date */}
          <View style={styles.section}>
            <Text style={styles.label}>{t.nextDueDate}</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={styles.datePressable}
            >
              <Ionicons name="calendar-outline" size={20} color={selectedWallet?.color || Colors.primary} />
              <Text style={styles.dateText}>{selectedDateLabel}</Text>
              <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
            </Pressable>
          </View>

          <View style={styles.categorySection}>
            <Text style={styles.label}>{t.category}</Text>
            <View style={styles.categoryGrid}>
              {displayedCategories.map((cat) => (
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

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setCustomModalVisible(true);
                }}
                style={[styles.categoryItem, styles.addCategoryItem]}
              >
                <View style={[styles.categoryIcon, { backgroundColor: Colors.primary + '15' }]}>
                  <Ionicons name="add" size={24} color={Colors.primary} />
                </View>
                <Text style={[styles.categoryName, { color: Colors.primary, fontFamily: 'Cairo_700Bold' as const }]}>
                  {t.newCategory}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.descSection}>
            <Text style={styles.label}>{t.noteOptional}</Text>
            <TextInput
              style={styles.descInput}
              placeholder={t.notePlaceholder}
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
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
            <Text style={styles.saveText}>{t.save}</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Start Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.datePickerSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>{t.nextDueDate}</Text>
              <Pressable onPress={() => setShowDatePicker(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.dateList}>
              {availableDates.map((d, i) => {
                const isSelected = d.day === selectedDay && d.month === selectedMonth && d.year === selectedYear;
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedDay(d.day);
                      setSelectedMonth(d.month);
                      setSelectedYear(d.year);
                      setShowDatePicker(false);
                    }}
                    style={[styles.dateOption, isSelected && styles.dateOptionActive]}
                  >
                    <Text style={[styles.dateOptionText, isSelected && styles.dateOptionTextActive]}>
                      {d.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Calculator Modal */}
      <Modal visible={calcModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.calcSheet}>
            <View style={styles.calcHeader}>
              <Pressable onPress={() => setCalcModalVisible(false)} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
              <Text style={styles.calcTitle}>{t.calculator}</Text>
              <Pressable onPress={handleCalcConfirm} hitSlop={12} style={styles.calcConfirmBtn}>
                <Ionicons name="checkmark" size={22} color={Colors.primary} />
              </Pressable>
            </View>

            <View style={styles.calcDisplay}>
              <Text style={styles.calcExprText} numberOfLines={1}>
                {calcExpression || '0'}
              </Text>
              <Text style={styles.calcResultText} numberOfLines={1}>
                {calcResult ? `= ${calcResult}` : ''}
              </Text>
            </View>

            <View style={styles.calcPad}>
              <View style={styles.calcRow}>
                {['7', '8', '9', '/'].map(key => (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [styles.calcKey, ['/'].includes(key) && styles.calcKeyOp, pressed && styles.calcKeyPressed]}
                    onPress={() => handleCalcKeyPress(key)}
                  >
                    <Text style={[styles.calcKeyText, ['/'].includes(key) && styles.calcKeyOpText]}>
                      {key === '/' ? '÷' : key}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.calcRow}>
                {['4', '5', '6', '*'].map(key => (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [styles.calcKey, ['*'].includes(key) && styles.calcKeyOp, pressed && styles.calcKeyPressed]}
                    onPress={() => handleCalcKeyPress(key)}
                  >
                    <Text style={[styles.calcKeyText, ['*'].includes(key) && styles.calcKeyOpText]}>
                      {key === '*' ? '×' : key}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.calcRow}>
                {['1', '2', '3', '-'].map(key => (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [styles.calcKey, ['-'].includes(key) && styles.calcKeyOp, pressed && styles.calcKeyPressed]}
                    onPress={() => handleCalcKeyPress(key)}
                  >
                    <Text style={[styles.calcKeyText, ['-'].includes(key) && styles.calcKeyOpText]}>
                      {key}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.calcRow}>
                <Pressable
                  style={({ pressed }) => [styles.calcKey, styles.calcKeyClear, pressed && styles.calcKeyPressed]}
                  onPress={handleCalcClear}
                >
                  <Text style={styles.calcKeyClearText}>C</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.calcKey, pressed && styles.calcKeyPressed]}
                  onPress={() => handleCalcKeyPress('0')}
                >
                  <Text style={styles.calcKeyText}>0</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.calcKey, pressed && styles.calcKeyPressed]}
                  onPress={() => handleCalcKeyPress('.')}
                >
                  <Text style={styles.calcKeyText}>.</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.calcKey, styles.calcKeyOp, pressed && styles.calcKeyPressed]}
                  onPress={() => handleCalcKeyPress('+')}
                >
                  <Text style={[styles.calcKeyText, styles.calcKeyOpText]}>+</Text>
                </Pressable>
              </View>
              <View style={styles.calcRow}>
                <Pressable
                  style={({ pressed }) => [styles.calcKeyBackspace, pressed && styles.calcKeyPressed]}
                  onPress={handleCalcBackspace}
                >
                  <Ionicons name="backspace-outline" size={24} color={Colors.text} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.calcKeyConfirm, { backgroundColor: selectedWallet?.color || Colors.primary }, pressed && { opacity: 0.9 }]}
                  onPress={handleCalcConfirm}
                >
                  <Text style={styles.calcKeyConfirmText}>{t.save}</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Custom Category Modal */}
      <Modal visible={customModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.customCatSheet}>
            <View style={styles.calcHeader}>
              <Pressable onPress={() => setCustomModalVisible(false)} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
              <Text style={styles.calcTitle}>{t.newCategory}</Text>
              <Pressable onPress={handleSaveCustomCategory} hitSlop={12} style={styles.calcConfirmBtn}>
                <Ionicons name="checkmark" size={22} color={Colors.primary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.customCatBody} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t.categoryNameAr}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="مثال: اشتراكات"
                  placeholderTextColor={Colors.textTertiary}
                  value={customNameAr}
                  onChangeText={setCustomNameAr}
                  textAlign={language === 'ar' ? 'right' : 'left'}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t.categoryNameEn}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Subscriptions"
                  placeholderTextColor={Colors.textTertiary}
                  value={customNameEn}
                  onChangeText={setCustomNameEn}
                  textAlign="left"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t.selectColor}</Text>
                <View style={styles.colorsGrid}>
                  {WALLET_COLORS.map(c => {
                    const isSelected = customColor === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setCustomColor(c)}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: c },
                          isSelected && { borderColor: '#000', borderWidth: 2, transform: [{ scale: 1.15 }] }
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t.selectIcon}</Text>
                <View style={styles.iconsGrid}>
                  {['restaurant', 'directions-car', 'receipt-long', 'shopping-bag', 'medical-services', 'school', 'movie', 'home', 'phone-android', 'checkroom', 'more-horiz', 'account-balance-wallet'].map(ic => {
                    const isSelected = customIcon === ic;
                    return (
                      <Pressable
                        key={ic}
                        onPress={() => setCustomIcon(ic)}
                        style={[
                          styles.iconBox,
                          isSelected && { borderColor: customColor, borderWidth: 2, backgroundColor: customColor + '12' }
                        ]}
                      >
                        <MaterialIcons name={ic as any} size={22} color={isSelected ? customColor : Colors.textSecondary} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Pressable
                onPress={handleSaveCustomCategory}
                style={({ pressed }) => [styles.modalSaveBtn, { backgroundColor: customColor }, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.modalSaveText}>{t.createWallet}</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
    color: colors.text,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: colors.surfaceAlt,
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
    backgroundColor: colors.surfaceAlt,
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
    backgroundColor: colors.expense,
  },
  typeBtnActiveIncome: {
    backgroundColor: colors.income,
  },
  typeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.textSecondary,
  },
  typeTextActive: {
    color: colors.text,
  },
  amountSection: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'left',
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    paddingRight: 16,
    paddingLeft: 4,
    height: 72,
    gap: 12,
  },
  currencyTag: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyTagCode: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  currencyTagSymbol: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: -2,
  },
  amountInput: {
    flex: 1,
    fontFamily: 'Cairo_700Bold',
    fontSize: 32,
    color: colors.text,
  },
  calcTriggerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  frequencyChip: {
    flex: 1,
    minWidth: '22%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  frequencyChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  datePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  dateText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.text,
    textAlign: 'left',
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
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  addCategoryItem: {
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
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
    color: colors.text,
    textAlign: 'center',
  },
  descSection: {
    marginBottom: 16,
  },
  descInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    color: colors.text,
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
    color: colors.text,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  datePickerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  dateList: {
    paddingHorizontal: 16,
  },
  dateOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  dateOptionActive: {
    backgroundColor: colors.primary + '12',
  },
  dateOptionText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    color: colors.text,
  },
  dateOptionTextActive: {
    fontFamily: 'Cairo_600SemiBold',
    color: colors.primary,
  },
  // Calculator Modal styles
  calcSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
  },
  calcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  calcConfirmBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary + '12',
  },
  calcDisplay: {
    backgroundColor: colors.surfaceAlt,
    padding: 20,
    alignItems: 'flex-end',
    height: 100,
    justifyContent: 'center',
    gap: 4,
  },
  calcExprText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 22,
    color: colors.textSecondary,
  },
  calcResultText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    color: colors.text,
  },
  calcPad: {
    padding: 16,
    gap: 10,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  calcKey: {
    flex: 1,
    aspectRatio: 1.6,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcKeyPressed: {
    opacity: 0.7,
  },
  calcKeyOp: {
    backgroundColor: colors.primary + '12',
  },
  calcKeyText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
  },
  calcKeyOpText: {
    color: colors.primary,
    fontSize: 22,
  },
  calcKeyClear: {
    backgroundColor: colors.expense + '15',
  },
  calcKeyClearText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.expense,
  },
  calcKeyBackspace: {
    flex: 1,
    aspectRatio: 1.6,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcKeyConfirm: {
    flex: 3,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcKeyConfirmText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  // Custom Category Modal styles
  customCatSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  customCatBody: {
    padding: 20,
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  colorCircle: {
    width: Dimensions.get('window').width * 0.13,
    aspectRatio: 1,
    borderRadius: Dimensions.get('window').width * 0.065,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 6,
    maxHeight: 180,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  modalSaveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    padding: 14,
    borderRadius: 16,
    gap: 12,
  },
  toggleLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.text,
    textAlign: 'left',
  },
  toggleSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'left',
    lineHeight: 16,
  },
  customSwitch: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    padding: 3,
  },
  customSwitchCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});
