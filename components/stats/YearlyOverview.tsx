import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatCurrency } from '@/lib/categories';

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

interface YearlyOverviewProps {
  yearlyTotals: YearlyTotals;
  yearlyMonthsData: YearlyMonthItem[];
  currentYear: number;
  currentMonth: number;
  currencySymbol: string;
  language: string;
  colors: any;
  onSelectMonth: (monthIndex: number) => void;
}

export const YearlyOverview: React.FC<YearlyOverviewProps> = ({
  yearlyTotals,
  yearlyMonthsData,
  currentYear,
  currentMonth,
  currencySymbol,
  language,
  colors,
  onSelectMonth,
}) => {
  const isAr = language === 'ar';
  const monthAbbrs = isAr
    ? ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <View style={styles.container}>
      {/* Yearly Totals Overview Cards */}
      <View style={styles.totalsGrid}>
        <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.totalCardRow}>
            <Ionicons name="arrow-down-circle" size={15} color={colors.income} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.totalLabel, { color: colors.textSecondary }]}>
              {isAr ? 'إجمالي دخل السنة' : 'Yearly Income'}
            </Text>
          </View>
          <Text style={[styles.totalAmount, { color: colors.income }]} numberOfLines={1} adjustsFontSizeToFit>
            +{formatCurrency(yearlyTotals.totalIncome)} {currencySymbol}
          </Text>
        </View>

        <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.totalCardRow}>
            <Ionicons name="arrow-up-circle" size={15} color={colors.expense} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.totalLabel, { color: colors.textSecondary }]}>
              {isAr ? 'إجمالي مصاريف السنة' : 'Yearly Expense'}
            </Text>
          </View>
          <Text style={[styles.totalAmount, { color: colors.expense }]} numberOfLines={1} adjustsFontSizeToFit>
            -{formatCurrency(yearlyTotals.totalExpense)} {currencySymbol}
          </Text>
        </View>

        <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.totalCardRow}>
            <Ionicons name="wallet-outline" size={15} color={colors.primary} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.totalLabel, { color: colors.textSecondary }]}>
              {isAr ? 'صافي الادخار السنوي' : 'Net Yearly Savings'}
            </Text>
          </View>
          <Text
            style={[styles.totalAmount, { color: yearlyTotals.totalSavings >= 0 ? colors.primary : colors.expense }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCurrency(yearlyTotals.totalSavings)} {currencySymbol}
          </Text>
        </View>

        <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.totalCardRow}>
            <Ionicons name="pie-chart-outline" size={15} color={colors.accent} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.totalLabel, { color: colors.textSecondary }]}>
              {isAr ? 'معدل الادخار السنوي' : 'Savings Rate'}
            </Text>
          </View>
          <Text
            style={[styles.totalAmount, { color: yearlyTotals.totalSavings >= 0 ? colors.accent : colors.expense }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {yearlyTotals.totalIncome > 0 ? `${yearlyTotals.savingsRate}%` : '0%'}
          </Text>
        </View>
      </View>

      {/* 12-Month Yearly Visualizer Bar Chart */}
      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            {isAr ? '📊 مقارنة 12 شهراً للسنة' : '📊 12-Month Yearly Comparison'}
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
              const incHeight = yearlyTotals.maxVal > 0 ? Math.max(4, Math.round((m.income / yearlyTotals.maxVal) * 110)) : 4;
              const expHeight = yearlyTotals.maxVal > 0 ? Math.max(4, Math.round((m.expense / yearlyTotals.maxVal) * 110)) : 4;
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

      {/* 12-Month Detailed Breakdown List */}
      <View style={styles.breakdownList}>
        <Text style={[styles.breakdownHeading, { color: colors.text }]}>
          {isAr ? '📑 كشف حساب كل شهر بالسنة' : '📑 Monthly Breakdown List'}
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
                    {isAr ? `${m.txCount} معاملة مسجلة` : `${m.txCount} transactions`}
                  </Text>
                </View>
              </View>

              <View style={[styles.zoomInBadge, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="search-outline" size={12} color={colors.primary} />
                <Text style={[styles.zoomInText, { color: colors.primary }]}>
                  {isAr ? 'تفصيل (Zoom In)' : 'Zoom In'}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            <View style={styles.monthRowFinancials}>
              <View>
                <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'الدخل' : 'Income'}
                </Text>
                <Text style={[styles.financialValue, { color: colors.income }]}>
                  +{formatCurrency(m.income)} {currencySymbol}
                </Text>
              </View>

              <View>
                <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'المصروف' : 'Expense'}
                </Text>
                <Text style={[styles.financialValue, { color: colors.expense }]}>
                  -{formatCurrency(m.expense)} {currencySymbol}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'الادخار الصافي' : 'Net Saved'}
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
    marginTop: 12,
    gap: 16,
  },
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  totalCard: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  totalCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  totalLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  totalAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
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
