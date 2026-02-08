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
import Svg, { Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_SIZE = 180;
const STROKE_WIDTH = 24;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface CategoryStat {
  category: Category;
  total: number;
  percentage: number;
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const { transactions, totalIncome, totalExpense } = useTransactions();
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [transactions, currentMonth, currentYear]);

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

  const totalAmount = viewType === 'expense' ? totalExpense : totalIncome;

  let accumulatedOffset = 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
          <Text style={styles.headerTitle}>إحصائيات</Text>
          <Text style={styles.headerSubtitle}>{months[currentMonth]} {currentYear}</Text>
        </View>

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
                  {categoryStats.map((stat, index) => {
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
                  <Text style={styles.chartLabel}>ج.م</Text>
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
                      <Text style={styles.categoryAmount}>{formatCurrency(stat.total)} ج.م</Text>
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

        <View style={styles.summaryCards}>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.income }]}>
            <Text style={styles.summaryCardLabel}>إجمالي الدخل</Text>
            <Text style={[styles.summaryCardValue, { color: Colors.income }]}>
              {formatCurrency(totalIncome)} ج.م
            </Text>
            <Text style={styles.summaryCardCount}>
              {monthlyTransactions.filter(t => t.type === 'income').length} معاملة
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.expense }]}>
            <Text style={styles.summaryCardLabel}>إجمالي المصاريف</Text>
            <Text style={[styles.summaryCardValue, { color: Colors.expense }]}>
              {formatCurrency(totalExpense)} ج.م
            </Text>
            <Text style={styles.summaryCardCount}>
              {monthlyTransactions.filter(t => t.type === 'expense').length} معاملة
            </Text>
          </View>
        </View>
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
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
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
    marginTop: 24,
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
  summaryCards: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    gap: 4,
  },
  summaryCardLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  summaryCardValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  summaryCardCount: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
  },
});
