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
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
import {
  Jameya,
  getJameyas,
  saveJameya,
  deleteJameya,
  payJameyaMonth,
  receiveJameyaPayout,
} from '@/lib/jameyaStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function JameyaScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { selectedWallet, wallets, addTransaction, totalIncome, currencySymbol } = useTransactions();

  const [jameyas, setJameyas] = useState<Jameya[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJameya, setEditingJameya] = useState<Jameya | null>(null);

  // Modals for Actions
  const [payingItem, setPayingItem] = useState<Jameya | null>(null);
  const [payoutItem, setPayoutItem] = useState<Jameya | null>(null);
  const [deletingItem, setDeletingItem] = useState<Jameya | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [totalMonths, setTotalMonths] = useState('10');
  const [payoutMonth, setPayoutMonth] = useState('1');
  const [startMonth, setStartMonth] = useState(new Date().toISOString().substring(0, 7));
  const [walletId, setWalletId] = useState(selectedWallet?.id || wallets[0]?.id || '');

  useEffect(() => {
    if (selectedWallet && !walletId) {
      setWalletId(selectedWallet.id);
    }
  }, [selectedWallet]);

  const loadJameyas = useCallback(async () => {
    const data = await getJameyas();
    setJameyas(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadJameyas();
    }, [loadJameyas])
  );

  const activeJameyas = useMemo(() => jameyas.filter(j => j.paidMonthsCount < j.totalMonths), [jameyas]);
  const completedJameyas = useMemo(() => jameyas.filter(j => j.paidMonthsCount >= j.totalMonths), [jameyas]);

  const totalMonthlyCommitment = useMemo(
    () => activeJameyas.reduce((sum, j) => sum + j.monthlyAmount, 0),
    [activeJameyas]
  );

  const totalExpectedPayout = useMemo(
    () => jameyas.filter(j => !j.isPayoutReceived).reduce((sum, j) => sum + (j.monthlyAmount * j.totalMonths), 0),
    [jameyas]
  );

  const handleOpenAdd = () => {
    Haptics.selectionAsync();
    setEditingJameya(null);
    setName('');
    setMonthlyAmount('');
    setTotalMonths('10');
    setPayoutMonth('1');
    setStartMonth(new Date().toISOString().substring(0, 7));
    setWalletId(selectedWallet?.id || wallets[0]?.id || '');
    setModalVisible(true);
  };

  const handleOpenEdit = (item: Jameya) => {
    Haptics.selectionAsync();
    setEditingJameya(item);
    setName(item.name);
    setMonthlyAmount(item.monthlyAmount.toString());
    setTotalMonths(item.totalMonths.toString());
    setPayoutMonth(item.payoutMonth.toString());
    setStartMonth(item.startMonth);
    setWalletId(item.walletId);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى إدخال اسم الجمعية' : 'Please enter association name');
      return;
    }
    const numMonthly = parseFloat(monthlyAmount);
    if (isNaN(numMonthly) || numMonthly <= 0) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى إدخال قسط شهري صحيح' : 'Please enter a valid monthly amount');
      return;
    }
    const numTotalMonths = parseInt(totalMonths, 10);
    if (isNaN(numTotalMonths) || numTotalMonths <= 0) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى إدخال عدد أشهر صحيح' : 'Please enter valid total months');
      return;
    }
    const numPayoutMonth = parseInt(payoutMonth, 10);
    if (isNaN(numPayoutMonth) || numPayoutMonth < 1 || numPayoutMonth > numTotalMonths) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? `ترتيب شهر القبض يجب أن يكون بين 1 و ${numTotalMonths}` : `Payout month must be between 1 and ${numTotalMonths}`);
      return;
    }
    if (!walletId) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى اختيار محفظة' : 'Please select a wallet');
      return;
    }

    try {
      await saveJameya({
        id: editingJameya?.id,
        name: name.trim(),
        monthlyAmount: numMonthly,
        totalMonths: numTotalMonths,
        payoutMonth: numPayoutMonth,
        startMonth: startMonth || new Date().toISOString().substring(0, 7),
        paidMonthsCount: editingJameya ? editingJameya.paidMonthsCount : 0,
        isPayoutReceived: editingJameya ? editingJameya.isPayoutReceived : false,
        walletId,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      loadJameyas();
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل حفظ الجمعية' : 'Failed to save association');
    }
  };

  const handleConfirmPayMonth = async () => {
    if (!payingItem || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await payJameyaMonth(payingItem.id, addTransaction);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPayingItem(null);
        loadJameyas();
      } else {
        Alert.alert(isAr ? 'ملاحظة' : 'Notice', isAr ? 'تم سداد جميع أقساط هذه الجمعية بالفعل' : 'All installments paid for this association');
      }
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'حدث خطأ أثناء تسجيل القسط' : 'Error recording payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReceivePayout = async () => {
    if (!payoutItem || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await receiveJameyaPayout(payoutItem.id, addTransaction);
      if (res) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPayoutItem(null);
        loadJameyas();
      } else {
        Alert.alert(isAr ? 'ملاحظة' : 'Notice', isAr ? 'تم استلام مبلغ هذه الجمعية سابقاً' : 'Payout already received');
      }
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'حدث خطأ أثناء تسجيل القبض' : 'Error recording payout');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteJameya(deletingItem.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeletingItem(null);
      loadJameyas();
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل الحذف' : 'Failed to delete');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isAr ? '🤝 الجمعيات المالية (ROSCA)' : '🤝 Savings Associations'}</Text>
        <Pressable style={styles.addButton} onPress={handleOpenAdd}>
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Overview Banner */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{isAr ? 'التزام الجمعيات الشهري' : 'Monthly Commitment'}</Text>
              <Text style={[styles.summaryValue, { color: colors.expense }]}>
                {formatCurrency(totalMonthlyCommitment)} {currencySymbol}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{isAr ? 'مبالغ متوقع قبضها' : 'Pending Payouts'}</Text>
              <Text style={[styles.summaryValue, { color: colors.income }]}>
                {formatCurrency(totalExpectedPayout)} {currencySymbol}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Nav / Shortcut to Installments */}
        <View style={styles.quickNavRow}>
          <Pressable style={styles.quickNavTabActive}>
            <MaterialCommunityIcons name="account-group-outline" size={18} color="#FFF" />
            <Text style={styles.quickNavTabTextActive}>{isAr ? 'الجمعيات' : 'Associations'}</Text>
          </Pressable>

          <Pressable style={styles.quickNavTab} onPress={() => router.push('/installments')}>
            <MaterialIcons name="credit-card" size={18} color={colors.textSecondary} />
            <Text style={styles.quickNavTabText}>{isAr ? 'الأقساط والكروت' : 'Installments'}</Text>
          </Pressable>
        </View>

        {/* Active Associations List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {isAr ? `الجمعيات الجارية (${activeJameyas.length})` : `Active Associations (${activeJameyas.length})`}
          </Text>
        </View>

        {activeJameyas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-group" size={56} color={colors.textSecondary} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyTitle}>{isAr ? 'لا توجد جمعيات نشطة حالياً' : 'No Active Associations'}</Text>
            <Text style={styles.emptySubtitle}>
              {isAr ? 'انقر على (+) لإضافة جمعية جديدة ومتابعة أقساطها وشهر قبضها بسهولة' : 'Tap (+) to add a new association and track monthly payouts'}
            </Text>
            <Pressable style={styles.createButton} onPress={handleOpenAdd}>
              <Text style={styles.createButtonText}>{isAr ? '+ إضافة جمعية' : '+ Add Association'}</Text>
            </Pressable>
          </View>
        ) : (
          activeJameyas.map((item) => {
            const potAmount = item.monthlyAmount * item.totalMonths;
            const progress = item.paidMonthsCount / item.totalMonths;
            const isPayoutMonth = item.paidMonthsCount + 1 === item.payoutMonth;

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <View style={styles.iconCircle}>
                      <MaterialCommunityIcons name="account-group" size={22} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={styles.cardSubtitle}>
                        {isAr
                          ? `دور القبض: الشهر الـ ${item.payoutMonth} من أصل ${item.totalMonths}`
                          : `Payout Turn: Month ${item.payoutMonth} of ${item.totalMonths}`}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable onPress={() => handleOpenEdit(item)} style={styles.iconBtn}>
                      <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => setDeletingItem(item)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={18} color={colors.expense} />
                    </Pressable>
                  </View>
                </View>

                {/* Pot & Monthly Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>{isAr ? 'القسط الشهري' : 'Monthly Pay'}</Text>
                    <Text style={styles.statValue}>{formatCurrency(item.monthlyAmount)} {currencySymbol}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>{isAr ? 'إجمالي القبض' : 'Total Pot'}</Text>
                    <Text style={[styles.statValue, { color: colors.income }]}>{formatCurrency(potAmount)} {currencySymbol}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>{isAr ? 'المسدد' : 'Paid'}</Text>
                    <Text style={styles.statValue}>{item.paidMonthsCount} / {item.totalMonths} {isAr ? 'أشهر' : 'mos'}</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(100, progress * 100)}%` }]} />
                  </View>
                </View>

                {/* Status Badges & Action Buttons */}
                <View style={styles.actionsRow}>
                  {item.isPayoutReceived ? (
                    <View style={styles.badgeSuccess}>
                      <Ionicons name="checkmark-circle" size={14} color="#0D7C66" />
                      <Text style={styles.badgeSuccessText}>{isAr ? 'تم قبض الجمعية 🎉' : 'Pot Received 🎉'}</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.payoutButton, isPayoutMonth && styles.payoutButtonHighlight]}
                      onPress={() => setPayoutItem(item)}
                    >
                      <Ionicons name="cash-outline" size={16} color="#FFF" />
                      <Text style={styles.payoutButtonText}>
                        {isAr ? 'قبض الجمعية الآن' : 'Receive Pot Now'}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable style={styles.payMonthButton} onPress={() => setPayingItem(item)}>
                    <Ionicons name="wallet-outline" size={16} color="#FFF" />
                    <Text style={styles.payMonthButtonText}>{isAr ? 'دفع قسط الشهر' : 'Pay This Month'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {/* Completed Associations */}
        {completedJameyas.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>
              {isAr ? `الجمعيات المكتملة (${completedJameyas.length})` : `Completed Associations (${completedJameyas.length})`}
            </Text>

            {completedJameyas.map((item) => (
              <View key={item.id} style={[styles.card, { opacity: 0.75 }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <View style={styles.badgeSuccess}>
                    <Ionicons name="checkmark-done-circle" size={16} color="#0D7C66" />
                    <Text style={styles.badgeSuccessText}>{isAr ? 'مكتملة بالكامل' : 'Fully Completed'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal: Add/Edit Association */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingJameya ? (isAr ? 'تعديل الجمعية' : 'Edit Association') : (isAr ? 'إضافة جمعية جديدة' : 'Add Association')}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>{isAr ? 'اسم الجمعية / المجموعة' : 'Association Name'}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={isAr ? 'مثال: جمعية الأصدقاء، جمعية العائلة' : 'e.g. Friends ROSCA'}
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{isAr ? 'القسط الشهري' : 'Monthly Pay'}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="1000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={monthlyAmount}
                    onChangeText={setMonthlyAmount}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{isAr ? 'عدد الأشهر / الأعضاء' : 'Total Months'}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="10"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={totalMonths}
                    onChangeText={setTotalMonths}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{isAr ? 'ترتيب شهر قبضك (1-10)' : 'Your Payout Month'}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="3"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={payoutMonth}
                    onChangeText={setPayoutMonth}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{isAr ? 'شهر البداية (YYYY-MM)' : 'Start Month'}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="2026-07"
                    placeholderTextColor={colors.textSecondary}
                    value={startMonth}
                    onChangeText={setStartMonth}
                  />
                </View>
              </View>

              {/* Calculated Pot Preview */}
              {monthlyAmount && totalMonths ? (
                <View style={styles.potPreviewBox}>
                  <Text style={styles.potPreviewLabel}>{isAr ? 'إجمالي مبلغ القبض الصافي:' : 'Total Pot Value:'}</Text>
                  <Text style={styles.potPreviewValue}>
                    {formatCurrency((parseFloat(monthlyAmount) || 0) * (parseInt(totalMonths, 10) || 0))} {currencySymbol}
                  </Text>
                </View>
              ) : null}

              {/* Wallet Selector */}
              <Text style={styles.inputLabel}>{isAr ? 'المحفظة المرتبطة بالسداد والقبض' : 'Associated Wallet'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {wallets.map((w) => (
                  <Pressable
                    key={w.id}
                    style={[styles.walletOption, walletId === w.id && styles.walletOptionActive]}
                    onPress={() => setWalletId(w.id)}
                  >
                    <Text style={[styles.walletOptionText, walletId === w.id && styles.walletOptionTextActive]}>
                      {w.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{isAr ? 'حفظ الجمعية' : 'Save Association'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirmation Modals */}
      {payingItem && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <MaterialCommunityIcons name="wallet-plus" size={40} color={colors.primary} />
              <Text style={styles.confirmTitle}>{isAr ? 'تسديد قسط هذا الشهر' : 'Pay Monthly Installment'}</Text>
              <Text style={styles.confirmText}>
                {isAr
                  ? `سيتم تسجيل قسط بمقدار (${formatCurrency(payingItem.monthlyAmount)} ${currencySymbol}) وتخصم من المحفظة المرتبطة.`
                  : `Will record an installment expense of (${formatCurrency(payingItem.monthlyAmount)} ${currencySymbol}).`}
              </Text>
              <View style={styles.confirmActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setPayingItem(null)}>
                  <Text style={styles.cancelBtnText}>{isAr ? 'إلغاء' : 'Cancel'}</Text>
                </Pressable>
                <Pressable style={styles.confirmBtn} onPress={handleConfirmPayMonth} disabled={isSubmitting}>
                  <Text style={styles.confirmBtnText}>{isAr ? 'تأكيد التسديد' : 'Confirm Pay'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {payoutItem && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <MaterialCommunityIcons name="cash-fast" size={40} color="#0D7C66" />
              <Text style={styles.confirmTitle}>{isAr ? 'قبض الجمعية' : 'Receive Association Pot'}</Text>
              <Text style={styles.confirmText}>
                {isAr
                  ? `سيتم تسجيل مضاف كـ "دخل" بمبلغ إجمالي (${formatCurrency(payoutItem.monthlyAmount * payoutItem.totalMonths)} ${currencySymbol}) يضاف لرصيد محفظتك!`
                  : `Will record an income transaction of (${formatCurrency(payoutItem.monthlyAmount * payoutItem.totalMonths)} ${currencySymbol}).`}
              </Text>
              <View style={styles.confirmActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setPayoutItem(null)}>
                  <Text style={styles.cancelBtnText}>{isAr ? 'إلغاء' : 'Cancel'}</Text>
                </Pressable>
                <Pressable style={[styles.confirmBtn, { backgroundColor: '#0D7C66' }]} onPress={handleConfirmReceivePayout} disabled={isSubmitting}>
                  <Text style={styles.confirmBtnText}>{isAr ? 'تأكيد الاستلام' : 'Confirm Payout'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {deletingItem && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <Ionicons name="warning-outline" size={40} color={colors.expense} />
              <Text style={styles.confirmTitle}>{isAr ? 'حذف الجمعية' : 'Delete Association'}</Text>
              <Text style={styles.confirmText}>
                {isAr ? `هل أنت تأكد من حذف جمعية "${deletingItem.name}"؟` : `Are you sure you want to delete "${deletingItem.name}"?`}
              </Text>
              <View style={styles.confirmActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setDeletingItem(null)}>
                  <Text style={styles.cancelBtnText}>{isAr ? 'إلغاء' : 'Cancel'}</Text>
                </Pressable>
                <Pressable style={[styles.confirmBtn, { backgroundColor: colors.expense }]} onPress={handleConfirmDelete}>
                  <Text style={styles.confirmBtnText}>{isAr ? 'حذف' : 'Delete'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 54 : 16,
      paddingBottom: 12,
      backgroundColor: colors.surface,
    },
    backButton: { padding: 8, borderRadius: 20 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    addButton: {
      backgroundColor: colors.primary,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
    summaryValue: { fontSize: 16, fontWeight: '700' },
    summaryDivider: { width: 1, height: 32, backgroundColor: colors.border },
    quickNavRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    quickNavTabActive: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    quickNavTabTextActive: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    quickNavTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickNavTabText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
    sectionHeader: { marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 18 },
    createButton: {
      marginTop: 16,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    createButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    iconBtn: { padding: 6 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: 12, padding: 10, marginBottom: 12 },
    statBox: { alignItems: 'center' },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
    statValue: { fontSize: 13, fontWeight: '700', color: colors.text },
    progressContainer: { marginBottom: 12 },
    progressBarBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
    actionsRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', alignItems: 'center' },
    payoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    payoutButtonHighlight: { backgroundColor: '#0D7C66' },
    payoutButtonText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    payMonthButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    payMonthButtonText: { color: colors.background, fontSize: 12, fontWeight: '700' },
    badgeSuccess: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0D7C6615', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    badgeSuccessText: { color: '#0D7C66', fontSize: 12, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    inputLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
    textInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    potPreviewBox: { backgroundColor: `${colors.primary}10`, padding: 12, borderRadius: 12, marginTop: 12, alignItems: 'center' },
    potPreviewLabel: { fontSize: 12, color: colors.textSecondary },
    potPreviewValue: { fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 4 },
    walletOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
    walletOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    walletOptionText: { fontSize: 13, color: colors.textSecondary },
    walletOptionTextActive: { color: '#FFF', fontWeight: '700' },
    saveBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    confirmBox: { backgroundColor: colors.surface, margin: 20, borderRadius: 20, padding: 24, alignItems: 'center' },
    confirmTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 12 },
    confirmText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 18 },
    confirmActions: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
    confirmBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    confirmBtnText: { color: '#FFF', fontWeight: '700' },
  });
}
