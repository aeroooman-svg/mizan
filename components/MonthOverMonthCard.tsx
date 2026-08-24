import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Transaction } from '@/lib/storage';
import { formatCurrency } from '@/lib/categories';

interface MonthOverMonthCardProps {
  transactions: Transaction[];
  currencySymbol: string;
}

export default function MonthOverMonthCard({
  transactions,
  currencySymbol,
}: MonthOverMonthCardProps) {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const metrics = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDay = now.getDate();

    // Previous month info
    const prevMonthDate = new Date(curYear, curMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    let curMonthTotal = 0;
    let prevMonthTotal = 0;
    let prevMonthToDateTotal = 0;

    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      const d = new Date(tx.date);
      const txYear = d.getFullYear();
      const txMonth = d.getMonth();
      const txDay = d.getDate();

      if (txYear === curYear && txMonth === curMonth) {
        curMonthTotal += tx.amount;
      } else if (txYear === prevYear && txMonth === prevMonth) {
        prevMonthTotal += tx.amount;
        if (txDay <= curDay) {
          prevMonthToDateTotal += tx.amount;
        }
      }
    });

    const daysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();
    const dailyAverage = curDay > 0 ? curMonthTotal / curDay : 0;
    const projectedTotal = dailyAverage * daysInCurMonth;

    // Percent diff vs same day last month
    let diffPercent = 0;
    if (prevMonthToDateTotal > 0) {
      diffPercent = Math.round(((curMonthTotal - prevMonthToDateTotal) / prevMonthToDateTotal) * 100);
    }

    const isSpendingMore = diffPercent > 0;

    return {
      curMonthTotal,
      prevMonthTotal,
      prevMonthToDateTotal,
      dailyAverage,
      projectedTotal,
      diffPercent,
      isSpendingMore,
    };
  }, [transactions]);

  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="swap-vertical" size={20} color={colors.primary} />
          <Text style={styles.title}>
            {isAr ? 'مقارنة شهر بشهر (MoM)' : 'Month-over-Month'}
          </Text>
        </View>
        <View
          style={[
            styles.diffBadge,
            { backgroundColor: metrics.isSpendingMore ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' },
          ]}
        >
          <Ionicons
            name={metrics.isSpendingMore ? 'trending-up' : 'trending-down'}
            size={14}
            color={metrics.isSpendingMore ? '#EF4444' : '#10B981'}
          />
          <Text
            style={[
              styles.diffBadgeText,
              { color: metrics.isSpendingMore ? '#EF4444' : '#10B981' },
            ]}
          >
            {Math.abs(metrics.diffPercent)}% {isAr ? (metrics.isSpendingMore ? 'زيادة' : 'توفير') : (metrics.isSpendingMore ? 'more' : 'less')}
          </Text>
        </View>
      </View>

      {/* Comparison numbers */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>{isAr ? 'الشهر الحالي حتى اليوم' : 'Current Month to Date'}</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatCurrency(metrics.curMonthTotal, language)} {currencySymbol}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>{isAr ? 'نفس الفترة الشهر الماضي' : 'Same Period Last Month'}</Text>
          <Text style={[styles.statValue, { color: colors.textSecondary }]}>
            {formatCurrency(metrics.prevMonthToDateTotal, language)} {currencySymbol}
          </Text>
        </View>
      </View>

      {/* Burn Rate & Projection Row */}
      <View style={styles.insightsBox}>
        <View style={styles.insightItem}>
          <Ionicons name="speedometer-outline" size={16} color={colors.accent} />
          <Text style={styles.insightText}>
            {isAr ? 'معدل الصرف اليومي:' : 'Daily Pace:'}{' '}
            <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>
              {formatCurrency(metrics.dailyAverage, language)} {currencySymbol}/يوم
            </Text>
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Ionicons name="calculator-outline" size={16} color={colors.primary} />
          <Text style={styles.insightText}>
            {isAr ? 'التوقع بنهاية الشهر:' : 'Projected End:'}{' '}
            <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>
              {formatCurrency(metrics.projectedTotal, language)} {currencySymbol}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card || colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    diffBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    diffBadgeText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
    },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 12,
      alignItems: 'center',
    },
    statCol: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },
    statLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    statValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
    },
    insightsBox: {
      gap: 6,
      paddingTop: 4,
    },
    insightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    insightText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
