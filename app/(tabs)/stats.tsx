import React, { useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
  Modal,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, expenseCategories, incomeCategories, Category } from '@/lib/categories';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { getCategoryName } from '@/lib/i18n';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { getBudgetsForWallet, setCategoryBudget, removeCategoryBudget } from '@/lib/budgetStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_SIZE = 180;
const STROKE_WIDTH = 26;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const BAR_CHART_HEIGHT = 160;
const BAR_CHART_WIDTH = SCREEN_WIDTH - 64;

interface CategoryStat {
  category: Category;
  total: number;
  percentage: number;
}

interface DailyData {
  day: number;
  income: number;
  expense: number;
}

export default function StatsScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 10 : 0;
  const { walletTransactions, totalIncome, totalExpense, currencySymbol, selectedWallet, customCategories, wallets, selectWallet } = useTransactions();
  const { t, language } = useLanguage();
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');
  const [scope, setScope] = useState<'monthly' | 'yearly'>('monthly');

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  // Budgets state
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [manageBudgetsVisible, setManageBudgetsVisible] = useState(false);
  const [editBudgetVisible, setEditBudgetVisible] = useState(false);
  const [activeCategoryForBudget, setActiveCategoryForBudget] = useState<Category | null>(null);
  const [budgetLimitInput, setBudgetLimitInput] = useState('');
  const [cameFromManage, setCameFromManage] = useState(false);

  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear();

  const loadBudgets = async () => {
    if (selectedWallet) {
      const b = await getBudgetsForWallet(selectedWallet.id);
      setBudgets(b);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, [selectedWallet]);

  const handlePrevMonth = () => {
    Haptics.selectionAsync();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    Haptics.selectionAsync();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handlePrevYear = () => {
    Haptics.selectionAsync();
    setViewYear(y => y - 1);
  };

  const handleNextYear = () => {
    if (viewYear >= now.getFullYear()) return;
    Haptics.selectionAsync();
    setViewYear(y => y + 1);
  };

  const currentMonth = viewMonth;
  const currentYear = viewYear;

  const monthlyTransactions = useMemo(() => {
    return walletTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [walletTransactions, currentMonth, currentYear]);

  const yearlyMonthsData = useMemo(() => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const txns = walletTransactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === m && d.getFullYear() === currentYear;
      });

      const income = txns
        .filter(t => t.type === 'income' || (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id))
        .reduce((s, t) => s + t.amount, 0);

      const expense = txns
        .filter(t => t.type === 'expense' || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id))
        .reduce((s, t) => s + t.amount, 0);

      const savings = income - expense;

      months.push({
        monthIndex: m,
        monthName: t.months[m],
        income,
        expense,
        savings,
        txCount: txns.length,
      });
    }
    return months;
  }, [walletTransactions, currentYear, selectedWallet, t]);

  const yearlyTotals = useMemo(() => {
    const totalIncome = yearlyMonthsData.reduce((s, m) => s + m.income, 0);
    const totalExpense = yearlyMonthsData.reduce((s, m) => s + m.expense, 0);
    const totalSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;
    const maxVal = Math.max(...yearlyMonthsData.map(m => Math.max(m.income, m.expense)), 1);

    return {
      totalIncome,
      totalExpense,
      totalSavings,
      savingsRate,
      maxVal,
    };
  }, [yearlyMonthsData]);

  const categoryStats = useMemo((): CategoryStat[] => {
    const filtered = monthlyTransactions.filter(t => t.type === viewType);
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);
    const catMap = new Map<string, number>();

    filtered.forEach(t => {
      catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount);
    });

    const staticCategories = viewType === 'expense' ? expenseCategories : incomeCategories;
    const userCategories = customCategories.filter(c => c.type === viewType);
    const allCategories = [...staticCategories, ...userCategories];

    const stats: CategoryStat[] = [];

    catMap.forEach((catTotal, catId) => {
      const category = allCategories.find(c => c.id === catId);
      if (category) {
        stats.push({
          category,
          total: catTotal,
          percentage: total > 0 ? (catTotal / total) * 100 : 0,
        });
      }
    });

    stats.sort((a, b) => b.total - a.total);
    return stats;
  }, [monthlyTransactions, viewType, customCategories]);

  const dailyData = useMemo((): DailyData[] => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const displayDays = Math.min(daysInMonth, now.getDate());
    const lastDays = Math.min(displayDays, 14);
    const startDay = displayDays - lastDays + 1;

    const data: DailyData[] = [];
    for (let d = startDay; d <= displayDays; d++) {
      const dayTxns = monthlyTransactions.filter(t => {
        const date = new Date(t.date);
        return date.getDate() === d;
      });
      data.push({
        day: d,
        income: dayTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      });
    }
    return data;
  }, [monthlyTransactions, currentMonth, currentYear, now]);

  const maxDailyValue = useMemo(() => {
    return Math.max(...dailyData.map(d => Math.max(d.income, d.expense)), 1);
  }, [dailyData]);

  // Recalculate income/expense totals for selected month
  const monthlyIncome = useMemo(() => {
    return monthlyTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  }, [monthlyTransactions]);

  const monthlyExpense = useMemo(() => {
    return monthlyTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  }, [monthlyTransactions]);

  const totalAmount = viewType === 'expense' ? monthlyExpense : monthlyIncome;
  const totalAll = monthlyIncome + monthlyExpense;

  const groupWidth = dailyData.length > 0 ? (BAR_CHART_WIDTH - 20) / dailyData.length : 30;
  const barWidth = Math.max(3, (groupWidth - 6) / 2);

  const handleSaveBudget = async () => {
    if (!activeCategoryForBudget || !selectedWallet) return;
    const limit = parseFloat(budgetLimitInput) || 0;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (limit > 0) {
      await setCategoryBudget(selectedWallet.id, activeCategoryForBudget.id, limit);
    } else {
      await removeCategoryBudget(selectedWallet.id, activeCategoryForBudget.id);
    }

    await loadBudgets();
    setEditBudgetVisible(false);
    if (cameFromManage) {
      setManageBudgetsVisible(true);
      setCameFromManage(false);
    }
  };

  const allExpenseCategories = useMemo(() => {
    const userCats = customCategories.filter(c => c.type === 'expense');
    return [...expenseCategories, ...userCats];
  }, [customCategories]);

  return (
    <LinearGradient
      colors={theme === 'dark' ? ['#070B14', '#0D1424', '#05070B'] : ['#F8FAFC', '#F1F5F9', '#E2E8F0']}
      style={styles.container}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 180 + (insets.bottom || 20) }}
      >
        {/* Header Row */}
        <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{t.stats}</Text>
          </View>
        </View>

        {/* Wallet Selector Row */}
        <View style={{ marginBottom: 4 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.walletSelectorScroll}
          >
            {wallets.map((wallet) => {
              const isSelected = selectedWallet?.id === wallet.id;
              return (
                <Pressable
                  key={wallet.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    selectWallet(wallet.id);
                  }}
                  style={[
                    styles.walletChip,
                    isSelected && { borderColor: wallet.color, backgroundColor: wallet.color + '15' }
                  ]}
                >
                  <MaterialIcons name={wallet.icon as any} size={16} color={isSelected ? wallet.color : colors.textSecondary} />
                  <Text style={[styles.walletChipText, { color: isSelected ? wallet.color : colors.textSecondary }]}>
                    {wallet.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Control Center: Scope Switcher (Zoom In / Zoom Out) + Nav in a Glass Card */}
        <View style={styles.controlCard}>
          {Platform.OS === 'ios' && (
            <BlurView intensity={theme === 'dark' ? 20 : 45} tint={theme === 'dark' ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
          )}

          {/* Scope Segmented Switcher */}
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 3, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setScope('monthly');
              }}
              style={[
                { flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
                scope === 'monthly' && { backgroundColor: colors.primary }
              ]}
            >
              <Ionicons name="search-outline" size={14} color={scope === 'monthly' ? '#FFF' : colors.textSecondary} />
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: scope === 'monthly' ? '#FFF' : colors.textSecondary }}>
                {language === 'ar' ? '🔍 شهري (Zoom In)' : '🔍 Monthly (Zoom In)'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setScope('yearly');
              }}
              style={[
                { flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
                scope === 'yearly' && { backgroundColor: colors.primary }
              ]}
            >
              <Ionicons name="globe-outline" size={14} color={scope === 'yearly' ? '#FFF' : colors.textSecondary} />
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: scope === 'yearly' ? '#FFF' : colors.textSecondary }}>
                {language === 'ar' ? '🌐 سنوي (Zoom Out)' : '🌐 Yearly (Zoom Out)'}
              </Text>
            </Pressable>
          </View>

          {/* Navigation Controls */}
          {scope === 'monthly' ? (
            <View style={styles.monthNav}>
              <Pressable onPress={handlePrevMonth} style={styles.monthNavBtn} hitSlop={8}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </Pressable>
              <Text style={styles.monthNavLabel}>{t.months[currentMonth]} {currentYear}</Text>
              <Pressable
                onPress={handleNextMonth}
                style={[styles.monthNavBtn, isCurrentMonth && styles.monthNavBtnDisabled]}
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={20} color={isCurrentMonth ? colors.textTertiary : colors.primary} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.monthNav}>
              <Pressable onPress={handlePrevYear} style={styles.monthNavBtn} hitSlop={8}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </Pressable>
              <Text style={styles.monthNavLabel}>{language === 'ar' ? `عام ${currentYear}` : `Year ${currentYear}`}</Text>
              <Pressable
                onPress={handleNextYear}
                style={[styles.monthNavBtn, currentYear >= now.getFullYear() && styles.monthNavBtnDisabled]}
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={20} color={currentYear >= now.getFullYear() ? colors.textTertiary : colors.primary} />
              </Pressable>
            </View>
          )}

          {scope === 'monthly' && (
            <View style={styles.segmentedControl}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setViewType('expense');
                }}
                style={[styles.segmentBtn, viewType === 'expense' && styles.segmentBtnActiveExpense]}
              >
                <Text style={[styles.segmentText, viewType === 'expense' && styles.segmentTextActive]}>
                  {t.expenses}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setViewType('income');
                }}
                style={[styles.segmentBtn, viewType === 'income' && styles.segmentBtnActiveIncome]}
              >
                <Text style={[styles.segmentText, viewType === 'income' && styles.segmentTextActive]}>
                  {t.income}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* YEARLY ZOOM OUT VIEW */}
        {scope === 'yearly' ? (
          <View style={{ marginHorizontal: 20, marginTop: 12, gap: 16 }}>
            {/* Yearly Totals Overview Cards */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <Ionicons name="arrow-down-circle" size={15} color={colors.income} />
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                    {language === 'ar' ? 'إجمالي دخل السنة' : 'Yearly Income'}
                  </Text>
                </View>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 15, color: colors.income }} numberOfLines={1} adjustsFontSizeToFit>
                  +{formatCurrency(yearlyTotals.totalIncome)} {currencySymbol}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <Ionicons name="arrow-up-circle" size={15} color={colors.expense} />
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                    {language === 'ar' ? 'إجمالي مصاريف السنة' : 'Yearly Expense'}
                  </Text>
                </View>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 15, color: colors.expense }} numberOfLines={1} adjustsFontSizeToFit>
                  -{formatCurrency(yearlyTotals.totalExpense)} {currencySymbol}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <Ionicons name="wallet-outline" size={15} color={colors.primary} />
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                    {language === 'ar' ? 'صافي الادخار السنوي' : 'Net Yearly Savings'}
                  </Text>
                </View>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 15, color: yearlyTotals.totalSavings >= 0 ? colors.primary : colors.expense }} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(yearlyTotals.totalSavings)} {currencySymbol}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <Ionicons name="pie-chart-outline" size={15} color={colors.accent} />
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                    {language === 'ar' ? 'معدل الادخار السنوي' : 'Savings Rate'}
                  </Text>
                </View>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 15, color: yearlyTotals.totalSavings >= 0 ? colors.accent : colors.expense }} numberOfLines={1} adjustsFontSizeToFit>
                  {yearlyTotals.totalIncome > 0 ? `${yearlyTotals.savingsRate}%` : '0%'}
                </Text>
              </View>
            </View>

            {/* 12-Month Yearly Visualizer Bar Chart */}
            <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }}>
                  {language === 'ar' ? '📊 مقارنة 12 شهراً للسنة' : '📊 12-Month Yearly Comparison'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.income }} />
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                      {language === 'ar' ? 'دخل' : 'Inc'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.expense }} />
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                      {language === 'ar' ? 'منصرف' : 'Exp'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Bars Display */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 12, paddingTop: 20, paddingBottom: 6 }}>
                  {yearlyMonthsData.map((m) => {
                    const incHeight = yearlyTotals.maxVal > 0 ? Math.max(4, Math.round((m.income / yearlyTotals.maxVal) * 110)) : 4;
                    const expHeight = yearlyTotals.maxVal > 0 ? Math.max(4, Math.round((m.expense / yearlyTotals.maxVal) * 110)) : 4;
                    const isSelectedMonth = m.monthIndex === currentMonth;

                    return (
                      <Pressable
                        key={m.monthIndex}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setViewMonth(m.monthIndex);
                          setScope('monthly');
                        }}
                        style={{ width: 44, alignItems: 'center', gap: 6 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 110 }}>
                          <View style={{ width: 9, height: incHeight, backgroundColor: colors.income, borderRadius: 4 }} />
                          <View style={{ width: 9, height: expHeight, backgroundColor: colors.expense, borderRadius: 4 }} />
                        </View>
                        <View style={{ paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, backgroundColor: isSelectedMonth ? colors.primary + '20' : 'transparent' }}>
                          <Text style={{ fontFamily: isSelectedMonth ? 'Cairo_700Bold' : 'Cairo_600SemiBold', fontSize: 10, color: isSelectedMonth ? colors.primary : colors.textSecondary }}>
                            {language === 'ar' 
                              ? ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس'][m.monthIndex]
                              : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m.monthIndex]}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* 12-Month Detailed Breakdown List */}
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }}>
                {language === 'ar' ? '📑 كشف حساب كل شهر بالسنة' : '📑 Monthly Breakdown List'}
              </Text>

              {yearlyMonthsData.map((m) => (
                <Pressable
                  key={m.monthIndex}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setViewMonth(m.monthIndex);
                    setScope('monthly');
                  }}
                  style={({ pressed }) => [
                    { backgroundColor: colors.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
                    pressed && { opacity: 0.9 }
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                      </View>
                      <View style={{ alignItems: 'flex-start' }}>
                        <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
                          {m.monthName} {currentYear}
                        </Text>
                        <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                          {language === 'ar' ? `${m.txCount} معاملة مسجلة` : `${m.txCount} transactions`}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                      <Ionicons name="search-outline" size={12} color={colors.primary} />
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.primary }}>
                        {language === 'ar' ? 'تفصيل (Zoom In)' : 'Zoom In'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: colors.borderLight }} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ alignItems: 'flex-start' }}>
                      <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                        {language === 'ar' ? 'الدخل' : 'Income'}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.income }}>
                        +{formatCurrency(m.income)} {currencySymbol}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-start' }}>
                      <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                        {language === 'ar' ? 'المصروف' : 'Expense'}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.expense }}>
                        -{formatCurrency(m.expense)} {currencySymbol}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                        {language === 'ar' ? 'الادخار الصافي' : 'Net Saved'}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: m.savings >= 0 ? colors.primary : colors.expense }}>
                        {formatCurrency(m.savings)} {currencySymbol}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* MONTHLY ZOOM IN VIEW */}
        {scope === 'monthly' && (
          <>
            {/* Overview Row Cards with dynamic ambient shadows */}
            <View style={styles.overviewCards}>
              <View style={[
                styles.overviewCard, 
                { 
                  shadowColor: colors.income, 
                  shadowOpacity: theme === 'dark' ? 0.25 : 0.08, 
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 }
                }
              ]}>
                {Platform.OS === 'ios' && (
                  <BlurView intensity={theme === 'dark' ? 15 : 40} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                )}
                <View style={styles.overviewRow}>
                  <View style={[styles.overviewIconWrap, { backgroundColor: colors.income + '12' }]}>
                    <Ionicons name="arrow-down" size={16} color={colors.income} />
                  </View>
                  <Text style={styles.overviewLabel}>{t.income}</Text>
                </View>
                <Text style={[styles.overviewValue, { color: colors.income }]} numberOfLines={1}>
                  {formatCurrency(monthlyIncome)} <Text style={styles.overviewCurrency}>{currencySymbol}</Text>
                </Text>
              </View>

              <View style={[
                styles.overviewCard, 
                { 
                  shadowColor: colors.expense, 
                  shadowOpacity: theme === 'dark' ? 0.25 : 0.08, 
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 }
                }
              ]}>
                {Platform.OS === 'ios' && (
                  <BlurView intensity={theme === 'dark' ? 15 : 40} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                )}
                <View style={styles.overviewRow}>
                  <View style={[styles.overviewIconWrap, { backgroundColor: colors.expense + '12' }]}>
                    <Ionicons name="arrow-up" size={16} color={colors.expense} />
                  </View>
                  <Text style={styles.overviewLabel}>{t.expenses}</Text>
                </View>
                <Text style={[styles.overviewValue, { color: colors.expense }]} numberOfLines={1}>
                  {formatCurrency(monthlyExpense)} <Text style={styles.overviewCurrency}>{currencySymbol}</Text>
                </Text>
              </View>
            </View>

        {/* Main Chart Section */}
        {categoryStats.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>{t.noData}</Text>
            <Text style={styles.emptySubtitle}>{t.addTransactionsForStats}</Text>
          </View>
        ) : (
          <View style={styles.donutSection}>
            <View style={styles.donutCard}>
              {Platform.OS === 'ios' && (
                <BlurView intensity={theme === 'dark' ? 15 : 40} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              )}
              <View style={styles.chartContainer}>
                <Svg width={CHART_SIZE} height={CHART_SIZE}>
                  <Circle
                    cx={CHART_SIZE / 2}
                    cy={CHART_SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}
                    strokeWidth={STROKE_WIDTH}
                  />
                  {(() => {
                    let accumulatedOffset = 0;
                    return categoryStats.map((stat) => {
                      const segmentLength = (stat.percentage / 100) * CIRCUMFERENCE;
                      const offset = accumulatedOffset;
                      accumulatedOffset += segmentLength;
                      return (
                        <Circle
                          key={stat.category.id}
                          cx={CHART_SIZE / 2}
                          cy={CHART_SIZE / 2}
                          r={RADIUS}
                          fill="none"
                          stroke={stat.category.color}
                          strokeWidth={STROKE_WIDTH}
                          strokeDasharray={`${segmentLength} ${CIRCUMFERENCE - segmentLength}`}
                          strokeDashoffset={-offset}
                          strokeLinecap="round"
                          transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}
                        />
                      );
                    });
                  })()}
                </Svg>
                <View style={styles.chartCenter}>
                  <Text style={styles.chartTotal}>{formatCurrency(totalAmount)}</Text>
                  <Text style={styles.chartLabel}>{currencySymbol}</Text>
                </View>
              </View>
            </View>

            {/* Categories Breakdown details list */}
            <View style={styles.categoriesSection}>
              <Text style={styles.sectionTitle}>{t.details}</Text>
              <View style={styles.categoriesList}>
                {categoryStats.map((stat) => {
                  const budgetLimit = budgets[stat.category.id] || 0;
                  const hasBudget = budgetLimit > 0;
                  const isOverBudget = hasBudget && stat.total > budgetLimit;

                  return (
                    <View key={stat.category.id} style={styles.premiumCategoryCard}>
                      <View style={styles.categoryRowTop}>
                        <View style={[styles.catIconWrap, { backgroundColor: stat.category.color + '15' }]}>
                          <MaterialIcons name={stat.category.icon as any} size={18} color={stat.category.color} />
                        </View>
                        <View style={{ flex: 1, paddingHorizontal: 4 }}>
                          <Text style={styles.categoryName} numberOfLines={1}>{getCategoryName(stat.category.id, language)}</Text>
                          <Text style={styles.categoryPercent}>{Math.round(stat.percentage)}%</Text>
                        </View>
                        <Text style={styles.categoryAmount}>{formatCurrency(stat.total)} {currencySymbol}</Text>
                      </View>
                      <View style={styles.categoryBarBg}>
                        <View
                          style={[styles.categoryBarFill, {
                            width: `${stat.percentage}%`,
                            backgroundColor: stat.category.color,
                          }]}
                        />
                      </View>
                      {hasBudget && (
                        <View style={styles.budgetStatusRow}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.budgetProgressBgSmall}>
                              <View 
                                style={[
                                  styles.budgetProgressFillSmall, 
                                  { 
                                    width: `${Math.min(100, (stat.total / budgetLimit) * 100)}%`,
                                    backgroundColor: isOverBudget ? colors.expense : colors.primary
                                  }
                                ]} 
                              />
                            </View>
                          </View>
                          <Text style={[styles.budgetStatusText, isOverBudget && { color: colors.expense, fontFamily: 'Cairo_700Bold' }]}>
                            {isOverBudget 
                              ? (language === 'ar' ? '⚠️ تجاوزت الحد!' : '⚠️ Over limit!')
                              : (language === 'ar' ? `ميزانية: ${formatCurrency(budgetLimit)}` : `Budget: ${formatCurrency(budgetLimit)}`)}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Daily Spending Bar Chart Section */}
        {dailyData.length > 0 && monthlyTransactions.length > 0 && (
          <View style={styles.barChartSection}>
            <Text style={styles.sectionTitle}>{t.dailySpending}</Text>
            <View style={styles.barChartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
                <Text style={styles.legendText}>{t.incomeType}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
                <Text style={styles.legendText}>{t.expenses}</Text>
              </View>
            </View>
            <View style={styles.barChartCard}>
              {Platform.OS === 'ios' && (
                <BlurView intensity={theme === 'dark' ? 15 : 40} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              )}
              <Svg width={BAR_CHART_WIDTH} height={BAR_CHART_HEIGHT + 35}>
                {dailyData.map((d, i) => {
                  const x = i * groupWidth + 12;
                  const incomeH = (d.income / maxDailyValue) * BAR_CHART_HEIGHT;
                  const expenseH = (d.expense / maxDailyValue) * BAR_CHART_HEIGHT;
                  return (
                    <React.Fragment key={d.day}>
                      <Rect
                        x={x}
                        y={BAR_CHART_HEIGHT - incomeH}
                        width={barWidth}
                        height={Math.max(incomeH, 3)}
                        rx={barWidth / 2}
                        fill={colors.income}
                        opacity={0.85}
                      />
                      <Rect
                        x={x + barWidth + 3}
                        y={BAR_CHART_HEIGHT - expenseH}
                        width={barWidth}
                        height={Math.max(expenseH, 3)}
                        rx={barWidth / 2}
                        fill={colors.expense}
                        opacity={0.85}
                      />
                      <SvgText
                        x={x + barWidth + 1.5}
                        y={BAR_CHART_HEIGHT + 22}
                        fontSize={9}
                        fontFamily="Cairo_600SemiBold"
                        fill={colors.textSecondary}
                        textAnchor="middle"
                      >
                        {d.day}
                      </SvgText>
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>
          </View>
        )}
        </>
        )}

        {/* Dedicated Premium Budgets Dashboard */}
        <View style={styles.budgetsSection}>
          <View style={styles.budgetsHeaderRow}>
            <Text style={styles.sectionTitle}>{language === 'ar' ? 'الميزانيات والحدود الذكية' : 'Smart Budgets & Limits'}</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setManageBudgetsVisible(true);
              }}
              style={styles.manageBudgetsBtn}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.manageBudgetsBtnText}>{language === 'ar' ? 'إدارة' : 'Manage'}</Text>
            </Pressable>
          </View>

          {Object.keys(budgets).length === 0 ? (
            <Pressable 
              onPress={() => {
                Haptics.selectionAsync();
                setManageBudgetsVisible(true);
              }}
              style={styles.emptyBudgetCard}
            >
              <Ionicons name="wallet-outline" size={32} color={colors.primary} />
              <Text style={styles.emptyBudgetTitle}>
                {language === 'ar' ? 'لم تحدد أي ميزانية بعد' : 'No Budgets Configured Yet'}
              </Text>
              <Text style={styles.emptyBudgetSubtitle}>
                {language === 'ar' ? 'اضغط هنا لتحديد حد إنفاق شهري للفئات وتجنب الإسراف' : 'Tap here to set monthly spending limits for categories and save money'}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.budgetsGrid}>
              {allExpenseCategories
                .filter(cat => budgets[cat.id] > 0)
                .map(cat => {
                  const limit = budgets[cat.id];
                  const catStat = categoryStats.find(s => s.category.id === cat.id);
                  const spent = catStat ? catStat.total : 0;
                  const percent = Math.min(100, (spent / limit) * 100);
                  const remaining = limit - spent;
                  const isOver = spent > limit;
                  const barColor = isOver ? colors.expense : (percent > 85 ? '#F59E0B' : cat.color);

                  return (
                    <View key={cat.id} style={styles.premiumBudgetCard}>
                      <View style={styles.budgetCardTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[styles.budgetIconWrap, { backgroundColor: cat.color + '15' }]}>
                            <MaterialIcons name={cat.icon as any} size={18} color={cat.color} />
                          </View>
                          <Text style={styles.budgetName}>{getCategoryName(cat.id, language)}</Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            setActiveCategoryForBudget(cat);
                            setBudgetLimitInput(limit.toString());
                            setEditBudgetVisible(true);
                          }}
                          hitSlop={12}
                        >
                          <Ionicons name="pencil" size={16} color={colors.textTertiary} />
                        </Pressable>
                      </View>

                      <View style={{ marginVertical: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={styles.budgetAmountText}>
                            {formatCurrency(spent)} / {formatCurrency(limit)} {currencySymbol}
                          </Text>
                          <Text style={[styles.budgetPercentText, { color: barColor }]}>
                            {Math.round(percent)}%
                          </Text>
                        </View>
                        <View style={styles.budgetProgressBg}>
                          <View style={[styles.budgetProgressFill, { width: `${percent}%`, backgroundColor: barColor }]} />
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.budgetRemainingText, isOver && { color: colors.expense, fontFamily: 'Cairo_700Bold' }]}>
                          {isOver 
                            ? (language === 'ar' ? `⚠️ تجاوزت بـ ${formatCurrency(Math.abs(remaining))}` : `⚠️ Over by ${formatCurrency(Math.abs(remaining))}`)
                            : (language === 'ar' ? `متبقي ${formatCurrency(remaining)}` : `${formatCurrency(remaining)} left`)
                          }
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Manage Budgets Modal */}
      <Modal visible={manageBudgetsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setManageBudgetsVisible(false)} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
              <Text style={styles.modalTitle}>{t.setBudget}</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.budgetsList}>
              {allExpenseCategories.map(cat => {
                const limit = budgets[cat.id] || 0;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveCategoryForBudget(cat);
                      setBudgetLimitInput(limit > 0 ? limit.toString() : '');
                      setCameFromManage(true);
                      setManageBudgetsVisible(false);
                      setTimeout(() => {
                        setEditBudgetVisible(true);
                      }, 120);
                    }}
                    style={({ pressed }) => [styles.budgetListItem, pressed && styles.pressedItem]}
                  >
                    <View style={[styles.catIcon, { backgroundColor: cat.color + '18' }]}>
                      <MaterialIcons name={cat.icon as any} size={20} color={cat.color} />
                    </View>
                    <Text style={styles.budgetCatName}>{getCategoryName(cat.id, language)}</Text>
                    <View style={styles.budgetLimitValueContainer}>
                      <Text style={styles.budgetLimitValue}>
                        {limit > 0 ? `${formatCurrency(limit)} ${currencySymbol}` : t.noBudget}
                      </Text>
                      <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Edit Single Budget Sub-Modal */}
      <Modal visible={editBudgetVisible} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.editBudgetCard}>
            <Text style={styles.editBudgetTitle}>
              {activeCategoryForBudget ? getCategoryName(activeCategoryForBudget.id, language) : ''}
            </Text>
            <Text style={styles.editBudgetSubtitle}>{t.budgetLimit} ({currencySymbol})</Text>

            <TextInput
              style={styles.budgetInput}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              value={budgetLimitInput}
              onChangeText={setBudgetLimitInput}
              autoFocus
              textAlign="center"
            />

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => {
                  setEditBudgetVisible(false);
                  if (cameFromManage) {
                    setManageBudgetsVisible(true);
                    setCameFromManage(false);
                  }
                }}
                style={[styles.modalActionBtn, styles.modalActionCancel]}
              >
                <Text style={styles.modalActionCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveBudget}
                style={[styles.modalActionBtn, styles.modalActionSave, { backgroundColor: activeCategoryForBudget?.color || colors.primary }]}
              >
                <Text style={styles.modalActionSaveText}>{t.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent to let the LinearGradient show through!
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: colors.text,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  walletBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  controlCard: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface + '60',
    padding: 12,
    gap: 12,
    overflow: 'hidden',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '12',
  },
  monthNavBtnDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.3,
  },
  monthNavLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt + '80',
    borderRadius: 10,
    padding: 3,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActiveExpense: {
    backgroundColor: colors.expense,
  },
  segmentBtnActiveIncome: {
    backgroundColor: colors.income,
  },
  segmentText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFF',
  },
  overviewCards: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.surface + '80',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 4,
    overflow: 'hidden',
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  overviewIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  overviewValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
  },
  overviewCurrency: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  donutSection: {
    gap: 16,
    marginTop: 16,
  },
  donutCard: {
    marginHorizontal: 20,
    backgroundColor: colors.surface + '60',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chartContainer: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  chartTotal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.text,
  },
  chartLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -2,
  },
  categoriesSection: {
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
    textAlign: 'left',
  },
  categoriesList: {
    gap: 10,
    marginTop: 10,
  },
  premiumCategoryCard: {
    backgroundColor: colors.surface + '60',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
    textAlign: 'left',
  },
  categoryPercent: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'left',
    marginTop: -2,
  },
  categoryAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  categoryBarBg: {
    height: 6,
    backgroundColor: colors.surfaceAlt + '60',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  categoryBarFill: {
    height: 6,
    borderRadius: 3,
  },
  budgetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  budgetProgressBgSmall: {
    height: 4,
    backgroundColor: colors.surfaceAlt + '60',
    borderRadius: 2,
    overflow: 'hidden',
  },
  budgetProgressFillSmall: {
    height: 4,
    borderRadius: 2,
  },
  budgetStatusText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 9,
    color: colors.textTertiary,
  },
  barChartSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  barChartLegend: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
  },
  barChartCard: {
    backgroundColor: colors.surface + '60',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  budgetsSection: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: colors.surface + '60',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  budgetsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manageBudgetsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  manageBudgetsBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: colors.primary,
  },
  emptyBudgetCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceAlt + '40',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    gap: 8,
  },
  emptyBudgetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },
  emptyBudgetSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  budgetsGrid: {
    gap: 12,
  },
  premiumBudgetCard: {
    backgroundColor: colors.surfaceAlt + '40',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  budgetCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  budgetAmountText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  budgetPercentText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  budgetProgressBg: {
    height: 8,
    backgroundColor: colors.surface + '60',
    borderRadius: 4,
    overflow: 'hidden',
  },
  budgetProgressFill: {
    height: 8,
    borderRadius: 4,
  },
  budgetRemainingText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  budgetsList: {
    padding: 16,
  },
  budgetListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  pressedItem: {
    backgroundColor: colors.surfaceAlt,
  },
  budgetCatName: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.text,
    textAlign: 'left',
  },
  budgetLimitValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  budgetLimitValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBudgetCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 320,
    alignItems: 'center',
    gap: 12,
  },
  editBudgetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  editBudgetSubtitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  budgetInput: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 24,
    fontFamily: 'Cairo_700Bold',
    color: colors.text,
    textAlign: 'center',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalActionCancel: {
    backgroundColor: colors.surfaceAlt,
  },
  modalActionCancelText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalActionSave: {
    // bgColor dynamically loaded
  },
  modalActionSaveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletSelectorScroll: {
    paddingHorizontal: 20,
    gap: 8,
    marginVertical: 10,
    flexDirection: 'row',
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt + '80',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  walletChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
});
