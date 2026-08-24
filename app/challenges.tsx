import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  TextInput,
  Share,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTransactions } from '@/lib/TransactionContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { getFinancialPlan } from '@/lib/planStorage';
import { getBudgetsForWallet } from '@/lib/budgetStorage';
import { expenseCategories, formatCurrency } from '@/lib/categories';
import {
  CustomChallenge,
  getCustomChallenges,
  saveCustomChallenge,
  deleteCustomChallenge,
  getClaimedDailyQuests,
  claimDailyQuest,
  getBonusXP,
  addBonusXP,
  getUserLevel,
  calculateStreak,
  calculateWalletHealth,
} from '@/lib/gamificationStorage';

type ActiveTab = 'challenges' | 'quests' | 'badges';

export default function ChallengesScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const insets = useSafeAreaInsets();
  const { transactions, wallets, selectedWallet, selectWallet, currencySymbol, currencyCode } = useTransactions();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  // Selected filter wallet ('all' or wallet id)
  const [filterWalletId, setFilterWalletId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<ActiveTab>('challenges');

  // Gamification state
  const [customChallenges, setCustomChallenges] = useState<CustomChallenge[]>([]);
  const [claimedQuests, setClaimedQuests] = useState<string[]>([]);
  const [bonusXP, setBonusXP] = useState<number>(0);
  const [hasPlan, setHasPlan] = useState(false);
  const [hasBudgets, setHasBudgets] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBadgeForDetail, setSelectedBadgeForDetail] = useState<any | null>(null);

  // New Custom Challenge Form
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeType, setChallengeType] = useState<'limit_spend' | 'target_savings'>('limit_spend');
  const [challengeTargetAmount, setChallengeTargetAmount] = useState('');
  const [challengeDays, setChallengeDays] = useState('7');
  const [challengeCategory, setChallengeCategory] = useState('shopping');
  const [challengeWallet, setChallengeWallet] = useState('all');

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Filter transactions based on wallet selection
  const activeWalletTransactions = useMemo(() => {
    if (filterWalletId === 'all') return transactions;
    return transactions.filter(t => t.walletId === filterWalletId);
  }, [transactions, filterWalletId]);

  const activeWalletIncome = useMemo(() => {
    return activeWalletTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [activeWalletTransactions]);

  const activeWalletExpense = useMemo(() => {
    return activeWalletTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [activeWalletTransactions]);

  // Load custom challenges and quests data
  const loadGamificationData = useCallback(async () => {
    const [cChallenges, claimed, bXP] = await Promise.all([
      getCustomChallenges(),
      getClaimedDailyQuests(todayKey),
      getBonusXP(),
    ]);
    setCustomChallenges(cChallenges);
    setClaimedQuests(claimed);
    setBonusXP(bXP);

    if (selectedWallet) {
      const plan = await getFinancialPlan(selectedWallet.id);
      setHasPlan(!!plan);
      const budgetsList = await getBudgetsForWallet(selectedWallet.id);
      setHasBudgets(budgetsList && Object.keys(budgetsList).length > 0);
    }
  }, [todayKey, selectedWallet]);

  useEffect(() => {
    loadGamificationData();
  }, [loadGamificationData]);

  // Calculations
  const streakDays = useMemo(() => calculateStreak(transactions), [transactions]);

  // --- Dynamic Built-in Challenges ---
  // 1. Coffee Saver Challenge: No shopping or entertainment in last 5 days
  const coffeeProgress = useMemo(() => {
    const nonEssentialCats = ['shopping', 'entertainment'];
    const now = new Date();
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(now.getDate() - 5);

    const nonEssentialTx = activeWalletTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return tx.type === 'expense' && nonEssentialCats.includes(tx.category) && txDate >= fiveDaysAgo;
    });

    if (nonEssentialTx.length === 0 && activeWalletTransactions.length > 0) return 100;
    return Math.max(0, 100 - nonEssentialTx.length * 20);
  }, [activeWalletTransactions]);

  // 2. 50% Savings Challenge: save >= 50% of income
  const savingsChallengeProgress = useMemo(() => {
    if (activeWalletIncome <= 0) return 0;
    const actualSavings = activeWalletIncome - activeWalletExpense;
    const savingsRatio = actualSavings / activeWalletIncome;
    return Math.min(100, Math.max(0, Math.round((savingsRatio / 0.5) * 100)));
  }, [activeWalletIncome, activeWalletExpense]);

  // 3. No-Spend Week: non-essential expenses < 15 KWD or equivalent in 7 days
  const noSpendWeekProgress = useMemo(() => {
    const essentialCategories = ['rent', 'bills', 'health', 'education', 'salary', 'freelance', 'investment', 'gift', 'bonus', 'jameya_savings', 'debt_loan'];
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const nonEssentialTotal = activeWalletTransactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return tx.type === 'expense' && !essentialCategories.includes(tx.category) && txDate >= sevenDaysAgo;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const limit = currencyCode === 'KWD' || currencyCode === 'BHD' || currencyCode === 'OMR' ? 15 : 150;
    if (nonEssentialTotal === 0 && activeWalletTransactions.length > 0) return 100;
    if (nonEssentialTotal >= limit) return 0;
    return Math.round(((limit - nonEssentialTotal) / limit) * 100);
  }, [activeWalletTransactions, currencyCode]);

  // 4. Budget Guardian Challenge (Spend < 85% of total budget/income)
  const budgetDisciplineProgress = useMemo(() => {
    if (activeWalletIncome <= 0) return 50;
    const ratio = activeWalletExpense / activeWalletIncome;
    if (ratio <= 0.7) return 100;
    if (ratio >= 1.0) return 0;
    return Math.round((1 - (ratio - 0.7) / 0.3) * 100);
  }, [activeWalletIncome, activeWalletExpense]);

  // --- Dynamic Badges Calculations ---
  const badgeFirstStepCount = transactions.length;
  const badgeFirstStepTier = badgeFirstStepCount >= 100 ? 4 : badgeFirstStepCount >= 30 ? 3 : badgeFirstStepCount >= 5 ? 2 : badgeFirstStepCount >= 1 ? 1 : 0;
  const badgePlanMaster = hasPlan;
  const badgeBudgetMaster = hasBudgets;
  const badgeFrugalHero = activeWalletIncome > 0 && (activeWalletExpense / activeWalletIncome) <= 0.5;
  const badgeStreakTier = streakDays >= 30 ? 4 : streakDays >= 14 ? 3 : streakDays >= 7 ? 2 : streakDays >= 3 ? 1 : 0;
  const badgeMultiWallet = wallets.length >= 2;
  const badgeCustomChampion = customChallenges.length >= 1;

  // Total XP Calculation
  const totalXP = useMemo(() => {
    let xp = transactions.length * 10;
    if (coffeeProgress === 100) xp += 150;
    if (savingsChallengeProgress === 100) xp += 200;
    if (noSpendWeekProgress === 100) xp += 150;
    if (budgetDisciplineProgress === 100) xp += 200;
    xp += claimedQuests.length * 30;
    xp += streakDays * 25;
    xp += badgeFirstStepTier * 100;
    if (badgePlanMaster) xp += 150;
    if (badgeBudgetMaster) xp += 150;
    if (badgeFrugalHero) xp += 200;
    xp += badgeStreakTier * 120;
    if (badgeMultiWallet) xp += 100;
    xp += bonusXP;
    return xp;
  }, [
    transactions.length,
    coffeeProgress,
    savingsChallengeProgress,
    noSpendWeekProgress,
    budgetDisciplineProgress,
    claimedQuests.length,
    streakDays,
    badgeFirstStepTier,
    badgePlanMaster,
    badgeBudgetMaster,
    badgeFrugalHero,
    badgeStreakTier,
    badgeMultiWallet,
    bonusXP,
  ]);

  const levelInfo = useMemo(() => getUserLevel(totalXP), [totalXP]);

  // Wallet Health
  const walletHealth = useMemo(() => {
    return calculateWalletHealth(activeWalletTransactions, activeWalletIncome, activeWalletExpense);
  }, [activeWalletTransactions, activeWalletIncome, activeWalletExpense]);

  // Daily Quests Definition
  const dailyQuests = useMemo(() => {
    const todayTxs = transactions.filter(t => {
      const d = new Date(t.date);
      return (
        d.getFullYear() === new Date().getFullYear() &&
        d.getMonth() === new Date().getMonth() &&
        d.getDate() === new Date().getDate()
      );
    });

    const hasLoggedToday = todayTxs.length > 0;
    const hasNoShoppingToday = !todayTxs.some(t => t.type === 'expense' && (t.category === 'shopping' || t.category === 'entertainment'));

    return [
      {
        id: 'quest_log_tx',
        titleAr: 'تسجيل معاملة اليوم',
        titleEn: "Log Today's Transaction",
        descAr: 'سجل مصاريفك أو دخلك اليوم لتبقى حساباتك دقيقة',
        descEn: 'Log your daily expense or income to keep your balance accurate',
        xp: 25,
        icon: 'create-outline',
        completed: hasLoggedToday,
        claimed: claimedQuests.includes('quest_log_tx'),
      },
      {
        id: 'quest_no_shopping',
        titleAr: 'يوم بلا تسوق عاطفي',
        titleEn: 'Zero Shopping Day',
        descAr: 'تجنب الصرف على كماليات التسوق والترفيه اليوم',
        descEn: 'Avoid spending on shopping or luxury entertainment today',
        xp: 30,
        icon: 'cart-outline',
        completed: hasNoShoppingToday,
        claimed: claimedQuests.includes('quest_no_shopping'),
      },
      {
        id: 'quest_check_wallets',
        titleAr: 'مراجعة أرصدة المحافظ',
        titleEn: 'Check Wallet Balances',
        descAr: 'تفقد صحة وتوازن محافظك المالية',
        descEn: 'Review the health and balance of your wallets',
        xp: 15,
        icon: 'wallet-outline',
        completed: true,
        claimed: claimedQuests.includes('quest_check_wallets'),
      },
      {
        id: 'quest_daily_wisdom',
        titleAr: 'الحكمة المالية اليومية',
        titleEn: 'Daily Financial Wisdom',
        descAr: 'القاعدة الذهبية: "لا توفر ما يتبقى بعد الصرف، بل اصرف ما يتبقى بعد التوفير"',
        descEn: '"Do not save what is left after spending, but spend what is left after saving"',
        xp: 20,
        icon: 'bulb-outline',
        completed: true,
        claimed: claimedQuests.includes('quest_daily_wisdom'),
      },
    ];
  }, [transactions, claimedQuests]);

  const handleClaimQuest = async (questId: string, xpReward: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await claimDailyQuest(questId, todayKey);
    await addBonusXP(xpReward);
    await loadGamificationData();
  };

  const handleCreateCustomChallenge = async () => {
    if (!challengeTitle.trim()) {
      Alert.alert(isAr ? 'تنبيه' : 'Alert', isAr ? 'يرجى إدخال اسم التحدي' : 'Please enter challenge title');
      return;
    }

    const amount = parseFloat(challengeTargetAmount) || 50;
    const days = parseInt(challengeDays, 10) || 7;

    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const newChallenge: CustomChallenge = {
      id: `custom_${Date.now()}`,
      title: challengeTitle.trim(),
      description: isAr
        ? `الالتزام بحد ${amount} ${currencySymbol} خلال ${days} أيام`
        : `Limit spending to ${amount} ${currencySymbol} for ${days} days`,
      walletId: challengeWallet,
      categoryId: challengeCategory,
      type: challengeType,
      targetAmount: amount,
      targetDays: days,
      startDate,
      endDate,
      xpReward: Math.min(500, Math.max(100, days * 25 + Math.round(amount / 10))),
      createdAt: new Date().toISOString(),
    };

    await saveCustomChallenge(newChallenge);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowCreateModal(false);
    setChallengeTitle('');
    setChallengeTargetAmount('');
    loadGamificationData();
  };

  const handleDeleteCustomChallenge = async (id: string) => {
    Haptics.selectionAsync();
    Alert.alert(
      isAr ? 'حذف التحدي' : 'Delete Challenge',
      isAr ? 'هل أنت متأكد من حذف هذا التحدي؟' : 'Are you sure you want to delete this challenge?',
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAr ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomChallenge(id);
            loadGamificationData();
          },
        },
      ]
    );
  };

  const handleShareBadge = async (badge: any) => {
    Haptics.selectionAsync();
    const message = isAr
      ? `🎉 حققت إنجاز [${badge.nameAr}] في تطبيق ميزان!\n🏆 المستوى المالي الحالي: ${levelInfo.current.titleAr}\n🔥 سلسلة الالتزام: ${streakDays} أيام متواصلة.\n#ميزان #إدارة_المصاريف`
      : `🎉 I unlocked [${badge.nameEn}] badge on Mizan App!\n🏆 Financial Level: ${levelInfo.current.titleEn}\n🔥 Active Streak: ${streakDays} consecutive days.\n#Mizan #ExpenseTracker`;

    try {
      await Share.share({ message });
    } catch {}
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  // Translations
  const t = {
    title: isAr ? 'التحديات والمستويات' : 'Challenges & Levels',
    allWallets: isAr ? 'جميع المحافظ' : 'All Wallets',
    healthTitle: isAr ? 'مؤشر صحة المحفظة' : 'Wallet Health Score',
    tabChallenges: isAr ? 'تحديات الادخار' : 'Challenges',
    tabQuests: isAr ? 'المهام اليومية' : 'Daily Quests',
    tabBadges: isAr ? 'خزانة الأوسمة' : 'Badges',
    streakLabel: isAr ? 'سلسلة الالتزام' : 'Streak',
    streakDays: isAr ? `${streakDays} أيام 🔥` : `${streakDays} Days 🔥`,
    streakSub: isAr ? 'استمر في تسجيل معاملاتك يومياً لرفع رتبتك' : 'Keep logging transactions to maintain your streak',
    levelLabel: isAr ? `المستوى ${levelInfo.current.level}` : `Level ${levelInfo.current.level}`,
    xpToNext: levelInfo.next
      ? (isAr ? `${levelInfo.next.minXP - totalXP} XP للمستوى التالي` : `${levelInfo.next.minXP - totalXP} XP to Next Level`)
      : (isAr ? 'وصلت للحد الأقصى!' : 'Max Level Reached!'),
    createChallenge: isAr ? '+ تحدي مخصص' : '+ Custom Challenge',
    customChallengesHeader: isAr ? 'تحدياتك المخصصة' : 'Your Custom Challenges',
    noCustomChallenges: isAr ? 'لم تنشئ أي تحدٍ مخصص بعد. اضغط على الزر بالأعلى للبدء!' : 'No custom challenges yet. Tap above to create one!',
    claim: isAr ? 'استلام' : 'Claim',
    claimed: isAr ? 'تم الاستلام ✓' : 'Claimed ✓',
    active: isAr ? 'نشط' : 'Active',
    completed: isAr ? 'مكتمل 🎉' : 'Completed 🎉',
  };

  // Tiered Badges List
  const badgesList = [
    {
      id: 'first_step',
      nameAr: 'الخطوة الأولى',
      nameEn: 'First Steps',
      descAr: 'سجل معاملاتك بانتظام (1 / 5 / 30 / 100 معاملة)',
      descEn: 'Log transactions regularly (1 / 5 / 30 / 100 txs)',
      icon: 'flag',
      tier: badgeFirstStepTier,
      progress: Math.min(100, Math.round((badgeFirstStepCount / 30) * 100)),
      unlocked: badgeFirstStepTier > 0,
      rewardXP: 100,
    },
    {
      id: 'consistency_streak',
      nameAr: 'سيد الالتزام',
      nameEn: 'Streak Master',
      descAr: 'حافظ على سلسلة أيام متتالية (3 / 7 / 14 / 30 يوماً)',
      descEn: 'Maintain consecutive active days (3 / 7 / 14 / 30 days)',
      icon: 'flame',
      tier: badgeStreakTier,
      progress: Math.min(100, Math.round((streakDays / 14) * 100)),
      unlocked: badgeStreakTier > 0,
      rewardXP: 150,
    },
    {
      id: 'plan_master',
      nameAr: 'خبير التخطيط',
      nameEn: 'Planning Master',
      descAr: 'قم بإعداد خطة مالية واضحة ومدروسة لمحفظتك',
      descEn: 'Create a customized financial plan for your wallet',
      icon: 'trending-up',
      tier: badgePlanMaster ? 3 : 0,
      progress: badgePlanMaster ? 100 : 0,
      unlocked: badgePlanMaster,
      rewardXP: 150,
    },
    {
      id: 'budget_master',
      nameAr: 'حارس الميزانية',
      nameEn: 'Budget Guardian',
      descAr: 'حدد ميزانيات للأقسام لتتحكم بالإنفاق بصرامة',
      descEn: 'Set category budgets to control spending strictly',
      icon: 'shield-checkmark',
      tier: badgeBudgetMaster ? 3 : 0,
      progress: badgeBudgetMaster ? 100 : 0,
      unlocked: badgeBudgetMaster,
      rewardXP: 150,
    },
    {
      id: 'frugal_hero',
      nameAr: 'المقتصد البطل',
      nameEn: 'Frugal Hero',
      descAr: 'وفر 50% أو أكثر من إجمالي دخلك في هذه المحفظة',
      descEn: 'Save 50% or more of your total income in this wallet',
      icon: 'trophy',
      tier: badgeFrugalHero ? 4 : 0,
      progress: badgeFrugalHero ? 100 : Math.min(100, savingsChallengeProgress),
      unlocked: badgeFrugalHero,
      rewardXP: 200,
    },
    {
      id: 'multi_wallet',
      nameAr: 'قائد المحافظ',
      nameEn: 'Wallet Commander',
      descAr: 'إدارة وتخصيص محفظتين ماليتين أو أكثر بنجاح',
      descEn: 'Manage two or more distinct financial wallets',
      icon: 'briefcase',
      tier: badgeMultiWallet ? 3 : 0,
      progress: badgeMultiWallet ? 100 : 50,
      unlocked: badgeMultiWallet,
      rewardXP: 100,
    },
  ];

  return (
    <View style={styles.container}>
      {/* HEADER ROW */}
      <View style={[styles.headerRow, { paddingTop: (insets.top || (Platform.OS === 'web' ? 10 : 0)) + 12 }]}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t.title}</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setShowCreateModal(true);
          }}
          style={styles.headerActionBtn}
        >
          <Ionicons name="add-circle" size={26} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 60 }]}>
        {/* 1. HERO GAMIFICATION LEVEL CARD */}
        <LinearGradient
          colors={theme === 'dark' || theme === 'midnight' ? ['#1E1B4B', '#312E81', '#4338CA'] : ['#4F46E5', '#6366F1', '#818CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.levelBadgeContainer}>
              <View style={[styles.levelIconCircle, { backgroundColor: levelInfo.current.color + '33' }]}>
                <Ionicons name={levelInfo.current.icon as any} size={24} color="#FDE047" />
              </View>
              <View>
                <Text style={styles.heroLevelTag}>{t.levelLabel}</Text>
                <Text style={styles.heroLevelTitle}>{isAr ? levelInfo.current.titleAr : levelInfo.current.titleEn}</Text>
              </View>
            </View>

            <View style={styles.heroStreakBadge}>
              <Ionicons name="flame" size={18} color="#F97316" />
              <Text style={styles.heroStreakText}>{t.streakDays}</Text>
            </View>
          </View>

          {/* XP Progress Bar */}
          <View style={styles.xpProgressContainer}>
            <View style={styles.xpTextRow}>
              <Text style={styles.xpTotalText}>{totalXP} XP</Text>
              <Text style={styles.xpNextText}>{t.xpToNext}</Text>
            </View>
            <View style={styles.xpProgressBarBg}>
              <View style={[styles.xpProgressBarFill, { width: `${levelInfo.progress}%` }]} />
            </View>
          </View>
        </LinearGradient>

        {/* 2. WALLET SELECTOR & HEALTH SCORE */}
        <View style={styles.walletFilterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.walletFilterScroll}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setFilterWalletId('all');
              }}
              style={[styles.walletChip, filterWalletId === 'all' && styles.walletChipActive]}
            >
              <Ionicons name="globe-outline" size={16} color={filterWalletId === 'all' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.walletChipText, filterWalletId === 'all' && styles.walletChipTextActive]}>
                {t.allWallets}
              </Text>
            </Pressable>

            {wallets.map(w => {
              const isSelected = filterWalletId === w.id;
              return (
                <Pressable
                  key={w.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFilterWalletId(w.id);
                  }}
                  style={[styles.walletChip, isSelected && { backgroundColor: w.color, borderColor: w.color }]}
                >
                  <View style={[styles.walletDot, { backgroundColor: isSelected ? '#fff' : w.color }]} />
                  <Text style={[styles.walletChipText, isSelected && styles.walletChipTextActive]}>{w.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Wallet Health Bar */}
          <View style={styles.healthScoreCard}>
            <View style={styles.healthScoreHeader}>
              <View style={styles.healthLeft}>
                <View style={[styles.healthBadge, { backgroundColor: walletHealth.color + '22' }]}>
                  <Text style={[styles.healthGradeText, { color: walletHealth.color }]}>{walletHealth.grade}</Text>
                </View>
                <View>
                  <Text style={styles.healthTitle}>{t.healthTitle}</Text>
                  <Text style={[styles.healthSubtitle, { color: walletHealth.color }]}>
                    {isAr ? walletHealth.labelAr : walletHealth.labelEn}
                  </Text>
                </View>
              </View>
              <Text style={[styles.healthScoreNumber, { color: walletHealth.color }]}>{walletHealth.score}%</Text>
            </View>
          </View>
        </View>

        {/* 3. TABS SELECTOR */}
        <View style={styles.tabsRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('challenges');
            }}
            style={[styles.tabBtn, activeTab === 'challenges' && styles.tabBtnActive]}
          >
            <Ionicons
              name="trophy-outline"
              size={18}
              color={activeTab === 'challenges' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'challenges' && styles.tabTextActive]}>{t.tabChallenges}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('quests');
            }}
            style={[styles.tabBtn, activeTab === 'quests' && styles.tabBtnActive]}
          >
            <Ionicons
              name="flash-outline"
              size={18}
              color={activeTab === 'quests' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'quests' && styles.tabTextActive]}>{t.tabQuests}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('badges');
            }}
            style={[styles.tabBtn, activeTab === 'badges' && styles.tabBtnActive]}
          >
            <Ionicons
              name="ribbon-outline"
              size={18}
              color={activeTab === 'badges' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'badges' && styles.tabTextActive]}>{t.tabBadges}</Text>
          </Pressable>
        </View>

        {/* TAB 1: SAVINGS CHALLENGES */}
        {activeTab === 'challenges' && (
          <View style={styles.tabContentContainer}>
            {/* Built-in Dynamic Challenge 1 */}
            <View style={styles.challengeCard}>
              <View style={styles.challengeHeader}>
                <View style={styles.challengeTitleRow}>
                  <Text style={styles.challengeIconEmoji}>☕</Text>
                  <View>
                    <Text style={styles.challengeName}>
                      {isAr ? 'تحدي الكوب الموفر' : 'Coffee Saver Challenge'}
                    </Text>
                    <Text style={styles.challengeReward}>+150 XP</Text>
                  </View>
                </View>
                <View style={[styles.statusTag, coffeeProgress === 100 ? styles.statusCompletedBg : styles.statusActiveBg]}>
                  <Text style={[styles.statusTagText, coffeeProgress === 100 ? styles.statusCompletedText : styles.statusActiveText]}>
                    {coffeeProgress === 100 ? t.completed : t.active}
                  </Text>
                </View>
              </View>
              <Text style={styles.challengeDesc}>
                {isAr
                  ? 'تجنب الصرف على المقاهي والتسوق لمدة 5 أيام متتالية لترشيد مصروفاتك.'
                  : 'Avoid spending on cafes & shopping for 5 consecutive days.'}
              </Text>
              <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${coffeeProgress}%`, backgroundColor: coffeeProgress === 100 ? '#10B981' : colors.primary },
                    ]}
                  />
                </View>
                <Text style={styles.progressPercent}>{coffeeProgress}%</Text>
              </View>
            </View>

            {/* Built-in Dynamic Challenge 2 */}
            <View style={styles.challengeCard}>
              <View style={styles.challengeHeader}>
                <View style={styles.challengeTitleRow}>
                  <Text style={styles.challengeIconEmoji}>🎯</Text>
                  <View>
                    <Text style={styles.challengeName}>
                      {isAr ? 'تحدي ادخار الـ 50%' : '50% Savings Challenge'}
                    </Text>
                    <Text style={styles.challengeReward}>+200 XP</Text>
                  </View>
                </View>
                <View style={[styles.statusTag, savingsChallengeProgress === 100 ? styles.statusCompletedBg : styles.statusActiveBg]}>
                  <Text style={[styles.statusTagText, savingsChallengeProgress === 100 ? styles.statusCompletedText : styles.statusActiveText]}>
                    {savingsChallengeProgress === 100 ? t.completed : t.active}
                  </Text>
                </View>
              </View>
              <Text style={styles.challengeDesc}>
                {isAr
                  ? 'ادخر ما لا يقل عن 50% من إجمالي دخلك لهذا الشهر في هذه المحفظة.'
                  : 'Save at least 50% of your total income this month in this wallet.'}
              </Text>
              <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${savingsChallengeProgress}%`, backgroundColor: savingsChallengeProgress === 100 ? '#10B981' : colors.primary },
                    ]}
                  />
                </View>
                <Text style={styles.progressPercent}>{savingsChallengeProgress}%</Text>
              </View>
            </View>

            {/* Built-in Dynamic Challenge 3 */}
            <View style={styles.challengeCard}>
              <View style={styles.challengeHeader}>
                <View style={styles.challengeTitleRow}>
                  <Text style={styles.challengeIconEmoji}>💸</Text>
                  <View>
                    <Text style={styles.challengeName}>
                      {isAr ? 'أسبوع بلا إسراف' : 'No-Spend Week'}
                    </Text>
                    <Text style={styles.challengeReward}>+150 XP</Text>
                  </View>
                </View>
                <View style={[styles.statusTag, noSpendWeekProgress === 100 ? styles.statusCompletedBg : styles.statusActiveBg]}>
                  <Text style={[styles.statusTagText, noSpendWeekProgress === 100 ? styles.statusCompletedText : styles.statusActiveText]}>
                    {noSpendWeekProgress === 100 ? t.completed : t.active}
                  </Text>
                </View>
              </View>
              <Text style={styles.challengeDesc}>
                {isAr
                  ? `حافظ على مصاريفك غير الضرورية تحت ${currencyCode === 'KWD' ? '15 د.ك' : '150 ' + currencySymbol} لمدة 7 أيام.`
                  : `Keep non-essential expenses strictly under limit for 7 days.`}
              </Text>
              <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${noSpendWeekProgress}%`, backgroundColor: noSpendWeekProgress === 100 ? '#10B981' : colors.primary },
                    ]}
                  />
                </View>
                <Text style={styles.progressPercent}>{noSpendWeekProgress}%</Text>
              </View>
            </View>

            {/* Built-in Dynamic Challenge 4: Budget Guardian */}
            <View style={styles.challengeCard}>
              <View style={styles.challengeHeader}>
                <View style={styles.challengeTitleRow}>
                  <Text style={styles.challengeIconEmoji}>🛡️</Text>
                  <View>
                    <Text style={styles.challengeName}>
                      {isAr ? 'الانضباط المالي الشامل' : 'Total Financial Discipline'}
                    </Text>
                    <Text style={styles.challengeReward}>+200 XP</Text>
                  </View>
                </View>
                <View style={[styles.statusTag, budgetDisciplineProgress === 100 ? styles.statusCompletedBg : styles.statusActiveBg]}>
                  <Text style={[styles.statusTagText, budgetDisciplineProgress === 100 ? styles.statusCompletedText : styles.statusActiveText]}>
                    {budgetDisciplineProgress === 100 ? t.completed : t.active}
                  </Text>
                </View>
              </View>
              <Text style={styles.challengeDesc}>
                {isAr
                  ? 'إبقاء إجمالي المصاريف الشهرية تحت 70% من الدخل لتحقيق فائض مالي ممتاز.'
                  : 'Keep total monthly expenses under 70% of total income to secure financial surplus.'}
              </Text>
              <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${budgetDisciplineProgress}%`, backgroundColor: budgetDisciplineProgress === 100 ? '#10B981' : colors.primary },
                    ]}
                  />
                </View>
                <Text style={styles.progressPercent}>{budgetDisciplineProgress}%</Text>
              </View>
            </View>

            {/* Custom User Challenges Section */}
            <View style={styles.customSectionHeaderRow}>
              <Text style={styles.customSectionTitle}>{t.customChallengesHeader}</Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowCreateModal(true);
                }}
                style={styles.addChallengeBtn}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addChallengeBtnText}>{isAr ? 'إنشاء تحدٍ' : 'New Challenge'}</Text>
              </Pressable>
            </View>

            {customChallenges.length === 0 ? (
              <View style={styles.emptyCustomBox}>
                <Ionicons name="game-controller-outline" size={36} color={colors.textTertiary} />
                <Text style={styles.emptyCustomText}>{t.noCustomChallenges}</Text>
              </View>
            ) : (
              customChallenges.map(c => {
                return (
                  <View key={c.id} style={styles.challengeCard}>
                    <View style={styles.challengeHeader}>
                      <View style={styles.challengeTitleRow}>
                        <Text style={styles.challengeIconEmoji}>🌟</Text>
                        <View>
                          <Text style={styles.challengeName}>{c.title}</Text>
                          <Text style={styles.challengeReward}>+{c.xpReward} XP</Text>
                        </View>
                      </View>
                      <Pressable onPress={() => handleDeleteCustomChallenge(c.id)} hitSlop={10}>
                        <Ionicons name="trash-outline" size={20} color={colors.expense} />
                      </Pressable>
                    </View>
                    <Text style={styles.challengeDesc}>{c.description}</Text>
                    <View style={styles.customChallengeFooter}>
                      <Text style={styles.customChallengeDays}>
                        {isAr ? `المدة: ${c.targetDays} أيام` : `Duration: ${c.targetDays} days`}
                      </Text>
                      <View style={styles.statusActiveBg}>
                        <Text style={styles.statusActiveText}>{t.active}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 2: DAILY QUESTS */}
        {activeTab === 'quests' && (
          <View style={styles.tabContentContainer}>
            <View style={styles.questsNoticeBox}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.questsNoticeText}>
                {isAr
                  ? 'تتجدد هذه المهام يومياً لكسب نقاط XP ورفع مستواك المالي.'
                  : 'Daily quests reset every day to earn XP and level up faster.'}
              </Text>
            </View>

            {dailyQuests.map(q => {
              return (
                <View key={q.id} style={styles.questCard}>
                  <View style={styles.questLeft}>
                    <View style={[styles.questIconBox, q.completed && styles.questIconBoxCompleted]}>
                      <Ionicons
                        name={q.icon as any}
                        size={22}
                        color={q.completed ? '#10B981' : colors.textSecondary}
                      />
                    </View>
                    <View style={styles.questInfo}>
                      <Text style={styles.questTitle}>{isAr ? q.titleAr : q.titleEn}</Text>
                      <Text style={styles.questDesc}>{isAr ? q.descAr : q.descEn}</Text>
                    </View>
                  </View>

                  <View style={styles.questRight}>
                    <Text style={styles.questXPText}>+{q.xp} XP</Text>
                    {q.claimed ? (
                      <View style={styles.claimedQuestBadge}>
                        <Text style={styles.claimedQuestBadgeText}>{t.claimed}</Text>
                      </View>
                    ) : q.completed ? (
                      <Pressable
                        onPress={() => handleClaimQuest(q.id, q.xp)}
                        style={styles.claimQuestBtn}
                      >
                        <Text style={styles.claimQuestBtnText}>{t.claim}</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.lockedQuestBadge}>
                        <Ionicons name="lock-closed" size={14} color={colors.textTertiary} />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 3: TROPHY CABINET & BADGES */}
        {activeTab === 'badges' && (
          <View style={styles.tabContentContainer}>
            <View style={styles.badgesGrid}>
              {badgesList.map(b => {
                const tierColors = ['#9CA3AF', '#CD7F32', '#94A3B8', '#F59E0B', '#38BDF8'];
                const tierName =
                  b.tier === 4
                    ? (isAr ? 'ماسي 💎' : 'Diamond 💎')
                    : b.tier === 3
                    ? (isAr ? 'ذهبي 🥇' : 'Gold 🥇')
                    : b.tier === 2
                    ? (isAr ? 'فضي 🥈' : 'Silver 🥈')
                    : b.tier === 1
                    ? (isAr ? 'برونزي 🥉' : 'Bronze 🥉')
                    : (isAr ? 'مغلق 🔒' : 'Locked 🔒');

                return (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedBadgeForDetail(b);
                    }}
                    style={[styles.badgeCard, !b.unlocked && styles.badgeLocked]}
                  >
                    <View
                      style={[
                        styles.badgeIconWrap,
                        b.unlocked
                          ? { backgroundColor: tierColors[b.tier] || colors.primary }
                          : styles.badgeIconLockedBg,
                      ]}
                    >
                      <Ionicons
                        name={b.icon as any}
                        size={30}
                        color={b.unlocked ? '#FFFFFF' : colors.textTertiary}
                      />
                    </View>
                    <Text style={styles.badgeName}>{isAr ? b.nameAr : b.nameEn}</Text>
                    <View style={[styles.tierTag, { backgroundColor: (tierColors[b.tier] || '#6B7280') + '22' }]}>
                      <Text style={[styles.tierTagText, { color: tierColors[b.tier] || '#6B7280' }]}>
                        {tierName}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* CREATE CUSTOM CHALLENGE MODAL */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isAr ? '🎯 إنشاء تحدي جديد' : '🎯 Create New Challenge'}</Text>
              <Pressable onPress={() => setShowCreateModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              <Text style={styles.inputLabel}>{isAr ? 'اسم التحدي' : 'Challenge Name'}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={isAr ? 'مثال: تحدي تقليل المطاعم' : 'e.g. Reduce Dining Out Challenge'}
                placeholderTextColor={colors.textTertiary}
                value={challengeTitle}
                onChangeText={setChallengeTitle}
                textAlign={isAr ? 'right' : 'left'}
              />

              <Text style={styles.inputLabel}>{isAr ? 'المحفظة المستهدفة' : 'Target Wallet'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <Pressable
                  onPress={() => setChallengeWallet('all')}
                  style={[styles.modalChip, challengeWallet === 'all' && styles.modalChipActive]}
                >
                  <Text style={[styles.modalChipText, challengeWallet === 'all' && styles.modalChipTextActive]}>
                    {t.allWallets}
                  </Text>
                </Pressable>
                {wallets.map(w => (
                  <Pressable
                    key={w.id}
                    onPress={() => setChallengeWallet(w.id)}
                    style={[styles.modalChip, challengeWallet === w.id && styles.modalChipActive]}
                  >
                    <Text style={[styles.modalChipText, challengeWallet === w.id && styles.modalChipTextActive]}>
                      {w.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>{isAr ? 'الفئة المستهدفة' : 'Target Category'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {expenseCategories.slice(0, 8).map(cat => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setChallengeCategory(cat.id)}
                    style={[styles.modalChip, challengeCategory === cat.id && styles.modalChipActive]}
                  >
                    <Text style={[styles.modalChipText, challengeCategory === cat.id && styles.modalChipTextActive]}>
                      {isAr ? cat.nameAr : cat.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>
                {isAr ? `الحد الأقصى للمبلغ (${currencySymbol})` : `Max Target Amount (${currencySymbol})`}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="50"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={challengeTargetAmount}
                onChangeText={setChallengeTargetAmount}
                textAlign={isAr ? 'right' : 'left'}
              />

              <Text style={styles.inputLabel}>{isAr ? 'مدة التحدي' : 'Duration'}</Text>
              <View style={styles.durationRow}>
                {['3', '7', '14', '30'].map(days => (
                  <Pressable
                    key={days}
                    onPress={() => setChallengeDays(days)}
                    style={[styles.durationBtn, challengeDays === days && styles.durationBtnActive]}
                  >
                    <Text style={[styles.durationBtnText, challengeDays === days && styles.durationBtnTextActive]}>
                      {isAr ? `${days} أيام` : `${days} Days`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable onPress={handleCreateCustomChallenge} style={styles.modalSubmitBtn}>
              <Text style={styles.modalSubmitBtnText}>{isAr ? '🚀 إطلاق التحدي' : '🚀 Launch Challenge'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* BADGE DETAIL & SHARE MODAL */}
      <Modal visible={!!selectedBadgeForDetail} transparent animationType="fade" onRequestClose={() => setSelectedBadgeForDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <Pressable onPress={() => setSelectedBadgeForDetail(null)} style={styles.detailCloseBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>

            {selectedBadgeForDetail && (
              <View style={{ alignItems: 'center' }}>
                <View style={[styles.detailIconWrap, { backgroundColor: selectedBadgeForDetail.unlocked ? colors.accent : colors.surfaceAlt }]}>
                  <Ionicons
                    name={selectedBadgeForDetail.icon as any}
                    size={48}
                    color={selectedBadgeForDetail.unlocked ? '#fff' : colors.textTertiary}
                  />
                </View>

                <Text style={styles.detailBadgeTitle}>
                  {isAr ? selectedBadgeForDetail.nameAr : selectedBadgeForDetail.nameEn}
                </Text>
                <Text style={styles.detailBadgeDesc}>
                  {isAr ? selectedBadgeForDetail.descAr : selectedBadgeForDetail.descEn}
                </Text>

                <View style={styles.detailStatusRow}>
                  <Text style={styles.detailStatusLabel}>
                    {selectedBadgeForDetail.unlocked
                      ? (isAr ? 'الحالة: مكتمل ومفتوح 🎉' : 'Status: Unlocked 🎉')
                      : (isAr ? 'الحالة: قيد التقدم ⏳' : 'Status: In Progress ⏳')}
                  </Text>
                </View>

                <Pressable
                  onPress={() => handleShareBadge(selectedBadgeForDetail)}
                  style={styles.shareBadgeBtn}
                >
                  <Ionicons name="share-social-outline" size={20} color="#fff" />
                  <Text style={styles.shareBadgeBtnText}>{isAr ? 'مشاركة الإنجاز' : 'Share Achievement'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, theme: string) =>
  StyleSheet.create({
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
      zIndex: 10,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    headerTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 19,
      color: colors.text,
    },
    headerActionBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      padding: 16,
    },
    // HERO CARD
    heroCard: {
      borderRadius: 22,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    levelBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    levelIconCircle: {
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroLevelTag: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: '#E0E7FF',
    },
    heroLevelTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 17,
      color: '#FFFFFF',
    },
    heroStreakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    heroStreakText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#FFFFFF',
    },
    xpProgressContainer: {
      gap: 6,
    },
    xpTextRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    xpTotalText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: '#FDE047',
    },
    xpNextText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: '#E0E7FF',
    },
    xpProgressBarBg: {
      height: 9,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      borderRadius: 5,
      overflow: 'hidden',
    },
    xpProgressBarFill: {
      height: 9,
      backgroundColor: '#FDE047',
      borderRadius: 5,
    },
    // WALLET FILTER SECTION
    walletFilterSection: {
      marginBottom: 16,
      gap: 10,
    },
    walletFilterScroll: {
      gap: 8,
      paddingVertical: 2,
    },
    walletChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    walletChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    walletDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    walletChipText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
    },
    walletChipTextActive: {
      color: '#FFFFFF',
      fontFamily: 'Cairo_700Bold',
    },
    // HEALTH SCORE
    healthScoreCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    healthScoreHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    healthLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    healthBadge: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    healthGradeText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
    },
    healthTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    healthSubtitle: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
    },
    healthScoreNumber: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
    },
    // TABS ROW
    tabsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 4,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
    },
    tabBtnActive: {
      backgroundColor: colors.surfaceAlt,
    },
    tabText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
    },
    tabTextActive: {
      fontFamily: 'Cairo_700Bold',
      color: colors.primary,
    },
    tabContentContainer: {
      gap: 12,
    },
    // CHALLENGE CARD
    challengeCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    challengeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    challengeTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    challengeIconEmoji: {
      fontSize: 24,
    },
    challengeName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
    },
    challengeReward: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.primary,
    },
    challengeDesc: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
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
    progressPercent: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.textSecondary,
      width: 36,
      textAlign: 'right',
    },
    statusTag: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusActiveBg: {
      backgroundColor: colors.primary + '18',
    },
    statusCompletedBg: {
      backgroundColor: '#10B98122',
    },
    statusTagText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
    },
    statusActiveText: {
      color: colors.primary,
    },
    statusCompletedText: {
      color: '#10B981',
    },
    // CUSTOM CHALLENGES
    customSectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    customSectionTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.text,
    },
    addChallengeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
    },
    addChallengeBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: '#fff',
    },
    emptyCustomBox: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 8,
    },
    emptyCustomText: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    customChallengeFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    customChallengeDays: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textTertiary,
    },
    // QUESTS
    questsNoticeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '12',
      padding: 12,
      borderRadius: 14,
      marginBottom: 4,
    },
    questsNoticeText: {
      flex: 1,
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.text,
      lineHeight: 18,
    },
    questCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    questLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    questIconBox: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surfaceAlt,
      justifyContent: 'center',
      alignItems: 'center',
    },
    questIconBoxCompleted: {
      backgroundColor: '#10B98122',
    },
    questInfo: {
      flex: 1,
    },
    questTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    questDesc: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    questRight: {
      alignItems: 'flex-end',
      gap: 6,
    },
    questXPText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.primary,
    },
    claimQuestBtn: {
      backgroundColor: '#10B981',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    claimQuestBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: '#fff',
    },
    claimedQuestBadge: {
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    claimedQuestBadgeText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    lockedQuestBadge: {
      backgroundColor: colors.surfaceAlt,
      padding: 6,
      borderRadius: 12,
    },
    // BADGES GRID
    badgesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    badgeCard: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 8,
    },
    badgeLocked: {
      opacity: 0.65,
    },
    badgeIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    badgeIconLockedBg: {
      backgroundColor: colors.surfaceAlt,
      elevation: 0,
      shadowOpacity: 0,
    },
    badgeName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
    },
    tierTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    tierTagText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
    },
    // MODALS
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: colors.text,
    },
    inputLabel: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    modalInput: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 14,
      color: colors.text,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    modalChip: {
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    modalChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    modalChipText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    modalChipTextActive: {
      color: '#fff',
      fontFamily: 'Cairo_700Bold',
    },
    durationRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    durationBtn: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: 8,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    durationBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    durationBtnText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    durationBtnTextActive: {
      color: '#fff',
      fontFamily: 'Cairo_700Bold',
    },
    modalSubmitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 6,
    },
    modalSubmitBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: '#fff',
    },
    // DETAIL BADGE CARD
    detailCard: {
      width: '88%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    detailCloseBtn: {
      alignSelf: 'flex-end',
    },
    detailIconWrap: {
      width: 90,
      height: 90,
      borderRadius: 45,
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
    },
    detailBadgeTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    detailBadgeDesc: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 16,
    },
    detailStatusRow: {
      marginBottom: 20,
    },
    detailStatusLabel: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
    },
    shareBadgeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 16,
    },
    shareBadgeBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: '#fff',
    },
  });
