import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { useTheme } from '@/lib/ThemeContext';
import { formatCurrency } from '@/lib/categories';
import { getDebts, saveDebt, deleteDebt, recordDebtPayment, Debt } from '@/lib/debtStorage';
import { scheduleDebtReminder, cancelDebtReminder } from '@/lib/NotificationService';
import ConfirmModal from '@/components/ConfirmModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DebtsScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language, t } = useLanguage();
  const { wallets, selectedWallet, addTransaction, currencySymbol } = useTransactions();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [activeTab, setActiveTab] = useState<'debt_to_me' | 'debt_to_others'>('debt_to_me');
  
  // Add / Edit Debt Modal states
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [debtWalletId, setDebtWalletId] = useState(selectedWallet?.id || '');
  const [affectWallet, setAffectWallet] = useState(true);

  // Pay Modal states
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payWalletId, setPayWalletId] = useState(selectedWallet?.id || '');

  // Delete Confirm Modal state
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);

  // Helper for quick date chips
  const setQuickDate = (days: number) => {
    Haptics.selectionAsync();
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().split('T')[0];
    setDueDate(dateStr);
  };

  // Load debts
  const loadDebtsData = async () => {
    const list = await getDebts();
    setDebts(list);
  };

  useEffect(() => {
    loadDebtsData();
  }, []);

  // Filter debts
  const filteredDebts = useMemo(() => {
    return debts.filter(d => d.type === activeTab);
  }, [debts, activeTab]);

  // Statistics
  const totals = useMemo(() => {
    const totalToMe = debts
      .filter(d => d.type === 'debt_to_me' && d.status !== 'paid')
      .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);
    const totalToOthers = debts
      .filter(d => d.type === 'debt_to_others' && d.status !== 'paid')
      .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);
    const countToMe = debts.filter(d => d.type === 'debt_to_me' && d.status !== 'paid').length;
    const countToOthers = debts.filter(d => d.type === 'debt_to_others' && d.status !== 'paid').length;
    return { totalToMe, totalToOthers, countToMe, countToOthers };
  }, [debts]);

  const openAddModal = () => {
    setEditingDebtId(null);
    setPersonName('');
    setAmount('');
    setDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Default 7 days
    setDescription('');
    setDebtWalletId(selectedWallet?.id || (wallets[0]?.id || ''));
    setAffectWallet(true);
    setAddModalVisible(true);
  };

  const openEditModal = (debt: Debt) => {
    Haptics.selectionAsync();
    setEditingDebtId(debt.id);
    setPersonName(debt.personName);
    setAmount(debt.amount.toString());
    setDueDate(debt.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setDescription(debt.description || '');
    setDebtWalletId(debt.walletId);
    setAddModalVisible(true);
  };

  const handleSaveDebt = async () => {
    if (!personName.trim()) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Notice', language === 'ar' ? 'يرجى إدخال اسم الشخص' : 'Please enter person\'s name');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Notice', language === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount');
      return;
    }
    if (!debtWalletId) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Notice', language === 'ar' ? 'يرجى اختيار محفظة' : 'Please select a wallet');
      return;
    }

    const finalDueDate = dueDate.trim() || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (editingDebtId) {
      // Edit existing debt
      const existing = debts.find(d => d.id === editingDebtId);
      if (existing) {
        const updatedDebt: Debt = {
          ...existing,
          personName: personName.trim(),
          amount: numAmount,
          description: description.trim(),
          dueDate: finalDueDate,
          walletId: debtWalletId,
          status: existing.paidAmount >= numAmount ? 'paid' : (existing.paidAmount > 0 ? 'partially_paid' : 'pending'),
        };
        await saveDebt(updatedDebt);
        await scheduleDebtReminder(
          updatedDebt.id,
          updatedDebt.personName,
          updatedDebt.amount - updatedDebt.paidAmount,
          currencySymbol,
          updatedDebt.dueDate,
          updatedDebt.type === 'debt_to_me'
        );
      }
    } else {
      // Create new debt
      const newDebt: Debt = {
        id: Crypto.randomUUID(),
        type: activeTab,
        personName: personName.trim(),
        amount: numAmount,
        paidAmount: 0,
        description: description.trim(),
        dueDate: finalDueDate,
        createdAt: new Date().toISOString(),
        walletId: debtWalletId,
        status: 'pending',
      };
      await saveDebt(newDebt);

      if (affectWallet) {
        const transactionType = activeTab === 'debt_to_me' ? 'expense' : 'income';
        const cat = activeTab === 'debt_to_me' ? 'other_expense' : 'other_income';
        const descAr = activeTab === 'debt_to_me'
          ? `تقديم سلفة لـ ${personName.trim()}`
          : `اقتراض دين من ${personName.trim()}`;
        const descEn = activeTab === 'debt_to_me'
          ? `Loan given to ${personName.trim()}`
          : `Debt borrowed from ${personName.trim()}`;

        await addTransaction({
          id: Crypto.randomUUID(),
          walletId: debtWalletId,
          type: transactionType,
          amount: numAmount,
          category: cat,
          description: language === 'ar' ? descAr : descEn,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
      }

      if (newDebt.dueDate) {
        await scheduleDebtReminder(
          newDebt.id,
          newDebt.personName,
          newDebt.amount,
          currencySymbol,
          newDebt.dueDate,
          newDebt.type === 'debt_to_me'
        );
      }
    }

    setAddModalVisible(false);
    setEditingDebtId(null);
    setPersonName('');
    setAmount('');
    setDueDate('');
    setDescription('');
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadDebtsData();
  };

  const handleRecordPayment = async () => {
    if (!selectedDebt) return;
    const payment = parseFloat(payAmount);
    if (isNaN(payment) || payment <= 0 || payment > (selectedDebt.amount - selectedDebt.paidAmount)) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error', 
        language === 'ar' ? 'يرجى إدخال مبلغ دفع صحيح' : 'Please enter a valid payment amount'
      );
      return;
    }

    const updated = await recordDebtPayment(selectedDebt.id, payment);
    if (updated) {
      if (updated.status === 'paid') {
        await cancelDebtReminder(updated.id);
      }
      // Add corresponding wallet transaction
      const transactionType = selectedDebt.type === 'debt_to_me' ? 'income' : 'expense';
      const descAr = selectedDebt.type === 'debt_to_me'
        ? `استرداد/تحصيل سلفة من ${selectedDebt.personName}`
        : `سداد دين لـ ${selectedDebt.personName}`;
      const descEn = selectedDebt.type === 'debt_to_me'
        ? `Loan collected from ${selectedDebt.personName}`
        : `Debt payment to ${selectedDebt.personName}`;

      await addTransaction({
        id: Crypto.randomUUID(),
        walletId: payWalletId,
        type: transactionType,
        amount: payment,
        category: selectedDebt.type === 'debt_to_me' ? 'other_income' : 'other_expense',
        description: language === 'ar' ? descAr : descEn,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      setPayModalVisible(false);
      setPayAmount('');
      setSelectedDebt(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadDebtsData();
    }
  };

  const handleDeleteDebt = (debt: Debt) => {
    Haptics.selectionAsync();
    setDeletingDebt(debt);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerRow, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <Text style={styles.sheetTitle}>
          {language === 'ar' ? 'إدارة الديون والسلف' : 'Debts & Loans'}
        </Text>
        <Pressable 
          onPress={() => {
            Haptics.selectionAsync();
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }} 
          hitSlop={20}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { borderColor: colors.income + '40', backgroundColor: colors.surface }]}>
          <Text style={styles.summaryLabel}>
            {language === 'ar' ? 'مستحقات لي (سلف)' : 'Owed to Me'}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.income }]}>
            {formatCurrency(totals.totalToMe)} {currencySymbol}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: colors.expense + '40', backgroundColor: colors.surface }]}>
          <Text style={styles.summaryLabel}>
            {language === 'ar' ? 'ديون عليّ (التزامات)' : 'Owed to Others'}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.expense }]}>
            {formatCurrency(totals.totalToOthers)} {currencySymbol}
          </Text>
        </View>
      </View>

      {/* Tabs Toggle */}
      <View style={styles.tabToggle}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('debt_to_me');
          }}
          style={[styles.tabBtn, activeTab === 'debt_to_me' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, activeTab === 'debt_to_me' && styles.tabTextActive]}>
            {language === 'ar' ? `سلف للآخرين (لي) (${totals.countToMe})` : `Owed to Me (${totals.countToMe})`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('debt_to_others');
          }}
          style={[styles.tabBtn, activeTab === 'debt_to_others' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, activeTab === 'debt_to_others' && styles.tabTextActive]}>
            {language === 'ar' ? `ديون عليّ (للآخرين) (${totals.countToOthers})` : `Owed to Others (${totals.countToOthers})`}
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {filteredDebts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              {language === 'ar' ? 'لا توجد التزامات نشطة في القائمة' : 'No active debts found'}
            </Text>
          </View>
        ) : (
          filteredDebts.map((debt) => {
            const remaining = debt.amount - debt.paidAmount;
            const progress = debt.amount > 0 ? (debt.paidAmount / debt.amount) * 100 : 0;
            const wallet = wallets.find(w => w.id === debt.walletId);
            
            return (
              <View key={debt.id} style={styles.debtCard}>
                <View style={styles.debtCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.debtPerson}>{debt.personName}</Text>
                    {debt.description ? (
                      <Text style={styles.debtDesc}>{debt.description}</Text>
                    ) : null}
                  </View>

                  {/* Actions Row: Edit, Pay, Delete */}
                  <View style={styles.actionsRow}>
                    {/* Pay / Collect Button */}
                    {debt.status !== 'paid' && (
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedDebt(debt);
                          setPayAmount(remaining.toString());
                          setPayWalletId(debt.walletId);
                          setPayModalVisible(true);
                        }}
                        style={[styles.payIconBtn, { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10 }]}
                        hitSlop={6}
                      >
                        <Ionicons name="card-outline" size={16} color={colors.primary} />
                        <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.primary }}>
                          {debt.type === 'debt_to_me' ? (language === 'ar' ? 'تحصيل' : 'Collect') : (language === 'ar' ? 'سداد' : 'Pay')}
                        </Text>
                      </Pressable>
                    )}

                    {/* Edit Button (Pencil Icon) */}
                    <Pressable
                      onPress={() => openEditModal(debt)}
                      style={styles.editIconBtn}
                      hitSlop={6}
                    >
                      <Ionicons name="create-outline" size={18} color={colors.accent || '#F59E0B'} />
                    </Pressable>

                    {/* Delete Button (Trash Icon) */}
                    <Pressable
                      onPress={() => handleDeleteDebt(debt)}
                      style={styles.deleteIconBtn}
                      hitSlop={6}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.expense} />
                    </Pressable>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>
                      {language === 'ar' ? 'مسدد:' : 'Paid:'} {formatCurrency(debt.paidAmount)} / {formatCurrency(debt.amount)} {currencySymbol}
                    </Text>
                    <Text style={[styles.statusBadge, 
                      debt.status === 'paid' && styles.statusPaid,
                      debt.status === 'partially_paid' && styles.statusPartial
                    ]}>
                      {debt.status === 'paid' ? (language === 'ar' ? 'تم السداد' : 'Paid') : 
                       debt.status === 'partially_paid' ? (language === 'ar' ? 'مسدد جزئياً' : 'Partial') :
                       (language === 'ar' ? 'معلق' : 'Pending')}
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: activeTab === 'debt_to_me' ? colors.income : colors.expense }]} />
                  </View>
                </View>

                <View style={styles.debtFooter}>
                  <Text style={styles.dueDateText}>
                    📅 {language === 'ar' ? 'تاريخ الاستحقاق:' : 'Due:'} {debt.dueDate}
                  </Text>
                  {wallet && (
                    <Text style={[styles.walletLabel, { color: wallet.color }]}>
                      💳 {wallet.name}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <Pressable
        onPress={() => {
          if (wallets.length === 0) {
            Alert.alert(language === 'ar' ? 'تنبيه' : 'Notice', language === 'ar' ? 'يجب إنشاء محفظة أولاً' : 'Please create a wallet first');
            return;
          }
          openAddModal();
        }}
        style={styles.floatingAddBtn}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Add / Edit Debt Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingDebtId 
                  ? (activeTab === 'debt_to_me' ? (language === 'ar' ? 'تعديل بيانات السلفة' : 'Edit Loan') : (language === 'ar' ? 'تعديل بيانات الدين' : 'Edit Debt'))
                  : (activeTab === 'debt_to_me' ? (language === 'ar' ? 'إضافة سلفة جديدة للآخرين' : 'Add Loan') : (language === 'ar' ? 'إضافة دين جديد عليّ' : 'Add Debt'))
                }
              </Text>
              <Pressable onPress={() => setAddModalVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'الاسم الشخصي' : 'Person Name'}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={language === 'ar' ? 'اسم الشخص أو الجهة...' : 'Name...'}
                  placeholderTextColor={colors.textTertiary}
                  value={personName}
                  onChangeText={setPersonName}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{t.amount} ({currencySymbol})</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>

              {/* Simplified Date Selection Section */}
              <View style={styles.formField}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.formLabel}>{language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</Text>
                  <Text style={styles.dateHelper}>{dueDate || (language === 'ar' ? 'غير محدد' : 'Not set')}</Text>
                </View>

                {/* Quick Date Choice Chips */}
                <View style={styles.quickDateChipsRow}>
                  <Pressable style={styles.quickDateChip} onPress={() => setQuickDate(7)}>
                    <Text style={styles.quickDateChipText}>{language === 'ar' ? '⚡ بعد أسبوع' : '⚡ 1 Week'}</Text>
                  </Pressable>
                  <Pressable style={styles.quickDateChip} onPress={() => setQuickDate(14)}>
                    <Text style={styles.quickDateChipText}>{language === 'ar' ? '⚡ أسبوعين' : '⚡ 2 Weeks'}</Text>
                  </Pressable>
                  <Pressable style={styles.quickDateChip} onPress={() => setQuickDate(30)}>
                    <Text style={styles.quickDateChipText}>{language === 'ar' ? '⚡ بعد شهر' : '⚡ 1 Month'}</Text>
                  </Pressable>
                  <Pressable style={styles.quickDateChip} onPress={() => setQuickDate(90)}>
                    <Text style={styles.quickDateChipText}>{language === 'ar' ? '⚡ 3 أشهر' : '⚡ 3 Months'}</Text>
                  </Pressable>
                </View>

                {/* Direct TextInput formatted date */}
                <TextInput
                  style={[styles.modalInput, { marginTop: 8 }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  value={dueDate}
                  onChangeText={setDueDate}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{t.noteOptional}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t.notePlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'المحفظة المرتبطة' : 'Linked Wallet'}</Text>
                <View style={styles.walletsRow}>
                  {wallets.map(w => (
                    <Pressable
                      key={w.id}
                      onPress={() => setDebtWalletId(w.id)}
                      style={[
                        styles.walletSelectorCard,
                        debtWalletId === w.id && { borderColor: w.color, borderWidth: 2 }
                      ]}
                    >
                      <MaterialIcons name={w.icon as any} size={16} color={w.color} />
                      <Text style={[styles.walletSelectorText, debtWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                        {w.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {!editingDebtId && (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setAffectWallet(!affectWallet);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: colors.surfaceAlt,
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: affectWallet ? colors.primary : colors.border,
                  }}
                >
                  <View style={{ flex: 1, paddingEnd: 8 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text, textAlign: 'left' }}>
                      {language === 'ar'
                        ? (activeTab === 'debt_to_me' ? 'خصم المبلغ فوراً من المحفظة' : 'إضافة المبلغ فوراً للمحفظة')
                        : (activeTab === 'debt_to_me' ? 'Deduct amount from wallet now' : 'Add amount to wallet now')}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: 'left' }}>
                      {language === 'ar'
                        ? (activeTab === 'debt_to_me' ? 'تسجيل معاملة خروج مال عند تقديم السلفة' : 'تسجيل معاملة دخول مال عند الاستدانة')
                        : 'Record wallet cashflow transaction'}
                    </Text>
                  </View>
                  <Ionicons
                    name={affectWallet ? "checkbox" : "square-outline"}
                    size={22}
                    color={affectWallet ? colors.primary : colors.textTertiary}
                  />
                </Pressable>
              )}

              <Pressable
                onPress={handleSaveDebt}
                style={[styles.saveBtn, { backgroundColor: activeTab === 'debt_to_me' ? colors.income : colors.expense }]}
              >
                <Text style={styles.saveBtnText}>
                  {editingDebtId ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : t.save}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Record Payment Modal */}
      <Modal visible={payModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'ar'
                  ? (selectedDebt?.type === 'debt_to_me' ? 'تسجيل تحصيل / استرداد سلفة' : 'تسجيل سداد دين')
                  : (selectedDebt?.type === 'debt_to_me' ? 'Collect Loan Repayment' : 'Pay Off Debt')
                }
              </Text>
              <Pressable onPress={() => setPayModalVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              {selectedDebt && (
                <View style={{ marginBottom: 12, backgroundColor: colors.surfaceAlt + '80', padding: 10, borderRadius: 10 }}>
                  <Text style={styles.payHeaderSub}>
                    {language === 'ar' ? 'إجمالي المستحق:' : 'Total:'} {formatCurrency(selectedDebt.amount)} | {language === 'ar' ? 'المتبقي:' : 'Remaining:'} {formatCurrency(selectedDebt.amount - selectedDebt.paidAmount)} {currencySymbol}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.primary, marginTop: 4, textAlign: 'left' }}>
                    💡 {language === 'ar'
                      ? (selectedDebt.type === 'debt_to_me' ? 'سيعاد المبلغ المكتوب إلى محفظتك كدخول مال.' : 'سيتم خصم المبلغ المكتوب من محفظتك كخروج مال.')
                      : (selectedDebt.type === 'debt_to_me' ? 'Collected amount will be added to your wallet.' : 'Payment amount will be deducted from your wallet.')}
                  </Text>
                </View>
              )}

              <View style={styles.formField}>
                <Text style={styles.formLabel}>
                  {language === 'ar'
                    ? (selectedDebt?.type === 'debt_to_me' ? 'مبلغ التحصيل' : 'مبلغ السداد')
                    : 'Payment Amount'
                  }
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={payAmount}
                  onChangeText={setPayAmount}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>
                  {language === 'ar'
                    ? (selectedDebt?.type === 'debt_to_me' ? 'إيداع إلى محفظة' : 'سداد من محفظة')
                    : 'Target Wallet'
                  }
                </Text>
                <View style={styles.walletsRow}>
                  {wallets.map(w => (
                    <Pressable
                      key={w.id}
                      onPress={() => setPayWalletId(w.id)}
                      style={[
                        styles.walletSelectorCard,
                        payWalletId === w.id && { borderColor: w.color, borderWidth: 2 }
                      ]}
                    >
                      <MaterialIcons name={w.icon as any} size={16} color={w.color} />
                      <Text style={[styles.walletSelectorText, payWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                        {w.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={handleRecordPayment}
                style={[styles.saveBtn, { backgroundColor: selectedDebt?.type === 'debt_to_me' ? colors.income : colors.primary }]}
              >
                <Text style={styles.saveBtnText}>
                  {language === 'ar'
                    ? (selectedDebt?.type === 'debt_to_me' ? 'تأكيد تحصيل السلفة 📥' : 'تأكيد سداد الدين 📤')
                    : (selectedDebt?.type === 'debt_to_me' ? 'Confirm Collection' : 'Confirm Payment')
                  }
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={!!deletingDebt}
        title={language === 'ar' ? (deletingDebt?.type === 'debt_to_me' ? 'حذف السلفة' : 'حذف الدين') : 'Delete Record'}
        message={
          deletingDebt
            ? (language === 'ar'
                ? `هل أنت متأكد من حذف ${deletingDebt.type === 'debt_to_me' ? 'سلفة' : 'دين'} "${deletingDebt.personName}" بمبلغ ${formatCurrency(deletingDebt.amount)} ${currencySymbol}؟`
                : `Are you sure you want to delete ${deletingDebt.personName}'s record?`)
            : ''
        }
        confirmText={language === 'ar' ? 'حذف' : 'Delete'}
        cancelText={language === 'ar' ? 'إلغاء' : 'Cancel'}
        isDestructive
        onConfirm={async () => {
          if (deletingDebt) {
            await deleteDebt(deletingDebt.id);
            await cancelDebtReminder(deletingDebt.id);
            setDeletingDebt(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            loadDebtsData();
          }
        }}
        onCancel={() => setDeletingDebt(null)}
      />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.text,
    fontFamily: 'Cairo_700Bold',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 12,
  },
  debtCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debtCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  debtPerson: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
    textAlign: 'left',
  },
  debtDesc: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'left',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.primary + '12',
  },
  editIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: (colors.accent || '#F59E0B') + '15',
  },
  deleteIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.expense + '12',
  },
  quickDateChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  quickDateChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderLight || colors.border,
  },
  quickDateChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
  },
  dateHelper: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
  },
  progressContainer: {
    marginTop: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBadge: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
    color: colors.textSecondary,
    overflow: 'hidden',
  },
  statusPaid: {
    backgroundColor: colors.income + '18',
    color: colors.income,
  },
  statusPartial: {
    backgroundColor: colors.primary + '18',
    color: colors.primary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  debtFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  dueDateText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textTertiary,
  },
  walletLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  floatingAddBtn: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  modalForm: {
    padding: 20,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    textAlign: 'left',
  },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
  },
  walletsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  walletSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  walletSelectorText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#fff',
  },
  payHeaderSub: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: colors.surfaceAlt,
    padding: 10,
    borderRadius: 10,
  },
});
