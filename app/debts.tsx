import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { useTheme } from '@/lib/ThemeContext';
import { formatCurrency } from '@/lib/categories';
import { getDebts, saveDebt, deleteDebt, recordDebtPayment, Debt } from '@/lib/debtStorage';
import { scheduleDebtReminder, cancelDebtReminder } from '@/lib/NotificationService';
import ConfirmModal from '@/components/ConfirmModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Generate pleasant initials avatar color
const getAvatarColor = (name: string) => {
  const colorsList = [
    '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', 
    '#06B6D4', '#6366F1', '#14B8A6', '#F97316'
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorsList[Math.abs(hash) % colorsList.length];
};

const getInitials = (name: string) => {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
};

export default function DebtsScreen() {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const { language, t } = useLanguage();
  const isAr = language === 'ar';
  const { wallets, selectedWallet, addTransaction, currencySymbol } = useTransactions();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [activeTab, setActiveTab] = useState<'debt_to_me' | 'debt_to_others'>('debt_to_me');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  
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
  const loadDebtsData = useCallback(async () => {
    const list = await getDebts();
    setDebts(list);
  }, []);

  useEffect(() => {
    loadDebtsData();
  }, [loadDebtsData]);

  // Statistics
  const totals = useMemo(() => {
    const activeToMe = debts.filter(d => d.type === 'debt_to_me' && d.status !== 'paid');
    const activeToOthers = debts.filter(d => d.type === 'debt_to_others' && d.status !== 'paid');

    const totalToMe = activeToMe.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);
    const totalToOthers = activeToOthers.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);
    const countToMe = activeToMe.length;
    const countToOthers = activeToOthers.length;

    // Overall total debts recorded
    const allDebtsTotal = debts.reduce((sum, d) => sum + d.amount, 0);
    const allPaidTotal = debts.reduce((sum, d) => sum + d.paidAmount, 0);
    const overallProgress = allDebtsTotal > 0 ? Math.round((allPaidTotal / allDebtsTotal) * 100) : 0;

    // Net balance
    const netBalance = totalToMe - totalToOthers;

    // Find upcoming due debt
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingDebts = debts
      .filter(d => d.status !== 'paid' && d.dueDate)
      .map(d => {
        const due = new Date(d.dueDate);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...d, diffDays };
      })
      .sort((a, b) => a.diffDays - b.diffDays);

    const nearestDue = upcomingDebts.length > 0 ? upcomingDebts[0] : null;

    return { 
      totalToMe, 
      totalToOthers, 
      countToMe, 
      countToOthers, 
      netBalance, 
      overallProgress, 
      nearestDue,
      totalActive: countToMe + countToOthers,
    };
  }, [debts]);

  // Filtered debts based on active tab and status filter
  const filteredDebts = useMemo(() => {
    return debts.filter(d => {
      if (d.type !== activeTab) return false;
      if (statusFilter === 'pending') return d.status !== 'paid';
      if (statusFilter === 'paid') return d.status === 'paid';
      return true;
    });
  }, [debts, activeTab, statusFilter]);

  const openAddModal = () => {
    Haptics.selectionAsync();
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
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إدخال اسم الشخص' : 'Please enter person\'s name');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount');
      return;
    }
    if (!debtWalletId) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى اختيار محفظة' : 'Please select a wallet');
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
          category: 'debt_loan',
          description: isAr ? descAr : descEn,
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
        isAr ? 'خطأ' : 'Error', 
        isAr ? 'يرجى إدخال مبلغ دفع صحيح' : 'Please enter a valid payment amount'
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
        category: 'debt_loan',
        description: isAr ? descAr : descEn,
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

  // Quick helper for due status chip
  const getDueBadge = (debt: Debt) => {
    if (debt.status === 'paid') {
      return {
        text: isAr ? 'تمت التسوية بالكامل ✨' : 'Settled in Full ✨',
        color: '#10B981',
        bg: '#10B98118',
        icon: 'checkmark-done-circle',
      };
    }
    if (!debt.dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(debt.dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: isAr ? `متأخر منذ ${Math.abs(diffDays)} يوم ⚠️` : `Overdue by ${Math.abs(diffDays)}d ⚠️`,
        color: '#EF4444',
        bg: '#EF44441A',
        icon: 'alert-circle',
      };
    } else if (diffDays === 0) {
      return {
        text: isAr ? 'مستحق اليوم! 🔔' : 'Due Today! 🔔',
        color: '#F59E0B',
        bg: '#F59E0B1A',
        icon: 'notifications',
      };
    } else if (diffDays <= 7) {
      return {
        text: isAr ? `متبقي ${diffDays} أيام ⏱️` : `${diffDays} days left ⏱️`,
        color: '#3B82F6',
        bg: '#3B82F618',
        icon: 'time',
      };
    } else {
      return {
        text: isAr ? `الاستحقاق: ${debt.dueDate}` : `Due: ${debt.dueDate}`,
        color: colors.textSecondary,
        bg: colors.surfaceAlt,
        icon: 'calendar-outline',
      };
    }
  };

  return (
    <View style={styles.container}>
      {/* Sleek App Header */}
      <View style={[styles.headerRow, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          style={styles.headerBackBtn}
          hitSlop={15}
        >
          <Ionicons name={isAr ? "chevron-forward" : "chevron-back"} size={22} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isAr ? 'إدارة الديون والسلف' : 'Debts & Loans'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {isAr ? 'سجل السلف والالتزامات المالية بدقة' : 'Track your personal debts & receivables'}
          </Text>
        </View>

        <Pressable
          onPress={openAddModal}
          hitSlop={12}
          style={[styles.headerAddBtn, { backgroundColor: activeTab === 'debt_to_me' ? '#10B981' : '#6366F1' }]}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 90 }]}
      >
        {/* Executive Summary Hero Banner (Like Jameya) */}
        <LinearGradient
          colors={
            theme === 'dark'
              ? (activeTab === 'debt_to_me' ? ['#064E3B', '#0F2922', '#0A1128'] : ['#1E1B4B', '#111827', '#0A1128'])
              : (activeTab === 'debt_to_me' ? ['#ECFDF5', '#D1FAE5', '#EFF6FF'] : ['#EEF2FF', '#E0E7FF', '#F8FAFC'])
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.heroPositionBadge}>
                <Ionicons
                  name={totals.netBalance >= 0 ? "trending-up" : "trending-down"}
                  size={14}
                  color={totals.netBalance >= 0 ? '#10B981' : '#EF4444'}
                />
                <Text
                  style={[
                    styles.heroPositionText,
                    { color: totals.netBalance >= 0 ? (theme === 'dark' ? '#34D399' : '#059669') : '#EF4444' },
                  ]}
                >
                  {totals.netBalance >= 0
                    ? (isAr ? 'صافي مستحقات لك فائضة' : 'Net Surplus in Your Favor')
                    : (isAr ? 'صافي التزامات عليك سدادها' : 'Net Debt Payable')}
                </Text>
              </View>

              <Text style={[styles.heroMainAmount, { color: theme === 'dark' ? '#FFF' : '#1E293B' }]}>
                {formatCurrency(Math.abs(totals.netBalance))} <Text style={styles.heroCurrencySymbol}>{currencySymbol}</Text>
              </Text>
            </View>

            <View style={[styles.heroIconBadge, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)' }]}>
              <MaterialCommunityIcons
                name="scale-balance"
                size={30}
                color={activeTab === 'debt_to_me' ? '#10B981' : '#6366F1'}
              />
            </View>
          </View>

          {/* Sub Metrics Grid (3 Pill Cards) */}
          <View style={styles.heroSubGrid}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab('debt_to_me');
              }}
              style={[
                styles.heroSubCard,
                {
                  backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)',
                  borderColor: activeTab === 'debt_to_me' ? '#10B98180' : 'transparent',
                  borderWidth: activeTab === 'debt_to_me' ? 1.5 : 0,
                },
              ]}
            >
              <View style={styles.heroSubCardHeader}>
                <Ionicons name="arrow-down-circle" size={14} color="#10B981" />
                <Text style={styles.heroSubLabel}>{isAr ? 'سلف للآخرين (لي)' : 'Owed to Me'}</Text>
              </View>
              <Text style={[styles.heroSubVal, { color: '#10B981' }]}>
                {formatCurrency(totals.totalToMe)} <Text style={{ fontSize: 10 }}>{currencySymbol}</Text>
              </Text>
              <Text style={styles.heroSubCount}>
                {totals.countToMe} {isAr ? 'سلفة نشطة' : 'active'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab('debt_to_others');
              }}
              style={[
                styles.heroSubCard,
                {
                  backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)',
                  borderColor: activeTab === 'debt_to_others' ? '#EF444480' : 'transparent',
                  borderWidth: activeTab === 'debt_to_others' ? 1.5 : 0,
                },
              ]}
            >
              <View style={styles.heroSubCardHeader}>
                <Ionicons name="arrow-up-circle" size={14} color="#EF4444" />
                <Text style={styles.heroSubLabel}>{isAr ? 'ديون عليّ' : 'Owed to Others'}</Text>
              </View>
              <Text style={[styles.heroSubVal, { color: '#EF4444' }]}>
                {formatCurrency(totals.totalToOthers)} <Text style={{ fontSize: 10 }}>{currencySymbol}</Text>
              </Text>
              <Text style={styles.heroSubCount}>
                {totals.countToOthers} {isAr ? 'دين نشط' : 'active'}
              </Text>
            </Pressable>

            <View
              style={[
                styles.heroSubCard,
                { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' },
              ]}
            >
              <View style={styles.heroSubCardHeader}>
                <Ionicons name="checkmark-done-circle" size={14} color="#6366F1" />
                <Text style={styles.heroSubLabel}>{isAr ? 'نسبة السداد' : 'Settled'}</Text>
              </View>
              <Text style={[styles.heroSubVal, { color: '#6366F1' }]}>
                {totals.overallProgress}%
              </Text>
              <Text style={styles.heroSubCount}>
                {totals.totalActive} {isAr ? 'مجموع المعلق' : 'pending total'}
              </Text>
            </View>
          </View>

          {/* Upcoming Due Reminder Banner */}
          {totals.nearestDue && (
            <View style={styles.heroNoticeTag}>
              <Ionicons
                name={totals.nearestDue.diffDays < 0 ? "alert-circle" : "sparkles"}
                size={16}
                color={totals.nearestDue.diffDays < 0 ? "#EF4444" : "#F59E0B"}
              />
              <Text style={styles.heroNoticeText} numberOfLines={1}>
                {isAr
                  ? (totals.nearestDue.diffDays < 0
                      ? `تنبيه: سلفة/دين "${totals.nearestDue.personName}" متأخرة منذ ${Math.abs(totals.nearestDue.diffDays)} يوم (${formatCurrency(totals.nearestDue.amount - totals.nearestDue.paidAmount)} ${currencySymbol})`
                      : `أقرب استحقاق: لـ "${totals.nearestDue.personName}" بمبلغ ${formatCurrency(totals.nearestDue.amount - totals.nearestDue.paidAmount)} ${currencySymbol} (${totals.nearestDue.diffDays === 0 ? 'اليوم!' : `بعد ${totals.nearestDue.diffDays} أيام`})`)
                  : (totals.nearestDue.diffDays < 0
                      ? `Overdue: "${totals.nearestDue.personName}" by ${Math.abs(totals.nearestDue.diffDays)}d (${formatCurrency(totals.nearestDue.amount - totals.nearestDue.paidAmount)} ${currencySymbol})`
                      : `Next Due: "${totals.nearestDue.personName}" (${formatCurrency(totals.nearestDue.amount - totals.nearestDue.paidAmount)} ${currencySymbol}) in ${totals.nearestDue.diffDays}d`)}
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Action Shortcut Banner: Create New Debt/Loan (Like Jameya) */}
        <Pressable
          onPress={openAddModal}
          style={({ pressed }) => [
            styles.createActionBanner,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={styles.createActionLeft}>
            <View style={[styles.createActionIcon, { backgroundColor: activeTab === 'debt_to_me' ? '#10B98118' : '#6366F118' }]}>
              <Ionicons
                name="add-circle"
                size={26}
                color={activeTab === 'debt_to_me' ? '#10B981' : '#6366F1'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.createActionTitle, { color: colors.text }]}>
                {isAr
                  ? (activeTab === 'debt_to_me' ? 'تسجيل سلفة جديدة للآخرين' : 'تسجيل دين جديد عليّ')
                  : (activeTab === 'debt_to_me' ? 'Record New Loan to Someone' : 'Record New Debt to Pay')}
              </Text>
              <Text style={[styles.createActionSubtitle, { color: colors.textSecondary }]}>
                {isAr ? 'سجل الطرف الآخر، المبلغ، وتاريخ الاستحقاق' : 'Set person, amount, due date & wallet'}
              </Text>
            </View>
          </View>
          <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textTertiary} />
        </Pressable>

        {/* Modern Segmented Navigation Tabs */}
        <View style={styles.tabToggle}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('debt_to_me');
            }}
            style={[styles.tabBtn, activeTab === 'debt_to_me' && styles.tabBtnActive]}
          >
            <Ionicons
              name="arrow-down-circle"
              size={16}
              color={activeTab === 'debt_to_me' ? '#10B981' : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'debt_to_me' && { color: colors.text, fontFamily: 'Cairo_700Bold' }]}>
              {isAr ? 'سلف للآخرين (لي)' : 'Owed to Me'}
            </Text>
            <View style={[styles.tabBadge, { backgroundColor: activeTab === 'debt_to_me' ? '#10B98120' : colors.surfaceAlt }]}>
              <Text style={[styles.tabBadgeText, { color: activeTab === 'debt_to_me' ? '#10B981' : colors.textTertiary }]}>
                {totals.countToMe}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('debt_to_others');
            }}
            style={[styles.tabBtn, activeTab === 'debt_to_others' && styles.tabBtnActive]}
          >
            <Ionicons
              name="arrow-up-circle"
              size={16}
              color={activeTab === 'debt_to_others' ? '#EF4444' : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'debt_to_others' && { color: colors.text, fontFamily: 'Cairo_700Bold' }]}>
              {isAr ? 'ديون عليّ' : 'Owed to Others'}
            </Text>
            <View style={[styles.tabBadge, { backgroundColor: activeTab === 'debt_to_others' ? '#EF444420' : colors.surfaceAlt }]}>
              <Text style={[styles.tabBadgeText, { color: activeTab === 'debt_to_others' ? '#EF4444' : colors.textTertiary }]}>
                {totals.countToOthers}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Status Filters Bar (All / Pending / Paid) */}
        <View style={styles.filterChipsRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setStatusFilter('all');
            }}
            style={[
              styles.filterChip,
              statusFilter === 'all' && [styles.filterChipActive, { backgroundColor: colors.surfaceAlt, borderColor: colors.primary }],
            ]}
          >
            <Text style={[styles.filterChipText, statusFilter === 'all' && { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>
              {isAr ? 'الكل' : 'All'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setStatusFilter('pending');
            }}
            style={[
              styles.filterChip,
              statusFilter === 'pending' && [styles.filterChipActive, { backgroundColor: colors.surfaceAlt, borderColor: '#F59E0B' }],
            ]}
          >
            <Text style={[styles.filterChipText, statusFilter === 'pending' && { color: '#F59E0B', fontFamily: 'Cairo_700Bold' }]}>
              {isAr ? '⏳ قيد الانتظار' : '⏳ Pending'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setStatusFilter('paid');
            }}
            style={[
              styles.filterChip,
              statusFilter === 'paid' && [styles.filterChipActive, { backgroundColor: colors.surfaceAlt, borderColor: '#10B981' }],
            ]}
          >
            <Text style={[styles.filterChipText, statusFilter === 'paid' && { color: '#10B981', fontFamily: 'Cairo_700Bold' }]}>
              {isAr ? '✅ مكتمل السداد' : '✅ Paid'}
            </Text>
          </Pressable>
        </View>

        {/* List Section Heading */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            {activeTab === 'debt_to_me' ? (isAr ? 'قائمة السلف المستحقة لي' : 'Loans to Others') : (isAr ? 'قائمة الالتزامات والديون' : 'Debts Payable')}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            ({filteredDebts.length})
          </Text>
        </View>

        {/* Debts List */}
        {filteredDebts.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceAlt }]}>
              <MaterialCommunityIcons
                name={activeTab === 'debt_to_me' ? "hand-coin-outline" : "credit-card-clock-outline"}
                size={48}
                color={colors.textTertiary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {isAr
                ? (activeTab === 'debt_to_me' ? 'لا توجد سلف مسجلة حالياً' : 'لا توجد ديون مسجلة حالياً')
                : 'No Records Found'}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {isAr
                ? (activeTab === 'debt_to_me'
                    ? 'قم بتسجيل السلف والأموال التي قدمتها للآخرين لتتبع مواعيد السداد والتحصيل بدقة.'
                    : 'سجل ديونك والتزاماتك للآخرين لتحصل على تنبيهات السداد وتحافظ على استقرار ميزانيتك.')
                : 'Keep your finances organized by tracking loans and payables with smart due reminders.'}
            </Text>
            <Pressable
              onPress={openAddModal}
              style={[styles.emptyBtn, { backgroundColor: activeTab === 'debt_to_me' ? '#10B981' : '#6366F1' }]}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.emptyBtnText}>
                {isAr
                  ? (activeTab === 'debt_to_me' ? 'إضافة سلفة جديدة' : 'إضافة دين جديد')
                  : 'Add Record'}
              </Text>
            </Pressable>
          </View>
        ) : (
          filteredDebts.map((debt) => {
            const remaining = debt.amount - debt.paidAmount;
            const progress = debt.amount > 0 ? Math.min(100, Math.round((debt.paidAmount / debt.amount) * 100)) : 0;
            const isFullyPaid = debt.status === 'paid' || remaining <= 0;
            const wallet = wallets.find(w => w.id === debt.walletId);
            const dueBadge = getDueBadge(debt);
            const avatarBg = getAvatarColor(debt.personName);
            const initials = getInitials(debt.personName);

            return (
              <View
                key={debt.id}
                style={[
                  styles.debtCard,
                  { backgroundColor: colors.card, borderColor: isFullyPaid ? '#10B98140' : colors.border },
                ]}
              >
                {/* Card Top Row: Person Avatar & Info, Actions */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.avatarCircle, { backgroundColor: avatarBg }]}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.debtPerson, { color: colors.text }]} numberOfLines={1}>
                        {debt.personName}
                      </Text>
                      {debt.description ? (
                        <Text style={[styles.debtDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                          {debt.description}
                        </Text>
                      ) : (
                        <Text style={[styles.debtDesc, { color: colors.textTertiary }]}>
                          {debt.type === 'debt_to_me' ? (isAr ? 'سلفة للغير' : 'Loan to Person') : (isAr ? 'التزام مالي' : 'Personal Debt')}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.cardHeaderRight}>
                    {/* Status Pill Badge */}
                    {isFullyPaid ? (
                      <View style={[styles.statusBadge, { backgroundColor: '#10B98118' }]}>
                        <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                        <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>
                          {isAr ? 'مكتمل' : 'Paid'}
                        </Text>
                      </View>
                    ) : debt.paidAmount > 0 ? (
                      <View style={[styles.statusBadge, { backgroundColor: '#F59E0B18' }]}>
                        <Ionicons name="time" size={12} color="#F59E0B" />
                        <Text style={[styles.statusBadgeText, { color: '#F59E0B' }]}>
                          {isAr ? 'جزئي' : 'Partial'}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: activeTab === 'debt_to_me' ? '#10B98115' : '#EF444415' }]}>
                        <Ionicons name="hourglass-outline" size={12} color={activeTab === 'debt_to_me' ? '#10B981' : '#EF4444'} />
                        <Text style={[styles.statusBadgeText, { color: activeTab === 'debt_to_me' ? '#10B981' : '#EF4444' }]}>
                          {isAr ? 'معلق' : 'Pending'}
                        </Text>
                      </View>
                    )}

                    {/* Edit Action Button */}
                    <Pressable
                      onPress={() => openEditModal(debt)}
                      style={[styles.cardIconBtn, { backgroundColor: colors.surfaceAlt }]}
                      hitSlop={8}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                    </Pressable>

                    {/* Delete Action Button */}
                    <Pressable
                      onPress={() => handleDeleteDebt(debt)}
                      style={[styles.cardIconBtn, { backgroundColor: '#EF444415' }]}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>

                {/* Financial 3-Pill Breakdown Grid (Like Jameya) */}
                <View style={[styles.cardMetricsGrid, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={styles.cardMetricItem}>
                    <Text style={[styles.cardMetricLabel, { color: colors.textSecondary }]}>
                      {isAr ? 'المبلغ الأصلي' : 'Original Total'}
                    </Text>
                    <Text style={[styles.cardMetricValue, { color: colors.text }]}>
                      {formatCurrency(debt.amount)} <Text style={{ fontSize: 10 }}>{currencySymbol}</Text>
                    </Text>
                  </View>

                  <View style={styles.cardMetricItem}>
                    <Text style={[styles.cardMetricLabel, { color: colors.textSecondary }]}>
                      {isAr ? 'المسدد حتى الآن' : 'Paid So Far'}
                    </Text>
                    <Text style={[styles.cardMetricValue, { color: isFullyPaid ? '#10B981' : colors.primary }]}>
                      {formatCurrency(debt.paidAmount)} <Text style={{ fontSize: 10 }}>{currencySymbol}</Text>
                    </Text>
                  </View>

                  <View style={styles.cardMetricItem}>
                    <Text style={[styles.cardMetricLabel, { color: colors.textSecondary }]}>
                      {isAr ? 'المتبقي' : 'Remaining'}
                    </Text>
                    <Text
                      style={[
                        styles.cardMetricValue,
                        { color: isFullyPaid ? '#10B981' : (activeTab === 'debt_to_me' ? '#10B981' : '#EF4444'), fontFamily: 'Cairo_700Bold' },
                      ]}
                    >
                      {formatCurrency(Math.max(0, remaining))} <Text style={{ fontSize: 10 }}>{currencySymbol}</Text>
                    </Text>
                  </View>
                </View>

                {/* Visual Progress Bar Section */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                      {isAr ? 'نسبة السداد:' : 'Settlement:'} {progress}%
                    </Text>
                    <Text style={[styles.progressDetail, { color: colors.textTertiary }]}>
                      {formatCurrency(debt.paidAmount)} / {formatCurrency(debt.amount)} {currencySymbol}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: colors.borderLight || colors.surfaceAlt }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progress}%`,
                          backgroundColor: isFullyPaid
                            ? '#10B981'
                            : (activeTab === 'debt_to_me' ? '#10B981' : '#6366F1'),
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Footer: Due date pill and Wallet Badge */}
                <View style={[styles.debtFooter, { borderTopColor: colors.border }]}>
                  {dueBadge && (
                    <View style={[styles.footerPill, { backgroundColor: dueBadge.bg }]}>
                      <Ionicons name={dueBadge.icon as any} size={13} color={dueBadge.color} />
                      <Text style={[styles.footerPillText, { color: dueBadge.color }]}>
                        {dueBadge.text}
                      </Text>
                    </View>
                  )}

                  {wallet && (
                    <View style={[styles.footerPill, { backgroundColor: colors.surfaceAlt }]}>
                      <MaterialIcons name={wallet.icon as any} size={13} color={wallet.color} />
                      <Text style={[styles.footerPillText, { color: colors.textSecondary }]}>
                        {wallet.name}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Prominent Quick Action Button (Collect / Pay) */}
                {!isFullyPaid ? (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedDebt(debt);
                      setPayAmount(remaining.toString());
                      setPayWalletId(debt.walletId);
                      setPayModalVisible(true);
                    }}
                    style={({ pressed }) => [
                      styles.mainActionBtn,
                      {
                        backgroundColor: activeTab === 'debt_to_me' ? '#10B981' : '#6366F1',
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={activeTab === 'debt_to_me' ? "cash-outline" : "card-outline"}
                      size={18}
                      color="#FFF"
                    />
                    <Text style={styles.mainActionBtnText}>
                      {activeTab === 'debt_to_me'
                        ? (isAr ? `تحصيل دفعة / استرداد (${formatCurrency(remaining)} ${currencySymbol})` : `Collect Repayment (${formatCurrency(remaining)} ${currencySymbol})`)
                        : (isAr ? `سداد دفعة من الدين (${formatCurrency(remaining)} ${currencySymbol})` : `Pay Installment (${formatCurrency(remaining)} ${currencySymbol})`)}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={[styles.settledBanner, { backgroundColor: '#10B98112' }]}>
                    <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                    <Text style={styles.settledBannerText}>
                      {isAr ? 'تمت تصفية وتسوية هذا الالتزام بالكامل 🤝' : 'This debt has been settled completely 🤝'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Add Button (FAB) */}
      <Pressable
        onPress={() => {
          if (wallets.length === 0) {
            Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يجب إنشاء محفظة أولاً' : 'Please create a wallet first');
            return;
          }
          openAddModal();
        }}
        style={[
          styles.floatingAddBtn,
          { backgroundColor: activeTab === 'debt_to_me' ? '#10B981' : '#6366F1', bottom: Math.max(insets.bottom + 20, 30) },
        ]}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </Pressable>

      {/* Add / Edit Debt Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingDebtId 
                    ? (activeTab === 'debt_to_me' ? (isAr ? 'تعديل بيانات السلفة' : 'Edit Loan') : (isAr ? 'تعديل بيانات الدين' : 'Edit Debt'))
                    : (activeTab === 'debt_to_me' ? (isAr ? 'إضافة سلفة جديدة للآخرين' : 'Add Loan to Someone') : (isAr ? 'إضافة دين جديد عليّ' : 'Add Debt Payable'))
                  }
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                  {isAr ? 'يرجى إدخال التفاصيل بدقة لحساب الميزانية' : 'Enter accurate details to track cashflow'}
                </Text>
              </View>
              <Pressable
                onPress={() => setAddModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={15}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'اسم الشخص أو الجهة' : 'Person or Organization Name'} *
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  placeholder={isAr ? 'مثال: محمد علي، شركة التقسيط...' : 'e.g. John Doe...'}
                  placeholderTextColor={colors.textTertiary}
                  value={personName}
                  onChangeText={setPersonName}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {t.amount} ({currencySymbol}) *
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>

              {/* Due Date & Quick Chips */}
              <View style={styles.formField}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                    {isAr ? 'تاريخ الاستحقاق' : 'Due Date'}
                  </Text>
                  <Text style={[styles.dateHelper, { color: colors.primary }]}>
                    {dueDate || (isAr ? 'غير محدد' : 'Not set')}
                  </Text>
                </View>

                {/* Quick Date Chips */}
                <View style={styles.quickDateChipsRow}>
                  <Pressable
                    style={[styles.quickDateChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    onPress={() => setQuickDate(7)}
                  >
                    <Text style={[styles.quickDateChipText, { color: colors.primary }]}>{isAr ? '⚡ بعد أسبوع' : '⚡ 1 Week'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.quickDateChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    onPress={() => setQuickDate(14)}
                  >
                    <Text style={[styles.quickDateChipText, { color: colors.primary }]}>{isAr ? '⚡ أسبوعين' : '⚡ 2 Weeks'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.quickDateChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    onPress={() => setQuickDate(30)}
                  >
                    <Text style={[styles.quickDateChipText, { color: colors.primary }]}>{isAr ? '⚡ بعد شهر' : '⚡ 1 Month'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.quickDateChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    onPress={() => setQuickDate(90)}
                  >
                    <Text style={[styles.quickDateChipText, { color: colors.primary }]}>{isAr ? '⚡ 3 أشهر' : '⚡ 3 Months'}</Text>
                  </Pressable>
                </View>

                <TextInput
                  style={[styles.modalInput, { marginTop: 8, backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  value={dueDate}
                  onChangeText={setDueDate}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{t.noteOptional}</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  placeholder={t.notePlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'المحفظة المرتبطة' : 'Linked Wallet'} *
                </Text>
                <View style={styles.walletsRow}>
                  {wallets.map(w => (
                    <Pressable
                      key={w.id}
                      onPress={() => setDebtWalletId(w.id)}
                      style={[
                        styles.walletSelectorCard,
                        { backgroundColor: colors.surfaceAlt },
                        debtWalletId === w.id && { borderColor: w.color, borderWidth: 2, backgroundColor: w.color + '15' }
                      ]}
                    >
                      <MaterialIcons name={w.icon as any} size={16} color={w.color} />
                      <Text style={[styles.walletSelectorText, { color: colors.textSecondary }, debtWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
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
                      {isAr
                        ? (activeTab === 'debt_to_me' ? 'خصم المبلغ فوراً من المحفظة' : 'إضافة المبلغ فوراً للمحفظة')
                        : (activeTab === 'debt_to_me' ? 'Deduct amount from wallet now' : 'Add amount to wallet now')}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: 'left' }}>
                      {isAr
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
                style={[styles.saveBtn, { backgroundColor: activeTab === 'debt_to_me' ? '#10B981' : '#6366F1' }]}
              >
                <Text style={styles.saveBtnText}>
                  {editingDebtId ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : t.save}
                </Text>
              </Pressable>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Record Payment / Collection Modal */}
      <Modal visible={payModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {isAr
                    ? (selectedDebt?.type === 'debt_to_me' ? 'تسجيل تحصيل / استرداد سلفة' : 'تسجيل سداد دين')
                    : (selectedDebt?.type === 'debt_to_me' ? 'Collect Loan Repayment' : 'Pay Off Debt')
                  }
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                  {selectedDebt?.personName}
                </Text>
              </View>
              <Pressable onPress={() => setPayModalVisible(false)} style={styles.modalCloseBtn} hitSlop={15}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              {selectedDebt && (
                <View style={[styles.payHeaderSubBox, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={styles.payHeaderSubRow}>
                    <Text style={[styles.payHeaderLabel, { color: colors.textSecondary }]}>
                      {isAr ? 'إجمالي الدين:' : 'Total:'}
                    </Text>
                    <Text style={[styles.payHeaderVal, { color: colors.text }]}>
                      {formatCurrency(selectedDebt.amount)} {currencySymbol}
                    </Text>
                  </View>
                  <View style={styles.payHeaderSubRow}>
                    <Text style={[styles.payHeaderLabel, { color: colors.textSecondary }]}>
                      {isAr ? 'المتبقي للسداد:' : 'Remaining:'}
                    </Text>
                    <Text style={[styles.payHeaderVal, { color: selectedDebt.type === 'debt_to_me' ? '#10B981' : '#EF4444', fontFamily: 'Cairo_700Bold' }]}>
                      {formatCurrency(selectedDebt.amount - selectedDebt.paidAmount)} {currencySymbol}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.primary, marginTop: 6, textAlign: 'left' }}>
                    💡 {isAr
                      ? (selectedDebt.type === 'debt_to_me' ? 'سيعاد المبلغ إلى محفظتك كدخل وارد.' : 'سيتم خصم المبلغ من محفظتك كمصروف.')
                      : (selectedDebt.type === 'debt_to_me' ? 'Collected amount will be added to your wallet.' : 'Payment amount will be deducted from your wallet.')}
                  </Text>
                </View>
              )}

              {/* Quick Amount Percentage Chips */}
              {selectedDebt && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                    {isAr ? 'مبالغ سريعة:' : 'Quick Presets:'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        const rem = selectedDebt.amount - selectedDebt.paidAmount;
                        setPayAmount(rem.toString());
                      }}
                      style={[styles.quickAmountChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.primary }]}
                    >
                      <Text style={[styles.quickAmountChipText, { color: colors.primary }]}>
                        {isAr ? 'كامل المتبقي (100%)' : 'Full (100%)'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        const half = Math.round((selectedDebt.amount - selectedDebt.paidAmount) / 2);
                        setPayAmount(half.toString());
                      }}
                      style={[styles.quickAmountChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    >
                      <Text style={[styles.quickAmountChipText, { color: colors.text }]}>
                        50%
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {isAr
                    ? (selectedDebt?.type === 'debt_to_me' ? 'مبلغ التحصيل' : 'مبلغ السداد')
                    : 'Payment Amount'
                  } ({currencySymbol}) *
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={payAmount}
                  onChangeText={setPayAmount}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {isAr
                    ? (selectedDebt?.type === 'debt_to_me' ? 'إيداع إلى محفظة' : 'سداد من محفظة')
                    : 'Target Wallet'
                  } *
                </Text>
                <View style={styles.walletsRow}>
                  {wallets.map(w => (
                    <Pressable
                      key={w.id}
                      onPress={() => setPayWalletId(w.id)}
                      style={[
                        styles.walletSelectorCard,
                        { backgroundColor: colors.surfaceAlt },
                        payWalletId === w.id && { borderColor: w.color, borderWidth: 2, backgroundColor: w.color + '15' }
                      ]}
                    >
                      <MaterialIcons name={w.icon as any} size={16} color={w.color} />
                      <Text style={[styles.walletSelectorText, { color: colors.textSecondary }, payWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                        {w.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={handleRecordPayment}
                style={[styles.saveBtn, { backgroundColor: selectedDebt?.type === 'debt_to_me' ? '#10B981' : '#6366F1' }]}
              >
                <Text style={styles.saveBtnText}>
                  {isAr
                    ? (selectedDebt?.type === 'debt_to_me' ? 'تأكيد تحصيل السلفة 📥' : 'تأكيد سداد الدين 📤')
                    : (selectedDebt?.type === 'debt_to_me' ? 'Confirm Collection' : 'Confirm Payment')
                  }
                </Text>
              </Pressable>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={!!deletingDebt}
        title={isAr ? (deletingDebt?.type === 'debt_to_me' ? 'حذف السلفة' : 'حذف الدين') : 'Delete Record'}
        message={
          deletingDebt
            ? (isAr
                ? `هل أنت متأكد من حذف ${deletingDebt.type === 'debt_to_me' ? 'سلفة' : 'دين'} "${deletingDebt.personName}" بمبلغ ${formatCurrency(deletingDebt.amount)} ${currencySymbol}؟`
                : `Are you sure you want to delete ${deletingDebt.personName}'s record?`)
            : ''
        }
        confirmText={isAr ? 'حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
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

const getStyles = (colors: any, theme: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 19,
    textAlign: 'left',
  },
  headerSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    textAlign: 'left',
    marginTop: -2,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  // Hero Banner (Executive Summary)
  heroBanner: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroPositionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  heroPositionText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  heroMainAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    letterSpacing: 0.5,
  },
  heroCurrencySymbol: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
  },
  heroIconBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSubGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  heroSubCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  heroSubCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  heroSubLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
  },
  heroSubVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  heroSubCount: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 2,
  },
  heroNoticeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.75)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  heroNoticeText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.text,
    textAlign: 'left',
  },
  // Shortcut Action Banner
  createActionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  createActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  createActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createActionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    textAlign: 'left',
  },
  createActionSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    textAlign: 'left',
    marginTop: 1,
  },
  // Segmented Tabs
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
  },
  // Sub-filter chips
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textTertiary,
  },
  // Section heading
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  sectionCount: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  // Empty state
  emptyContainer: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginVertical: 10,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
  // Debt Card
  debtCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  debtPerson: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    textAlign: 'left',
  },
  debtDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    textAlign: 'left',
    marginTop: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
  },
  cardIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Card Metrics Grid
  cardMetricsGrid: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  cardMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  cardMetricLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    marginBottom: 2,
  },
  cardMetricValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  // Progress Section
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  progressDetail: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Footer tags
  debtFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    marginBottom: 12,
  },
  footerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  footerPillText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
  // Main CTA Action Button
  mainActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  mainActionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  settledBannerText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#10B981',
  },
  // Floating Add Button
  floatingAddBtn: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  // Modals
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalForm: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  formField: {
    marginBottom: 14,
  },
  formLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'left',
  },
  modalInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    textAlign: 'left',
  },
  quickDateChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  quickDateChip: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
  },
  quickDateChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  dateHelper: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
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
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  walletSelectorText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  saveBtn: {
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
  // Pay Modal Sub Header
  payHeaderSubBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  payHeaderSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  payHeaderLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  payHeaderVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  quickAmountChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickAmountChipText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
});
