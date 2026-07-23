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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
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

export default function InstallmentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { selectedWallet, wallets, addTransaction, totalIncome, refresh } = useTransactions();

  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Custom Modals State (replaces ugly browser window.confirm / Alert)
  const [payingPlan, setPayingPlan] = useState<InstallmentPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<InstallmentPlan | null>(null);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // New Plan Calculation Mode: 'total_and_months' | 'monthly_and_months'
  const [calcMode, setCalcMode] = useState<'total_and_months' | 'monthly_and_months'>('total_and_months');

  // Form State
  const [title, setTitle] = useState('');
  const [totalAmountInput, setTotalAmountInput] = useState('');
  const [monthlyAmountInput, setMonthlyAmountInput] = useState('');
  const [totalMonths, setTotalMonths] = useState('6');
  const [provider, setProvider] = useState<InstallmentPlan['provider']>('valu');
  const [dueDay, setDueDay] = useState('5');
  const [category, setCategory] = useState('other');

  const loadPlans = useCallback(async () => {
    const data = await getInstallmentPlans();
    setPlans(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans])
  );

  const currency = selectedWallet?.currency || 'KWD';

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

  // --- Smart Financial Impact Calculation ---
  // Obligation Ratio (% of monthly income consumed by installments)
  const monthlyIncomeBase = totalIncome && totalIncome > 0 ? totalIncome : 1000;
  const obligationRatio = Math.round((totalMonthlyCommitment / monthlyIncomeBase) * 100);

  // Safety level indicator
  const safetyLevel = useMemo(() => {
    if (obligationRatio <= 20) return { label: isAr ? 'نطاق آمن ممتاز 🟢' : 'Excellent Safe Range 🟢', color: '#10B981', bg: '#10B98115' };
    if (obligationRatio <= 35) return { label: isAr ? 'استقطاع متوسط ⚠️' : 'Moderate Deduction ⚠️', color: '#F59E0B', bg: '#F59E0B15' };
    return { label: isAr ? 'ضغط مالي مرتفع 🚨' : 'High Financial Stress 🚨', color: '#EF4444', bg: '#EF444415' };
  }, [obligationRatio, isAr]);

  // Freedom Date Calculation (When max remaining installment completes)
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

  // --- Live Calculator Preview inside Add Modal ---
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

  // Next Due Date Preview for Form
  const nextDueDatePreview = useMemo(() => {
    const day = parseInt(dueDay, 10) || 5;
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), day);
    if (now.getDate() > day) {
      target.setMonth(target.getMonth() + 1);
    }
    return target.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [dueDay, isAr]);

  // --- Handlers ---
  const handleAddPlan = async () => {
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
    const targetWalletId = selectedWallet?.id || (wallets[0] ? wallets[0].id : '');

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
      walletId: targetWalletId,
    });

    setTitle('');
    setTotalAmountInput('');
    setMonthlyAmountInput('');
    setTotalMonths('6');
    setDueDay('5');
    setModalVisible(false);
    await loadPlans();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleConfirmPay = async () => {
    if (!payingPlan || isSubmittingPay) return;
    setIsSubmittingPay(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const res = await payInstallmentMonth(payingPlan.id, addTransaction);
      if (res.success) {
        await refresh();
        await loadPlans();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.error('Error paying installment:', err);
    } finally {
      setIsSubmittingPay(false);
      setPayingPlan(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPlan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deleteInstallmentPlan(deletingPlan.id);
    await loadPlans();
    setDeletingPlan(null);
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

  // Urgent Alert status header calculation
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isAr ? '💳 الأقساط والبطاقات الائتمانية' : '💳 Installments & Credit Cards'}
        </Text>
        <Pressable onPress={() => setModalVisible(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Urgent Due Date Alert Header Banner */}
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

        {/* Summary Metric Cards */}
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

        {/* Smart Savings & Portfolio Plan Impact Card */}
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

            <Text style={styles.savingsImpactSub}>
              {isAr
                ? `تستقطع الأقساط ${formatCurrency(totalMonthlyCommitment)} ${currency} شهرياً. عند الانتهاء منها بـ ${freedomDateFormatted || 'الموعد'} سينتعش رصيدك المتاح وسيمكنك توجيهه لمشروعك أوالتحويل المباشر لحصالات التوفير!`
                : `Your monthly obligation of ${formatCurrency(totalMonthlyCommitment)} ${currency} reduces your savings buffer. Once fully settled by ${freedomDateFormatted || 'schedule'}, this amount directly boosts your savings jars!`}
            </Text>
          </View>
        )}

        {/* Active Plans Section */}
        <Text style={styles.sectionTitle}>
          {isAr ? `الأقساط والالتزامات النشطة (${activePlans.length})` : `Active Installments (${activePlans.length})`}
        </Text>

        {activePlans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>
              {isAr ? 'لا توجد أقساط نشطة حالياً' : 'No Active Installments'}
            </Text>
            <Text style={styles.emptySub}>
              {isAr
                ? 'اضغط على زر الإضافة (+) لإدراج أقساط Valu أو تابي أو البطاقات الائتمانية بسهولة'
                : 'Tap (+) to add Valu, Tabby, Tamara or Credit Card installments'}
            </Text>
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

                {/* Progress bar */}
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

                {/* Due Status Reminder Badge */}
                <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                  <Text style={[styles.statusBadgeText, { color: status.color }]}>
                    {status.text}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.planFooter}>
                  <View>
                    <Text style={styles.monthlyLabel}>
                      {isAr ? 'القسط الشهري:' : 'Monthly:'}
                    </Text>
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
      </ScrollView>

      {/* --- CUSTOM MODAL 1: Confirm Payment Modal --- */}
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
                  onPress={handleConfirmPay}
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

      {/* --- CUSTOM MODAL 2: Delete Plan Modal --- */}
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
                  onPress={handleConfirmDelete}
                >
                  <Text style={styles.customModalBtnConfirmText}>{isAr ? 'حذف الخطة' : 'Delete Plan'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* --- Add Plan Modal --- */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAr ? 'إضافة قسط / التزام جديد' : 'Add Installment Plan'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 15 }}
              style={{ maxHeight: Dimensions.get('window').height * 0.75 }}
            >
              {/* Form item title */}
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

              {/* Calculator Live Preview Box */}
              <View style={styles.calcPreviewBox}>
                <Ionicons name="calculator-outline" size={18} color={colors.primary} />
                <Text style={styles.calcPreviewText}>
                  {isAr
                    ? `إجمالي المبلغ: ${formatCurrency(calculatedValues.total)} ${currency} | القسط: ${formatCurrency(calculatedValues.monthly)} ${currency} × ${calculatedValues.months} شهر`
                    : `Total: ${formatCurrency(calculatedValues.total)} ${currency} | Monthly: ${formatCurrency(calculatedValues.monthly)} ${currency} for ${calculatedValues.months} mos`}
                </Text>
              </View>

              {/* Flexible Due Day Selector Pills & Preview */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{isAr ? 'تاريخ الاستحقاق الشهري' : 'Monthly Due Day'}</Text>
                
                {/* Day Quick Presets */}
                <View style={styles.dayPresetsRow}>
                  {[
                    { day: '1', label: isAr ? '1 (بداية الشهر)' : '1 (Start)' },
                    { day: '5', label: '5' },
                    { day: '10', label: '10' },
                    { day: '15', label: isAr ? '15 (المنتصف)' : '15 (Mid)' },
                    { day: '25', label: isAr ? '25 (الراتب)' : '25 (Salary)' },
                    { day: '30', label: isAr ? '30 (النهاية)' : '30 (End)' },
                  ].map(preset => (
                    <Pressable
                      key={preset.day}
                      onPress={() => setDueDay(preset.day)}
                      style={[
                        styles.dayPresetPill,
                        dueDay === preset.day && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayPresetText,
                          dueDay === preset.day && { color: '#FFF', fontFamily: 'Cairo_700Bold' },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Custom numeric input */}
                <TextInput
                  style={[styles.input, isAr ? styles.inputAr : styles.inputEn, { marginTop: 6 }]}
                  placeholder={isAr ? 'أو أدخل يوم محدد (1-31)' : 'Or enter day (1-31)'}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textTertiary}
                  value={dueDay}
                  onChangeText={setDueDay}
                />

                <Text style={styles.dueDatePreviewNote}>
                  🗓️ {isAr ? `تاريخ أول استحقاق قادم: ${nextDueDatePreview}` : `Next due date: ${nextDueDatePreview}`}
                </Text>
              </View>

              {/* Provider selector */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{isAr ? 'الجهة / موفر الخدمة' : 'Provider'}</Text>
                <View style={styles.providerOptions}>
                  {(['valu', 'tabby', 'tamara', 'bank_card', 'other'] as const).map(p => (
                    <Pressable
                      key={p}
                      onPress={() => setProvider(p)}
                      style={[
                        styles.providerOption,
                        provider === p && { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
                      ]}
                    >
                      <Text style={[styles.providerOptionText, provider === p && { color: colors.primary }]}>
                        {getProviderName(p)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable onPress={handleAddPlan} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>
                  {isAr ? 'حفظ وتفعيل القسط' : 'Save & Activate'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  urgentBannerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  urgentBannerSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  summaryLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  savingsImpactCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    marginBottom: 20,
    gap: 10,
  },
  savingsImpactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  savingsImpactTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  safetyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  safetyBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
  },
  impactMetricsGrid: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 10,
  },
  impactMetricBox: {
    flex: 1,
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
  savingsImpactSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  emptySub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  providerText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.text,
  },
  deleteBtn: {
    padding: 4,
  },
  planTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
    marginBottom: 10,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  planMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planMetaText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  planDueText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  planFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthlyLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
  },
  monthlyValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  payBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: '#FFF',
  },

  // --- Custom Modals Styles ---
  customModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  customModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  customModalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  customModalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
  customModalDetailsBox: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  customModalItemName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  customModalAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
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
    fontSize: 12,
    color: colors.textSecondary,
  },
  customModalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 6,
  },
  customModalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customModalBtnCancel: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customModalBtnConfirm: {
    backgroundColor: colors.primary,
  },
  customModalBtnCancelText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  customModalBtnConfirmText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },

  // --- Add Modal Styles ---
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
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
    borderRadius: 10,
    alignItems: 'center',
  },
  calcModeBtnActive: {
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  calcModeBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  calcModeBtnTextActive: {
    fontFamily: 'Cairo_700Bold',
    color: colors.primary,
  },
  formGroup: {
    gap: 6,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 44,
    fontFamily: 'Cairo_400Regular',
    color: colors.text,
    fontSize: 14,
  },
  inputAr: { textAlign: 'right' },
  inputEn: { textAlign: 'left' },
  calcPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary + '12',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  calcPreviewText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.text,
    flex: 1,
  },
  dayPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayPresetPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayPresetText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  dueDatePreviewNote: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.primary,
    marginTop: 2,
  },
  providerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  providerOptionText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
