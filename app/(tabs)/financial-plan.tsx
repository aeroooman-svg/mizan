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
                    🔥 {planProgressPct}% {loc('مكتمل', 'Completed', 'പൂർത്തിയായി')}
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
                    {loc(
                      `الشهر ${currentMonthNumber} من أصل ${totalMonths} شهر 🎯`,
                      `Month ${currentMonthNumber} of ${totalMonths} mos 🎯`,
                      `${totalMonths} മാസങ്ങളിൽ മാസം ${currentMonthNumber} 🎯`
                    )}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                    {loc('اسحب أفقياً لاستعراض الأشهر ➔', 'Swipe horizontally ➔', 'തിരശ്ചീനമായി സ്വൈപ്പ് ചെയ്യുക ➔')}
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
                              {loc('الشهر الحالي 🟢', 'Current 🟢', 'ഈ മാസം 🟢')}
                            </Text>
                          </View>
                        ) : isPast ? (
                          <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: '#10B981' }}>
                              {loc('مكتمل ✅', 'Completed ✅', 'പൂർത്തിയായി ✅')}
                            </Text>
                          </View>
                        ) : (
                          <View style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                              {loc(`شهر ${i + 1}`, `Month ${i + 1}`, `മാസം ${i + 1}`)}
                            </Text>
                          </View>
                        )}
                        {customOverride && (
                          <View style={{ backgroundColor: colors.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 9, color: colors.accent }}>
                              {loc('تعديل مخصص ✏️', 'Custom ✏️', 'മാറ്റം വരുത്തിയത് ✏️')}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Planned & Actual Savings */}
                      <View style={{ gap: 4, backgroundColor: colors.surface, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                            {loc('المخطط:', 'Planned:', 'പ്ലാൻ:')}
                          </Text>
                          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: plannedSaving >= 0 ? '#10B981' : '#EF4444' }}>
                            {plannedSaving >= 0 ? '+' : ''}{formatCurrency(plannedSaving)} {sym}
                          </Text>
                        </View>
                        {(isPast || isCurrent) && hasActualData && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 3 }}>
                            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                              {loc('الفعلي:', 'Actual:', 'യഥാർത്ഥം:')}
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
                          {loc('الرصيد التراكمي', 'Cumulative Total', 'ആകെ സഞ്ചിത തുക')}
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
                  {loc(`المحفظة المحددة: ${selectedWallet.name}`, `Wallet: ${selectedWallet.name}`, `തിരഞ്ഞെടുത്ത വാലറ്റ്: ${selectedWallet.name}`)}
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
                {loc('تعديل الميزانية لتلائم الواقع', 'Adjust Plan to Fit Reality', 'പ്ലാൻ യാഥാർത്ഥ്യവുമായി ക്രമീകരിക്കുക')}
              </Text>
              
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 }}>
                {loc(
                  'تم حساب المتوسطات التاريخية لمصاريفك ودخلك. يمكنك تعديل القيم الآن لتشمل الرواتب الإضافية أو استبعاد المصاريف الاستثنائية.',
                  'Historical averages calculated. You can modify the values below to include bonuses or exclude one-off expenses.',
                  'ചരിത്രപരമായ ശരാശരികൾ കണക്കാക്കി. വരും മാസങ്ങളിലേക്കായി തുകകൾ മാറ്റാവുന്നതാണ്.'
                )}
              </Text>

              {/* Monthly Income Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.textSecondary, textAlign: 'left' }}>
                  {loc('الدخل الشهري المتوقع', 'Expected Monthly Income', 'പ്രതീക്ഷിത പ്രതിമാസ വരുമാനം')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
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
                  {loc('المصاريف الشهرية المتوقعة', 'Expected Monthly Expenses', 'പ്രതീക്ഷിത പ്രതിമാസ ചെലവുകൾ')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
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
                      {loc('الصافي الادخاري الجديد', 'New Projected Savings', 'പുതിയ പ്രതീക്ഷിക്കുന്ന സമ്പാദ്യം')}
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
                    {loc('تحديث الخطة', 'Update Plan', 'പ്ലാൻ അപ്ഡേറ്റ് ചെയ്യുക')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setIsAdjustModalOpen(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: Colors.textSecondary }}>
                    {loc('إلغاء', 'Cancel', 'റദ്ദാക്കുക')}
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
                  {loc(`تخصيص استهداف شهر (${selectedMonthName})`, `Custom Target for (${selectedMonthName})`, `${selectedMonthName} മാസത്തെ പ്രത്യേക ലക്ഷ്യം`)}
                </Text>
                <Pressable onPress={() => setSingleMonthModalOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 18, textAlign: 'left' }}>
                {loc(
                  'يمكنك تعديل الدخل والمصاريف المتوقعة لهذا الشهر المحدد فقط (مثل مصاريف المدارس أو المكافآت) دون تغيير باقي أشهر الخطة.',
                  'Customize expected income and expenses for this specific month only.',
                  'മറ്റ് മാസങ്ങളെ ബാധിക്കാതെ ഈ മാസത്തെ വരുമാനവും ചെലവും മാറ്റുക.'
                )}
              </Text>

              {/* Monthly Income Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.textSecondary, textAlign: 'left' }}>
                  {loc(`الدخل المستهدف لشهر (${selectedMonthName}):`, 'Target Income:', 'ലക്ഷ്യ വരുമാനം:')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
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
                  {loc(`المصاريف المستهدفة لشهر (${selectedMonthName}):`, 'Target Expenses:', 'ലക്ഷ്യ ചെലവ്:')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
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
                      {loc('الادخار الصافي المتوقع لهذا الشهر:', 'Projected Savings:', 'പ്രതീക്ഷിക്കുന്ന അറ്റ സമ്പാദ്യം:')}
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
                    {loc(`حفظ استهداف ${selectedMonthName} 🎯`, 'Save Month Target 🎯', 'മാസ ലക്ഷ്യം സേവ് ചെയ്യുക 🎯')}
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
                      {loc('إعادة للاستهداف العام 🔄', 'Reset to Global Target 🔄', 'സാധാരണ ലക്ഷ്യത്തിലേക്ക് പുനഃക്രമീകരിക്കുക 🔄')}
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
                {loc('ضبط ميزانية الأعمدة الأربعة (Kakeibo)', 'Adjust Kakeibo Pillar Budgets', 'കാകെയ്ബോ സ്തംഭ ബജറ്റ് ക്രമീകരിക്കുക')}
              </Text>
              
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 16 }}>
                {loc(
                  'قسّم مصروفك الشهري المستهدف على التصنيفات الأربعة لتتبع التزامك بكفاءة.',
                  'Divide your total target expenses among the 4 pillars to track your mindfulness.',
                  'നിങ്ങളുടെ പ്രതിമാസ ചെലവ് 4 സ്തംഭങ്ങളിലായി വിഭജിക്കുക.'
                )}
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
                  {loc('توزيع ياباني تلقائي (50/25/15/10)', 'Auto Japanese Allocation (50/25/15/10)', 'ഓട്ടോ ജാപ്പനീസ് വിഭജനം (50/25/15/10)')}
                </Text>
              </Pressable>

              {/* Survival Input */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, textAlign: 'left' }}>
                  {loc('الاحتياجات الأساسية (Survival)', 'Survival / Needs', 'അടിസ്ഥാന ആവശ്യങ്ങൾ (Survival)')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
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
                  {loc('الرغبات الترفيهية (Wants)', 'Wants / Optional', 'വിനോദവും ആഗ്രഹങ്ങളും (Wants)')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
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
                  {loc('الثقافة والتعليم (Culture)', 'Culture & Self-dev', 'സംസ്കാരവും വിദ്യാഭ്യാസവും (Culture)')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
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
                  {loc('مصاريف إضافية وطارئة (Extra)', 'Extra / Unplanned', 'അപ്രതീക്ഷിത ചെലവുകൾ (Extra)')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
                  <TextInput
                    style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
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
                      {loc('إجمالي الميزانية الجديدة', 'New Total Expenses', 'ആകെ പുതിയ ചെലവ്')}
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
                    {loc('تحديث الميزانية', 'Save Budgets', 'ബജറ്റ് സേവ് ചെയ്യുക')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setIsKakeiboBudgetModalOpen(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.textSecondary }}>
                    {loc('إلغاء', 'Cancel', 'റദ്ദാക്കുക')}
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
