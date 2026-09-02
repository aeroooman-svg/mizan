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
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { selectedWallet, wallets, currencySymbol, currencyCode, totalIncome, totalExpense, allTimeIncome, allTimeExpense, walletTransactions } = useTransactions();
  const { t, language } = useLanguage();

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
      language === 'ar' ? 'تم تحديث خطة المستقبل 🚀' : 'Future Plan Updated 🚀',
      language === 'ar'
        ? 'تم تحديث المستهدفات للأشهر القادمة بناءً على متوسطاتك، مع الحفاظ الكامل على البيانات التاريخية للأشهر السابقة كما حدثت بالفعل.'
        : 'Updated future plan targets while keeping historical past months intact.'
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
      language === 'ar' ? 'نجاح' : 'Success',
      language === 'ar' ? 'تم تحديث ميزانية كاميهيبو بنجاح!' : 'Kakeibo budgets updated!'
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
        appliedNote = language === 'ar' 
          ? `\n\n💡 تم تطبيق قرارك بتخفيض ${formatCurrency(reduction)} ${currencySymbol} من ركيزة الرغبات تلقائياً للشهر القادم!` 
          : `\n\n💡 Reduced ${formatCurrency(reduction)} ${currencySymbol} from Wants pillar for next month!`;
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
      language === 'ar' ? 'تم حفظ التأمل المالي 🟢' : 'Reflection Saved 🟢',
      (language === 'ar'
        ? 'تم تدوين وحفظ قراراتك وتأملك المالي بنجاح في السجل!'
        : 'Your financial reflection and decisions have been logged successfully!') + appliedNote
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
      language === 'ar' ? 'تم إعادة التوازن بنجاح ⚖️' : 'Rebalance Applied ⚖️',
      coveredFromSurplus > 0
        ? (language === 'ar'
            ? `تم رفع ميزانية الركيزة بـ ${formatCurrency(overrunAmount)} ${currencySymbol} وتغطية ${formatCurrency(coveredFromSurplus)} ${currencySymbol} من الفائض المتاح بالركائز الأخرى دون إحداث أي تجاوز جديد!`
            : `Adjusted budget by ${formatCurrency(overrunAmount)} ${currencySymbol} and covered ${formatCurrency(coveredFromSurplus)} ${currencySymbol} from surplus in other pillars!`)
        : (language === 'ar'
            ? `تم رفع ميزانية الركيزة بـ ${formatCurrency(overrunAmount)} ${currencySymbol} لتغطية التجاوز وحماية باقي الركائز من أي عجز!`
            : `Increased pillar budget by ${formatCurrency(overrunAmount)} ${currencySymbol} to cover overrun safely!`)
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
              {language === 'ar' ? '1. هدف الخطة ومدتها' : '1. Goal & Duration'}
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
              {language === 'ar' ? '2. الدخل والملاءة المالية' : '2. Income & Revenue'}
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
                  {language === 'ar' ? '💳 أقساط والتزامات مكتشفة' : '💳 Detected Recurring Bills'}
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
                  {language === 'ar' ? 'مزامنة ⚡' : 'Sync ⚡'}
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
                {language === 'ar' ? '3. منهجية تقسيم المصاريف' : '3. Expense Methodology'}
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
                🌸 {language === 'ar' ? 'الأركان اليابانية الأربعة (كاكيبو)' : '4 Japanese Kakeibo Pillars'}
              </Text>

              {/* Pillar 1: Survival */}
              <View>
                <Text style={[styles.label, { color: '#10B981', fontSize: 11, marginBottom: 4 }]}>
                  {language === 'ar' ? '1. الضروريات الأساسية (طعام، إيجار، فواتير)' : '1. Survival (Food, Rent, Bills)'}
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
                  {language === 'ar' ? '2. الرغبات والتسلية (مطاعم، تسوق)' : '2. Wants (Restaurants, Shopping)'}
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
                  {language === 'ar' ? '3. الثقافة والتطوير (كتب، رياضة، دورات)' : '3. Culture & Growth (Books, Sports)'}
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
                  {language === 'ar' ? '4. المفاجآت والطوارئ (علاج، صيانة)' : '4. Unexpected Extra (Repairs, Medical)'}
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

    // Realistic capped monthly saving rate:
    // If no completed past months exist OR if rawAvgSaving > plan.monthlyIncome, fallback to plan.monthlySaving!
    const maxPossibleSaving = plan.monthlyIncome > 0 ? plan.monthlyIncome : (avgIncome > 0 ? avgIncome : 999999);
    const avgSaving = (!hasCompletedMonths || rawAvgSaving > maxPossibleSaving || rawAvgSaving <= 0)
      ? (plan.monthlySaving > 0 ? plan.monthlySaving : Math.max(1, (plan.monthlyIncome || 0) - (plan.monthlyExpense || 0)))
      : Math.min(maxPossibleSaving, rawAvgSaving);

    const getInsights = () => {
      const insights = [];

      // 1. Expense check (current month vs planned)
      if (totalExpense > plan.monthlyExpense) {
        const diff = totalExpense - plan.monthlyExpense;
        insights.push({
          type: 'danger',
          message: formatTranslation(t.expenseWarning || '', {
            actual: `${formatCurrency(totalExpense)} ${sym}`,
            expected: `${formatCurrency(plan.monthlyExpense)} ${sym}`,
            diff: `${formatCurrency(diff)} ${sym}`,
          }),
        });
      }

      // 2. Income check (current month vs planned)
      if (totalIncome < plan.monthlyIncome) {
        const diff = plan.monthlyIncome - totalIncome;
        insights.push({
          type: 'warning',
          message: formatTranslation(t.incomeWarning || '', {
            actual: `${formatCurrency(totalIncome)} ${sym}`,
            expected: `${formatCurrency(plan.monthlyIncome)} ${sym}`,
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
            message: language === 'ar'
              ? `⚠️ بمعدل ادخارك الفعلي الحالي (${formatCurrency(avgSaving)} ${sym})، لن تتمكن من تحقيق هدفك المالي. ننصح بمراجعة المصاريف.`
              : `⚠️ At your current actual savings rate (${formatCurrency(avgSaving)} ${sym}), you will not reach your financial goal. We recommend reviewing your expenses.`,
          });
        } else if (avgSaving < plan.monthlySaving) {
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
          const diff = avgSaving - plan.monthlySaving;
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

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        <View style={styles.planHeader}>
          <View style={styles.planBadge}>
            <MaterialIcons name="flag" size={16} color={colors.primary} />
            <Text style={styles.planBadgeText}>
              {t.planActive} {selectedWallet ? `· ${selectedWallet.name}` : ''}
            </Text>
          </View>
          <View style={styles.planActions}>
            <Pressable onPress={startEdit} hitSlop={8} style={styles.planActionBtn}>
              <MaterialIcons name="edit" size={18} color={colors.primary} />
            </Pressable>
            <Pressable onPress={handleDelete} hitSlop={8} style={styles.planActionBtn}>
              <MaterialIcons name="delete-outline" size={18} color={colors.expense} />
            </Pressable>
          </View>
        </View>

        {/* 3D Methodology Selector Card Grid */}
        <Methodology3DSelector
          isKakeiboMode={isKakeiboMode}
          onSelectMode={(isKakeibo) => setIsKakeiboMode(isKakeibo)}
        />

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

        {isCompleted && (
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationText}>
              {language === 'ar' ? 'تهانينا! لقد حققت هدفك المالي بنجاح 🎉🏆' : 'Congratulations! You have successfully achieved your financial goal! 🎉🏆'}
            </Text>
          </View>
        )}

        {/* Dynamic unified Goal Hero Row */}
        <View style={styles.goalHeroRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent + '15', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="emoji-events" size={20} color={Colors.accent} />
              </View>
              <Text style={styles.goalTitleText} numberOfLines={1}>{plan.goalName}</Text>
            </View>
            <Text style={styles.goalDetailSub}>
              {language === 'ar' 
                ? `المدة: ${Math.round(plan.durationMonths / 12)} ${Math.round(plan.durationMonths / 12) === 1 ? 'سنة' : 'سنوات'}` 
                : `Duration: ${Math.round(plan.durationMonths / 12)} ${Math.round(plan.durationMonths / 12) === 1 ? 'Year' : 'Years'}`}
            </Text>
            {plan.savingsGoal > 0 && (
              <Text style={styles.goalTargetText}>
                {language === 'ar' ? `المستهدف: ${formatCurrency(plan.savingsGoal)} ${sym}` : `Target: ${formatCurrency(plan.savingsGoal)} ${sym}`}
              </Text>
            )}
          </View>
          <View style={styles.chartWrapMini}>
            <Svg width={80} height={80}>
              <Circle cx={40} cy={40} r={32} fill="none" stroke={Colors.surfaceAlt} strokeWidth={8} />
              <Circle
                cx={40}
                cy={40}
                r={32}
                fill="none"
                stroke={isCompleted ? Colors.accent : (isOnTrack ? Colors.income : Colors.expense)}
                strokeWidth={8}
                strokeDasharray={`${(progressPercent / 100) * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </Svg>
            <View style={styles.chartCenterAbsMini}>
              <Text style={styles.chartPercentMini}>{isCompleted ? '🏆' : `${Math.round(progressPercent)}%`}</Text>
            </View>
          </View>
        </View>

        {/* Estimated Completion & Realism Bar */}
        {(() => {
          const target = plan.savingsGoal > 0 ? plan.savingsGoal : expectedTotalSavings;
          const remaining = Math.max(0, target - actualSavings);

          let estimatedTag: { label: string; color: string; bg: string } | null = null;

          if (isCompleted) {
            estimatedTag = {
              label: language === 'ar' ? '🏆 الهدف محقق بالفعل!' : '🏆 Goal Already Achieved!',
              color: Colors.accent,
              bg: Colors.accent + '15',
            };
          } else if (avgSaving <= 0) {
            estimatedTag = {
              label: language === 'ar' ? '⚠️ معدل الادخار سلبي — راجع مصاريفك' : '⚠️ Negative savings rate — review your expenses',
              color: Colors.expense,
              bg: Colors.expense + '12',
            };
          } else {
            const monthsToGoal = Math.ceil(remaining / avgSaving);
            const completionDate = new Date();
            completionDate.setMonth(completionDate.getMonth() + monthsToGoal);
            const completionStr = completionDate.toLocaleDateString(
              language === 'ar' ? 'ar-EG' : 'en-US',
              { month: 'long', year: 'numeric' }
            );
            const isOnSchedule = monthsToGoal <= monthsRemaining;
            estimatedTag = {
              label: language === 'ar'
                ? `${isOnSchedule ? '✅' : '⚠️'} متوقع التحقيق: ${completionStr} (${monthsToGoal} شهر)`
                : `${isOnSchedule ? '✅' : '⚠️'} Est. completion: ${completionStr} (${monthsToGoal} mo)`,
              color: isOnSchedule ? Colors.income : Colors.expense,
              bg: isOnSchedule ? Colors.income + '12' : Colors.expense + '12',
            };
          }

          return estimatedTag ? (
            <View style={{ backgroundColor: estimatedTag.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8 }}>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: estimatedTag.color, textAlign: 'left' }}>
                {estimatedTag.label}
              </Text>
              {!isCompleted && avgSaving > 0 && (
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'left' }}>
                  {language === 'ar'
                    ? `متوسط ادخارك الفعلي الشهري: ${formatCurrency(avgSaving)} ${sym}`
                    : `Your avg. monthly savings: ${formatCurrency(avgSaving)} ${sym}`}
                </Text>
              )}
            </View>
          ) : null;
        })()}

        {/* Streamlined Unified Financial Performance & Solvency Integration Card */}
        <View style={styles.integrationCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="stats-chart" size={18} color={colors.primary} />
              </View>
              <Text style={styles.integrationTitle} numberOfLines={1}>
                {language === 'ar' ? 'ملاءة الأصول والأداء الفعلي' : 'Financial Assets & Performance'}
              </Text>
            </View>
          </View>

          {/* 3-Pillar Monthly Cash Flow KPI Overview */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, justifyContent: 'space-between', minHeight: 84 }}>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                {language === 'ar' ? 'الدخل' : 'Income'}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.income }} numberOfLines={1}>
                +{formatCurrency(totalIncome)} {sym}
              </Text>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary }} numberOfLines={1}>
                {language === 'ar' ? `المخطط: ${formatCurrency(plan.monthlyIncome)}` : `Plan: ${formatCurrency(plan.monthlyIncome)}`}
              </Text>
            </View>

            <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, justifyContent: 'space-between', minHeight: 84 }}>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                {language === 'ar' ? 'المصاريف' : 'Expenses'}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: totalExpense > plan.monthlyExpense ? colors.expense : colors.text }} numberOfLines={1}>
                -{formatCurrency(totalExpense)} {sym}
              </Text>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary }} numberOfLines={1}>
                {language === 'ar' ? `المخطط: ${formatCurrency(plan.monthlyExpense)}` : `Plan: ${formatCurrency(plan.monthlyExpense)}`}
              </Text>
            </View>

            <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, justifyContent: 'space-between', minHeight: 84 }}>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                {language === 'ar' ? 'الصافي' : 'Net'}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: (totalIncome - totalExpense) >= 0 ? colors.income : colors.expense }} numberOfLines={1}>
                {(totalIncome - totalExpense) >= 0 ? '+' : ''}{formatCurrency(totalIncome - totalExpense)} {sym}
              </Text>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary }} numberOfLines={1}>
                {language === 'ar' ? `الهدف: ${formatCurrency(plan.monthlySaving)}` : `Target: ${formatCurrency(plan.monthlySaving)}`}
              </Text>
            </View>
          </View>

          {/* Solvency & Net Integrated Assets Breakdown List */}
          <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
            <View style={styles.integrationRow}>
              <Text style={styles.integrationLabel}>{language === 'ar' ? 'رصيد المحفظة النقدي المتاح' : 'Available Wallet Balance'}</Text>
              <Text style={styles.integrationValue}>{formatCurrency(walletNetBalance)} {sym}</Text>
            </View>

            {totalSavedInGoals > 0 && (
              <View style={styles.integrationRow}>
                <Text style={styles.integrationLabel}>{language === 'ar' ? 'المودع في حصالات الادخار والأهداف' : 'Saved in Savings Jars & Goals'}</Text>
                <Text style={[styles.integrationValue, { color: Colors.income }]}>+{formatCurrency(totalSavedInGoals)} {sym}</Text>
              </View>
            )}

            {totalJameyaAccumulatedSavings > 0 && (
              <View style={styles.integrationRow}>
                <Text style={[styles.integrationLabel, { color: '#10B981', fontFamily: 'Cairo_700Bold' }]}>
                  🤝 {language === 'ar' ? 'مدفوعات ومدخرات الجمعيات' : 'Jameya Savings Asset'}
                </Text>
                <Text style={[styles.integrationValue, { color: '#10B981', fontFamily: 'Cairo_700Bold' }]}>
                  +{formatCurrency(totalJameyaAccumulatedSavings)} {sym}
                </Text>
              </View>
            )}

            {totalConsumerCommitments > 0 && (
              <View style={styles.integrationRow}>
                <Text style={styles.integrationLabel}>{language === 'ar' ? 'المصاريف المتكررة والأقساط الاستهلاكية' : 'Monthly Bills & Card Installments'}</Text>
                <Text style={[styles.integrationValue, { color: colors.textSecondary }]}>{formatCurrency(totalConsumerCommitments)} {sym}</Text>
              </View>
            )}

            {unpaidDebts > 0 && (
              <View style={styles.integrationRow}>
                <Text style={styles.integrationLabel}>{language === 'ar' ? 'ديون معلقة (عليّ)' : 'Outstanding Debts'}</Text>
                <Text style={[styles.integrationValue, { color: Colors.expense }]}>-{formatCurrency(unpaidDebts)} {sym}</Text>
              </View>
            )}

            {unpaidLoans > 0 && (
              <View style={styles.integrationRow}>
                <Text style={styles.integrationLabel}>{language === 'ar' ? 'قروض مستردة (لي)' : 'Loans Owed to Me'}</Text>
                <Text style={[styles.integrationValue, { color: Colors.income }]}>+{formatCurrency(unpaidLoans)} {sym}</Text>
              </View>
            )}

            <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 4 }} />

            <View style={styles.integrationRow}>
              <Text style={[styles.integrationLabel, { fontFamily: 'Cairo_700Bold', color: Colors.text, fontSize: 13 }]}>
                {language === 'ar' ? 'إجمالي الصافي الادخاري الشامل (الأصول المتاحة)' : 'Total Net Savings Assets'}
              </Text>
              <Text style={[styles.integrationValue, { fontFamily: 'Cairo_700Bold', color: Colors.primary, fontSize: 15 }]}>
                {formatCurrency(actualSavings)} {sym}
              </Text>
            </View>
          </View>
        </View>

        {/* Multi-Year Savings Projection Card */}
        <View style={styles.projectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name="rocket-outline" size={20} color={Colors.primary} />
            <Text style={styles.projectionTitle}>
              {language === 'ar' ? 'توقعات النمو والادخار بعيد المدى' : 'Long-term Savings Projection'}
            </Text>
          </View>
          <Text style={styles.projectionDesc}>
            {language === 'ar' 
              ? 'إذا حافظت على معدل ادخارك المستهدف الحالي، فإليك كم ستملك في المستقبل:' 
              : 'If you maintain your current target savings rate, here is what you will accumulate:'}
          </Text>
          <View style={styles.projectionGrid}>
            <View style={styles.projectionCol}>
              <Text style={styles.projectionPeriod}>{language === 'ar' ? 'سنة واحدة' : '1 Year'}</Text>
              <Text style={styles.projectionValue}>{formatCurrency(plan.monthlySaving * 12)} {sym}</Text>
            </View>
            <View style={styles.projectionCol}>
              <Text style={styles.projectionPeriod}>{language === 'ar' ? '3 سنوات' : '3 Years'}</Text>
              <Text style={[styles.projectionValue, { color: Colors.primary }]}>{formatCurrency(plan.monthlySaving * 36)} {sym}</Text>
            </View>
            <View style={styles.projectionCol}>
              <Text style={styles.projectionPeriod}>{language === 'ar' ? '5 سنوات' : '5 Years'}</Text>
              <Text style={[styles.projectionValue, { color: Colors.accent }]}>{formatCurrency(plan.monthlySaving * 60)} {sym}</Text>
            </View>
          </View>
        </View>

        {/* Gold Challenges & Achievements Banner Card */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/challenges');
          }}
          style={({ pressed }) => [
            styles.challengesGoldCard,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
          ]}
        >
          <LinearGradient
            colors={['#D4A843', '#B8860B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.challengesGoldGradient}
          >
            <View style={styles.challengesGoldIconWrap}>
              <MaterialIcons name="emoji-events" size={26} color="#FFF" />
            </View>
            <View style={styles.challengesGoldInfo}>
              <Text style={styles.challengesGoldTitle}>
                {language === 'ar' ? 'تحديات الادخار والأوسمة المالية' : 'Savings Challenges & Trophies'}
              </Text>
              <Text style={styles.challengesGoldSub}>
                {language === 'ar' ? 'افتح أوسمة الإنجاز وتنافس في التحديات المالية!' : 'Unlock achievement badges and compete in savings challenges!'}
              </Text>
            </View>
            <Ionicons name={language === 'ar' ? 'chevron-back' : 'chevron-forward'} size={20} color="#fff" />
          </LinearGradient>
        </Pressable>

        {/* Smart Insights & Alerts Section */}
        <View style={styles.insightsSection}>
          <Text style={styles.insightsTitle}>{t.smartInsights}</Text>
          {insights.length === 0 ? (
            <View style={styles.insightRowSuccess}>
              <MaterialIcons name="check-circle" size={20} color={Colors.income} />
              <Text style={styles.insightTextSuccess}>
                {language === 'ar' 
                  ? 'خطة الادخار الخاصة بك تسير بشكل ممتاز ومتوافقة تماماً مع ميزانيتك!' 
                  : 'Your savings plan is on track and fully aligned with your budget!'}
              </Text>
            </View>
          ) : (
            insights.map((insight, idx) => (
              <View
                key={idx}
                style={[
                  styles.insightRow,
                  insight.type === 'danger' && styles.insightRowDanger,
                  insight.type === 'warning' && styles.insightRowWarning,
                  insight.type === 'success' && styles.insightRowSuccess,
                ]}
              >
                <MaterialIcons
                  name={insight.type === 'danger' ? 'error' : insight.type === 'warning' ? 'warning' : 'check-circle'}
                  size={20}
                  color={insight.type === 'danger' ? Colors.expense : insight.type === 'warning' ? Colors.accent : Colors.income}
                />
                <Text
                  style={[
                    styles.insightText,
                    insight.type === 'danger' && styles.insightTextDanger,
                    insight.type === 'warning' && styles.insightTextWarning,
                    insight.type === 'success' && styles.insightTextSuccess,
                  ]}
                >
                  {insight.message}
                </Text>
              </View>
            ))
          )}

          {/* Quick Adjust Plan Button */}
          {avgIncome > 0 && (
            <Pressable
              onPress={handleAutoAdjust}
              style={({ pressed }) => [
                styles.adjustButton,
                {
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <MaterialIcons name="auto-fix-high" size={18} color={Colors.primary} />
              <Text style={styles.adjustButtonText}>{t.adjustPlanToReality}</Text>
            </Pressable>
          )}
        </View>

        {/* Horizontal Gamified Monthly Breakdown Timeline & Progress Bar */}
        {(() => {
          const currentMonthNumber = Math.min(totalMonths, monthsElapsed + 1);
          const planProgressPct = Math.min(100, Math.max(0, Math.round((currentMonthNumber / totalMonths) * 100)));
          const maxDisplayMonths = Math.min(36, totalMonths);

          return (
            <View style={[styles.timelineSection, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 16, borderRadius: 22, gap: 14 }]}>
              {/* Section Header with Title & Gamified Progress Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  </View>
                  <Text style={[styles.timelineTitle, { color: colors.text, marginBottom: 0, fontSize: 15 }]}>
                    {t.monthlyBreakdown}
                  </Text>
                </View>
                <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#10B98140' }}>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: '#10B981' }}>
                    🔥 {planProgressPct}% {language === 'ar' ? 'مكتمل' : 'Completed'}
                  </Text>
                </View>
              </View>

              {/* Gamified Glowing Progress Bar & Motivational Counter */}
              <View style={{ gap: 6 }}>
                <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                  <LinearGradient
                    colors={['#10B981', '#06B6D4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ width: `${Math.max(4, planProgressPct)}%`, height: '100%', borderRadius: 4 }}
                  />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                    {language === 'ar'
                      ? `الشهر ${currentMonthNumber} من أصل ${totalMonths} شهر 🎯`
                      : `Month ${currentMonthNumber} of ${totalMonths} mos 🎯`}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                    {language === 'ar' ? 'اسحب أفقياً لاستعراض الأشهر ➔' : 'Swipe horizontally ➔'}
                  </Text>
                </View>
              </View>

              {/* Horizontal Scroll Cards Carousel */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
              >
                {Array.from({ length: maxDisplayMonths }, (_, i) => {
                  const monthDate = new Date(created);
                  monthDate.setMonth(created.getMonth() + i);
                  const m = monthDate.getMonth();
                  const y = monthDate.getFullYear();
                  const monthName = t.months[m];
                  const monthKey = `${y}-${(m + 1).toString().padStart(2, '0')}`;
                  const isPast = i < monthsElapsed;
                  const isCurrent = i === monthsElapsed;

                  // Check if custom override exists for this month
                  const customOverride = plan.customMonthlyOverrides?.[monthKey];
                  const plannedInc = customOverride?.income ?? plan.monthlyIncome;
                  const plannedExp = customOverride?.expense ?? plan.monthlyExpense;
                  const plannedSaving = plannedInc - plannedExp;

                  const monthTx = walletTransactions.filter(tx => {
                    const d = new Date(tx.date);
                    return d.getMonth() === m && d.getFullYear() === y;
                  });
                  const actualMonthIncome = monthTx.filter(tx => (tx.type === 'income' && tx.category !== 'debt_loan') || (tx.type === 'transfer' && selectedWallet && tx.toWalletId === selectedWallet.id)).reduce((s, tx) => s + tx.amount, 0);
                  const actualMonthExpense = monthTx.filter(tx => (tx.type === 'expense' && tx.category !== 'jameya_savings' && tx.category !== 'debt_loan') || (tx.type === 'transfer' && selectedWallet && tx.walletId === selectedWallet.id)).reduce((s, tx) => s + tx.amount, 0);
                  const actualMonthSaving = actualMonthIncome - actualMonthExpense;
                  const hasActualData = monthTx.length > 0;

                  // Cumulative savings
                  const initialWalletBalance = selectedWallet?.initialBalance || 0;
                  let cumulativeSavings = initialWalletBalance;

                  for (let k = 0; k <= i; k++) {
                    const monthDateK = new Date(created);
                    monthDateK.setMonth(created.getMonth() + k);
                    const mK = monthDateK.getMonth();
                    const yK = monthDateK.getFullYear();
                    const monthKeyK = `${yK}-${(mK + 1).toString().padStart(2, '0')}`;

                    const customOverrideK = plan.customMonthlyOverrides?.[monthKeyK];
                    const plannedIncK = customOverrideK?.income ?? plan.monthlyIncome;
                    const plannedExpK = customOverrideK?.expense ?? plan.monthlyExpense;
                    const plannedSavingK = plannedIncK - plannedExpK;

                    const monthTxK = walletTransactions.filter(tx => {
                      const d = new Date(tx.date);
                      return d.getMonth() === mK && d.getFullYear() === yK;
                    });
                    const hasActualK = monthTxK.length > 0;

                    if (k <= monthsElapsed) {
                      if (hasActualK) {
                        const actualIncK = monthTxK.filter(tx => (tx.type === 'income' && tx.category !== 'debt_loan') || (tx.type === 'transfer' && selectedWallet && tx.toWalletId === selectedWallet.id)).reduce((s, tx) => s + tx.amount, 0);
                        const actualExpK = monthTxK.filter(tx => (tx.type === 'expense' && tx.category !== 'jameya_savings' && tx.category !== 'debt_loan') || (tx.type === 'transfer' && selectedWallet && tx.walletId === selectedWallet.id)).reduce((s, tx) => s + tx.amount, 0);
                        cumulativeSavings += (actualIncK - actualExpK);
                      } else {
                        cumulativeSavings += plannedSavingK;
                      }
                    } else {
                      cumulativeSavings += plannedSavingK;
                    }
                  }

                  return (
                    <Pressable
                      key={i}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleOpenSingleMonthModal(monthKey, `${monthName} ${y}`, plannedInc, plannedExp);
                      }}
                      style={({ pressed }) => [
                        {
                          width: 220,
                          backgroundColor: isCurrent ? colors.primary + '18' : isPast ? colors.surfaceAlt + '90' : colors.surfaceAlt + '40',
                          borderColor: isCurrent ? colors.primary : customOverride ? colors.accent : colors.border,
                          borderWidth: isCurrent || customOverride ? 1.5 : 1,
                          borderRadius: 18,
                          padding: 14,
                          gap: 10,
                          justifyContent: 'space-between',
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      {/* Top: Month Header & Badge */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: isPast ? '#10B981' : isCurrent ? colors.primary : colors.surfaceAlt,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isPast ? (
                              <Ionicons name="checkmark" size={13} color="#FFF" />
                            ) : isCurrent ? (
                              <Ionicons name="sparkles" size={11} color="#FFF" />
                            ) : (
                              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 9, color: colors.textSecondary }}>{i + 1}</Text>
                            )}
                          </View>
                          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: isCurrent ? colors.primary : colors.text }}>
                            {monthName} {y}
                          </Text>
                        </View>

                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="create-outline" size={14} color={colors.primary} />
                        </View>
                      </View>

                      {/* Status / Override Tag */}
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {isCurrent ? (
                          <View style={{ backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: '#FFF' }}>
                              {language === 'ar' ? 'الشهر الحالي 🟢' : 'Current 🟢'}
                            </Text>
                          </View>
                        ) : isPast ? (
                          <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: '#10B981' }}>
                              {language === 'ar' ? 'مكتمل ✅' : 'Completed ✅'}
                            </Text>
                          </View>
                        ) : (
                          <View style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                              {language === 'ar' ? `شهر ${i + 1}` : `Month ${i + 1}`}
                            </Text>
                          </View>
                        )}
                        {customOverride && (
                          <View style={{ backgroundColor: colors.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 9, color: colors.accent }}>
                              {language === 'ar' ? 'تعديل مخصص ✏️' : 'Custom ✏️'}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Planned & Actual Savings */}
                      <View style={{ gap: 4, backgroundColor: colors.surface, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                            {language === 'ar' ? 'المخطط:' : 'Planned:'}
                          </Text>
                          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: plannedSaving >= 0 ? '#10B981' : '#EF4444' }}>
                            {plannedSaving >= 0 ? '+' : ''}{formatCurrency(plannedSaving)} {sym}
                          </Text>
                        </View>
                        {(isPast || isCurrent) && hasActualData && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 3 }}>
                            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                              {language === 'ar' ? 'الفعلي:' : 'Actual:'}
                            </Text>
                            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: actualMonthSaving >= 0 ? '#10B981' : '#EF4444' }}>
                              {actualMonthSaving >= 0 ? '+' : ''}{formatCurrency(actualMonthSaving)} {sym}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Bottom Cumulative Total Box */}
                      <View style={{ backgroundColor: isCurrent ? colors.primary + '20' : colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: isCurrent ? colors.primary + '40' : colors.border }}>
                        <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: colors.textSecondary }}>
                          {language === 'ar' ? 'الرصيد التراكمي' : 'Cumulative Total'}
                        </Text>
                        <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: isCurrent ? colors.primary : colors.text }}>
                          {formatCurrency(cumulativeSavings)} {sym}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          );
        })()}
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
                  {language === 'ar' ? `المحفظة المحددة: ${selectedWallet.name}` : `Wallet: ${selectedWallet.name}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {showForm ? renderForm() : renderPlanView()}

        {/* Custom Adjust Plan Modal */}
        <Modal
          visible={isAdjustModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsAdjustModalOpen(false)}
        >
          <Pressable 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            onPress={Keyboard.dismiss}
          >
            <Pressable 
              style={{ width: '100%', maxWidth: 400, backgroundColor: Colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Colors.border, gap: 16 }}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: '#FFF', textAlign: 'center' }}>
                {language === 'ar' ? 'تعديل الميزانية لتلائم الواقع' : 'Adjust Plan to Fit Reality'}
              </Text>
              
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 }}>
                {language === 'ar'
                  ? 'تم حساب المتوسطات التاريخية لمصاريفك ودخلك. يمكنك تعديل القيم الآن لتشمل الرواتب الإضافية أو استبعاد المصاريف الاستثنائية.'
                  : 'Historical averages calculated. You can modify the values below to include bonuses or exclude one-off expenses.'}
              </Text>

              {/* Monthly Income Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.textSecondary, textAlign: 'left' }}>
                  {language === 'ar' ? 'الدخل الشهري المتوقع' : 'Expected Monthly Income'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: language === 'ar' ? 'right' : 'left' }}
                    keyboardType="decimal-pad"
                    value={adjustIncome}
                    onChangeText={setAdjustIncome}
                  />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.primary, marginLeft: 8 }}>{selectedWallet?.currency || 'EGP'}</Text>
                </View>
              </View>

              {/* Monthly Expense Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.textSecondary, textAlign: 'left' }}>
                  {language === 'ar' ? 'المصاريف الشهرية المتوقعة' : 'Expected Monthly Expenses'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: language === 'ar' ? 'right' : 'left' }}
                    keyboardType="decimal-pad"
                    value={adjustExpense}
                    onChangeText={setAdjustExpense}
                  />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.primary, marginLeft: 8 }}>{selectedWallet?.currency || 'EGP'}</Text>
                </View>
              </View>

              {/* Projected Monthly Savings Output */}
              {(() => {
                const inc = parseFloat(adjustIncome) || 0;
                const exp = parseFloat(adjustExpense) || 0;
                const net = inc - exp;
                return (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceAlt, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.textSecondary }}>
                      {language === 'ar' ? 'الصافي الادخاري الجديد' : 'New Projected Savings'}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: net >= 0 ? Colors.primary : Colors.expense }}>
                      {formatCurrency(net)} {selectedWallet?.currency || 'EGP'}
                    </Text>
                  </View>
                );
              })()}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <Pressable
                  onPress={handleSaveAdjustment}
                  style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#FFF' }}>
                    {language === 'ar' ? 'تحديث الخطة' : 'Update Plan'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setIsAdjustModalOpen(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: Colors.textSecondary }}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Single Month Custom Target Modal */}
        <Modal
          visible={singleMonthModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSingleMonthModalOpen(false)}
        >
          <Pressable 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            onPress={Keyboard.dismiss}
          >
            <Pressable 
              style={{ width: '100%', maxWidth: 420, backgroundColor: Colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Colors.border, gap: 16 }}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: Colors.border, paddingBottom: 10 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: '#FFF' }}>
                  {language === 'ar' ? `تخصيص استهداف شهر (${selectedMonthName})` : `Custom Target for (${selectedMonthName})`}
                </Text>
                <Pressable onPress={() => setSingleMonthModalOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 18, textAlign: 'left' }}>
                {language === 'ar'
                  ? 'يمكنك تعديل الدخل والمصاريف المتوقعة لهذا الشهر المحدد فقط (مثل مصاريف المدارس أو المكافآت) دون تغيير باقي أشهر الخطة.'
                  : 'Customize expected income and expenses for this specific month only.'}
              </Text>

              {/* Monthly Income Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.textSecondary, textAlign: 'left' }}>
                  {language === 'ar' ? `الدخل المستهدف لشهر (${selectedMonthName}):` : 'Target Income:'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: language === 'ar' ? 'right' : 'left' }}
                    keyboardType="decimal-pad"
                    value={singleMonthIncomeInput}
                    onChangeText={setSingleMonthIncomeInput}
                  />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.primary, marginLeft: 8 }}>{currencySymbol}</Text>
                </View>
              </View>

              {/* Monthly Expense Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.textSecondary, textAlign: 'left' }}>
                  {language === 'ar' ? `المصاريف المستهدفة لشهر (${selectedMonthName}):` : 'Target Expenses:'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: language === 'ar' ? 'right' : 'left' }}
                    keyboardType="decimal-pad"
                    value={singleMonthExpenseInput}
                    onChangeText={setSingleMonthExpenseInput}
                  />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.primary, marginLeft: 8 }}>{currencySymbol}</Text>
                </View>
              </View>

              {/* Net Result Preview */}
              {(() => {
                const inc = parseFloat(singleMonthIncomeInput) || 0;
                const exp = parseFloat(singleMonthExpenseInput) || 0;
                const net = inc - exp;
                return (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceAlt, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.textSecondary }}>
                      {language === 'ar' ? 'الادخار الصافي المتوقع لهذا الشهر:' : 'Projected Savings:'}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: net >= 0 ? Colors.primary : Colors.expense }}>
                      {formatCurrency(net)} {currencySymbol}
                    </Text>
                  </View>
                );
              })()}

              {/* Action Buttons */}
              <View style={{ gap: 8, marginTop: 4 }}>
                <Pressable
                  onPress={handleSaveSingleMonthOverride}
                  style={({ pressed }) => [
                    { height: 46, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#FFF' }}>
                    {language === 'ar' ? `حفظ استهداف ${selectedMonthName} 🎯` : 'Save Month Target 🎯'}
                  </Text>
                </Pressable>

                {plan?.customMonthlyOverrides?.[selectedMonthKey] && (
                  <Pressable
                    onPress={handleResetSingleMonthOverride}
                    style={({ pressed }) => [
                      { height: 40, borderRadius: 12, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
                      pressed && { opacity: 0.8 }
                    ]}
                  >
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.expense }}>
                      {language === 'ar' ? 'إعادة للاستهداف العام 🔄' : 'Reset to Global Target 🔄'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Custom Kakeibo Budgets Modal */}
        <Modal
          visible={isKakeiboBudgetModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsKakeiboBudgetModalOpen(false)}
        >
          <Pressable 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            onPress={Keyboard.dismiss}
          >
            <Pressable 
              style={{ width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border, gap: 16 }}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: '#FFF', textAlign: 'center' }}>
                {language === 'ar' ? 'ضبط ميزانية الأعمدة الأربعة (Kakeibo)' : 'Adjust Kakeibo Pillar Budgets'}
              </Text>
              
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 16 }}>
                {language === 'ar'
                  ? 'قسّم مصروفك الشهري المستهدف على التصنيفات الأربعة لتتبع التزامك بكفاءة.'
                  : 'Divide your total target expenses among the 4 pillars to track your mindfulness.'}
              </Text>

              {/* Auto 50/25/15/10 Smart Allocation Button */}
              <Pressable
                onPress={handleAutoKakeiboDistribution}
                style={({ pressed }) => [{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: colors.primary + '18',
                  borderWidth: 1,
                  borderColor: colors.primary + '40',
                  paddingVertical: 10,
                  borderRadius: 12,
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary }}>
                  {language === 'ar' ? 'توزيع ياباني تلقائي (50/25/15/10)' : 'Auto Japanese Allocation (50/25/15/10)'}
                </Text>
              </Pressable>

              {/* Survival Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, textAlign: 'left' }}>
                  {language === 'ar' ? 'الاحتياجات الأساسية (Survival)' : 'Survival / Needs'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: language === 'ar' ? 'right' : 'left' }}
                    keyboardType="decimal-pad"
                    value={kakeiboSurvivalInput}
                    onChangeText={setKakeiboSurvivalInput}
                  />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary, marginLeft: 8 }}>{selectedWallet?.currency || 'EGP'}</Text>
                </View>
              </View>

              {/* Wants Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, textAlign: 'left' }}>
                  {language === 'ar' ? 'الرغبات الترفيهية (Wants)' : 'Wants / Optional'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: language === 'ar' ? 'right' : 'left' }}
                    keyboardType="decimal-pad"
                    value={kakeiboWantsInput}
                    onChangeText={setKakeiboWantsInput}
                  />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary, marginLeft: 8 }}>{selectedWallet?.currency || 'EGP'}</Text>
                </View>
              </View>

              {/* Culture Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, textAlign: 'left' }}>
                  {language === 'ar' ? 'الثقافة والتعليم (Culture)' : 'Culture & Self-dev'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: language === 'ar' ? 'right' : 'left' }}
                    keyboardType="decimal-pad"
                    value={kakeiboCultureInput}
                    onChangeText={setKakeiboCultureInput}
                  />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary, marginLeft: 8 }}>{selectedWallet?.currency || 'EGP'}</Text>
                </View>
              </View>

              {/* Extra Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, textAlign: 'left' }}>
                  {language === 'ar' ? 'مصاريف إضافية وطارئة (Extra)' : 'Extra / Unplanned'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: language === 'ar' ? 'right' : 'left' }}
                    keyboardType="decimal-pad"
                    value={kakeiboExtraInput}
                    onChangeText={setKakeiboExtraInput}
                  />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary, marginLeft: 8 }}>{selectedWallet?.currency || 'EGP'}</Text>
                </View>
              </View>

              {/* Total Check */}
              {(() => {
                const totalVal = (parseFloat(kakeiboSurvivalInput) || 0) + 
                                 (parseFloat(kakeiboWantsInput) || 0) + 
                                 (parseFloat(kakeiboCultureInput) || 0) + 
                                 (parseFloat(kakeiboExtraInput) || 0);
                return (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceAlt, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.textSecondary }}>
                      {language === 'ar' ? 'إجمالي الميزانية الجديدة' : 'New Total Expenses'}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.primary }}>
                      {formatCurrency(totalVal)} {selectedWallet?.currency || 'EGP'}
                    </Text>
                  </View>
                );
              })()}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <Pressable
                  onPress={handleSaveKakeiboBudgets}
                  style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#FFF' }}>
                    {language === 'ar' ? 'تحديث الميزانية' : 'Save Budgets'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setIsKakeiboBudgetModalOpen(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.textSecondary }}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  durationChipActive: {
    backgroundColor: colors.primary + '12',
    borderColor: colors.primary,
  },
  durationText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  durationTextActive: {
    color: colors.primary,
  },
  inputWithCurrency: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingLeft: 4,
    paddingRight: 16,
    height: 56,
    gap: 10,
  },
  inputCurrencyTag: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputCurrencyText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.primary,
  },
  currencyInput: {
    flex: 1,
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.text,
  },
  previewCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
  },
  previewTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  previewAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
  },
  previewSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    backgroundColor: colors.primary,
    marginBottom: 20,
  },
  saveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: colors.text,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '12',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  planBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.primary,
  },
  planActions: {
    flexDirection: 'row',
    gap: 8,
  },
  planActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  goalName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  goalDuration: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    height: 140,
  },
  chartCenterAbs: {
    position: 'absolute',
    alignItems: 'center',
  },
  chartPercent: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: colors.text,
  },
  chartStatus: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  summaryLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  actualRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actualLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
  },
  actualValue: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  goalProgressSection: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
    marginBottom: 16,
  },
  goalProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalProgressTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  goalProgressAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.primary,
  },
  goalBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalBarFill: {
    height: 8,
    borderRadius: 4,
  },
  goalProgressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  goalProgressLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.text,
  },
  goalProgressRemaining: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  timelineSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  timelineTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
    marginBottom: 2,
  },
  timelineRowCurrent: {
    backgroundColor: colors.primary + '08',
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineContent: {
    flex: 1,
  },
  timelineMonth: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  timelineAmount: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.income,
  },
  timelineActual: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    marginTop: 2,
  },
  timelineTotal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.textTertiary,
  },
  celebrationCard: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  celebrationText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#B78103',
    textAlign: 'center',
    lineHeight: 22,
  },
  insightsSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  insightsTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    backgroundColor: colors.surfaceAlt,
  },
  insightRowDanger: {
    backgroundColor: colors.expenseLight,
    borderWidth: 1,
    borderColor: colors.expense + '20',
  },
  insightRowWarning: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  insightRowSuccess: {
    backgroundColor: colors.incomeLight,
    borderWidth: 1,
    borderColor: colors.income + '20',
  },
  insightText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  insightTextDanger: {
    color: colors.expense,
  },
  insightTextWarning: {
    color: '#B78103',
  },
  insightTextSuccess: {
    color: colors.income,
  },
  adjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary + '12',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: 8,
    marginTop: 4,
  },
  adjustButtonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
  moreMonths: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  moreMonthsText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textTertiary,
  },
  challengesGoldCard: {
    marginHorizontal: 0,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  challengesGoldGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
    gap: 12,
  },
  challengesGoldIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengesGoldInfo: {
    flex: 1,
    gap: 2,
  },
  challengesGoldTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
    textAlign: 'left',
  },
  challengesGoldSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'left',
    lineHeight: 16,
  },
  goalHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalTitleText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  goalDetailSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  goalTargetText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.primary,
    textAlign: 'left',
  },
  chartWrapMini: {
    position: 'relative',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenterAbsMini: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartPercentMini: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  metricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  metricValueText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  progressNoteText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
  },
  integrationCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  integrationTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
  },
  integrationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  integrationLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  integrationValue: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  projectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  projectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  projectionDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'left',
    lineHeight: 16,
  },
  projectionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  projectionCol: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  projectionPeriod: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  projectionValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 20,
    marginVertical: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    fontFamily: 'Cairo_700Bold',
    color: colors.text,
  },
  kakeiboBanner: {
    marginHorizontal: 20,
  },
  kakeiboPillarCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 20,
  },
  kakeiboAdjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginHorizontal: 20,
    marginVertical: 8,
  },
  reflectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  reflectionLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  reflectionInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
    textAlign: 'left',
  },
  reflectionSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
});
