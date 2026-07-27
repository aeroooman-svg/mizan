import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Wallet } from '@/lib/storage';
import { formatCurrency } from '@/lib/categories';

import { SyncState } from '@/lib/syncService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MizanLuxuryHomeScreenProps {
  selectedWallet: Wallet | null;
  totalBalance: number;
  healthScore?: number;
  syncState?: SyncState | 'local';
  language?: 'ar' | 'en';
  onOpenMenu: () => void;
  onWalletMenu?: () => void;
}

export default function MizanLuxuryHomeScreen({
  selectedWallet,
  totalBalance,
  healthScore = 100,
  syncState = 'local',
  language = 'ar',
  onOpenMenu,
  onWalletMenu,
}: MizanLuxuryHomeScreenProps) {
  const isAr = language === 'ar';

  return (
    <View style={styles.container}>
      {/* 1. Top Toolbar */}
      <View style={styles.topToolbar}>
        {/* Hamburger Menu Icon (Left) */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOpenMenu();
          }}
          style={({ pressed }) => [styles.iconCircleBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="menu-outline" size={22} color="#FFFFFF" />
        </Pressable>

        {/* Logo MIZAN + Sync Status Badge (Center) */}
        <View style={styles.logoSyncContainer}>
          <Text style={styles.logoTitle}>MIZAN</Text>
          <View
            style={[
              styles.syncBadgePill,
              {
                backgroundColor:
                  syncState === 'synced'
                    ? 'rgba(16, 185, 129, 0.25)'
                    : 'rgba(245, 158, 11, 0.25)',
              },
            ]}
          >
            <View
              style={[
                styles.syncDotIndicator,
                {
                  backgroundColor:
                    syncState === 'synced' ? '#10B981' : '#F59E0B',
                },
              ]}
            />
            <Text
              style={[
                styles.syncBadgeText,
                { color: syncState === 'synced' ? '#34D399' : '#FBBF24' },
              ]}
            >
              {syncState === 'synced'
                ? isAr
                  ? 'متزامن'
                  : 'Synced'
                : isAr
                ? 'محلي'
                : 'Local'}
            </Text>
          </View>
        </View>

        {/* Bell & Settings Icons (Right) */}
        <View style={styles.rightIconsGroup}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/notifications');
            }}
            style={({ pressed }) => [styles.iconCircleBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
            style={({ pressed }) => [styles.iconCircleBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* 2. Main Balance Card (بطاقة الرصيد الأساسية) */}
      <View style={styles.mainBalanceCardWrapper}>
        <LinearGradient
          colors={['#0A382D', '#041F1A', '#02120E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainBalanceCardGradient}
        >
          {/* Card Top Row: Wallet Name/ID (Left) & Actions (Right) */}
          <View style={styles.cardHeaderRow}>
            <Text style={styles.walletIdTitle}>
              {selectedWallet?.name || '2'}
            </Text>

            <View style={styles.cardTopRightControls}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (onWalletMenu) onWalletMenu();
                }}
                style={styles.threeDotsPill}
              >
                <Ionicons name="ellipsis-vertical" size={16} color="#FFFFFF" />
              </Pressable>

              <View style={styles.goldenWalletIconWrap}>
                <Ionicons name="wallet" size={20} color="#FBBF24" />
              </View>
            </View>
          </View>

          {/* Card Middle Row: Available Balance (Left) & Circular Gauge (Right) */}
          <View style={styles.cardBodyRow}>
            {/* Balance Column */}
            <View style={styles.balanceInfoCol}>
              <Text style={styles.balanceLabel}>
                {isAr ? 'الرصيد المتاح' : 'Available Balance'}
              </Text>
              <Text style={styles.balanceAmountValue} numberOfLines={1}>
                {formatCurrency(totalBalance, language)}{' '}
                <Text style={styles.currencySymbolCode}>
                  {selectedWallet?.currency || 'EGP'}
                </Text>
              </Text>
            </View>

            {/* 3D Glass Circular Gauge */}
            <View style={styles.gaugeWidgetWrapper}>
              <View style={styles.gaugeGlassRing}>
                <Text style={styles.gaugeScoreNumber}>{healthScore}</Text>
                <Text style={styles.gaugeScorePercent}>%</Text>
              </View>
              <Text style={styles.gaugeStatusTitle}>
                {isAr
                  ? healthScore >= 80
                    ? 'ممتاز'
                    : 'جيد'
                  : healthScore >= 80
                  ? 'Excellent'
                  : 'Good'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* 3. Quick Actions Grid (قسم الإجراءات السريعة) */}
      <View style={styles.quickActionsContainerCard}>
        {/* Top-Left Wallet Selector Badge */}
        <View style={styles.gridHeaderBadgeRow}>
          <View style={styles.walletPillBadge}>
            <Ionicons name="wallet-outline" size={14} color="#34D399" />
            <Text style={styles.walletPillBadgeText}>
              {selectedWallet?.name || '2'}
            </Text>
          </View>
        </View>

        {/* Row 1: Income (Right) & Expense (Left) Buttons */}
        <View style={styles.mainActionsButtonsRow}>
          {/* Income Button (دخل) — Green Teal Metallic (Right) */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(
                '/add-transaction?type=income&prefillType=income&isQuick=true'
              );
            }}
            style={({ pressed }) => [
              styles.actionBtnFlex,
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#0F8A65', '#085C43', '#043D2D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.actionBtnGradient, { borderColor: '#34D399' }]}
            >
              <View style={[styles.btnIconBadgeCircle, { backgroundColor: '#34D399' }]}>
                <Ionicons name="add" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.actionBtnText}>{isAr ? 'دخل' : 'Income'}</Text>
            </LinearGradient>
          </Pressable>

          {/* Expense Button (مصروف) — Burgundy Crimson Metallic (Left) */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(
                '/add-transaction?type=expense&prefillType=expense&isQuick=true'
              );
            }}
            style={({ pressed }) => [
              styles.actionBtnFlex,
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#C02626', '#8A1414', '#590B0B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.actionBtnGradient, { borderColor: '#F87171' }]}
            >
              <View style={[styles.btnIconBadgeCircle, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="remove" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.actionBtnText}>{isAr ? 'مصروف' : 'Expense'}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Row 2: Recurring Expenses (Right) & Installments (Left) */}
        <View style={styles.secondaryActionsButtonsRow}>
          {/* Recurring Expenses (مصاريف متكررة) — Right */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/recurring-list' as any);
            }}
            style={({ pressed }) => [
              styles.actionBtnFlex,
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#0C3833', '#06211E', '#031210']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.secondaryCardGradient, { borderColor: '#2DD4BF' }]}
            >
              <View style={[styles.secondaryIconBadge, { backgroundColor: '#10B981' }]}>
                <Ionicons name="sync" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.secondaryCardTitle}>
                {isAr ? 'مصاريف متكررة' : 'Recurring'}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Installments (الأقساط) — Left */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/installments' as any);
            }}
            style={({ pressed }) => [
              styles.actionBtnFlex,
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={['#311B58', '#1A0C36', '#0E0520']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.secondaryCardGradient, { borderColor: '#A78BFA' }]}
            >
              <View style={[styles.secondaryIconBadge, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="card" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.secondaryCardTitle}>
                {isAr ? 'الأقساط' : 'Installments'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
  },
  // Top Toolbar
  topToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F1A2A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSyncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: '#D4AF37', // Gold metallic font
    letterSpacing: 1.5,
  },
  syncBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  syncDotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  rightIconsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Main Balance Card
  mainBalanceCardWrapper: {
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#34D399',
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
  },
  mainBalanceCardGradient: {
    padding: 18,
    borderRadius: 24,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletIdTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: '#FFFFFF',
  },
  cardTopRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  threeDotsPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  goldenWalletIconWrap: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  balanceInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  balanceLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
    textAlign: 'left',
  },
  balanceAmountValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 30,
    color: '#FFFFFF',
    textAlign: 'left',
  },
  currencySymbolCode: {
    fontSize: 16,
    fontFamily: 'Cairo_600SemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  gaugeWidgetWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  gaugeGlassRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#34D399',
    backgroundColor: 'rgba(5, 40, 30, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  gaugeScoreNumber: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  gaugeScorePercent: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: -2,
  },
  gaugeStatusTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: '#34D399',
  },

  // Quick Actions Grid Card
  quickActionsContainerCard: {
    backgroundColor: '#0C162A',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 12,
  },
  gridHeaderBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  walletPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#0A2E25',
    borderWidth: 1,
    borderColor: '#10B98140',
  },
  walletPillBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  mainActionsButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryActionsButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtnFlex: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  btnIconBadgeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondaryCardGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  secondaryIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
});
