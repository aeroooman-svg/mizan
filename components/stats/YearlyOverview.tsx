import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { formatCurrency } from '@/lib/categories';
import { DonutChart, CategoryStatWithColor } from './DonutChart';
import { TagBreakdown, TagStatItem } from './TagBreakdown';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface YearlyMonthItem {
  monthIndex: number;
  monthName: string;
  income: number;
  expense: number;
  savings: number;
  txCount: number;
}

export interface YearlyTotals {
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
  savingsRate: number;
  maxVal: number;
}

export interface YearlyFinancialInsights {
  monthlyAvgExpense: number;
  monthlyAvgIncome: number;
  monthlyAvgSavings: number;
  peakExpenseMonth: { monthName: string; amount: number } | null;
  lowestExpenseMonth: { monthName: string; amount: number } | null;
  bestSavingsMonth: { monthName: string; amount: number } | null;
  elapsedMonths: number;
  yearlyTransfersOut: number;
  yearlyTotalSavings: number;
  yoyExpenseChangePercent: number;
  yoyIncomeChangePercent: number;
  prevYearExpense: number;
  prevYearIncome: number;
  prevYear: number;
}

interface YearlyOverviewProps {
  yearlyTotals: YearlyTotals;
  yearlyMonthsData: YearlyMonthItem[];
  financialInsights: YearlyFinancialInsights;
  categoryStatsWithColors: CategoryStatWithColor[];
  tagStats: TagStatItem[];
  viewType: 'expense' | 'income';
  totalAmount: number;
  budgets: Record<string, number>;
  theme: string;
  t: any;
  currentYear: number;
  currentMonth: number;
  currencySymbol: string;
  language: string;
  colors: any;
  onSelectMonth: (monthIndex: number) => void;
  onCardPress: (type: 'expense' | 'income' | 'rosca' | 'transfer') => void;
}

export const YearlyOverview: React.FC<YearlyOverviewProps> = ({
  yearlyTotals,
  yearlyMonthsData,
  financialInsights,
  categoryStatsWithColors,
  tagStats,
  viewType,
  totalAmount,
  budgets,
  theme,
  t,
  currentYear,
  currentMonth,
  currencySymbol,
  language,
  colors,
  onSelectMonth,
  onCardPress,
}) => {
  const isAr = language === 'ar';
  const isMl = language === 'ml' || language === 'hi';

  const loc = (ar: string, en: string, ml?: string) => {
    if (isMl) return ml || en;
    if (isAr) return ar;
    return en;
  };

  const monthAbbrs = isAr
    ? ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Health assessment
  const getHealthBadge = () => {
    if (yearlyTotals.savingsRate >= 20) {
      return {
        label: loc('فائض استراتيجي ممتاز 🌟', 'Excellent Strategic Surplus 🌟', 'മികച്ച മിച്ചം 🌟'),
        color: '#10B981',
        bg: '#10B98118',
      };
    } else if (yearlyTotals.savingsRate >= 5) {
      return {
        label: loc('وضع مالي متزن ومستقر ⚖️', 'Balanced & Stable ⚖️', 'സ്ഥിരതയുള്ള സ്ഥിതി ⚖️'),
        color: '#06B6D4',
        bg: '#06B6D418',
      };
    } else if (yearlyTotals.totalSavings >= 0) {
      return {
        label: loc('ضمن حد الأمان المالي 🛡️', 'Financial Safety Margin 🛡️', 'സുരക്ഷിത പരിധി 🛡️'),
        color: '#F59E0B',
        bg: '#F59E0B18',
      };
    } else {
      return {
        label: loc('عجز مالي سنوي ⚠️', 'Yearly Deficit ⚠️', 'കമ്മി ⚠️'),
        color: '#EF4444',
        bg: '#EF444418',
      };
    }
  };

  const health = getHealthBadge();

  // 1. Interactive Month Inspector state
  const [selectedMonthIndex, setSelectedMonthIndex] = React.useState<number>(() => {
    const curMonthData = yearlyMonthsData.find((m) => m.monthIndex === currentMonth && m.txCount > 0);
    if (curMonthData) return currentMonth;
    const mostActive = [...yearlyMonthsData].sort((a, b) => b.txCount - a.txCount)[0];
    if (mostActive && mostActive.txCount > 0) return mostActive.monthIndex;
    return currentMonth;
  });

  // 2. Collapsible ledger states
  const [showAllMonths, setShowAllMonths] = React.useState<boolean>(false);
  const [filterActiveOnly, setFilterActiveOnly] = React.useState<boolean>(true);

  const selectedMonthData =
    yearlyMonthsData.find((m) => m.monthIndex === selectedMonthIndex) ||
    yearlyMonthsData[currentMonth] ||
    yearlyMonthsData[0];

  const activeMonthsCount = yearlyMonthsData.filter((m) => m.txCount > 0).length;
  const displayMonths = filterActiveOnly
    ? yearlyMonthsData.filter((m) => m.txCount > 0)
    : yearlyMonthsData;

  const handlePrevMonth = () => {
    Haptics.selectionAsync();
    setSelectedMonthIndex((prev) => (prev > 0 ? prev - 1 : 11));
  };

  const handleNextMonth = () => {
    Haptics.selectionAsync();
    setSelectedMonthIndex((prev) => (prev < 11 ? prev + 1 : 0));
  };

  return (
    <View style={styles.container}>
      {/* 1. Year-over-Year (YoY) Comprehensive Comparison Banner */}
      {financialInsights.prevYearExpense > 0 ? (
        <View style={[styles.yoyBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.yoyHeaderRow}>
            <View style={styles.yoyHeaderLeft}>
              <Ionicons name="trending-up" size={18} color={colors.primary} />
              <Text style={[styles.yoyTitle, { color: colors.text }]}>
                {loc(
                  `مقارنة بالعام السابق (YoY) - ${financialInsights.prevYear}`,
                  `Year-over-Year (YoY) vs ${financialInsights.prevYear}`,
                  `കഴിഞ്ഞ വർഷത്തെ താരതമ്യം (${financialInsights.prevYear})`
                )}
              </Text>
            </View>

            <View
              style={[
                styles.yoyBadge,
                {
                  backgroundColor:
                    financialInsights.yoyExpenseChangePercent <= 0 ? '#10B98118' : '#EF444418',
                },
              ]}
            >
              <Text
                style={[
                  styles.yoyBadgeText,
                  {
                    color:
                      financialInsights.yoyExpenseChangePercent <= 0 ? '#10B981' : '#EF4444',
                  },
                ]}
              >
                {financialInsights.yoyExpenseChangePercent <= 0
                  ? `${financialInsights.yoyExpenseChangePercent}%`
                  : `+${financialInsights.yoyExpenseChangePercent}%`}
              </Text>
            </View>
          </View>

          <Text style={[styles.yoyDescription, { color: colors.textSecondary }]}>
            {financialInsights.yoyExpenseChangePercent <= 0
              ? loc(
                  `ممتاز! إجمالي مصاريفك هذا العام أقل بنسبة ${Math.abs(
                    financialInsights.yoyExpenseChangePercent
                  )}% مقارنة بعام ${financialInsights.prevYear}.`,
                  `Great! Your total expenses this year are ${Math.abs(
                    financialInsights.yoyExpenseChangePercent
                  )}% lower than in ${financialInsights.prevYear}.`,
                  `മികച്ചത്! നിങ്ങളുടെ ഈ വർഷത്തെ ചെലവുകൾ ${financialInsights.prevYear}-നെ അപേക്ഷിച്ച് ${Math.abs(
                    financialInsights.yoyExpenseChangePercent
                  )}% കുറവാണ്.`
                )
              : loc(
                  `تنبيه: إجمالي مصاريفك هذا العام ارتفعت بنسبة ${financialInsights.yoyExpenseChangePercent}% مقارنة بعام ${financialInsights.prevYear}.`,
                  `Notice: Your total expenses this year increased by ${financialInsights.yoyExpenseChangePercent}% compared to ${financialInsights.prevYear}.`,
                  `ശ്രദ്ധിക്കുക: നിങ്ങളുടെ ഈ വർഷത്തെ ചെലവുകൾ ${financialInsights.prevYear}-നെ അപേക്ഷിച്ച് ${financialInsights.yoyExpenseChangePercent}% വർദ്ധിച്ചു.`
                )}
          </Text>

          <View style={[styles.yoyIncomeRow, { borderTopColor: colors.borderLight }]}>
            <Text style={[styles.yoyIncomeLabel, { color: colors.textSecondary }]}>
              {loc(
                `مقارنة الدخل السنوي بالعام السابق:`,
                `Yearly Income Comparison vs ${financialInsights.prevYear}:`,
                `വാർഷിക വരുമാന താരതമ്യം:`
              )}
            </Text>
            <Text
              style={[
                styles.yoyIncomeValue,
                {
                  color:
                    financialInsights.yoyIncomeChangePercent >= 0 ? '#10B981' : '#EF4444',
                },
              ]}
            >
              {financialInsights.yoyIncomeChangePercent >= 0 ? '+' : ''}
              {financialInsights.yoyIncomeChangePercent}%
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.yoyCompactBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.yoyCompactIconWrap, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
          </View>
          <Text style={[styles.yoyCompactText, { color: colors.textSecondary }]}>
            {loc(
              `عام ${currentYear} هو سنة الأساس — ستتوفر المقارنات السنوية التلقائية فور تسجيل بيانات الأعوام الأخرى.`,
              `Year ${currentYear} is your baseline year. Multi-year comparisons activate automatically with more years.`,
              `${currentYear} അടിസ്ഥാന വർഷമാണ്.`
            )}
          </Text>
        </View>
      )}

      {/* 2. Interactive Yearly Overview Cards (4 Cards matching Monthly) */}
      <View style={styles.overviewGrid}>
        {/* Income Card */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onCardPress('income');
          }}
          style={({ pressed }) => [
            styles.overviewCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.income,
              shadowOpacity: theme === 'dark' ? 0.25 : 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
            },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={theme === 'dark' ? 15 : 40}
              tint={theme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.overviewCardHeader}>
            <View style={[styles.overviewIconWrap, { backgroundColor: colors.income + '15' }]}>
              <Ionicons name="arrow-down" size={16} color={colors.income} />
            </View>
            <View style={styles.overviewTitleRow}>
              <Text style={[styles.overviewLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {loc('دخل السنة', 'Yearly Income', 'വാർഷിക വരുമാനം')}
              </Text>
              <Ionicons name="chevron-forward" size={10} color={colors.textTertiary} />
            </View>
          </View>
          <Text style={[styles.overviewValue, { color: colors.income }]} numberOfLines={1} adjustsFontSizeToFit>
            +{formatCurrency(yearlyTotals.totalIncome)}{' '}
            <Text style={[styles.overviewCurrency, { color: colors.textSecondary }]}>
              {currencySymbol}
            </Text>
          </Text>
        </Pressable>

        {/* Expense Card */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onCardPress('expense');
          }}
          style={({ pressed }) => [
            styles.overviewCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.expense,
              shadowOpacity: theme === 'dark' ? 0.25 : 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
            },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={theme === 'dark' ? 15 : 40}
              tint={theme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.overviewCardHeader}>
            <View style={[styles.overviewIconWrap, { backgroundColor: colors.expense + '15' }]}>
              <Ionicons name="arrow-up" size={16} color={colors.expense} />
            </View>
            <View style={styles.overviewTitleRow}>
              <Text style={[styles.overviewLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {loc('مصاريف السنة', 'Yearly Expenses', 'വാർഷിക ചെലവ്')}
              </Text>
              <Ionicons name="chevron-forward" size={10} color={colors.textTertiary} />
            </View>
          </View>
          <Text style={[styles.overviewValue, { color: colors.expense }]} numberOfLines={1} adjustsFontSizeToFit>
            -{formatCurrency(yearlyTotals.totalExpense)}{' '}
            <Text style={[styles.overviewCurrency, { color: colors.textSecondary }]}>
              {currencySymbol}
            </Text>
          </Text>
        </Pressable>

        {/* Savings Card (Includes ROSCA & Goals) */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onCardPress('rosca');
          }}
          style={({ pressed }) => [
            styles.overviewCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: '#0D7C66',
              shadowOpacity: theme === 'dark' ? 0.25 : 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
            },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={theme === 'dark' ? 15 : 40}
              tint={theme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.overviewCardHeader}>
            <View style={[styles.overviewIconWrap, { backgroundColor: '#0D7C6615' }]}>
              <Ionicons name="wallet-outline" size={16} color="#0D7C66" />
            </View>
            <View style={styles.overviewTitleRow}>
              <Text style={[styles.overviewLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {loc('الادخار السنوي', 'Yearly Savings', 'വാർഷിക സമ്പാദ്യം')}
              </Text>
              <Ionicons name="chevron-forward" size={10} color={colors.textTertiary} />
            </View>
          </View>
          <Text
            style={[
              styles.overviewValue,
              { color: yearlyTotals.totalSavings >= 0 ? '#0D7C66' : colors.expense },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {yearlyTotals.totalSavings >= 0 ? '+' : ''}
            {formatCurrency(yearlyTotals.totalSavings)}{' '}
            <Text style={[styles.overviewCurrency, { color: colors.textSecondary }]}>
              {currencySymbol}
            </Text>
          </Text>
        </Pressable>

        {/* Transfers Card */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onCardPress('transfer');
          }}
          style={({ pressed }) => [
            styles.overviewCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: '#6366F1',
              shadowOpacity: theme === 'dark' ? 0.25 : 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
            },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={theme === 'dark' ? 15 : 40}
              tint={theme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.overviewCardHeader}>
            <View style={[styles.overviewIconWrap, { backgroundColor: '#6366F115' }]}>
              <Ionicons name="swap-horizontal" size={16} color="#6366F1" />
            </View>
            <View style={styles.overviewTitleRow}>
              <Text style={[styles.overviewLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {loc('التحويلات السنوية', 'Yearly Transfers', 'വാർഷിക കൈമാറ്റങ്ങൾ')}
              </Text>
              <Ionicons name="chevron-forward" size={10} color={colors.textTertiary} />
            </View>
          </View>
          <Text style={[styles.overviewValue, { color: '#6366F1' }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(financialInsights.yearlyTransfersOut)}{' '}
            <Text style={[styles.overviewCurrency, { color: colors.textSecondary }]}>
              {currencySymbol}
            </Text>
          </Text>
        </Pressable>
      </View>

      {/* 3. Deep Financial Reality & Strategic Run-Rate Card */}
      <View
        style={[
          styles.realityCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: '#10B981',
            shadowOpacity: theme === 'dark' ? 0.2 : 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          },
        ]}
      >
        <View style={styles.realityHeader}>
          <View style={styles.realityHeaderLeft}>
            <View style={[styles.realityIconWrap, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="compass-outline" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.realityTitle, { color: colors.text }]}>
                {loc('الواقع المالي والتحليل السنوي', 'Financial Reality & Strategic Run-Rate', 'സാമ്പത്തിക വിശകലനം')}
              </Text>
              <Text style={[styles.realitySubtitle, { color: colors.textSecondary }]}>
                {loc(
                  `مؤشرات حية محسوبة على ${financialInsights.elapsedMonths} أشهر مسجلة`,
                  `Live indicators across ${financialInsights.elapsedMonths} recorded months`,
                  `${financialInsights.elapsedMonths} മാസങ്ങളിലെ കണക്കുകൾ`
                )}
              </Text>
            </View>
          </View>

          <View style={[styles.healthBadge, { backgroundColor: health.bg }]}>
            <Text style={[styles.healthBadgeText, { color: health.color }]}>
              {health.label}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

        {/* 4-Metric Reality Grid */}
        <View style={styles.realityMetricsGrid}>
          {/* Monthly Avg Expense */}
          <View style={[styles.realityMetricBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]}>
            <View style={styles.realityMetricRow}>
              <Ionicons name="speedometer-outline" size={14} color={colors.expense} />
              <Text style={[styles.realityMetricLabel, { color: colors.textSecondary }]}>
                {loc('متوسط المصروف الشهري', 'Monthly Avg Expense', 'പ്രതിമാസ ശരാശരി ചെലവ്')}
              </Text>
            </View>
            <Text style={[styles.realityMetricValue, { color: colors.expense }]}>
              {formatCurrency(financialInsights.monthlyAvgExpense)}{' '}
              <Text style={{ fontSize: 10, fontFamily: 'Cairo_600SemiBold' }}>{currencySymbol}/شهر</Text>
            </Text>
            <Text style={[styles.realityMetricNote, { color: colors.textTertiary }]}>
              {loc('معدل الاستهلاك الشهري', 'Monthly burn rate', 'പ്രതിമാസ ചെലവ് നിരക്ക്')}
            </Text>
          </View>

          {/* Monthly Avg Income */}
          <View style={[styles.realityMetricBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]}>
            <View style={styles.realityMetricRow}>
              <Ionicons name="cash-outline" size={14} color={colors.income} />
              <Text style={[styles.realityMetricLabel, { color: colors.textSecondary }]}>
                {loc('متوسط الدخل الشهري', 'Monthly Avg Income', 'പ്രതിമാസ ശരാശരി വരുമാനം')}
              </Text>
            </View>
            <Text style={[styles.realityMetricValue, { color: colors.income }]}>
              {formatCurrency(financialInsights.monthlyAvgIncome)}{' '}
              <Text style={{ fontSize: 10, fontFamily: 'Cairo_600SemiBold' }}>{currencySymbol}/شهر</Text>
            </Text>
            <Text style={[styles.realityMetricNote, { color: colors.textTertiary }]}>
              {loc('التدفق المعتاد شهرياً', 'Monthly run rate', 'പ്രതിമാസ വരുമാന നിരക്ക്')}
            </Text>
          </View>

          {/* Peak Spending Month */}
          <View style={[styles.realityMetricBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]}>
            <View style={styles.realityMetricRow}>
              <Ionicons name="flame-outline" size={14} color="#F97316" />
              <Text style={[styles.realityMetricLabel, { color: colors.textSecondary }]}>
                {loc('الأعلى إنفاقاً في السنة', 'Peak Expense Month', 'കൂടിയ ചെലവുള്ള മാസം')}
              </Text>
            </View>
            <Text style={[styles.realityMetricValue, { color: colors.text }]} numberOfLines={1}>
              {financialInsights.peakExpenseMonth ? financialInsights.peakExpenseMonth.monthName : '—'}
            </Text>
            <Text style={[styles.realityMetricNote, { color: colors.expense }]}>
              {financialInsights.peakExpenseMonth
                ? `${formatCurrency(financialInsights.peakExpenseMonth.amount)} ${currencySymbol}`
                : loc('لا توجد بيانات كافية', 'No data yet', 'വിവരങ്ങൾ ലഭ്യമല്ല')}
            </Text>
          </View>

          {/* Best Savings Month */}
          <View style={[styles.realityMetricBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]}>
            <View style={styles.realityMetricRow}>
              <Ionicons name="trophy-outline" size={14} color="#10B981" />
              <Text style={[styles.realityMetricLabel, { color: colors.textSecondary }]}>
                {loc('أفضل شهر ادخاراً', 'Top Savings Month', 'കൂടുതൽ സമ്പാദിച്ച മാസം')}
              </Text>
            </View>
            <Text style={[styles.realityMetricValue, { color: colors.text }]} numberOfLines={1}>
              {financialInsights.bestSavingsMonth ? financialInsights.bestSavingsMonth.monthName : '—'}
            </Text>
            <Text style={[styles.realityMetricNote, { color: '#10B981' }]}>
              {financialInsights.bestSavingsMonth
                ? `+${formatCurrency(financialInsights.bestSavingsMonth.amount)} ${currencySymbol}`
                : loc('لا توجد بيانات كافية', 'No data yet', 'വിവരങ്ങൾ ലഭ്യമല്ല')}
            </Text>
          </View>
        </View>

        {/* Reality Bottom Progress & Buffer */}
        <View style={[styles.realityFooter, { borderTopColor: colors.borderLight }]}>
          <View style={styles.realityFooterRow}>
            <Text style={[styles.realityFooterLabel, { color: colors.textSecondary }]}>
              {loc('معدل الادخار السنوي العام:', 'Overall Annual Savings Rate:', 'ആകെ വാർഷിക സമ്പാദ്യ നിരക്ക്:')}
            </Text>
            <Text style={[styles.realityFooterPercent, { color: health.color }]}>
              {yearlyTotals.savingsRate}%
            </Text>
          </View>

          <View style={[styles.progressBarBg, { backgroundColor: colors.borderLight }]}>
            <LinearGradient
              colors={['#10B981', '#06B6D4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: `${Math.min(100, Math.max(0, yearlyTotals.savingsRate))}%`,
                height: '100%',
                borderRadius: 4,
              }}
            />
          </View>
        </View>
      </View>

      {/* 4. Yearly Donut Chart & Category Breakdown (Distribution across whole year) */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Ionicons name="pie-chart" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {viewType === 'expense'
              ? loc('توزيع المصاريف السنوية حسب الفئات', 'Yearly Expense Distribution by Category', 'വാർഷിക ചെലവ് വിഹിതം')
              : loc('توزيع الدخل السنوي حسب الفئات', 'Yearly Income Distribution by Category', 'വാർഷിക വരുമാന വിഹിതം')}
          </Text>
        </View>

        <DonutChart
          categoryStatsWithColors={categoryStatsWithColors}
          totalAmount={totalAmount}
          currencySymbol={currencySymbol}
          language={language}
          colors={colors}
          theme={theme}
          t={t}
          budgets={budgets}
        />
      </View>

      {/* 5. Smart Tags Annual Breakdown */}
      {tagStats && tagStats.length > 0 && (
        <View style={styles.sectionWrap}>
          <TagBreakdown
            tagStats={tagStats}
            currencySymbol={currencySymbol}
            language={language}
            colors={colors}
          />
        </View>
      )}

      {/* 6. 12-Month Yearly Visualizer Bar Chart + Interactive Month Inspector */}
      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.chartHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>
              {loc('📊 مقارنة 12 شهراً للسنة', '📊 12-Month Yearly Comparison', '📊 12 മാസത്തെ താരതമ്യം')}
            </Text>
            <Text style={[styles.chartSubtitle, { color: colors.textTertiary }]}>
              {loc('اضغط على أي شهر لمعاينة تفاصيله الذكية', 'Tap any month to inspect details', 'വിവരങ്ങൾ കാണാൻ മാസത്തിൽ ടാപ്പ് ചെയ്യുക')}
            </Text>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{isAr ? 'دخل' : 'Inc'}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{isAr ? 'منصرف' : 'Exp'}</Text>
            </View>
          </View>
        </View>

        {/* Bars Display */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 2 }}>
          <View style={styles.barsContainer}>
            {yearlyMonthsData.map((m) => {
              const incHeight =
                yearlyTotals.maxVal > 0 ? Math.max(4, Math.round((m.income / yearlyTotals.maxVal) * 105)) : 4;
              const expHeight =
                yearlyTotals.maxVal > 0 ? Math.max(4, Math.round((m.expense / yearlyTotals.maxVal) * 105)) : 4;
              const isSelected = m.monthIndex === selectedMonthIndex;
              const isCurrentCalendarMonth = m.monthIndex === currentMonth;

              return (
                <Pressable
                  key={m.monthIndex}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedMonthIndex(m.monthIndex);
                  }}
                  style={[
                    styles.barColumn,
                    isSelected && { backgroundColor: colors.primary + '15', borderRadius: 10, paddingVertical: 4 },
                  ]}
                >
                  <View style={styles.barPair}>
                    <View style={[styles.bar, { height: incHeight, backgroundColor: colors.income }]} />
                    <View style={[styles.bar, { height: expHeight, backgroundColor: colors.expense }]} />
                  </View>
                  <View
                    style={[
                      styles.monthBadge,
                      isSelected
                        ? { backgroundColor: colors.primary }
                        : isCurrentCalendarMonth
                        ? { backgroundColor: colors.primary + '25' }
                        : { backgroundColor: 'transparent' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthText,
                        {
                          fontFamily: isSelected || isCurrentCalendarMonth ? 'Cairo_700Bold' : 'Cairo_600SemiBold',
                          color: isSelected ? '#FFFFFF' : isCurrentCalendarMonth ? colors.primary : colors.textSecondary,
                        },
                      ]}
                    >
                      {monthAbbrs[m.monthIndex]}
                    </Text>
                  </View>
                  {m.txCount > 0 && !isSelected && (
                    <View style={[styles.activityDot, { backgroundColor: colors.primary }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.divider, { backgroundColor: colors.borderLight, marginVertical: 2 }]} />

        {/* --- Interactive Active Month Inspector --- */}
        <View style={[styles.inspectorCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]}>
          {/* Header: Prev / Next + Month Title & Transaction Count */}
          <View style={styles.inspectorHeader}>
            <Pressable
              onPress={handlePrevMonth}
              hitSlop={8}
              style={[styles.inspectorNavBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            >
              <Ionicons name={isAr ? "chevron-forward" : "chevron-back"} size={16} color={colors.text} />
            </Pressable>

            <View style={styles.inspectorTitleWrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar" size={15} color={colors.primary} />
                <Text style={[styles.inspectorMonthTitle, { color: colors.text }]}>
                  {selectedMonthData.monthName} {currentYear}
                </Text>
              </View>
              <View
                style={[
                  styles.inspectorTxBadge,
                  {
                    backgroundColor:
                      selectedMonthData.txCount > 0 ? colors.primary + '18' : colors.borderLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.inspectorTxBadgeText,
                    {
                      color:
                        selectedMonthData.txCount > 0 ? colors.primary : colors.textTertiary,
                    },
                  ]}
                >
                  {selectedMonthData.txCount > 0
                    ? loc(
                        `${selectedMonthData.txCount} معاملة مسجلة`,
                        `${selectedMonthData.txCount} transactions`,
                        `${selectedMonthData.txCount} ഇടപാടുകൾ`
                      )
                    : loc('لا توجد معاملات بعد', 'No transactions yet', 'ഇടപാടുകളില്ല')}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleNextMonth}
              hitSlop={8}
              style={[styles.inspectorNavBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            >
              <Ionicons name={isAr ? "chevron-back" : "chevron-forward"} size={16} color={colors.text} />
            </Pressable>
          </View>

          {/* 3 Metrics Row */}
          <View style={styles.inspectorMetricsRow}>
            {/* Income */}
            <View style={[styles.inspectorMetricBox, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Text style={[styles.inspectorMetricLabel, { color: colors.textSecondary }]}>
                {loc('الدخل', 'Income', 'വരുമാനം')}
              </Text>
              <Text style={[styles.inspectorMetricValue, { color: colors.income }]} numberOfLines={1} adjustsFontSizeToFit>
                +{formatCurrency(selectedMonthData.income)}
              </Text>
              <Text style={[styles.inspectorMetricCurrency, { color: colors.textTertiary }]}>{currencySymbol}</Text>
            </View>

            {/* Expense */}
            <View style={[styles.inspectorMetricBox, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Text style={[styles.inspectorMetricLabel, { color: colors.textSecondary }]}>
                {loc('المصروف', 'Expense', 'ചെലവ്')}
              </Text>
              <Text style={[styles.inspectorMetricValue, { color: colors.expense }]} numberOfLines={1} adjustsFontSizeToFit>
                -{formatCurrency(selectedMonthData.expense)}
              </Text>
              <Text style={[styles.inspectorMetricCurrency, { color: colors.textTertiary }]}>{currencySymbol}</Text>
            </View>

            {/* Net Savings */}
            <View style={[styles.inspectorMetricBox, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Text style={[styles.inspectorMetricLabel, { color: colors.textSecondary }]}>
                {loc('الادخار الصافي', 'Net Saved', 'അറ്റ സമ്പാദ്യം')}
              </Text>
              <Text
                style={[
                  styles.inspectorMetricValue,
                  { color: selectedMonthData.savings >= 0 ? '#10B981' : colors.expense },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {selectedMonthData.savings >= 0 ? '+' : ''}{formatCurrency(selectedMonthData.savings)}
              </Text>
              <Text style={[styles.inspectorMetricCurrency, { color: colors.textTertiary }]}>{currencySymbol}</Text>
            </View>
          </View>

          {/* Contextual Smart Insight Badge */}
          {financialInsights.peakExpenseMonth?.monthName === selectedMonthData.monthName && selectedMonthData.expense > 0 ? (
            <View style={[styles.inspectorInsightBadge, { backgroundColor: '#F9731618' }]}>
              <Ionicons name="flame" size={13} color="#F97316" />
              <Text style={[styles.inspectorInsightText, { color: '#F97316' }]}>
                {loc('الشهر الأعلى إنفاقاً في عام ' + currentYear + ' 🔥', 'Highest expense month of ' + currentYear + ' 🔥', 'കൂടിയ ചെലവുള്ള മാസം 🔥')}
              </Text>
            </View>
          ) : financialInsights.bestSavingsMonth?.monthName === selectedMonthData.monthName && selectedMonthData.savings > 0 ? (
            <View style={[styles.inspectorInsightBadge, { backgroundColor: '#10B98118' }]}>
              <Ionicons name="trophy" size={13} color="#10B981" />
              <Text style={[styles.inspectorInsightText, { color: '#10B981' }]}>
                {loc('أفضل شهر في تحقيق فائض وادخار 🏆', 'Top savings month of the year 🏆', 'കൂടുതൽ സമ്പാദിച്ച മാസം 🏆')}
              </Text>
            </View>
          ) : selectedMonthData.income > 0 && selectedMonthData.savings > 0 ? (
            <View style={[styles.inspectorInsightBadge, { backgroundColor: '#06B6D418' }]}>
              <Ionicons name="trending-up" size={13} color="#06B6D4" />
              <Text style={[styles.inspectorInsightText, { color: '#06B6D4' }]}>
                {loc(
                  `معدل الفائض المالي: ${Math.round((selectedMonthData.savings / selectedMonthData.income) * 100)}% من الدخل ✨`,
                  `Savings surplus: ${Math.round((selectedMonthData.savings / selectedMonthData.income) * 100)}% of income ✨`,
                  `${Math.round((selectedMonthData.savings / selectedMonthData.income) * 100)}% സമ്പാദ്യ നിരക്ക് ✨`
                )}
              </Text>
            </View>
          ) : null}

          {/* Action Button: Zoom In to Selected Month */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onSelectMonth(selectedMonthData.monthIndex);
            }}
            style={({ pressed }) => [
              styles.zoomInBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Ionicons name="search-outline" size={15} color="#FFFFFF" />
            <Text style={styles.zoomInBtnText}>
              {loc(
                `تفصيل ومعاملات شهر ${selectedMonthData.monthName} (Zoom In)`,
                `View ${selectedMonthData.monthName} Transactions (Zoom In)`,
                `${selectedMonthData.monthName} വിശദാംശങ്ങൾ കാണുക`
              )}
            </Text>
            <Ionicons
              name={isAr ? "arrow-back" : "arrow-forward"}
              size={14}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </View>

      {/* 7. Collapsible Full Monthly Ledger (On-Demand) */}
      <View style={styles.ledgerSection}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setShowAllMonths((prev) => !prev);
          }}
          style={({ pressed }) => [
            styles.toggleLedgerBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.9 },
          ]}
        >
          <View style={styles.toggleLedgerLeft}>
            <View style={[styles.toggleLedgerIconWrap, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="documents-outline" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.toggleLedgerTitle, { color: colors.text }]}>
                {loc('كشف حساب الشهور الكامل', 'Full Monthly Ledger', 'പ്രതിമാസ സ്റ്റേറ്റ്‌മെന്റുകൾ')}
              </Text>
              <Text style={[styles.toggleLedgerSubtitle, { color: colors.textSecondary }]}>
                {showAllMonths
                  ? loc('إخفاء قائمة الشهور', 'Hide monthly list', 'പട്ടിക മറയ്ക്കുക')
                  : loc(
                      `عرض جدول الـ 12 شهراً (${activeMonthsCount} أشهر نشطة)`,
                      `Expand 12 months (${activeMonthsCount} active)`,
                      `വിവരങ്ങൾ കാണുക (${activeMonthsCount} മാസങ്ങൾ)`
                    )}
              </Text>
            </View>
          </View>

          <View style={[styles.toggleChevronWrap, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons
              name={showAllMonths ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </View>
        </Pressable>

        {showAllMonths && (
          <View style={styles.expandedLedgerContent}>
            {/* Filter Pills */}
            <View style={styles.ledgerFilterRow}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilterActiveOnly(true);
                }}
                style={[
                  styles.filterChip,
                  filterActiveOnly
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: filterActiveOnly ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {loc(
                    `الأشهر النشطة فقط (${activeMonthsCount})`,
                    `Active Only (${activeMonthsCount})`,
                    `സജീവമായവ (${activeMonthsCount})`
                  )}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilterActiveOnly(false);
                }}
                style={[
                  styles.filterChip,
                  !filterActiveOnly
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: !filterActiveOnly ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {loc('كل الـ 12 شهراً', 'All 12 Months', 'എല്ലാ 12 മാസങ്ങളും')}
                </Text>
              </Pressable>
            </View>

            {/* List of Month Cards */}
            {displayMonths.map((m) => (
              <Pressable
                key={m.monthIndex}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelectMonth(m.monthIndex);
                }}
                style={({ pressed }) => [
                  styles.monthRowCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.monthRowHeader}>
                  <View style={styles.monthRowHeaderLeft}>
                    <View style={[styles.monthIconWrap, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.monthRowName, { color: colors.text }]}>
                        {m.monthName} {currentYear}
                      </Text>
                      <Text style={[styles.monthRowCount, { color: colors.textSecondary }]}>
                        {loc(`${m.txCount} معاملة مسجلة`, `${m.txCount} transactions`, `${m.txCount} ഇടപാടുകൾ`)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.zoomInBadge, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name="search-outline" size={12} color={colors.primary} />
                    <Text style={[styles.zoomInText, { color: colors.primary }]}>
                      {loc('تفصيل (Zoom In)', 'Zoom In', 'വിശദാംശം')}
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

                <View style={styles.monthRowFinancials}>
                  <View>
                    <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>
                      {loc('الدخل', 'Income', 'വരുമാനം')}
                    </Text>
                    <Text style={[styles.financialValue, { color: colors.income }]}>
                      +{formatCurrency(m.income)} {currencySymbol}
                    </Text>
                  </View>

                  <View>
                    <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>
                      {loc('المصروف', 'Expense', 'ചെലവ്')}
                    </Text>
                    <Text style={[styles.financialValue, { color: colors.expense }]}>
                      -{formatCurrency(m.expense)} {currencySymbol}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>
                      {loc('الادخار الصافي', 'Net Saved', 'അറ്റ സമ്പാദ്യം')}
                    </Text>
                    <Text
                      style={[
                        styles.financialValue,
                        { color: m.savings >= 0 ? colors.primary : colors.expense },
                      ]}
                    >
                      {formatCurrency(m.savings)} {currencySymbol}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 10,
    gap: 16,
  },
  yoyBanner: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
  },
  yoyCompactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  yoyCompactIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yoyCompactText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  yoyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yoyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  yoyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  yoyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  yoyBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  yoyDescription: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
  },
  yoyIncomeRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yoyIncomeLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  yoyIncomeValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    elevation: 3,
    overflow: 'hidden',
  },
  overviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  overviewIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  overviewLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  overviewValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  overviewCurrency: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  realityCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    gap: 12,
  },
  realityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  realityHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  realityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  realityTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  realitySubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
  },
  healthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  healthBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
  },
  realityMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  realityMetricBox: {
    flex: 1,
    minWidth: '45%',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
  },
  realityMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  realityMetricLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
  realityMetricValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  realityMetricNote: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 9,
  },
  realityFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  realityFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  realityFooterLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  realityFooterPercent: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sectionWrap: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  chartCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    gap: 12,
    paddingTop: 20,
    paddingBottom: 6,
  },
  barColumn: {
    width: 44,
    alignItems: 'center',
    gap: 6,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 110,
  },
  bar: {
    width: 9,
    borderRadius: 4,
  },
  monthBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  monthText: {
    fontSize: 10,
  },
  breakdownList: {
    gap: 10,
  },
  breakdownHeading: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  monthRowCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  monthRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthRowHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRowName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  monthRowCount: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
  },
  zoomInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  zoomInText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  divider: {
    height: 1,
  },
  monthRowFinancials: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financialLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
  },
  financialValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  chartSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    marginTop: 2,
  },
  activityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  inspectorCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
  },
  inspectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inspectorNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectorTitleWrap: {
    alignItems: 'center',
    gap: 4,
  },
  inspectorMonthTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  inspectorTxBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inspectorTxBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
  inspectorMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inspectorMetricBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  inspectorMetricLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
  inspectorMetricValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  inspectorMetricCurrency: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 9,
  },
  inspectorInsightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  inspectorInsightText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  zoomInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
  },
  zoomInBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  ledgerSection: {
    gap: 10,
  },
  toggleLedgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  toggleLedgerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleLedgerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLedgerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  toggleLedgerSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
  },
  toggleChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedLedgerContent: {
    gap: 10,
    marginTop: 4,
  },
  ledgerFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
});
