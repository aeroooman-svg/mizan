/**
 * QuickGlanceWidget — ويدجت اللمحة السريعة المبتكرة
 * 
 * A state-of-the-art glassmorphic widget displayed on the home screen
 * featuring aligned balance, prominent wallet badge, side-by-side large action buttons,
 * and health score insights.
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
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const [showBalance, setShowBalance] = useState(true);

  const isAr = language === 'ar';
  const typeIcon = data.lastTransaction?.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle';
  const typeColor = data.lastTransaction?.type === 'income' ? colors.income : colors.expense;
  const walletAccent = data.walletColor || colors.primary;

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
        
        {/* Row 1: Wallet Name Badge & Health Score */}
        <View style={styles.headerRow}>
          {/* Wallet Name Badge - Prominent & Distinctive */}
          <View style={[styles.walletBadge, { backgroundColor: walletAccent + '18', borderColor: walletAccent + '40' }]}>
            <Ionicons name="wallet" size={16} color={walletAccent} />
            <Text style={[styles.walletBadgeText, { color: walletAccent }]} numberOfLines={1}>
              {data.walletName || (isAr ? 'المحفظة الرئيسية' : 'Main Wallet')}
            </Text>
          </View>

          {/* Health Score Badge */}
          <View style={[
            styles.healthBadge,
            { backgroundColor: data.healthColor + '18', borderColor: data.healthColor + '35' }
          ]}>
            <View style={[styles.healthDot, { backgroundColor: data.healthColor }]} />
            <Text style={[styles.healthBadgeText, { color: data.healthColor }]}>
              {data.healthScore} {isAr ? data.healthLabel.ar : data.healthLabel.en}
            </Text>
          </View>
        </View>

        {/* Row 2: Balance Section - Label & Amount strictly aligned on the SAME side */}
        <View style={styles.balanceContainer}>
          <View style={styles.balanceLabelRow}>
            <Text style={styles.balanceLabelText}>
              {isAr ? 'الرصيد الحالي' : 'Current Balance'}
            </Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setShowBalance(!showBalance);
              }}
              hitSlop={10}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showBalance ? "eye-outline" : "eye-off-outline"}
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <Text
            style={[
              styles.balanceAmountText,
              { color: data.balance >= 0 ? colors.income : colors.expense }
            ]}
            numberOfLines={1}
          >
            {showBalance ? (
              <>
                {data.balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(data.balance), language)}{' '}
                <Text style={styles.currencySymbolText}>{data.currencySymbol}</Text>
              </>
            ) : (
              '••••••••'
            )}
          </Text>
        </View>

        {/* Row 3: Large Prominent Action Buttons (Expense & Income Side-by-Side) */}
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

        {/* Row 4: Summary Info & Secondary Quick Tools */}
        <View style={styles.bottomRow}>
          {/* Today Spending Pill */}
          <View style={styles.todayPill}>
            <Ionicons name="today-outline" size={14} color={colors.expense} />
            <Text style={styles.todayText}>
              {isAr ? 'صرفت اليوم:' : "Today:"}{' '}
              <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>
                {formatCurrency(data.todaySpent, language)} {data.currencySymbol}
              </Text>
            </Text>
          </View>

          {/* Secondary Quick Action Shortcuts */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.secondaryScroll}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/installments' as any);
              }}
              style={({ pressed }) => [
                styles.secondaryPill,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="card-outline" size={14} color={colors.text} />
              <Text style={styles.secondaryPillText}>{isAr ? 'الأقساط' : 'Installments'}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/import-statement' as any);
              }}
              style={({ pressed }) => [
                styles.secondaryPill,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="document-text-outline" size={14} color={colors.text} />
              <Text style={styles.secondaryPillText}>{isAr ? 'كشف بنكي' : 'Statement'}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/scan-receipt');
              }}
              style={({ pressed }) => [
                styles.secondaryPill,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="receipt-outline" size={14} color={colors.text} />
              <Text style={styles.secondaryPillText}>{isAr ? 'فاتورة' : 'Receipt'}</Text>
            </Pressable>
          </ScrollView>
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
    maxWidth: '65%',
  },
  walletBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  healthDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  healthBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  balanceContainer: {
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  balanceLabelText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  eyeBtn: {
    padding: 2,
  },
  balanceAmountText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'left',
  },
  currencySymbolText: {
    fontSize: 16,
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
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt + '80',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  todayText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  secondaryScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt + '60',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  secondaryPillText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.text,
  },
});
