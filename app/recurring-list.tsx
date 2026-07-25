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

  const handleCreateAutoSavingsGoal = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (freeNetCashflow <= 0) {
      Alert.alert(
        isAr ? 'تنبيه السيولة ⚠️' : 'Cashflow Notice',
        isAr
          ? 'لا يوجد فائض سيولة حر متبقي حالياً لإنشاء هدف ادخار تلقائي. يرجى مراجعة المصاريف والأقساط.'
          : 'No free net surplus remaining to auto-create a savings goal.'
      );
      return;
    }

    const monthlySavingsTarget = Math.round(freeNetCashflow * 0.6); // 60% of free cashflow
    const target6Months = monthlySavingsTarget * 6;

    const autoGoal: SavingsGoal = {
      id: Crypto.randomUUID(),
      name: isAr ? 'ادخار الفائض الصافي التلقائي 🎯' : 'Net Surplus Auto-Savings Goal 🎯',
      targetAmount: target6Months,
      savedAmount: 0,
      deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      walletId: selectedWallet?.id || '',
      createdAt: new Date().toISOString(),
    };

    await saveGoal(autoGoal);

    Alert.alert(
      isAr ? 'تمت إضافة هدف الادخار التلقائي 🎉' : 'Savings Goal Created 🎉',
      isAr
        ? `تم إنشاء هدف ادخار بمبلغ (${formatCurrency(target6Months)} ${currencySymbol}) بمعدل ادخار شهري مقترح (${formatCurrency(monthlySavingsTarget)} ${currencySymbol}).`
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
          onPress={handleCreateAutoSavingsGoal}
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
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.catIcon, { backgroundColor: (cat?.color || colors.primary) + '18' }]}>
            <MaterialIcons name={cat?.icon as any || 'receipt'} size={22} color={cat?.color || colors.primary} />
          </View>
          <View style={styles.info}>
            <Text style={styles.catName}>{getCategoryName(item.category, language)}</Text>
            {item.description ? <Text style={styles.desc} numberOfLines={1}>{item.description}</Text> : null}
            <View style={styles.badgeRow}>
              <View style={styles.frequencyBadge}>
                <Text style={styles.frequencyText}>{getFrequencyLabel(item.frequency)}</Text>
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
});
