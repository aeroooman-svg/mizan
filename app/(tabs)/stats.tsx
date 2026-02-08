import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById, expenseCategories, incomeCategories, Category } from '@/lib/categories';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';

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
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const { walletTransactions, totalIncome, totalExpense, currencySymbol, selectedWallet } = useTransactions();
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const monthlyTransactions = useMemo(() => {
    return walletTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [walletTransactions, currentMonth, currentYear]);

  const categoryStats = useMemo((): CategoryStat[] => {
    const filtered = monthlyTransactions.filter(t => t.type === viewType);
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);
    const catMap = new Map<string, number>();

    filtered.forEach(t => {
      catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount);
    });

    const categories = viewType === 'expense' ? expenseCategories : incomeCategories;
    const stats: CategoryStat[] = [];

    catMap.forEach((catTotal, catId) => {
      const category = categories.find(c => c.id === catId);
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
  }, [monthlyTransactions, viewType]);

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

  const totalAmount = viewType === 'expense' ? totalExpense : totalIncome;
  const totalAll = totalIncome + totalExpense;

  let accumulatedOffset = 0;

  const barWidth = dailyData.length > 0 ? Math.max((BAR_CHART_WIDTH - dailyData.length * 4) / (dailyData.length * 2), 6) : 10;

  return (
    <View style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>إحصائيات</Text>
              <Text style={styles.headerSubtitle}>{months[currentMonth]} {currentYear}</Text>
            </View>
            {selectedWallet && (
              <View style={[styles.walletBadge, { backgroundColor: selectedWallet.color + '15' }]}>
                <MaterialIcons name={selectedWallet.icon as any} size={14} color={selectedWallet.color} />
                <Text style={[styles.walletBadgeText, { color: selectedWallet.color }]}>{selectedWallet.name}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.overviewCards}>
          <View style={styles.overviewCard}>
            <View style={styles.overviewRow}>
              <View style={[styles.overviewDot, { backgroundColor: Colors.income }]} />
              <Text style={styles.overviewLabel}>الدخل</Text>
            </View>
            <Text style={[styles.overviewValue, { color: Colors.income }]}>
              {formatCurrency(totalIncome)}
            </Text>
            <Text style={styles.overviewCurrency}>{currencySymbol}</Text>
          </View>
          <View style={styles.overviewCard}>
            <View style={styles.overviewRow}>
              <View style={[styles.overviewDot, { backgroundColor: Colors.expense }]} />
              <Text style={styles.overviewLabel}>المصاريف</Text>
            </View>
            <Text style={[styles.overviewValue, { color: Colors.expense }]}>
              {formatCurrency(totalExpense)}
            </Text>
            <Text style={styles.overviewCurrency}>{currencySymbol}</Text>
          </View>
        </View>

        {totalAll > 0 && (
          <View style={styles.ratioBar}>
            <View style={[styles.ratioIncome, { flex: totalIncome || 0.01 }]} />
            <View style={[styles.ratioExpense, { flex: totalExpense || 0.01 }]} />
          </View>
        )}

        {dailyData.length > 0 && monthlyTransactions.length > 0 && (
          <View style={styles.barChartSection}>
            <Text style={styles.sectionTitle}>الإنفاق اليومي</Text>
            <View style={styles.barChartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.income }]} />
                <Text style={styles.legendText}>دخل</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.expense }]} />
                <Text style={styles.legendText}>مصاريف</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Svg width={Math.max(BAR_CHART_WIDTH, dailyData.length * (barWidth * 2 + 8) + 20)} height={BAR_CHART_HEIGHT + 30}>
                {dailyData.map((d, i) => {
                  const x = i * (barWidth * 2 + 8) + 10;
                  const incomeH = (d.income / maxDailyValue) * BAR_CHART_HEIGHT;
                  const expenseH = (d.expense / maxDailyValue) * BAR_CHART_HEIGHT;
                  return (
                    <React.Fragment key={d.day}>
                      <Rect
                        x={x}
                        y={BAR_CHART_HEIGHT - incomeH}
                        width={barWidth}
                        height={Math.max(incomeH, 2)}
                        rx={3}
                        fill={Colors.income}
                        opacity={0.8}
                      />
                      <Rect
                        x={x + barWidth + 2}
                        y={BAR_CHART_HEIGHT - expenseH}
                        width={barWidth}
                        height={Math.max(expenseH, 2)}
                        rx={3}
                        fill={Colors.expense}
                        opacity={0.8}
                      />
                      <SvgText
                        x={x + barWidth}
                        y={BAR_CHART_HEIGHT + 18}
                        fontSize={10}
                        fill={Colors.textTertiary}
                        textAnchor="middle"
                      >
                        {d.day}
                      </SvgText>
                    </React.Fragment>
                  );
                })}
              </Svg>
            </ScrollView>
          </View>
        )}

        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setViewType('expense');
            }}
            style={[styles.toggleBtn, viewType === 'expense' && styles.toggleBtnActiveExpense]}
          >
            <Text style={[styles.toggleText, viewType === 'expense' && styles.toggleTextActive]}>
              المصاريف
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setViewType('income');
            }}
            style={[styles.toggleBtn, viewType === 'income' && styles.toggleBtnActiveIncome]}
          >
            <Text style={[styles.toggleText, viewType === 'income' && styles.toggleTextActive]}>
              الدخل
            </Text>
          </Pressable>
        </View>

        {categoryStats.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>لا توجد بيانات</Text>
            <Text style={styles.emptySubtitle}>أضف معاملات لتظهر الإحصائيات</Text>
          </View>
        ) : (
          <>
            <View style={styles.chartSection}>
              <View style={styles.chartContainer}>
                <Svg width={CHART_SIZE} height={CHART_SIZE}>
                  <Circle
                    cx={CHART_SIZE / 2}
                    cy={CHART_SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={Colors.borderLight}
                    strokeWidth={STROKE_WIDTH}
                  />
                  {categoryStats.map((stat) => {
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
                        strokeLinecap="butt"
                        transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}
                      />
                    );
                  })}
                </Svg>
                <View style={styles.chartCenter}>
                  <Text style={styles.chartTotal}>{formatCurrency(totalAmount)}</Text>
                  <Text style={styles.chartLabel}>{currencySymbol}</Text>
                </View>
              </View>
            </View>

            <View style={styles.categoriesSection}>
              <Text style={styles.sectionTitle}>التفاصيل</Text>
              {categoryStats.map((stat) => (
                <View key={stat.category.id} style={styles.categoryRow}>
                  <View style={[styles.catIcon, { backgroundColor: stat.category.color + '18' }]}>
                    <MaterialIcons name={stat.category.icon as any} size={20} color={stat.category.color} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryName}>{stat.category.nameAr}</Text>
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
                    <Text style={styles.categoryPercent}>{Math.round(stat.percentage)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: Colors.text,
  },
  headerSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
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
  overviewCards: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  overviewLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  overviewValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
  },
  overviewCurrency: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: Colors.textTertiary,
  },
  ratioBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceAlt,
  },
  ratioIncome: {
    backgroundColor: Colors.income,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  ratioExpense: {
    backgroundColor: Colors.expense,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  barChartSection: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  barChartLegend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
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
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleBtnActiveExpense: {
    backgroundColor: Colors.expense,
  },
  toggleBtnActiveIncome: {
    backgroundColor: Colors.income,
  },
  toggleText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  chartSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
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
    fontSize: 18,
    color: Colors.text,
  },
  chartLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  categoriesSection: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: Colors.text,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
    gap: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  categoryAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: Colors.text,
  },
  categoryBarBg: {
    height: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: 6,
    borderRadius: 3,
  },
  categoryPercent: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
});
