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
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle, Line } from 'react-native-svg';

const { width } = Dimensions.get('window');

type OnboardingStep = 'slides' | 'goal' | 'currency' | 'income';

// Currency options including INR
const CURRENCY_OPTIONS: { code: CurrencyCode; flag: string; nameAr: string; nameEn: string; nameHi: string }[] = [
  { code: 'EGP', flag: '🇪🇬', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', nameHi: 'मिस्री पाउंड' },
  { code: 'SAR', flag: '🇸🇦', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', nameHi: 'सऊदी रियाल' },
  { code: 'AED', flag: '🇦🇪', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', nameHi: 'यूएई दिरहम' },
  { code: 'KWD', flag: '🇰🇼', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar', nameHi: 'कुवैती दिनार' },
  { code: 'INR', flag: '🇮🇳', nameAr: 'روبية هندية', nameEn: 'Indian Rupee', nameHi: 'भारतीय रुपया (₹)' },
  { code: 'USD', flag: '🇺🇸', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', nameHi: 'अमेरिकी डॉलर' },
  { code: 'EUR', flag: '🇪🇺', nameAr: 'يورو', nameEn: 'Euro', nameHi: 'यूरो' },
  { code: 'GBP', flag: '🇬🇧', nameAr: 'جنيه إسترليني', nameEn: 'British Pound', nameHi: 'ब्रिटिश पाउंड' },
  { code: 'QAR', flag: '🇶🇦', nameAr: 'ريال قطري', nameEn: 'Qatari Riyal', nameHi: 'कतरी रियाल' },
  { code: 'BHD', flag: '🇧🇭', nameAr: 'دينار بحريني', nameEn: 'Bahraini Dinar', nameHi: 'बहरीन दिनार' },
  { code: 'OMR', flag: '🇴🇲', nameAr: 'ريال عماني', nameEn: 'Omani Rial', nameHi: 'ओमानी रियाल' },
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

  const getText = (ar: string, en: string, hi?: string) => {
    if (language === 'hi' && hi) return hi;
    if (language === 'ar') return ar;
    return en;
  };

  const [demoCurrency, setDemoCurrency] = useState<CurrencyCode>('EGP');

  const slides = [
    {
      id: '1',
      icon: 'wallet',
      iconColor: '#10B981',
      titleAr: 'تتبع ذكي ومحافظ متعددة العملات',
      titleEn: 'Smart Multi-Currency Tracking',
      titleHi: 'स्मार्ट मल्टी-करेंसी ट्रैकिंग',
      descAr: 'أدر إجمالي أموالك ومحافظك بسهولة بمختلف العملات (ج.م، ₹، $، ر.س) وسجّل مصاريفك ونفقاتك اليومية بنقرة واحدة.',
      descEn: 'Manage all your wallets across multiple currencies (EGP, INR ₹, USD, SAR) and log expenses effortlessly in real-time.',
      descHi: 'विभिन्न मुद्राओं (INR ₹, USD, आदि) में अपने सभी वॉलेट आसानी से प्रबंधित करें और अपने दैनिक खर्चों को तुरंत ट्रैक करें।',
      previewType: 'wallet' as const,
    },
    {
      id: '2',
      icon: 'hardware-chip',
      iconColor: '#6366F1',
      titleAr: 'مستشار مالي ذكي بروبوت AI 🤖',
      titleEn: 'AI Smart Financial Robot 🤖',
      titleHi: 'एआई स्मार्ट रोबोट वित्तीय सहायक 🤖',
      descAr: 'روبوت ذكي يحلل عاداتك المالية لحظياً، يقرأ إشعارات البنك وفواتيرك تلقائياً، ويمنحك توصيات توفير فورية.',
      descEn: 'An intelligent AI robot that analyzes your spending habits in real-time, scans receipts, and provides personalized savings tips.',
      descHi: 'स्मार्ट एआई रोबोट आपके दैनिक खर्चों का वास्तविक समय में विश्लेषण करता है और स्वचालित रसीद स्कैनिंग के साथ बचत के सुझाव देता है।',
      previewType: 'ai_robot' as const,
    },
    {
      id: '3',
      icon: 'grid',
      iconColor: '#F59E0B',
      titleAr: 'خريطة الإنفاق الحرارية (Heatmap) 🔥',
      titleEn: 'Visual Spending Heatmap 🔥',
      titleHi: 'दैनिक व्यय हीटमैप (Heatmap) 🔥',
      descAr: 'اكتشف أيام ذروة الصرف وأيام الادخار الهادئة عبر خريطة تقويم حرارية تفاعلية تكشف سلوكك المالي بدقة.',
      descEn: 'Identify peak spending days and quiet saving days at a glance with an interactive visual calendar heatmap matrix.',
      descHi: 'कैलेंडर हीटमैप मैट्रिक्स के साथ अपने उच्चतम खर्च वाले दिनों और बचत के शांत दिनों को आसानी से ट्रैक करें।',
      previewType: 'heatmap' as const,
    },
    {
      id: '4',
      icon: 'trending-up',
      iconColor: '#06B6D4',
      titleAr: 'المنحنى البياني والتنبؤ المالي 📈',
      titleEn: 'Smooth Curve Chart & Forecast 📈',
      titleHi: 'कर्व चार्ट और नकदी प्रवाह पूर्वानुमान 📈',
      descAr: 'راقب كيرف ثروتك وتدفقاتك النقدية القادمة بمنحنيات بيانية ديناميكية تتنبأ بمسار رصيدك ومدخراتك القادمة.',
      descEn: 'Watch your wealth trajectory and upcoming cashflows with dynamic spline curves forecasting your financial growth.',
      descHi: 'सुंदर कर्व चार्ट और वित्तीय विकास के पूर्वानुमान के साथ अपने नकदी प्रवाह और बचत की प्रवृत्ति को देखें।',
      previewType: 'curve_chart' as const,
    },
    {
      id: '5',
      icon: 'calculator',
      iconColor: '#10B981',
      titleAr: 'تخطيط 50/30/20 وأهداف التوفير والزكاة 🎯',
      titleEn: '50/30/20 Budget, Goals & Zakat 🎯',
      titleHi: '50/30/20 बजट, बचत लक्ष्य और ऋण 🎯',
      descAr: 'قسّم دخلك بقاعدة 50/30/20 الذهبية، ابنِ صندوق الطوارئ، واحسب زكاة مالك بدقة وتحدَّ نفسك يومياً.',
      descEn: 'Structure your budget using the 50/30/20 rule, build your emergency fund, and calculate Zakat effortlessly.',
      descHi: '50/30/20 नियम के साथ बजट बनाएं, अपने लक्ष्यों को प्राप्त करें और देनदारियों को प्रबंधित करें।',
      previewType: 'budget_goals' as const,
    },
  ];

  const goals = [
    {
      id: 'saving',
      icon: 'shield-checkmark',
      color: '#10B981',
      titleAr: '🎯 توفير المال وبناء صندوق طوارئ',
      titleEn: '🎯 Build Savings & Emergency Fund',
      titleHi: '🎯 बचत बनाएं और आपातकालीन फंड तैयार करें',
    },
    {
      id: 'debts',
      icon: 'card',
      color: '#EF4444',
      titleAr: '💳 سداد الديون والالتزامات بذكاء',
      titleEn: '💳 Pay Off Debts & Obligations',
      titleHi: '💳 ऋण और देनदारियों का स्मार्ट भुगतान करें',
    },
    {
      id: 'tracking',
      icon: 'pie-chart',
      color: '#6366F1',
      titleAr: '📊 تنظيم المصاريف ومعرفة أين تذهب الأموال',
      titleEn: '📊 Organize Expenses & Daily Cashflow',
      titleHi: '📊 दैनिक खर्चों को व्यवस्थित और ट्रैक करें',
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
              name: getText('🎯 صندوق الطوارئ والادخار', '🎯 Emergency Savings Fund', '🎯 आपातकालीन बचत फंड'),
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
              personName: getText('خطة سداد الديون والالتزامات', 'Debt Payoff Target Plan', 'ऋण भुगतान योजना'),
              type: 'debt_to_others',
              amount: 500,
              paidAmount: 0,
              status: 'pending',
              dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
              description: getText(
                'تم إنشاؤها تلقائياً بناءً على هدفك المالي المقترح',
                'Auto-created based on your selected financial goal',
                'आपके चुने गए वित्तीय लक्ष्य के आधार पर स्वतः निर्मित'
              ),
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
              goalName: getText('📊 تنظيم وتتبع المصاريف (Kakeibo)', '📊 Kakeibo Budget Organizer Plan', '📊 काकीबो बजट योजना'),
              durationMonths: 12,
              monthlyIncome: mi,
              monthlyExpense: me,
              monthlySaving: ms,
              savingsGoal: ms * 12,
              currency: selectedCurrency,
              currencySymbol: currInfo?.symbol || '₹',
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

  // Quick amount suggestions based on currency
  const getQuickAmounts = () => {
    if (selectedCurrency === 'INR') return [15000, 30000, 50000, 100000];
    if (['USD', 'EUR', 'GBP'].includes(selectedCurrency)) return [1500, 3000, 5000, 8000];
    if (['KWD', 'BHD', 'OMR'].includes(selectedCurrency)) return [300, 600, 1000, 2000];
    return [3000, 5000, 10000, 20000];
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header with 3-Way Language Selector & Skip */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.brandRow}>
          <Text style={[styles.brandTitle, { color: colors.primary }]}>ميزان MIZAN</Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* 3-Way Language Switcher */}
          <View style={[styles.langSwitcherContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['ar', 'en', 'hi'] as const).map(lang => {
              const isSelected = language === lang;
              return (
                <Pressable
                  key={lang}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setLanguage(lang);
                  }}
                  style={[
                    styles.langPill,
                    isSelected && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      { color: isSelected ? '#FFF' : colors.textSecondary },
                    ]}
                  >
                    {lang === 'ar' ? 'عربي' : lang === 'en' ? 'EN' : 'हिंदी'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Skip Button */}
          {currentStep === 'slides' && (
            <Pressable
              onPress={() => setCurrentStep('goal')}
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                {getText('تخطي', 'Skip', 'छोड़ें')}
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

      {/* STEP 1: Feature Slides with Modern Visual Mockups */}
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
                {/* Visual Mockup Card depending on previewType */}
                <View style={[styles.mockupContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {item.previewType === 'wallet' && (
                    <View style={styles.mockupInner}>
                      {/* Top Wallet Balance */}
                      <View style={styles.mockupBalanceRow}>
                        <View>
                          <Text style={[styles.mockupLabel, { color: colors.textSecondary }]}>
                            {getText('إجمالي الرصيد', 'Total Balance', 'कुल शेष')}
                          </Text>
                          <Text style={[styles.mockupAmount, { color: colors.text }]}>
                            {demoCurrency === 'INR'
                              ? '₹ 45,280'
                              : demoCurrency === 'USD'
                              ? '$4,280.00'
                              : demoCurrency === 'SAR'
                              ? '16,050 ر.س'
                              : '45,280 ج.م'}
                          </Text>
                        </View>
                        <View style={[styles.mockupBadge, { backgroundColor: '#10B98120' }]}>
                          <Ionicons name="trending-up" size={14} color="#10B981" />
                          <Text style={[styles.mockupBadgeText, { color: '#10B981' }]}>+12.4%</Text>
                        </View>
                      </View>

                      {/* Mockup Mini Transactions */}
                      <View style={styles.mockupTxList}>
                        <View style={[styles.mockupTxItem, { backgroundColor: colors.surfaceAlt }]}>
                          <View style={[styles.mockupTxIcon, { backgroundColor: '#EF444420' }]}>
                            <Ionicons name="cart" size={15} color="#EF4444" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.mockupTxTitle, { color: colors.text }]}>
                              {getText('سوبرماركت ومؤن', 'Groceries & Mart', 'किराना और राशन')}
                            </Text>
                            <Text style={[styles.mockupTxSub, { color: colors.textSecondary }]}>
                              {getText('اليوم • نقداً', 'Today • Cash', 'आज • नकद')}
                            </Text>
                          </View>
                          <Text style={[styles.mockupTxAmount, { color: '#EF4444' }]}>
                            {demoCurrency === 'INR'
                              ? '-₹ 1,420'
                              : demoCurrency === 'USD'
                              ? '-$45.00'
                              : demoCurrency === 'SAR'
                              ? '-170 ر.س'
                              : '-1,420 ج.م'}
                          </Text>
                        </View>

                        <View style={[styles.mockupTxItem, { backgroundColor: colors.surfaceAlt }]}>
                          <View style={[styles.mockupTxIcon, { backgroundColor: '#10B98120' }]}>
                            <Ionicons name="briefcase" size={15} color="#10B981" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.mockupTxTitle, { color: colors.text }]}>
                              {getText('الراتب الشهري', 'Monthly Salary', 'मासिक वेतन')}
                            </Text>
                            <Text style={[styles.mockupTxSub, { color: colors.textSecondary }]}>
                              {getText('أمس • بنك', 'Yesterday • Bank', 'कल • बैंक')}
                            </Text>
                          </View>
                          <Text style={[styles.mockupTxAmount, { color: '#10B981' }]}>
                            {demoCurrency === 'INR'
                              ? '+₹ 35,000'
                              : demoCurrency === 'USD'
                              ? '+$2,500'
                              : demoCurrency === 'SAR'
                              ? '+12,000 ر.س'
                              : '+35,000 ج.م'}
                          </Text>
                        </View>
                      </View>

                      {/* Multi-currency tags with interactive tap */}
                      <View style={styles.mockupTagsRow}>
                        {(['EGP', 'INR', 'USD', 'SAR'] as const).map(curr => {
                          const isCurActive = demoCurrency === curr;
                          return (
                            <Pressable
                              key={curr}
                              onPress={() => {
                                Haptics.selectionAsync().catch(() => {});
                                setDemoCurrency(curr);
                              }}
                              style={[
                                styles.mockupCurrencyTag,
                                {
                                  backgroundColor: isCurActive ? colors.primary + '25' : colors.surfaceAlt,
                                  borderColor: isCurActive ? colors.primary : 'transparent',
                                  borderWidth: 1,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.mockupCurrencyTagText,
                                  { color: isCurActive ? colors.primary : colors.textSecondary },
                                ]}
                              >
                                {curr === 'INR'
                                  ? '🇮🇳 INR (₹)'
                                  : curr === 'EGP'
                                  ? '🇪🇬 EGP'
                                  : curr === 'USD'
                                  ? '🇺🇸 USD ($)'
                                  : '🇸🇦 SAR'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* AI Smart Robot Mockup */}
                  {item.previewType === 'ai_robot' && (
                    <View style={styles.mockupInner}>
                      {/* Top Header with Robot Face & Online Status */}
                      <View style={styles.mockupBalanceRow}>
                        <View style={styles.robotHeaderLeft}>
                          {/* Robot Avatar */}
                          <View style={styles.robotAvatarContainer}>
                            <View style={styles.robotAntennaOrb} />
                            <View style={styles.robotAntennaStem} />
                            <View style={styles.robotFaceBox}>
                              <View style={styles.robotVisor}>
                                <View style={styles.robotEye} />
                                <View style={styles.robotEye} />
                              </View>
                              <View style={styles.robotSmile} />
                            </View>
                          </View>
                          <View style={{ gap: 2 }}>
                            <Text style={[styles.robotTitle, { color: colors.text }]}>
                              {getText('مساعد ميزان AI 🤖', 'Mizan AI Robot 🤖', 'मिज़ान एआई बॉट 🤖')}
                            </Text>
                            <View style={styles.robotStatusRow}>
                              <View style={styles.robotStatusPulse} />
                              <Text style={[styles.robotStatusText, { color: '#10B981' }]}>
                                {getText('نشط لحظياً • تحليل ذكي', 'Online • Smart Analysis', 'ऑनलाइन • रीयल-टाइम')}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={[styles.mockupBadge, { backgroundColor: '#6366F120' }]}>
                          <Ionicons name="sparkles" size={14} color="#6366F1" />
                          <Text style={[styles.mockupBadgeText, { color: '#6366F1' }]}>GPT-4o</Text>
                        </View>
                      </View>

                      {/* Robot Dialogue Speech Bubble */}
                      <View style={[styles.robotBubble, { backgroundColor: colors.surfaceAlt, borderColor: '#6366F140' }]}>
                        <Text style={[styles.robotBubbleText, { color: colors.text }]}>
                          {getText(
                            '💡 مرحباً! قمت بفحص نمط مصاريفك: وفرت 18% هذا الأسبوع بتجنب النفقات العشوائية، وأقترح تحويل 500 ج.م لصندوق الطوارئ! 🚀',
                            '💡 Spending Analyzed: You saved 18% this week by cutting impulse purchases. Ready to auto-allocate $50 into emergency savings? 🚀',
                            '💡 खर्च विश्लेषण: आपने इस सप्ताह 18% बचाया! क्या आप आपातकालीन फंड में बचत जमा करना चाहते हैं? 🚀'
                          )}
                        </Text>
                      </View>

                      {/* Smart Action Badges */}
                      <View style={styles.robotActionsRow}>
                        <View style={[styles.robotActionChip, { backgroundColor: '#6366F115', borderColor: '#6366F135' }]}>
                          <Ionicons name="flash-outline" size={14} color="#6366F1" />
                          <Text style={[styles.robotActionChipText, { color: colors.text }]}>
                            {getText('قراءة رسائل البنك (SMS)', 'Auto Bank SMS', 'बैंक एसएमएस पढ़ना')}
                          </Text>
                        </View>
                        <View style={[styles.robotActionChip, { backgroundColor: '#10B98115', borderColor: '#10B98135' }]}>
                          <Ionicons name="scan-outline" size={14} color="#10B981" />
                          <Text style={[styles.robotActionChipText, { color: colors.text }]}>
                            {getText('مسح الفواتير بالذكاء (OCR)', 'OCR Smart Scan', 'स्मार्ट रसीद स्कैन')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Spending Activity Heatmap Mockup */}
                  {item.previewType === 'heatmap' && (
                    <View style={styles.mockupInner}>
                      {/* Top Header */}
                      <View style={styles.mockupBalanceRow}>
                        <View>
                          <Text style={[styles.mockupLabel, { color: colors.textSecondary }]}>
                            {getText('خريطة الإنفاق والنشاط (Heatmap)', 'Daily Spending Heatmap', 'दैनिक व्यय हीटमैप')}
                          </Text>
                          <Text style={[styles.mockupAmount, { color: colors.text }]}>
                            {getText('28 يوماً مرصودة', '28 Tracked Days', '28 ट्रैक किए गए दिन')}
                          </Text>
                        </View>
                        <View style={[styles.mockupBadge, { backgroundColor: '#EF444420' }]}>
                          <Ionicons name="flame" size={14} color="#EF4444" />
                          <Text style={[styles.mockupBadgeText, { color: '#EF4444' }]}>
                            {getText('4 ذروة إنفاق', '4 Peak Days', '4 पीक दिन')}
                          </Text>
                        </View>
                      </View>

                      {/* Heatmap Matrix Card */}
                      <View style={[styles.heatmapCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                        {/* Days Header */}
                        <View style={styles.heatmapDaysRow}>
                          {(isAr
                            ? ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج']
                            : language === 'hi'
                            ? ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श']
                            : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                          ).map((d, i) => (
                            <Text key={i} style={[styles.heatmapDayHeader, { color: colors.textSecondary }]}>
                              {d}
                            </Text>
                          ))}
                        </View>

                        {/* 4 Weeks Grid */}
                        {[
                          [1, 0, 2, 1, 0, 3, 4],
                          [0, 1, 1, 2, 0, 4, 3],
                          [1, 0, 0, 1, 2, 3, 4],
                          [0, 1, 2, 0, 1, 4, 2],
                        ].map((week, wIdx) => (
                          <View key={wIdx} style={styles.heatmapWeekRow}>
                            {week.map((level, dIdx) => {
                              const cellBg =
                                level === 0
                                  ? colors.card
                                  : level === 1
                                  ? '#10B98140'
                                  : level === 2
                                  ? '#10B981'
                                  : level === 3
                                  ? '#F59E0B'
                                  : '#EF4444';
                              return (
                                <View
                                  key={dIdx}
                                  style={[
                                    styles.heatmapCell,
                                    { backgroundColor: cellBg },
                                    level === 4 && { borderColor: '#FFF', borderWidth: 1 },
                                  ]}
                                >
                                  {level === 4 && (
                                    <Ionicons name="flame" size={9} color="#FFF" />
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        ))}

                        {/* Heatmap Legend */}
                        <View style={styles.heatmapLegendRow}>
                          <Text style={[styles.heatmapLegendText, { color: colors.textSecondary }]}>
                            {getText('أقل صرف', 'Low Spend', 'कम खर्च')}
                          </Text>
                          <View style={styles.heatmapLegendDots}>
                            {[colors.card, '#10B98140', '#10B981', '#F59E0B', '#EF4444'].map((col, idx) => (
                              <View key={idx} style={[styles.heatmapLegendDot, { backgroundColor: col }]} />
                            ))}
                          </View>
                          <Text style={[styles.heatmapLegendText, { color: colors.textSecondary }]}>
                            {getText('أعلى صرف', 'Peak Spend', 'उच्च खर्च')}
                          </Text>
                        </View>
                      </View>

                      {/* Heatmap Insight */}
                      <View style={[styles.mockupInsightPill, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}>
                        <Ionicons name="bulb-outline" size={16} color="#EF4444" />
                        <Text style={[styles.mockupInsightText, { color: colors.text }]}>
                          {getText(
                            '🔥 ذروة الإنفاق تتكرر في عطلة نهاية الأسبوع • 18 يوماً كان إنفاقك منخفضاً ممتازاً!',
                            '🔥 Weekend spending peaks detected • 18 low-spend days kept your budget safe!',
                            '🔥 सप्ताहांत में खर्च बढ़ता है • 18 शांत बचत दिनों ने आपके बजट को सुरक्षित रखा!'
                          )}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Curve Chart Mockup */}
                  {item.previewType === 'curve_chart' && (
                    <View style={styles.mockupInner}>
                      {/* Header */}
                      <View style={styles.mockupBalanceRow}>
                        <View>
                          <Text style={[styles.mockupLabel, { color: colors.textSecondary }]}>
                            {getText('منحنى نمو الثروة والتدفق المالي', 'Cashflow & Net Worth Spline', 'नकदी प्रवाह और बचत कर्व')}
                          </Text>
                          <Text style={[styles.mockupAmount, { color: '#10B981' }]}>
                            +34.8% {getText('تراكمي', 'Growth', 'वृद्धि')}
                          </Text>
                        </View>
                        <View style={[styles.mockupBadge, { backgroundColor: '#10B98120' }]}>
                          <Ionicons name="trending-up" size={14} color="#10B981" />
                          <Text style={[styles.mockupBadgeText, { color: '#10B981' }]}>Forecast</Text>
                        </View>
                      </View>

                      {/* SVG Curve Graph Card */}
                      <View style={[styles.curveContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                        <Svg viewBox="0 0 300 90" width="100%" height={90}>
                          <Defs>
                            <SvgGradient id="chartCurveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <Stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
                              <Stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                            </SvgGradient>
                          </Defs>

                          {/* Gradient Area Fill */}
                          <Path
                            d="M 15,72 C 40,72 45,64 70,64 C 95,64 100,50 125,50 C 150,50 155,54 180,54 C 205,54 215,30 240,30 C 265,30 275,14 285,14 L 285,88 L 15,88 Z"
                            fill="url(#chartCurveGrad)"
                          />

                          {/* Spline Stroke */}
                          <Path
                            d="M 15,72 C 40,72 45,64 70,64 C 95,64 100,50 125,50 C 150,50 155,54 180,54 C 205,54 215,30 240,30 C 265,30 275,14 285,14"
                            stroke="#10B981"
                            strokeWidth="3.5"
                            fill="none"
                            strokeLinecap="round"
                          />

                          {/* Milestone Dots */}
                          <Circle cx="70" cy="64" r="3.5" fill="#10B981" />
                          <Circle cx="125" cy="50" r="3.5" fill="#10B981" />
                          <Circle cx="180" cy="54" r="3.5" fill="#10B981" />
                          <Circle cx="240" cy="30" r="3.5" fill="#10B981" />

                          {/* Dotted Guideline at Peak */}
                          <Line
                            x1="285"
                            y1="14"
                            x2="285"
                            y2="88"
                            stroke="#10B981"
                            strokeDasharray="3,3"
                            strokeOpacity="0.4"
                            strokeWidth="1.5"
                          />

                          {/* Glowing Peak Dot */}
                          <Circle cx="285" cy="14" r="9" fill="#10B981" fillOpacity="0.25" />
                          <Circle cx="285" cy="14" r="5" fill="#10B981" />
                          <Circle cx="285" cy="14" r="2.5" fill="#FFFFFF" />
                        </Svg>

                        {/* X-Axis Month Markers */}
                        <View style={styles.curveXAxis}>
                          {(isAr
                            ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو']
                            : language === 'hi'
                            ? ['जन', 'फर', 'मार्च', 'अप्रै', 'मई', 'जून']
                            : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
                          ).map((m, i) => (
                            <Text key={i} style={[styles.curveXAxisLabel, { color: colors.textSecondary }]}>
                              {m}
                            </Text>
                          ))}
                        </View>
                      </View>

                      {/* Forecast Insight */}
                      <View style={[styles.mockupInsightPill, { backgroundColor: '#06B6D415', borderColor: '#06B6D430' }]}>
                        <Ionicons name="analytics-outline" size={16} color="#06B6D4" />
                        <Text style={[styles.mockupInsightText, { color: colors.text }]}>
                          {getText(
                            'توقع ذكي: استمرارك على هذه الوتيرة يرفع فائضك لـ 3,200 ج.م نهاية الشهر!',
                            'Smart Trajectory: Keeping this pace projects $3,200 in surplus by month-end!',
                            'स्मार्ट पूर्वानुमान: इसी गति से चलने पर महीने के अंत तक अधिशेष बचत बढ़ेगी!'
                          )}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 50/30/20 & Goals Mockup */}
                  {item.previewType === 'budget_goals' && (
                    <View style={styles.mockupInner}>
                      <View style={styles.mockupBalanceRow}>
                        <View>
                          <Text style={[styles.mockupLabel, { color: colors.textSecondary }]}>
                            {getText('توزيع 50/30/20 وأهداف التوفير', '50/30/20 Plan & Targets', '50/30/20 योजना और लक्ष्य')}
                          </Text>
                          <Text style={[styles.mockupAmount, { color: '#10B981' }]}>
                            {language === 'hi' ? '₹ 75,000 / 100,000' : isAr ? '75,000 / 100,000 ج.م' : '$7,500 / 10,000'}
                          </Text>
                        </View>
                        <View style={[styles.mockupBadge, { backgroundColor: '#F59E0B20' }]}>
                          <Ionicons name="flame" size={14} color="#F59E0B" />
                          <Text style={[styles.mockupBadgeText, { color: '#F59E0B' }]}>75%</Text>
                        </View>
                      </View>

                      {/* Segmented Progress Bar */}
                      <View style={[styles.mockupProgressBarTrack, { backgroundColor: colors.surfaceAlt, flexDirection: 'row' }]}>
                        <View style={{ width: '50%', height: '100%', backgroundColor: '#10B981' }} />
                        <View style={{ width: '30%', height: '100%', backgroundColor: '#F59E0B' }} />
                        <View style={{ width: '20%', height: '100%', backgroundColor: '#6366F1' }} />
                      </View>

                      {/* 50/30/20 Labels */}
                      <View style={styles.segmentedLabelsRow}>
                        <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: '#10B981' }}>
                          50% {getText('ضروريات', 'Needs', 'आवश्यकता')}
                        </Text>
                        <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: '#F59E0B' }}>
                          30% {getText('رغبات', 'Wants', 'इच्छा')}
                        </Text>
                        <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: '#6366F1' }}>
                          20% {getText('ادخار', 'Savings', 'बचत')}
                        </Text>
                      </View>

                      {/* Feature Item */}
                      <View style={[styles.mockupTxItem, { backgroundColor: colors.surfaceAlt }]}>
                        <View style={[styles.mockupTxIcon, { backgroundColor: '#10B98120' }]}>
                          <Ionicons name="trophy" size={16} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.mockupTxTitle, { color: colors.text }]}>
                            {getText('تحدي 30 يوم لبناء عادات مالية مستدامة', '30-Day Financial Habit Challenge', '30-दिवसीय वित्तीय आदत चुनौती')}
                          </Text>
                          <Text style={[styles.mockupTxSub, { color: colors.textSecondary }]}>
                            {getText('حاسبة الزكاة وجداول سداد الديون', 'Smart Zakat & debt repayment tables', 'स्मार्ट ज़कात और ऋण भुगतान')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                {/* Slide Text Content */}
                <Text style={[styles.slideTitle, { color: colors.text }]}>
                  {getText(item.titleAr, item.titleEn, item.titleHi)}
                </Text>
                <Text style={[styles.slideDesc, { color: colors.textSecondary }]}>
                  {getText(item.descAr, item.descEn, item.descHi)}
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
                  ? getText('متابعة', 'Continue', 'जारी रखें')
                  : getText('التالي', 'Next', 'आगे बढ़ें')}
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
              {getText('ما هو هدفك المالي الأساسي؟', 'What is your primary financial goal?', 'आपका मुख्य वित्तीय लक्ष्य क्या है?')}
            </Text>
            <Text style={[styles.goalHeaderDesc, { color: colors.textSecondary }]}>
              {getText(
                'ساعدنا على إعداد المحافظ والمستشار المالي بما يناسب تطلعاتك:',
                'Help us personalize your experience and AI advisor recommendations:',
                'अपने अनुभव और एआई वित्तीय सलाहकार को निजीकृत करने में हमारी सहायता करें:'
              )}
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
                      {getText(g.titleAr, g.titleEn, g.titleHi)}
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
              {getText('التالي', 'Next', 'आगे बढ़ें')}
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
              {getText('💰 اختر عملتك الأساسية', '💰 Choose Your Main Currency', '💰 अपनी मुख्य मुद्रा चुनें')}
            </Text>
            <Text style={[styles.goalHeaderDesc, { color: colors.textSecondary }]}>
              {getText(
                'سيتم إنشاء محفظتك الأولى بهذه العملة. يمكنك إضافة محافظ بعملات أخرى لاحقاً.',
                'Your first wallet will use this currency. You can add more wallets with different currencies later.',
                'आपका पहला वॉलेट इस मुद्रा का उपयोग करेगा। आप बाद में अन्य मुद्राओं में और वॉलेट जोड़ सकते हैं।'
              )}
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
                        {getText(curr.nameAr, curr.nameEn, curr.nameHi)}
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
              {getText('التالي', 'Next', 'आगे बढ़ें')}
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
                {getText('📊 كم دخلك الشهري تقريباً؟', '📊 What\'s your approximate monthly income?', '📊 आपकी अनुमानित मासिक आय क्या है?')}
              </Text>
              <Text style={[styles.goalHeaderDesc, { color: colors.textSecondary }]}>
                {getText(
                  'هذا يساعدنا في إعداد ميزانية مخصصة ونصائح مالية ذكية. (اختياري — يمكنك تخطي هذه الخطوة)',
                  'This helps us set up personalized budgets and smart financial advice. (Optional — you can skip this step)',
                  'यह हमें व्यक्तिगत बजट और स्मार्ट वित्तीय सलाह तैयार करने में मदद करता है। (वैकल्पिक — आप छोड़ सकते हैं)'
                )}
              </Text>

              <View style={styles.incomeInputContainer}>
                <View style={[styles.incomeInputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.incomeSymbol, { color: colors.primary }]}>
                    {selectedCurrencyInfo?.flag} {CURRENCIES.find(c => c.code === selectedCurrency)?.symbol || '₹'}
                  </Text>
                  <TextInput
                    value={monthlyIncomeInput}
                    onChangeText={(text) => setMonthlyIncomeInput(normalizeAmountInput(text))}
                    placeholder={selectedCurrency === 'INR' ? 'उदा. 35000' : isAr ? 'مثلاً: 5000' : 'e.g. 5000'}
                    placeholderTextColor={colors.textSecondary + '80'}
                    keyboardType="numeric"
                    style={[styles.incomeInput, { color: colors.text }]}
                    maxLength={10}
                  />
                </View>

                {/* Quick amount suggestions */}
                <View style={styles.quickAmounts}>
                  {getQuickAmounts().map(amount => (
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

            <View style={{ gap: 12, width: '100%', marginTop: 24 }}>
              <Pressable
                onPress={handleCompleteOnboarding}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.primary, width: '100%' },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {getText('ابدأ استخدام ميزان الآن 🚀', 'Get Started with Mizan 🚀', 'मिज़ान का उपयोग शुरू करें 🚀')}
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
                  {getText('تخطي هذه الخطوة', 'Skip this step', 'यह चरण छोड़ें')}
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
    gap: 8,
  },
  langSwitcherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  langPillText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
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
    paddingHorizontal: 24,
  },
  // Rich Visual Mockups
  mockupContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  mockupInner: {
    width: '100%',
    gap: 14,
  },
  mockupBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mockupLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    marginBottom: 2,
  },
  mockupAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
  },
  mockupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mockupBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  mockupTxList: {
    gap: 8,
  },
  mockupTxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    gap: 10,
  },
  mockupTxIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockupTxTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  mockupTxSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  mockupTxAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  mockupTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  mockupCurrencyTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  mockupCurrencyTagText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  mockupProgressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  mockupProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  mockupBudgetGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  mockupBudgetItem: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
  },
  mockupBudgetCatName: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    marginBottom: 4,
  },
  mockupBudgetCatVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  mockupInsightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  mockupInsightText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    flex: 1,
  },
  // Robot Mockup Styles
  robotHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  robotAvatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
  },
  robotAntennaOrb: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  robotAntennaStem: {
    width: 2.5,
    height: 5,
    backgroundColor: '#6366F1',
    borderRadius: 1,
  },
  robotFaceBox: {
    width: 46,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#6366F115',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  robotVisor: {
    width: 32,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0B0F19',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  robotEye: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#06B6D4',
  },
  robotSmile: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#6366F1',
  },
  robotTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  robotStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  robotStatusPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  robotStatusText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  robotBubble: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  robotBubbleText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    lineHeight: 19,
  },
  robotActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  robotActionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  robotActionChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10.5,
  },
  // Heatmap Mockup Styles
  heatmapCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  heatmapDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  heatmapDayHeader: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    width: 28,
    textAlign: 'center',
  },
  heatmapWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  heatmapCell: {
    flex: 1,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  heatmapLegendText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
  },
  heatmapLegendDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heatmapLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  // Curve Chart Styles
  curveContainer: {
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  curveXAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  curveXAxisLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
  // Segmented Labels
  segmentedLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
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
