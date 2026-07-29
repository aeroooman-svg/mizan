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
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
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

interface InstallmentsScreenProps {
  initialTab?: 'installments' | 'jameya';
}

export default function InstallmentsScreen({ initialTab }: InstallmentsScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { selectedWallet, wallets, addTransaction, totalIncome, refresh } = useTransactions();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<'installments' | 'jameya'>(
    initialTab || (params.tab === 'jameya' ? 'jameya' : 'installments')
  );

  // Sync tab if param changes externally
  useEffect(() => {
    if (params.tab === 'jameya' || params.tab === 'installments') {
      setActiveTab(params.tab);
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
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={15}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isAr ? '💳 أقساط وجمعيات' : '💳 Installments & Associations'}
        </Text>
        <Pressable onPress={handleOpenAdd} style={styles.addBtn} hitSlop={8}>
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
              size={18}
              color={activeTab === 'installments' ? '#FFF' : colors.textSecondary}
            />
            <Text style={[styles.segmentText, activeTab === 'installments' && styles.segmentTextActive]}>
              {isAr ? 'الأقساط والكروت' : 'Installments & Cards'}
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
              size={18}
              color={activeTab === 'jameya' ? '#FFF' : colors.textSecondary}
            />
            <Text style={[styles.segmentText, activeTab === 'jameya' && styles.segmentTextActive]}>
              {isAr ? 'الجمعيات' : 'Associations'}
            </Text>
            {activeJameyas.length > 0 && (
              <View style={[styles.badgeCount, activeTab === 'jameya' && { backgroundColor: '#FFFFFF33' }]}>
                <Text style={[styles.badgeCountText, activeTab === 'jameya' && { color: '#FFF' }]}>
                  {activeJameyas.length}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* --- TAB 1: INSTALLMENTS CONTENT --- */}
        {activeTab === 'installments' ? (
          <>
            {/* Urgent Alert Banner */}
            {urgentStats.overdueCount > 0 ? (
              <View style={[styles.urgentBanner, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}>
                <Ionicons name="alert-circle" size={22} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.urgentBannerTitle, { color: '#EF4444' }]}>
                    {isAr ? `تنبيه عاجل: لديك ${urgentStats.overdueCount} قسط مستحق السداد فوراً!` : `Alert: You have ${urgentStats.overdueCount} overdue installment(s)!`}
                  </Text>
                  <Text style={styles.urgentBannerSub}>
                    {isAr ? 'سارع بالسداد لتجنب غرامات التأخير وحماية رصيدك الائتماني' : 'Pay now to avoid late fees'}
                  </Text>
                </View>
              </View>
            ) : urgentStats.dueSoonCount > 0 ? (
              <View style={[styles.urgentBanner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
                <Ionicons name="time-outline" size={22} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.urgentBannerTitle, { color: '#F59E0B' }]}>
                    {isAr ? `تنبيه: لديك ${urgentStats.dueSoonCount} قسط قادم خلال هذا الشهر` : `Notice: ${urgentStats.dueSoonCount} installment(s) due soon`}
                  </Text>
                  <Text style={styles.urgentBannerSub}>
                    {isAr ? 'راجع موعد الاستحقاق لتوفير السيولة المناسبة بالسيارة أو المحفظة' : 'Check due dates to prepare cashflow'}
                  </Text>
                </View>
              </View>
            ) : activePlans.length > 0 ? (
              <View style={[styles.urgentBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.urgentBannerTitle, { color: colors.primary }]}>
                    {isAr ? 'وضعك ممتاز! تم سداد جميع أقساط هذا الشهر بنجاح 🎉' : 'All clear! Paid for this month 🎉'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Summary Grid (2 Metric Cards Side-by-Side) */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderColor: colors.expense + '40' }]}>
                <Ionicons name="trending-down" size={22} color={colors.expense} />
                <Text style={styles.summaryLabel}>
                  {isAr ? 'إجمالي المتبقي عليك' : 'Total Debt Remaining'}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.expense }]}>
                  {formatCurrency(totalRemainingDebt)} {currency}
                </Text>
              </View>

              <View style={[styles.summaryCard, { borderColor: colors.primary + '40' }]}>
                <Ionicons name="calendar" size={22} color={colors.primary} />
                <Text style={styles.summaryLabel}>
                  {isAr ? 'الالتزام الشهري' : 'Monthly Obligation'}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>
                  {formatCurrency(totalMonthlyCommitment)} {currency}
                </Text>
              </View>
            </View>

            {/* Portfolio Impact Card */}
            {totalMonthlyCommitment > 0 && (
              <View style={styles.savingsImpactCard}>
                <View style={styles.savingsImpactHeader}>
                  <Ionicons name="sparkles" size={20} color={colors.primary} />
                  <Text style={styles.savingsImpactTitle}>
                    {isAr ? 'التحليل الذكي لأثر الأقساط على المحفظة والادخار' : 'Smart Portfolio & Savings Impact'}
                  </Text>
                  <View style={[styles.safetyBadge, { backgroundColor: safetyLevel.bg }]}>
                    <Text style={[styles.safetyBadgeText, { color: safetyLevel.color }]}>
                      {safetyLevel.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.impactMetricsGrid}>
                  <View style={styles.impactMetricBox}>
                    <Text style={styles.impactMetricLabel}>{isAr ? 'نسبة الاستقطاع من الدخل:' : 'Income Obligation Ratio:'}</Text>
                    <Text style={[styles.impactMetricValue, { color: safetyLevel.color }]}>
                      {obligationRatio}% {isAr ? 'من دخلك الشهري' : 'of monthly income'}
                    </Text>
                  </View>

                  {freedomDateFormatted && (
                    <View style={styles.impactMetricBox}>
                      <Text style={styles.impactMetricLabel}>{isAr ? 'تاريخ التحرر المالي التام:' : 'Full Freedom Date:'}</Text>
                      <Text style={[styles.impactMetricValue, { color: colors.primary }]}>
                        {freedomDateFormatted}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

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
        ) : (
          /* --- TAB 2: JAMEYA (ASSOCIATIONS) CONTENT --- */
          <>
            {/* Summary Grid (2 Metric Cards Side-by-Side - Matching Installments!) */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderColor: colors.expense + '40' }]}>
                <MaterialCommunityIcons name="piggy-bank-outline" size={22} color={colors.expense} />
                <Text style={styles.summaryLabel}>
                  {isAr ? 'التزام الجمعيات الشهري' : 'Monthly Jameya Commitment'}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.expense }]}>
                  {formatCurrency(totalJameyaMonthlyCommitment)} {currency}
                </Text>
              </View>

              <View style={[styles.summaryCard, { borderColor: colors.income + '40' }]}>
                <Ionicons name="cash-outline" size={22} color={colors.income} />
                <Text style={styles.summaryLabel}>
                  {isAr ? 'مبالغ متوقع قبضها' : 'Pending Payouts'}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.income }]}>
                  {formatCurrency(totalJameyaExpectedPayout)} {currency}
                </Text>
              </View>
            </View>

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

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: colors.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  /* Segment Switcher Tab Bar */
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    fontFamily: 'Cairo_700Bold',
    color: '#FFFFFF',
  },
  badgeCount: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeCountText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: colors.primary,
  },

  /* Urgent Banner */
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  urgentBannerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  urgentBannerSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },

  /* Summary Metrics Grid (2 Side-by-Side Cards) */
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    gap: 6,
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

  /* Portfolio Impact Card */
  savingsImpactCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  savingsImpactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  savingsImpactTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  safetyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  safetyBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  impactMetricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  impactMetricBox: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  impactMetricLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  impactMetricValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },

  /* Cards List */
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  providerText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.primary,
  },
  deleteBtn: {
    padding: 4,
  },
  planTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  planMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planMetaText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  planDueText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  planFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthlyLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  monthlyValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  payBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  payBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  emptySub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  primaryActionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },

  /* Jameya Specific Card Elements */
  sharesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sharesBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
  },
  jameyaStatsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-between',
  },
  jameyaStatBox: {
    alignItems: 'center',
    gap: 2,
  },
  jameyaStatLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  jameyaStatValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  payoutSectionTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  payoutMonthsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  payoutMonthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payoutMonthChipReceived: {
    backgroundColor: colors.primary + '18',
    borderColor: colors.primary + '40',
  },
  payoutMonthChipCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  payoutMonthChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  payoutMonthChipTextReceived: {
    color: colors.primary,
    fontFamily: 'Cairo_700Bold',
  },
  payoutMonthChipTextCurrent: {
    color: '#FFF',
    fontFamily: 'Cairo_700Bold',
  },
  payJameyaMonthBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  payJameyaMonthBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeSuccessText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
  },

  /* Modals Layout */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  formGroup: {
    gap: 6,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputAr: {
    textAlign: 'right',
  },
  inputEn: {
    textAlign: 'left',
  },
  calcModeSwitchRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  calcModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  calcModeBtnActive: {
    backgroundColor: colors.surface,
  },
  calcModeBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  calcModeBtnTextActive: {
    color: colors.primary,
    fontFamily: 'Cairo_700Bold',
  },
  previewBox: {
    backgroundColor: colors.primary + '12',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: 4,
  },
  previewTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.primary,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  previewVal: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.text,
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  providerChipActive: {
    backgroundColor: colors.primary + '18',
    borderColor: colors.primary,
  },
  providerChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  providerChipTextActive: {
    color: colors.primary,
    fontFamily: 'Cairo_700Bold',
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletChipText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.text,
  },
  sharesChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shareChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  shareChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  shareChipTextActive: {
    color: '#FFF',
    fontFamily: 'Cairo_700Bold',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },

  /* Custom Alert/Action Modals */
  customModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  customModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customModalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customModalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  customModalDetailsBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 12,
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  customModalItemName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  customModalAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.primary,
  },
  customModalSubDetail: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  customModalDivider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginVertical: 4,
  },
  customModalRemainingDetail: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  customModalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  customModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  customModalBtnCancel: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customModalBtnCancelText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  customModalBtnConfirm: {
    backgroundColor: colors.primary,
  },
  customModalBtnConfirmText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
  payoutOptionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payoutOptionBoxActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  payoutOptionText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.text,
    flex: 1,
  },
});
