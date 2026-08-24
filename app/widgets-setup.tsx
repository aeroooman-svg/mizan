import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  Dimensions,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
import { getWidgetData, exportWidgetNativePayload, WidgetData } from '@/lib/widgetDataProvider';
import { calculateHealthScore } from '@/lib/financialEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type WidgetSize = 'small' | 'medium' | 'lockscreen';
type OSGuide = 'ios' | 'android';

export default function WidgetsSetupScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const {
    transactions,
    wallets,
    selectedWallet,
    currencySymbol,
    balance,
    totalIncome,
    totalExpense,
  } = useTransactions();

  const [selectedSize, setSelectedSize] = useState<WidgetSize>('medium');
  const [selectedOS, setSelectedOS] = useState<OSGuide>(Platform.OS === 'android' ? 'android' : 'ios');
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Compute live widget data
  const healthScore = useMemo(() => {
    return calculateHealthScore(transactions, {}, totalIncome, totalExpense, 'safe', 0);
  }, [transactions, totalIncome, totalExpense]);

  const widgetData: WidgetData = useMemo(() => {
    return getWidgetData(
      transactions,
      wallets,
      selectedWallet,
      healthScore,
      {},
      currencySymbol
    );
  }, [transactions, wallets, selectedWallet, healthScore, currencySymbol]);

  const handleCopyPayload = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const json = exportWidgetNativePayload(widgetData);
      await Clipboard.setStringAsync(json);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2500);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn('Failed to copy payload:', e);
    }
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} style={styles.backButton} hitSlop={15}>
          <Ionicons
            name={isAr ? 'arrow-forward' : 'arrow-back'}
            size={22}
            color={colors.text}
          />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>
            {isAr ? 'ودجت الشاشة الرئيسية' : 'Home Screen Widgets'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isAr ? 'بياناتك المالية بلمحة سريعة دون فتح التطبيق' : 'Quick financial glance at your fingertips'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Widget Size Selector Tabs */}
        <View style={styles.sizeTabsRow}>
          {[
            { id: 'small', labelAr: 'مربع (صغير)', labelEn: 'Small (2x2)', icon: 'square-outline' },
            { id: 'medium', labelAr: 'عريض (متوسط)', labelEn: 'Medium (4x2)', icon: 'tablet-landscape-outline' },
            { id: 'lockscreen', labelAr: 'قفل الشاشة', labelEn: 'Lock Screen', icon: 'lock-closed-outline' },
          ].map(tab => {
            const isActive = selectedSize === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedSize(tab.id as WidgetSize);
                }}
                style={[styles.sizeTab, isActive && styles.sizeTabActive]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={15}
                  color={isActive ? '#FFF' : colors.textSecondary}
                />
                <Text style={[styles.sizeTabText, isActive && styles.sizeTabTextActive]}>
                  {isAr ? tab.labelAr : tab.labelEn}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Live Widget Preview Card */}
        <View style={styles.previewSection}>
          <Text style={styles.previewSectionLabel}>
            {isAr ? '📱 معاينة حية للشكل التفاعلي' : '📱 Live Interactive Preview'}
          </Text>

          {/* Render according to selected size */}
          {selectedSize === 'small' && (
            <View style={styles.smallWidgetCard}>
              <LinearGradient
                colors={['#102A24', '#0A1714']}
                style={styles.widgetGradient}
              >
                <View style={styles.widgetTopRow}>
                  <View style={styles.walletBadge}>
                    <Ionicons name="wallet" size={12} color="#10B981" />
                    <Text numberOfLines={1} style={styles.walletBadgeText}>
                      {widgetData.walletName || (isAr ? 'المحفظة' : 'Wallet')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.healthScoreBadge,
                      { backgroundColor: widgetData.healthColor + '25', borderColor: widgetData.healthColor },
                    ]}
                  >
                    <Text style={[styles.healthScoreText, { color: widgetData.healthColor }]}>
                      {widgetData.healthScore}%
                    </Text>
                  </View>
                </View>

                <View style={styles.smallWidgetCenter}>
                  <Text style={styles.widgetBalanceLabel}>
                    {isAr ? 'الرصيد الصافي' : 'Net Balance'}
                  </Text>
                  <Text style={styles.smallWidgetBalance} numberOfLines={1}>
                    {formatCurrency(widgetData.balance, language)} {widgetData.currencySymbol}
                  </Text>
                </View>

                <View style={styles.smallWidgetBottom}>
                  <Text style={styles.smallWidgetTodayLabel}>
                    {isAr ? 'صرف اليوم:' : 'Today:'}
                  </Text>
                  <Text style={styles.smallWidgetTodayValue}>
                    {formatCurrency(widgetData.todaySpent, language)} {widgetData.currencySymbol}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {selectedSize === 'medium' && (
            <View style={styles.mediumWidgetCard}>
              <LinearGradient
                colors={['#0F2027', '#203A43', '#2C5364']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.widgetGradient}
              >
                {/* Header */}
                <View style={styles.widgetTopRow}>
                  <View style={styles.walletBadge}>
                    <Ionicons name="wallet" size={13} color="#00E676" />
                    <Text numberOfLines={1} style={styles.walletBadgeText}>
                      {widgetData.walletName || (isAr ? 'المحفظة' : 'Wallet')}
                    </Text>
                  </View>
                  <View style={styles.mediumWidgetStatusRow}>
                    <View
                      style={[
                        styles.healthIndicatorDot,
                        { backgroundColor: widgetData.healthColor },
                      ]}
                    />
                    <Text style={[styles.healthStatusLabel, { color: widgetData.healthColor }]}>
                      {isAr ? widgetData.healthLabel.ar : widgetData.healthLabel.en} ({widgetData.healthScore}%)
                    </Text>
                  </View>
                </View>

                {/* Main Content Row */}
                <View style={styles.mediumMainRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.widgetBalanceLabel}>
                      {isAr ? 'الرصيد الكلي' : 'Total Balance'}
                    </Text>
                    <Text style={styles.mediumWidgetBalance}>
                      {formatCurrency(widgetData.balance, language)} {widgetData.currencySymbol}
                    </Text>
                  </View>

                  <View style={styles.mediumStatsBox}>
                    <View style={styles.mediumStatItem}>
                      <Text style={styles.mediumStatLabel}>{isAr ? 'المصروف اليومي' : 'Today Spent'}</Text>
                      <Text style={styles.mediumStatValueRed}>
                        -{formatCurrency(widgetData.todaySpent, language)} {widgetData.currencySymbol}
                      </Text>
                    </View>
                    <View style={styles.mediumStatItem}>
                      <Text style={styles.mediumStatLabel}>{isAr ? 'معدل الادخار' : 'Savings Rate'}</Text>
                      <Text style={styles.mediumStatValueGreen}>{widgetData.savingsRate}%</Text>
                    </View>
                  </View>
                </View>

                {/* Footer: Last transaction snippet */}
                <View style={styles.mediumWidgetFooter}>
                  <Ionicons name="flash-outline" size={13} color="#00E676" />
                  <Text style={styles.mediumFooterText} numberOfLines={1}>
                    {widgetData.lastTransaction
                      ? `${isAr ? 'آخر حركة:' : 'Latest:'} ${
                          widgetData.lastTransaction.type === 'income' ? '+' : '-'
                        }${formatCurrency(widgetData.lastTransaction.amount, language)} (${
                          isAr
                            ? widgetData.lastTransaction.categoryName.ar
                            : widgetData.lastTransaction.categoryName.en
                        }) • ${isAr ? widgetData.lastTransaction.timeAgo.ar : widgetData.lastTransaction.timeAgo.en}`
                      : isAr
                      ? 'لا توجد حركات مسجلة مؤخراً'
                      : 'No recent transactions'}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {selectedSize === 'lockscreen' && (
            <View style={styles.lockscreenWidgetCard}>
              <View style={styles.lockscreenPill}>
                <Ionicons name="pie-chart-outline" size={16} color="#FFF" />
                <Text style={styles.lockscreenText}>
                  {isAr ? 'ميزان: ' : 'Mizan: '}
                  {formatCurrency(widgetData.balance, language)} {widgetData.currencySymbol}
                </Text>
                <View style={styles.lockscreenDivider} />
                <Text style={styles.lockscreenSubtext}>
                  {isAr ? 'اليوم: ' : 'Today: '}
                  {formatCurrency(widgetData.todaySpent, language)}
                </Text>
              </View>
            </View>
          )}

          {/* Copy Payload Button */}
          <Pressable
            onPress={handleCopyPayload}
            style={({ pressed }) => [
              styles.copyPayloadBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={copiedPayload ? 'checkmark-circle' : 'copy-outline'}
              size={17}
              color={copiedPayload ? '#10B981' : colors.primary}
            />
            <Text
              style={[
                styles.copyPayloadBtnText,
                copiedPayload && { color: '#10B981' },
              ]}
            >
              {copiedPayload
                ? isAr
                  ? 'تم نسخ بيانات الودجت بنجاح! 🎉'
                  : 'Widget Data JSON Copied! 🎉'
                : isAr
                ? 'نسخ كود بيانات الودجت المباشر (JSON)'
                : 'Copy Live Widget Payload (JSON)'}
            </Text>
          </Pressable>
        </View>

        {/* Step-by-Step Installation Guides */}
        <View style={styles.guideSection}>
          <Text style={styles.guideSectionTitle}>
            {isAr ? '🛠️ طريقة إضافة الودجت لشاشتك' : '🛠️ How to Add to Your Home Screen'}
          </Text>

          {/* OS Switcher */}
          <View style={styles.osTabsRow}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedOS('ios');
              }}
              style={[styles.osTab, selectedOS === 'ios' && styles.osTabActive]}
            >
              <Ionicons
                name="logo-apple"
                size={16}
                color={selectedOS === 'ios' ? '#FFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.osTabText,
                  selectedOS === 'ios' && styles.osTabTextActive,
                ]}
              >
                Apple iOS (iPhone / iPad)
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedOS('android');
              }}
              style={[
                styles.osTab,
                selectedOS === 'android' && styles.osTabActive,
              ]}
            >
              <Ionicons
                name="logo-android"
                size={16}
                color={selectedOS === 'android' ? '#FFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.osTabText,
                  selectedOS === 'android' && styles.osTabTextActive,
                ]}
              >
                Google Android
              </Text>
            </Pressable>
          </View>

          {/* Guide Steps */}
          {selectedOS === 'ios' ? (
            <View style={styles.stepsContainer}>
              {[
                {
                  step: 1,
                  titleAr: 'اضغط مطولاً على الشاشة',
                  titleEn: 'Long press home screen',
                  descAr: 'المس مع الاستمرار أي مساحة فارغة في الشاشة الرئيسية حتى تهتز التطبيقات.',
                  descEn: 'Touch and hold an empty area on your Home Screen until apps jiggle.',
                },
                {
                  step: 2,
                  titleAr: 'اضغط على زر (+) في الزاوية العلوية',
                  titleEn: 'Tap the (+) button',
                  descAr: 'سيظهر لك معرض الودجات المتاحة في هاتفك.',
                  descEn: 'Open the iOS Widgets Gallery from the top corner.',
                },
                {
                  step: 3,
                  titleAr: 'ابحث عن تطبيق "MIZAN ميزان"',
                  titleEn: 'Search for "MIZAN"',
                  descAr: 'اختر الحجم المفضل لديك (صغير، متوسط، أو قفل الشاشة) ثم اضغط "إضافة أداة".',
                  descEn: 'Select your preferred size (Small, Medium, Lock Screen) and tap Add Widget.',
                },
                {
                  step: 4,
                  titleAr: 'تم التثبيت بنجاح!',
                  titleEn: 'Done!',
                  descAr: 'سيتحدث الودجت تلقائياً مع كل حركة أو مصروف تسجله في التطبيق.',
                  descEn: 'Your widget updates automatically with every expense logged.',
                },
              ].map(item => (
                <View key={item.step} style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{item.step}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>
                      {isAr ? item.titleAr : item.titleEn}
                    </Text>
                    <Text style={styles.stepDesc}>
                      {isAr ? item.descAr : item.descEn}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.stepsContainer}>
              {[
                {
                  step: 1,
                  titleAr: 'اضغط مطولاً على شاشتك',
                  titleEn: 'Long press home screen',
                  descAr: 'المس مع الاستمرار أي مساحة فارغة في الشاشة الرئيسية للهاتف.',
                  descEn: 'Touch and hold an empty space on your Android home screen.',
                },
                {
                  step: 2,
                  titleAr: 'اختر "الأدوات / Widgets"',
                  titleEn: 'Select "Widgets"',
                  descAr: 'ستفتح لك قائمة التطبيقات التي تدعم الودجت.',
                  descEn: 'Open the Android widgets drawer from the popup menu.',
                },
                {
                  step: 3,
                  titleAr: 'اسحب ودجت ميزان للشاشة',
                  titleEn: 'Drag MIZAN widget',
                  descAr: 'اسحب بطاقة ميزان إلى المكان المفضل لك في الشاشة.',
                  descEn: 'Drag and place the MIZAN card onto your desired home screen spot.',
                },
                {
                  step: 4,
                  titleAr: 'استمتع بالوصول السريع!',
                  titleEn: 'Ready!',
                  descAr: 'شاهد رصيدك وصحتك المالية ومصروفات اليوم في أي لحظة.',
                  descEn: 'View your net balance, health score, and today spend in real time.',
                },
              ].map(item => (
                <View key={item.step} style={styles.stepItem}>
                  <View style={[styles.stepBadge, { backgroundColor: '#3B82F6' }]}>
                    <Text style={styles.stepBadgeText}>{item.step}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>
                      {isAr ? item.titleAr : item.titleEn}
                    </Text>
                    <Text style={styles.stepDesc}>
                      {isAr ? item.descAr : item.descEn}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(colors: any, theme: string) {
  const isDark = theme === 'dark';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.cardBackground,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: colors.text,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontFamily: 'Cairo_500Medium',
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 2,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    sizeTabsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    sizeTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sizeTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sizeTabText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    sizeTabTextActive: {
      color: '#FFF',
      fontFamily: 'Cairo_700Bold',
    },
    previewSection: {
      marginBottom: 24,
      alignItems: 'center',
    },
    previewSectionLabel: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
      marginBottom: 12,
      alignSelf: 'flex-start',
    },
    smallWidgetCard: {
      width: 170,
      height: 170,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: 'rgba(16, 185, 129, 0.4)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },
    mediumWidgetCard: {
      width: '100%',
      height: 155,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: 'rgba(0, 230, 118, 0.3)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
    },
    lockscreenWidgetCard: {
      width: '100%',
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockscreenPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(0,0,0,0.75)',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    lockscreenText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#FFF',
    },
    lockscreenDivider: {
      width: 1,
      height: 14,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    lockscreenSubtext: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: '#00E676',
    },
    widgetGradient: {
      flex: 1,
      padding: 14,
      justifyContent: 'space-between',
    },
    widgetTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    walletBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.08)',
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 8,
      maxWidth: '65%',
    },
    walletBadgeText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: '#FFF',
    },
    healthScoreBadge: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 6,
      borderWidth: 1,
    },
    healthScoreText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
    },
    widgetBalanceLabel: {
      fontFamily: 'Cairo_500Medium',
      fontSize: 10,
      color: 'rgba(255,255,255,0.7)',
    },
    smallWidgetCenter: {
      marginVertical: 4,
    },
    smallWidgetBalance: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 17,
      color: '#FFF',
      marginTop: 1,
    },
    smallWidgetBottom: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.15)',
      paddingTop: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    smallWidgetTodayLabel: {
      fontFamily: 'Cairo_500Medium',
      fontSize: 10,
      color: 'rgba(255,255,255,0.6)',
    },
    smallWidgetTodayValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
      color: '#FF6B6B',
    },
    mediumWidgetStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    healthIndicatorDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    healthStatusLabel: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
    },
    mediumMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 4,
    },
    mediumWidgetBalance: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 20,
      color: '#FFF',
      marginTop: 2,
    },
    mediumStatsBox: {
      flexDirection: 'row',
      gap: 12,
    },
    mediumStatItem: {
      alignItems: 'flex-end',
    },
    mediumStatLabel: {
      fontFamily: 'Cairo_500Medium',
      fontSize: 10,
      color: 'rgba(255,255,255,0.7)',
    },
    mediumStatValueRed: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: '#FF6B6B',
    },
    mediumStatValueGreen: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: '#00E676',
    },
    mediumWidgetFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.15)',
      paddingTop: 6,
    },
    mediumFooterText: {
      flex: 1,
      fontFamily: 'Cairo_500Medium',
      fontSize: 10,
      color: 'rgba(255,255,255,0.85)',
    },
    copyPayloadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      width: '100%',
    },
    copyPayloadBtnText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.primary,
    },
    guideSection: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    guideSectionTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
      marginBottom: 12,
    },
    osTabsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    osTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    osTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    osTabText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    osTabTextActive: {
      color: '#FFF',
      fontFamily: 'Cairo_700Bold',
    },
    stepsContainer: {
      gap: 14,
    },
    stepItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    stepBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    stepBadgeText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: '#FFF',
    },
    stepTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
    },
    stepDesc: {
      fontFamily: 'Cairo_500Medium',
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },
  });
}
