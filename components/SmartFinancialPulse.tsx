import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Transaction, Wallet } from '@/lib/storage';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';

interface SmartFinancialPulseProps {
  transactions: Transaction[];
  currencySymbol: string;
  onOpenMonthlyReport?: () => void;
  wallet?: Wallet | null;
}

export default function SmartFinancialPulse({
  transactions,
  currencySymbol,
  onOpenMonthlyReport,
  wallet,
}: SmartFinancialPulseProps) {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');

  // Calculations
  const stats = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDay = now.getDate();
    const daysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();

    const msInDay = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = new Date(now.getTime() - 7 * msInDay);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * msInDay);

    // Filter relevant wallet transactions
    const relevantTx = wallet
      ? transactions.filter(t => t.walletId === wallet.id || (t.type === 'transfer' && t.toWalletId === wallet.id))
      : transactions;

    // Weekly calculations
    let thisWeekSpent = 0;
    let lastWeekSpent = 0;
    const weeklyCatMap: Record<string, number> = {};
    let biggestTx: Transaction | null = null;

    // Monthly calculations
    const prevMonthDate = new Date(curYear, curMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    let curMonthTotal = 0;
    let prevMonthToDateTotal = 0;

    relevantTx.forEach(tx => {
      // Treat consumption expenses and outgoing transfers as spending/outflows
      const isExpense = (tx.type === 'expense' && tx.category !== 'jameya_savings' && tx.category !== 'debt_loan') ||
        (tx.type === 'transfer' && wallet && tx.walletId === wallet.id);

      if (!isExpense) return;

      const d = new Date(tx.date);
      const txYear = d.getFullYear();
      const txMonth = d.getMonth();
      const txDay = d.getDate();

      // Weekly
      if (d >= sevenDaysAgo && d <= now) {
        thisWeekSpent += tx.amount;
        const catKey = tx.type === 'transfer' ? 'transfer_out' : tx.category;
        weeklyCatMap[catKey] = (weeklyCatMap[catKey] || 0) + tx.amount;

        if (!biggestTx || tx.amount > biggestTx.amount) {
          biggestTx = tx;
        }
      } else if (d >= fourteenDaysAgo && d < sevenDaysAgo) {
        lastWeekSpent += tx.amount;
      }

      // Monthly
      if (txYear === curYear && txMonth === curMonth) {
        curMonthTotal += tx.amount;
      } else if (txYear === prevYear && txMonth === prevMonth) {
        if (txDay <= curDay) {
          prevMonthToDateTotal += tx.amount;
        }
      }
    });

    // Top category weekly
    let topCatId: string | null = null;
    let topCatAmount = 0;
    Object.entries(weeklyCatMap).forEach(([catId, amount]) => {
      if (amount > topCatAmount) {
        topCatAmount = amount;
        topCatId = catId;
      }
    });

    // Daily pace & projection
    const dailyAverage = curDay > 0 ? curMonthTotal / curDay : 0;
    const projectedTotal = dailyAverage * daysInCurMonth;

    // MoM difference
    let diffPercent = 0;
    if (prevMonthToDateTotal > 0) {
      diffPercent = Math.round(((curMonthTotal - prevMonthToDateTotal) / prevMonthToDateTotal) * 100);
    }
    const isSpendingMore = diffPercent > 0;

    return {
      thisWeekSpent,
      lastWeekSpent,
      topCatId,
      topCatAmount,
      biggestTx: biggestTx as Transaction | null,
      curMonthTotal,
      prevMonthToDateTotal,
      dailyAverage,
      projectedTotal,
      diffPercent,
      isSpendingMore,
    };
  }, [transactions, wallet]);

  const topCategoryObj = stats.topCatId ? getCategoryById(stats.topCatId) : null;
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);

  if (transactions.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      {/* Header Row: Title & Segmented Switch */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.sparkleIconWrap}>
            <Ionicons name="flash" size={15} color="#10B981" />
          </View>
          <Text style={styles.title}>
            {isAr ? 'النبض المالي الذكي' : 'Financial Pulse'}
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('weekly');
            }}
            style={[styles.tabBtn, activeTab === 'weekly' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'weekly' && styles.tabBtnTextActive]}>
              {isAr ? 'أسبوعي 📅' : '7 Days 📅'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('monthly');
            }}
            style={[styles.tabBtn, activeTab === 'monthly' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, activeTab === 'monthly' && styles.tabBtnTextActive]}>
              {isAr ? 'شهري 📊' : 'Monthly 📊'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Content Area */}
      {activeTab === 'weekly' ? (
        /* WEEKLY VIEW */
        <View style={styles.contentBody}>
          <View style={styles.highlightRow}>
            <View>
              <Text style={styles.subLabel}>
                {isAr ? 'منصرف الـ 7 أيام الماضية' : 'Past 7 Days Spending'}
              </Text>
              <Text style={styles.mainValue}>
                {formatCurrency(stats.thisWeekSpent, language)} <Text style={styles.currencySymbol}>{currencySymbol}</Text>
              </Text>
            </View>

            {stats.topCatId && (
              <View style={styles.miniCategoryBadge}>
                <MaterialIcons
                  name={stats.topCatId === 'transfer_out' ? 'swap-horiz' : (topCategoryObj?.icon as any || 'local-grocery-store')}
                  size={14}
                  color={stats.topCatId === 'transfer_out' ? '#8B5CF6' : (topCategoryObj?.color || colors.primary)}
                />
                <Text style={styles.miniCategoryText} numberOfLines={1}>
                  {stats.topCatId === 'transfer_out'
                    ? (isAr ? 'تحويل' : 'Transfer')
                    : getCategoryName(stats.topCatId, language)}
                </Text>
              </View>
            )}
          </View>

          {/* Chips Row */}
          <View style={styles.chipsRow}>
            {stats.topCatId && (
              <View style={styles.chip}>
                <Ionicons name="pie-chart-outline" size={13} color={colors.primary} />
                <Text style={styles.chipText}>
                  {isAr ? 'الأعلى:' : 'Top:'}{' '}
                  <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>
                    {stats.topCatId === 'transfer_out' ? (isAr ? 'تحويل لمحفظة' : 'Transfer') : getCategoryName(stats.topCatId, language)}
                  </Text>{' '}
                  ({formatCurrency(stats.topCatAmount, language)} {currencySymbol})
                </Text>
              </View>
            )}

            {stats.biggestTx && (
              <View style={styles.chip}>
                <Ionicons name="arrow-up-circle-outline" size={13} color={colors.expense} />
                <Text style={styles.chipText}>
                  {isAr ? 'أكبر عملية:' : 'Largest:'}{' '}
                  <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>
                    {formatCurrency(stats.biggestTx.amount, language)} {currencySymbol}
                  </Text>
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* MONTHLY VIEW */
        <View style={styles.contentBody}>
          <View style={styles.highlightRow}>
            <View>
              <Text style={styles.subLabel}>
                {isAr ? 'معدل الصرف اليومي' : 'Daily Burn Rate'}
              </Text>
              <Text style={[styles.mainValue, { color: colors.primary }]}>
                {formatCurrency(stats.dailyAverage, language)} <Text style={styles.currencySymbol}>{currencySymbol}/يوم</Text>
              </Text>
            </View>

            {stats.prevMonthToDateTotal > 0 && (
              <View
                style={[
                  styles.diffBadge,
                  { backgroundColor: stats.isSpendingMore ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)' },
                ]}
              >
                <Ionicons
                  name={stats.isSpendingMore ? 'trending-up' : 'trending-down'}
                  size={14}
                  color={stats.isSpendingMore ? '#EF4444' : '#10B981'}
                />
                <Text
                  style={[
                    styles.diffBadgeText,
                    { color: stats.isSpendingMore ? '#EF4444' : '#10B981' },
                  ]}
                >
                  {Math.abs(stats.diffPercent)}% {isAr ? (stats.isSpendingMore ? 'زيادة' : 'توفير') : (stats.isSpendingMore ? 'more' : 'less')}
                </Text>
              </View>
            )}
          </View>

          {/* Monthly Comparison Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{isAr ? 'التوقع بنهاية الشهر' : 'Projected Month End'}</Text>
              <Text style={styles.metricValue}>
                ~{formatCurrency(stats.projectedTotal, language)} {currencySymbol}
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{isAr ? 'نفس الفترة الشهر الماضي' : 'Same Period Last Month'}</Text>
              <Text style={[styles.metricValue, { color: colors.textSecondary }]}>
                {formatCurrency(stats.prevMonthToDateTotal, language)} {currencySymbol}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Full Monthly Report Action Button */}
      {onOpenMonthlyReport && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onOpenMonthlyReport();
          }}
          style={({ pressed }) => [
            styles.digestBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="sparkles" size={15} color="#FFFFFF" />
            <Text style={styles.digestBtnText}>
              {isAr ? 'عرض التقرير المالي الشهري الشامل' : 'View Full Monthly Financial Digest'}
            </Text>
          </View>
          <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={15} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}

const getStyles = (colors: any, theme: string) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: theme === 'dark' ? 0.25 : 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sparkleIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: '#10B98118',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13.5,
      color: colors.text,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: theme === 'dark' ? '#1E293B' : '#F1F5F9',
      borderRadius: 12,
      padding: 3,
      gap: 2,
    },
    tabBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 9,
    },
    tabBtnActive: {
      backgroundColor: theme === 'dark' ? '#334155' : '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    tabBtnText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    tabBtnTextActive: {
      color: colors.text,
      fontFamily: 'Cairo_700Bold',
    },
    contentBody: {
      gap: 10,
    },
    highlightRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    subLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    mainValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 19,
      color: colors.expense,
      marginTop: 1,
    },
    currencySymbol: {
      fontSize: 12,
      fontFamily: 'Cairo_600SemiBold',
    },
    miniCategoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceAlt || '#F8FAFC',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    miniCategoryText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
      color: colors.text,
      maxWidth: 100,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceAlt || '#F8FAFC',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
      flex: 1,
    },
    chipText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10.5,
      color: colors.textSecondary,
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
    metricsGrid: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt || '#F8FAFC',
      borderRadius: 14,
      padding: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    metricItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    metricDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.border,
    },
    metricLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 9.5,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    metricValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
    },
    digestBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#10B981',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginTop: 2,
    },
    digestBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: '#FFFFFF',
    },
  });
