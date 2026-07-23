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
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';
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
  const { selectedWallet, wallets, addTransaction, refresh } = useTransactions();

  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // New Plan State
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
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

  const activePlans = plans.filter(p => p.remainingMonths > 0);
  const completedPlans = plans.filter(p => p.remainingMonths === 0);

  const totalRemainingDebt = activePlans.reduce((sum, p) => sum + p.remainingMonths * p.monthlyAmount, 0);
  const totalMonthlyCommitment = activePlans.reduce((sum, p) => sum + p.monthlyAmount, 0);

  const confirmAction = (titleText: string, messageText: string, onConfirm: () => Promise<void>) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${titleText}\n\n${messageText}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(
        titleText,
        messageText,
        [
          { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
          {
            text: language === 'ar' ? 'تأكيد' : 'Confirm',
            onPress: () => {
              onConfirm();
            },
          },
        ]
      );
    }
  };

  const handleAddPlan = async () => {
    if (!title.trim() || !totalAmount || !totalMonths) {
      const msg = language === 'ar' ? 'يرجى إدخال اسم القسط، المبلغ الإجمالي، وعدد الأشهر' : 'Please fill all required fields';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert(language === 'ar' ? 'تنبيه' : 'Warning', msg);
      }
      return;
    }

    const numTotal = parseFloat(totalAmount);
    const numMonths = parseInt(totalMonths, 10);
    const numDueDay = parseInt(dueDay, 10) || 5;

    if (isNaN(numTotal) || numTotal <= 0 || isNaN(numMonths) || numMonths <= 0) {
      const msg = language === 'ar' ? 'المبلغ وعدد الأشهر يجب أن تكون أرقاماً موجبة' : 'Invalid total amount or months';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert(language === 'ar' ? 'خطأ' : 'Error', msg);
      }
      return;
    }

    const monthlyAmount = Math.round((numTotal / numMonths) * 100) / 100;
    const targetWalletId = selectedWallet?.id || (wallets[0] ? wallets[0].id : '');

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await saveInstallmentPlan({
      title: title.trim(),
      totalAmount: numTotal,
      monthlyAmount,
      totalMonths: numMonths,
      remainingMonths: numMonths,
      provider,
      dueDay: numDueDay,
      category,
      walletId: targetWalletId,
    });

    setTitle('');
    setTotalAmount('');
    setTotalMonths('6');
    setDueDay('5');
    setModalVisible(false);
    await loadPlans();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handlePayMonth = (plan: InstallmentPlan) => {
    confirmAction(
      language === 'ar' ? 'تأكيد سداد القسط' : 'Confirm Payment',
      language === 'ar'
        ? `هل تريد تسجيل سداد قسط هذا الشهر لمصروف ${plan.title} بمبلغ ${formatCurrency(plan.monthlyAmount)} ${selectedWallet?.currency}؟`
        : `Pay monthly installment for ${plan.title} of ${formatCurrency(plan.monthlyAmount)} ${selectedWallet?.currency}?`,
      async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        const res = await payInstallmentMonth(plan.id, addTransaction);
        if (res.success) {
          await refresh();
          await loadPlans();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    );
  };

  const handleDeletePlan = (id: string) => {
    confirmAction(
      language === 'ar' ? 'حذف القسط' : 'Delete Plan',
      language === 'ar' ? 'هل أنت تأكد من حذف خطة التقسيط هذه؟' : 'Are you sure you want to delete this installment plan?',
      async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await deleteInstallmentPlan(id);
        await loadPlans();
      }
    );
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
      case 'bank_card': return language === 'ar' ? 'بطاقة ائتمان بنكية' : 'Bank Credit Card';
      default: return language === 'ar' ? 'تقسيط آخر' : 'Other Installment';
    }
  };

  const getDueStatus = (plan: InstallmentPlan) => {
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const isPaidThisMonth = plan.lastPaidMonth === currentMonthKey;
    if (isPaidThisMonth) {
      return {
        text: language === 'ar' ? '✅ تم سداد قسط هذا الشهر' : '✅ Paid for this month',
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
        text: language === 'ar' ? `⚠️ قسط مستحق السداد (كان يوم ${dueDayNum} بالشهر)` : `⚠️ Overdue since day ${dueDayNum}`,
        color: '#EF4444',
        bgColor: '#EF444418',
        isPaid: false,
        isOverdue: true,
      };
    } else {
      const daysLeft = dueDayNum - todayDay;
      return {
        text: language === 'ar' ? `🔔 مستحق السداد خلال ${daysLeft === 0 ? 'اليوم' : `${daysLeft} أيام`} (يوم ${dueDayNum})` : `🔔 Due in ${daysLeft} days (day ${dueDayNum})`,
        color: '#F59E0B',
        bgColor: '#F59E0B18',
        isPaid: false,
        isOverdue: false,
      };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {language === 'ar' ? '💳 الأقساط والبطاقات الائتمانية' : '💳 Installments & Credit Cards'}
        </Text>
        <Pressable onPress={() => setModalVisible(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Summary Metric Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: colors.expense + '40' }]}>
            <Ionicons name="trending-down" size={22} color={colors.expense} />
            <Text style={styles.summaryLabel}>
              {language === 'ar' ? 'إجمالي المتبقي عليك' : 'Total Debt Remaining'}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.expense }]}>
              {formatCurrency(totalRemainingDebt)} {selectedWallet?.currency}
            </Text>
          </View>

          <View style={[styles.summaryCard, { borderColor: colors.primary + '40' }]}>
            <Ionicons name="calendar" size={22} color={colors.primary} />
            <Text style={styles.summaryLabel}>
              {language === 'ar' ? 'الالتزام الشهري' : 'Monthly Obligation'}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              {formatCurrency(totalMonthlyCommitment)} {selectedWallet?.currency}
            </Text>
          </View>
        </View>

        {/* Savings Impact Banner */}
        {totalMonthlyCommitment > 0 && (
          <View style={styles.savingsImpactCard}>
            <View style={styles.savingsImpactHeader}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={styles.savingsImpactTitle}>
                {language === 'ar' ? 'تأثير الأقساط على خطة التوفير والادخار' : 'Installments Impact on Savings Plan'}
              </Text>
            </View>
            <Text style={styles.savingsImpactSub}>
              {language === 'ar'
                ? `تستقطع الأقساط ${formatCurrency(totalMonthlyCommitment)} ${selectedWallet?.currency} شهرياً من رصيدك المتاح. عند الانتهاء منها ستتمكن من تحويل هذا المبلغ مباشرة لأهداف الادخار وحصالات التوفير!`
                : `Your monthly obligation of ${formatCurrency(totalMonthlyCommitment)} ${selectedWallet?.currency} consumes part of your savings capacity. Once paid off, this amount can go directly to your Savings Goals!`}
            </Text>
          </View>
        )}

        {/* Active Plans Section */}
        <Text style={styles.sectionTitle}>
          {language === 'ar' ? `الأقساط النشطة (${activePlans.length})` : `Active Installments (${activePlans.length})`}
        </Text>

        {activePlans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>
              {language === 'ar' ? 'لا توجد أقساط نشطة حالياً' : 'No Active Installments'}
            </Text>
            <Text style={styles.emptySub}>
              {language === 'ar'
                ? 'اضغط على زر الإضافة (+) لإدراج أقساط Valu أو تابي أو البطاقات الائتمانية'
                : 'Tap (+) to add Valu, Tabby, Tamara or Credit Card installments'}
            </Text>
          </View>
        ) : (
          activePlans.map(plan => {
            const status = getDueStatus(plan);
            const progress = (plan.totalMonths - plan.remainingMonths) / plan.totalMonths;

            return (
              <View key={plan.id} style={styles.planCard}>
                <View style={styles.planHeader}>
                  <View style={styles.providerBadge}>
                    <Ionicons name={getProviderIcon(plan.provider) as any} size={16} color={colors.primary} />
                    <Text style={styles.providerText}>{getProviderName(plan.provider)}</Text>
                  </View>

                  <Pressable onPress={() => handleDeletePlan(plan.id)} hitSlop={15} style={styles.deleteBtn}>
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
                    {language === 'ar'
                      ? `متبقي ${plan.remainingMonths} من أصل ${plan.totalMonths} شهر`
                      : `${plan.remainingMonths} of ${plan.totalMonths} months left`}
                  </Text>
                  <Text style={styles.planDueText}>
                    {language === 'ar' ? `استحقاق يوم ${plan.dueDay || 5} شهرياً` : `Due day: ${plan.dueDay || 5}`}
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
                      {language === 'ar' ? 'القسط الشهري:' : 'Monthly:'}
                    </Text>
                    <Text style={styles.monthlyValue}>
                      {formatCurrency(plan.monthlyAmount)} {selectedWallet?.currency}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handlePayMonth(plan)}
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
                        ? (language === 'ar' ? 'تم سداد قسط الشهر' : 'Paid This Month')
                        : (language === 'ar' ? 'تأكيد سداد قسط هذا الشهر' : 'Confirm Payment')}
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
              {language === 'ar' ? `الأقساط المكتملة (${completedPlans.length})` : `Completed (${completedPlans.length})`}
            </Text>
            {completedPlans.map(plan => (
              <View key={plan.id} style={[styles.planCard, { opacity: 0.65 }]}>
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                </View>
                <Text style={styles.planMetaText}>
                  {language === 'ar'
                    ? `تم سداد إجمالي ${formatCurrency(plan.totalAmount)} ${selectedWallet?.currency}`
                    : `Fully paid total ${formatCurrency(plan.totalAmount)} ${selectedWallet?.currency}`}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Add Plan Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'ar' ? 'إضافة قسط / التزام جديد' : 'Add Installment Plan'}
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
              {/* Form */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{language === 'ar' ? 'اسم القسط / المنتج' : 'Title / Item Name'}</Text>
                <TextInput
                  style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                  placeholder={language === 'ar' ? 'مثال: هاتف فاليو، قسط تابي، لاب توب' : 'e.g. iPhone Valu, Tabby Purchase'}
                  placeholderTextColor={colors.textTertiary}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{language === 'ar' ? 'المبلغ الإجمالي' : 'Total Amount'}</Text>
                  <TextInput
                    style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textTertiary}
                    value={totalAmount}
                    onChangeText={setTotalAmount}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{language === 'ar' ? 'عدد الأشهر' : 'Total Months'}</Text>
                  <TextInput
                    style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                    placeholder="6"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textTertiary}
                    value={totalMonths}
                    onChangeText={setTotalMonths}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{language === 'ar' ? 'يوم الاستحقاق الشهري (1 - 31)' : 'Monthly Due Day (1 - 31)'}</Text>
                <TextInput
                  style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                  placeholder="5"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textTertiary}
                  value={dueDay}
                  onChangeText={setDueDay}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{language === 'ar' ? 'الجهة / موفر الخدمة' : 'Provider'}</Text>
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
                  {language === 'ar' ? 'حفظ وتفعيل القسط' : 'Save & Activate'}
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
    color: '#FFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    marginBottom: 20,
    gap: 6,
  },
  savingsImpactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingsImpactTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
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
    color: '#FFF',
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
    color: '#FFF',
    fontSize: 14,
  },
  inputAr: { textAlign: 'right' },
  inputEn: { textAlign: 'left' },
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
    marginTop: 10,
  },
  submitBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
