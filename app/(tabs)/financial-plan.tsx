import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Modal,
  Switch,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTransactions } from '@/lib/TransactionContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { formatCurrency } from '@/lib/categories';
import { normalizeAmountInput } from '@/lib/arabicNumbers';
import { FinancialPlan, getFinancialPlan, saveFinancialPlan, deleteFinancialPlan, KakeiboBudgets, KakeiboReflection } from '@/lib/planStorage';
import { getGoals } from '@/lib/goalStorage';
import { getDebts } from '@/lib/debtStorage';
import { getRecurringTransactions, RecurringTransaction } from '@/lib/recurringStorage';
import { getInstallmentPlans, InstallmentPlan } from '@/lib/installmentStorage';
import { getJameyas, Jameya } from '@/lib/jameyaStorage';
import Svg, { Circle, Rect } from 'react-native-svg';
import Methodology3DSelector from '@/components/Methodology3DSelector';
import { KakeiboSection } from '@/components/financial-plan/KakeiboSection';
import { MonthlyBreakdownTimeline } from '@/components/financial-plan/MonthlyBreakdownTimeline';
import { AdjustPlanModal } from '@/components/financial-plan/AdjustPlanModal';
import { SingleMonthTargetModal } from '@/components/financial-plan/SingleMonthTargetModal';
import { KakeiboBudgetModal } from '@/components/financial-plan/KakeiboBudgetModal';
import { getFinancialPlanStyles } from '@/components/financial-plan/financialPlanStyles';

function getKakeiboPillar(categoryId: string): 'survival' | 'wants' | 'culture' | 'extra' {
  switch (categoryId) {
    case 'food':
    case 'transport':
    case 'bills':
    case 'health':
    case 'rent':
    case 'phone':
      return 'survival';
    case 'shopping':
    case 'entertainment':
    case 'clothes':
      return 'wants';
    case 'education':
      return 'culture';
    default:
      return 'extra';
  }
}

export default function FinancialPlanScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getFinancialPlanStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { selectedWallet, wallets, currencySymbol, currencyCode, totalIncome, totalExpense, allTimeIncome, allTimeExpense, walletTransactions } = useTransactions();
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const isMl = language === 'ml' || language === 'hi';

  const loc = (ar: string, en: string, ml?: string) => {
    if (isMl) return ml || en;
    if (isAr) return ar;
    return en;
  };

  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Kakeibo States
  const [isKakeiboMode, setIsKakeiboMode] = useState(false);
  const [isKakeiboBudgetModalOpen, setIsKakeiboBudgetModalOpen] = useState(false);
  const [kakeiboSurvivalInput, setKakeiboSurvivalInput] = useState('');
  const [kakeiboWantsInput, setKakeiboWantsInput] = useState('');
  const [kakeiboCultureInput, setKakeiboCultureInput] = useState('');
  const [kakeiboExtraInput, setKakeiboExtraInput] = useState('');
  const [isKakeiboEnabledForm, setIsKakeiboEnabledForm] = useState(true);

  const [refQ1, setRefQ1] = useState('');
  const [refQ2, setRefQ2] = useState('');
  const [refQ3, setRefQ3] = useState('');
  const [refQ4, setRefQ4] = useState('');

  const [selectedEmojiMood, setSelectedEmojiMood] = useState<string>('😊');
  const [selectedQuickActions, setSelectedQuickActions] = useState<string[]>([]);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustIncome, setAdjustIncome] = useState('');
  const [adjustExpense, setAdjustExpense] = useState('');

  // Form & Integration States
  const [goalName, setGoalName] = useState('');
  const [durationYears, setDurationYears] = useState(1);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [monthlyExpense, setMonthlyExpense] = useState('');
  const [savingsGoal, setSavingsGoal] = useState('');

  const [goals, setGoals] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [recurringList, setRecurringList] = useState<RecurringTransaction[]>([]);
  const [installmentList, setInstallmentList] = useState<InstallmentPlan[]>([]);
  const [jameyaList, setJameyaList] = useState<Jameya[]>([]);

  // Single Month Target Override State
  const [singleMonthModalOpen, setSingleMonthModalOpen] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [selectedMonthName, setSelectedMonthName] = useState('');
  const [singleMonthIncomeInput, setSingleMonthIncomeInput] = useState('');
  const [singleMonthExpenseInput, setSingleMonthExpenseInput] = useState('');

  const handleOpenSingleMonthModal = (monthKey: string, monthNameStr: string, currentPlannedInc: number, currentPlannedExp: number) => {
    Haptics.selectionAsync();
    setSelectedMonthKey(monthKey);
    setSelectedMonthName(monthNameStr);
    
    const override = plan?.customMonthlyOverrides?.[monthKey];
    setSingleMonthIncomeInput((override?.income ?? currentPlannedInc).toString());
    setSingleMonthExpenseInput((override?.expense ?? currentPlannedExp).toString());
    setSingleMonthModalOpen(true);
  };

  const handleSaveSingleMonthOverride = async () => {
    if (!plan || !selectedMonthKey) return;
    const incVal = parseFloat(singleMonthIncomeInput) || 0;
    const expVal = parseFloat(singleMonthExpenseInput) || 0;

    const currentOverrides = plan.customMonthlyOverrides || {};
    const updatedOverrides = {
      ...currentOverrides,
      [selectedMonthKey]: {
        income: Math.round(incVal),
        expense: Math.round(expVal),
      }
    };

    const updatedPlan: FinancialPlan = {
      ...plan,
      customMonthlyOverrides: updatedOverrides,
    };

    await saveFinancialPlan(updatedPlan);
    setPlan(updatedPlan);
    setSingleMonthModalOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleResetSingleMonthOverride = async () => {
    if (!plan || !selectedMonthKey || !plan.customMonthlyOverrides) return;
    const currentOverrides = { ...plan.customMonthlyOverrides };
    delete currentOverrides[selectedMonthKey];

    const updatedPlan: FinancialPlan = {
      ...plan,
      customMonthlyOverrides: currentOverrides,
    };

    await saveFinancialPlan(updatedPlan);
    setPlan(updatedPlan);
    setSingleMonthModalOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveAdjustment = async () => {
    if (!plan) return;
    const incVal = parseFloat(adjustIncome) || 0;
    const expVal = parseFloat(adjustExpense) || 0;
    const newSavings = incVal - expVal;

    const updatedPlan: FinancialPlan = {
      ...plan,
      monthlyIncome: Math.round(incVal),
      monthlyExpense: Math.round(expVal),
      monthlySaving: Math.round(newSavings),
    };
    await saveFinancialPlan(updatedPlan);
    setPlan(updatedPlan);
    setIsAdjustModalOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      loc('تم تحديث خطة المستقبل 🚀', 'Future Plan Updated 🚀', 'ഭാവി പ്ലാൻ അപ്ഡേറ്റ് ചെയ്തു 🚀'),
      loc(
        'تم تحديث المستهدفات للأشهر القادمة بناءً على متوسطاتك، مع الحفاظ الكامل على البيانات التاريخية للأشهر السابقة كما حدثت بالفعل.',
        'Updated future plan targets while keeping historical past months intact.',
        'കഴിഞ്ഞ മാസങ്ങളിലെ ചരിത്ര വിവരങ്ങൾ മാറ്റമില്ലാതെ നിലനിർത്തി ഭാവി പ്ലാൻ ലക്ഷ്യങ്ങൾ അപ്ഡേറ്റ് ചെയ്തു.'
      )
    );
  };

  const handleSaveKakeiboBudgets = async () => {
    if (!plan) return;
    const sVal = parseFloat(kakeiboSurvivalInput) || 0;
    const wVal = parseFloat(kakeiboWantsInput) || 0;
    const cVal = parseFloat(kakeiboCultureInput) || 0;
    const eVal = parseFloat(kakeiboExtraInput) || 0;
    const totalKakeiboExpense = sVal + wVal + cVal + eVal;

    const updatedPlan: FinancialPlan = {
      ...plan,
      monthlyExpense: Math.round(totalKakeiboExpense),
      monthlySaving: plan.monthlyIncome - Math.round(totalKakeiboExpense),
      kakeiboBudgets: {
        survival: Math.round(sVal),
        wants: Math.round(wVal),
        culture: Math.round(cVal),
        extra: Math.round(eVal),
      },
    };
    await saveFinancialPlan(updatedPlan);
    setPlan(updatedPlan);
    setIsKakeiboBudgetModalOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      loc('نجاح', 'Success', 'വിജയം'),
      loc('تم تحديث ميزانية كاميهيبو بنجاح!', 'Kakeibo budgets updated!', 'കാകെയ്ബോ ബജറ്റ് അപ്ഡേറ്റ് ചെയ്തു!')
    );
  };

  const handleSaveKakeiboReflection = async () => {
    if (!plan) return;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const newRef: KakeiboReflection = {
      monthKey,
      q1: refQ1,
      q2: refQ2,
      q3: refQ3,
      q4: refQ4,
      emojiMood: selectedEmojiMood,
      quickActions: selectedQuickActions,
      completedAt: now.toISOString(),
    };

    const reflections = plan.kakeiboReflections ? [...plan.kakeiboReflections] : [];
    const idx = reflections.findIndex(r => r.monthKey === monthKey);
    if (idx >= 0) {
      reflections[idx] = newRef;
    } else {
      reflections.push(newRef);
    }

    // If quick action involves cutting wants, apply 5% reduction automatically
    let updatedBudgets = plan.kakeiboBudgets ? { ...plan.kakeiboBudgets } : undefined;
    let appliedNote = '';

    if (updatedBudgets && (selectedQuickActions.includes('reduce_delivery') || selectedQuickActions.includes('cut_subs') || selectedQuickActions.includes('delay_wants'))) {
      const currentWants = updatedBudgets.wants || 0;
      const reduction = Math.round(currentWants * 0.05);
      if (reduction > 0) {
        updatedBudgets.wants = currentWants - reduction;
        appliedNote = loc(
          `\n\n💡 تم تطبيق قرارك بتخفيض ${formatCurrency(reduction)} ${currencySymbol} من ركيزة الرغبات تلقائياً للشهر القادم!`,
          `\n\n💡 Reduced ${formatCurrency(reduction)} ${currencySymbol} from Wants pillar for next month!`,
          `\n\n💡 അടുത്ത മാസത്തെ ആഗ്രഹങ്ങളിൽ നിന്ന് ${formatCurrency(reduction)} ${currencySymbol} സ്വയമേവ കുറച്ചു!`
        );
      }
    }

    const updatedPlan: FinancialPlan = {
      ...plan,
      kakeiboBudgets: updatedBudgets,
      kakeiboReflections: reflections,
    };
    await saveFinancialPlan(updatedPlan);
    setPlan(updatedPlan);
    setRefQ4(''); // Clear note input to signal save
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Alert.alert(
      loc('تم حفظ التأمل المالي 🟢', 'Reflection Saved 🟢', 'സാമ്പത്തിക ചിന്തകൾ സേവ് ചെയ്തു 🟢'),
      loc(
        'تم تدوين وحفظ قراراتك وتأملك المالي بنجاح في السجل!',
        'Your financial reflection and decisions have been logged successfully!',
        'നിങ്ങളുടെ സാമ്പത്തിക തീരുമാനങ്ങളും ചിന്തകളും വിജയകരമായി രേഖപ്പെടുത്തി!'
      ) + appliedNote
    );
  };

  const handleApplyKakeiboRebalance = async (overrunAmount: number, sourcePillarId: string) => {
    if (!plan || !plan.kakeiboBudgets) return;

    let budgets: KakeiboBudgets = { ...plan.kakeiboBudgets };
    let remainingToCover = overrunAmount;

    // 1. Increase the budget of the overbudget pillar so it covers the spent amount
    if (sourcePillarId === 'survival') {
      budgets.survival += overrunAmount;
    } else if (sourcePillarId === 'wants') {
      budgets.wants += overrunAmount;
    } else if (sourcePillarId === 'culture') {
      budgets.culture += overrunAmount;
    } else if (sourcePillarId === 'extra') {
      budgets.extra += overrunAmount;
    }

    // 2. Deduct remainingToCover ONLY from available SURPLUS of other pillars
    // (surplus = budget - spent > 0) to avoid pushing other pillars into overbudget state
    const pillarOrder: (keyof KakeiboBudgets)[] = ['extra', 'wants', 'culture', 'survival'];
    let coveredFromSurplus = 0;

    for (const key of pillarOrder) {
      if (key === sourcePillarId) continue;
      if (remainingToCover <= 0) break;

      const curBudget = budgets[key] || 0;
      const curSpent = (spentByPillar as Record<string, number>)[key] || 0;
      const surplus = Math.max(0, curBudget - curSpent);

      if (surplus > 0) {
        const deduct = Math.min(surplus, remainingToCover);
        budgets[key] = curBudget - deduct;
        remainingToCover -= deduct;
        coveredFromSurplus += deduct;
      }
    }

    const totalKakeiboExpense = budgets.survival + budgets.wants + budgets.culture + budgets.extra;

    const updatedPlan: FinancialPlan = {
      ...plan,
      monthlyExpense: Math.round(totalKakeiboExpense),
      monthlySaving: plan.monthlyIncome - Math.round(totalKakeiboExpense),
      kakeiboBudgets: budgets,
    };

    await saveFinancialPlan(updatedPlan);
    setPlan(updatedPlan);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      loc('تم إعادة التوازن بنجاح ⚖️', 'Rebalance Applied ⚖️', 'റീബാലൻസ് നടപ്പിലാക്കി ⚖️'),
      coveredFromSurplus > 0
        ? loc(
            `تم رفع ميزانية الركيزة بـ ${formatCurrency(overrunAmount)} ${currencySymbol} وتغطية ${formatCurrency(coveredFromSurplus)} ${currencySymbol} من الفائض المتاح بالركائز الأخرى دون إحداث أي تجاوز جديد!`,
            `Adjusted budget by ${formatCurrency(overrunAmount)} ${currencySymbol} and covered ${formatCurrency(coveredFromSurplus)} ${currencySymbol} from surplus in other pillars!`,
            `ബജറ്റിൽ ${formatCurrency(overrunAmount)} ${currencySymbol} ക്രമീകരിക്കുകയും മിച്ചം വന്ന ${formatCurrency(coveredFromSurplus)} ${currencySymbol} ഉപയോഗിച്ച് കുറവ് നികത്തുകയും ചെയ്തു!`
          )
        : loc(
            `تم رفع ميزانية الركيزة بـ ${formatCurrency(overrunAmount)} ${currencySymbol} لتغطية التجاوز وحماية باقي الركائز من أي عجز!`,
            `Increased pillar budget by ${formatCurrency(overrunAmount)} ${currencySymbol} to cover overrun safely!`,
            `അധികച്ചെലവ് സുരക്ഷിതമായി ഉൾക്കൊള്ളാൻ സ്തംഭത്തിന്റെ ബജറ്റ് ${formatCurrency(overrunAmount)} ${currencySymbol} വർദ്ധിപ്പിച്ചു!`
          )
    );
  };

  const walletId = selectedWallet?.id;

  useEffect(() => {
    async function loadExtraData() {
      try {
        const [goalsData, debtsData, recData, instData, jamData] = await Promise.all([
          getGoals(),
          getDebts(),
          getRecurringTransactions(),
          getInstallmentPlans(),
          getJameyas(),
        ]);
        if (walletId) {
          setGoals(goalsData.filter((g: any) => g.walletId === walletId));
          setDebts(debtsData.filter((d: any) => d.walletId === walletId));
          setRecurringList(recData.filter((r: any) => (r.walletId === walletId || r.toWalletId === walletId) && r.isActive));
          setInstallmentList(instData.filter((i: any) => (i.walletId === walletId || i.toWalletId === walletId) && i.remainingMonths > 0));
          setJameyaList(jamData.filter((j: any) => j.walletId === walletId && j.paidMonthsCount < j.totalMonths));
        } else {
          setGoals(goalsData);
          setDebts(debtsData);
          setRecurringList(recData.filter((r: any) => r.isActive));
          setInstallmentList(instData.filter((i: any) => i.remainingMonths > 0));
          setJameyaList(jamData.filter((j: any) => j.paidMonthsCount < j.totalMonths));
        }
      } catch (err) {
        console.error('Error loading plan integration data:', err);
      }
    }
    loadExtraData();
  }, [walletId, walletTransactions.length]);

  const totalRecurringMonthly = useMemo(() => {
    return recurringList.reduce((sum, r) => {
      if (r.type !== 'expense') return sum;
      let monthlyVal = r.amount;
      if (r.frequency === 'daily') monthlyVal = r.amount * 30;
      else if (r.frequency === 'weekly') monthlyVal = r.amount * 4.33;
      else if (r.frequency === 'yearly') monthlyVal = r.amount / 12;
      return sum + monthlyVal;
    }, 0);
  }, [recurringList]);

  const totalInstallmentsMonthly = useMemo(() => {
    return installmentList.reduce((sum, inst) => sum + (inst.monthlyAmount || 0), 0);
  }, [installmentList]);

  const totalJameyaMonthly = useMemo(() => {
    return jameyaList.reduce((sum, jam) => sum + (jam.monthlyAmount || 0), 0);
  }, [jameyaList]);

  const totalConsumerCommitments = totalRecurringMonthly + totalInstallmentsMonthly;
  const totalFixedCommitments = totalConsumerCommitments + totalJameyaMonthly;

  const formatTranslation = (template: string, replacements: Record<string, string>) => {
    let res = template;
    Object.entries(replacements).forEach(([key, val]) => {
      res = res.replace(`{${key}}`, val);
    });
    return res;
  };

  const averageMonthlyData = useMemo(() => {
    if (!walletTransactions || walletTransactions.length === 0) {
      return { avgIncome: 0, avgExpense: 0, hasCompletedMonths: false };
    }
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const monthlyGroups: Record<string, { income: number; expense: number; isCurrentMonth: boolean }> = {};
    
    walletTransactions.forEach(tx => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthlyGroups[key]) {
        monthlyGroups[key] = { 
          income: 0, 
          expense: 0, 
          isCurrentMonth: d.getFullYear() === currentYear && d.getMonth() === currentMonth 
        };
      }
      if (tx.type === 'income') {
        monthlyGroups[key].income += tx.amount;
      } else if (tx.type === 'expense') {
        monthlyGroups[key].expense += tx.amount;
      }
    });

    const keys = Object.keys(monthlyGroups);
    const hasCompleted = keys.some(k => !monthlyGroups[k].isCurrentMonth);
    if (keys.length === 0) return { avgIncome: 0, avgExpense: 0, hasCompletedMonths: false };

    let totalInc = 0;
    let totalExp = 0;
    let monthsCount = 0;

    keys.forEach(key => {
      const group = monthlyGroups[key];
      if (group.isCurrentMonth) {
        if (!hasCompleted) {
          const currentDay = now.getDate();
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const factor = lastDay / Math.max(1, currentDay);
          totalInc += group.income * factor;
          totalExp += group.expense * factor;
          monthsCount += 1;
        }
      } else {
        totalInc += group.income;
        totalExp += group.expense;
        monthsCount += 1;
      }
    });

    if (monthsCount === 0) return { avgIncome: 0, avgExpense: 0, hasCompletedMonths: false };

    return {
      avgIncome: totalInc / monthsCount,
      avgExpense: totalExp / monthsCount,
    };
  }, [walletTransactions]);

  const spentByPillar = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentMonthTx = walletTransactions.filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && t.category !== 'jameya_savings' && t.category !== 'debt_loan' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const pillarMap = {
      survival: 0,
      wants: 0,
      culture: 0,
      extra: 0,
    };

    currentMonthTx.forEach(t => {
      const pillar = getKakeiboPillar(t.category);
      pillarMap[pillar] += t.amount;
    });

    return pillarMap;
  }, [walletTransactions]);

  const handleAutoAdjust = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { avgIncome, avgExpense } = averageMonthlyData;
    setAdjustIncome(Math.round(avgIncome).toString());
    setAdjustExpense(Math.round(avgExpense).toString());
    setIsAdjustModalOpen(true);
  };

  const handleAutoKakeiboDistribution = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const totalExp = plan?.monthlyExpense || parseFloat(monthlyExpense) || 10000;
    const survival = Math.round(totalExp * 0.5);
    const wants = Math.round(totalExp * 0.25);
    const culture = Math.round(totalExp * 0.15);
    const extra = Math.round(totalExp * 0.1);

    setKakeiboSurvivalInput(survival.toString());
    setKakeiboWantsInput(wants.toString());
    setKakeiboCultureInput(culture.toString());
    setKakeiboExtraInput(extra.toString());
  };

  useEffect(() => {
    loadPlan();
  }, [walletId]);

  const loadPlan = async () => {
    setLoading(true);
    const saved = await getFinancialPlan(walletId || undefined);
    if (saved) {
      setPlan(saved);
      setIsKakeiboMode(saved.isKakeiboEnabled || false);
      
      // Auto-initialize Kakeibo budgets if not set
      if (!saved.kakeiboBudgets) {
        const total = saved.monthlyExpense || 0;
        saved.kakeiboBudgets = {
          survival: Math.round(total * 0.5),
          wants: Math.round(total * 0.25),
          culture: Math.round(total * 0.15),
          extra: Math.round(total * 0.1),
        };
      }
      setKakeiboSurvivalInput(saved.kakeiboBudgets.survival.toString());
      setKakeiboWantsInput(saved.kakeiboBudgets.wants.toString());
      setKakeiboCultureInput(saved.kakeiboBudgets.culture.toString());
      setKakeiboExtraInput(saved.kakeiboBudgets.extra.toString());

      // Load current month's reflection
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      const existingRef = saved.kakeiboReflections?.find(r => r.monthKey === monthKey);
      if (existingRef) {
        setRefQ1(existingRef.q1);
        setRefQ2(existingRef.q2);
        setRefQ3(existingRef.q3);
        setRefQ4(existingRef.q4);
        if (existingRef.emojiMood) setSelectedEmojiMood(existingRef.emojiMood);
        if (existingRef.quickActions) setSelectedQuickActions(existingRef.quickActions);
      } else {
        setRefQ1('');
        setRefQ2('');
        setRefQ3('');
        setRefQ4('');
        setSelectedEmojiMood('😊');
        setSelectedQuickActions([]);
      }

      if (saved.monthlyIncome === 0 && saved.monthlyExpense === 0 && saved.savingsGoal === 0) {
        setGoalName(saved.goalName);
        setDurationYears(Math.round(saved.durationMonths / 12));
      }
    } else {
      setPlan(null);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    const incomeVal = parseFloat(monthlyIncome) || 0;
    const expenseVal = parseFloat(monthlyExpense) || 0;
    const goalVal = parseFloat(savingsGoal) || 0;

    if (incomeVal <= 0) {
      Alert.alert(t.error, t.enterAmount);
      return;
    }

    const monthlySaving = incomeVal - expenseVal;
    const newPlan: FinancialPlan = {
      id: typeof Crypto.randomUUID === 'function' ? Crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Date.now().toString(36)),
      goalName: goalName.trim() || t.savingsGoal,
      durationMonths: durationYears * 12,
      monthlyIncome: incomeVal,
      monthlyExpense: expenseVal,
      monthlySaving,
      savingsGoal: goalVal,
      currency: currencyCode,
      currencySymbol,
      createdAt: new Date().toISOString(),
      walletId: selectedWallet?.id || '',
      isKakeiboEnabled: isKakeiboEnabledForm,
      kakeiboBudgets: isKakeiboEnabledForm ? {
        survival: Math.round(parseFloat(kakeiboSurvivalInput) || expenseVal * 0.5),
        wants: Math.round(parseFloat(kakeiboWantsInput) || expenseVal * 0.25),
        culture: Math.round(parseFloat(kakeiboCultureInput) || expenseVal * 0.15),
        extra: Math.round(parseFloat(kakeiboExtraInput) || expenseVal * 0.1),
      } : {
        survival: Math.round(expenseVal * 0.5),
        wants: Math.round(expenseVal * 0.25),
        culture: Math.round(expenseVal * 0.15),
        extra: Math.round(expenseVal * 0.1),
      }
    };

    await saveFinancialPlan(newPlan);
    setPlan(newPlan);
    setIsEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = () => {
    Alert.alert(
      t.deletePlan,
      t.deletePlanConfirm,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            await deleteFinancialPlan(walletId || '');
            setPlan(null);
            setIsEditing(false);
            setGoalName('');
            setDurationYears(1);
            setMonthlyIncome('');
            setMonthlyExpense('');
            setSavingsGoal('');
          },
        },
      ],
    );
  };

  const startEdit = () => {
    if (plan) {
      setGoalName(plan.goalName);
      setDurationYears(Math.round(plan.durationMonths / 12));
      setMonthlyIncome(plan.monthlyIncome.toString());
      setMonthlyExpense(plan.monthlyExpense.toString());
      setSavingsGoal(plan.savingsGoal.toString());
    }
    setIsEditing(true);
  };

  const renderForm = () => {
    const textAlign = language === 'ar' ? 'right' as const : 'left' as const;
    const calcIncome = parseFloat(monthlyIncome) || 0;
    const calcExpense = parseFloat(monthlyExpense) || 0;
    const calcSaving = calcIncome - calcExpense;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: Goal Name & Duration Card */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 14,
          gap: 12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="flag" size={18} color={colors.primary} />
            </View>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }}>
              {loc('1. هدف الخطة ومدتها', '1. Goal & Duration', '1. പ്ലാൻ ലക്ഷ്യവും കാലാവധിയും')}
            </Text>
          </View>

          <View>
            <Text style={styles.label}>{t.savingsGoal}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              placeholder={t.goalPlaceholder}
              placeholderTextColor={Colors.textTertiary}
              value={goalName}
              onChangeText={setGoalName}
            />
          </View>

          <View>
            <Text style={styles.label}>{t.planDuration}</Text>
            <View style={styles.durationRow}>
              {[1, 2, 3, 5].map(y => (
                <Pressable
                  key={y}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDurationYears(y);
                  }}
                  style={[
                    styles.durationChip,
                    durationYears === y && styles.durationChipActive,
                  ]}
                >
                  <Text style={[styles.durationText, durationYears === y && styles.durationTextActive]}>
                    {y} {y === 1 ? t.year : t.years}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Step 2: Income & Financial Solvency Card */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 14,
          gap: 12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#10B98115', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="wallet-outline" size={18} color="#10B981" />
            </View>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }}>
              {loc('2. الدخل والملاءة المالية', '2. Income & Revenue', '2. വരുമാനവും സാമ്പത്തിക സ്ഥിതിയും')}
            </Text>
          </View>

          <View>
            <Text style={styles.label}>{t.monthlyIncome}</Text>
            <View style={styles.inputWithCurrency}>
              <View style={styles.inputCurrencyTag}>
                <Text style={styles.inputCurrencyText}>{currencySymbol}</Text>
              </View>
              <TextInput
                style={styles.currencyInput}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
                value={monthlyIncome}
                onChangeText={(text) => setMonthlyIncome(normalizeAmountInput(text))}
                textAlign="right"
              />
            </View>
          </View>

          {/* Auto-Sync Commitment Banner */}
          {totalFixedCommitments > 0 && (
            <View style={{ backgroundColor: colors.primary + '12', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '30', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 8, gap: 2, alignItems: 'flex-start' }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text, textAlign: 'left' }}>
                  {loc('💳 أقساط والتزامات مكتشفة', '💳 Detected Recurring Bills', '💳 ആവർത്തിച്ചുള്ള ബാധ്യതകൾ')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: 'left' }}>
                  {formatCurrency(totalFixedCommitments)} {currencySymbol}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setMonthlyExpense(Math.round(totalFixedCommitments).toString());
                }}
                style={({ pressed }) => [{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Ionicons name="sync" size={14} color="#FFF" />
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: '#FFF' }}>
                  {loc('مزامنة ⚡', 'Sync ⚡', 'സിങ്ക് ചെയ്യുക ⚡')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Step 3: Methodology & Expense Breakdown Card */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 14,
          gap: 12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#8B5CF615', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="pie-chart-outline" size={18} color="#8B5CF6" />
              </View>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }}>
                {loc('3. منهجية تقسيم المصاريف', '3. Expense Methodology', '3. ചെലവ് പ്ലാനിംഗ് രീതി')}
              </Text>
            </View>
          </View>

          {/* Creation Methodology Choice */}
          <Methodology3DSelector
            isKakeiboMode={isKakeiboEnabledForm}
            onSelectMode={(isKakeibo) => setIsKakeiboEnabledForm(isKakeibo)}
          />

          {!isKakeiboEnabledForm ? (
            /* Standard Monthly Expense Input */
            <View>
              <Text style={styles.label}>{t.monthlyExpense}</Text>
              <View style={styles.inputWithCurrency}>
                <View style={styles.inputCurrencyTag}>
                  <Text style={styles.inputCurrencyText}>{currencySymbol}</Text>
                </View>
                <TextInput
                  style={styles.currencyInput}
                  placeholder="0"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={monthlyExpense}
                  onChangeText={(text) => setMonthlyExpense(normalizeAmountInput(text))}
                  textAlign="right"
                />
              </View>
            </View>
          ) : (
            /* Japanese Kakeibo 4 Pillars Form Breakdown */
            <View style={{ gap: 12, backgroundColor: colors.surfaceAlt + '60', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text, textAlign: 'left' }}>
                🌸 {loc('الأركان اليابانية الأربعة (كاكيبو)', '4 Japanese Kakeibo Pillars', '4 ജാപ്പനീസ് കാകെയ്ബോ സ്തംഭങ്ങൾ')}
              </Text>

              {/* Pillar 1: Survival */}
              <View>
                <Text style={[styles.label, { color: '#10B981', fontSize: 11, marginBottom: 4 }]}>
                  {loc('1. الضروريات الأساسية (طعام، إيجار، فواتير)', '1. Survival (Food, Rent, Bills)', '1. അടിസ്ഥാന ആവശ്യങ്ങൾ (ഭക്ഷണം, വാടക, ബില്ലുകൾ)')}
                </Text>
                <View style={styles.inputWithCurrency}>
                  <View style={[styles.inputCurrencyTag, { backgroundColor: '#10B98115' }]}>
                    <Text style={[styles.inputCurrencyText, { color: '#10B981' }]}>{currencySymbol}</Text>
                  </View>
                  <TextInput
                    style={styles.currencyInput}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={kakeiboSurvivalInput}
                    onChangeText={(text) => {
                      const clean = normalizeAmountInput(text);
                      setKakeiboSurvivalInput(clean);
                      const s = parseFloat(clean) || 0;
                      const w = parseFloat(kakeiboWantsInput) || 0;
                      const c = parseFloat(kakeiboCultureInput) || 0;
                      const e = parseFloat(kakeiboExtraInput) || 0;
                      setMonthlyExpense((s + w + c + e).toString());
                    }}
                    textAlign="right"
                  />
                </View>
              </View>

              {/* Pillar 2: Wants */}
              <View>
                <Text style={[styles.label, { color: '#F59E0B', fontSize: 11, marginBottom: 4 }]}>
                  {loc('2. الرغبات والتسلية (مطاعم، تسوق)', '2. Wants (Restaurants, Shopping)', '2. ആഗ്രഹങ്ങൾ (ഷോപ്പിംഗ്, വിനോദം)')}
                </Text>
                <View style={styles.inputWithCurrency}>
                  <View style={[styles.inputCurrencyTag, { backgroundColor: '#F59E0B15' }]}>
                    <Text style={[styles.inputCurrencyText, { color: '#F59E0B' }]}>{currencySymbol}</Text>
                  </View>
                  <TextInput
                    style={styles.currencyInput}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={kakeiboWantsInput}
                    onChangeText={(text) => {
                      const clean = normalizeAmountInput(text);
                      setKakeiboWantsInput(clean);
                      const s = parseFloat(kakeiboSurvivalInput) || 0;
                      const w = parseFloat(clean) || 0;
                      const c = parseFloat(kakeiboCultureInput) || 0;
                      const e = parseFloat(kakeiboExtraInput) || 0;
                      setMonthlyExpense((s + w + c + e).toString());
                    }}
                    textAlign="right"
                  />
                </View>
              </View>

              {/* Pillar 3: Culture */}
              <View>
                <Text style={[styles.label, { color: '#3B82F6', fontSize: 11, marginBottom: 4 }]}>
                  {loc('3. الثقافة والتطوير (كتب، رياضة، دورات)', '3. Culture & Growth (Books, Sports)', '3. സംസ്കാരവും വളർച്ചയും (പുസ്തകങ്ങൾ, പഠനം)')}
                </Text>
                <View style={styles.inputWithCurrency}>
                  <View style={[styles.inputCurrencyTag, { backgroundColor: '#3B82F615' }]}>
                    <Text style={[styles.inputCurrencyText, { color: '#3B82F6' }]}>{currencySymbol}</Text>
                  </View>
                  <TextInput
                    style={styles.currencyInput}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={kakeiboCultureInput}
                    onChangeText={(text) => {
                      const clean = normalizeAmountInput(text);
                      setKakeiboCultureInput(clean);
                      const s = parseFloat(kakeiboSurvivalInput) || 0;
                      const w = parseFloat(kakeiboWantsInput) || 0;
                      const c = parseFloat(clean) || 0;
                      const e = parseFloat(kakeiboExtraInput) || 0;
                      setMonthlyExpense((s + w + c + e).toString());
                    }}
                    textAlign="right"
                  />
                </View>
              </View>

              {/* Pillar 4: Extra */}
              <View>
                <Text style={[styles.label, { color: '#EC4899', fontSize: 11, marginBottom: 4 }]}>
                  {loc('4. المفاجآت والطوارئ (علاج، صيانة)', '4. Unexpected Extra (Repairs, Medical)', '4. അപ്രതീക്ഷിത ചെലവുകൾ (ചികിത്സ, അറ്റകുറ്റപ്പണി)')}
                </Text>
                <View style={styles.inputWithCurrency}>
                  <View style={[styles.inputCurrencyTag, { backgroundColor: '#EC489915' }]}>
                    <Text style={[styles.inputCurrencyText, { color: '#EC4899' }]}>{currencySymbol}</Text>
                  </View>
                  <TextInput
                    style={styles.currencyInput}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={kakeiboExtraInput}
                    onChangeText={(text) => {
                      const clean = normalizeAmountInput(text);
                      setKakeiboExtraInput(clean);
                      const s = parseFloat(kakeiboSurvivalInput) || 0;
                      const w = parseFloat(kakeiboWantsInput) || 0;
                      const c = parseFloat(kakeiboCultureInput) || 0;
                      const e = parseFloat(clean) || 0;
                      setMonthlyExpense((s + w + c + e).toString());
                    }}
                    textAlign="right"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Savings Target Goal Field */}
          <View style={{ marginTop: 4 }}>
            <Text style={styles.label}>{t.savingsGoal} ({currencySymbol})</Text>
            <View style={styles.inputWithCurrency}>
              <View style={styles.inputCurrencyTag}>
                <Text style={styles.inputCurrencyText}>{currencySymbol}</Text>
              </View>
              <TextInput
                style={styles.currencyInput}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
                value={savingsGoal}
                onChangeText={(text) => setSavingsGoal(normalizeAmountInput(text))}
                textAlign="right"
              />
            </View>
          </View>
        </View>

        {/* Live Savings Projection Card */}
        {calcIncome > 0 && (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: calcSaving >= 0 ? Colors.income + '40' : Colors.expense + '40',
            marginBottom: 16,
            alignItems: 'center',
            gap: 4,
          }}>
            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
              {t.monthlySaving}
            </Text>
            <Text style={{
              fontFamily: 'Cairo_700Bold',
              fontSize: 22,
              color: calcSaving >= 0 ? Colors.income : Colors.expense,
            }}>
              {calcSaving >= 0 ? '+' : ''}{formatCurrency(calcSaving)} {currencySymbol}
            </Text>
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
              {t.totalSavings}: <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>
                {formatCurrency(calcSaving * durationYears * 12)} {currencySymbol}
              </Text> ({durationYears} {durationYears === 1 ? t.year : t.years})
            </Text>
          </View>
        )}

        {/* Submit Primary CTA Button */}
        <Pressable
          onPress={handleCreate}
          style={({ pressed }) => [
            styles.saveButton,
            {
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.saveText}>{t.createPlan}</Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderPlanView = () => {
    if (!plan) return null;

    const totalMonths = plan.durationMonths;
    const now = new Date();
    const created = new Date(plan.createdAt);
    const monthsElapsed = Math.max(0, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()));
    const monthsRemaining = Math.max(0, totalMonths - monthsElapsed);

    const expectedTotalSavings = plan.monthlySaving * totalMonths;
    const currentSavings = plan.monthlySaving * monthsElapsed;
    const totalSavedInGoals = goals.reduce((sum, g) => sum + (g.savedAmount || 0), 0);
    const unpaidDebts = debts.filter(d => d.type === 'debt_to_others' && d.status !== 'paid').reduce((sum, d) => sum + (d.amount - (d.paidAmount || 0)), 0);
    const unpaidLoans = debts.filter(d => d.type === 'debt_to_me' && d.status !== 'paid').reduce((sum, d) => sum + (d.amount - (d.paidAmount || 0)), 0);
    const walletNetBalance = (selectedWallet?.initialBalance || 0) + allTimeIncome - allTimeExpense;
    
    const totalJameyaAccumulatedSavings = jameyaList.reduce((sum, j) => sum + ((j.paidMonthsCount || 0) * (j.monthlyAmount || 0)), 0);
    const actualSavings = walletNetBalance + totalSavedInGoals + totalJameyaAccumulatedSavings - unpaidDebts + unpaidLoans;
    
    const isCompleted = plan.savingsGoal > 0
      ? actualSavings >= plan.savingsGoal
      : (expectedTotalSavings > 0 && actualSavings >= expectedTotalSavings);

    const progressPercent = isCompleted ? 100 : (plan.savingsGoal > 0
      ? Math.min(100, Math.max(0, (actualSavings / plan.savingsGoal) * 100))
      : expectedTotalSavings > 0
        ? Math.min(100, Math.max(0, (actualSavings / expectedTotalSavings) * 100))
        : 0);

    const isOnTrack = actualSavings >= currentSavings * 0.8;
    const sym = plan.currencySymbol;

    const CHART_SIZE = 140;
    const STROKE = 14;
    const R = (CHART_SIZE - STROKE) / 2;
    const C = 2 * Math.PI * R;
    const progressLength = (progressPercent / 100) * C;

    const { avgIncome, avgExpense, hasCompletedMonths } = averageMonthlyData;
    const rawAvgSaving = avgIncome - avgExpense;

    const thisMonthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const thisMonthOverride = plan?.customMonthlyOverrides?.[thisMonthKey];
    const currentPlannedExp = thisMonthOverride?.expense ?? plan.monthlyExpense;
    const currentPlannedInc = thisMonthOverride?.income ?? plan.monthlyIncome;
    const currentPlannedSaving = (thisMonthOverride?.income !== undefined && thisMonthOverride?.expense !== undefined)
      ? (thisMonthOverride.income - thisMonthOverride.expense)
      : plan.monthlySaving;

    // Realistic capped monthly saving rate:
    const maxPossibleSaving = currentPlannedInc > 0 ? currentPlannedInc : (avgIncome > 0 ? avgIncome : 999999);
    const avgSaving = (!hasCompletedMonths || rawAvgSaving > maxPossibleSaving || rawAvgSaving <= 0)
      ? (currentPlannedSaving > 0 ? currentPlannedSaving : Math.max(1, (plan.monthlyIncome || 0) - (plan.monthlyExpense || 0)))
      : Math.min(maxPossibleSaving, rawAvgSaving);

    const getInsights = () => {
      const insights = [];

      // 1. Expense check (current month vs planned)
      if (totalExpense > currentPlannedExp) {
        const diff = totalExpense - currentPlannedExp;
        insights.push({
          type: 'danger',
          message: formatTranslation(t.expenseWarning || '', {
            actual: `${formatCurrency(totalExpense)} ${sym}`,
            expected: `${formatCurrency(currentPlannedExp)} ${sym}`,
            diff: `${formatCurrency(diff)} ${sym}`,
          }),
        });
      }

      // 2. Income check (current month vs planned)
      if (totalIncome < currentPlannedInc) {
        const diff = currentPlannedInc - totalIncome;
        insights.push({
          type: 'warning',
          message: formatTranslation(t.incomeWarning || '', {
            actual: `${formatCurrency(totalIncome)} ${sym}`,
            expected: `${formatCurrency(currentPlannedInc)} ${sym}`,
            diff: `${formatCurrency(diff)} ${sym}`,
          }),
        });
      }

      // 3. Savings check (average monthly saving vs planned)
      const target = plan.savingsGoal > 0 ? plan.savingsGoal : expectedTotalSavings;
      if (actualSavings < target) {
        if (avgSaving <= 0) {
          insights.push({
            type: 'danger',
            message: loc(
              `⚠️ بمعدل ادخارك الفعلي الحالي (${formatCurrency(avgSaving)} ${sym})، لن تتمكن من تحقيق هدفك المالي. ننصح بمراجعة المصاريف.`,
              `⚠️ At your current actual savings rate (${formatCurrency(avgSaving)} ${sym}), you will not reach your financial goal. We recommend reviewing your expenses.`,
              `⚠️ ഇപ്പോഴത്തെ യഥാർത്ഥ സമ്പാദ്യ നിരക്കിൽ (${formatCurrency(avgSaving)} ${sym}), നിങ്ങൾക്ക് സാമ്പത്തിക ലക്ഷ്യം നേടാനാകില്ല. ചെലവുകൾ കുറയ്ക്കാൻ ശുപാർശ ചെയ്യുന്നു.`
            ),
          });
        } else if (avgSaving < currentPlannedSaving) {
          const remainingToTarget = target - actualSavings;
          const monthsNeeded = Math.ceil(remainingToTarget / avgSaving);
          const additionalMonths = monthsNeeded - monthsRemaining;
          
          if (additionalMonths > 0) {
            insights.push({
              type: 'warning',
              message: formatTranslation(t.savingOffTrack || '', {
                months: additionalMonths.toString(),
              }),
            });
          }
        } else {
          const diff = avgSaving - currentPlannedSaving;
          if (diff > 0) {
            insights.push({
              type: 'success',
              message: formatTranslation(t.savingOnTrack || '', {
                diff: `${formatCurrency(diff)} ${sym}`,
              }),
            });
          }
        }
      }

      return insights;
    };

    const insights = getInsights();

    // Estimated completion tag calculation
    const target = plan.savingsGoal > 0 ? plan.savingsGoal : expectedTotalSavings;
    const remaining = Math.max(0, target - actualSavings);

    let estimatedTag: { label: string; color: string; bg: string } | null = null;
    if (isCompleted) {
      estimatedTag = {
        label: loc('🏆 الهدف محقق بالفعل!', '🏆 Goal Already Achieved!', '🏆 ലക്ഷ്യം ഇതിനകം നേടി!'),
        color: Colors.accent,
        bg: Colors.accent + '15',
      };
    } else if (avgSaving <= 0) {
      estimatedTag = {
        label: loc('⚠️ معدل الادخار سلبي — راجع مصاريفك', '⚠️ Negative savings rate — review your expenses', '⚠️ സമ്പാദ്യ നിരക്ക് നെഗറ്റീവ് ആണ് — ചെലവുകൾ അവലോകനം ചെയ്യുക'),
        color: Colors.expense,
        bg: Colors.expense + '12',
      };
    } else {
      const monthsToGoal = Math.ceil(remaining / avgSaving);
      const completionDate = new Date();
      completionDate.setMonth(completionDate.getMonth() + monthsToGoal);
      const completionStr = completionDate.toLocaleDateString(
        isMl ? 'ml-IN' : isAr ? 'ar-EG' : 'en-US',
        { month: 'long', year: 'numeric' }
      );
      const isOnSchedule = monthsToGoal <= monthsRemaining;
      estimatedTag = {
        label: loc(
          `${isOnSchedule ? '✅' : '⚠️'} متوقع التحقيق: ${completionStr} (${monthsToGoal} ${monthsToGoal === 1 ? 'شهر' : 'أشهر'})`,
          `${isOnSchedule ? '✅' : '⚠️'} Est. completion: ${completionStr} (${monthsToGoal} mo)`,
          `${isOnSchedule ? '✅' : '⚠️'} ലക്ഷ്യത്തിലെത്തുന്നത്: ${completionStr} (${monthsToGoal} മാസം)`
        ),
        color: isOnSchedule ? Colors.income : Colors.expense,
        bg: isOnSchedule ? Colors.income + '12' : Colors.expense + '12',
      };
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {isCompleted && (
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationText}>
              {loc('تهانينا! لقد حققت هدفك المالي بنجاح 🎉🏆', 'Congratulations! You have successfully achieved your financial goal! 🎉🏆', 'അഭിനന്ദനങ്ങൾ! സാമ്പത്തിക ലക്ഷ്യം വിജയകരമായി നേടി 🎉🏆')}
            </Text>
          </View>
        )}

        {/* 1. MASTER EXECUTIVE GOAL & PROGRESS HERO CARD */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 14,
          marginBottom: 14,
        }}>
          {/* Card Top: Plan Title, Wallet, Quick Actions */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: colors.primary + '18',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <MaterialIcons name="emoji-events" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: colors.text }} numberOfLines={1}>
                  {plan.goalName || loc('خطة الادخار', 'Savings Plan', 'സമ്പാദ്യ പ്ലാൻ')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                    {selectedWallet ? selectedWallet.name : loc('كل المحافظ', 'All Wallets', 'എല്ലാ വാലറ്റുകളും')}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textTertiary }}>
                    · {Math.round(plan.durationMonths / 12)} {Math.round(plan.durationMonths / 12) === 1 ? loc('سنة', 'Year', 'വർഷം') : loc('سنوات', 'Years', 'വർഷങ്ങൾ')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Actions (Edit & Delete) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable
                onPress={startEdit}
                hitSlop={8}
                style={({ pressed }) => [{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="edit" size={16} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={handleDelete}
                hitSlop={8}
                style={({ pressed }) => [{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="delete-outline" size={16} color={colors.expense} />
              </Pressable>
            </View>
          </View>

          {/* Card Middle: Progress Ring + Goal Target & Realistic Forecast */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceAlt + '60',
            borderRadius: 16,
            padding: 12,
            gap: 14,
            borderWidth: 1,
            borderColor: colors.borderLight,
          }}>
            <View style={styles.chartWrapMini}>
              <Svg width={78} height={78}>
                <Circle cx={39} cy={39} r={31} fill="none" stroke={colors.surfaceAlt} strokeWidth={8} />
                <Circle
                  cx={39}
                  cy={39}
                  r={31}
                  fill="none"
                  stroke={isCompleted ? Colors.accent : (isOnTrack ? Colors.income : Colors.expense)}
                  strokeWidth={8}
                  strokeDasharray={`${(progressPercent / 100) * 2 * Math.PI * 31} ${2 * Math.PI * 31}`}
                  strokeLinecap="round"
                  transform="rotate(-90 39 39)"
                />
              </Svg>
              <View style={styles.chartCenterAbsMini}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }}>
                  {isCompleted ? '🏆' : `${Math.round(progressPercent)}%`}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
                {loc('المبلغ المستهدف:', 'Target Goal:', 'ലക്ഷ്യ തുക:')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 17, color: colors.primary }}>
                {formatCurrency(plan.savingsGoal > 0 ? plan.savingsGoal : expectedTotalSavings)} <Text style={{ fontSize: 11, color: colors.textSecondary }}>{sym}</Text>
              </Text>
              {estimatedTag && (
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: estimatedTag.color, marginTop: 2 }}>
                  {estimatedTag.label}
                </Text>
              )}
            </View>
          </View>

          {/* Card Bottom: Segmented Planning Methodology Switcher */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: colors.surfaceAlt,
            borderRadius: 12,
            padding: 3,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 4,
          }}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setIsKakeiboMode(false);
              }}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: !isKakeiboMode ? '#10B981' : 'transparent',
              }}
            >
              <Ionicons name="pie-chart-outline" size={14} color={!isKakeiboMode ? '#FFF' : colors.textSecondary} />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: !isKakeiboMode ? '#FFF' : colors.textSecondary }}>
                {loc('الخطة الرقمية 50/30/20', 'Standard 50/30/20', '50/30/20')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setIsKakeiboMode(true);
              }}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: isKakeiboMode ? '#8B5CF6' : 'transparent',
              }}
            >
              <Ionicons name="sparkles-outline" size={14} color={isKakeiboMode ? '#FFF' : colors.textSecondary} />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: isKakeiboMode ? '#FFF' : colors.textSecondary }}>
                {loc('طريقة Kakeibo اليابانية', 'Japanese Kakeibo', 'കാകെയ്ബോ')}
              </Text>
            </Pressable>
          </View>
        </View>

        {isKakeiboMode && (
          <KakeiboSection
            plan={plan}
            spentByPillar={spentByPillar}
            totalIncome={totalIncome}
            sym={sym}
            language={language}
            colors={colors}
            selectedEmojiMood={selectedEmojiMood}
            setSelectedEmojiMood={setSelectedEmojiMood}
            selectedQuickActions={selectedQuickActions}
            setSelectedQuickActions={setSelectedQuickActions}
            refQ4={refQ4}
            setRefQ4={setRefQ4}
            onOpenKakeiboBudgetModal={() => setIsKakeiboBudgetModalOpen(true)}
            onSaveKakeiboReflection={handleSaveKakeiboReflection}
            onApplyKakeiboRebalance={handleApplyKakeiboRebalance}
          />
        )}

        {/* 2. CASH FLOW PULSE & NET ASSETS PERFORMANCE CARD */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
          marginBottom: 14,
        }}>
          {!isKakeiboMode ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="pulse-outline" size={16} color={colors.primary} />
                  </View>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }}>
                    {loc('نبض التدفق النقدي لهذا الشهر', 'This Month Cash Flow Pulse', 'ഈ മാസത്തെ പണമിടപാട്')}
                  </Text>
                </View>
                {thisMonthOverride && (
                  <View style={{ backgroundColor: colors.accent + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: colors.accent }}>
                      {loc('استهداف مخصص 🎯', 'Custom Target 🎯', 'കസ്റ്റം ലക്ഷ്യം 🎯')}
                    </Text>
                  </View>
                )}
              </View>

              {/* 3 KPI Columns: Income, Expenses, Net */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 3 }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                    {loc('الدخل', 'Income', 'വരുമാനം')}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.income }} numberOfLines={1}>
                    +{formatCurrency(totalIncome)}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary }} numberOfLines={1}>
                    {loc(`المخطط: ${formatCurrency(currentPlannedInc)}`, `Plan: ${formatCurrency(currentPlannedInc)}`, `പ്ലാൻ: ${formatCurrency(currentPlannedInc)}`)}
                  </Text>
                </View>

                <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 3 }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                    {loc('المصاريف', 'Expenses', 'ചെലവുകൾ')}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: totalExpense > currentPlannedExp ? colors.expense : colors.text }} numberOfLines={1}>
                    -{formatCurrency(totalExpense)}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary }} numberOfLines={1}>
                    {loc(`المخطط: ${formatCurrency(currentPlannedExp)}`, `Plan: ${formatCurrency(currentPlannedExp)}`, `പ്ലാൻ: ${formatCurrency(currentPlannedExp)}`)}
                  </Text>
                </View>

                <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 3 }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                    {loc('الصافي', 'Net', 'അറ്റ തുക')}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: (totalIncome - totalExpense) >= 0 ? colors.income : colors.expense }} numberOfLines={1}>
                    {(totalIncome - totalExpense) >= 0 ? '+' : ''}{formatCurrency(totalIncome - totalExpense)}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary }} numberOfLines={1}>
                    {loc(`الهدف: ${formatCurrency(currentPlannedSaving)}`, `Target: ${formatCurrency(currentPlannedSaving)}`, `ലക്ഷ്യം: ${formatCurrency(currentPlannedSaving)}`)}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
                {loc('ملاءة الأصول والسيولة الكلية', 'Total Assets & Solvency', 'ആകെ ആസ്തികൾ')}
              </Text>
            </View>
          )}

          {/* Solvency & Net Integrated Assets breakdown */}
          <View style={{ gap: 6, paddingTop: !isKakeiboMode ? 10 : 4, borderTopWidth: !isKakeiboMode ? 1 : 0, borderTopColor: colors.borderLight }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
                {loc('رصيد المحفظة المتاح', 'Available Wallet Balance', 'ലഭ്യമായ ബാലൻസ്')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.text }}>
                {formatCurrency(walletNetBalance)} {sym}
              </Text>
            </View>

            {unpaidLoans > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.income }}>
                  {loc('قروض مستردة (لي)', 'Loans Owed to Me', 'ലഭിക്കാനുള്ള കടങ്ങൾ')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.income }}>
                  +{formatCurrency(unpaidLoans)} {sym}
                </Text>
              </View>
            )}

            {unpaidDebts > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.expense }}>
                  {loc('ديون معلقة (عليّ)', 'Outstanding Debts', 'നൽകാനുള്ള കടങ്ങൾ')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.expense }}>
                  -{formatCurrency(unpaidDebts)} {sym}
                </Text>
              </View>
            )}

            {totalSavedInGoals > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.income }}>
                  {loc('حصالات الأهداف', 'Savings Jars', 'സമ്പാദ്യ ലക്ഷ്യങ്ങൾ')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.income }}>
                  +{formatCurrency(totalSavedInGoals)} {sym}
                </Text>
              </View>
            )}

            {totalJameyaAccumulatedSavings > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: '#10B981' }}>
                  {loc('مدخرات الجمعيات 🤝', 'Jameya Savings 🤝', 'ചിട്ടി സമ്പാദ്യം 🤝')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: '#10B981' }}>
                  +{formatCurrency(totalJameyaAccumulatedSavings)} {sym}
                </Text>
              </View>
            )}

            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.surfaceAlt,
              padding: 10,
              borderRadius: 12,
              marginTop: 4,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text }}>
                {loc('إجمالي الصافي الادخاري الشامل', 'Total Net Savings Assets', 'ആകെ അറ്റ സമ്പാദ്യ ആസ്തി')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.primary }}>
                {formatCurrency(actualSavings)} {sym}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. COMPACT HORIZON PROJECTIONS & SMART ADVISOR */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
          marginBottom: 14,
        }}>
          {/* Header with Challenges quick link */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="rocket-outline" size={16} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
                {loc('توقعات الادخار بعيد المدى', 'Long-term Savings Projection', 'ദീർഘകാല സമ്പാദ്യ പ്രവചനം')}
              </Text>
            </View>

            {/* Compact Challenges Link */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/challenges');
              }}
              style={({ pressed }) => [{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#D4A84320',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#D4A84340',
              }, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="emoji-events" size={14} color="#D4A843" />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: '#D4A843' }}>
                {loc('التحديات 🏆', 'Challenges 🏆', 'വെല്ലുവിളികൾ 🏆')}
              </Text>
            </Pressable>
          </View>

          {/* 3-Pill Projection Grid */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 8, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: colors.borderLight }}>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                {loc('1 سنة', '1 Year', '1 വർഷം')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text }}>
                {formatCurrency(currentPlannedSaving * 12)}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 8, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: colors.primary + '40' }}>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                {loc('3 سنوات', '3 Years', '3 വർഷം')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary }}>
                {formatCurrency(currentPlannedSaving * 36)}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 8, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: colors.accent + '40' }}>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                {loc('5 سنوات', '5 Years', '5 വർഷം')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.accent }}>
                {formatCurrency(currentPlannedSaving * 60)}
              </Text>
            </View>
          </View>

          {/* Smart Insights Alert inside this container */}
          {insights.length > 0 && (
            <View style={{ gap: 8, marginTop: 4 }}>
              {insights.map((insight, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: insight.type === 'danger' ? '#EF444415' : insight.type === 'warning' ? '#F59E0B15' : '#10B98115',
                    borderRadius: 12,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: insight.type === 'danger' ? '#EF444430' : insight.type === 'warning' ? '#F59E0B30' : '#10B98130',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <MaterialIcons
                    name={insight.type === 'danger' ? 'error' : insight.type === 'warning' ? 'warning' : 'check-circle'}
                    size={18}
                    color={insight.type === 'danger' ? colors.expense : insight.type === 'warning' ? colors.accent : colors.income}
                  />
                  <Text style={{
                    flex: 1,
                    fontFamily: 'Cairo_600SemiBold',
                    fontSize: 11,
                    color: insight.type === 'danger' ? colors.expense : insight.type === 'warning' ? colors.accent : colors.income,
                    textAlign: 'left',
                    lineHeight: 16,
                  }}>
                    {insight.message}
                  </Text>
                </View>
              ))}

              {avgIncome > 0 && (
                <Pressable
                  onPress={handleAutoAdjust}
                  style={({ pressed }) => [{
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }, pressed && { opacity: 0.85 }]}
                >
                  <MaterialIcons name="auto-fix-high" size={16} color={colors.primary} />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary }}>
                    {t.adjustPlanToReality}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Horizontal Gamified Monthly Breakdown Timeline & Progress Bar */}
        <MonthlyBreakdownTimeline
          plan={plan}
          created={created}
          monthsElapsed={monthsElapsed}
          totalMonths={totalMonths}
          walletTransactions={walletTransactions}
          selectedWallet={selectedWallet}
          currencySymbol={sym}
          colors={colors}
          styles={styles}
          t={t}
          loc={loc}
          onOpenSingleMonthModal={handleOpenSingleMonthModal}
        />
      </ScrollView>
    );
  };

  const isPlanEmpty = plan && plan.monthlyIncome === 0 && plan.monthlyExpense === 0 && plan.savingsGoal === 0;
  const showForm = !plan || isEditing || isPlanEmpty;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <View style={[styles.headerRow, { paddingTop: (insets.top || (Platform.OS === 'web' ? 10 : 0)) + 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.sheetTitle}>{t.financialPlan}</Text>
            {selectedWallet && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: selectedWallet.color || colors.primary }} />
                <Ionicons name="wallet-outline" size={13} color={selectedWallet.color || colors.primary} />
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary }}>
                  {loc(`المحفظة المحددة: ${selectedWallet.name}`, `Wallet: ${selectedWallet.name}`, `തിരഞ്ഞെടുത്ത വാലറ്റ്: ${selectedWallet.name}`)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {showForm ? renderForm() : renderPlanView()}

        {/* Custom Adjust Plan Modal */}
        <AdjustPlanModal
          visible={isAdjustModalOpen}
          onClose={() => setIsAdjustModalOpen(false)}
          adjustIncome={adjustIncome}
          setAdjustIncome={setAdjustIncome}
          adjustExpense={adjustExpense}
          setAdjustExpense={setAdjustExpense}
          onSave={handleSaveAdjustment}
          currency={selectedWallet?.currency || 'EGP'}
          isAr={isAr}
          loc={loc}
        />

        {/* Single Month Custom Target Modal */}
        <SingleMonthTargetModal
          visible={singleMonthModalOpen}
          onClose={() => setSingleMonthModalOpen(false)}
          monthName={selectedMonthName}
          monthKey={selectedMonthKey}
          incomeInput={singleMonthIncomeInput}
          setIncomeInput={setSingleMonthIncomeInput}
          expenseInput={singleMonthExpenseInput}
          setExpenseInput={setSingleMonthExpenseInput}
          onSave={handleSaveSingleMonthOverride}
          onReset={handleResetSingleMonthOverride}
          hasOverride={!!plan?.customMonthlyOverrides?.[selectedMonthKey]}
          currencySymbol={currencySymbol}
          isAr={isAr}
          loc={loc}
        />

        {/* Custom Kakeibo Budgets Modal */}
        <KakeiboBudgetModal
          visible={isKakeiboBudgetModalOpen}
          onClose={() => setIsKakeiboBudgetModalOpen(false)}
          survivalInput={kakeiboSurvivalInput}
          setSurvivalInput={setKakeiboSurvivalInput}
          wantsInput={kakeiboWantsInput}
          setWantsInput={setKakeiboWantsInput}
          cultureInput={kakeiboCultureInput}
          setCultureInput={setKakeiboCultureInput}
          extraInput={kakeiboExtraInput}
          setExtraInput={setKakeiboExtraInput}
          onAutoDistribute={handleAutoKakeiboDistribution}
          onSave={handleSaveKakeiboBudgets}
          currency={selectedWallet?.currency || 'EGP'}
          colors={colors}
          isAr={isAr}
          loc={loc}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
