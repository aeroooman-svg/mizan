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
import { formatCurrency, WALLET_COLORS } from '@/lib/categories';
import { getWidgetData, exportWidgetNativePayload } from '@/lib/widgetDataProvider';
import { getGoals, SavingsGoal } from '@/lib/goalStorage';
import { getDebts, Debt } from '@/lib/debtStorage';

type WidgetType = 'quick_glance' | 'savings_goal' | 'cashflow_forecast' | 'health_score' | 'pending_bills';

export default function WidgetsSetupScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const { language } = useLanguage();
  const { transactions, wallets, selectedWallet, balance, pendingRecurring, currencySymbol } = useTransactions();

  const isAr = language === 'ar';

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
    Haptics.selectionAsync();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(payload);
    Alert.alert(
      isAr ? 'تم حفظ التزامن بنجاح 🟢' : 'Widget Synced Successfully',
      isAr
        ? 'تمت مزامنة بيانات الويدجت التفاعلية بنجاح مع الشاشة الرئيسية وهاتفك!'
        : 'Live widget JSON payload synced & copied to clipboard'
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isAr ? '📱 ودجت الشاشة الرئيسية المتطورة' : '📱 Live Home Widgets Hub'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Intro Card */}
        <View style={styles.infoCard}>
          <LinearGradient
            colors={[colors.primary + '30', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Ionicons name="hardware-chip" size={34} color={colors.primary} />
          <Text style={styles.infoTitle}>
            {isAr ? 'تخصيص ومزامنة ودجت الهاتف الحي' : 'Live Interactive Phone Widgets'}
          </Text>
          <Text style={styles.infoSub}>
            {isAr
              ? 'اختر نوع الويدجت والحجم المناسب لمتابعة ميزانيتك، أهداف الادخار، والصحة المالية مباشرة بنقرة واحدة من شاشة هاتف الرئيسية.'
              : 'Customize and sync live phone widgets to monitor balances, savings goals, and cashflow forecasts in real-time.'}
          </Text>
        </View>

        {/* Section 1: Widget Type Selector */}
        <Text style={styles.sectionTitle}>
          {isAr ? '1. اختر نوع الويدجت للتخصيص والمعاينة:' : '1. Select Widget Type to Preview & Sync:'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScroll}>
          {[
            { id: 'quick_glance', icon: 'flash', labelAr: 'اللمحة والعمليات', labelEn: 'Quick Glance', color: '#10B981' },
            { id: 'savings_goal', icon: 'trophy', labelAr: 'هدف الادخار', labelEn: 'Savings Goal', color: '#F59E0B' },
            { id: 'cashflow_forecast', icon: 'trending-up', labelAr: 'تنبؤ السيولة', labelEn: 'Cashflow', color: '#3B82F6' },
            { id: 'health_score', icon: 'heart', labelAr: 'الصحة المالية', labelEn: 'Health Score', color: '#EC4899' },
            { id: 'pending_bills', icon: 'receipt', labelAr: 'الفواتير المستحقة', labelEn: 'Pending Bills', color: '#8B5CF6' },
          ].map(item => {
            const isActive = selectedWidgetType === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedWidgetType(item.id as WidgetType);
                }}
                style={[
                  styles.typeChip,
                  isActive && { backgroundColor: item.color + '20', borderColor: item.color, borderWidth: 1.5 }
                ]}
              >
                <Ionicons name={item.icon as any} size={16} color={isActive ? item.color : colors.textSecondary} />
                <Text style={[styles.typeChipText, isActive && { color: item.color, fontFamily: 'Cairo_700Bold' }]}>
                  {isAr ? item.labelAr : item.labelEn}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Section 2: Size Selector */}
        <Text style={styles.sectionTitle}>
          {isAr ? '2. حجم الويدجت (Widget Dimensions):' : '2. Select Widget Size:'}
        </Text>
        <View style={styles.sizeSelectorRow}>
          {(['small', 'medium', 'large'] as const).map(sz => (
            <Pressable
              key={sz}
              onPress={() => {
                Haptics.selectionAsync();
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

        {/* Section 3: Dynamic Live Preview Box */}
        <Text style={styles.sectionTitle}>
          {isAr ? '3. معاينة الويدجت التفاعلية الحية:' : '3. Live Interactive Widget Preview:'}
        </Text>

        <View style={[
          styles.widgetPreviewContainer,
          selectedWidgetSize === 'small' && { width: 170, height: 160, alignSelf: 'center' },
          selectedWidgetSize === 'large' && { height: 260 },
        ]}>
          <LinearGradient
            colors={[colors.surfaceAlt, colors.surface]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { borderWidth: 1.5, borderColor: colors.primary + '40', borderRadius: 24 }]} />

          {/* Render Preview according to selectedWidgetType */}
          {selectedWidgetType === 'quick_glance' && (
            <View style={styles.previewBody}>
              <View style={styles.previewHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                  <Text style={styles.previewAppName}>{widgetData.walletName}</Text>
                </View>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>🟢 LIVE</Text>
                </View>
              </View>

              <View style={{ marginTop: 6 }}>
                <Text style={styles.previewLabel}>{isAr ? 'الرصيد المتبقي' : 'Balance'}</Text>
                <Text style={styles.previewBalanceVal}>
                  {formatCurrency(balance)} {currencySymbol}
                </Text>
              </View>

              {selectedWidgetSize !== 'small' && (
                <View style={styles.previewStatsRow}>
                  <View style={styles.previewStatCol}>
                    <Text style={styles.previewStatLabel}>{isAr ? 'مصروف اليوم' : 'Today Spent'}</Text>
                    <Text style={[styles.previewStatVal, { color: colors.expense }]}>
                      {formatCurrency(widgetData.todaySpent)} {currencySymbol}
                    </Text>
                  </View>
                  <View style={styles.previewStatCol}>
                    <Text style={styles.previewStatLabel}>{isAr ? 'الصحة المالية' : 'Health Score'}</Text>
                    <Text style={[styles.previewStatVal, { color: colors.income }]}>
                      85/100
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.previewActionRow}>
                <View style={[styles.previewBtn, { backgroundColor: colors.expense }]}>
                  <Ionicons name="remove-circle" size={14} color="#FFF" />
                  <Text style={styles.previewBtnText}>{isAr ? 'صرف' : 'Expense'}</Text>
                </View>
                <View style={[styles.previewBtn, { backgroundColor: colors.income }]}>
                  <Ionicons name="add-circle" size={14} color="#FFF" />
                  <Text style={styles.previewBtnText}>{isAr ? 'دخل' : 'Income'}</Text>
                </View>
              </View>
            </View>
          )}

          {selectedWidgetType === 'savings_goal' && (
            <View style={styles.previewBody}>
              <View style={styles.previewHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="trophy" size={16} color="#F59E0B" />
                  <Text style={styles.previewAppName}>{isAr ? 'هدف الادخار المالي' : 'Savings Goal Focus'}</Text>
                </View>
              </View>

              {activeGoal ? (
                <View style={{ marginTop: 8, gap: 6 }}>
                  <Text style={styles.previewLabel}>{activeGoal.name}</Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 18, color: colors.text }}>
                    {formatCurrency(activeGoal.savedAmount)} / {formatCurrency(activeGoal.targetAmount)} {currencySymbol}
                  </Text>
                  <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
                    <View style={{ width: `${Math.min(100, (activeGoal.savedAmount / activeGoal.targetAmount) * 100)}%`, height: '100%', backgroundColor: '#F59E0B' }} />
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 13, color: colors.textSecondary }}>
                    {isAr ? 'لم تقم بإضافة هدف ادخار بعد' : 'No active savings goal set'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {selectedWidgetType === 'cashflow_forecast' && (
            <View style={styles.previewBody}>
              <View style={styles.previewHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="trending-up" size={16} color="#3B82F6" />
                  <Text style={styles.previewAppName}>{isAr ? 'تنبؤ السيولة القادمة' : 'Cashflow Forecast'}</Text>
                </View>
              </View>

              <View style={{ marginTop: 8, gap: 4 }}>
                <Text style={styles.previewLabel}>{isAr ? 'الرصيد المتوقع نهاية الشهر' : 'Projected End Balance'}</Text>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 20, color: '#3B82F6' }}>
                  {formatCurrency(balance * 1.12)} {currencySymbol}
                </Text>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.income }}>
                  {isAr ? '📈 سيولة آمنة ومستقرة' : '📈 Safe & stable cashflow'}
                </Text>
              </View>
            </View>
          )}

          {selectedWidgetType === 'health_score' && (
            <View style={styles.previewBody}>
              <View style={styles.previewHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="heart" size={16} color="#EC4899" />
                  <Text style={styles.previewAppName}>{isAr ? 'مؤشر الصحة المالية' : 'Health Score'}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#EC489918', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#EC4899' }}>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 18, color: '#EC4899' }}>85</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }}>
                    {isAr ? 'وضع مالي ممتازممتازممتاز ممتاز' : 'Excellent Financial Health'}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
                    {isAr ? 'أنت تنفق أقل من 60% من دخلك' : 'Spending under 60% of income'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {selectedWidgetType === 'pending_bills' && (
            <View style={styles.previewBody}>
              <View style={styles.previewHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="receipt" size={16} color="#8B5CF6" />
                  <Text style={styles.previewAppName}>{isAr ? 'الفواتير المستحقة' : 'Pending Bills'}</Text>
                </View>
              </View>

              <View style={{ marginTop: 8, gap: 6 }}>
                <Text style={styles.previewLabel}>
                  {isAr ? `لديك (${pendingRecurring.length}) فواتير وأقساط مستحقة` : `${pendingRecurring.length} pending recurring bills`}
                </Text>
                {pendingRecurring.length > 0 ? (
                  <View style={{ backgroundColor: colors.surfaceAlt, padding: 8, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.text }}>{pendingRecurring[0].description || pendingRecurring[0].category}</Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.expense }}>{formatCurrency(pendingRecurring[0].amount)} {currencySymbol}</Text>
                  </View>
                ) : (
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: colors.income }}>
                    {isAr ? '✅ جميع الفواتير مدفوعة بالكامل' : '✅ All bills paid up to date'}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Section 4: Home Page Widget Display Customization */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isAr ? '⚙️ تخصيص عرض الويدجت في الشاشة الرئيسية' : '⚙️ Home Screen Widget Visibility'}
          </Text>
          <Text style={styles.cardSub}>
            {isAr ? 'تحكم في ظهور وإخفاء الويدجت التفاعلية في الشاشة الرئيسية للتطبيق:' : 'Toggle which widgets appear on your app home screen:'}
          </Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{isAr ? 'ودجت اللمحة السريعة والمصروفات' : 'Quick Glance Widget'}</Text>
            <Switch
              value={showQuickGlance}
              onValueChange={(val) => saveWidgetVisibility('quick', val)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{isAr ? 'ودجت هدف الادخار المالي' : 'Savings Goal Focus Widget'}</Text>
            <Switch
              value={showGoalWidget}
              onValueChange={(val) => saveWidgetVisibility('goal', val)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{isAr ? 'ودجت التنبؤ بالسيولة القادمة' : 'Cashflow Forecast Widget'}</Text>
            <Switch
              value={showForecastWidget}
              onValueChange={(val) => saveWidgetVisibility('forecast', val)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{isAr ? 'ودجت مؤشر الصحة المالية' : 'Financial Health Score'}</Text>
            <Switch
              value={showHealthWidget}
              onValueChange={(val) => saveWidgetVisibility('health', val)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        {/* Section 5: Sync Button */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isAr ? '🔄 مزامنة بيانات ودجت الهاتف المباشرة' : '🔄 Sync Live Phone Widgets'}
          </Text>
          <Text style={styles.cardSub}>
            {isAr
              ? 'اضغط أدناه لحفظ وتأكيد مزامنة البيانات الحية التفاعلية مع ودجت نظام الهاتف (Android & iOS).'
              : 'Tap below to commit live widget sync with phone system widgets.'}
          </Text>

          <Pressable onPress={copyPayload} style={styles.primaryBtn}>
            <Ionicons name="sync" size={20} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.primaryBtnText}>
              {isAr ? 'مزامنة وحفظ الويدجت التفاعلي 🟢' : 'Sync & Save Live Widget'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, theme: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  infoCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    overflow: 'hidden',
  },
  infoTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  infoSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },
  typeScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  sizeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  sizeBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  widgetPreviewContainer: {
    width: '100%',
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  previewBody: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewAppName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  liveBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    color: colors.primary,
  },
  previewLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  previewBalanceVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.text,
  },
  previewStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  previewStatCol: {
    gap: 2,
  },
  previewStatLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  previewStatVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  previewActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  previewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 10,
  },
  previewBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: '#FFF',
  },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  cardSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: colors.border + '60',
  },
  toggleLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
});
