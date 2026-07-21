import React, { useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTransactions } from '@/lib/TransactionContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { getFinancialPlan } from '@/lib/planStorage';
import { getBudgetsForWallet } from '@/lib/budgetStorage';

export default function ChallengesScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { walletTransactions, selectedWallet, totalIncome, totalExpense } = useTransactions();
  const { language } = useLanguage();

  const [hasPlan, setHasPlan] = useState(false);
  const [hasBudgets, setHasBudgets] = useState(false);

  useEffect(() => {
    async function checkData() {
      if (selectedWallet) {
        const plan = await getFinancialPlan(selectedWallet.id);
        setHasPlan(!!plan);
        const budgetsList = await getBudgetsForWallet(selectedWallet.id);
        setHasBudgets(budgetsList && Object.keys(budgetsList).length > 0);
      }
    }
    checkData();
  }, [selectedWallet]);

  // Local Translations
  const t = {
    ar: {
      title: 'التحديات والإنجازات',
      challenges: 'تحديات الادخار',
      badges: 'أوسمة الإنجازات',
      progress: 'التقدم',
      completed: 'مكتمل!',
      active: 'نشط',
      coffeeTitle: '☕ تحدي الكوب الموفر',
      coffeeDesc: 'تجنب الصرف في الترفيه والتسوق لمدة 5 أيام متتالية.',
      savingTitle: '🎯 تحدي الـ 50%',
      savingDesc: 'ادخر ما لا يقل عن 50% من دخلك هذا الشهر.',
      noSpendTitle: '💸 أسبوع بلا إسراف',
      noSpendDesc: 'حافظ على مصاريفك غير الضرورية تحت 15 د.ك (أو ما يعادلها) لمدة 7 أيام.',
      firstStepTitle: 'الخطوة الأولى',
      firstStepDesc: 'قم بتسجيل أول معاملة لك في المحفظة.',
      planMasterTitle: 'خبير التخطيط',
      planMasterDesc: 'قم بإنشاء خطة مالية مخصصة لمحفظتك.',
      budgetMasterTitle: 'حارس الميزانية',
      budgetMasterDesc: 'حدد ميزانية لفئة واحدة على الأقل للتحكم في إنفاقك.',
      frugalHeroTitle: 'المقتصد البطل',
      frugalHeroDesc: 'حافظ على مصاريفك الشهرية أقل من 50% من دخلك.',
      consistencyTitle: 'الالتزام المستمر',
      consistencyDesc: 'سجل معاملات في 5 أيام مختلفة لتثبت انضباطك.',
    },
    en: {
      title: 'Challenges & Badges',
      challenges: 'Savings Challenges',
      badges: 'Achievement Badges',
      progress: 'Progress',
      completed: 'Completed!',
      active: 'Active',
      coffeeTitle: '☕ Coffee Saver Challenge',
      coffeeDesc: 'Avoid spending on entertainment & shopping for 5 consecutive days.',
      savingTitle: '🎯 50% Savings Challenge',
      savingDesc: 'Save at least 50% of your total income this month.',
      noSpendTitle: '💸 No-Spend Week',
      noSpendDesc: 'Keep non-essential expenses under 15 KWD (or equivalent) for 7 days.',
      firstStepTitle: 'First Step',
      firstStepDesc: 'Log your first transaction in the wallet.',
      planMasterTitle: 'Planning Master',
      planMasterDesc: 'Create a customized financial plan for your wallet.',
      budgetMasterTitle: 'Budget Guardian',
      budgetMasterDesc: 'Set a budget for at least one category to control spending.',
      frugalHeroTitle: 'Frugal Hero',
      frugalHeroDesc: 'Keep monthly expenses under 50% of your monthly income.',
      consistencyTitle: 'Consistent Logger',
      consistencyDesc: 'Log transactions on 5 different days to prove discipline.',
    }
  }[language === 'ar' ? 'ar' : 'en'];

  // --- Dynamic Challenges Calculations ---
  
  // 1. Coffee Saver Challenge: No shopping or entertainment in last 5 days
  const coffeeProgress = (() => {
    const nonEssentialCategories = ['shopping', 'entertainment'];
    const now = new Date();
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(now.getDate() - 5);

    const nonEssentialTx = walletTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return tx.type === 'expense' && 
             nonEssentialCategories.includes(tx.category) && 
             txDate >= fiveDaysAgo;
    });

    if (nonEssentialTx.length === 0 && walletTransactions.length > 0) return 100;
    // Calculate progress: 100 - (number of offenses * 20), minimum 0
    return Math.max(0, 100 - (nonEssentialTx.length * 20));
  })();

  // 2. 50% Savings Challenge: save >= 50% of income
  const savingsChallengeProgress = (() => {
    if (totalIncome <= 0) return 0;
    const actualSavings = totalIncome - totalExpense;
    const savingsRatio = actualSavings / totalIncome;
    return Math.min(100, Math.max(0, Math.round((savingsRatio / 0.5) * 100)));
  })();

  // 3. No-Spend Week: non-essential expenses < 15 in last 7 days
  const noSpendWeekProgress = (() => {
    const essentialCategories = ['rent', 'bills', 'health', 'education', 'salary', 'freelance', 'investment', 'gift', 'bonus'];
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const nonEssentialTotal = walletTransactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return tx.type === 'expense' && 
               !essentialCategories.includes(tx.category) && 
               txDate >= sevenDaysAgo;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const limit = 15; // 15 KWD or equivalent
    if (nonEssentialTotal === 0 && walletTransactions.length > 0) return 100;
    if (nonEssentialTotal >= limit) return 0;
    return Math.round(((limit - nonEssentialTotal) / limit) * 100);
  })();

  // --- Dynamic Badges Calculations ---
  
  // Badge 1: First Step
  const badgeFirstStep = walletTransactions.length >= 1;
  // Badge 2: Plan Master
  const badgePlanMaster = hasPlan;
  // Badge 3: Budget Master
  const badgeBudgetMaster = hasBudgets;
  // Badge 4: Frugal Hero
  const badgeFrugalHero = totalIncome > 0 && (totalExpense / totalIncome) <= 0.5;
  // Badge 5: Consistency (logged in 5 different days)
  const badgeConsistency = (() => {
    const uniqueDays = new Set(
      walletTransactions.map(tx => {
        const d = new Date(tx.date);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
    );
    return uniqueDays.size >= 5;
  })();

  const handleBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: (insets.top || (Platform.OS === 'web' ? 10 : 0)) + 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight, zIndex: 10, elevation: 10 }]}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.sheetTitle}>{t.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* SECTION 1: CHALLENGES */}
        <Text style={styles.sectionTitle}>{t.challenges}</Text>
        
        {/* Challenge 1 */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeName}>{t.coffeeTitle}</Text>
            <Text style={[
              styles.challengeStatus,
              coffeeProgress === 100 ? styles.statusCompleted : styles.statusActive
            ]}>
              {coffeeProgress === 100 ? t.completed : t.active}
            </Text>
          </View>
          <Text style={styles.challengeDesc}>{t.coffeeDesc}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${coffeeProgress}%`, backgroundColor: coffeeProgress === 100 ? colors.accent : colors.primary }]} />
            </View>
            <Text style={styles.progressText}>{coffeeProgress}%</Text>
          </View>
        </View>

        {/* Challenge 2 */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeName}>{t.savingTitle}</Text>
            <Text style={[
              styles.challengeStatus,
              savingsChallengeProgress === 100 ? styles.statusCompleted : styles.statusActive
            ]}>
              {savingsChallengeProgress === 100 ? t.completed : t.active}
            </Text>
          </View>
          <Text style={styles.challengeDesc}>{t.savingDesc}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${savingsChallengeProgress}%`, backgroundColor: savingsChallengeProgress === 100 ? colors.accent : colors.primary }]} />
            </View>
            <Text style={styles.progressText}>{savingsChallengeProgress}%</Text>
          </View>
        </View>

        {/* Challenge 3 */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeName}>{t.noSpendTitle}</Text>
            <Text style={[
              styles.challengeStatus,
              noSpendWeekProgress === 100 ? styles.statusCompleted : styles.statusActive
            ]}>
              {noSpendWeekProgress === 100 ? t.completed : t.active}
            </Text>
          </View>
          <Text style={styles.challengeDesc}>{t.noSpendDesc}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${noSpendWeekProgress}%`, backgroundColor: noSpendWeekProgress === 100 ? colors.accent : colors.primary }]} />
            </View>
            <Text style={styles.progressText}>{noSpendWeekProgress}%</Text>
          </View>
        </View>

        {/* SECTION 2: BADGES */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t.badges}</Text>
        <View style={styles.badgesGrid}>
          {/* Badge 1 */}
          <View style={[styles.badgeCard, !badgeFirstStep && styles.badgeLocked]}>
            <View style={[styles.badgeIconWrap, badgeFirstStep ? styles.iconActive : styles.iconLocked]}>
              <MaterialIcons name="flag" size={32} color={badgeFirstStep ? '#fff' : colors.textTertiary} />
            </View>
            <Text style={styles.badgeName}>{t.firstStepTitle}</Text>
            <Text style={styles.badgeDesc}>{t.firstStepDesc}</Text>
          </View>

          {/* Badge 2 */}
          <View style={[styles.badgeCard, !badgePlanMaster && styles.badgeLocked]}>
            <View style={[styles.badgeIconWrap, badgePlanMaster ? styles.iconActive : styles.iconLocked]}>
              <MaterialIcons name="trending-up" size={32} color={badgePlanMaster ? '#fff' : colors.textTertiary} />
            </View>
            <Text style={styles.badgeName}>{t.planMasterTitle}</Text>
            <Text style={styles.badgeDesc}>{t.planMasterDesc}</Text>
          </View>

          {/* Badge 3 */}
          <View style={[styles.badgeCard, !badgeBudgetMaster && styles.badgeLocked]}>
            <View style={[styles.badgeIconWrap, badgeBudgetMaster ? styles.iconActive : styles.iconLocked]}>
              <MaterialIcons name="security" size={32} color={badgeBudgetMaster ? '#fff' : colors.textTertiary} />
            </View>
            <Text style={styles.badgeName}>{t.budgetMasterTitle}</Text>
            <Text style={styles.badgeDesc}>{t.budgetMasterDesc}</Text>
          </View>

          {/* Badge 4 */}
          <View style={[styles.badgeCard, !badgeFrugalHero && styles.badgeLocked]}>
            <View style={[styles.badgeIconWrap, badgeFrugalHero ? styles.iconActive : styles.iconLocked]}>
              <MaterialIcons name="emoji-events" size={32} color={badgeFrugalHero ? '#fff' : colors.textTertiary} />
            </View>
            <Text style={styles.badgeName}>{t.frugalHeroTitle}</Text>
            <Text style={styles.badgeDesc}>{t.frugalHeroDesc}</Text>
          </View>

          {/* Badge 5 */}
          <View style={[styles.badgeCard, !badgeConsistency && styles.badgeLocked]}>
            <View style={[styles.badgeIconWrap, badgeConsistency ? styles.iconActive : styles.iconLocked]}>
              <MaterialIcons name="calendar-today" size={32} color={badgeConsistency ? '#fff' : colors.textTertiary} />
            </View>
            <Text style={styles.badgeName}>{t.consistencyTitle}</Text>
            <Text style={styles.badgeDesc}>{t.consistencyDesc}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 14,
    textAlign: 'left',
  },
  challengeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  challengeName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  challengeStatus: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusActive: {
    backgroundColor: colors.primary + '12',
    color: colors.primary,
  },
  statusCompleted: {
    backgroundColor: '#FFF9E6',
    color: colors.accent,
  },
  challengeDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'left',
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.textSecondary,
    width: 32,
    textAlign: 'right',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  badgeCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
    marginBottom: 8,
  },
  badgeLocked: {
    opacity: 0.6,
  },
  badgeIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconActive: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  iconLocked: {
    backgroundColor: colors.surfaceAlt,
  },
  badgeName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
  badgeDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
