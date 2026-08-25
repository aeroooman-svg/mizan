import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Transaction } from '@/lib/storage';
import { formatCurrency } from '@/lib/categories';

interface MonthOverMonthCardProps {
  transactions: Transaction[];
  currencySymbol: string;
  onOpenMonthlyReport?: () => void;
}

export default function MonthOverMonthCard({
  transactions,
  currencySymbol,
  onOpenMonthlyReport,
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
          <View style={styles.iconCircle}>
            <Ionicons name="swap-vertical" size={18} color={colors.primary} />
          </View>
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
          <Ionicons name="speedometer-outline" size={16} color={colors.accent || '#F59E0B'} />
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

      {/* Full Monthly Report CTA Button */}
      {onOpenMonthlyReport && (
        <Pressable
          style={({ pressed }) => [
            styles.reportBtn,
            pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOpenMonthlyReport();
          }}
        >
          <Ionicons name="sparkles" size={16} color="#FFF" />
          <Text style={styles.reportBtnText}>
            {isAr ? 'عرض التقرير الشهري الشامل' : 'View Full Monthly Report'}
          </Text>
          <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color="#FFF" />
        </Pressable>
      )}
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
      gap: 8,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
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
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.03)',
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
    reportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginTop: 4,
    },
    reportBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#FFFFFF',
    },
  });
