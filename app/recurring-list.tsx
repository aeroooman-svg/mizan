import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  Alert,
  Switch,
  Modal,
  TextInput,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName, formatDateLocalized } from '@/lib/i18n';
import {
  RecurringTransaction,
  getRecurringTransactions,
  deleteRecurringTransaction,
  updateRecurringTransaction,
} from '@/lib/recurringStorage';
import { getInstallmentPlans, InstallmentPlan } from '@/lib/installmentStorage';
import { getJameyas, Jameya } from '@/lib/jameyaStorage';
import { saveGoal, SavingsGoal } from '@/lib/goalStorage';

export default function RecurringListScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 10 : 0;
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const { currencySymbol, selectedWallet, wallets, refresh } = useTransactions();
  const [rates, setRates] = useState<Record<string, number>>({});
  
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [installments, setInstallments] = useState<InstallmentPlan[]>([]);
  const [jameyas, setJameyas] = useState<Jameya[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto Savings Modal State
  const [autoSavingsModalVisible, setAutoSavingsModalVisible] = useState(false);
  const [targetTotalInput, setTargetTotalInput] = useState('500');
  const [selectedMonths, setSelectedMonths] = useState(12);
  const [goalTitle, setGoalTitle] = useState('');

  useEffect(() => {
    import('@/lib/currencyApi').then(m => m.getExchangeRates()).then(r => setRates(r)).catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [recData, instData, jamData] = await Promise.all([
      getRecurringTransactions(),
      getInstallmentPlans(),
      getJameyas()
    ]);
    
    // Filter to current wallet if set
    if (selectedWallet) {
      setItems(recData.filter(item => item.walletId === selectedWallet.id || item.toWalletId === selectedWallet.id));
      setInstallments(instData.filter(item => item.walletId === selectedWallet.id || item.toWalletId === selectedWallet.id));
      setJameyas(jamData.filter(item => item.walletId === selectedWallet.id && item.paidMonthsCount < item.totalMonths));
    } else {
      setItems(recData);
      setInstallments(instData);
      setJameyas(jamData.filter(item => item.paidMonthsCount < item.totalMonths));
    }
    setLoading(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [selectedWallet])
  );

  // Financial calculations
  const totalRecurringIncome = useMemo(() => {
    return items
      .filter(i => i.isActive !== false && i.type === 'income')
      .reduce((sum, i) => {
        let val = i.amount;
        if (i.frequency === 'daily') val *= 30;
        else if (i.frequency === 'weekly') val *= 4.33;
        else if (i.frequency === 'yearly') val /= 12;
        return sum + val;
      }, 0);
  }, [items]);

  const totalRecurringExpenses = useMemo(() => {
    return items
      .filter(i => i.isActive !== false && (i.type === 'expense' || i.type === 'transfer'))
      .reduce((sum, i) => {
        let val = i.amount;
        if (i.frequency === 'daily') val *= 30;
        else if (i.frequency === 'weekly') val *= 4.33;
        else if (i.frequency === 'yearly') val /= 12;
        return sum + val;
      }, 0);
  }, [items]);

  const totalMonthlyInstallments = useMemo(() => {
    const targetCurrency = selectedWallet?.currency || 'EGP';
    const { convertAmount } = require('@/lib/currencyApi');
    const instSum = installments.reduce((sum, i) => {
      const instW = wallets.find(w => w.id === i.walletId);
      const instCurrency = instW ? instW.currency : targetCurrency;
      return sum + convertAmount(i.monthlyAmount || 0, instCurrency, targetCurrency, rates);
    }, 0);
    return instSum;
  }, [installments, selectedWallet, wallets, rates]);

  const totalCommitments = totalRecurringExpenses + totalMonthlyInstallments;
  const freeNetCashflow = totalRecurringIncome - totalCommitments;

  const handleOpenAutoSavingsModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const suggestedTarget = freeNetCashflow > 0 ? Math.round(freeNetCashflow * 12) : 500;
    setTargetTotalInput(suggestedTarget.toString());
    setSelectedMonths(12);
    setGoalTitle(isAr ? 'ادخار الفائض المالي 🎯' : 'Surplus Savings Goal 🎯');
    setAutoSavingsModalVisible(true);
  };

  const monthlyRequired = useMemo(() => {
    const total = parseFloat(targetTotalInput) || 0;
    return selectedMonths > 0 ? Math.round((total / selectedMonths) * 100) / 100 : 0;
  }, [targetTotalInput, selectedMonths]);

  const handleConfirmAutoSavingsGoal = async () => {
    const targetTotal = parseFloat(targetTotalInput);
    if (isNaN(targetTotal) || targetTotal <= 0) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى إدخال إجمالي مبلغ الهدف بشكل صحيح' : 'Please enter a valid total target amount'
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const deadlineDate = new Date();
    deadlineDate.setMonth(deadlineDate.getMonth() + selectedMonths);

    const autoGoal: SavingsGoal = {
      id: Crypto.randomUUID(),
      name: goalTitle.trim() || (isAr ? 'ادخار الفائض 🎯' : 'Surplus Savings Goal'),
      targetAmount: targetTotal,
      savedAmount: 0,
      deadline: deadlineDate.toISOString(),
      walletId: selectedWallet?.id || '',
      createdAt: new Date().toISOString(),
    };

    await saveGoal(autoGoal);
    setAutoSavingsModalVisible(false);

    Alert.alert(
      isAr ? 'تمت إضافة هدف الادخار بنجاح 🎉' : 'Savings Goal Created 🎉',
      isAr
        ? `تم إنشاء هدف "${autoGoal.name}" بمبلغ إجمالي (${formatCurrency(targetTotal)} ${currencySymbol}) ومعدل ادخار شهري (${formatCurrency(monthlyRequired)} ${currencySymbol}).`
        : `Created goal to save ${formatCurrency(targetTotal)} ${currencySymbol}!`,
      [
        {
          text: isAr ? 'الانتقال للأهداف' : 'View Goals',
          onPress: () => router.push('/savings-goals'),
        },
        { text: isAr ? 'موافق' : 'OK' }
      ]
    );
  };

  const handleToggleActive = async (item: RecurringTransaction, val: boolean) => {
    Haptics.selectionAsync();
    const updated = { ...item, isActive: val };
    await updateRecurringTransaction(updated);
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
  };

  const handleDelete = (id: string, description: string, categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const catName = getCategoryName(categoryId, language);
    const displayName = description ? `${catName} (${description})` : catName;
    const confirmMsg = isAr ? `هل تريد حذف المعاملة المتكررة "${displayName}"؟` : `Delete recurring transaction "${displayName}"?`;
    
    const performDelete = async () => {
      await deleteRecurringTransaction(id);
      await loadData();
      try { refresh(); } catch {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        performDelete();
      }
      return;
    }

    Alert.alert(
      t.deletePlan,
      confirmMsg,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: performDelete,
        },
      ]
    );
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return t.daily;
      case 'weekly': return t.weekly;
      case 'monthly': return t.monthly;
      case 'yearly': return t.yearly;
      default: return freq;
    }
  };

  const surplus = totalRecurringIncome - totalRecurringExpenses;

  const renderHeader = () => (
    <View style={styles.summaryContainer}>
      {/* Executive Summary Hero Banner */}
      <LinearGradient
        colors={
          theme === 'dark'
            ? (surplus >= 0 ? ['#064E3B', '#0F2922', '#0A1128'] : ['#1E1B4B', '#111827', '#0A1128'])
            : (surplus >= 0 ? ['#ECFDF5', '#D1FAE5', '#EFF6FF'] : ['#EEF2FF', '#E0E7FF', '#EFF6FF'])
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBanner}
      >
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.heroPositionBadge}>
              <Ionicons
                name={surplus >= 0 ? "trending-up" : "trending-down"}
                size={14}
                color={surplus >= 0 ? '#10B981' : '#EF4444'}
              />
              <Text
                style={[
                  styles.heroPositionText,
                  { color: surplus >= 0 ? (theme === 'dark' ? '#34D399' : '#059669') : '#EF4444' },
                ]}
              >
                {surplus >= 0
                  ? (isAr ? 'صافي فائض شهري مستقر' : 'Monthly Recurring Surplus')
                  : (isAr ? 'عجز في الالتزامات الدورية' : 'Recurring Deficit')}
              </Text>
            </View>

            <Text style={[styles.heroMainAmount, { color: theme === 'dark' ? '#FFF' : '#1E293B' }]}>
              {formatCurrency(Math.abs(surplus))} <Text style={styles.heroCurrencySymbol}>{currencySymbol}</Text>
            </Text>
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
              {isAr ? 'الفائض المتبقي بعد سداد الفواتير الدورية' : 'Net cashflow after recurring commitments'}
            </Text>
          </View>

          <View style={[styles.heroIconBadge, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)' }]}>
            <MaterialCommunityIcons
              name="repeat"
              size={30}
              color={surplus >= 0 ? '#10B981' : '#6366F1'}
            />
          </View>
        </View>

        {/* Sub Metrics Grid */}
        <View style={styles.heroSubGrid}>
          <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' }]}>
            <View style={styles.heroSubCardHeader}>
              <Ionicons name="arrow-down-circle" size={13} color="#10B981" />
              <Text style={styles.heroSubLabel}>{isAr ? 'دخل متكرر' : 'Income'}</Text>
            </View>
            <Text style={[styles.heroSubVal, { color: '#10B981' }]}>
              +{formatCurrency(totalRecurringIncome)} <Text style={{ fontSize: 9 }}>{currencySymbol}</Text>
            </Text>
          </View>

          <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' }]}>
            <View style={styles.heroSubCardHeader}>
              <Ionicons name="arrow-up-circle" size={13} color="#EF4444" />
              <Text style={styles.heroSubLabel}>{isAr ? 'فواتير واشتراكات' : 'Bills'}</Text>
            </View>
            <Text style={[styles.heroSubVal, { color: '#EF4444' }]}>
              -{formatCurrency(totalRecurringExpenses)} <Text style={{ fontSize: 9 }}>{currencySymbol}</Text>
            </Text>
          </View>

          <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' }]}>
            <View style={styles.heroSubCardHeader}>
              <Ionicons name="checkmark-done-circle" size={13} color="#6366F1" />
              <Text style={styles.heroSubLabel}>{isAr ? 'معاملات مفعلة' : 'Active'}</Text>
            </View>
            <Text style={[styles.heroSubVal, { color: '#6366F1' }]}>
              {items.filter(i => i.isActive !== false).length}
            </Text>
          </View>
        </View>

        {/* Shortcut to Installments & ROSCA Screen */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/installments' as any);
          }}
          style={styles.heroNoticeTag}
        >
          <Ionicons name="card-outline" size={16} color={colors.primary} />
          <Text style={styles.heroNoticeText} numberOfLines={1}>
            {isAr
              ? '💡 لإدارة أقساط الكروت والجمعيات، انتقل لقسم "أقساط وجمعيات"'
              : '💡 Manage credit cards & ROSCA in "Installments & Associations"'}
          </Text>
          <Ionicons name={isAr ? "chevron-back" : "chevron-forward"} size={14} color={colors.primary} />
        </Pressable>

        {/* Auto Savings Goal Button */}
        {surplus > 0 && (
          <Pressable
            onPress={handleOpenAutoSavingsModal}
            style={({ pressed }) => [
              styles.autoSavingsBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
            ]}
          >
            <Ionicons name="trophy-outline" size={18} color="#FFF" />
            <Text style={styles.autoSavingsBtnText}>
              {isAr ? '🎯 تحويل الفائض الشهري إلى هدف ادخار آلي' : '🎯 Convert Surplus to Auto Savings Goal'}
            </Text>
          </Pressable>
        )}
      </LinearGradient>

      {/* Action Shortcut Banner */}
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          router.push('/add-recurring');
        }}
        style={({ pressed }) => [
          styles.createActionBanner,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
      >
        <View style={styles.createActionLeft}>
          <View style={[styles.createActionIcon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="add-circle" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.createActionTitle, { color: colors.text }]}>
              {isAr ? 'إضافة معاملة متكررة جديدة' : 'Add Recurring Transaction'}
            </Text>
            <Text style={[styles.createActionSubtitle, { color: colors.textSecondary }]}>
              {isAr ? 'جدولة راتب، إيجار، فاتورة نت، أو اشتراك دوري' : 'Schedule salary, rent, internet or bill'}
            </Text>
          </View>
        </View>
        <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textTertiary} />
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 }}>
        <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 15, color: colors.text }}>
          {isAr ? `قائمة المعاملات المجدولة (${items.length})` : `Scheduled Transactions (${items.length})`}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: RecurringTransaction }) => {
    const isTransfer = item.type === 'transfer' || !!item.toWalletId;
    const targetWalletObj = isTransfer && item.toWalletId ? wallets.find(w => w.id === item.toWalletId) : null;
    const cat = getCategoryById(item.category);
    const itemColor = item.color || cat?.color || (item.type === 'income' ? colors.income : colors.primary);
    const itemIcon = item.icon || (isTransfer ? 'swap-horiz' : cat?.icon || 'receipt');

    const displayName = isTransfer
      ? (targetWalletObj 
          ? (isAr ? `تحويل إلى ${targetWalletObj.name}` : `Transfer to ${targetWalletObj.name}`)
          : (isAr ? 'تحويل محفظة' : 'Wallet Transfer'))
      : getCategoryName(item.category, language);

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.catIcon, { backgroundColor: itemColor + '18' }]}>
            <MaterialIcons name={itemIcon as any} size={22} color={itemColor} />
          </View>
          <View style={styles.info}>
            <Text style={[styles.catName, { color: colors.text }]}>{displayName}</Text>
            {item.description ? <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={1}>{item.description}</Text> : null}
            <View style={styles.badgeRow}>
              <View style={[styles.frequencyBadge, { backgroundColor: itemColor + '15' }]}>
                <Text style={[styles.frequencyText, { color: itemColor }]}>{getFrequencyLabel(item.frequency)}</Text>
              </View>
              <Text style={[styles.nextDue, { color: colors.textTertiary }]}>
                {t.nextDueDate}: {formatDateLocalized(item.nextDueDate, language)}
              </Text>
            </View>
          </View>
          <View style={styles.actionColumn}>
            <Text style={[styles.amount, { color: item.type === 'income' ? colors.income : colors.expense }]}>
              {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)} {currencySymbol}
            </Text>
            <View style={styles.actions}>
              <Switch
                value={item.isActive}
                onValueChange={(val) => handleToggleActive(item, val)}
                trackColor={{ false: colors.border, true: colors.primary + '50' }}
                thumbColor={item.isActive ? colors.primary : colors.textTertiary}
              />
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/add-recurring?editId=${item.id}`);
                }}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => handleDelete(item.id, item.description, item.category)}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={colors.expense} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const handleBack = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <View style={styles.container}>
      {/* Sleek App Header */}
      <View style={[styles.headerRow, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <Pressable onPress={handleBack} hitSlop={15} style={styles.backBtn}>
          <Ionicons name={isAr ? "chevron-forward" : "chevron-back"} size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isAr ? '🔄 المعاملات المتكررة' : 'Recurring Transactions'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {isAr ? 'أتمتة الفواتير الدورية والاشتراكات الشهرية' : 'Automate your regular bills & income'}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/add-recurring');
          }}
          style={styles.addBtn}
          hitSlop={10}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      {items.length === 0 ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
          {renderHeader()}
          <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '18' }]}>
              <MaterialCommunityIcons name="calendar-sync-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noRecurring}</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {isAr
                ? 'سجل التزاماتك المتكررة مثل الراتب أو الفواتير الشهرية أو اشتراك النت ليتم تسجيلها تلقائياً وتنبيهك بمواعيدها.'
                : 'Schedule recurring income or bills to automate your budget and get reminders.'}
            </Text>
            <Pressable
              onPress={() => router.push('/add-recurring')}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.emptyBtnText}>{t.addRecurring}</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          ListHeaderComponent={renderHeader}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Auto Savings Goal Setup Modal Sheet */}
      <Modal
        visible={autoSavingsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAutoSavingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAr ? '🎯 إنشاء هدف ادخار مالي آلي' : '🎯 Create Auto Savings Goal'}
              </Text>
              <Pressable onPress={() => setAutoSavingsModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              <View style={styles.modalInfoBox}>
                <Text style={styles.modalInfoTitle}>
                  {isAr ? '🎯 تخطيط هدف ادخاري شفاف وعملي' : '🎯 Practical & Transparent Goal Setup'}
                </Text>
                <Text style={styles.modalInfoSub}>
                  {isAr
                    ? `أدخل المبلغ الإجمالي الذي تتمنى ادخاره، واختر عدد الأشهر، وسيحسب التطبيق قسط الادخار الشهري المباشر تلقائياً.`
                    : `Enter your total target amount and duration, and the app will calculate your monthly savings requirement.`}
                </Text>
              </View>

              {/* Goal Title Input */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>{isAr ? 'اسم هدف الادخار:' : 'Goal Name:'}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={goalTitle}
                  onChangeText={setGoalTitle}
                  placeholder="مثال: شراء سيارة، ادخار منزل، صندوق طوارئ..."
                  placeholderTextColor={colors.textTertiary}
                  textAlign={isAr ? 'right' : 'left'}
                />
              </View>

              {/* Total Target Amount Input */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>
                  {isAr ? `إجمالي المبلغ المراد ادخاره (${currencySymbol}):` : `Total Target Savings Amount (${currencySymbol}):`}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={targetTotalInput}
                  onChangeText={setTargetTotalInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  textAlign="right"
                />
              </View>

              {/* Duration Months Selector Chips */}
              <Text style={[styles.inputLabel, { marginTop: 4 }]}>
                {isAr ? 'اختر مدة الادخار (عدد الأشهر):' : 'Select Savings Duration (Months):'}
              </Text>
              <View style={styles.presetChipRow}>
                {[
                  { m: 3, labelAr: '3 أشهر', labelEn: '3 Mos' },
                  { m: 6, labelAr: '6 أشهر', labelEn: '6 Mos' },
                  { m: 12, labelAr: '12 شهراً (سنة)', labelEn: '12 Mos (1 Yr)' },
                  { m: 24, labelAr: '24 شهراً (سنتين)', labelEn: '24 Mos (2 Yrs)' },
                  { m: 36, labelAr: '36 شهراً (3 سنوات)', labelEn: '36 Mos (3 Yrs)' },
                ].map(opt => (
                  <Pressable
                    key={opt.m}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedMonths(opt.m);
                    }}
                    style={[
                      styles.presetChip,
                      selectedMonths === opt.m && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                    ]}
                  >
                    <Text style={[styles.presetChipText, selectedMonths === opt.m && { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>
                      {isAr ? opt.labelAr : opt.labelEn}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Dynamic Live Calculation Banner */}
              <View style={[styles.modalInfoBox, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40', marginTop: 6 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calculator-outline" size={18} color={colors.primary} />
                  <Text style={[styles.modalInfoTitle, { color: colors.primary }]}>
                    {isAr ? 'الحساب الآلي للادخار الشهري:' : 'Calculated Monthly Savings:'}
                  </Text>
                </View>
                <Text style={[styles.modalInfoSub, { fontSize: 14, fontFamily: 'Cairo_700Bold', color: colors.text, marginTop: 4 }]}>
                  {isAr
                    ? `💡 للوصول لهدف (${formatCurrency(parseFloat(targetTotalInput) || 0)} ${currencySymbol}) خلال (${selectedMonths}) شهراً:\nستحتاج لادخار (${formatCurrency(monthlyRequired)} ${currencySymbol}) شهرياً.`
                    : `💡 To reach ${formatCurrency(parseFloat(targetTotalInput) || 0)} ${currencySymbol} in ${selectedMonths} months:\nYou need to save ${formatCurrency(monthlyRequired)} ${currencySymbol} monthly.`}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={handleConfirmAutoSavingsGoal}
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                ]}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmBtnText}>
                  {isAr ? 'إنشاء وتفعيل هدف الادخار 🎯' : 'Create & Activate Goal'}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
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
  backBtn: {
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
    fontSize: 18,
    color: colors.text,
    textAlign: 'left',
  },
  headerSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'left',
    marginTop: -2,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryContainer: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
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
  heroNoticeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.75)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  heroNoticeText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.text,
    textAlign: 'left',
  },
  autoSavingsBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  autoSavingsBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
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
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: 12,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyContainer: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginHorizontal: 18,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  catName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.text,
    textAlign: 'left',
  },
  desc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  frequencyBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  frequencyText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
  },
  nextDue: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  actionColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  amount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  emptyButtonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  modalBody: {
    padding: 20,
    gap: 14,
  },
  modalInfoBox: {
    backgroundColor: colors.primary + '12',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: 4,
  },
  modalInfoTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
  modalInfoSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalConfirmBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
  },
  modalConfirmBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
