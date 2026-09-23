import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
import { getInstallmentStyles } from '@/components/installments/installmentStyles';
import {
  InstallmentPlan,
  getInstallmentPlans,
  saveInstallmentPlan,
  deleteInstallmentPlan,
  payInstallmentMonth,
} from '@/lib/installmentStorage';
import {
  Jameya,
  getJameyas,
  saveJameya,
  deleteJameya,
  payJameyaMonth,
  receiveJameyaPayout,
} from '@/lib/jameyaStorage';
import SmartFinanceCalculator from '@/components/installments/SmartFinanceCalculator';

interface InstallmentsScreenProps {
  initialTab?: 'installments' | 'jameya' | 'smart_calc';
}

export default function InstallmentsScreen({ initialTab }: InstallmentsScreenProps) {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getInstallmentStyles(colors, theme), [colors, theme]);
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { selectedWallet, wallets, addTransaction, totalIncome, refresh } = useTransactions();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<'installments' | 'jameya' | 'smart_calc'>(
    initialTab || (params.tab === 'jameya' ? 'jameya' : params.tab === 'smart_calc' ? 'smart_calc' : 'installments')
  );

  // Sync tab if param changes externally
  useEffect(() => {
    if (params.tab === 'jameya' || params.tab === 'installments' || params.tab === 'smart_calc') {
      setActiveTab(params.tab as any);
    }
  }, [params.tab]);

  // Data States
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [jameyas, setJameyas] = useState<Jameya[]>([]);

  // Modal Visibility States
  const [installmentModalVisible, setInstallmentModalVisible] = useState(false);
  const [jameyaModalVisible, setJameyaModalVisible] = useState(false);

  // Installments Custom Confirmation Modals State
  const [payingPlan, setPayingPlan] = useState<InstallmentPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<InstallmentPlan | null>(null);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Jameya Custom Confirmation Modals State
  const [editingJameya, setEditingJameya] = useState<Jameya | null>(null);
  const [payingJameyaItem, setPayingJameyaItem] = useState<Jameya | null>(null);
  const [jameyaPayoutTarget, setJameyaPayoutTarget] = useState<{ item: Jameya; month?: number } | null>(null);
  const [deductCurrentInstallment, setDeductCurrentInstallment] = useState(false);
  const [deletingJameyaItem, setDeletingJameyaItem] = useState<Jameya | null>(null);
  const [isSubmittingJameya, setIsSubmittingJameya] = useState(false);
  const [jameyaFormError, setJameyaFormError] = useState<string | null>(null);

  // Installment Form State
  const [calcMode, setCalcMode] = useState<'total_and_months' | 'monthly_and_months'>('total_and_months');
  const [title, setTitle] = useState('');
  const [totalAmountInput, setTotalAmountInput] = useState('');
  const [monthlyAmountInput, setMonthlyAmountInput] = useState('');
  const [totalMonths, setTotalMonths] = useState('6');
  const [provider, setProvider] = useState<InstallmentPlan['provider']>('valu');
  const [dueDay, setDueDay] = useState('5');
  const [category, setCategory] = useState('other');
  const [sourceWalletId, setSourceWalletId] = useState<string>(selectedWallet?.id || wallets[0]?.id || '');
  const [isTransfer, setIsTransfer] = useState(false);
  const [toWalletId, setToWalletId] = useState<string>('');

  // Jameya Form State
  const [jameyaName, setJameyaName] = useState('');
  const [jameyaSingleShareAmount, setJameyaSingleShareAmount] = useState('');
  const [jameyaSharesCount, setJameyaSharesCount] = useState('1');
  const [jameyaTotalMonths, setJameyaTotalMonths] = useState('8');
  const [jameyaStartMonth, setJameyaStartMonth] = useState(new Date().toISOString().substring(0, 7));
  const [jameyaWalletId, setJameyaWalletId] = useState(selectedWallet?.id || wallets[0]?.id || '');
  const [jameyaPayoutMonthsInputs, setJameyaPayoutMonthsInputs] = useState<string[]>(['1']);

  useEffect(() => {
    if (selectedWallet && !sourceWalletId) {
      setSourceWalletId(selectedWallet.id);
    }
    if (selectedWallet && !jameyaWalletId) {
      setJameyaWalletId(selectedWallet.id);
    }
  }, [selectedWallet]);

  // Adjust Jameya payout months inputs array when shares count changes
  useEffect(() => {
    const count = Math.max(1, Math.floor(parseFloat(jameyaSharesCount) || 1));
    setJameyaPayoutMonthsInputs(prev => {
      const next = [...prev];
      while (next.length < count) {
        next.push((next.length + 1).toString());
      }
      return next.slice(0, count);
    });
  }, [jameyaSharesCount]);

  // Data Loading
  const loadData = useCallback(async () => {
    const [instData, jamData] = await Promise.all([
      getInstallmentPlans(),
      getJameyas(),
    ]);
    setPlans(instData);
    setJameyas(jamData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const currency = selectedWallet?.currency || 'EGP';

  // --- Computed Metrics for Installments ---
  const activePlans = useMemo(() => plans.filter(p => p.remainingMonths > 0), [plans]);
  const completedPlans = useMemo(() => plans.filter(p => p.remainingMonths === 0), [plans]);

  const totalRemainingDebt = useMemo(
    () => activePlans.reduce((sum, p) => sum + p.remainingMonths * p.monthlyAmount, 0),
    [activePlans]
  );

  const totalMonthlyCommitment = useMemo(
    () => activePlans.reduce((sum, p) => sum + p.monthlyAmount, 0),
    [activePlans]
  );

  // Obligation Ratio (% of monthly income consumed by installments)
  const monthlyIncomeBase = totalIncome && totalIncome > 0 ? totalIncome : 1000;
  const obligationRatio = Math.round((totalMonthlyCommitment / monthlyIncomeBase) * 100);

  const safetyLevel = useMemo(() => {
    if (obligationRatio <= 20) return { label: isAr ? 'نطاق آمن ممتاز 🟢' : 'Excellent Safe Range 🟢', color: '#10B981', bg: '#10B98115' };
    if (obligationRatio <= 35) return { label: isAr ? 'استقطاع متوسط ⚠️' : 'Moderate Deduction ⚠️', color: '#F59E0B', bg: '#F59E0B15' };
    return { label: isAr ? 'ضغط مالي مرتفع 🚨' : 'High Financial Stress 🚨', color: '#EF4444', bg: '#EF444415' };
  }, [obligationRatio, isAr]);

  const maxMonthsLeft = useMemo(() => {
    if (activePlans.length === 0) return 0;
    return Math.max(...activePlans.map(p => p.remainingMonths));
  }, [activePlans]);

  const freedomDateFormatted = useMemo(() => {
    if (maxMonthsLeft === 0) return null;
    const target = new Date();
    target.setMonth(target.getMonth() + maxMonthsLeft);
    return target.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
  }, [maxMonthsLeft, isAr]);

  // --- Computed Metrics for Jameya ---
  const activeJameyas = useMemo(() => jameyas.filter(j => j.paidMonthsCount < j.totalMonths), [jameyas]);
  const completedJameyas = useMemo(() => jameyas.filter(j => j.paidMonthsCount >= j.totalMonths), [jameyas]);

  const totalJameyaMonthlyCommitment = useMemo(
    () => activeJameyas.reduce((sum, j) => sum + j.monthlyAmount, 0),
    [activeJameyas]
  );

  const totalJameyaExpectedPayout = useMemo(
    () => jameyas.filter(j => !j.isPayoutReceived).reduce((sum, j) => sum + (j.monthlyAmount * j.totalMonths), 0),
    [jameyas]
  );

  // Live Calculator Preview inside Add Installment Modal
  const calculatedValues = useMemo(() => {
    const monthsNum = parseInt(totalMonths, 10) || 1;
    if (calcMode === 'total_and_months') {
      const tot = parseFloat(totalAmountInput) || 0;
      const m = monthsNum > 0 ? Math.round((tot / monthsNum) * 100) / 100 : 0;
      return { total: tot, monthly: m, months: monthsNum };
    } else {
      const m = parseFloat(monthlyAmountInput) || 0;
      const tot = Math.round(m * monthsNum * 100) / 100;
      return { total: tot, monthly: m, months: monthsNum };
    }
  }, [calcMode, totalAmountInput, monthlyAmountInput, totalMonths]);

  // Live Calculated Pot Preview inside Jameya Modal
  const computedSingleShareVal = parseFloat(jameyaSingleShareAmount) || 0;
  const computedSharesCountVal = parseFloat(jameyaSharesCount) || 1;
  const computedTotalMonthsVal = parseInt(jameyaTotalMonths, 10) || 1;
  const computedMonthlyTotalPay = computedSingleShareVal * computedSharesCountVal;
  const computedPotPerShare = computedSingleShareVal * computedTotalMonthsVal;
  const computedTotalJameyaPayout = computedPotPerShare * computedSharesCountVal;

  // Handlers
  const handleBack = () => {
    Haptics.selectionAsync();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleOpenAdd = () => {
    Haptics.selectionAsync();
    if (activeTab === 'installments') {
      setTitle('');
      setTotalAmountInput('');
      setMonthlyAmountInput('');
      setTotalMonths('6');
      setDueDay('5');
      setInstallmentModalVisible(true);
    } else {
      handleOpenAddJameya();
    }
  };

  const handleOpenAddJameya = () => {
    Haptics.selectionAsync();
    setEditingJameya(null);
    setJameyaFormError(null);
    setJameyaName('');
    setJameyaSingleShareAmount('');
    setJameyaSharesCount('1');
    setJameyaTotalMonths('8');
    setJameyaPayoutMonthsInputs(['1']);
    setJameyaStartMonth(new Date().toISOString().substring(0, 7));
    setJameyaWalletId(selectedWallet?.id || wallets[0]?.id || '');
    setJameyaModalVisible(true);
  };

  const handleOpenEditJameya = (item: Jameya) => {
    Haptics.selectionAsync();
    setEditingJameya(item);
    setJameyaFormError(null);
    setJameyaName(item.name);

    const count = item.sharesCount || 1;
    const shareVal = item.singleShareAmount || (item.monthlyAmount / count);
    setJameyaSingleShareAmount(shareVal.toString());
    setJameyaSharesCount(count.toString());
    setJameyaTotalMonths(item.totalMonths.toString());

    const pm = item.payoutMonths && item.payoutMonths.length > 0
      ? item.payoutMonths.map(n => n.toString())
      : [(item.payoutMonth || 1).toString()];
    setJameyaPayoutMonthsInputs(pm);

    setJameyaStartMonth(item.startMonth);
    setJameyaWalletId(item.walletId);
    setJameyaModalVisible(true);
  };

  const handleAddInstallmentPlan = async () => {
    if (!title.trim()) {
      Alert.alert(isAr ? 'تنبيه' : 'Warning', isAr ? 'يرجى إدخال اسم القسط / المنتج' : 'Please enter item title');
      return;
    }

    const { total, monthly, months } = calculatedValues;
    if (total <= 0 || monthly <= 0 || months <= 0) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'المبلغ وعدد الأشهر يجب أن تكون أرقاماً موجبة' : 'Invalid amount or months');
      return;
    }

    const numDueDay = parseInt(dueDay, 10) || 5;
    const activeSourceId = sourceWalletId || selectedWallet?.id || (wallets[0] ? wallets[0].id : '');
    const activeTargetId = isTransfer && toWalletId ? toWalletId : undefined;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await saveInstallmentPlan({
      title: title.trim(),
      totalAmount: total,
      monthlyAmount: monthly,
      totalMonths: months,
      remainingMonths: months,
      provider,
      dueDay: numDueDay,
      category,
      walletId: activeSourceId,
      toWalletId: activeTargetId,
    });

    setTitle('');
    setTotalAmountInput('');
    setMonthlyAmountInput('');
    setTotalMonths('6');
    setDueDay('5');
    setInstallmentModalVisible(false);
    await loadData();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveJameya = async () => {
    setJameyaFormError(null);
    if (!jameyaName.trim()) {
      const err = isAr ? 'يرجى إدخال اسم الجمعية' : 'Please enter association name';
      setJameyaFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'تنبيه' : 'Notice', err);
      return;
    }
    if (computedSingleShareVal <= 0) {
      const err = isAr ? 'يرجى إدخال قيمة صحيحة لـ مبلغ الاسم/السهم الواحد' : 'Please enter a valid share amount';
      setJameyaFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'تنبيه' : 'Notice', err);
      return;
    }
    if (computedSharesCountVal <= 0) {
      const err = isAr ? 'يرجى إدخال عدد أسهم/أسماء صحيح' : 'Please enter a valid shares count';
      setJameyaFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'تنبيه' : 'Notice', err);
      return;
    }
    if (computedTotalMonthsVal <= 0) {
      const err = isAr ? 'يرجى إدخال عدد أشهر صحيح' : 'Please enter valid total months';
      setJameyaFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'تنبيه' : 'Notice', err);
      return;
    }

    const parsedPayoutMonths: number[] = [];
    for (let i = 0; i < jameyaPayoutMonthsInputs.length; i++) {
      const val = parseInt(jameyaPayoutMonthsInputs[i], 10);
      if (isNaN(val) || val < 1 || val > computedTotalMonthsVal) {
        const err = isAr
          ? `شهر القبض رقم (${i + 1}) يجب أن يكون برقم بين 1 و ${computedTotalMonthsVal}`
          : `Payout month #${i + 1} must be between 1 and ${computedTotalMonthsVal}`;
        setJameyaFormError(err);
        if (Platform.OS !== 'web') Alert.alert(isAr ? 'خطأ في شهر القبض' : 'Payout Month Error', err);
        return;
      }
      parsedPayoutMonths.push(val);
    }

    const targetWalletId = jameyaWalletId || selectedWallet?.id || (wallets[0]?.id || '');
    if (!targetWalletId) {
      const err = isAr ? 'يرجى اختيار محفظة مرتبطة' : 'Please select a wallet';
      setJameyaFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'تنبيه' : 'Notice', err);
      return;
    }

    try {
      await saveJameya({
        id: editingJameya?.id,
        name: jameyaName.trim(),
        singleShareAmount: computedSingleShareVal,
        sharesCount: computedSharesCountVal,
        monthlyAmount: computedMonthlyTotalPay,
        totalMonths: computedTotalMonthsVal,
        payoutMonth: parsedPayoutMonths[0] || 1,
        payoutMonths: parsedPayoutMonths,
        receivedPayoutMonths: editingJameya ? editingJameya.receivedPayoutMonths : [],
        startMonth: jameyaStartMonth || new Date().toISOString().substring(0, 7),
        paidMonthsCount: editingJameya ? editingJameya.paidMonthsCount : 0,
        isPayoutReceived: editingJameya ? editingJameya.isPayoutReceived : false,
        walletId: targetWalletId,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJameyaFormError(null);
      setJameyaModalVisible(false);
      await loadData();
    } catch (e) {
      const err = isAr ? 'فشل حفظ الجمعية' : 'Failed to save association';
      setJameyaFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'خطأ' : 'Error', err);
    }
  };

  const handleConfirmPayInstallment = async () => {
    if (!payingPlan || isSubmittingPay) return;
    setIsSubmittingPay(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const res = await payInstallmentMonth(payingPlan.id, addTransaction);
      if (res.success) {
        await refresh();
        await loadData();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.error('Error paying installment:', err);
    } finally {
      setIsSubmittingPay(false);
      setPayingPlan(null);
    }
  };

  const handleConfirmDeleteInstallment = async () => {
    if (!deletingPlan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deleteInstallmentPlan(deletingPlan.id);
    await loadData();
    setDeletingPlan(null);
  };

  const handleConfirmPayJameyaMonth = async () => {
    if (!payingJameyaItem || isSubmittingJameya) return;
    setIsSubmittingJameya(true);
    try {
      const res = await payJameyaMonth(payingJameyaItem.id, addTransaction);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPayingJameyaItem(null);
        await loadData();
      } else {
        Alert.alert(isAr ? 'ملاحظة' : 'Notice', isAr ? 'تم سداد جميع أقساط هذه الجمعية بالفعل' : 'All installments paid for this association');
      }
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'حدث خطأ أثناء تسجيل القسط' : 'Error recording payment');
    } finally {
      setIsSubmittingJameya(false);
    }
  };

  const handleConfirmReceiveJameyaPayout = async () => {
    if (!jameyaPayoutTarget || isSubmittingJameya) return;
    setIsSubmittingJameya(true);
    try {
      const res = await receiveJameyaPayout(
        jameyaPayoutTarget.item.id,
        addTransaction,
        jameyaPayoutTarget.month,
        deductCurrentInstallment
      );
      if (res) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setJameyaPayoutTarget(null);
        setDeductCurrentInstallment(false);
        await loadData();
      } else {
        Alert.alert(isAr ? 'ملاحظة' : 'Notice', isAr ? 'تم استلام مبلغ هذا الدور سابقاً' : 'Payout already received');
      }
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'حدث خطأ أثناء تسجيل القبض' : 'Error recording payout');
    } finally {
      setIsSubmittingJameya(false);
    }
  };

  const handleConfirmDeleteJameya = async () => {
    if (!deletingJameyaItem) return;
    try {
      await deleteJameya(deletingJameyaItem.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeletingJameyaItem(null);
      await loadData();
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل الحذف' : 'Failed to delete');
    }
  };

  const getProviderIcon = (prov: InstallmentPlan['provider']) => {
    switch (prov) {
      case 'valu': return 'flash-outline';
      case 'tabby': return 'card-outline';
      case 'tamara': return 'cart-outline';
      case 'bank_card': return 'card-sharp';
      default: return 'calendar-outline';
    }
  };

  const getProviderName = (prov: InstallmentPlan['provider']) => {
    switch (prov) {
      case 'valu': return 'Valu (فاليو)';
      case 'tabby': return 'Tabby (تابي)';
      case 'tamara': return 'Tamara (تمارا)';
      case 'bank_card': return isAr ? 'بطاقة ائتمان بنكية' : 'Bank Credit Card';
      default: return isAr ? 'تقسيط آخر' : 'Other Installment';
    }
  };

  const getDueStatus = (plan: InstallmentPlan) => {
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const isPaidThisMonth = plan.lastPaidMonth === currentMonthKey;
    if (isPaidThisMonth) {
      return {
        text: isAr ? '✅ تم سداد قسط هذا الشهر' : '✅ Paid for this month',
        color: colors.primary,
        bgColor: colors.primary + '18',
        isPaid: true,
        isOverdue: false,
      };
    }

    const todayDay = new Date().getDate();
    const dueDayNum = plan.dueDay || 5;

    if (todayDay > dueDayNum) {
      return {
        text: isAr ? `⚠️ قسط مستحق السداد (كان يوم ${dueDayNum} بالشهر)` : `⚠️ Overdue since day ${dueDayNum}`,
        color: '#EF4444',
        bgColor: '#EF444418',
        isPaid: false,
        isOverdue: true,
      };
    } else {
      const daysLeft = dueDayNum - todayDay;
      return {
        text: isAr
          ? `🔔 مستحق السداد خلال ${daysLeft === 0 ? 'اليوم' : `${daysLeft} أيام`} (يوم ${dueDayNum})`
          : `🔔 Due in ${daysLeft} days (day ${dueDayNum})`,
        color: '#F59E0B',
        bgColor: '#F59E0B18',
        isPaid: false,
        isOverdue: false,
      };
    }
  };

  const urgentStats = useMemo(() => {
    let overdueCount = 0;
    let dueSoonCount = 0;
    activePlans.forEach(p => {
      const st = getDueStatus(p);
      if (!st.isPaid) {
        if (st.isOverdue) overdueCount++;
        else dueSoonCount++;
      }
    });
    return { overdueCount, dueSoonCount };
  }, [activePlans]);

  const renderSharesBadge = (shares: number = 1) => {
    let label = isAr ? 'اسم واحد (سهم)' : '1 Share';
    if (shares === 0.5) label = isAr ? 'نصف اسم (0.5 سهم)' : '0.5 Share';
    else if (shares === 2) label = isAr ? 'اسمين (2 سهم)' : '2 Shares';
    else if (shares > 2) label = isAr ? `${shares} أسماء (أسهم)` : `${shares} Shares`;

    return (
      <View style={styles.sharesBadge}>
        <MaterialCommunityIcons name="ticket-account" size={13} color={colors.primary} />
        <Text style={styles.sharesBadgeText}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sleek App Header */}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={15}>
          <Ionicons name={isAr ? "chevron-forward" : "chevron-back"} size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isAr ? '💳 أقساط وجمعيات' : '💳 Installments & Associations'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {isAr ? 'جدولة الالتزامات الشهرية والتحرر المالي' : 'Manage credit cards, BNPL & savings circles'}
          </Text>
        </View>
        <Pressable onPress={handleOpenAdd} style={styles.addBtn} hitSlop={8}>
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 90 }]}>
        {/* Executive Summary Hero Banner */}
        {activeTab !== 'smart_calc' && (
          <LinearGradient
            colors={
              theme === 'dark'
                ? (activeTab === 'installments' ? ['#1E1B4B', '#111827', '#0A1128'] : ['#064E3B', '#042F2E', '#0A1128'])
                : (activeTab === 'installments' ? ['#EEF2FF', '#E0E7FF', '#EFF6FF'] : ['#ECFDF5', '#D1FAE5', '#EFF6FF'])
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.heroPositionBadge}>
                  {activeTab === 'installments' ? (
                    <>
                      <Ionicons name="shield-checkmark" size={14} color={safetyLevel.color} />
                      <Text style={[styles.heroPositionText, { color: safetyLevel.color }]}>
                        {safetyLevel.label} ({obligationRatio}% {isAr ? 'من الدخل' : 'of income'})
                      </Text>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="handshake" size={14} color="#10B981" />
                      <Text style={[styles.heroPositionText, { color: '#10B981' }]}>
                        {isAr ? 'ادخار تعاوني منظم' : 'Zero-interest Savings'}
                      </Text>
                    </>
                  )}
                </View>

                <Text style={[styles.heroMainAmount, { color: theme === 'dark' ? '#FFF' : '#1E293B' }]}>
                  {formatCurrency(activeTab === 'installments' ? totalRemainingDebt : totalJameyaExpectedPayout)}{' '}
                  <Text style={styles.heroCurrencySymbol}>{currency}</Text>
                </Text>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
                  {activeTab === 'installments'
                    ? (isAr ? 'إجمالي المتبقي من الديون والأقساط' : 'Total Remaining Debt')
                    : (isAr ? 'إجمالي مبالغ في انتظار القبض' : 'Total Expected ROSCA Pot')}
                </Text>
              </View>

              <View style={[styles.heroIconBadge, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)' }]}>
                <MaterialCommunityIcons
                  name={activeTab === 'installments' ? "credit-card-chip-outline" : "handshake"}
                  size={30}
                  color={activeTab === 'installments' ? '#6366F1' : '#10B981'}
                />
              </View>
            </View>

            {/* Sub Metrics Grid */}
            <View style={styles.heroSubGrid}>
              <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' }]}>
                <View style={styles.heroSubCardHeader}>
                  <Ionicons name="calendar-outline" size={13} color={colors.primary} />
                  <Text style={styles.heroSubLabel}>{isAr ? 'الالتزام الشهري' : 'Monthly Due'}</Text>
                </View>
                <Text style={[styles.heroSubVal, { color: colors.primary }]}>
                  {formatCurrency(activeTab === 'installments' ? totalMonthlyCommitment : totalJameyaMonthlyCommitment)} <Text style={{ fontSize: 9 }}>{currency}</Text>
                </Text>
                <Text style={styles.heroSubCount}>
                  {activeTab === 'installments' ? `${activePlans.length} ${isAr ? 'أقساط' : 'plans'}` : `${activeJameyas.length} ${isAr ? 'جمعيات' : 'circles'}`}
                </Text>
              </View>

              <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' }]}>
                <View style={styles.heroSubCardHeader}>
                  <Ionicons name="pie-chart-outline" size={13} color="#F59E0B" />
                  <Text style={styles.heroSubLabel}>{isAr ? 'نسبة الاستقطاع' : 'Income Ratio'}</Text>
                </View>
                <Text style={[styles.heroSubVal, { color: '#F59E0B' }]}>
                  {obligationRatio}%
                </Text>
                <Text style={styles.heroSubCount}>
                  {isAr ? 'من الدخل الشهري' : 'of income'}
                </Text>
              </View>

              <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' }]}>
                <View style={styles.heroSubCardHeader}>
                  <Ionicons name="sparkles-outline" size={13} color="#10B981" />
                  <Text style={styles.heroSubLabel}>{isAr ? 'التحرر التام' : 'Freedom Date'}</Text>
                </View>
                <Text style={[styles.heroSubVal, { color: '#10B981', fontSize: 11 }]} numberOfLines={1}>
                  {freedomDateFormatted || (isAr ? 'محرر ماليّاً' : 'Debt-Free')}
                </Text>
                <Text style={styles.heroSubCount}>
                  {isAr ? 'خطة تصفية الديون' : 'target date'}
                </Text>
              </View>
            </View>

            {/* Alert Notice Tag inside Hero */}
            {urgentStats.overdueCount > 0 ? (
              <View style={[styles.heroNoticeTag, { backgroundColor: '#EF444425' }]}>
                <Ionicons name="alert-circle" size={15} color="#EF4444" />
                <Text style={[styles.heroNoticeText, { color: '#EF4444' }]} numberOfLines={1}>
                  {isAr ? `تنبيه عاجل: لديك ${urgentStats.overdueCount} قسط متأخر يستوجب السداد فوراً!` : `Alert: ${urgentStats.overdueCount} overdue installment(s)!`}
                </Text>
              </View>
            ) : urgentStats.dueSoonCount > 0 ? (
              <View style={styles.heroNoticeTag}>
                <Ionicons name="time-outline" size={15} color="#F59E0B" />
                <Text style={styles.heroNoticeText} numberOfLines={1}>
                  {isAr ? `تنبيه: لديك ${urgentStats.dueSoonCount} قسط قادم خلال هذا الشهر` : `Notice: ${urgentStats.dueSoonCount} installment(s) due soon`}
                </Text>
              </View>
            ) : activePlans.length > 0 ? (
              <View style={[styles.heroNoticeTag, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="checkmark-done-circle" size={15} color="#10B981" />
                <Text style={[styles.heroNoticeText, { color: '#10B981' }]} numberOfLines={1}>
                  {isAr ? 'وضعك ممتاز! جميع أقساط هذا الشهر مسددة بالكامل 🎉' : 'All clear! All installments for this month paid 🎉'}
                </Text>
              </View>
            ) : null}
          </LinearGradient>
        )}

        {/* Action Shortcut Banner */}
        {activeTab !== 'smart_calc' && (
          <Pressable
            onPress={handleOpenAdd}
            style={({ pressed }) => [
              styles.createActionBanner,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
          >
            <View style={styles.createActionLeft}>
              <View style={[styles.createActionIcon, { backgroundColor: activeTab === 'installments' ? '#6366F118' : '#10B98118' }]}>
                <Ionicons
                  name="add-circle"
                  size={26}
                  color={activeTab === 'installments' ? '#6366F1' : '#10B981'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.createActionTitle, { color: colors.text }]}>
                  {isAr
                    ? (activeTab === 'installments' ? 'إضافة قسط جديد أو بطاقة تقسيط' : 'إضافة جمعية شهرية جديدة')
                    : (activeTab === 'installments' ? 'Add Installment or Credit Plan' : 'Join / Create Monthly Circle')}
                </Text>
                <Text style={[styles.createActionSubtitle, { color: colors.textSecondary }]}>
                  {isAr ? 'حدد القيمة، المدة، والجهة (Valu، تابي، بطاقة بنكية)' : 'Set total amount, months & provider'}
                </Text>
              </View>
            </View>
            <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textTertiary} />
          </Pressable>
        )}

        {/* Unified Segment Switcher Tab Bar */}
        <View style={styles.segmentContainer}>
          <Pressable
            style={[styles.segmentBtn, activeTab === 'installments' && styles.segmentBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('installments');
            }}
          >
            <Ionicons
              name="card-outline"
              size={17}
              color={activeTab === 'installments' ? '#FFF' : colors.textSecondary}
            />
            <Text style={[styles.segmentText, activeTab === 'installments' && styles.segmentTextActive]}>
              {isAr ? 'الأقساط' : 'Installments'}
            </Text>
            {activePlans.length > 0 && (
              <View style={[styles.badgeCount, activeTab === 'installments' && { backgroundColor: '#FFFFFF33' }]}>
                <Text style={[styles.badgeCountText, activeTab === 'installments' && { color: '#FFF' }]}>
                  {activePlans.length}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeTab === 'jameya' && styles.segmentBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('jameya');
            }}
          >
            <Ionicons
              name="people-outline"
              size={17}
              color={activeTab === 'jameya' ? '#FFF' : colors.textSecondary}
            />
            <Text style={[styles.segmentText, activeTab === 'jameya' && styles.segmentTextActive]}>
              {isAr ? 'الجمعيات' : 'Circles'}
            </Text>
            {activeJameyas.length > 0 && (
              <View style={[styles.badgeCount, activeTab === 'jameya' && { backgroundColor: '#FFFFFF33' }]}>
                <Text style={[styles.badgeCountText, activeTab === 'jameya' && { color: '#FFF' }]}>
                  {activeJameyas.length}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeTab === 'smart_calc' && styles.segmentBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('smart_calc');
            }}
          >
            <Ionicons
              name="bulb-outline"
              size={17}
              color={activeTab === 'smart_calc' ? '#FFF' : colors.textSecondary}
            />
            <Text style={[styles.segmentText, activeTab === 'smart_calc' && styles.segmentTextActive]}>
              {isAr ? 'كاش ولا تقسيط؟' : 'Smart Buy'}
            </Text>
            <View style={[styles.badgeCount, activeTab === 'smart_calc' ? { backgroundColor: '#FFFFFF33' } : { backgroundColor: '#8B5CF625' }]}>
              <Text style={[styles.badgeCountText, activeTab === 'smart_calc' ? { color: '#FFF' } : { color: '#8B5CF6' }]}>
                {isAr ? 'ذكي' : 'AI'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* --- TAB 1: INSTALLMENTS CONTENT --- */}
        {activeTab === 'installments' ? (
          <>
            {/* Smart Strategy Promo Banner */}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab('smart_calc');
              }}
              style={({ pressed }) => [
                {
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#8B5CF640',
                  backgroundColor: theme === 'dark' ? '#1E1B4B45' : '#EDE9FE',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#8B5CF625', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="bulb" size={22} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: theme === 'dark' ? '#C4B5FD' : '#5B21B6' }}>
                    {isAr ? 'بتفكر تشتري عربية أو سلعة كبيرة؟ 💡' : 'Planning a big purchase? 💡'}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    {isAr ? 'احسب هل الكاش أوفر أم التقسيط مع استثمار الأموال (استراتيجية بيزنساوي)' : 'Compare cash vs smart installment with investment yields'}
                  </Text>
                </View>
              </View>
              <Ionicons name={isAr ? "chevron-back" : "chevron-forward"} size={18} color="#8B5CF6" />
            </Pressable>

            {/* Active Plans List */}
            <Text style={styles.sectionTitle}>
              {isAr ? `الأقساط والالتزامات النشطة (${activePlans.length})` : `Active Installments (${activePlans.length})`}
            </Text>

            {activePlans.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="card-outline" size={48} color={colors.primary} />
                <Text style={styles.emptyTitle}>
                  {isAr ? 'لا توجد أقساط نشطة حالياً' : 'No Active Installments'}
                </Text>
                <Text style={styles.emptySub}>
                  {isAr
                    ? 'اضغط على زر الإضافة (+) لإدراج أقساط Valu أو تابي أو البطاقات الائتمانية بسهولة'
                    : 'Tap (+) to add Valu, Tabby, Tamara or Credit Card installments'}
                </Text>
                <Pressable style={styles.primaryActionBtn} onPress={handleOpenAdd}>
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.primaryActionBtnText}>
                    {isAr ? 'إضافة قسط جديد' : 'Add Installment'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              activePlans.map(plan => {
                const status = getDueStatus(plan);
                const progress = (plan.totalMonths - plan.remainingMonths) / plan.totalMonths;
                const paidMonths = plan.totalMonths - plan.remainingMonths;

                return (
                  <View key={plan.id} style={styles.planCard}>
                    <View style={styles.planHeader}>
                      <View style={styles.providerBadge}>
                        <Ionicons name={getProviderIcon(plan.provider) as any} size={16} color={colors.primary} />
                        <Text style={styles.providerText}>{getProviderName(plan.provider)}</Text>
                      </View>

                      <Pressable onPress={() => setDeletingPlan(plan)} hitSlop={15} style={styles.deleteBtn}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </Pressable>
                    </View>

                    <Text style={styles.planTitle}>{plan.title}</Text>

                    {plan.isSmartYieldFunded && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#8B5CF618',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        alignSelf: 'flex-start',
                        marginTop: 4,
                        marginBottom: 6,
                        gap: 4,
                      }}>
                        <Ionicons name="sparkles" size={13} color="#8B5CF6" />
                        <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: '#8B5CF6' }}>
                          {isAr
                            ? `⚡ تمويل ذكي: العائد يغطي ${plan.smartYieldCoverPercent || 0}% شهرياً (+${formatCurrency(plan.smartYieldMonthlyReturn || 0)} ${currency})`
                            : `⚡ Smart-Funded: Yield covers ${plan.smartYieldCoverPercent || 0}% monthly`}
                        </Text>
                      </View>
                    )}

                    <View style={styles.progressTrack}>
                      <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>

                    <View style={styles.planMetaRow}>
                      <Text style={styles.planMetaText}>
                        {isAr
                          ? `تم سداد ${paidMonths} من أصل ${plan.totalMonths} شهر (متبقي ${plan.remainingMonths})`
                          : `${paidMonths} of ${plan.totalMonths} paid (${plan.remainingMonths} left)`}
                      </Text>
                      <Text style={styles.planDueText}>
                        {isAr ? `يوم ${plan.dueDay || 5} شهرياً` : `Due day ${plan.dueDay || 5}`}
                      </Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                      <Text style={[styles.statusBadgeText, { color: status.color }]}>
                        {status.text}
                      </Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.planFooter}>
                      <View>
                        <Text style={styles.monthlyLabel}>{isAr ? 'القسط الشهري:' : 'Monthly:'}</Text>
                        <Text style={styles.monthlyValue}>
                          {formatCurrency(plan.monthlyAmount)} {currency}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => setPayingPlan(plan)}
                        disabled={status.isPaid}
                        style={[
                          styles.payBtn,
                          status.isPaid && { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
                        ]}
                      >
                        <Ionicons
                          name={status.isPaid ? 'checkmark-circle' : 'wallet-outline'}
                          size={16}
                          color={status.isPaid ? colors.primary : '#FFF'}
                        />
                        <Text style={[styles.payBtnText, status.isPaid && { color: colors.primary }]}>
                          {status.isPaid
                            ? (isAr ? 'تم سداد هذا الشهر' : 'Paid This Month')
                            : (isAr ? 'سداد قسط الشهر الآن' : 'Pay This Month')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}

            {/* Completed Plans */}
            {completedPlans.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                  {isAr ? `الأقساط المكتملة (${completedPlans.length})` : `Completed (${completedPlans.length})`}
                </Text>
                {completedPlans.map(plan => (
                  <View key={plan.id} style={[styles.planCard, { opacity: 0.65 }]}>
                    <View style={styles.planHeader}>
                      <Text style={styles.planTitle}>{plan.title}</Text>
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.planMetaText}>
                      {isAr
                        ? `تم سداد إجمالي ${formatCurrency(plan.totalAmount)} ${currency} بالكامل 🏆`
                        : `Fully paid total ${formatCurrency(plan.totalAmount)} ${currency} 🏆`}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        ) : activeTab === 'jameya' ? (
          /* --- TAB 2: JAMEYA (ASSOCIATIONS) CONTENT --- */
          <>
            {/* Active Associations Section Title */}
            <Text style={styles.sectionTitle}>
              {isAr ? `الجمعيات الجارية (${activeJameyas.length})` : `Active Associations (${activeJameyas.length})`}
            </Text>

            {activeJameyas.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="account-group" size={48} color={colors.primary} />
                <Text style={styles.emptyTitle}>
                  {isAr ? 'لا توجد جمعيات نشطة حالياً' : 'No Active Associations'}
                </Text>
                <Text style={styles.emptySub}>
                  {isAr
                    ? 'انقر على زر الإضافة (+) لإضافة جمعية جديدة وتتبع أقساطها وشهور قبضها بسهولة'
                    : 'Tap (+) to add a new association and track monthly payouts'}
                </Text>
                <Pressable style={styles.primaryActionBtn} onPress={handleOpenAddJameya}>
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.primaryActionBtnText}>
                    {isAr ? 'إضافة جمعية جديدة' : 'Add Association'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              activeJameyas.map((item) => {
                const shares = item.sharesCount || 1;
                const singleVal = item.singleShareAmount || (item.monthlyAmount / shares);
                const potPerShare = singleVal * item.totalMonths;
                const totalPotAll = potPerShare * shares;
                const progress = item.paidMonthsCount / item.totalMonths;
                const payoutMonthsList = item.payoutMonths && item.payoutMonths.length > 0
                  ? item.payoutMonths
                  : [item.payoutMonth || 1];
                const receivedList = item.receivedPayoutMonths || [];

                return (
                  <View key={item.id} style={styles.planCard}>
                    <View style={styles.planHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                        <Text style={styles.planTitle}>{item.name}</Text>
                        {renderSharesBadge(shares)}
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Pressable onPress={() => handleOpenEditJameya(item)} hitSlop={12} style={styles.deleteBtn}>
                          <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable onPress={() => setDeletingJameyaItem(item)} hitSlop={12} style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>

                    {/* Stats Grid */}
                    <View style={styles.jameyaStatsGrid}>
                      <View style={styles.jameyaStatBox}>
                        <Text style={styles.jameyaStatLabel}>{isAr ? 'إجمالي قسطك' : 'Monthly Pay'}</Text>
                        <Text style={styles.jameyaStatValue}>{formatCurrency(item.monthlyAmount)} {currency}</Text>
                      </View>
                      <View style={styles.jameyaStatBox}>
                        <Text style={styles.jameyaStatLabel}>{isAr ? 'إجمالي القبض' : 'Total Pot'}</Text>
                        <Text style={[styles.jameyaStatValue, { color: colors.income }]}>{formatCurrency(totalPotAll)} {currency}</Text>
                      </View>
                      <View style={styles.jameyaStatBox}>
                        <Text style={styles.jameyaStatLabel}>{isAr ? 'المسدد' : 'Paid'}</Text>
                        <Text style={styles.jameyaStatValue}>{item.paidMonthsCount} / {item.totalMonths} {isAr ? 'أشهر' : 'mos'}</Text>
                      </View>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressBar, { width: `${Math.min(100, progress * 100)}%` }]} />
                    </View>

                    {/* Payout Schedule Section */}
                    <Text style={styles.payoutSectionTitle}>
                      {isAr
                        ? `مواعيد الاستحقاق (قبض ${formatCurrency(potPerShare)} ${currency} لكل اسم):`
                        : `Payout Schedule (${formatCurrency(potPerShare)} ${currency} per share):`}
                    </Text>
                    <View style={styles.payoutMonthsRow}>
                      {payoutMonthsList.map((mNum, idx) => {
                        const isReceived = receivedList.includes(mNum);
                        const isCurrentTurn = item.paidMonthsCount + 1 >= mNum;

                        return (
                          <Pressable
                            key={`${mNum}_${idx}`}
                            disabled={isReceived}
                            style={[
                              styles.payoutMonthChip,
                              isReceived && styles.payoutMonthChipReceived,
                              !isReceived && isCurrentTurn && styles.payoutMonthChipCurrent,
                            ]}
                            onPress={() => setJameyaPayoutTarget({ item, month: mNum })}
                          >
                            <Ionicons
                              name={isReceived ? 'checkmark-circle' : isCurrentTurn ? 'cash' : 'time-outline'}
                              size={14}
                              color={isReceived ? colors.primary : isCurrentTurn ? '#FFF' : colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.payoutMonthChipText,
                                isReceived && styles.payoutMonthChipTextReceived,
                                !isReceived && isCurrentTurn && styles.payoutMonthChipTextCurrent,
                              ]}
                            >
                              {payoutMonthsList.length > 1 ? (isAr ? `الاسم ${idx + 1}: الشهر ${mNum}` : `Slot ${idx + 1}: Month ${mNum}`) : (isAr ? `الشهر الـ ${mNum}` : `Month ${mNum}`)}
                              {isReceived ? (isAr ? ' (تم القبض 🟢)' : ' (Done)') : (isAr ? ' (قبض الآن 💰)' : ' (Receive)')}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={styles.divider} />

                    <Pressable style={styles.payJameyaMonthBtn} onPress={() => setPayingJameyaItem(item)}>
                      <MaterialCommunityIcons name="piggy-bank-outline" size={18} color="#FFF" />
                      <Text style={styles.payJameyaMonthBtnText}>{isAr ? 'تسديد قسط هذا الشهر (ادخار)' : 'Pay This Month (Savings)'}</Text>
                    </Pressable>
                  </View>
                );
              })
            )}

            {/* Completed Associations */}
            {completedJameyas.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                  {isAr ? `الجمعيات المكتملة (${completedJameyas.length})` : `Completed Associations (${completedJameyas.length})`}
                </Text>
                {completedJameyas.map((item) => (
                  <View key={item.id} style={[styles.planCard, { opacity: 0.65 }]}>
                    <View style={styles.planHeader}>
                      <Text style={styles.planTitle}>{item.name}</Text>
                      <View style={styles.badgeSuccess}>
                        <Ionicons name="checkmark-done-circle" size={16} color={colors.primary} />
                        <Text style={styles.badgeSuccessText}>{isAr ? 'مكتملة بالكامل' : 'Fully Completed'}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        ) : (
          /* --- TAB 3: SMART FINANCE CALCULATOR --- */
          <SmartFinanceCalculator
            onPlanCreated={loadData}
            onSwitchToInstallmentsTab={() => setActiveTab('installments')}
          />
        )}
      </ScrollView>

      {/* --- CUSTOM MODAL: Confirm Installment Payment --- */}
      {payingPlan && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setPayingPlan(null)}>
          <View style={styles.customModalOverlay}>
            <View style={styles.customModalCard}>
              <View style={styles.customModalIconCircle}>
                <Ionicons name="card" size={28} color={colors.primary} />
              </View>

              <Text style={styles.customModalTitle}>
                {isAr ? 'تأكيد سداد القسط الشهري' : 'Confirm Installment Payment'}
              </Text>

              <View style={styles.customModalDetailsBox}>
                <Text style={styles.customModalItemName}>{payingPlan.title}</Text>
                <Text style={styles.customModalAmount}>
                  {formatCurrency(payingPlan.monthlyAmount)} {currency}
                </Text>
                <Text style={styles.customModalSubDetail}>
                  {isAr
                    ? `سيتم خصم المبلغ وتسجيل معاملة مصروف بمحفظة (${selectedWallet?.name || 'الرئيسية'})`
                    : `Expense will be logged in (${selectedWallet?.name || 'Main Wallet'})`}
                </Text>
                <View style={styles.customModalDivider} />
                <Text style={styles.customModalRemainingDetail}>
                  {isAr
                    ? `سيبقى ${payingPlan.remainingMonths - 1} شهر/أشهر متبقية بعد السداد`
                    : `${payingPlan.remainingMonths - 1} month(s) left after payment`}
                </Text>
              </View>

              <View style={styles.customModalActionsRow}>
                <Pressable
                  style={[styles.customModalBtn, styles.customModalBtnCancel]}
                  onPress={() => setPayingPlan(null)}
                  disabled={isSubmittingPay}
                >
                  <Text style={styles.customModalBtnCancelText}>{isAr ? 'إلغاء' : 'Cancel'}</Text>
                </Pressable>

                <Pressable
                  style={[styles.customModalBtn, styles.customModalBtnConfirm]}
                  onPress={handleConfirmPayInstallment}
                  disabled={isSubmittingPay}
                >
                  <Text style={styles.customModalBtnConfirmText}>
                    {isSubmittingPay ? (isAr ? 'جاري التسجيل...' : 'Processing...') : (isAr ? 'تأكيد وسداد الآن 💳' : 'Confirm & Pay 💳')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* --- CUSTOM MODAL: Delete Installment Plan --- */}
      {deletingPlan && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setDeletingPlan(null)}>
          <View style={styles.customModalOverlay}>
            <View style={styles.customModalCard}>
              <View style={[styles.customModalIconCircle, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="trash-outline" size={28} color="#EF4444" />
              </View>

              <Text style={styles.customModalTitle}>
                {isAr ? 'حذف خطة التقسيط' : 'Delete Installment Plan'}
              </Text>

              <Text style={styles.customModalSubDetail}>
                {isAr
                  ? `هل أنت متاكد من حذف "${deletingPlan.title}"؟ لن تتم إزالة المعاملات المسددة سابقاً.`
                  : `Are you sure you want to delete "${deletingPlan.title}"? Past paid transactions will be preserved.`}
              </Text>

              <View style={styles.customModalActionsRow}>
                <Pressable
                  style={[styles.customModalBtn, styles.customModalBtnCancel]}
                  onPress={() => setDeletingPlan(null)}
                >
                  <Text style={styles.customModalBtnCancelText}>{isAr ? 'إلغاء' : 'Cancel'}</Text>
                </Pressable>

                <Pressable
                  style={[styles.customModalBtn, { backgroundColor: '#EF4444' }]}
                  onPress={handleConfirmDeleteInstallment}
                >
                  <Text style={styles.customModalBtnConfirmText}>{isAr ? 'حذف الخطة' : 'Delete Plan'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* --- Add Installment Modal --- */}
      <Modal visible={installmentModalVisible} animationType="slide" transparent onRequestClose={() => setInstallmentModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAr ? 'إضافة قسط / التزام جديد' : 'Add Installment Plan'}
              </Text>
              <Pressable onPress={() => setInstallmentModalVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 15 }}
              style={{ maxHeight: Dimensions.get('window').height * 0.75 }}
            >
              <View style={styles.formGroup}>
                <Text style={styles.label}>{isAr ? 'اسم القسط / المنتج' : 'Title / Item Name'}</Text>
                <TextInput
                  style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                  placeholder={isAr ? 'مثال: آيفون فاليو، شاشة تابي، قسط سيارة' : 'e.g. iPhone Valu, Tabby Purchase'}
                  placeholderTextColor={colors.textTertiary}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              {/* Source Wallet Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{isAr ? 'محفظة الخصم (من)' : 'Source Wallet (From)'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {wallets.map(w => {
                    const isSelected = (sourceWalletId || selectedWallet?.id) === w.id;
                    return (
                      <Pressable
                        key={w.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSourceWalletId(w.id);
                        }}
                        style={[
                          styles.walletChip,
                          isSelected && { backgroundColor: w.color + '22', borderColor: w.color, borderWidth: 2 }
                        ]}
                      >
                        <MaterialCommunityIcons name={w.icon as any} size={16} color={w.color} />
                        <Text style={[styles.walletChipText, isSelected && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>{w.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Calculator Mode Switcher Toggle */}
              <View style={styles.calcModeSwitchRow}>
                <Pressable
                  style={[
                    styles.calcModeBtn,
                    calcMode === 'total_and_months' && styles.calcModeBtnActive,
                  ]}
                  onPress={() => setCalcMode('total_and_months')}
                >
                  <Text style={[styles.calcModeBtnText, calcMode === 'total_and_months' && styles.calcModeBtnTextActive]}>
                    {isAr ? 'المبلغ الإجمالي ➗ الأشهر' : 'Total Amount ➗ Months'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.calcModeBtn,
                    calcMode === 'monthly_and_months' && styles.calcModeBtnActive,
                  ]}
                  onPress={() => setCalcMode('monthly_and_months')}
                >
                  <Text style={[styles.calcModeBtnText, calcMode === 'monthly_and_months' && styles.calcModeBtnTextActive]}>
                    {isAr ? 'القسط الشهري ✖️ الأشهر' : 'Monthly Amount ✖️ Months'}
                  </Text>
                </Pressable>
              </View>

              {/* Dynamic Inputs based on Calculation Mode */}
              <View style={styles.formRow}>
                {calcMode === 'total_and_months' ? (
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>{isAr ? 'المبلغ الإجمالي' : 'Total Amount'}</Text>
                    <TextInput
                      style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.textTertiary}
                      value={totalAmountInput}
                      onChangeText={setTotalAmountInput}
                    />
                  </View>
                ) : (
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>{isAr ? 'القسط الشهري' : 'Monthly Amount'}</Text>
                    <TextInput
                      style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.textTertiary}
                      value={monthlyAmountInput}
                      onChangeText={setMonthlyAmountInput}
                    />
                  </View>
                )}

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{isAr ? 'عدد الأشهر' : 'Total Months'}</Text>
                  <TextInput
                    style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                    placeholder="6"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textTertiary}
                    value={totalMonths}
                    onChangeText={setTotalMonths}
                  />
                </View>
              </View>

              {/* Calculation Preview Box */}
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>{isAr ? '💡 المعاينة والملخص الآلي:' : '💡 Live Calculation Summary:'}</Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{isAr ? 'المبلغ الإجمالي:' : 'Total Amount:'}</Text>
                  <Text style={styles.previewVal}>{formatCurrency(calculatedValues.total)} {currency}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{isAr ? 'القسط الشهري الخصم:' : 'Monthly Payment:'}</Text>
                  <Text style={[styles.previewVal, { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>
                    {formatCurrency(calculatedValues.monthly)} {currency} / شهر
                  </Text>
                </View>
              </View>

              {/* Provider Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{isAr ? 'جهة التقسيط / النظام' : 'Provider / Type'}</Text>
                <View style={styles.providerGrid}>
                  {[
                    { id: 'valu', name: 'Valu (فاليو)', icon: 'flash-outline' },
                    { id: 'tabby', name: 'Tabby (تابي)', icon: 'card-outline' },
                    { id: 'tamara', name: 'Tamara (تمارا)', icon: 'cart-outline' },
                    { id: 'bank_card', name: isAr ? 'بطاقة بنكية' : 'Bank Card', icon: 'card-sharp' },
                    { id: 'other', name: isAr ? 'تقسيط آخر' : 'Other', icon: 'calendar-outline' },
                  ].map(item => (
                    <Pressable
                      key={item.id}
                      onPress={() => setProvider(item.id as any)}
                      style={[
                        styles.providerChip,
                        provider === item.id && styles.providerChipActive,
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={provider === item.id ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.providerChipText,
                          provider === item.id && styles.providerChipTextActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Submit Button */}
              <Pressable style={styles.submitBtn} onPress={handleAddInstallmentPlan}>
                <Text style={styles.submitBtnText}>{isAr ? 'إضافة الخطة وتفعيل التتبع' : 'Add Installment Plan'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- Add/Edit Jameya Modal --- */}
      <Modal visible={jameyaModalVisible} animationType="slide" transparent onRequestClose={() => setJameyaModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingJameya ? (isAr ? 'تعديل الجمعية' : 'Edit Association') : (isAr ? 'إضافة جمعية جديدة' : 'Add Association')}
              </Text>
              <Pressable onPress={() => setJameyaModalVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 30 }} style={{ maxHeight: Dimensions.get('window').height * 0.75 }}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>{isAr ? 'اسم الجمعية / المجموعة' : 'Association Name'}</Text>
                <TextInput
                  style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                  placeholder={isAr ? 'مثال: جمعية الأصدقاء، جمعية الساير' : 'e.g. Friends ROSCA'}
                  placeholderTextColor={colors.textTertiary}
                  value={jameyaName}
                  onChangeText={setJameyaName}
                />
              </View>

              {/* Shares Count Quick Select */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{isAr ? 'عدد الأسماء / الأسهم التي تشارك بها:' : 'Participation Shares/Names:'}</Text>
                <View style={styles.sharesChipsRow}>
                  {[
                    { label: isAr ? '0.5 (نصف اسم)' : '0.5 Share', val: '0.5' },
                    { label: isAr ? '1 (اسم واحد)' : '1 Share', val: '1' },
                    { label: isAr ? '2 (اسمين)' : '2 Shares', val: '2' },
                    { label: isAr ? '3 (3 أسماء)' : '3 Shares', val: '3' },
                  ].map((chip) => (
                    <Pressable
                      key={chip.val}
                      style={[styles.shareChip, jameyaSharesCount === chip.val && styles.shareChipActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setJameyaSharesCount(chip.val);
                      }}
                    >
                      <Text style={[styles.shareChipText, jameyaSharesCount === chip.val && styles.shareChipTextActive]}>
                        {chip.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{isAr ? 'مبلغ الاسم/السهم الواحد' : 'Single Share Value'}</Text>
                  <TextInput
                    style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                    placeholder="100"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    value={jameyaSingleShareAmount}
                    onChangeText={setJameyaSingleShareAmount}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{isAr ? 'إجمالي الأشهر/الأعضاء' : 'Total Months / Members'}</Text>
                  <TextInput
                    style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                    placeholder="8"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    value={jameyaTotalMonths}
                    onChangeText={setJameyaTotalMonths}
                  />
                </View>
              </View>

              {/* Dynamic Payout Months Inputs */}
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>
                  {isAr
                    ? `شهور ترتيب قبضك (${jameyaPayoutMonthsInputs.length} ${jameyaPayoutMonthsInputs.length > 1 ? 'شهور لـ ' + jameyaPayoutMonthsInputs.length + ' أسماء' : 'شهر'})`
                    : `Payout Months (${jameyaPayoutMonthsInputs.length} slots)`}
                </Text>
                
                <View style={{ gap: 8, marginTop: 6 }}>
                  {jameyaPayoutMonthsInputs.map((val, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.previewLabel}>
                        {jameyaPayoutMonthsInputs.length > 1 ? (isAr ? `الاسم الـ ${idx + 1}:` : `Slot #${idx + 1}:`) : (isAr ? 'ترتيب القبض:' : 'Payout Turn:')}
                      </Text>
                      <TextInput
                        style={[styles.input, { flex: 1, paddingVertical: 6 }]}
                        placeholder={isAr ? `ترتيب الشهر (مثلاً ${idx === 0 ? 5 : 8})` : `Month index (e.g. ${idx === 0 ? 5 : 8})`}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        value={val}
                        onChangeText={(txt) => {
                          const updated = [...jameyaPayoutMonthsInputs];
                          updated[idx] = txt;
                          setJameyaPayoutMonthsInputs(updated);
                        }}
                      />
                    </View>
                  ))}
                </View>
              </View>

              {/* Live Auto-Calculated Pot Preview */}
              {computedSingleShareVal > 0 && computedTotalMonthsVal > 0 ? (
                <View style={styles.previewBox}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>{isAr ? 'قسطك الشهري الإجمالي:' : 'Your Total Monthly Pay:'}</Text>
                    <Text style={[styles.previewVal, { color: colors.text, fontFamily: 'Cairo_700Bold' }]}>
                      {formatCurrency(computedMonthlyTotalPay)} {currency}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>{isAr ? 'مبلغ قبض كل اسم في شهره:' : 'Payout per share:'}</Text>
                    <Text style={[styles.previewVal, { color: colors.income, fontFamily: 'Cairo_700Bold' }]}>
                      {formatCurrency(computedPotPerShare)} {currency}
                    </Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
                  <Text style={styles.previewLabel}>{isAr ? 'إجمالي ما ستقبضه من الجمعية كاملاً:' : 'Your Total Association Payout:'}</Text>
                  <Text style={[styles.previewVal, { color: colors.primary, fontFamily: 'Cairo_700Bold', fontSize: 16 }]}>
                    {formatCurrency(computedTotalJameyaPayout)} {currency}
                  </Text>
                </View>
              ) : null}

              {jameyaFormError ? (
                <View style={{ backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444450', borderRadius: 12, padding: 10 }}>
                  <Text style={{ color: '#EF4444', fontFamily: 'Cairo_700Bold', fontSize: 13, textAlign: 'center' }}>
                    ⚠️ {jameyaFormError}
                  </Text>
                </View>
              ) : null}

              <Pressable style={styles.submitBtn} onPress={handleSaveJameya}>
                <Text style={styles.submitBtnText}>{isAr ? 'حفظ الجمعية وتفعيل التتبع' : 'Save Association'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- CUSTOM MODAL: Pay Jameya Month --- */}
      {payingJameyaItem && (
        <Modal visible transparent animationType="fade">
          <View style={styles.customModalOverlay}>
            <View style={styles.customModalCard}>
              <View style={styles.customModalIconCircle}>
                <MaterialCommunityIcons name="piggy-bank" size={32} color={colors.primary} />
              </View>

              <Text style={styles.customModalTitle}>
                {isAr ? 'تسديد قسط الجمعية (ادخار)' : 'Save Monthly Installment'}
              </Text>

              <Text style={styles.customModalSubDetail}>
                {isAr
                  ? `سيتم اقتطاع مبلغ (${formatCurrency(payingJameyaItem.monthlyAmount)} ${currency}) وتصنيفه كـ "ادخار جمعية" لحفظ كفايتك وتنمية أصولك.`
                  : `Will record a savings allocation of (${formatCurrency(payingJameyaItem.monthlyAmount)} ${currency}).`}
              </Text>

              <View style={styles.customModalActionsRow}>
                <Pressable style={[styles.customModalBtn, styles.customModalBtnCancel]} onPress={() => setPayingJameyaItem(null)}>
                  <Text style={styles.customModalBtnCancelText}>{isAr ? 'إلغاء' : 'Cancel'}</Text>
                </Pressable>

                <Pressable style={[styles.customModalBtn, styles.customModalBtnConfirm]} onPress={handleConfirmPayJameyaMonth} disabled={isSubmittingJameya}>
                  <Text style={styles.customModalBtnConfirmText}>{isAr ? 'تأكيد الاقتطاع الادخاري 💰' : 'Confirm Savings 💰'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* --- CUSTOM MODAL: Receive Jameya Payout --- */}
      {jameyaPayoutTarget && (
        <Modal visible transparent animationType="fade">
          <View style={styles.customModalOverlay}>
            <View style={styles.customModalCard}>
              <View style={[styles.customModalIconCircle, { backgroundColor: colors.income + '15' }]}>
                <MaterialCommunityIcons name="cash-fast" size={32} color={colors.income} />
              </View>

              <Text style={styles.customModalTitle}>
                {isAr
                  ? `قبض دور الجمعية ${jameyaPayoutTarget.month ? '(الشهر الـ ' + jameyaPayoutTarget.month + ')' : ''}`
                  : 'Receive Association Pot'}
              </Text>

              <Text style={styles.customModalSubDetail}>
                {isAr
                  ? `حصيلة قبض هذا الدور هي (${formatCurrency(
                      ((jameyaPayoutTarget.item.singleShareAmount || (jameyaPayoutTarget.item.monthlyAmount / (jameyaPayoutTarget.item.sharesCount || 1))) * jameyaPayoutTarget.item.totalMonths)
                    )} ${currency}). اختر كيفية تسجيلها بالمحفظة:`
                  : `Pot payout amount.`}
              </Text>

              {/* Net vs Gross Payout Option Selector */}
              <View style={{ width: '100%', marginVertical: 10, gap: 8 }}>
                <Pressable
                  style={[styles.payoutOptionBox, !deductCurrentInstallment && styles.payoutOptionBoxActive]}
                  onPress={() => setDeductCurrentInstallment(false)}
                >
                  <Ionicons name={!deductCurrentInstallment ? 'radio-button-on' : 'radio-button-off'} size={18} color={!deductCurrentInstallment ? colors.primary : colors.textSecondary} />
                  <Text style={styles.payoutOptionText}>
                    {isAr ? 'قبض الحصيلة الكاملة للأعضاء' : 'Full Pot'} (
                    {formatCurrency(((jameyaPayoutTarget.item.singleShareAmount || (jameyaPayoutTarget.item.monthlyAmount / (jameyaPayoutTarget.item.sharesCount || 1))) * jameyaPayoutTarget.item.totalMonths))} {currency})
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.payoutOptionBox, deductCurrentInstallment && styles.payoutOptionBoxActive]}
                  onPress={() => setDeductCurrentInstallment(true)}
                >
                  <Ionicons name={deductCurrentInstallment ? 'radio-button-on' : 'radio-button-off'} size={18} color={deductCurrentInstallment ? colors.primary : colors.textSecondary} />
                  <Text style={styles.payoutOptionText}>
                    {isAr ? 'قبض الصافي فقط بعد استقطاع حصتك' : 'Net Pot'} (
                    {formatCurrency(
                      ((jameyaPayoutTarget.item.singleShareAmount || (jameyaPayoutTarget.item.monthlyAmount / (jameyaPayoutTarget.item.sharesCount || 1))) * jameyaPayoutTarget.item.totalMonths) -
                      (jameyaPayoutTarget.item.singleShareAmount || (jameyaPayoutTarget.item.monthlyAmount / (jameyaPayoutTarget.item.sharesCount || 1)))
                    )} {currency})
                  </Text>
                </Pressable>
              </View>

              <View style={styles.customModalActionsRow}>
                <Pressable style={[styles.customModalBtn, styles.customModalBtnCancel]} onPress={() => setJameyaPayoutTarget(null)}>
                  <Text style={styles.customModalBtnCancelText}>{isAr ? 'إلغاء' : 'Cancel'}</Text>
                </Pressable>

                <Pressable style={[styles.customModalBtn, { backgroundColor: colors.income }]} onPress={handleConfirmReceiveJameyaPayout} disabled={isSubmittingJameya}>
                  <Text style={styles.customModalBtnConfirmText}>{isAr ? 'تأكيد الاستلام 🎉' : 'Confirm Payout 🎉'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* --- CUSTOM MODAL: Delete Jameya Item --- */}
      {deletingJameyaItem && (
        <Modal visible transparent animationType="fade">
          <View style={styles.customModalOverlay}>
            <View style={styles.customModalCard}>
              <View style={[styles.customModalIconCircle, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="trash-outline" size={28} color="#EF4444" />
              </View>

              <Text style={styles.customModalTitle}>{isAr ? 'حذف الجمعية' : 'Delete Association'}</Text>
              <Text style={styles.customModalSubDetail}>
                {isAr ? `هل أنت تأكد من حذف جمعية "${deletingJameyaItem.name}"؟` : `Are you sure you want to delete "${deletingJameyaItem.name}"?`}
              </Text>

              <View style={styles.customModalActionsRow}>
                <Pressable style={[styles.customModalBtn, styles.customModalBtnCancel]} onPress={() => setDeletingJameyaItem(null)}>
                  <Text style={styles.customModalBtnCancelText}>{isAr ? 'إلغاء' : 'Cancel'}</Text>
                </Pressable>

                <Pressable style={[styles.customModalBtn, { backgroundColor: '#EF4444' }]} onPress={handleConfirmDeleteJameya}>
                  <Text style={styles.customModalBtnConfirmText}>{isAr ? 'حذف الجمعية' : 'Delete Association'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

