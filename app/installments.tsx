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

  const handleAddPlan = async () => {
    if (!title.trim() || !totalAmount || !totalMonths) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Warning',
        language === 'ar' ? 'يرجى إدخال اسم القسط، المبلغ الإجمالي، وعدد الأشهر' : 'Please fill all required fields'
      );
      return;
    }

    const numTotal = parseFloat(totalAmount);
    const numMonths = parseInt(totalMonths, 10);
    const numDueDay = parseInt(dueDay, 10) || 5;

    if (isNaN(numTotal) || numTotal <= 0 || isNaN(numMonths) || numMonths <= 0) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'المبلغ وعدد الأشهر يجب أن تكون أرقاماً موجبة' : 'Invalid total amount or months'
      );
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
    setModalVisible(false);
    await loadPlans();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handlePayMonth = async (plan: InstallmentPlan) => {
    Alert.alert(
      language === 'ar' ? 'تأكيد سداد القسط' : 'Confirm Payment',
      language === 'ar'
        ? `هل تريد تسجيل سداد قسط هذا الشهر بمبلغ ${formatCurrency(plan.monthlyAmount)} ${selectedWallet?.currency}؟`
        : `Pay monthly installment of ${formatCurrency(plan.monthlyAmount)} ${selectedWallet?.currency}?`,
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'تأكيد السداد' : 'Pay Now',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            const res = await payInstallmentMonth(plan.id, addTransaction);
            if (res.success) {
              await refresh();
              await loadPlans();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  };

  const handleDeletePlan = (id: string) => {
    Alert.alert(
      language === 'ar' ? 'حذف القسط' : 'Delete Plan',
      language === 'ar' ? 'هل أنت تأكد من حذف خطة التقسيط هذه؟' : 'Are you sure you want to delete this installment plan?',
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await deleteInstallmentPlan(id);
            await loadPlans();
          },
        },
      ]
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {language === 'ar' ? '💳 الأقساط والبطاقات الائتمانية' : '💳 Installments & Cards'}
        </Text>
        <Pressable onPress={() => setModalVisible(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Overview Header Cards */}
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

        {/* Active Plans */}
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
            const currentMonthKey = new Date().toISOString().substring(0, 7);
            const isPaidThisMonth = plan.lastPaidMonth === currentMonthKey;
            const progress = (plan.totalMonths - plan.remainingMonths) / plan.totalMonths;

            return (
              <View key={plan.id} style={styles.planCard}>
                <View style={styles.planHeader}>
                  <View style={styles.providerBadge}>
                    <Ionicons name={getProviderIcon(plan.provider) as any} size={16} color={colors.primary} />
                    <Text style={styles.providerText}>{getProviderName(plan.provider)}</Text>
                  </View>

                  <Pressable onPress={() => handleDeletePlan(plan.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
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
                    {language === 'ar' ? `استحقاق يوم ${plan.dueDay} شهرياً` : `Due day: ${plan.dueDay}`}
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
                    disabled={isPaidThisMonth}
                    style={[
                      styles.payBtn,
                      isPaidThisMonth && { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons
                      name={isPaidThisMonth ? 'checkmark' : 'wallet-outline'}
                      size={16}
                      color={isPaidThisMonth ? colors.primary : '#FFF'}
                    />
                    <Text style={[styles.payBtnText, isPaidThisMonth && { color: colors.primary }]}>
                      {isPaidThisMonth
                        ? (language === 'ar' ? 'تم سداد الشهر' : 'Paid This Month')
                        : (language === 'ar' ? 'سداد قسط الشهر' : 'Pay This Month')}
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
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
              {language === 'ar' ? `الأقساط المكتملة (${completedPlans.length})` : `Completed (${completedPlans.length})`}
            </Text>
            {completedPlans.map(plan => (
              <View key={plan.id} style={[styles.planCard, { opacity: 0.6 }]}>
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
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'ar' ? 'إضافة قسط / التزام جديد' : 'Add Installment Plan'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

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
    gap: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 18,
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
    fontSize: 15,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
    textAlign: 'left',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
  emptySub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    marginBottom: 8,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  providerText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: colors.primary,
  },
  planTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
    textAlign: 'left',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  planMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planMetaText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  planDueText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  planFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthlyLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  monthlyValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
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
