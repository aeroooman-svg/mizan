import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Image,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { checkClipboardForBankSMS, markSmsAsProcessed } from '@/lib/autoSmsListener';
import { ParsedBankSMS } from '@/lib/smsParser';
import SmartSmsModal from '@/components/SmartSmsModal';

import { getCategoryName, formatDateLocalized } from '@/lib/i18n';
import { getBudgetsForWallet } from '@/lib/budgetStorage';
import { predictCashflow, calculateHealthScore } from '@/lib/financialEngine';
import { SavingsGoal } from '@/lib/goalStorage';
import { Debt } from '@/lib/debtStorage';
import { FinancialPlan } from '@/lib/planStorage';
import { RecurringTransaction } from '@/lib/recurringStorage';
import Svg, { Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import FinancialHealthScore from '@/components/FinancialHealthScore';
import CashflowForecastWidget from '@/components/CashflowForecastWidget';
import QuickGlanceWidget from '@/components/QuickGlanceWidget';
import FinancialGoalWidget from '@/components/FinancialGoalWidget';
import { getExchangeRates, convertAmount } from '@/lib/currencyApi';
import { getWidgetData } from '@/lib/widgetDataProvider';
import { subscribeSyncStatus, SyncState } from '@/lib/syncService';
import WalletCarousel from '@/components/home/WalletCarousel';
import ConsolidatedBalanceCard from '@/components/home/ConsolidatedBalanceCard';
import HealthForecastRow from '@/components/home/HealthForecastRow';
import PendingRecurringSection from '@/components/home/PendingRecurringSection';
import ActivePlanSection from '@/components/home/ActivePlanSection';
import GoalsDebtsSections from '@/components/home/GoalsDebtsSections';
import UndoSnackbar from '@/components/UndoSnackbar';
import SkeletonPlaceholder, { SkeletonCard } from '@/components/SkeletonPlaceholder';

export default function HomeScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const {
    transactions,
    walletTransactions,
    totalIncome,
    totalExpense,
    balance,
    allTimeIncome,
    allTimeExpense,
    isLoading,
    refresh,
    wallets,
    selectedWallet,
    selectWallet,
    removeWallet,
    currencySymbol,
    pendingRecurring,
    approveRecurringTransaction,
    addTransaction,
  } = useTransactions();
  const { t, language } = useLanguage();
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Bank SMS Auto-Detection State
  const [detectedSms, setDetectedSms] = useState<ParsedBankSMS | null>(null);

  const checkForSms = useCallback(async () => {
    if (!selectedWallet) return;
    const res = await checkClipboardForBankSMS(addTransaction, selectedWallet.id);
    if (res.detected) {
      if (res.autoSaved) {
        await refresh();
      } else if (res.parsed) {
        setDetectedSms(res.parsed);
      }
    }
  }, [selectedWallet, addTransaction, refresh]);

  useFocusEffect(
    useCallback(() => {
      checkForSms();
    }, [checkForSms])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkForSms();
      }
    });
    return () => subscription.remove();
  }, [checkForSms]);

  const handleSaveDetectedSms = async () => {
    if (!detectedSms || !selectedWallet) return;
    const now = new Date().toISOString();
    const newTx = {
      id: Crypto.randomUUID(),
      walletId: selectedWallet.id,
      type: detectedSms.type,
      amount: detectedSms.amount || 0,
      category: detectedSms.category || 'other',
      description: `${detectedSms.merchant} (${detectedSms.bankName})`,
      date: now,
      createdAt: now,
      note: `📱 أتمتة رسائل البنك تلقائياً\n${detectedSms.rawText}`,
    };
    await addTransaction(newTx);
    await markSmsAsProcessed(detectedSms.rawText);
    setDetectedSms(null);
    await refresh();
  };

  const handleEditDetectedSms = async () => {
    if (!detectedSms) return;
    await markSmsAsProcessed(detectedSms.rawText);
    const sms = detectedSms;
    setDetectedSms(null);
    router.push({
      pathname: '/add-transaction',
      params: {
        prefillAmount: sms.amount?.toString(),
        prefillType: sms.type,
        prefillCategory: sms.category,
        prefillDesc: `${sms.merchant} (${sms.bankName})`,
      },
    } as any);
  };

  const handleDismissDetectedSms = async () => {
    if (!detectedSms) return;
    await markSmsAsProcessed(detectedSms.rawText);
    setDetectedSms(null);
  };

  useEffect(() => {
    const unsub = subscribeSyncStatus((state) => {
      setSyncState(state);
    });
    return () => unsub();
  }, []);

  // Calculate unread notification count
  const computeUnreadCount = useCallback(async () => {
    try {
      const readIdsStr = await AsyncStorage.getItem('@mizan_notifications_read');
      const readIds = readIdsStr ? new Set(JSON.parse(readIdsStr)) : new Set();
      // Generate notification IDs to check against read
      const now = new Date();
      const notifIds: string[] = ['welcome'];
      if (totalIncome > 0 && totalExpense / totalIncome > 0.8) notifIds.push('budget_warning_' + now.getMonth());
      if (totalIncome > 0 && (totalIncome - totalExpense) / totalIncome > 0.3) notifIds.push('savings_achievement_' + now.getMonth());
      if (pendingRecurring.length > 0) notifIds.push('recurring_due_' + now.toISOString().slice(0, 10));
      if (wallets.length > 1) notifIds.push('multi_wallet_tip');
      const todayStr = now.toISOString().slice(0, 10);
      const todayTxns = transactions.filter(t => t.date.slice(0, 10) === todayStr);
      if (todayTxns.length === 0 && transactions.length > 0) notifIds.push('no_txn_today_' + todayStr);
      if (balance < 0) notifIds.push('negative_balance_' + now.getMonth());
      const unread = notifIds.filter(id => !readIds.has(id)).length;
      setUnreadNotifCount(unread);
    } catch (e) {
      setUnreadNotifCount(0);
    }
  }, [totalIncome, totalExpense, pendingRecurring, wallets, transactions, balance]);

  const [widgetConfig, setWidgetConfig] = useState({
    showQuickGlance: true,
    showGoalWidget: true,
    showForecastWidget: true,
    showHealthWidget: true,
  });

  const loadWidgetConfig = useCallback(async () => {
    try {
      const str = await AsyncStorage.getItem('@mizan_widget_config');
      if (str) {
        setWidgetConfig(JSON.parse(str));
      }
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      computeUnreadCount();
      loadWidgetConfig();
    }, [computeUnreadCount, loadWidgetConfig])
  );

  const [adjustingItem, setAdjustingItem] = useState<RecurringTransaction | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadRates() {
      const liveRates = await getExchangeRates();
      setRates(liveRates);
    }
    loadRates();
  }, []);

  const getWalletBalance = (walletId: string) => {
    const walletTxns = transactions.filter(t => 
      t.walletId === walletId || 
      (t.type === 'transfer' && t.toWalletId === walletId)
    );
    const income = walletTxns
      .filter(t => t.type === 'income' || (t.type === 'transfer' && t.toWalletId === walletId))
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = walletTxns
      .filter(t => t.type === 'expense' || (t.type === 'transfer' && t.walletId === walletId))
      .reduce((sum, t) => sum + t.amount, 0);
    return income - expense;
  };

  const walletPending = useMemo(() => {
    if (!selectedWallet) return [];
    return pendingRecurring.filter(p => p.walletId === selectedWallet.id);
  }, [pendingRecurring, selectedWallet]);

  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [isForecastExpanded, setIsForecastExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [undoState, setUndoState] = useState<{ visible: boolean; message: string; action: () => void } | null>(null);

  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);

  useEffect(() => {
    async function checkUser() {
      try {
        const { getLoggedInUser } = await import('@/lib/syncService');
        const user = await getLoggedInUser();
        setCurrentUser(user);
      } catch (err) {
        console.error('Error fetching logged in user:', err);
      }
    }
    checkUser();
  }, []);

  const loadExtraData = async () => {
    try {
      const [goalsData, debtsData, planData] = await Promise.all([
        import('@/lib/goalStorage').then(m => m.getGoals()),
        import('@/lib/debtStorage').then(m => m.getDebts()),
        import('@/lib/planStorage').then(m => m.getFinancialPlan(selectedWallet?.id))
      ]);
      
      if (selectedWallet) {
        setGoals(goalsData.filter((g: SavingsGoal) => g.walletId === selectedWallet.id));
        setDebts(debtsData.filter((d: Debt) => d.walletId === selectedWallet.id));
        setPlan(planData);
      } else {
        setGoals(goalsData);
        setDebts(debtsData);
        setPlan(planData);
      }
    } catch (err) {
      console.error('Error loading extra homepage data:', err);
    }
  };

  useEffect(() => {
    loadExtraData();
  }, [selectedWallet, walletTransactions]);

  useEffect(() => {
    async function loadData() {
      if (selectedWallet) {
        const budgetData = await getBudgetsForWallet(selectedWallet.id);
        setBudgets(budgetData || {});
      } else {
        setBudgets({});
      }
    }
    loadData();
  }, [selectedWallet]);
  const getSmartTip = () => {
    const tipsAr = [
      "💡 حصالة الفكة مفعلة: كل عملية شراء تقوم بها يتم تقريبها للـ 10 جنيهات التالية وإيداع الفارق تلقائياً في أهدافك الادخارية!",
      "💡 راقب الميزانية: إذا تجاوزت ميزانية أحد الفئات، سيتم اقتطاع عقوبة مالية تذهب مباشرة لحصالة التوفير لمساعدتك على الانضباط.",
      "💡 نصيحة الادخار: ينصح دائماً بادخار 20% من دخلك الشهري قبل البدء في الصرف (قاعدة 50/30/20).",
      "💡 توقعات السيولة: تشير التوقعات الحالية إلى استقرار محفظتك، حاول الحفاظ على معدل الصرف الحالي لتفادي أي عجز مالي.",
      "💡 سداد الديون: البدء بسداد الديون الصغيرة أولاً (طريقة كرة الثلج) يمنحك حافزاً معنوياً كبيراً لإتمام سداد كافة التزاماتك."
    ];
    const tipsEn = [
      "💡 Round-up activated: Every purchase is rounded up to the next 10 and the difference goes directly into your savings jars!",
      "💡 Budget Warning: Exceeding a category budget will trigger a penalty that goes straight to your savings to enforce discipline.",
      "💡 Savings Tip: Always save 20% of your monthly income before spending (50/30/20 rule).",
      "💡 Cashflow Insight: Your wallet health is stable. Maintain current spending rates to avoid potential deficits.",
      "💡 Debt Tip: Settling small debts first (Snowball method) builds mental momentum to clear all your liabilities."
    ];
    const score = healthScore || 70;
    const idx = Math.min(tipsAr.length - 1, Math.floor((100 - score) / 20));
    return language === 'ar' ? tipsAr[idx] : tipsEn[idx];
  };
  const challengesCompletedCount = useMemo(() => {
    let count = 0;
    
    // 1. Coffee Saver Challenge: No shopping or entertainment in last 5 days
    const nonEssentialCategories = ['shopping', 'entertainment'];
    const now = new Date();
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(now.getDate() - 5);
    const nonEssentialTx = walletTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return tx.type === 'expense' && 
             nonEssentialCategories.includes(tx.category) && 
             txDate >= fiveDaysAgo;
    });
    if (nonEssentialTx.length === 0 && walletTransactions.length > 0) count++;

    // 2. 50% Savings Challenge: save >= 50% of income
    if (totalIncome > 0) {
      const savings = totalIncome - totalExpense;
      if (savings / totalIncome >= 0.5) count++;
    }

    // 3. No-Spend Week: non-essential expenses < 15 in last 7 days
    const essentialCategories = ['rent', 'bills', 'health', 'education', 'salary', 'freelance', 'investment', 'gift', 'bonus'];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const nonEssentialTotal = walletTransactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return tx.type === 'expense' && 
               !essentialCategories.includes(tx.category) && 
               txDate >= sevenDaysAgo;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const limit = 15;
    if (nonEssentialTotal < limit && walletTransactions.length > 0) count++;

    return count;
  }, [walletTransactions, totalIncome, totalExpense]);

  const selectedWalletBalance = useMemo(() => {
    return allTimeIncome - allTimeExpense;
  }, [allTimeIncome, allTimeExpense]);

  const totalConsolidatedBalance = useMemo(() => {
    if (!selectedWallet) return 0;
    if (Object.keys(rates).length === 0) return selectedWalletBalance;
    
    let total = 0;
    wallets.forEach(w => {
      const bal = getWalletBalance(w.id);
      const converted = convertAmount(bal, w.currency, selectedWallet.currency, rates);
      total += converted;
    });
    return total;
  }, [wallets, selectedWallet, transactions, rates, selectedWalletBalance]);

  const forecast = useMemo(() => {
    if (!selectedWallet) return null;
    return predictCashflow(walletTransactions, selectedWalletBalance, currencySymbol);
  }, [walletTransactions, selectedWallet, selectedWalletBalance, currencySymbol]);

  const healthScore = useMemo(() => {
    if (!selectedWallet) return 100;
    const status = forecast ? forecast.status : 'safe';
    return calculateHealthScore(
      walletTransactions,
      budgets,
      totalIncome,
      totalExpense,
      status,
      challengesCompletedCount
    );
  }, [walletTransactions, budgets, totalIncome, totalExpense, forecast, challengesCompletedCount, selectedWallet]);

  const webTopInset = Platform.OS === 'web' ? 10 : 0;

  const recentTransactions = walletTransactions.slice(0, 5);


  const handleAddWallet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-wallet');
  };

  const handleEditWallet = (wallet: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/add-wallet',
      params: { walletId: wallet.id },
    } as any);
  };

  const handleDeleteWallet = (id: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      language === 'ar' ? 'حذف المحفظة' : t.deleteWallet,
      language === 'ar'
        ? `هل أنت متاكد من حذف محفظة "${name}"؟\nسيتم حذف جميع المعاملات والميزانيات والأقساط والأهداف المرتبطة بهذه المحفظة نهائياً.`
        : `Are you sure you want to delete "${name}"? All related transactions, budgets, installments, and goals will be permanently deleted.`,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.delete, style: 'destructive', onPress: () => removeWallet(id) },
      ],
    );
  };

  const handleApproveConfirm = async (item: RecurringTransaction) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await approveRecurringTransaction(item);
    setUndoState({
      visible: true,
      message: language === 'ar' ? `تم تأكيد مصروف ${getCategoryName(item.category, language)} بنجاح` : 'Transaction confirmed successfully',
      action: () => {},
    });
  };

  const handleApproveAdjust = (item: RecurringTransaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAdjustingItem(item);
    setAdjustAmount(item.amount.toString());
  };

  const handleSaveAdjustedAmount = async () => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'الرجاء إدخال مبلغ صحيح' : 'Please enter a valid amount');
      return;
    }
    if (adjustingItem) {
      await approveRecurringTransaction(adjustingItem, amt);
      setUndoState({
        visible: true,
        message: language === 'ar' ? 'تم تعديل وتأكيد الفاتورة بنجاح' : 'Adjusted bill confirmed',
        action: () => {},
      });
    }
    setAdjustingItem(null);
  };

  const handleApproveSkip = async (item: RecurringTransaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await approveRecurringTransaction(item, undefined, true);
    setUndoState({
      visible: true,
      message: language === 'ar' ? `تم تخطي مصروف ${getCategoryName(item.category, language)}` : 'Transaction skipped',
      action: () => {},
    });
  };

  const now = new Date();
  const dayName = t.days[now.getDay()];
  const currentDay = now.getDate();
  const currentMonth = t.months[now.getMonth()];
  const currentYear = now.getFullYear();

  if (!isLoading && wallets.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: (insets.top || webTopInset) + 16 }]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{dayName}، {currentDay} {currentMonth} {currentYear}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/notifications');
                }}
                style={({ pressed }) => [styles.settingsBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.85)" />
                {unreadNotifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.settingsBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="settings-sharp" size={20} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.welcomeEmpty}>
          <MaterialIcons name="account-balance-wallet" size={64} color={Colors.primary} />
          <Text style={styles.welcomeTitle}>{t.welcomeTitle || (language === 'ar' ? 'مرحباً بك في مِيزان' : 'Welcome to MIZAN')}</Text>
          <Text style={styles.welcomeSubtitle}>{t.welcomeSubtitle || (language === 'ar' ? 'ابدأ بإضافة محفظتك الأولى لتتبع مصاريفك' : 'Start by adding your first wallet to track expenses')}</Text>
          <Pressable
            onPress={handleAddWallet}
            style={({ pressed }) => [
              styles.welcomeButton,
              { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.welcomeButtonText}>{t.newWallet}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={theme === 'dark' ? ['#070B14', '#0D1424', '#05070B'] : ['#F8FAFC', '#F1F5F9', '#E2E8F0']}
      style={styles.container}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Top Header Bar with Menu and Settings */}
        <View style={[styles.topHeaderBar, { paddingTop: (insets.top || webTopInset) + 12 }]}>
          <Pressable 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsMenuOpen(true);
            }}
            style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="menu-outline" size={24} color="#FFF" />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.topBarTitle}>MIZAN</Text>
            <View style={[
              styles.syncStatusBadge,
              { backgroundColor: syncState === 'synced' ? 'rgba(16, 185, 129, 0.2)' : syncState === 'syncing' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)' }
            ]}>
              <View style={[
                styles.syncStatusDot,
                { backgroundColor: syncState === 'synced' ? '#10B981' : syncState === 'syncing' ? '#3B82F6' : '#F59E0B' }
              ]} />
              <Text style={[
                styles.syncStatusText,
                { color: syncState === 'synced' ? '#10B981' : syncState === 'syncing' ? '#60A5FA' : '#FBBF24' }
              ]}>
                {syncState === 'synced' ? (language === 'ar' ? 'متزامن' : 'Synced') :
                 syncState === 'syncing' ? (language === 'ar' ? 'جاري المزامنة...' : 'Syncing...') :
                 (language === 'ar' ? 'محلي' : 'Local')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/notifications');
              }}
              style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="notifications-outline" size={24} color="#FFF" />
              {unreadNotifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/settings');
              }}
              style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="settings-outline" size={24} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* 3D Bank Credit Cards Carousel */}
        <WalletCarousel
          wallets={wallets}
          selectedWallet={selectedWallet}
          transactions={transactions}
          currentUser={currentUser}
          language={language as 'ar' | 'en'}
          colors={colors}
          healthScore={healthScore}
          onSelectWallet={selectWallet}
          onEditWallet={handleEditWallet}
          onDeleteWallet={handleDeleteWallet}
          onAddWallet={handleAddWallet}
        />

        {/* Quick Glance Widget */}
        {widgetConfig.showQuickGlance !== false && (
          <QuickGlanceWidget
            data={getWidgetData(
              transactions,
              wallets,
              selectedWallet,
              healthScore,
              budgets,
              currencySymbol,
            )}
            goals={goals}
            debts={debts}
            totalConsolidatedBalance={totalConsolidatedBalance}
            language={language as 'ar' | 'en'}
            onAddPress={() => router.push('/add-transaction')}
          />
        )}

        {/* Dynamic Financial Goal Focus Widget */}
        {widgetConfig.showGoalWidget !== false && (
          <FinancialGoalWidget />
        )}

        {/* Pending Recurring Bills Confirmation Widget */}
        <PendingRecurringSection
          walletPending={walletPending}
          currencySymbol={currencySymbol}
          language={language as 'ar' | 'en'}
          colors={colors}
          onApproveConfirm={handleApproveConfirm}
          onApproveSkip={handleApproveSkip}
          onSaveAdjustedAmount={(item, amt) => approveRecurringTransaction(item, amt)}
        />

        {/* Active Plan & Savings & Debts Section */}
        {selectedWallet && (
          <View style={{ marginHorizontal: 20, marginTop: 16, gap: 20 }}>
            {/* Widget 0: Smart Financial Plan Widget */}
            <ActivePlanSection
              plan={plan}
              goals={goals}
              debts={debts}
              walletTransactions={walletTransactions}
              selectedWalletId={selectedWallet?.id}
              currencySymbol={currencySymbol}
              language={language as 'ar' | 'en'}
              colors={colors}
            />

            {/* Widget 1 & 2 & 3: Goals, Debts and Picture */}
            <GoalsDebtsSections
              goals={goals}
              debts={debts}
              plan={plan}
              walletTransactions={walletTransactions}
              selectedWalletId={selectedWallet?.id}
              currencySymbol={currencySymbol}
              language={language as 'ar' | 'en'}
              colors={colors}
            />

            {/* Widget 4: AI Smart Financial Tip of the Day */}
            <View
              style={{
                backgroundColor: Colors.primary + '0a',
                borderWidth: 1,
                borderColor: Colors.primary + '20',
                borderRadius: 20,
                padding: 16,
                gap: 6,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: Colors.primary + '18',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="bulb-outline" size={22} color={Colors.primary} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'Cairo_600SemiBold',
                  fontSize: 12,
                  color: Colors.text,
                  lineHeight: 18,
                  textAlign: 'left',
                  marginLeft: 10,
                }}
              >
                {getSmartTip()}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>


      {/* Premium Hamburger Menu Drawer Modal */}
      <Modal
        visible={isMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View style={[styles.drawerOverlay, { flexDirection: language === 'ar' ? 'row' : 'row-reverse' }]}>
          <Pressable 
            style={styles.drawerBackdrop} 
            onPress={() => setIsMenuOpen(false)} 
          />
          <View style={[styles.drawerSheet, { borderLeftWidth: language === 'ar' ? 1 : 0, borderRightWidth: language === 'ar' ? 0 : 1 }]}>
            <View style={styles.drawerHeader}>
              <Image 
                source={require('../../assets/images/icon.png')} 
                style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 8 }} 
                resizeMode="contain"
              />
              <Text style={styles.drawerAppName}>MIZAN</Text>
              <Text style={[styles.drawerVersion, { color: '#14B8A6', fontFamily: 'Cairo_600SemiBold' }]}>مِيزان</Text>
              <Text style={styles.drawerVersion}>v1.0.0</Text>
            </View>

            <View style={styles.drawerDivider} />

            <ScrollView 
              style={{ flex: 1, marginVertical: 8 }} 
              contentContainerStyle={{ gap: 8 }} 
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/challenges');
                }}
              >
                <Ionicons name="trophy-outline" size={22} color={Colors.primary} />
                <Text style={styles.drawerLinkText}>
                  {language === 'ar' ? 'تحديات الادخار والأوسمة' : 'Challenges & Badges'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/recurring-list');
                }}
              >
                <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
                <Text style={styles.drawerLinkText}>
                  {language === 'ar' ? 'المصاريف والفواتير المتكررة' : 'Recurring Subscriptions'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/(tabs)/financial-plan');
                }}
              >
                <Ionicons name="flag-outline" size={22} color={Colors.primary} />
                <Text style={styles.drawerLinkText}>
                  {language === 'ar' ? 'الخطة المالية الذكية' : 'Smart Financial Plan'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/debts');
                }}
              >
                <Ionicons name="people-outline" size={22} color={Colors.primary} />
                <Text style={styles.drawerLinkText}>
                  {language === 'ar' ? 'الديون والسلف الشخصية' : 'Personal Debts & Loans'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/savings-goals');
                }}
              >
                <Ionicons name="heart-outline" size={22} color={Colors.primary} />
                <Text style={styles.drawerLinkText}>
                  {language === 'ar' ? 'أهداف الادخار وحصالات العمليات' : 'Smart Savings Goals'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/ai-advisor' as any);
                }}
              >
                <Ionicons name="sparkles-outline" size={22} color={Colors.primary} />
                <Text style={styles.drawerLinkText}>
                  {language === 'ar' ? 'مستشار الذكاء الاصطناعي' : 'AI Financial Advisor'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/zakat-calculator' as any);
                }}
              >
                <Ionicons name="calculator-outline" size={22} color={Colors.primary} />
                <Text style={styles.drawerLinkText}>
                  {language === 'ar' ? 'حساب الزكاة والصدقات' : 'Zakat & Charity Calculator'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/(tabs)/stats');
                }}
              >
                <Ionicons name="analytics-outline" size={22} color={Colors.primary} />
                <Text style={styles.drawerLinkText}>
                  {language === 'ar' ? 'تحليل الميزانية والرسوم' : 'Budget Analytics'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/settings');
                }}
              >
                <Ionicons name="settings-outline" size={22} color={Colors.primary} />
                <Text style={styles.drawerLinkText}>
                  {language === 'ar' ? 'إعدادات التطبيق والأمان' : 'Settings & Security'}
                </Text>
              </Pressable>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.drawerCloseBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setIsMenuOpen(false)}
            >
              <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
              <Text style={styles.drawerCloseText}>
                {language === 'ar' ? 'إغلاق القائمة' : 'Close Menu'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Custom Adjust Amount Modal */}
      {adjustingItem && (
        <Modal transparent visible animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.adjustModalContent}>
              <Text style={styles.adjustModalTitle}>
                {language === 'ar' ? 'تعديل قيمة الفاتورة' : 'Adjust Bill Amount'}
              </Text>
              <Text style={styles.adjustModalSub}>
                {getCategoryName(adjustingItem.category, language)}
              </Text>
              <View style={styles.adjustInputRow}>
                <TextInput
                  style={styles.adjustInput}
                  keyboardType="decimal-pad"
                  autoFocus
                  value={adjustAmount}
                  onChangeText={setAdjustAmount}
                  textAlign="center"
                />
                <Text style={styles.adjustCurrency}>{currencySymbol}</Text>
              </View>
              <View style={styles.adjustModalActions}>
                <Pressable 
                  style={[styles.adjustBtn, styles.adjustBtnCancel]}
                  onPress={() => setAdjustingItem(null)}
                >
                  <Text style={styles.adjustBtnTextCancel}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
                </Pressable>
                <Pressable 
                  style={[styles.adjustBtn, styles.adjustBtnConfirm]}
                  onPress={handleSaveAdjustedAmount}
                >
                  <Text style={styles.adjustBtnTextConfirm}>{language === 'ar' ? 'حفظ وتسجيل' : 'Save & Log'}</Text>
                </Pressable>
              </View>

            </View>
          </View>
        </Modal>
      )}

      {/* Smart Bank SMS Modal */}
      <SmartSmsModal
        visible={detectedSms !== null}
        smsData={detectedSms}
        onSave={handleSaveDetectedSms}
        onEdit={handleEditDetectedSms}
        onDismiss={handleDismissDetectedSms}
      />

      {/* Undo Toast Notification */}
      {undoState && (
        <UndoSnackbar
          visible={undoState.visible}
          message={undoState.message}
          onUndo={undoState.action}
          onDismiss={() => setUndoState(null)}
        />
      )}
    </LinearGradient>
  );
}



const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  greeting: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'left',
  },
  headerTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.text,
    textAlign: 'left',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 34,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  currency: {
    fontSize: 16,
    fontFamily: 'Cairo_400Regular',
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  summaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  summaryValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  walletsSection: {
    marginTop: 16,
    paddingLeft: 20,
  },
  walletsScroll: {
    paddingRight: 20,
    gap: 10,
    paddingVertical: 4,
  },
  walletCard: {
    width: 110,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  walletCurrency: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
  },
  addWalletCard: {
    width: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
    borderWidth: 2,
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
  },
  addWalletIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWalletText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
  },
  progressSection: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressPercent: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  progressNote: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'left',
  },
  recentSection: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: colors.text,
  },
  seeAll: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: colors.textTertiary,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
    gap: 2,
  },
  transactionCat: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.text,
  },
  transactionDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  transactionAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  transactionDate: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  welcomeEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  welcomeTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  welcomeSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  welcomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 12,
  },
  welcomeButtonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  challengesCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  challengesGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
    gap: 12,
  },
  challengesInfo: {
    flex: 1,
    gap: 4,
  },
  challengesTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
    textAlign: 'left',
  },
  challengesSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'left',
    lineHeight: 18,
  },
  pendingSection: {
    marginTop: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  pendingScroll: {
    gap: 12,
    paddingRight: 20,
    paddingVertical: 4,
  },
  pendingItemCard: {
    width: 240,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  pendingItemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingItemName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  pendingItemAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.expense,
  },
  pendingItemDate: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'left',
  },
  pendingItemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  pendingActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnApprove: {
    backgroundColor: colors.primary,
  },
  btnAdjust: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  btnSkip: {
    backgroundColor: colors.expense + '10',
  },
  pendingActionText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.text,
  },
  pendingActionTextAdjust: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.primary,
  },
  pendingActionTextSkip: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.expense,
  },
  
  // Custom Adjust Modal Styles
  adjustModalContent: {
    width: '85%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  adjustModalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  adjustModalSub: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -8,
  },
  adjustInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 60,
    width: '100%',
    gap: 10,
  },
  adjustInput: {
    flex: 1,
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.text,
  },
  adjustCurrency: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.textSecondary,
  },
  adjustModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  adjustBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustBtnCancel: {
    backgroundColor: colors.surfaceAlt,
  },
  adjustBtnConfirm: {
    backgroundColor: colors.primary,
  },
  adjustBtnTextCancel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  adjustBtnTextConfirm: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Health Score & Forecast Styles
  healthCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scoreBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    textAlign: 'center',
  },
  healthInfo: {
    flex: 1,
    gap: 2,
  },
  healthTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    textAlign: 'left',
  },
  healthStatus: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'left',
    lineHeight: 16,
  },
  forecastContainer: {
    marginTop: 12,
    gap: 8,
  },
  forecastDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    width: '100%',
    marginBottom: 4,
  },
  forecastHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  forecastHeaderTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
    textAlign: 'left',
  },
  forecastMessage: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
    lineHeight: 18,
  },
  reductionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF980012',
    borderWidth: 1,
    borderColor: '#FF980030',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 4,
  },
  reductionText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#D48000',
    textAlign: 'left',
    lineHeight: 16,
  },

  // 3D Metallic Wallet Cards Styles
  wallet3DCard: {
    width: 270,
    height: 160,
    borderRadius: 20,
    elevation: 6,
    backgroundColor: colors.surface,
  },
  wallet3DCardSelected: {
    borderWidth: 2,
    borderColor: colors.text,
    elevation: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
  },
  cardGradient: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardWalletName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
    textAlign: 'left',
  },
  cardWalletType: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'left',
  },
  chipContainer: {
    marginTop: 0,
  },
  simChip: {
    width: 28,
    height: 20,
    borderRadius: 5,
    opacity: 0.85,
  },
  cardNumber: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 2,
    marginVertical: 2,
    textAlign: 'left',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardBalanceLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    textAlign: 'left',
    lineHeight: 12,
  },
  cardBalanceText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: colors.text,
    textAlign: 'left',
    lineHeight: 22,
  },
  cardExpiry: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.text,
    textAlign: 'right',
  },
  addWallet3DCard: {
    width: 140,
    height: 160,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt + '40',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  addWalletIcon3DWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWallet3DText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
  },

  // Mockup Overhaul Styles
  topHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.border,
  },
  twoColumnSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 24,
    marginBottom: 24,
  },
  healthCard2Col: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 160,
  },
  forecastCard2Col: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
    height: 160,
  },
  cardHeaderTitle2Col: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textSecondary,
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  healthCircleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  healthScoreCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreNumber: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
  },
  healthBadge2Col: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthBadgeText2Col: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  forecastSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  forecastSubLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 8,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    textAlign: 'left',
  },
  forecastValueText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
    textAlign: 'left',
  },
  forecastNetFlowText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    textAlign: 'right',
  },
  chartContainer: {
    marginVertical: 6,
    height: 26,
    justifyContent: 'center',
  },
  chartXAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  xAxisLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 8,
    color: colors.textTertiary,
  },
  forecastDetailCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    gap: 8,
  },
  forecastDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  forecastDetailTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
    textAlign: 'left',
  },
  forecastDetailMessage: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
    lineHeight: 18,
  },
  seeAllActive: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.primary,
  },
  recentListCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  subLabelBox: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt + "99",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  subLabelText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
  },
  recentItemSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },

  // Bottom Action Menu Sheet Styles
  actionMenuSheet: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    position: 'absolute',
    bottom: 0,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginBottom: 20,
  },
  actionMenuTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  actionMenuOptions: {
    gap: 12,
    marginBottom: 20,
  },
  actionOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOptionInfo: {
    flex: 1,
    gap: 2,
  },
  actionOptionName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    textAlign: 'left',
  },
  actionOptionDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'left',
    lineHeight: 14,
  },
  actionMenuCloseBtn: {
    backgroundColor: '#EF444415',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuCloseText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#EF4444',
  },

  // Hamburger Drawer Menu Styles
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawerSheet: {
    width: 290,
    height: '100%',
    backgroundColor: colors.surface,
    padding: 24,
    paddingTop: 60,
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderColor: colors.border,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  drawerHeader: {
    alignItems: 'center',
    marginTop: 10,
  },
  drawerLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  drawerAppName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    letterSpacing: 2,
    color: colors.text,
  },
  drawerVersion: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginVertical: 20,
  },
  drawerLinksContainer: {
    flex: 1,
    gap: 12,
  },
  drawerLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  drawerLinkText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  drawerCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF444415',
    gap: 8,
    marginBottom: 20,
  },
  drawerCloseText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#EF4444',
  },
  forecastBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    textAlign: 'center',
  },
  consolidatedCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  consolidatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  syncStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncStatusText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  notifBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 9,
    color: '#FFF',
    lineHeight: 12,
  },
  consolidatedLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  consolidatedValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: colors.text,
  },
});
