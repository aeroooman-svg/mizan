import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
import { getGoals, SavingsGoal } from '@/lib/goalStorage';

type WidgetThemeStyle = 'emerald' | 'midnight' | 'gold' | 'light';

export default function WidgetsSetupScreen() {
  const { colors, theme: appTheme } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const styles = useMemo(() => getStyles(colors, isAr), [colors, isAr]);
  const { transactions, wallets, selectedWallet, balance, pendingRecurring, currencySymbol } = useTransactions();

  // Widget Style Preset State
  const [widgetTheme, setWidgetTheme] = useState<WidgetThemeStyle>('emerald');
  const [widgetSize, setWidgetSize] = useState<'medium' | 'small' | 'large'>('medium');

  // Widget Toggles
  const [showBalance, setShowBalance] = useState(true);
  const [showTodayExpense, setShowTodayExpense] = useState(true);
  const [showGoal, setShowGoal] = useState(true);
  const [showHealthScore, setShowHealthScore] = useState(true);

  const [activeGoal, setActiveGoal] = useState<SavingsGoal | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [gList, cfgStr] = await Promise.all([
          getGoals(),
          AsyncStorage.getItem('@mizan_widget_config'),
        ]);
        if (gList.length > 0) setActiveGoal(gList[0]);

        if (cfgStr) {
          const cfg = JSON.parse(cfgStr);
          if (cfg.widgetTheme) setWidgetTheme(cfg.widgetTheme);
          if (cfg.widgetSize) setWidgetSize(cfg.widgetSize);
          if (cfg.showBalance !== undefined) setShowBalance(cfg.showBalance);
          if (cfg.showTodayExpense !== undefined) setShowTodayExpense(cfg.showTodayExpense);
          if (cfg.showGoal !== undefined) setShowGoal(cfg.showGoal);
          if (cfg.showHealthScore !== undefined) setShowHealthScore(cfg.showHealthScore);
        }
      } catch (e) {
        console.error('Error loading widget settings:', e);
      }
    }
    loadData();
  }, []);

  // Today's total expense calculation
  const todaySpent = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return transactions
      .filter(t => t.type === 'expense' && t.date.slice(0, 10) === todayStr)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Clean wallet title
  const walletDisplayName = useMemo(() => {
    if (selectedWallet?.name) return selectedWallet.name;
    return isAr ? 'محفظتي الرئيسية' : 'Main Wallet';
  }, [selectedWallet, isAr]);

  const handleSaveWidget = async () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    const config = {
      widgetTheme,
      widgetSize,
      showBalance,
      showTodayExpense,
      showGoal,
      showHealthScore,
      lastUpdated: new Date().toISOString(),
    };
    await AsyncStorage.setItem('@mizan_widget_config', JSON.stringify(config));
    
    // Copy quick status payload
    const payload = JSON.stringify({
      wallet: walletDisplayName,
      balance: balance || 0,
      todaySpent: todaySpent || 0,
      currency: currencySymbol || 'KWD',
    });
    await Clipboard.setStringAsync(payload);

    Alert.alert(
      isAr ? 'تم حفظ وتفعيل الودجت 🟢' : 'Widget Saved & Activated',
      isAr
        ? 'تمت مزامنة نمط وتنسيق الودجت التفاعلي فوراً ليعمل بتناسق تام على شاشة هاتفك الرئيسية!'
        : 'Widget configuration saved successfully for your home screen!'
    );
  };

  const handleGoBack = () => {
    try { Haptics.selectionAsync(); } catch {}
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  };

  // Color properties based on selected Widget Theme
  const themeColors = useMemo(() => {
    switch (widgetTheme) {
      case 'emerald':
        return {
          gradient: ['#0D7C66', '#10B981'] as [string, string],
          bg: '#0B2920',
          text: '#FFFFFF',
          textSub: 'rgba(255,255,255,0.75)',
          accent: '#10B981',
          border: 'rgba(16,185,129,0.3)',
          cardBg: 'rgba(255,255,255,0.12)',
        };
      case 'midnight':
        return {
          gradient: ['#090E17', '#1E293B'] as [string, string],
          bg: '#0F172A',
          text: '#FFFFFF',
          textSub: 'rgba(255,255,255,0.7)',
          accent: '#38BDF8',
          border: 'rgba(56,189,248,0.3)',
          cardBg: 'rgba(255,255,255,0.08)',
        };
      case 'gold':
        return {
          gradient: ['#78350F', '#D97706'] as [string, string],
          bg: '#291804',
          text: '#FFFFFF',
          textSub: 'rgba(255,255,255,0.8)',
          accent: '#F59E0B',
          border: 'rgba(245,158,11,0.4)',
          cardBg: 'rgba(255,255,255,0.15)',
        };
      case 'light':
      default:
        return {
          gradient: ['#FFFFFF', '#F1F5F9'] as [string, string],
          bg: '#FFFFFF',
          text: '#0F172A',
          textSub: '#64748B',
          accent: '#0D7C66',
          border: 'rgba(13,124,102,0.2)',
          cardBg: '#F8FAFC',
        };
    }
  }, [widgetTheme]);

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={handleGoBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isAr ? 'تخصيص وودجت الهاتف' : 'Widget Setup'}
        </Text>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="close-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Intro Hero Card */}
        <View style={styles.infoCard}>
          <LinearGradient
            colors={[colors.primary + '18', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.heroBadgeIcon}>
            <Ionicons name="hardware-chip-outline" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>
              {isAr ? 'ودجت الشاشة الرئيسية المباشر' : 'Live Phone Screen Widget'}
            </Text>
            <Text style={styles.infoSub}>
              {isAr
                ? 'تابع رصيدك ومصاريفك الحية فوراً من شاشة هاتفك الرئيسية بأشكال وألوان راقية.'
                : 'Monitor live balances and daily expenses directly on your phone home screen.'}
            </Text>
          </View>
        </View>

        {/* STEP 1: Choose Widget Theme Style */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>
              {isAr ? '1. اختر الشكل والمظهر (Widget Style)' : '1. Choose Widget Theme'}
            </Text>
          </View>

          <View style={styles.themeGrid}>
            {[
              { id: 'emerald', nameAr: 'زمردي فاخر', nameEn: 'Emerald Luxury', colors: ['#0D7C66', '#10B981'] },
              { id: 'midnight', nameAr: 'كحلي ليلي', nameEn: 'Midnight Dark', colors: ['#090E17', '#1E293B'] },
              { id: 'gold', nameAr: 'ذهبي استثماري', nameEn: 'Gold Investment', colors: ['#78350F', '#D97706'] },
              { id: 'light', nameAr: 'أبيض ناصع', nameEn: 'Pure Light', colors: ['#E2E8F0', '#FFFFFF'] },
            ].map(item => {
              const isSelected = widgetTheme === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    try { Haptics.selectionAsync(); } catch {}
                    setWidgetTheme(item.id as WidgetThemeStyle);
                  }}
                  style={[
                    styles.themeBtn,
                    isSelected && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                >
                  <LinearGradient
                    colors={item.colors as [string, string]}
                    style={styles.themePreviewGradient}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={item.id === 'light' ? colors.primary : '#FFF'} />
                    )}
                  </LinearGradient>
                  <Text style={[styles.themeBtnText, isSelected && { fontFamily: 'Cairo_700Bold', color: colors.primary }]}>
                    {isAr ? item.nameAr : item.nameEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* STEP 2: Choose Widget Content Toggles */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="list-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>
              {isAr ? '2. اختر البيانات الظاهرة على الودجت' : '2. Widget Display Contents'}
            </Text>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleLabel}>{isAr ? 'رصيد المحفظة المتبقي' : 'Wallet Balance'}</Text>
              <Text style={styles.toggleDesc}>{isAr ? 'عرض رصيدك المالي المتاح' : 'Display available wallet balance'}</Text>
            </View>
            <Switch
              value={showBalance}
              onValueChange={setShowBalance}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleLabel}>{isAr ? 'مصروف اليوم والعمليات' : 'Today Expense'}</Text>
              <Text style={styles.toggleDesc}>{isAr ? 'إجمالي ما تم إنفاقه اليوم' : 'Total spent today'}</Text>
            </View>
            <Switch
              value={showTodayExpense}
              onValueChange={setShowTodayExpense}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleLabel}>{isAr ? 'هدف الادخار المالي' : 'Savings Goal Progress'}</Text>
              <Text style={styles.toggleDesc}>{isAr ? 'شريط تقدم الهدف المالي الأهم' : 'Show top savings goal bar'}</Text>
            </View>
            <Switch
              value={showGoal}
              onValueChange={setShowGoal}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleLabel}>{isAr ? 'مؤشر الصحة المالية' : 'Health Score'}</Text>
              <Text style={styles.toggleDesc}>{isAr ? 'تقييم الأداء المالي (85/100)' : 'Show health score indicator'}</Text>
            </View>
            <Switch
              value={showHealthScore}
              onValueChange={setShowHealthScore}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        {/* STEP 3: Live Interactive Preview Card */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="eye-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>
              {isAr ? '3. معاينة الودجت الحية بالشكل المختار' : '3. Live Widget Preview'}
            </Text>
          </View>

          {/* Actual Phone Widget Card Preview */}
          <LinearGradient
            colors={themeColors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.phoneWidgetCard, { borderColor: themeColors.border }]}
          >
            {/* Header of Phone Widget */}
            <View style={styles.wHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="account-balance-wallet" size={18} color={themeColors.accent} />
                <Text style={[styles.wWalletName, { color: themeColors.text }]}>
                  {walletDisplayName}
                </Text>
              </View>
              <View style={[styles.wLiveBadge, { backgroundColor: themeColors.cardBg }]}>
                <View style={[styles.wDot, { backgroundColor: themeColors.accent }]} />
                <Text style={[styles.wLiveText, { color: themeColors.text }]}>{isAr ? 'حي' : 'LIVE'}</Text>
              </View>
            </View>

            {/* Balance Row */}
            {showBalance && (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.wSubTitle, { color: themeColors.textSub }]}>
                  {isAr ? 'الرصيد المتاح' : 'Available Balance'}
                </Text>
                <Text style={[styles.wBalanceVal, { color: themeColors.text }]}>
                  {formatCurrency(balance || 0)} {currencySymbol}
                </Text>
              </View>
            )}

            {/* Today Expense & Health Score Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 }}>
              {showTodayExpense && (
                <View style={[styles.wStatBox, { backgroundColor: themeColors.cardBg }]}>
                  <Text style={[styles.wStatLabel, { color: themeColors.textSub }]}>{isAr ? 'مصروف اليوم' : 'Today Spent'}</Text>
                  <Text style={[styles.wStatVal, { color: '#EF4444' }]}>
                    {formatCurrency(todaySpent || 0)} {currencySymbol}
                  </Text>
                </View>
              )}

              {showHealthScore && (
                <View style={[styles.wStatBox, { backgroundColor: themeColors.cardBg, alignItems: 'flex-end' }]}>
                  <Text style={[styles.wStatLabel, { color: themeColors.textSub }]}>{isAr ? 'الصحة المالية' : 'Health Score'}</Text>
                  <Text style={[styles.wStatVal, { color: themeColors.accent }]}>85/100</Text>
                </View>
              )}
            </View>

            {/* Savings Goal Bar */}
            {showGoal && (
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.wStatLabel, { color: themeColors.textSub }]}>
                    {activeGoal ? activeGoal.name : (isAr ? 'هدف الادخار' : 'Savings Goal')}
                  </Text>
                  <Text style={[styles.wStatLabel, { color: themeColors.accent, fontFamily: 'Cairo_700Bold' }]}>
                    {activeGoal ? `${Math.min(100, Math.round((activeGoal.savedAmount / activeGoal.targetAmount) * 100))}%` : '65%'}
                  </Text>
                </View>
                <View style={[styles.wProgressBg, { backgroundColor: themeColors.cardBg }]}>
                  <View style={[styles.wProgressFill, { backgroundColor: themeColors.accent, width: activeGoal ? `${Math.min(100, (activeGoal.savedAmount / activeGoal.targetAmount) * 100)}%` : '65%' }]} />
                </View>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* STEP 4: Save & Activate Button */}
        <Pressable onPress={handleSaveWidget} style={styles.activateBtn}>
          <Ionicons name="checkmark-circle" size={22} color="#FFF" />
          <Text style={styles.activateBtnText}>
            {isAr ? 'حفظ وتفعيل الويدجت التفاعلي 🚀' : 'Save & Activate Widget 🚀'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, isAr: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  infoCard: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  heroBadgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
    textAlign: isAr ? 'left' : 'right',
  },
  infoSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: isAr ? 'left' : 'right',
    marginTop: 2,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderRow: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeBtn: {
    width: '48%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 6,
  },
  themePreviewGradient: {
    width: '100%',
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  toggleRow: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleTextCol: {
    flex: 1,
    paddingRight: isAr ? 0 : 12,
    paddingLeft: isAr ? 12 : 0,
  },
  toggleLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
    textAlign: isAr ? 'left' : 'right',
  },
  toggleDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: isAr ? 'left' : 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  phoneWidgetCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  wHeader: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingBottom: 8,
  },
  wWalletName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  wLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  wDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  wLiveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
  },
  wSubTitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  wBalanceVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    marginTop: 2,
  },
  wStatBox: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
  },
  wStatLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
  },
  wStatVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    marginTop: 2,
  },
  wProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  wProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  activateBtn: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  activateBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
});
