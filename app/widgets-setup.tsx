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
import { getWidgetData, exportWidgetNativePayload } from '@/lib/widgetDataProvider';
import { getGoals, SavingsGoal } from '@/lib/goalStorage';
import { getDebts, Debt } from '@/lib/debtStorage';

type WidgetType = 'quick_glance' | 'savings_goal' | 'cashflow_forecast' | 'health_score' | 'pending_bills';

export default function WidgetsSetupScreen() {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const styles = useMemo(() => getStyles(colors, isAr), [colors, isAr]);
  const { transactions, wallets, selectedWallet, balance, pendingRecurring, currencySymbol } = useTransactions();

  // Selected widget options
  const [selectedWidgetType, setSelectedWidgetType] = useState<WidgetType>('quick_glance');
  const [selectedWidgetSize, setSelectedWidgetSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  // Widget visibility toggles for home screen
  const [showQuickGlance, setShowQuickGlance] = useState(true);
  const [showGoalWidget, setShowGoalWidget] = useState(true);
  const [showForecastWidget, setShowForecastWidget] = useState(true);
  const [showHealthWidget, setShowHealthWidget] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [gList, dList, configStr] = await Promise.all([
          getGoals(),
          getDebts(),
          AsyncStorage.getItem('@mizan_widget_config')
        ]);
        setGoals(gList);
        setDebts(dList);

        if (configStr) {
          const cfg = JSON.parse(configStr);
          if (cfg.showQuickGlance !== undefined) setShowQuickGlance(cfg.showQuickGlance);
          if (cfg.showGoalWidget !== undefined) setShowGoalWidget(cfg.showGoalWidget);
          if (cfg.showForecastWidget !== undefined) setShowForecastWidget(cfg.showForecastWidget);
          if (cfg.showHealthWidget !== undefined) setShowHealthWidget(cfg.showHealthWidget);
        }
      } catch (e) {
        console.error('Error loading widget config:', e);
      }
    }
    loadData();
  }, []);

  const saveWidgetVisibility = async (key: string, val: boolean) => {
    try { Haptics.selectionAsync(); } catch {}
    const updated = {
      showQuickGlance: key === 'quick' ? val : showQuickGlance,
      showGoalWidget: key === 'goal' ? val : showGoalWidget,
      showForecastWidget: key === 'forecast' ? val : showForecastWidget,
      showHealthWidget: key === 'health' ? val : showHealthWidget,
    };
    if (key === 'quick') setShowQuickGlance(val);
    if (key === 'goal') setShowGoalWidget(val);
    if (key === 'forecast') setShowForecastWidget(val);
    if (key === 'health') setShowHealthWidget(val);

    await AsyncStorage.setItem('@mizan_widget_config', JSON.stringify(updated));
  };

  // Base widget data
  const widgetData = useMemo(() => {
    return getWidgetData(
      transactions,
      wallets,
      selectedWallet,
      85,
      {},
      selectedWallet?.currency || 'EGP'
    );
  }, [transactions, wallets, selectedWallet]);

  const activeGoal = goals[0];
  const payload = exportWidgetNativePayload(widgetData);

  const copyPayload = async () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    const updated = {
      showQuickGlance,
      showGoalWidget,
      showForecastWidget,
      showHealthWidget,
      selectedWidgetType,
      selectedWidgetSize,
      lastSynced: new Date().toISOString(),
    };
    await AsyncStorage.setItem('@mizan_widget_config', JSON.stringify(updated));
    await Clipboard.setStringAsync(payload);
    Alert.alert(
      isAr ? 'تم الحفظ والمزامنة بنجاح' : 'Widget Synced & Saved',
      isAr
        ? 'تمت مزامنة وتطبيق إعدادات الودجت التفاعلية فوراً على التطبيق وهاتفك!'
        : 'Live widget settings saved successfully!'
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

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={handleGoBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isAr ? 'إعدادات وودجت الشاشة' : 'Widgets & Dashboard'}
        </Text>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="close-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Banner Card */}
        <View style={styles.infoCard}>
          <LinearGradient
            colors={[colors.primary + '20', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.heroBadgeIcon}>
            <Ionicons name="hardware-chip-outline" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>
              {isAr ? 'تخصيص الودجت والشاشة الرئيسية' : 'Customize Widgets & Dashboard'}
            </Text>
            <Text style={styles.infoSub}>
              {isAr
                ? 'تحكم في العناصر التفاعلية الظاهرة داخل التطبيق وعرض الميزانية والسيولة على شاشة هاتفك.'
                : 'Manage dashboard widgets inside the app and set up phone home screen widgets.'}
            </Text>
          </View>
        </View>

        {/* SECTION 1: Home Dashboard Widgets Toggle */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="options-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>
              {isAr ? '1. التحكم في ودجات الشاشة الرئيسية' : '1. App Home Screen Widgets'}
            </Text>
          </View>
          <Text style={styles.cardSub}>
            {isAr ? 'اختر العناصر التي تريد إظهارها على الشاشة الرئيسية للتطبيق:' : 'Select which widgets to show on app dashboard:'}
          </Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleLabel}>{isAr ? 'اللمحة السريعة والمصروفات' : 'Quick Glance Widget'}</Text>
              <Text style={styles.toggleDesc}>{isAr ? 'عرض رصيد المحفظة ومصروف اليوم' : 'Show wallet balance & today spending'}</Text>
            </View>
            <Switch
              value={showQuickGlance}
              onValueChange={(val) => saveWidgetVisibility('quick', val)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleLabel}>{isAr ? 'هدف الادخار المالي' : 'Savings Goal Widget'}</Text>
              <Text style={styles.toggleDesc}>{isAr ? 'تتبع التقدم في هدف الادخار الأهم' : 'Track progress of main savings goal'}</Text>
            </View>
            <Switch
              value={showGoalWidget}
              onValueChange={(val) => saveWidgetVisibility('goal', val)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleLabel}>{isAr ? 'التنبؤ بالسيولة القادمة' : 'Cashflow Forecast Widget'}</Text>
              <Text style={styles.toggleDesc}>{isAr ? 'توقعات التدفق النقدي نهاية الشهر' : 'Projected cashflow at month end'}</Text>
            </View>
            <Switch
              value={showForecastWidget}
              onValueChange={(val) => saveWidgetVisibility('forecast', val)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleLabel}>{isAr ? 'مؤشر الصحة المالية' : 'Financial Health Score'}</Text>
              <Text style={styles.toggleDesc}>{isAr ? 'تقييم نسبة الإنفاق من الدخل' : 'Health score based on savings ratio'}</Text>
            </View>
            <Switch
              value={showHealthWidget}
              onValueChange={(val) => saveWidgetVisibility('health', val)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        {/* SECTION 2: Native Phone Widget Selector */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>
              {isAr ? '2. إعداد ومعاينة ودجت الهاتف الحي' : '2. Phone Home Screen Widget'}
            </Text>
          </View>

          {/* Widget Type Selector Chips */}
          <Text style={styles.subHeaderLabel}>{isAr ? 'نوع الودجت:' : 'Widget Type:'}</Text>
          <View style={styles.chipGrid}>
            {[
              { id: 'quick_glance', icon: 'flash-outline', labelAr: 'اللمحة والعمليات', labelEn: 'Quick Glance', color: '#10B981' },
              { id: 'savings_goal', icon: 'trophy-outline', labelAr: 'أهداف الادخار', labelEn: 'Savings Goal', color: '#F59E0B' },
              { id: 'cashflow_forecast', icon: 'trending-up-outline', labelAr: 'تنبؤ السيولة', labelEn: 'Cashflow', color: '#3B82F6' },
              { id: 'health_score', icon: 'heart-outline', labelAr: 'الصحة المالية', labelEn: 'Health Score', color: '#EC4899' },
            ].map(item => {
              const isActive = selectedWidgetType === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    try { Haptics.selectionAsync(); } catch {}
                    setSelectedWidgetType(item.id as WidgetType);
                  }}
                  style={[
                    styles.typeGridBtn,
                    isActive && { backgroundColor: item.color + '18', borderColor: item.color, borderWidth: 1.5 }
                  ]}
                >
                  <Ionicons name={item.icon as any} size={18} color={isActive ? item.color : colors.textSecondary} />
                  <Text style={[styles.typeGridText, isActive && { color: item.color, fontFamily: 'Cairo_700Bold' }]}>
                    {isAr ? item.labelAr : item.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Size Selector Buttons */}
          <Text style={[styles.subHeaderLabel, { marginTop: 16 }]}>{isAr ? 'أبعاد الودجت:' : 'Widget Size:'}</Text>
          <View style={styles.sizeRow}>
            {(['small', 'medium', 'large'] as const).map(sz => (
              <Pressable
                key={sz}
                onPress={() => {
                  try { Haptics.selectionAsync(); } catch {}
                  setSelectedWidgetSize(sz);
                }}
                style={[
                  styles.sizeBtn,
                  selectedWidgetSize === sz && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                ]}
              >
                <Text style={[styles.sizeBtnText, selectedWidgetSize === sz && { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>
                  {sz === 'small' ? (isAr ? 'صغير (2×2)' : 'Small (2×2)') :
                   sz === 'medium' ? (isAr ? 'متوسط (4×2)' : 'Medium (4×2)') :
                   (isAr ? 'كبير (4×4)' : 'Large (4×4)')}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* SECTION 3: Live Preview Box */}
          <Text style={[styles.subHeaderLabel, { marginTop: 18 }]}>{isAr ? 'المعاينة التفاعلية الحية:' : 'Live Preview:'}</Text>

          <View style={[
            styles.previewBox,
            selectedWidgetSize === 'small' && { width: '60%', alignSelf: 'center' },
          ]}>
            {/* Header of Preview */}
            <View style={styles.previewHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="account-balance-wallet" size={18} color={colors.primary} />
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {selectedWallet?.name || (isAr ? 'محفظتي الرئيسية' : 'Main Wallet')}
                </Text>
              </View>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{isAr ? 'حي' : 'LIVE'}</Text>
              </View>
            </View>

            {/* Preview Content based on selected type */}
            {selectedWidgetType === 'quick_glance' && (
              <View style={styles.previewContent}>
                <Text style={styles.previewLabel}>{isAr ? 'الرصيد المتاح' : 'Available Balance'}</Text>
                <Text style={styles.previewBalance}>
                  {formatCurrency(balance)} {currencySymbol}
                </Text>

                {selectedWidgetSize !== 'small' && (
                  <View style={styles.previewRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewSubLabel}>{isAr ? 'مصروف اليوم' : 'Today Spent'}</Text>
                      <Text style={[styles.previewSubVal, { color: colors.expense }]}>
                        {formatCurrency(widgetData.todaySpent)} {currencySymbol}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: isAr ? 'flex-start' : 'flex-end' }}>
                      <Text style={styles.previewSubLabel}>{isAr ? 'الصحة المالية' : 'Health Score'}</Text>
                      <Text style={[styles.previewSubVal, { color: colors.income }]}>85/100</Text>
                    </View>
                  </View>
                )}

                <View style={styles.previewActions}>
                  <View style={[styles.pBtn, { backgroundColor: colors.expense + '20' }]}>
                    <Ionicons name="remove-circle-outline" size={14} color={colors.expense} />
                    <Text style={[styles.pBtnText, { color: colors.expense }]}>{isAr ? 'مصروف' : 'Expense'}</Text>
                  </View>
                  <View style={[styles.pBtn, { backgroundColor: colors.income + '20' }]}>
                    <Ionicons name="add-circle-outline" size={14} color={colors.income} />
                    <Text style={[styles.pBtnText, { color: colors.income }]}>{isAr ? 'دخل' : 'Income'}</Text>
                  </View>
                </View>
              </View>
            )}

            {selectedWidgetType === 'savings_goal' && (
              <View style={styles.previewContent}>
                <Text style={styles.previewLabel}>{activeGoal?.name || (isAr ? 'هدف الادخار الأهم' : 'Savings Goal')}</Text>
                <Text style={styles.previewBalance}>
                  {activeGoal ? formatCurrency(activeGoal.savedAmount) : formatCurrency(500)} / {activeGoal ? formatCurrency(activeGoal.targetAmount) : formatCurrency(1000)} {currencySymbol}
                </Text>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: activeGoal ? `${Math.min(100, (activeGoal.savedAmount / activeGoal.targetAmount) * 100)}%` : '50%' }]} />
                </View>
              </View>
            )}

            {selectedWidgetType === 'cashflow_forecast' && (
              <View style={styles.previewContent}>
                <Text style={styles.previewLabel}>{isAr ? 'الرصيد المتوقع نهاية الشهر' : 'Projected End Balance'}</Text>
                <Text style={[styles.previewBalance, { color: '#3B82F6' }]}>
                  {formatCurrency(balance * 1.15)} {currencySymbol}
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.income, marginTop: 4 }}>
                  {isAr ? '📈 سيولة آمنة ومستقرة' : '📈 Safe & stable cashflow'}
                </Text>
              </View>
            )}

            {selectedWidgetType === 'health_score' && (
              <View style={styles.previewContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreText}>85</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text, textAlign: isAr ? 'left' : 'right' }}>
                      {isAr ? 'وضع مالي ممتاز' : 'Excellent Financial Health'}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: isAr ? 'left' : 'right' }}>
                      {isAr ? 'نسبة ادخارك أعلى من 30%' : 'Savings ratio above 30%'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Sync Button */}
          <Pressable onPress={copyPayload} style={styles.saveBtn}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
            <Text style={styles.saveBtnText}>
              {isAr ? 'مزامنة وحفظ الإعدادات' : 'Sync & Save Settings'}
            </Text>
          </Pressable>
        </View>
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
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  cardSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: isAr ? 'left' : 'right',
    marginBottom: 12,
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
  subHeaderLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
    textAlign: isAr ? 'left' : 'right',
    marginBottom: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeGridBtn: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeGridText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  previewBox: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    marginTop: 4,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: 8,
  },
  previewTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  liveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 9,
    color: colors.primary,
  },
  previewContent: {
    gap: 6,
  },
  previewLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: isAr ? 'left' : 'right',
  },
  previewBalance: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
    textAlign: isAr ? 'left' : 'right',
  },
  previewRow: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  previewSubLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textTertiary,
  },
  previewSubVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  previewActions: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    gap: 8,
    marginTop: 8,
  },
  pBtn: {
    flex: 1,
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  progressBg: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  scoreBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EC489918',
    borderWidth: 2,
    borderColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#EC4899',
  },
  saveBtn: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
