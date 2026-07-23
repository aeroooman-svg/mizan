/**
 * QuickGlanceWidget — ويدجت اللمحة السريعة
 * 
 * A premium glassmorphic widget displayed at the top of the home screen
 * showing balance, health score, today's summary, and last transaction.
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { WidgetData } from '@/lib/widgetDataProvider';
import { formatCurrency } from '@/lib/categories';
import { useTheme } from '@/lib/ThemeContext';

interface QuickGlanceWidgetProps {
  data: WidgetData;
  language: 'ar' | 'en';
  onAddPress?: () => void;
}

export default function QuickGlanceWidget({ data, language }: QuickGlanceWidgetProps) {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [showBalance, setShowBalance] = useState(true);

  const isAr = language === 'ar';
  const typeIcon = data.lastTransaction?.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle';
  const typeColor = data.lastTransaction?.type === 'income' ? colors.income : colors.expense;

  return (
    <View style={[
      styles.widgetContainer,
      {
        shadowColor: data.walletColor || colors.primary,
        shadowOpacity: theme === 'dark' ? 0.35 : 0.12,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
        overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
      }
    ]}>
      {/* Glassmorphic Background */}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={theme === 'dark' ? 35 : 45} tint={theme === 'dark' ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: 'hidden' }]} />
      ) : (
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: theme === 'dark' ? 'rgba(17, 26, 46, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          borderRadius: 24,
          overflow: 'hidden',
        }]} />
      )}

      {/* Gradient Accent */}
      <LinearGradient
        colors={[data.walletColor + '20', 'transparent']}
        style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Content */}
      <View style={styles.widgetContent}>
        {/* Top Row: Balance Header & Health Badge */}
        <View style={styles.topRow}>
          {/* Balance Section */}
          <View style={styles.balanceSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.balanceLabel}>
                {isAr ? 'الرصيد الحالي' : 'Current Balance'}
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowBalance(!showBalance);
                }}
                hitSlop={8}
              >
                <Ionicons
                  name={showBalance ? "eye-outline" : "eye-off-outline"}
                  size={15}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            <Text style={[styles.balanceAmount, { color: data.balance >= 0 ? colors.income : colors.expense }]}>
              {showBalance ? (
                <>
                  {data.balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(data.balance), language)} <Text style={styles.currencyText}>{data.currencySymbol}</Text>
                </>
              ) : (
                '••••••••'
              )}
            </Text>
            <Text style={styles.walletName}>
              {data.walletName}
            </Text>
          </View>

          {/* Compact Health Score Badge */}
          <View style={[
            styles.healthBadge,
            { backgroundColor: data.healthColor + '15', borderColor: data.healthColor + '30' }
          ]}>
            <View style={[styles.healthDot, { backgroundColor: data.healthColor }]} />
            <Text style={[styles.healthBadgeText, { color: data.healthColor }]}>
              {data.healthScore} {isAr ? data.healthLabel.ar : data.healthLabel.en}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Today Summary & Last Txn */}
        <View style={styles.summaryRow}>
          {/* Today Spending Pill */}
          <View style={styles.todayPill}>
            <View style={[styles.todayDot, { backgroundColor: colors.expense }]} />
            <Text style={styles.todayText}>
              {isAr ? 'صرفت اليوم:' : "Today:"} <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>{formatCurrency(data.todaySpent, language)} {data.currencySymbol}</Text>
            </Text>
          </View>

          {/* Last Transaction Chip */}
          {data.lastTransaction && (
            <View style={styles.lastTxnChip}>
              <Ionicons name={typeIcon as any} size={14} color={typeColor} />
              <Text style={styles.lastTxnCategory} numberOfLines={1}>
                {isAr ? data.lastTransaction.categoryName.ar : data.lastTransaction.categoryName.en}
              </Text>
              <Text style={[styles.lastTxnAmount, { color: typeColor }]}>
                {data.lastTransaction.type === 'income' ? '+' : '-'}{formatCurrency(data.lastTransaction.amount, language)}
              </Text>
            </View>
          )}
        </View>

        {/* Unified Quick Action Deck */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionDeckScroll}
        >
          {/* Expense Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/add-transaction?type=expense&prefillType=expense&isQuick=true');
            }}
            style={({ pressed }) => [
              styles.actionPill,
              { backgroundColor: pressed ? '#DC2626' : '#EF4444' },
            ]}
          >
            <Ionicons name="remove-circle-outline" size={16} color="#FFF" />
            <Text style={styles.actionPillText}>{isAr ? 'مصروف' : 'Expense'}</Text>
          </Pressable>

          {/* Income Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/add-transaction?type=income&prefillType=income&isQuick=true');
            }}
            style={({ pressed }) => [
              styles.actionPill,
              { backgroundColor: pressed ? '#059669' : '#10B981' },
            ]}
          >
            <Ionicons name="add-circle-outline" size={16} color="#FFF" />
            <Text style={styles.actionPillText}>{isAr ? 'دخل' : 'Income'}</Text>
          </Pressable>

          {/* Installments */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/installments' as any);
            }}
            style={({ pressed }) => [
              styles.actionPillSecondary,
              { backgroundColor: pressed ? colors.cardBorder : colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="card-outline" size={15} color={colors.text} />
            <Text style={[styles.actionPillTextSecondary, { color: colors.text }]}>{isAr ? 'الأقساط' : 'Installments'}</Text>
          </Pressable>

          {/* Bank Statement */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/import-statement' as any);
            }}
            style={({ pressed }) => [
              styles.actionPillSecondary,
              { backgroundColor: pressed ? colors.cardBorder : colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="document-text-outline" size={15} color={colors.text} />
            <Text style={[styles.actionPillTextSecondary, { color: colors.text }]}>{isAr ? 'كشف بنكي' : 'Statement'}</Text>
          </Pressable>

          {/* Receipt Scanner */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/scan-receipt');
            }}
            style={({ pressed }) => [
              styles.actionPillSecondary,
              { backgroundColor: pressed ? colors.cardBorder : colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="receipt-outline" size={15} color={colors.text} />
            <Text style={[styles.actionPillTextSecondary, { color: colors.text }]}>{isAr ? 'فاتورة' : 'Receipt'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  widgetContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 8,
  },
  widgetContent: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceSection: {
    flex: 1,
  },
  balanceLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  balanceAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 26,
    lineHeight: 34,
  },
  currencyText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Cairo_600SemiBold',
  },
  walletName: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: -2,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt + '60',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  todayText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  lastTxnChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt + '60',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: '52%',
  },
  lastTxnCategory: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.text,
    flexShrink: 1,
  },
  lastTxnAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  actionDeckScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  actionPillText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: '#FFF',
  },
  actionPillSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionPillTextSecondary: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
});

