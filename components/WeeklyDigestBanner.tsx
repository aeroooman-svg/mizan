import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Transaction } from '@/lib/storage';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';

interface WeeklyDigestBannerProps {
  transactions: Transaction[];
  currencySymbol: string;
  onPressDetails?: () => void;
}

export default function WeeklyDigestBanner({
  transactions,
  currencySymbol,
  onPressDetails,
}: WeeklyDigestBannerProps) {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const weeklyStats = useMemo(() => {
    const now = new Date();
    const msInDay = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = new Date(now.getTime() - 7 * msInDay);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * msInDay);

    let thisWeekSpent = 0;
    let lastWeekSpent = 0;
    const catSpentMap: Record<string, number> = {};
    let biggestTx: Transaction | null = null;

    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      const txDate = new Date(tx.date);

      if (txDate >= sevenDaysAgo && txDate <= now) {
        thisWeekSpent += tx.amount;
        catSpentMap[tx.category] = (catSpentMap[tx.category] || 0) + tx.amount;

        if (!biggestTx || tx.amount > biggestTx.amount) {
          biggestTx = tx;
        }
      } else if (txDate >= fourteenDaysAgo && txDate < sevenDaysAgo) {
        lastWeekSpent += tx.amount;
      }
    });

    // Find top category
    let topCatId: string | null = null;
    let topCatAmount = 0;
    Object.entries(catSpentMap).forEach(([catId, amount]) => {
      if (amount > topCatAmount) {
        topCatAmount = amount;
        topCatId = catId;
      }
    });

    return {
      thisWeekSpent,
      lastWeekSpent,
      topCatId,
      topCatAmount,
      biggestTx: biggestTx as Transaction | null,
    };
  }, [transactions]);

  const topCategoryObj = weeklyStats.topCatId ? getCategoryById(weeklyStats.topCatId) : null;
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.banner}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <View style={styles.sparkleIcon}>
            <Ionicons name="sparkles" size={16} color="#F59E0B" />
          </View>
          <Text style={styles.title}>{isAr ? 'ملخص الـ 7 أيام الماضية' : 'Past 7 Days Digest'}</Text>
        </View>
        <Text style={styles.amountText}>
          {formatCurrency(weeklyStats.thisWeekSpent, language)} {currencySymbol}
        </Text>
      </View>

      <View style={styles.chipsRow}>
        {topCategoryObj && (
          <View style={styles.chip}>
            <MaterialIcons name={topCategoryObj.icon as any} size={14} color={topCategoryObj.color || colors.primary} />
            <Text style={styles.chipText}>
              {isAr ? 'الأعلى:' : 'Top:'} {getCategoryName(topCategoryObj.id, language)} ({formatCurrency(weeklyStats.topCatAmount, language)} {currencySymbol})
            </Text>
          </View>
        )}

        {weeklyStats.biggestTx && (
          <View style={styles.chip}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.accent} />
            <Text style={styles.chipText}>
              {isAr ? 'أكبر عملية:' : 'Largest:'} {formatCurrency(weeklyStats.biggestTx.amount, language)} {currencySymbol}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    banner: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sparkleIcon: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      padding: 6,
      borderRadius: 10,
    },
    title: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
    },
    amountText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.expense,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
  });
