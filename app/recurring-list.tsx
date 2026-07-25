import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  Alert,
  Switch,
  Modal,
  TextInput,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName, formatDateLocalized } from '@/lib/i18n';
import {
  RecurringTransaction,
  getRecurringTransactions,
  deleteRecurringTransaction,
  updateRecurringTransaction,
} from '@/lib/recurringStorage';
import { getInstallmentPlans, InstallmentPlan } from '@/lib/installmentStorage';
import { saveGoal, SavingsGoal } from '@/lib/goalStorage';

export default function RecurringListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 10 : 0;
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const { currencySymbol, selectedWallet } = useTransactions();
  
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [installments, setInstallments] = useState<InstallmentPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto Savings Modal State
  const [autoSavingsModalVisible, setAutoSavingsModalVisible] = useState(false);
  const [savingsInput, setSavingsInput] = useState('');
  const [goalTitle, setGoalTitle] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [recData, instData] = await Promise.all([
      getRecurringTransactions(),
      getInstallmentPlans()
    ]);
    
    // Filter to current wallet if set
    if (selectedWallet) {
      setItems(recData.filter(item => item.walletId === selectedWallet.id));
      setInstallments(instData.filter(item => item.walletId === selectedWallet.id));
    } else {
      setItems(recData);
      setInstallments(instData);
    }
    setLoading(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [selectedWallet])
  );

  // Financial calculations
  const totalRecurringIncome = useMemo(() => {
    return items
      .filter(i => i.isActive && i.type === 'income')
      .reduce((sum, i) => sum + i.amount, 0);
  }, [items]);

  const totalRecurringExpenses = useMemo(() => {
    return items
      .filter(i => i.isActive && i.type === 'expense')
      .reduce((sum, i) => sum + i.amount, 0);
  }, [items]);

  const totalMonthlyInstallments = useMemo(() => {
    return installments.reduce((sum, i) => sum + (i.monthlyAmount || 0), 0);
  }, [installments]);

  const totalCommitments = totalRecurringExpenses + totalMonthlyInstallments;
  const freeNetCashflow = totalRecurringIncome - totalCommitments;

  const handleOpenAutoSavingsModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const suggestedMonthly = freeNetCashflow > 0 ? Math.round(freeNetCashflow * 0.6) : 25;
    setSavingsInput(suggestedMonthly.toString());
    setGoalTitle(isAr ? 'ادخار الفائض المالي التلقائي 🎯' : 'Net Surplus Savings Goal 🎯');
    setAutoSavingsModalVisible(true);
  };

  const handleConfirmAutoSavingsGoal = async () => {
    const targetMonthly = parseFloat(savingsInput);
    if (isNaN(targetMonthly) || targetMonthly <= 0) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى إدخال مبلغ ادخار شهري صحيح' : 'Please enter a valid monthly savings amount'
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const target6Months = targetMonthly * 6;

    const autoGoal: SavingsGoal = {
      id: Crypto.randomUUID(),
      name: goalTitle.trim() || (isAr ? 'ادخار الفائض التلقائي 🎯' : 'Surplus Savings Goal'),
      targetAmount: target6Months,
      savedAmount: 0,
      deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      walletId: selectedWallet?.id || '',
      createdAt: new Date().toISOString(),
    };

    await saveGoal(autoGoal);
    setAutoSavingsModalVisible(false);

    Alert.alert(
      isAr ? 'تمت إضافة هدف الادخار التلقائي 🎉' : 'Savings Goal Created 🎉',
      isAr
        ? `تم إنشاء هدف ادخار بمبلغ (${formatCurrency(target6Months)} ${currencySymbol}) بمعدل ادخار شهري مقترح (${formatCurrency(targetMonthly)} ${currencySymbol}).`
        : `Created goal to save ${formatCurrency(target6Months)} ${currencySymbol} from free cashflow!`,
      [
        {
          text: isAr ? 'الانتقال للأهداف' : 'View Goals',
          onPress: () => router.push('/savings-goals'),
        },
        { text: isAr ? 'موافق' : 'OK' }
      ]
    );
  };

  const handleToggleActive = async (item: RecurringTransaction, val: boolean) => {
    Haptics.selectionAsync();
    const updated = { ...item, isActive: val };
    await updateRecurringTransaction(updated);
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
  };

  const handleDelete = (id: string, description: string, categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const catName = getCategoryName(categoryId, language);
    const displayName = description ? `${catName} (${description})` : catName;
    
    Alert.alert(
      t.deletePlan,
      isAr ? `هل تريد حذف المعاملة المتكررة "${displayName}"؟` : `Delete recurring transaction "${displayName}"?`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            await deleteRecurringTransaction(id);
            loadData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return t.daily;
      case 'weekly': return t.weekly;
      case 'monthly': return t.monthly;
      case 'yearly': return t.yearly;
      default: return freq;
    }
  };

  const renderHeader = () => (
    <View style={styles.summaryContainer}>
      {/* Overview Card */}
      <View style={styles.summaryCard}>
        <LinearGradient
          colors={[colors.primary + '18', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.summaryHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="stats-chart" size={18} color={colors.primary} />
            <Text style={styles.summaryTitle}>
              {isAr ? 'رؤية السيولة والتعهدات الشهرية' : 'Monthly Commitments & Cashflow'}
            </Text>
          </View>
          <Text style={styles.walletBadgeText}>{selectedWallet?.name}</Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>{isAr ? 'دخل متكرر' : 'Recurring Income'}</Text>
            <Text style={[styles.summaryVal, { color: colors.income }]}>
              +{formatCurrency(totalRecurringIncome)} {currencySymbol}
            </Text>
          </View>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>{isAr ? 'التزامات وأقساط' : 'Bills & Installments'}</Text>
            <Text style={[styles.summaryVal, { color: colors.expense }]}>
              -{formatCurrency(totalCommitments)} {currencySymbol}
            </Text>
          </View>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>{isAr ? 'فائض حر صافي' : 'Net Free Surplus'}</Text>
            <Text style={[styles.summaryVal, { color: freeNetCashflow >= 0 ? '#3B82F6' : colors.expense }]}>
              {formatCurrency(freeNetCashflow)} {currencySymbol}
            </Text>
          </View>
        </View>

        {/* Auto Savings Goal Button */}
        <Pressable
          onPress={handleOpenAutoSavingsModal}
          style={({ pressed }) => [
            styles.autoSavingsBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
          ]}
        >
          <Ionicons name="trophy-outline" size={18} color="#FFF" />
          <Text style={styles.autoSavingsBtnText}>
            {isAr ? '🎯 تحويل الفائض إلى هدف ادخار آلي' : '🎯 Create Auto Savings Goal'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: RecurringTransaction }) => {
    const cat = getCategoryById(item.category);
    const itemColor = item.color || cat?.color || (item.type === 'income' ? colors.income : colors.primary);
    const itemIcon = item.icon || cat?.icon || 'receipt';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.catIcon, { backgroundColor: itemColor + '18' }]}>
            <MaterialIcons name={itemIcon as any} size={22} color={itemColor} />
          </View>
          <View style={styles.info}>
            <Text style={styles.catName}>{getCategoryName(item.category, language)}</Text>
            {item.description ? <Text style={styles.desc} numberOfLines={1}>{item.description}</Text> : null}
            <View style={styles.badgeRow}>
              <View style={[styles.frequencyBadge, { backgroundColor: itemColor + '15' }]}>
                <Text style={[styles.frequencyText, { color: itemColor }]}>{getFrequencyLabel(item.frequency)}</Text>
              </View>
              <Text style={styles.nextDue}>
                {t.nextDueDate}: {formatDateLocalized(item.nextDueDate, language)}
              </Text>
            </View>
          </View>
          <View style={styles.actionColumn}>
            <Text style={[styles.amount, { color: item.type === 'income' ? colors.income : colors.expense }]}>
              {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)} {currencySymbol}
            </Text>
            <View style={styles.actions}>
              <Switch
                value={item.isActive}
                onValueChange={(val) => handleToggleActive(item, val)}
                trackColor={{ false: colors.border, true: colors.primary + '50' }}
                thumbColor={item.isActive ? colors.primary : colors.textTertiary}
              />
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/add-recurring?editId=${item.id}`);
                }}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => handleDelete(item.id, item.description, item.category)}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={colors.expense} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={[styles.headerRow, { paddingTop: (insets.top || webTopInset) + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name={isAr ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t.recurringTransactions}</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/add-recurring');
          }}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={{ flex: 1 }}>
          {renderHeader()}
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={54} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>{t.noRecurring}</Text>
            <Pressable
              onPress={() => router.push('/add-recurring')}
              style={styles.emptyButton}
            >
              <Text style={styles.emptyButtonText}>{t.addRecurring}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          ListHeaderComponent={renderHeader}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Auto Savings Goal Setup Modal Sheet */}
      <Modal
        visible={autoSavingsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAutoSavingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAr ? '🎯 إنشاء هدف ادخار مالي آلي' : '🎯 Create Auto Savings Goal'}
              </Text>
              <Pressable onPress={() => setAutoSavingsModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              <View style={styles.modalInfoBox}>
                <Text style={styles.modalInfoTitle}>
                  {isAr ? 'تحويل فائض سيولتك إلى ثروة ومدخرات' : 'Turn Net Surplus Into Wealth'}
                </Text>
                <Text style={styles.modalInfoSub}>
                  {isAr
                    ? `إجمالي الفائض الصافي المتاح لديك حالياً هو (${formatCurrency(freeNetCashflow)} ${currencySymbol}). حدد المستهدف الشهري المفضل للادخار:`
                    : `Your current net free surplus is (${formatCurrency(freeNetCashflow)} ${currencySymbol}). Select target monthly savings:`}
                </Text>
              </View>

              {/* Goal Title Input */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>{isAr ? 'اسم هدف الادخار:' : 'Goal Name:'}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={goalTitle}
                  onChangeText={setGoalTitle}
                  placeholder="مثال: ادخار طوارئ، شراء سيارة..."
                  placeholderTextColor={colors.textTertiary}
                  textAlign={isAr ? 'right' : 'left'}
                />
              </View>

              {/* Monthly Savings Target Input */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  {isAr ? `المستهدف الشهري للادخار (${currencySymbol}):` : `Monthly Savings Target (${currencySymbol}):`}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={savingsInput}
                  onChangeText={setSavingsInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  textAlign="right"
                />
              </View>

              {/* Quick Amount Chips */}
              <Text style={[styles.inputLabel, { marginTop: 4 }]}>
                {isAr ? 'أو اختر مبلغ ادخار شهري سريع:' : 'Or Select Quick Monthly Savings:'}
              </Text>
              <View style={styles.presetChipRow}>
                {[10, 25, 50, 100, 200].map(amt => (
                  <Pressable
                    key={amt}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSavingsInput(amt.toString());
                    }}
                    style={[
                      styles.presetChip,
                      savingsInput === amt.toString() && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                    ]}
                  >
                    <Text style={[styles.presetChipText, savingsInput === amt.toString() && { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>
                      {amt} {currencySymbol}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={handleConfirmAutoSavingsGoal}
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                ]}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmBtnText}>
                  {isAr ? 'إنشاء وتفعيل هدف الادخار 🎯' : 'Create & Activate Goal'}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'space-between',
    zIndex: 10,
    elevation: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    overflow: 'hidden',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  walletBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    padding: 12,
    borderRadius: 14,
  },
  summaryCol: {
    alignItems: 'center',
    gap: 2,
  },
  summaryLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  summaryVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  autoSavingsBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  autoSavingsBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  catName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.text,
    textAlign: 'left',
  },
  desc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  frequencyBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  frequencyText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
  },
  nextDue: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  actionColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  amount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  emptyButtonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  modalBody: {
    padding: 20,
    gap: 14,
  },
  modalInfoBox: {
    backgroundColor: colors.primary + '12',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: 4,
  },
  modalInfoTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
  modalInfoSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalConfirmBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
  },
  modalConfirmBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
