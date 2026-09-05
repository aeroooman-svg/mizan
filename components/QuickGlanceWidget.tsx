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
  language: 'ar' | 'en' | 'hi';
  goals?: SavingsGoal[];
  debts?: Debt[];
  totalConsolidatedBalance?: number;
  onAddPress?: () => void;
  onVoicePress?: () => void;
}

export default function QuickGlanceWidget({
  data,
  language,
  goals = [],
  debts = [],
  totalConsolidatedBalance,
  onVoicePress,
}: QuickGlanceWidgetProps) {
  const loc = (ar: string, en: string, hi: string) => {
    if (language === 'hi') return hi;
    if (language === 'ar') return ar;
    return en;
  };

  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const [showFullPicture, setShowFullPicture] = useState(false);

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

      {/* Outer Border */}
      <View style={[StyleSheet.absoluteFill, styles.borderGlow, { borderColor: colors.border }]} />

      {/* Main Content */}
      <View style={styles.widgetContent}>
        
        {/* Row 1: Wallet Name Badge */}
        <View style={styles.headerRow}>
          {/* Wallet Name Badge - Soft, Elegant & Modern */}
          <View style={[styles.walletBadge, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="wallet-outline" size={16} color={colors.primary} />
            <Text style={[styles.walletBadgeText, { color: colors.text }]} numberOfLines={1}>
              {data.walletName || loc('المحفظة الرئيسية', 'Main Wallet', 'मुख्य वॉलेट')}
            </Text>
          </View>
        </View>

        {/* Row 2: Custom Capsule Shape (Expense Wing | Center Mic Circle | Income Wing) */}
        <View style={styles.capsuleActionsRow}>
          {/* Left Wing: Expense Button (مصروف) */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/add-transaction?type=expense&prefillType=expense&isQuick=true');
            }}
            style={({ pressed }) => [
              styles.wingActionButton,
              styles.expenseWingBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.wingBtnGradient}
            >
              <Ionicons name="remove-circle" size={20} color="#FFF" />
              <Text style={styles.wingBtnText}>{loc('مصروف', 'Expense', 'खर्च')}</Text>
            </LinearGradient>
          </Pressable>

          {/* Center Circle: Voice Mic Button (دائرة الميكروفون بالمنتصف) */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (onVoicePress) {
                onVoicePress();
              } else {
                router.push('/add-transaction?isVoice=true');
              }
            }}
            style={({ pressed }) => [
              styles.centerVoiceCircle,
              pressed && { transform: [{ scale: 0.92 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#0EA5E9', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.centerVoiceCircleInner}
            >
              <Ionicons name="mic" size={25} color="#FFF" />
            </LinearGradient>
          </Pressable>

          {/* Right Wing: Income Button (دخل) */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/add-transaction?type=income&prefillType=income&isQuick=true');
            }}
            style={({ pressed }) => [
              styles.wingActionButton,
              styles.incomeWingBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.wingBtnGradient}
            >
              <Ionicons name="add-circle" size={20} color="#FFF" />
              <Text style={styles.wingBtnText}>{loc('دخل', 'Income', 'आय')}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.lightDivider} />

        {/* Row 4: Premium Quick Action Cards (مصاريف متكررة & أقساط وجمعيات) */}
        <View style={styles.quickActionPairRow}>
          {/* Recurring Expenses Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/recurring-list' as any);
            }}
            style={({ pressed }) => [
              styles.quickActionCard,
              styles.recurringCard,
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#10B98120', '#10B98108']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradientBg}
            />
            <View style={styles.cardBorderGlow} />
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle3D}
            >
              <Ionicons name="sync" size={18} color="#FFF" />
            </LinearGradient>
            <Text
              style={styles.quickActionCardText}
              numberOfLines={1}
            >
              {loc('مصاريف متكررة', 'Recurring', 'आवर्ती खर्च')}
            </Text>
          </Pressable>

          {/* Installments Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/installments' as any);
            }}
            style={({ pressed }) => [
              styles.quickActionCard,
              styles.installmentsCard,
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#8B5CF620', '#8B5CF608']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradientBg}
            />
            <View style={styles.cardBorderGlowPurple} />
            <LinearGradient
              colors={['#8B5CF6', '#6D28D9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle3D}
            >
              <Ionicons name="card" size={18} color="#FFF" />
            </LinearGradient>
            <Text
              style={styles.quickActionCardText}
              numberOfLines={1}
            >
              {loc('أقساط وجمعيات', 'Installments & Savings', 'किस्तें और समितियां')}
            </Text>
          </Pressable>
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
  capsuleActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  wingActionButton: {
    flex: 1,
    height: 52,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  expenseWingBtn: {
    borderTopLeftRadius: 26,
    borderBottomLeftRadius: 26,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  incomeWingBtn: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 26,
  },
  wingBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  wingBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  centerVoiceCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 3,
    backgroundColor: theme === 'dark' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(14, 165, 233, 0.15)',
    borderWidth: 2,
    borderColor: '#38BDF8',
    elevation: 6,
    shadowColor: '#0284C7',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerVoiceCircleInner: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 8,
    paddingVertical: 2,
  },
  gridToolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt + '80',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  toolIconBadge3D: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  gridToolText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.text,
  },
  quickActionPairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  quickActionCard: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt + '70',
    borderWidth: 1.2,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme === 'dark' ? 0.3 : 0.08,
    shadowRadius: 6,
  },
  recurringCard: {
    borderColor: '#10B98140',
  },
  installmentsCard: {
    borderColor: '#8B5CF640',
  },
  cardGradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  cardBorderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: '#10B98125',
    borderRadius: 18,
  },
  cardBorderGlowPurple: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: '#8B5CF625',
    borderRadius: 18,
  },
  iconCircle3D: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionCardText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 18,
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
