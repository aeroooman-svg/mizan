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
import { getJameyas, Jameya } from '@/lib/jameyaStorage';
import { saveGoal, SavingsGoal } from '@/lib/goalStorage';

export default function RecurringListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 10 : 0;
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const { currencySymbol, selectedWallet, wallets, refresh } = useTransactions();
  const [rates, setRates] = useState<Record<string, number>>({});
  
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [installments, setInstallments] = useState<InstallmentPlan[]>([]);
  const [jameyas, setJameyas] = useState<Jameya[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto Savings Modal State
  const [autoSavingsModalVisible, setAutoSavingsModalVisible] = useState(false);
  const [targetTotalInput, setTargetTotalInput] = useState('500');
  const [selectedMonths, setSelectedMonths] = useState(12);
  const [goalTitle, setGoalTitle] = useState('');

  useEffect(() => {
    import('@/lib/currencyApi').then(m => m.getExchangeRates()).then(r => setRates(r)).catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [recData, instData, jamData] = await Promise.all([
      getRecurringTransactions(),
      getInstallmentPlans(),
      getJameyas()
    ]);
    
    // Filter to current wallet if set
    if (selectedWallet) {
      setItems(recData.filter(item => item.walletId === selectedWallet.id || item.toWalletId === selectedWallet.id));
      setInstallments(instData.filter(item => item.walletId === selectedWallet.id || item.toWalletId === selectedWallet.id));
      setJameyas(jamData.filter(item => item.walletId === selectedWallet.id && item.paidMonthsCount < item.totalMonths));
    } else {
      setItems(recData);
      setInstallments(instData);
      setJameyas(jamData.filter(item => item.paidMonthsCount < item.totalMonths));
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
      .filter(i => i.isActive !== false && i.type === 'income')
      .reduce((sum, i) => {
        let val = i.amount;
        if (i.frequency === 'daily') val *= 30;
        else if (i.frequency === 'weekly') val *= 4.33;
        else if (i.frequency === 'yearly') val /= 12;
        return sum + val;
      }, 0);
  }, [items]);

  const totalRecurringExpenses = useMemo(() => {
    return items
      .filter(i => i.isActive !== false && (i.type === 'expense' || i.type === 'transfer'))
      .reduce((sum, i) => {
        let val = i.amount;
        if (i.frequency === 'daily') val *= 30;
        else if (i.frequency === 'weekly') val *= 4.33;
        else if (i.frequency === 'yearly') val /= 12;
        return sum + val;
      }, 0);
  }, [items]);

  const totalMonthlyInstallments = useMemo(() => {
    const targetCurrency = selectedWallet?.currency || 'EGP';
    const { convertAmount } = require('@/lib/currencyApi');
    const instSum = installments.reduce((sum, i) => {
      const instW = wallets.find(w => w.id === i.walletId);
      const instCurrency = instW ? instW.currency : targetCurrency;
      return sum + convertAmount(i.monthlyAmount || 0, instCurrency, targetCurrency, rates);
    }, 0);
    return instSum;
  }, [installments, selectedWallet, wallets, rates]);

  const totalCommitments = totalRecurringExpenses + totalMonthlyInstallments;
  const freeNetCashflow = totalRecurringIncome - totalCommitments;

  const handleOpenAutoSavingsModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const suggestedTarget = freeNetCashflow > 0 ? Math.round(freeNetCashflow * 12) : 500;
    setTargetTotalInput(suggestedTarget.toString());
    setSelectedMonths(12);
    setGoalTitle(isAr ? 'ادخار الفائض المالي 🎯' : 'Surplus Savings Goal 🎯');
    setAutoSavingsModalVisible(true);
  };

  const monthlyRequired = useMemo(() => {
    const total = parseFloat(targetTotalInput) || 0;
    return selectedMonths > 0 ? Math.round((total / selectedMonths) * 100) / 100 : 0;
  }, [targetTotalInput, selectedMonths]);

  const handleConfirmAutoSavingsGoal = async () => {
    const targetTotal = parseFloat(targetTotalInput);
    if (isNaN(targetTotal) || targetTotal <= 0) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى إدخال إجمالي مبلغ الهدف بشكل صحيح' : 'Please enter a valid total target amount'
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const deadlineDate = new Date();
    deadlineDate.setMonth(deadlineDate.getMonth() + selectedMonths);

    const autoGoal: SavingsGoal = {
      id: Crypto.randomUUID(),
      name: goalTitle.trim() || (isAr ? 'ادخار الفائض 🎯' : 'Surplus Savings Goal'),
      targetAmount: targetTotal,
      savedAmount: 0,
      deadline: deadlineDate.toISOString(),
      walletId: selectedWallet?.id || '',
      createdAt: new Date().toISOString(),
    };

    await saveGoal(autoGoal);
    setAutoSavingsModalVisible(false);

    Alert.alert(
      isAr ? 'تمت إضافة هدف الادخار بنجاح 🎉' : 'Savings Goal Created 🎉',
      isAr
        ? `تم إنشاء هدف "${autoGoal.name}" بمبلغ إجمالي (${formatCurrency(targetTotal)} ${currencySymbol}) ومعدل ادخار شهري (${formatCurrency(monthlyRequired)} ${currencySymbol}).`
        : `Created goal to save ${formatCurrency(targetTotal)} ${currencySymbol}!`,
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
    const confirmMsg = isAr ? `هل تريد حذف المعاملة المتكررة "${displayName}"؟` : `Delete recurring transaction "${displayName}"?`;
    
    const performDelete = async () => {
      await deleteRecurringTransaction(id);
      await loadData();
      try { refresh(); } catch {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        performDelete();
      }
      return;
    }

    Alert.alert(
      t.deletePlan,
      confirmMsg,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: performDelete,
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
          {selectedWallet?.name && (
            <View style={{ backgroundColor: colors.primary + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={[styles.walletBadgeText, { color: colors.primary }]}>{selectedWallet.name}</Text>
            </View>
          )}
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
            {totalMonthlyInstallments > 0 && (
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary, marginTop: 2 }}>
                {isAr
                  ? `(ثابت: ${formatCurrency(totalRecurringExpenses)} | أقساط: ${formatCurrency(totalMonthlyInstallments)})`
                  : `(Rec: ${formatCurrency(totalRecurringExpenses)} | Inst: ${formatCurrency(totalMonthlyInstallments)})`}
              </Text>
            )}
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
    const isTransfer = item.type === 'transfer' || !!item.toWalletId;
    const targetWalletObj = isTransfer && item.toWalletId ? wallets.find(w => w.id === item.toWalletId) : null;
    const cat = getCategoryById(item.category);
    const itemColor = item.color || cat?.color || (item.type === 'income' ? colors.income : colors.primary);
    const itemIcon = item.icon || (isTransfer ? 'swap-horiz' : cat?.icon || 'receipt');

    const displayName = isTransfer
      ? (targetWalletObj 
          ? (isAr ? `تحويل إلى ${targetWalletObj.name}` : `Transfer to ${targetWalletObj.name}`)
          : (isAr ? 'تحويل محفظة' : 'Wallet Transfer'))
      : getCategoryName(item.category, language);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.catIcon, { backgroundColor: itemColor + '18' }]}>
            <MaterialIcons name={itemIcon as any} size={22} color={itemColor} />
          </View>
          <View style={styles.info}>
            <Text style={styles.catName}>{displayName}</Text>
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

  const handleBack = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={[styles.headerRow, { paddingTop: (insets.top || webTopInset) + 16 }]}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
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
                  {isAr ? '🎯 تخطيط هدف ادخاري شفاف وعملي' : '🎯 Practical & Transparent Goal Setup'}
                </Text>
                <Text style={styles.modalInfoSub}>
                  {isAr
                    ? `أدخل المبلغ الإجمالي الذي تتمنى ادخاره، واختر عدد الأشهر، وسيحسب التطبيق قسط الادخار الشهري المباشر تلقائياً.`
                    : `Enter your total target amount and duration, and the app will calculate your monthly savings requirement.`}
                </Text>
              </View>

              {/* Goal Title Input */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>{isAr ? 'اسم هدف الادخار:' : 'Goal Name:'}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={goalTitle}
                  onChangeText={setGoalTitle}
                  placeholder="مثال: شراء سيارة، ادخار منزل، صندوق طوارئ..."
                  placeholderTextColor={colors.textTertiary}
                  textAlign={isAr ? 'right' : 'left'}
                />
              </View>

              {/* Total Target Amount Input */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  {isAr ? `إجمالي المبلغ المراد ادخاره (${currencySymbol}):` : `Total Target Savings Amount (${currencySymbol}):`}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={targetTotalInput}
                  onChangeText={setTargetTotalInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  textAlign="right"
                />
              </View>

              {/* Duration Months Selector Chips */}
              <Text style={[styles.inputLabel, { marginTop: 4 }]}>
                {isAr ? 'اختر مدة الادخار (عدد الأشهر):' : 'Select Savings Duration (Months):'}
              </Text>
              <View style={styles.presetChipRow}>
                {[
                  { m: 3, labelAr: '3 أشهر', labelEn: '3 Mos' },
                  { m: 6, labelAr: '6 أشهر', labelEn: '6 Mos' },
                  { m: 12, labelAr: '12 شهراً (سنة)', labelEn: '12 Mos (1 Yr)' },
                  { m: 24, labelAr: '24 شهراً (سنتين)', labelEn: '24 Mos (2 Yrs)' },
                  { m: 36, labelAr: '36 شهراً (3 سنوات)', labelEn: '36 Mos (3 Yrs)' },
                ].map(opt => (
                  <Pressable
                    key={opt.m}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedMonths(opt.m);
                    }}
                    style={[
                      styles.presetChip,
                      selectedMonths === opt.m && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                    ]}
                  >
                    <Text style={[styles.presetChipText, selectedMonths === opt.m && { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>
                      {isAr ? opt.labelAr : opt.labelEn}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Dynamic Live Calculation Banner */}
              <View style={[styles.modalInfoBox, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40', marginTop: 6 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calculator-outline" size={18} color={colors.primary} />
                  <Text style={[styles.modalInfoTitle, { color: colors.primary }]}>
                    {isAr ? 'الحساب الآلي للادخار الشهري:' : 'Calculated Monthly Savings:'}
                  </Text>
                </View>
                <Text style={[styles.modalInfoSub, { fontSize: 14, fontFamily: 'Cairo_700Bold', color: colors.text, marginTop: 4 }]}>
                  {isAr
                    ? `💡 للوصول لهدف (${formatCurrency(parseFloat(targetTotalInput) || 0)} ${currencySymbol}) خلال (${selectedMonths}) شهراً:\nستحتاج لادخار (${formatCurrency(monthlyRequired)} ${currencySymbol}) شهرياً.`
                    : `💡 To reach ${formatCurrency(parseFloat(targetTotalInput) || 0)} ${currencySymbol} in ${selectedMonths} months:\nYou need to save ${formatCurrency(monthlyRequired)} ${currencySymbol} monthly.`}
                </Text>
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
