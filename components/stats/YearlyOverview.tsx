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

  return (
    <View style={styles.container}>
      {/* 1. Year-over-Year (YoY) Comprehensive Comparison Banner */}
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

          {financialInsights.prevYearExpense > 0 && (
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
          )}
        </View>

        {financialInsights.prevYearExpense > 0 ? (
          <>
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
          </>
        ) : (
          <Text style={[styles.yoyDescription, { color: colors.textSecondary }]}>
            {loc(
              `عام ${currentYear} هو سنة البداية والأساس — ستتوفر المقارنات السنوية التلقائية فور تسجيل بيانات الأعوام الأخرى.`,
              `Year ${currentYear} is your baseline year. Multi-year comparisons will be automatically enabled as past/future records grow.`,
              `${currentYear} അടിസ്ഥാന വർഷമാണ്. മുൻ വർഷങ്ങളിലെ വിവരങ്ങൾ ലഭിക്കുമ്പോൾ താരതമ്യം കാണാം.`
            )}
          </Text>
        )}
      </View>

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

      {/* 6. 12-Month Yearly Visualizer Bar Chart */}
      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            {loc('📊 مقارنة 12 شهراً للسنة', '📊 12-Month Yearly Comparison', '📊 12 മാസത്തെ താരതമ്യം')}
          </Text>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.barsContainer}>
            {yearlyMonthsData.map((m) => {
              const incHeight =
                yearlyTotals.maxVal > 0 ? Math.max(4, Math.round((m.income / yearlyTotals.maxVal) * 110)) : 4;
              const expHeight =
                yearlyTotals.maxVal > 0 ? Math.max(4, Math.round((m.expense / yearlyTotals.maxVal) * 110)) : 4;
              const isSelectedMonth = m.monthIndex === currentMonth;

              return (
                <Pressable
                  key={m.monthIndex}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onSelectMonth(m.monthIndex);
                  }}
                  style={styles.barColumn}
                >
                  <View style={styles.barPair}>
                    <View style={[styles.bar, { height: incHeight, backgroundColor: colors.income }]} />
                    <View style={[styles.bar, { height: expHeight, backgroundColor: colors.expense }]} />
                  </View>
                  <View
                    style={[
                      styles.monthBadge,
                      { backgroundColor: isSelectedMonth ? colors.primary + '20' : 'transparent' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthText,
                        {
                          fontFamily: isSelectedMonth ? 'Cairo_700Bold' : 'Cairo_600SemiBold',
                          color: isSelectedMonth ? colors.primary : colors.textSecondary,
                        },
                      ]}
                    >
                      {monthAbbrs[m.monthIndex]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* 7. 12-Month Detailed Breakdown List (كشف حساب الشهور) */}
      <View style={styles.breakdownList}>
        <Text style={[styles.breakdownHeading, { color: colors.text }]}>
          {loc('📑 كشف حساب كل شهر بالسنة', '📑 Monthly Statements for the Year', '📑 പ്രതിമാസ സ്റ്റേറ്റ്‌മെന്റുകൾ')}
        </Text>

        {yearlyMonthsData.map((m) => (
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
});
