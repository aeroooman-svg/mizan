/**
 * QuickGlanceWidget — ويدجت اللمحة السريعة المبتكرة المتكاملة
 * 
 * A state-of-the-art glassmorphic widget displayed on the home screen
 * featuring aligned balance, prominent wallet badge, side-by-side large action buttons,
 * and the integrated Complete Financial Picture (الصورة الكاملة للوضع المالي).
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
import { SavingsGoal } from '@/lib/goalStorage';
import { Debt } from '@/lib/debtStorage';

interface QuickGlanceWidgetProps {
  data: WidgetData;
  language: 'ar' | 'en';
  goals?: SavingsGoal[];
  debts?: Debt[];
  totalConsolidatedBalance?: number;
  onAddPress?: () => void;
}

export default function QuickGlanceWidget({
  data,
  language,
  goals = [],
  debts = [],
  totalConsolidatedBalance,
}: QuickGlanceWidgetProps) {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const [showFullPicture, setShowFullPicture] = useState(true);

  const isAr = language === 'ar';
  const walletAccent = data.walletColor || colors.primary;

  const totalSavedInGoals = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
  const totalOwed = debts
    .filter((d) => d.type === 'debt_to_others' && d.status !== 'paid')
    .reduce((s, d) => s + (d.amount - (d.paidAmount || 0)), 0);
  const totalCollect = debts
    .filter((d) => d.type === 'debt_to_me' && d.status !== 'paid')
    .reduce((s, d) => s + (d.amount - (d.paidAmount || 0)), 0);

  const baseWalletBalance = totalConsolidatedBalance !== undefined ? totalConsolidatedBalance : data.balance;
  const totalNetSavings = baseWalletBalance + totalSavedInGoals - totalOwed + totalCollect;

  return (
    <View style={[
      styles.widgetContainer,
      {
        shadowColor: walletAccent,
        shadowOpacity: theme === 'dark' ? 0.4 : 0.15,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
      }
    ]}>
      {/* Glassmorphic Background */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={theme === 'dark' ? 45 : 55}
          tint={theme === 'dark' ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: 'hidden' }]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
              borderRadius: 28,
              overflow: 'hidden',
            },
          ]}
        />
      )}

      {/* Gradient Ambient Accent */}
      <LinearGradient
        colors={[walletAccent + '25', walletAccent + '05', 'transparent']}
        style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Outer Border Glow */}
      <View style={[StyleSheet.absoluteFill, styles.borderGlow, { borderColor: walletAccent + '30' }]} />

      {/* Main Content */}
      <View style={styles.widgetContent}>
        
        {/* Row 1: Wallet Name Badge */}
        <View style={styles.headerRow}>
          {/* Wallet Name Badge - Prominent & Distinctive */}
          <View style={[styles.walletBadge, { backgroundColor: walletAccent + '18', borderColor: walletAccent + '40' }]}>
            <Ionicons name="wallet" size={16} color={walletAccent} />
            <Text style={[styles.walletBadgeText, { color: walletAccent }]} numberOfLines={1}>
              {data.walletName || (isAr ? 'المحفظة الرئيسية' : 'Main Wallet')}
            </Text>
          </View>
        </View>

        {/* Row 2: Large Prominent Action Buttons (Expense & Income Side-by-Side) */}
        <View style={styles.mainActionsRow}>
          {/* Expense Button (مصروف) - Large */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/add-transaction?type=expense&prefillType=expense&isQuick=true');
            }}
            style={({ pressed }) => [
              styles.bigActionButton,
              styles.expenseBigBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bigBtnGradient}
            >
              <Ionicons name="remove-circle" size={24} color="#FFF" />
              <Text style={styles.bigBtnText}>{isAr ? 'مصروف' : 'Expense'}</Text>
            </LinearGradient>
          </Pressable>

          {/* Income Button (دخل) - Large */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/add-transaction?type=income&prefillType=income&isQuick=true');
            }}
            style={({ pressed }) => [
              styles.bigActionButton,
              styles.incomeBigBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bigBtnGradient}
            >
              <Ionicons name="add-circle" size={24} color="#FFF" />
              <Text style={styles.bigBtnText}>{isAr ? 'دخل' : 'Income'}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.lightDivider} />

        {/* Row 4: Smart Full Tools Bar (Complete, Distinctive & Intelligent Grid Bar) */}
        <View style={styles.bottomRow}>
          <View style={styles.toolsGridBar}>
            {/* Installments */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/installments' as any);
              }}
              style={({ pressed }) => [
                styles.gridToolItem,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="card-outline" size={14} color={colors.text} />
              <Text style={styles.gridToolText} numberOfLines={1}>
                {isAr ? 'الأقساط' : 'Installments'}
              </Text>
            </Pressable>

            {/* Recurring Expenses Button (مصاريف متكررة) */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/recurring-list' as any);
              }}
              style={({ pressed }) => [
                styles.gridToolItem,
                styles.recurringHighlightItem,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="sync-outline" size={14} color={colors.primary} />
              <Text style={[styles.gridToolText, { color: colors.primary }]} numberOfLines={1}>
                {isAr ? 'مصاريف متكررة' : 'Recurring'}
              </Text>
            </Pressable>

            {/* Bank Statement */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/import-statement' as any);
              }}
              style={({ pressed }) => [
                styles.gridToolItem,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="document-text-outline" size={14} color={colors.text} />
              <Text style={styles.gridToolText} numberOfLines={1}>
                {isAr ? 'كشف بنكي' : 'Statement'}
              </Text>
            </Pressable>

            {/* Receipt Scanner */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/scan-receipt');
              }}
              style={({ pressed }) => [
                styles.gridToolItem,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="receipt-outline" size={14} color={colors.text} />
              <Text style={styles.gridToolText} numberOfLines={1}>
                {isAr ? 'فاتورة' : 'Receipt'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Row 5: Integrated "الصورة الكاملة للوضع المالي" (Complete Financial Picture) */}
        <View style={{ marginTop: 4 }}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFullPicture(!showFullPicture);
            }}
            style={({ pressed }) => [
              styles.fullPictureToggle,
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="stats-chart-outline" size={16} color={colors.primary} />
              <Text style={styles.fullPictureTitle}>
                {isAr ? 'الصورة الكاملة للوضع المالي' : 'Complete Financial Picture'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.fullPictureSummaryText, { color: totalNetSavings >= 0 ? colors.income : colors.expense }]}>
                {formatCurrency(totalNetSavings, language)} {data.currencySymbol}
              </Text>
              <Ionicons name={showFullPicture ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
            </View>
          </Pressable>

          {showFullPicture && (
            <View style={styles.fullPictureCard}>
              {/* Wallet Balance */}
              <View style={styles.pictureRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="wallet-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.pictureLabel}>{isAr ? 'إجمالي رصيد المحافظ:' : 'Total Wallet Balance:'}</Text>
                </View>
                <Text style={[styles.pictureValue, { color: baseWalletBalance >= 0 ? colors.income : colors.expense }]}>
                  {baseWalletBalance >= 0 ? '+' : ''}{formatCurrency(baseWalletBalance, language)} {data.currencySymbol}
                </Text>
              </View>

              {/* Savings Jars */}
              {totalSavedInGoals > 0 && (
                <Pressable
                  onPress={() => router.push('/savings-goals')}
                  style={styles.pictureRow}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="gift-outline" size={14} color={colors.primary} />
                    <Text style={[styles.pictureLabel, { color: colors.primary }]}>
                      {isAr ? `الحصالات الادخارية (${goals.length}):` : `Savings Jars (${goals.length}):`}
                    </Text>
                  </View>
                  <Text style={[styles.pictureValue, { color: colors.primary }]}>
                    +{formatCurrency(totalSavedInGoals, language)} {data.currencySymbol}
                  </Text>
                </Pressable>
              )}

              {/* Debts I owe */}
              {totalOwed > 0 && (
                <Pressable
                  onPress={() => router.push('/debts')}
                  style={styles.pictureRow}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="arrow-down-circle-outline" size={14} color={colors.expense} />
                    <Text style={[styles.pictureLabel, { color: colors.expense }]}>{isAr ? 'ديون مستحقة عليّ:' : 'Debts I Owe:'}</Text>
                  </View>
                  <Text style={[styles.pictureValue, { color: colors.expense }]}>
                    -{formatCurrency(totalOwed, language)} {data.currencySymbol}
                  </Text>
                </Pressable>
              )}

              {/* Loans owed to me */}
              {totalCollect > 0 && (
                <Pressable
                  onPress={() => router.push('/debts')}
                  style={styles.pictureRow}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="arrow-up-circle-outline" size={14} color={colors.income} />
                    <Text style={[styles.pictureLabel, { color: colors.income }]}>{isAr ? 'أموال لي بالخارج:' : 'Loans Owed to Me:'}</Text>
                  </View>
                  <Text style={[styles.pictureValue, { color: colors.income }]}>
                    +{formatCurrency(totalCollect, language)} {data.currencySymbol}
                  </Text>
                </Pressable>
              )}

              <View style={styles.pictureDivider} />

              {/* Total Net Savings */}
              <View style={styles.pictureRow}>
                <Text style={styles.netSavingsTitle}>{isAr ? 'الصافي الادخاري الكلي:' : 'Total Net Savings:'}</Text>
                <Text style={[styles.netSavingsTotalValue, { color: totalNetSavings >= 0 ? colors.income : colors.expense }]}>
                  {formatCurrency(totalNetSavings, language)} {data.currencySymbol}
                </Text>
              </View>
            </View>
          )}
        </View>

      </View>
    </View>
  );
}

const getStyles = (colors: any, theme: string) => StyleSheet.create({
  widgetContainer: {
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 28,
    elevation: 10,
  },
  borderGlow: {
    borderRadius: 28,
    borderWidth: 1.5,
  },
  widgetContent: {
    padding: 18,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '85%',
  },
  walletBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  balanceContainer: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    marginVertical: 4,
    width: '100%',
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 4,
    width: '100%',
  },
  balanceLabelText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  eyeBtn: {
    padding: 2,
  },
  balanceAmountText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 40,
    lineHeight: 48,
    textAlign: 'right',
    width: '100%',
  },
  currencySymbolText: {
    fontSize: 18,
    fontFamily: 'Cairo_600SemiBold',
    color: colors.textSecondary,
  },
  mainActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  bigActionButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  incomeBigBtn: {},
  expenseBigBtn: {},
  bigBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  bigBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  lightDivider: {
    height: 1,
    backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    marginVertical: 2,
  },
  bottomRow: {
    gap: 10,
    width: '100%',
  },
  toolsGridBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    width: '100%',
  },
  gridToolItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt + '60',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 12,
  },
  recurringHighlightItem: {
    backgroundColor: colors.primary + '18',
    borderColor: colors.primary + '40',
  },
  gridToolText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.text,
  },
  fullPictureToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt + '50',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary + '25',
  },
  fullPictureTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.text,
  },
  fullPictureSummaryText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  fullPictureCard: {
    backgroundColor: colors.surfaceAlt + '40',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pictureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pictureLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  pictureValue: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  pictureDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  netSavingsTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.text,
  },
  netSavingsTotalValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
});
