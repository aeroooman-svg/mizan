import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTransactions } from '@/lib/TransactionContext';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { wallets } = useTransactions();
  const isAr = language === 'ar';

  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [showGoalStep, setShowGoalStep] = useState(false);
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
      setShowGoalStep(true);
    }
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
              targetAmount: 1000,
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
            await saveFinancialPlan({
              id: String(Date.now()),
              walletId: targetWalletId,
              goalName: isAr ? '📊 تنظيم وتتبع المصاريف (Kakeibo)' : '📊 Kakeibo Budget Organizer Plan',
              durationMonths: 12,
              monthlyIncome: 1000,
              monthlyExpense: 700,
              monthlySaving: 300,
              savingsGoal: 3600,
              currency: wallets[0].currency || 'USD',
              currencySymbol: 'ج.م',
              createdAt: nowStr,
              isKakeiboEnabled: true,
              kakeiboBudgets: {
                survival: 350, // Needs 50%
                wants: 210,    // Wants 30%
                culture: 70,   // Culture 10%
                extra: 70,     // Extra 10%
              },
            });
          }
        }
      }
    } catch (e) {
      console.error('Error completing onboarding setup:', e);
    }

    if (wallets.length === 0) {
      router.replace('/add-wallet');
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header with Language Switcher & Skip */}
      <View style={styles.header}>
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
          {!showGoalStep && (
            <Pressable
              onPress={() => setShowGoalStep(true)}
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                {isAr ? 'تخطي' : 'Skip'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {!showGoalStep ? (
        <>
          {/* Swipeable ScrollView */}
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

          {/* Pagination Indicators & Next Button */}
          <View style={styles.footer}>
            <View style={styles.dotsContainer}>
              {slides.map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleGoToSlide(i)}
                  style={({ pressed }) => [
                    styles.dotTouch,
                    pressed && { opacity: 0.7 },
                  ]}
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
      ) : (
        /* Financial Goal Picker Step */
        <View style={styles.goalStepContainer}>
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

          <Pressable
            onPress={handleCompleteOnboarding}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary, width: '100%', marginTop: 'auto' },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {isAr ? 'ابدأ استخدام ميزان الآن 🚀' : 'Get Started with Mizan 🚀'}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
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
  goalStepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  goalHeaderTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    marginBottom: 8,
  },
  goalHeaderDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    marginBottom: 32,
    lineHeight: 22,
  },
  goalsList: {
    gap: 16,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  goalCardText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
});
