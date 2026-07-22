/**
 * QuickGlanceWidget — ويدجت اللمحة السريعة
 * 
 * A premium glassmorphic widget displayed at the top of the home screen
 * showing balance, health score, today's summary, and last transaction.
 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { WidgetData } from '@/lib/widgetDataProvider';
import { formatCurrency } from '@/lib/categories';
import { useTheme } from '@/lib/ThemeContext';

interface QuickGlanceWidgetProps {
  data: WidgetData;
  language: 'ar' | 'en';
  onAddPress?: () => void;
}

const RING_SIZE = 52;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function QuickGlanceWidget({ data, language, onAddPress }: QuickGlanceWidgetProps) {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const scoreOffset = RING_CIRCUMFERENCE - (data.healthScore / 100) * RING_CIRCUMFERENCE;
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
        overflow: Platform.OS === 'android' ? 'hidden' : 'visible', // Keep visible on iOS for shadow glow!
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
        colors={[data.walletColor + '25', 'transparent']}
        style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Content */}
      <View style={styles.widgetContent}>
        {/* Top Row: Balance + Health Ring */}
        <View style={styles.topRow}>
          {/* Balance Section */}
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>
              {isAr ? 'الرصيد الحالي' : 'Current Balance'}
            </Text>
            <Text style={[styles.balanceAmount, { color: data.balance >= 0 ? colors.income : colors.expense }]}>
              {data.balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(data.balance), language)} <Text style={styles.currencyText}>{data.currencySymbol}</Text>
            </Text>
            <Text style={styles.walletName}>
              {data.walletName}
            </Text>
          </View>

          {/* Health Score Ring */}
          <Pressable
            style={styles.healthRing}
            onPress={() => {
              Haptics.selectionAsync();
            }}
          >
            <Svg width={RING_SIZE} height={RING_SIZE}>
              {/* Background Ring */}
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="transparent"
                stroke={colors.border}
                strokeWidth={RING_STROKE}
              />
              {/* Score Ring */}
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="transparent"
                stroke={data.healthColor}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={scoreOffset}
                rotation="-90"
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              />
            </Svg>
            <View style={styles.healthScoreInner}>
              <Text style={[styles.healthScoreNum, { color: data.healthColor }]}>{data.healthScore}</Text>
            </View>
            <Text style={[styles.healthLabel, { color: data.healthColor }]}>
              {isAr ? data.healthLabel.ar : data.healthLabel.en}
            </Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Bottom Row: Today Summary + Last Txn + Add Button */}
        <View style={styles.bottomRow}>
          {/* Today Stats */}
          <View style={styles.todayStat}>
            <View style={[styles.todayDot, { backgroundColor: colors.expense }]} />
            <View>
              <Text style={styles.todayLabel}>
                {isAr ? 'صرفت اليوم' : "Today's spend"}
              </Text>
              <Text style={styles.todayValue}>
                {formatCurrency(data.todaySpent, language)} {data.currencySymbol}
              </Text>
            </View>
          </View>

          {/* Last Transaction */}
          {data.lastTransaction && (
            <View style={styles.lastTxn}>
              <Ionicons name={typeIcon as any} size={16} color={typeColor} />
              <View style={{ flex: 1 }}>
                <Text style={styles.lastTxnCategory} numberOfLines={1}>
                  {isAr ? data.lastTransaction.categoryName.ar : data.lastTransaction.categoryName.en}
                </Text>
                <Text style={styles.lastTxnTime}>
                  {isAr ? data.lastTransaction.timeAgo.ar : data.lastTransaction.timeAgo.en}
                </Text>
              </View>
              <Text style={[styles.lastTxnAmount, { color: typeColor }]}>
                {data.lastTransaction.type === 'income' ? '+' : '-'}{formatCurrency(data.lastTransaction.amount, language)}
              </Text>
            </View>
          )}

        {/* Quick Actions Section */}
        <View style={styles.quickActionsContainer}>
          {/* Row 1: Primary Income & Expense Buttons */}
          <View style={styles.primaryActionsRow}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/add-transaction', params: { type: 'income', prefillType: 'income' } } as any);
              }}
              style={({ pressed }) => [
                styles.primaryActionBtn,
                { backgroundColor: pressed ? '#059669' : '#10B981' },
              ]}
            >
              <Ionicons name="add-circle" size={20} color="#FFF" />
              <Text style={styles.primaryActionText}>
                {isAr ? 'إضافة دخل' : 'Add Income'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/add-transaction', params: { type: 'expense', prefillType: 'expense' } } as any);
              }}
              style={({ pressed }) => [
                styles.primaryActionBtn,
                { backgroundColor: pressed ? '#DC2626' : '#EF4444' },
              ]}
            >
              <Ionicons name="remove-circle" size={20} color="#FFF" />
              <Text style={styles.primaryActionText}>
                {isAr ? 'إضافة مصروف' : 'Add Expense'}
              </Text>
            </Pressable>
          </View>

          {/* Row 2: Secondary Tools (Installments, Statement, Receipt) */}
          <View style={styles.secondaryActionsRow}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/installments' as any);
              }}
              style={({ pressed }) => [
                styles.secondaryActionBtn,
                { backgroundColor: pressed ? colors.cardBorder : colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <Ionicons name="card-outline" size={16} color={colors.text} />
              <Text style={[styles.secondaryActionText, { color: colors.text }]} numberOfLines={1}>
                {isAr ? 'الأقساط' : 'Installments'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/import-statement' as any);
              }}
              style={({ pressed }) => [
                styles.secondaryActionBtn,
                { backgroundColor: pressed ? colors.cardBorder : colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.text} />
              <Text style={[styles.secondaryActionText, { color: colors.text }]} numberOfLines={1}>
                {isAr ? 'كشف بنكي' : 'Statement'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/scan-receipt');
              }}
              style={({ pressed }) => [
                styles.secondaryActionBtn,
                { backgroundColor: pressed ? colors.cardBorder : colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <Ionicons name="receipt-outline" size={16} color={colors.text} />
              <Text style={[styles.secondaryActionText, { color: colors.text }]} numberOfLines={1}>
                {isAr ? 'فاتورة' : 'Receipt'}
              </Text>
            </Pressable>
          </View>
        </View>
        </View>

        {/* Savings Rate Indicator */}
        {data.savingsRate !== 0 && (
          <View style={styles.savingsBar}>
            <View style={styles.savingsBarTrack}>
              <View
                style={[
                  styles.savingsBarFill,
                  {
                    width: `${Math.min(100, Math.max(0, data.savingsRate))}%`,
                    backgroundColor: data.savingsRate >= 20 ? colors.income : data.savingsRate >= 10 ? '#F59E0B' : colors.expense,
                  },
                ]}
              />
            </View>
            <Text style={styles.savingsBarLabel}>
              {isAr
                ? `ادخار ${data.savingsRate}%`
                : `${data.savingsRate}% saved`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  widgetContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 8,
  },
  widgetContent: {
    padding: 18,
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
    marginBottom: 2,
  },
  balanceAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 26,
    lineHeight: 34,
  },
  currencyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  walletName: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: -2,
  },
  healthRing: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  healthScoreInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreNum: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    lineHeight: 20,
  },
  healthLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 9,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  bottomRow: {
    gap: 10,
  },
  todayStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  todayLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textSecondary,
  },
  todayValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    marginTop: -2,
  },
  lastTxn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 10,
  },
  lastTxnCategory: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.text,
  },
  lastTxnTime: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 9,
    color: colors.textTertiary,
  },
  lastTxnAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  quickActionsContainer: {
    gap: 8,
    marginTop: 6,
  },
  primaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 11,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  primaryActionText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  secondaryActionText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  savingsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  savingsBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  savingsBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  savingsBarLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
    minWidth: 60,
    textAlign: 'right',
  },
});
