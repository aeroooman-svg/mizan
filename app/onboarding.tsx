import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTransactions } from '@/lib/TransactionContext';
import { CurrencyCode, CURRENCIES } from '@/lib/storage';
import { normalizeAmountInput } from '@/lib/arabicNumbers';
import { scheduleWeeklyDigestNotification, scheduleDailyReminder } from '@/lib/NotificationService';

const { width } = Dimensions.get('window');

type OnboardingStep = 'slides' | 'goal' | 'currency' | 'income';

const CURRENCY_OPTIONS: { code: CurrencyCode; flag: string; nameAr: string; nameEn: string }[] = [
  { code: 'EGP', flag: '🇪🇬', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound' },
  { code: 'SAR', flag: '🇸🇦', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal' },
  { code: 'AED', flag: '🇦🇪', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham' },
  { code: 'KWD', flag: '🇰🇼', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar' },
  { code: 'USD', flag: '🇺🇸', nameAr: 'دولار أمريكي', nameEn: 'US Dollar' },
  { code: 'EUR', flag: '🇪🇺', nameAr: 'يورو', nameEn: 'Euro' },
  { code: 'GBP', flag: '🇬🇧', nameAr: 'جنيه إسترليني', nameEn: 'British Pound' },
  { code: 'QAR', flag: '🇶🇦', nameAr: 'ريال قطري', nameEn: 'Qatari Riyal' },
  { code: 'BHD', flag: '🇧🇭', nameAr: 'دينار بحريني', nameEn: 'Bahraini Dinar' },
  { code: 'OMR', flag: '🇴🇲', nameAr: 'ريال عماني', nameEn: 'Omani Rial' },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguage();
  const { wallets, addWallet } = useTransactions();
  const isAr = language === 'ar';

  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('slides');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('EGP');
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const slides = [
    {
      id: '1',
      icon: 'wallet',
      iconColor: '#10B981',
      titleAr: 'تتبع ذكي ومحافظ متعددة العملات',
      titleEn: 'Smart Multi-Currency Tracking',
      descAr: 'أدر إجمالي أموالك ومحافظك بسهولة بالعملات المختلفة (ج.م، د.ك، $) وتابع مصاريفك ونفقاتك اليومية بنقرة واحدة.',
      descEn: 'Manage all your wallets across multiple currencies (EGP, KWD, USD) and log expenses effortlessly in real-time.',
    },
    {
      id: '2',
      icon: 'trending-up',
      iconColor: '#6366F1',
      titleAr: 'تخطيط مالي وتوقعات مستقبلية',
      titleEn: 'Financial Planning & Cashflow AI',
      descAr: 'قم بضبط ميزانيتك بذكاء وفق قاعدة 50/30/20 وتوقع تدفقاتك النقدية ومعدل ادخارك لعدة سنوات قادمة.',
      descEn: 'Structure your monthly budget using the 50/30/20 rule and forecast cashflows & savings goals for years ahead.',
    },
    {
      id: '3',
      icon: 'calculator',
      iconColor: '#F59E0B',
      titleAr: 'حاسبة الزكاة وإدارة الديون',
      titleEn: 'Zakat Calculator & Debt Manager',
      descAr: 'احسب زكاة مالك بدقة بشرعية ميسرة، وتابع ديونك والتزاماتك واقبل التحديات المالية اليومية للادخار.',
      descEn: 'Calculate Zakat with ease, track personal debts and loans, and master daily financial savings challenges.',
    },
  ];

  const goals = [
    {
      id: 'saving',
      icon: 'shield-checkmark',
      color: '#10B981',
      titleAr: '🎯 توفير المال وبناء صندوق طوارئ',
      titleEn: '🎯 Build Savings & Emergency Fund',
    },
    {
      id: 'debts',
      icon: 'card',
      color: '#EF4444',
      titleAr: '💳 سداد الديون والالتزامات بذكاء',
      titleEn: '💳 Pay Off Debts & Obligations',
    },
    {
      id: 'tracking',
      icon: 'pie-chart',
      color: '#6366F1',
      titleAr: '📊 تنظيم المصاريف ومعرفة أين تذهب الأموال',
      titleEn: '📊 Organize Expenses & Daily Cashflow',
    },
  ];

  // Step indicator: slides(1) → goal(2) → currency(3) → income(4)
  const stepNumber = currentStep === 'slides' ? 1 : currentStep === 'goal' ? 2 : currentStep === 'currency' ? 3 : 4;
  const totalSteps = 4;

  const handleGoToSlide = (index: number) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveIndex(index);
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const handleNext = () => {
    Haptics.selectionAsync().catch(() => {});
    if (activeIndex < slides.length - 1) {
      const nextIndex = activeIndex + 1;
      setActiveIndex(nextIndex);
      scrollViewRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    } else {
      setCurrentStep('goal');
    }
  };

  const handleGoalNext = () => {
    Haptics.selectionAsync().catch(() => {});
    setCurrentStep('currency');
  };

  const handleCurrencyNext = () => {
    Haptics.selectionAsync().catch(() => {});
    setCurrentStep('income');
  };

  const handleToggleLanguage = async () => {
    Haptics.selectionAsync().catch(() => {});
    const newLang = language === 'ar' ? 'en' : 'ar';
    await setLanguage(newLang);
  };

  const handleCompleteOnboarding = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await AsyncStorage.setItem('@mizan_onboarding_completed', 'true');
      const goalToSave = selectedGoal || 'saving';
      await AsyncStorage.setItem('@mizan_user_goal', goalToSave);

      // Save monthly income for smart advisor
      const incomeValue = parseFloat(normalizeAmountInput(monthlyIncomeInput)) || 0;
      if (incomeValue > 0) {
        await AsyncStorage.setItem('@mizan_monthly_income', String(incomeValue));
      }

      const targetWalletId = wallets.length > 0 ? wallets[0].id : undefined;
      const nowStr = new Date().toISOString();

      if (targetWalletId) {
        // Goal 1: Build Savings & Emergency Fund
        if (goalToSave === 'saving') {
          const { getGoals, saveGoal } = await import('@/lib/goalStorage');
          const currentGoals = await getGoals();
          if (currentGoals.length === 0) {
            await saveGoal({
              id: String(Date.now()),
              walletId: targetWalletId,
              name: isAr ? '🎯 صندوق الطوارئ والادخار' : '🎯 Emergency Savings Fund',
              targetAmount: incomeValue > 0 ? Math.round(incomeValue * 3) : 1000,
              savedAmount: 0,
              deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: nowStr,
            });
          }
        } 
        // Goal 2: Pay Off Debts & Obligations
        else if (goalToSave === 'debts') {
          const { getDebts, saveDebt } = await import('@/lib/debtStorage');
          const currentDebts = await getDebts();
          if (currentDebts.length === 0) {
            await saveDebt({
              id: String(Date.now()),
              walletId: targetWalletId,
              personName: isAr ? 'خطة سداد الديون والالتزامات' : 'Debt Payoff Target Plan',
              type: 'debt_to_others',
              amount: 500,
              paidAmount: 0,
              status: 'pending',
              dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
              description: isAr ? 'تم إنشاؤها تلقائياً بناءً على هدفك المالي المقترح' : 'Auto-created based on your selected financial goal',
              createdAt: nowStr,
            });
          }
        }
        // Goal 3: Organize Expenses & Kakeibo Budgeting
        else if (goalToSave === 'tracking') {
          const { getFinancialPlan, saveFinancialPlan } = await import('@/lib/planStorage');
          const currentPlan = await getFinancialPlan(targetWalletId);
          if (!currentPlan) {
            const mi = incomeValue > 0 ? incomeValue : 1000;
            const me = Math.round(mi * 0.7);
            const ms = Math.round(mi * 0.3);
            const currInfo = CURRENCIES.find(c => c.code === selectedCurrency);
            await saveFinancialPlan({
              id: String(Date.now()),
              walletId: targetWalletId,
              goalName: isAr ? '📊 تنظيم وتتبع المصاريف (Kakeibo)' : '📊 Kakeibo Budget Organizer Plan',
              durationMonths: 12,
              monthlyIncome: mi,
              monthlyExpense: me,
              monthlySaving: ms,
              savingsGoal: ms * 12,
              currency: selectedCurrency,
              currencySymbol: currInfo?.symbol || 'ج.م',
              createdAt: nowStr,
              isKakeiboEnabled: true,
              kakeiboBudgets: {
                survival: Math.round(me * 0.5),
                wants: Math.round(me * 0.3),
                culture: Math.round(me * 0.1),
                extra: Math.round(me * 0.1),
              },
            });
          }
        }
      }

      // Schedule smart notifications
      try {
        await scheduleDailyReminder(21, 0);
        await scheduleWeeklyDigestNotification();
      } catch {}
    } catch (e) {
      console.error('Error completing onboarding setup:', e);
    }

    if (wallets.length === 0) {
      router.replace('/add-wallet');
    } else {
      router.replace('/(tabs)');
    }
  };

  // Get currency symbol for display
  const selectedCurrencyInfo = CURRENCY_OPTIONS.find(c => c.code === selectedCurrency);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header with Language Switcher & Skip */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.brandRow}>
          <Text style={[styles.brandTitle, { color: colors.primary }]}>ميزان MIZAN</Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* Language Switcher Button */}
          <Pressable
            onPress={handleToggleLanguage}
            style={({ pressed }) => [
              styles.langBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="globe-outline" size={16} color={colors.primary} />
            <Text style={[styles.langBtnText, { color: colors.text }]}>
              {language === 'ar' ? 'English' : 'العربية'}
            </Text>
          </Pressable>

          {/* Skip Button */}
          {currentStep === 'slides' && (
            <Pressable
              onPress={() => setCurrentStep('goal')}
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                {isAr ? 'تخطي' : 'Skip'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Step Progress Indicator */}
      {currentStep !== 'slides' && (
        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4].map(s => (
            <View
              key={s}
              style={[
                styles.stepDot,
                s <= stepNumber
                  ? { backgroundColor: colors.primary, flex: s === stepNumber ? 2 : 1 }
                  : { backgroundColor: colors.border, flex: 1 },
              ]}
            />
          ))}
        </View>
      )}

      {/* STEP 1: Feature Slides */}
      {currentStep === 'slides' && (
        <>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const contentOffsetX = e.nativeEvent.contentOffset.x;
              const idx = Math.round(contentOffsetX / width);
              if (idx >= 0 && idx < slides.length) {
                setActiveIndex(idx);
              }
            }}
            style={styles.scrollContainer}
          >
            {slides.map((item) => (
              <View key={item.id} style={styles.slide}>
                <View style={[styles.iconCircle, { backgroundColor: item.iconColor + '18', borderColor: item.iconColor + '40' }]}>
                  <Ionicons name={item.icon as any} size={64} color={item.iconColor} />
                </View>
                <Text style={[styles.slideTitle, { color: colors.text }]}>
                  {isAr ? item.titleAr : item.titleEn}
                </Text>
                <Text style={[styles.slideDesc, { color: colors.textSecondary }]}>
                  {isAr ? item.descAr : item.descEn}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
            <View style={styles.dotsContainer}>
              {slides.map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleGoToSlide(i)}
                  style={({ pressed }) => [styles.dotTouch, pressed && { opacity: 0.7 }]}
                >
                  <View
                    style={[
                      styles.dot,
                      i === activeIndex
                        ? { backgroundColor: colors.primary, width: 28 }
                        : { backgroundColor: colors.border, width: 8 },
                    ]}
                  />
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {activeIndex === slides.length - 1
                  ? (isAr ? 'متابعة' : 'Continue')
                  : (isAr ? 'التالي' : 'Next')}
              </Text>
              <Ionicons
                name={isAr ? 'arrow-back' : 'arrow-forward'}
                size={20}
                color="#FFF"
              />
            </Pressable>
          </View>
        </>
      )}

      {/* STEP 2: Goal Picker */}
      {currentStep === 'goal' && (
        <ScrollView
          style={styles.goalScrollView}
          contentContainerStyle={[styles.goalStepContent, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <View style={styles.goalTopSection}>
            <Text style={[styles.goalHeaderTitle, { color: colors.text }]}>
              {isAr ? 'ما هو هدفك المالي الأساسي؟' : 'What is your primary financial goal?'}
            </Text>
            <Text style={[styles.goalHeaderDesc, { color: colors.textSecondary }]}>
              {isAr
                ? 'ساعدنا على إعداد المحافظ والمستشار المالي بما يناسب تطلعاتك:'
                : 'Help us personalize your experience and AI advisor recommendations:'}
            </Text>

            <View style={styles.goalsList}>
              {goals.map((g) => {
                const isSelected = selectedGoal === g.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedGoal(g.id);
                    }}
                    style={[
                      styles.goalCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
                    ]}
                  >
                    <Text style={[styles.goalCardText, { color: colors.text }]}>
                      {isAr ? g.titleAr : g.titleEn}
                    </Text>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? colors.primary : colors.subtext}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={handleGoalNext}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary, width: '100%', marginTop: 24 },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {isAr ? 'التالي' : 'Next'}
            </Text>
            <Ionicons name={isAr ? 'arrow-back' : 'arrow-forward'} size={20} color="#FFF" />
          </Pressable>
        </ScrollView>
      )}

      {/* STEP 3: Currency Picker */}
      {currentStep === 'currency' && (
        <ScrollView
          style={styles.goalScrollView}
          contentContainerStyle={[styles.goalStepContent, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <View style={styles.goalTopSection}>
            <Text style={[styles.goalHeaderTitle, { color: colors.text }]}>
              {isAr ? '💰 اختر عملتك الأساسية' : '💰 Choose Your Main Currency'}
            </Text>
            <Text style={[styles.goalHeaderDesc, { color: colors.textSecondary }]}>
              {isAr
                ? 'سيتم إنشاء محفظتك الأولى بهذه العملة. يمكنك إضافة محافظ بعملات أخرى لاحقاً.'
                : 'Your first wallet will use this currency. You can add more wallets with different currencies later.'}
            </Text>

            <View style={styles.currencyGrid}>
              {CURRENCY_OPTIONS.map((curr) => {
                const isSelected = selectedCurrency === curr.code;
                return (
                  <Pressable
                    key={curr.code}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedCurrency(curr.code);
                    }}
                    style={[
                      styles.currencyCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
                    ]}
                  >
                    <Text style={styles.currencyFlag}>{curr.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.currencyCode, { color: colors.text }]}>{curr.code}</Text>
                      <Text style={[styles.currencyName, { color: colors.textSecondary }]}>
                        {isAr ? curr.nameAr : curr.nameEn}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={handleCurrencyNext}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary, width: '100%', marginTop: 24 },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {isAr ? 'التالي' : 'Next'}
            </Text>
            <Ionicons name={isAr ? 'arrow-back' : 'arrow-forward'} size={20} color="#FFF" />
          </Pressable>
        </ScrollView>
      )}

      {/* STEP 4: Monthly Income (Optional) */}
      {currentStep === 'income' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.goalScrollView}
            contentContainerStyle={[styles.goalStepContent, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
            showsVerticalScrollIndicator={false}
            bounces={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.goalTopSection}>
              <Text style={[styles.goalHeaderTitle, { color: colors.text }]}>
                {isAr ? '📊 كم دخلك الشهري تقريباً؟' : '📊 What\'s your approximate monthly income?'}
              </Text>
              <Text style={[styles.goalHeaderDesc, { color: colors.textSecondary }]}>
                {isAr
                  ? 'هذا يساعدنا في إعداد ميزانية مخصصة ونصائح مالية ذكية. (اختياري — يمكنك تخطي هذه الخطوة)'
                  : 'This helps us set up personalized budgets and smart financial advice. (Optional — you can skip this step)'}
              </Text>

              <View style={styles.incomeInputContainer}>
                <View style={[styles.incomeInputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.incomeSymbol, { color: colors.primary }]}>
                    {selectedCurrencyInfo?.flag} {CURRENCIES.find(c => c.code === selectedCurrency)?.symbol || '$'}
                  </Text>
                  <TextInput
                    value={monthlyIncomeInput}
                    onChangeText={(text) => setMonthlyIncomeInput(normalizeAmountInput(text))}
                    placeholder={isAr ? 'مثلاً: 5000' : 'e.g. 5000'}
                    placeholderTextColor={colors.textSecondary + '80'}
                    keyboardType="numeric"
                    style={[styles.incomeInput, { color: colors.text }]}
                    maxLength={10}
                  />
                </View>

                {/* Quick amount suggestions */}
                <View style={styles.quickAmounts}>
                  {[3000, 5000, 10000, 20000].map(amount => (
                    <Pressable
                      key={amount}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setMonthlyIncomeInput(String(amount));
                      }}
                      style={[
                        styles.quickAmountBtn,
                        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                        monthlyIncomeInput === String(amount) && { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
                      ]}
                    >
                      <Text style={[styles.quickAmountText, { color: colors.text }]}>
                        {amount.toLocaleString()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ gap: 12, width: '100%' }}>
              <Pressable
                onPress={handleCompleteOnboarding}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.primary, width: '100%' },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {isAr ? 'ابدأ استخدام ميزان الآن 🚀' : 'Get Started with Mizan 🚀'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMonthlyIncomeInput('');
                  handleCompleteOnboarding();
                }}
                style={({ pressed }) => [
                  styles.skipBtn,
                  { alignSelf: 'center', paddingVertical: 8 },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={[styles.skipText, { color: colors.textSecondary, fontSize: 14 }]}>
                  {isAr ? 'تخطي هذه الخطوة' : 'Skip this step'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  langBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  skipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
  },
  stepIndicator: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 8,
  },
  stepDot: {
    height: 4,
    borderRadius: 2,
  },
  scrollContainer: {
    flex: 1,
  },
  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  slideTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  slideDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dotTouch: {
    padding: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
  goalScrollView: {
    flex: 1,
  },
  goalStepContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    justifyContent: 'space-between',
  },
  goalTopSection: {
    width: '100%',
  },
  goalHeaderTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    marginBottom: 6,
  },
  goalHeaderDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 22,
  },
  goalsList: {
    gap: 12,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  goalCardText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14.5,
    flex: 1,
    marginRight: 10,
  },
  // Currency Picker styles
  currencyGrid: {
    gap: 10,
  },
  currencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  currencyFlag: {
    fontSize: 28,
  },
  currencyCode: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  currencyName: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
  },
  // Income Input styles
  incomeInputContainer: {
    gap: 20,
    marginTop: 8,
  },
  incomeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 64,
    gap: 12,
  },
  incomeSymbol: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
  },
  incomeInput: {
    flex: 1,
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    textAlign: 'left',
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAmountBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickAmountText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
  },
});
