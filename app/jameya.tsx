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

export default function JameyaScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { selectedWallet, wallets, addTransaction, currencySymbol } = useTransactions();

  const [jameyas, setJameyas] = useState<Jameya[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJameya, setEditingJameya] = useState<Jameya | null>(null);

  // Action Confirmation Modals
  const [payingItem, setPayingItem] = useState<Jameya | null>(null);
  const [payoutTarget, setPayoutTarget] = useState<{ item: Jameya; month?: number } | null>(null);
  const [deductCurrentInstallment, setDeductCurrentInstallment] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Jameya | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [singleShareAmount, setSingleShareAmount] = useState(''); // قيمة الاسم/السهم الواحد (مثلاً 100)
  const [sharesCount, setSharesCount] = useState('1'); // '0.5' | '1' | '2' | '3'
  const [totalMonths, setTotalMonths] = useState('8'); // إجمالي أسماء/أشهر الجمعية
  const [startMonth, setStartMonth] = useState(new Date().toISOString().substring(0, 7));
  const [walletId, setWalletId] = useState(selectedWallet?.id || wallets[0]?.id || '');
  
  // Array of payout months corresponding to sharesCount (e.g. ['5', '8'] for 2 shares)
  const [payoutMonthsInputs, setPayoutMonthsInputs] = useState<string[]>(['1']);

  useEffect(() => {
    if (selectedWallet && !walletId) {
      setWalletId(selectedWallet.id);
    }
  }, [selectedWallet]);

  // Adjust payoutMonthsInputs array whenever sharesCount changes
  useEffect(() => {
    const count = Math.max(1, Math.floor(parseFloat(sharesCount) || 1));
    setPayoutMonthsInputs(prev => {
      const next = [...prev];
      while (next.length < count) {
        next.push((next.length + 1).toString());
      }
      return next.slice(0, count);
    });
  }, [sharesCount]);

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
    setEditingJameya(null);
    setFormError(null);
    setName('');
    setSingleShareAmount('');
    setSharesCount('1');
    setTotalMonths('8');
    setPayoutMonthsInputs(['1']);
    setStartMonth(new Date().toISOString().substring(0, 7));
    setWalletId(selectedWallet?.id || wallets[0]?.id || '');
    setModalVisible(true);
  };

  const handleOpenEdit = (item: Jameya) => {
    Haptics.selectionAsync();
    setEditingJameya(item);
    setFormError(null);
    setName(item.name);
    
    const count = item.sharesCount || 1;
    const shareVal = item.singleShareAmount || (item.monthlyAmount / count);
    setSingleShareAmount(shareVal.toString());
    setSharesCount(count.toString());
    setTotalMonths(item.totalMonths.toString());
    
    const pm = item.payoutMonths && item.payoutMonths.length > 0
      ? item.payoutMonths.map(n => n.toString())
      : [(item.payoutMonth || 1).toString()];
    setPayoutMonthsInputs(pm);

    setStartMonth(item.startMonth);
    setWalletId(item.walletId);
    setModalVisible(true);
  };

  // Live computed values for modal
  const computedSingleShareVal = parseFloat(singleShareAmount) || 0;
  const computedSharesCountVal = parseFloat(sharesCount) || 1;
  const computedTotalMonthsVal = parseInt(totalMonths, 10) || 1;

  const computedMonthlyTotalPay = computedSingleShareVal * computedSharesCountVal;
  const computedPotPerShare = computedSingleShareVal * computedTotalMonthsVal;
  const computedTotalJameyaPayout = computedPotPerShare * computedSharesCountVal;

  const handleSave = async () => {
    setFormError(null);
    if (!name.trim()) {
      const err = isAr ? 'يرجى إدخال اسم الجمعية' : 'Please enter association name';
      setFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'تنبيه' : 'Notice', err);
      return;
    }
    if (computedSingleShareVal <= 0) {
      const err = isAr ? 'يرجى إدخال قيمة صحيحة لـ مبلغ الاسم/السهم الواحد' : 'Please enter a valid share amount';
      setFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'تنبيه' : 'Notice', err);
      return;
    }
    if (computedSharesCountVal <= 0) {
      const err = isAr ? 'يرجى إدخال عدد أسهم/أسماء صحيح' : 'Please enter a valid shares count';
      setFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'تنبيه' : 'Notice', err);
      return;
    }
    if (computedTotalMonthsVal <= 0) {
      const err = isAr ? 'يرجى إدخال عدد أشهر صحيح' : 'Please enter valid total months';
      setFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'تنبيه' : 'Notice', err);
      return;
    }

    // Parse payout months list
    const parsedPayoutMonths: number[] = [];
    for (let i = 0; i < payoutMonthsInputs.length; i++) {
      const val = parseInt(payoutMonthsInputs[i], 10);
      if (isNaN(val) || val < 1 || val > computedTotalMonthsVal) {
        const err = isAr
          ? `شهر القبض رقم (${i + 1}) يجب أن يكون برقم بين 1 و ${computedTotalMonthsVal}`
          : `Payout month #${i + 1} must be between 1 and ${computedTotalMonthsVal}`;
        setFormError(err);
        if (Platform.OS !== 'web') Alert.alert(isAr ? 'خطأ في شهر القبض' : 'Payout Month Error', err);
        return;
      }
      parsedPayoutMonths.push(val);
    }

    const targetWalletId = walletId || selectedWallet?.id || (wallets[0]?.id || '');
    if (!targetWalletId) {
      const err = isAr ? 'يرجى اختيار محفظة مرتبطة' : 'Please select a wallet';
      setFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'تنبيه' : 'Notice', err);
      return;
    }

    try {
      await saveJameya({
        id: editingJameya?.id,
        name: name.trim(),
        singleShareAmount: computedSingleShareVal,
        sharesCount: computedSharesCountVal,
        monthlyAmount: computedMonthlyTotalPay,
        totalMonths: computedTotalMonthsVal,
        payoutMonth: parsedPayoutMonths[0] || 1,
        payoutMonths: parsedPayoutMonths,
        receivedPayoutMonths: editingJameya ? editingJameya.receivedPayoutMonths : [],
        startMonth: startMonth || new Date().toISOString().substring(0, 7),
        paidMonthsCount: editingJameya ? editingJameya.paidMonthsCount : 0,
        isPayoutReceived: editingJameya ? editingJameya.isPayoutReceived : false,
        walletId: targetWalletId,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFormError(null);
      setModalVisible(false);
      loadJameyas();
    } catch (e) {
      const err = isAr ? 'فشل حفظ الجمعية' : 'Failed to save association';
      setFormError(err);
      if (Platform.OS !== 'web') Alert.alert(isAr ? 'خطأ' : 'Error', err);
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
    if (!payoutTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await receiveJameyaPayout(
        payoutTarget.item.id,
        addTransaction,
        payoutTarget.month,
        deductCurrentInstallment
      );
      if (res) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPayoutTarget(null);
        setDeductCurrentInstallment(false);
        loadJameyas();
      } else {
        Alert.alert(isAr ? 'ملاحظة' : 'Notice', isAr ? 'تم استلام مبلغ هذا الدور سابقاً' : 'Payout already received');
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
      {/* Top Bar Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack} hitSlop={15}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isAr ? '🤝 أقساط وجمعيات' : '🤝 Installments & Associations'}</Text>
        <Pressable style={styles.addButton} onPress={handleOpenAdd} hitSlop={8}>
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
            <MaterialCommunityIcons name="account-group" size={56} color={colors.textSecondary} style={{ opacity: 0.4 }} />
            <Text style={styles.emptyTitle}>{isAr ? 'لا توجد جمعيات نشطة حالياً' : 'No Active Associations'}</Text>
            <Text style={styles.emptySubtitle}>
              {isAr ? 'انقر على (+) لإضافة جمعية جديدة وتتبع أقساطها وشهور قبضها بسهولة' : 'Tap (+) to add a new association and track monthly payouts'}
            </Text>
            <Pressable style={styles.createButton} onPress={handleOpenAdd}>
              <Text style={styles.createButtonText}>{isAr ? '+ إضافة جمعية' : '+ Add Association'}</Text>
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
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <View style={styles.iconCircle}>
                      <MaterialCommunityIcons name="account-group" size={22} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        {renderSharesBadge(shares)}
                      </View>
                      <Text style={styles.cardSubtitle}>
                        {isAr ? `قيمة الاسم: ${formatCurrency(singleVal)} ${currencySymbol}` : `Share Val: ${formatCurrency(singleVal)}`}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable onPress={() => handleOpenEdit(item)} style={styles.iconBtn} hitSlop={8}>
                      <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => setDeletingItem(item)} style={styles.iconBtn} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.expense} />
                    </Pressable>
                  </View>
                </View>

                {/* Pot & Monthly Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>{isAr ? 'إجمالي قسطك' : 'Monthly Pay'}</Text>
                    <Text style={styles.statValue}>{formatCurrency(item.monthlyAmount)} {currencySymbol}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>{isAr ? 'إجمالي القبض' : 'Total Pot'}</Text>
                    <Text style={[styles.statValue, { color: colors.income }]}>{formatCurrency(totalPotAll)} {currencySymbol}</Text>
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

                {/* Payout Months Badges & Collection Buttons */}
                <Text style={styles.payoutSectionTitle}>
                  {isAr
                    ? `مواعيد الاستحقاق (قبض ${formatCurrency(potPerShare)} ${currencySymbol} لكل اسم):`
                    : `Payout Schedule (${formatCurrency(potPerShare)} per share):`}
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
                        onPress={() => setPayoutTarget({ item, month: mNum })}
                      >
                        <Ionicons
                          name={isReceived ? 'checkmark-circle' : isCurrentTurn ? 'cash' : 'time-outline'}
                          size={14}
                          color={isReceived ? '#0D7C66' : isCurrentTurn ? '#FFF' : colors.textSecondary}
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

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  <Pressable style={styles.payMonthButton} onPress={() => setPayingItem(item)}>
                    <MaterialCommunityIcons name="piggy-bank-outline" size={18} color={colors.background} />
                    <Text style={styles.payMonthButtonText}>{isAr ? 'تسديد قسط هذا الشهر (ادخار)' : 'Pay This Month (Savings)'}</Text>
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
              <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>
              <Text style={styles.inputLabel}>{isAr ? 'اسم الجمعية / المجموعة' : 'Association Name'}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={isAr ? 'مثال: جمعية الأصدقاء، جمعية الساير' : 'e.g. Al-Sayer ROSCA'}
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />

              {/* Shares Count Quick Select (نصف اسم، اسم واحد، اسمين، إلخ) */}
              <Text style={styles.inputLabel}>{isAr ? 'عدد الأسماء / الأسهم التي تشارك بها:' : 'Participation Shares/Names:'}</Text>
              <View style={styles.sharesChipsRow}>
                {[
                  { label: isAr ? '0.5 (نصف اسم)' : '0.5 Share', val: '0.5' },
                  { label: isAr ? '1 (اسم واحد)' : '1 Share', val: '1' },
                  { label: isAr ? '2 (اسمين)' : '2 Shares', val: '2' },
                  { label: isAr ? '3 (3 أسماء)' : '3 Shares', val: '3' },
                ].map((chip) => (
                  <Pressable
                    key={chip.val}
                    style={[styles.shareChip, sharesCount === chip.val && styles.shareChipActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSharesCount(chip.val);
                    }}
                  >
                    <Text style={[styles.shareChipText, sharesCount === chip.val && styles.shareChipTextActive]}>
                      {chip.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{isAr ? 'مبلغ الاسم/السهم الواحد' : 'Single Share Value'}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="100"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={singleShareAmount}
                    onChangeText={setSingleShareAmount}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{isAr ? 'إجمالي أسماء/أشهر الجمعية' : 'Total Months / Members'}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="8"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={totalMonths}
                    onChangeText={setTotalMonths}
                  />
                </View>
              </View>

              {/* Dynamic Payout Months Inputs based on Shares Count */}
              <View style={styles.payoutMonthsInputBox}>
                <Text style={styles.payoutMonthsInputBoxTitle}>
                  {isAr
                    ? `شهور ترتيب قبضك (${payoutMonthsInputs.length} ${payoutMonthsInputs.length > 1 ? 'شهور لـ ' + payoutMonthsInputs.length + ' أسماء' : 'شهر'})`
                    : `Payout Months (${payoutMonthsInputs.length} slots)`}
                </Text>
                
                <View style={{ gap: 8, marginTop: 6 }}>
                  {payoutMonthsInputs.map((val, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.payoutInputPrefix}>
                        {payoutMonthsInputs.length > 1 ? (isAr ? `الاسم الـ ${idx + 1}:` : `Slot #${idx + 1}:`) : (isAr ? 'ترتيب القبض:' : 'Payout Turn:')}
                      </Text>
                      <TextInput
                        style={[styles.textInput, { flex: 1, paddingVertical: 8 }]}
                        placeholder={isAr ? `ترتيب الشهر (مثلاً ${idx === 0 ? 5 : 8})` : `Month index (e.g. ${idx === 0 ? 5 : 8})`}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        value={val}
                        onChangeText={(txt) => {
                          const updated = [...payoutMonthsInputs];
                          updated[idx] = txt;
                          setPayoutMonthsInputs(updated);
                        }}
                      />
                    </View>
                  ))}
                </View>
              </View>

              {/* Live Auto-Calculated Pot Preview */}
              {computedSingleShareVal > 0 && computedTotalMonthsVal > 0 ? (
                <View style={styles.potPreviewBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
                    <Text style={styles.potPreviewLabel}>{isAr ? 'قسطك الشهري الإجمالي:' : 'Your Total Monthly Pay:'}</Text>
                    <Text style={[styles.potPreviewLabel, { color: colors.text, fontWeight: '700' }]}>
                      {formatCurrency(computedMonthlyTotalPay)} {currencySymbol}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
                    <Text style={styles.potPreviewLabel}>{isAr ? 'مبلغ قبض كل اسم في شهره:' : 'Payout per share:'}</Text>
                    <Text style={[styles.potPreviewLabel, { color: colors.income, fontWeight: '700' }]}>
                      {formatCurrency(computedPotPerShare)} {currencySymbol}
                    </Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.border, width: '100%', marginVertical: 6 }} />
                  <Text style={styles.potPreviewLabel}>{isAr ? 'إجمالي ما ستقبضه من الجمعية كاملاً:' : 'Your Total Association Payout:'}</Text>
                  <Text style={styles.potPreviewValue}>
                    {formatCurrency(computedTotalJameyaPayout)} {currencySymbol}
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

              {formError ? (
                <View style={{ backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444450', borderRadius: 12, padding: 10, marginTop: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#EF4444', fontFamily: 'Cairo_700Bold', fontSize: 13, textAlign: 'center' }}>
                    ⚠️ {formError}
                  </Text>
                </View>
              ) : null}

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
              <MaterialCommunityIcons name="piggy-bank" size={42} color={colors.primary} />
              <Text style={styles.confirmTitle}>{isAr ? 'تسديد قسط الجمعية (ادخار)' : 'Save Monthly Installment'}</Text>
              <Text style={styles.confirmText}>
                {isAr
                  ? `سيتم اقتطاع مبلغ (${formatCurrency(payingItem.monthlyAmount)} ${currencySymbol}) وتصنيفه كـ "ادخار جمعية" لحفظ كفايتك وتنمية أصولك دون زيادات وهمية في المصاريف الاستهلاكية.`
                  : `Will record a savings allocation of (${formatCurrency(payingItem.monthlyAmount)} ${currencySymbol}).`}
              </Text>
              <View style={styles.confirmActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setPayingItem(null)}>
                  <Text style={styles.cancelBtnText}>{isAr ? 'إلغاء' : 'Cancel'}</Text>
                </Pressable>
                <Pressable style={styles.confirmBtn} onPress={handleConfirmPayMonth} disabled={isSubmitting}>
                  <Text style={styles.confirmBtnText}>{isAr ? 'تأكيد الاقتطاع الادخاري' : 'Confirm Savings'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {payoutTarget && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <MaterialCommunityIcons name="cash-fast" size={42} color="#0D7C66" />
              <Text style={styles.confirmTitle}>
                {isAr
                  ? `قبض دور الجمعية ${payoutTarget.month ? '(الشهر الـ ' + payoutTarget.month + ')' : ''}`
                  : 'Receive Association Pot'}
              </Text>
              <Text style={styles.confirmText}>
                {isAr
                  ? `حصيلة قبض هذا الدور هي (${formatCurrency(
                      ((payoutTarget.item.singleShareAmount || (payoutTarget.item.monthlyAmount / (payoutTarget.item.sharesCount || 1))) * payoutTarget.item.totalMonths)
                    )} ${currencySymbol}). اختبر كيفية تسجيلها بالمحفظة:`
                  : `Pot payout amount.`}
              </Text>

              {/* Net vs Gross Payout Option Selector */}
              <View style={{ width: '100%', marginVertical: 12, gap: 8 }}>
                <Pressable
                  style={[styles.payoutOptionBox, !deductCurrentInstallment && styles.payoutOptionBoxActive]}
                  onPress={() => setDeductCurrentInstallment(false)}
                >
                  <Ionicons name={!deductCurrentInstallment ? 'radio-button-on' : 'radio-button-off'} size={18} color={!deductCurrentInstallment ? colors.primary : colors.textSecondary} />
                  <Text style={styles.payoutOptionText}>
                    {isAr ? 'قبض الحصيلة الكاملة للأعضاء' : 'Full Pot'} (
                    {formatCurrency(((payoutTarget.item.singleShareAmount || (payoutTarget.item.monthlyAmount / (payoutTarget.item.sharesCount || 1))) * payoutTarget.item.totalMonths))} {currencySymbol})
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
                      ((payoutTarget.item.singleShareAmount || (payoutTarget.item.monthlyAmount / (payoutTarget.item.sharesCount || 1))) * payoutTarget.item.totalMonths) -
                      (payoutTarget.item.singleShareAmount || (payoutTarget.item.monthlyAmount / (payoutTarget.item.sharesCount || 1)))
                    )} {currencySymbol})
                  </Text>
                </Pressable>
              </View>

              <View style={styles.confirmActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setPayoutTarget(null)}>
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
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    addButton: {
      backgroundColor: colors.primary,
      width: 40,
      height: 40,
      borderRadius: 20,
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
    sharesBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: `${colors.primary}15`,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    sharesBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
    iconBtn: { padding: 6 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: 12, padding: 10, marginBottom: 12 },
    statBox: { alignItems: 'center' },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
    statValue: { fontSize: 13, fontWeight: '700', color: colors.text },
    progressContainer: { marginBottom: 12 },
    progressBarBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
    payoutSectionTitle: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
    payoutMonthsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    payoutMonthChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    payoutMonthChipCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
    payoutMonthChipReceived: { backgroundColor: '#0D7C6615', borderColor: '#0D7C6640' },
    payoutMonthChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    payoutMonthChipTextCurrent: { color: '#FFF', fontWeight: '700' },
    payoutMonthChipTextReceived: { color: '#0D7C66', fontWeight: '700' },
    actionsRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', alignItems: 'center' },
    payMonthButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.text,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      flex: 1,
      justifyContent: 'center',
    },
    payMonthButtonText: { color: colors.background, fontSize: 13, fontWeight: '700' },
    badgeSuccess: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0D7C6615', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    badgeSuccessText: { color: '#0D7C66', fontSize: 12, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    inputLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
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
    sharesChipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
    shareChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    shareChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    shareChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    shareChipTextActive: { color: '#FFF', fontWeight: '700' },
    payoutMonthsInputBox: { backgroundColor: colors.background, borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: colors.border },
    payoutMonthsInputBoxTitle: { fontSize: 12, fontWeight: '700', color: colors.text },
    payoutInputPrefix: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, width: 80 },
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
    payoutOptionBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.background,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    payoutOptionBoxActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
    payoutOptionText: { fontSize: 12, color: colors.text, fontWeight: '600', flex: 1 },
  });
}
