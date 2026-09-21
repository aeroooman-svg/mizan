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
import ConfirmModal from '@/components/ConfirmModal';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import MonthlyDigestModal from '@/components/MonthlyDigestModal';
import { getCategoryName, formatDateLocalized } from '@/lib/i18n';
import { getBudgetsForWallet } from '@/lib/budgetStorage';
import { predictCashflow, calculateHealthScore } from '@/lib/financialEngine';
import { getGoals, SavingsGoal } from '@/lib/goalStorage';
import { getDebts, Debt } from '@/lib/debtStorage';
import { getFinancialPlan, FinancialPlan } from '@/lib/planStorage';
import { RecurringTransaction } from '@/lib/recurringStorage';
import QuickGlanceWidget from '@/components/QuickGlanceWidget';
import CurrencyConverterModal from '@/components/CurrencyConverterModal';
import { getExchangeRates, convertAmount } from '@/lib/currencyApi';
import { getWidgetData } from '@/lib/widgetDataProvider';
import { subscribeSyncStatus, SyncState, getLoggedInUser } from '@/lib/syncService';
import { syncAllSharedWallets } from '@/lib/sharingService';
import WalletCarousel from '@/components/home/WalletCarousel';
import ConsolidatedBalanceCard from '@/components/home/ConsolidatedBalanceCard';
import HealthForecastRow from '@/components/home/HealthForecastRow';
import PendingRecurringSection from '@/components/home/PendingRecurringSection';
import ActivePlanSection from '@/components/home/ActivePlanSection';
import GoalsDebtsSections from '@/components/home/GoalsDebtsSections';
import FinancialJourneySlider from '@/components/home/FinancialJourneySlider';
import UndoSnackbar from '@/components/UndoSnackbar';
import SkeletonPlaceholder, { SkeletonCard } from '@/components/SkeletonPlaceholder';
import { checkAndPromptReview, recordFirstOpen } from '@/lib/reviewService';
import VoiceTransactionModal from '@/components/VoiceTransactionModal';
import getHomeStyles from '@/components/home/homeStyles';
import HomeMenuDrawer from '@/components/home/HomeMenuDrawer';

import { getUnreadNotificationsCount } from '@/lib/smartNotifications';
import { checkClipboardForBankSMS, markClipboardTextProcessed, saveParsedSmsTransaction } from '@/lib/clipboardSmsService';
import ClipboardSmsPromptModal from '@/components/home/ClipboardSmsPromptModal';
import { ParsedBankSMS } from '@/lib/smsParser';

export default function HomeScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getHomeStyles(colors), [colors]);
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
  const isAr = language === 'ar';
  const isMl = language === 'ml' || language === 'hi';
  const loc = (ar: string, en: string, ml?: string) => {
    if (isMl) return ml || en;
    if (isAr) return ar;
    return en;
  };
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Record first open & check for in-app review prompt
  useEffect(() => {
    recordFirstOpen();
    if (transactions.length > 0) {
      checkAndPromptReview(transactions.length);
    }
  }, [transactions.length]);

  useEffect(() => {
    const unsub = subscribeSyncStatus((state) => {
      setSyncState(state);
    });
    return () => unsub();
  }, []);

  // Calculate unread notification count directly synchronized with Notifications screen
  const computeUnreadCount = useCallback(async () => {
    try {
      const unread = await getUnreadNotificationsCount({
        transactions,
        wallets,
        selectedWallet,
        totalIncome,
        totalExpense,
        balance,
        pendingRecurring,
        currencySymbol,
        language,
      });
      setUnreadNotifCount(unread);
    } catch (e) {
      setUnreadNotifCount(0);
    }
  }, [transactions, wallets, selectedWallet, totalIncome, totalExpense, balance, pendingRecurring, currencySymbol, language]);

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
    } catch (e) { }
  }, []);

  const [detectedSms, setDetectedSms] = useState<{ text: string; parsed: ParsedBankSMS } | null>(null);

  const checkClipboard = useCallback(async () => {
    try {
      const detected = await checkClipboardForBankSMS();
      if (detected) {
        setDetectedSms(detected);
      }
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      computeUnreadCount();
      loadWidgetConfig();
      checkClipboard();
    }, [computeUnreadCount, loadWidgetConfig, checkClipboard])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkClipboard();
      }
    });
    return () => sub.remove();
  }, [checkClipboard]);

  const handleConfirmClipboardSms = async (targetWalletId: string) => {
    if (!detectedSms) return;
    try {
      await saveParsedSmsTransaction(detectedSms.parsed, targetWalletId);
      refresh();
      setDetectedSms(null);
    } catch (e) {
      Alert.alert(loc('خطأ', 'Error'), loc('تعذر تسجيل المعاملة', 'Failed to save transaction'));
    }
  };

  const handleDismissClipboardSms = async () => {
    if (detectedSms) {
      await markClipboardTextProcessed(detectedSms.text);
      setDetectedSms(null);
    }
  };

  const [adjustingItem, setAdjustingItem] = useState<RecurringTransaction | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadRates() {
      const liveRates = await getExchangeRates();
      setRates(liveRates);
    }
    loadRates();

    const hasShared = wallets.some((w: any) => w.shareCode || w.sharedWith || w.isJoined);
    if (!hasShared) return;

    const interval = setInterval(async () => {
      try {
        const res = await syncAllSharedWallets();
        if (res && res.changed) {
          refresh();
        }
      } catch (e) { }
    }, 15000);

    return () => clearInterval(interval);
  }, [refresh, wallets]);

  const getWalletBalance = (walletId: string) => {
    const targetW = wallets.find(w => w.id === walletId);
    if (!targetW) return 0;

    const walletTxns = transactions.filter(t =>
      t.walletId === walletId ||
      (t.type === 'transfer' && t.toWalletId === walletId)
    );
    const income = walletTxns
      .filter(t => t.type === 'income' || (t.type === 'transfer' && t.toWalletId === walletId))
      .reduce((sum, t) => {
        if (t.type === 'transfer' && t.toWalletId === walletId) {
          const fromW = wallets.find(w => w.id === t.walletId);
          const fromCurrency = fromW ? fromW.currency : targetW.currency;
          return sum + convertAmount(t.amount, fromCurrency, targetW.currency, rates);
        }
        return sum + t.amount;
      }, 0);
    const expense = walletTxns
      .filter(t => t.type === 'expense' || (t.type === 'transfer' && t.walletId === walletId))
      .reduce((sum, t) => sum + t.amount, 0);
    return (targetW.initialBalance || 0) + income - expense;
  };

  const walletPending = useMemo(() => {
    if (!selectedWallet) return [];
    return pendingRecurring.filter(p => p.walletId === selectedWallet.id);
  }, [pendingRecurring, selectedWallet]);

  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [isForecastExpanded, setIsForecastExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCurrencyConverterOpen, setIsCurrencyConverterOpen] = useState(false);
  const [isMonthlyDigestOpen, setIsMonthlyDigestOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [undoState, setUndoState] = useState<{ visible: boolean; message: string; action: () => void } | null>(null);

  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);

  useEffect(() => {
    async function checkUser() {
      try {
        const user = await getLoggedInUser();
        setCurrentUser(user);
      } catch (err) {
        if (__DEV__) console.error('Error fetching logged in user:', err);
      }
    }
    checkUser();
  }, []);

  const loadExtraData = async () => {
    try {
      const [goalsData, debtsData, planData] = await Promise.all([
        getGoals(),
        getDebts(),
        getFinancialPlan(selectedWallet?.id)
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
      if (__DEV__) console.error('Error loading extra homepage data:', err);
    }
  };

  useEffect(() => {
    loadExtraData();
  }, [selectedWallet, walletTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadExtraData();
    }, [selectedWallet?.id])
  );

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
    const tipsMl = [
      "💡 റൗണ്ട്-അപ്പ് ഓൺ: ഓരോ ഇടപാടും അടുത്ത 10-ലേക്ക് റൗണ്ട് ചെയ്യപ്പെടുകയും വ്യത്യാസം സമ്പാദ്യ കുടുക്കയിലേക്ക് മാറ്റപ്പെടുകയും ചെയ്യും!",
      "💡 ബജറ്റ് മുന്നറിയിപ്പ്: ഏതെങ്കിലും വിഭാഗത്തിലെ ബജറ്റ് കഴിഞ്ഞാൽ സാമ്പത്തിക അച്ചടക്കത്തിനായി പെനാൽറ്റി തുക സമ്പാദ്യത്തിലേക്ക് പോകും.",
      "💡 സമ്പാദ്യ ടിപ്പ്: ചെലവഴിക്കുന്നതിന് മുൻപ് മാസ വരുമാനത്തിന്റെ 20% സമ്പാദ്യമായി മാറ്റിവെക്കുക (50/30/20 നിയമം).",
      "💡 ക്യാഷ്ഫ്ലോ വിവരം: നിങ്ങളുടെ വാലറ്റ് ബാലൻസ് സുരക്ഷിതമാണ്. കമ്മി വരാതിരിക്കാൻ നിലവിലെ ചെലവ് രീതി തുടരുക.",
      "💡 കടങ്ങൾ തീർക്കാൻ: ചെറിയ കടങ്ങൾ ആദ്യം അടച്ചുതീർക്കുന്നത് (സ്നോബോൾ രീതി) മുഴുവൻ ബാധ്യതകളും തീർക്കാനുള്ള ആത്മവിശ്വാസം നൽകും."
    ];
    const score = healthScore || 70;
    const idx = Math.min(tipsAr.length - 1, Math.floor((100 - score) / 20));
    if (isMl) return tipsMl[idx];
    if (language === 'ar') return tipsAr[idx];
    return tipsEn[idx];
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

    let total = 0;
    wallets.forEach(w => {
      if (w.excludeFromTotal) return; // Exclude wallet if setting enabled
      const bal = getWalletBalance(w.id);
      const converted = Object.keys(rates).length > 0
        ? convertAmount(bal, w.currency, selectedWallet.currency, rates)
        : bal;
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

  const [confirmModalState, setConfirmModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => { } });

  const handleDeleteWallet = (id: string, name: string) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch { }
    const title = loc('حذف المحفظة', 'Delete Wallet', 'വാലറ്റ് നീക്കം ചെയ്യുക');
    const message = loc(
      `هل أنت متأكد من حذف محفظة "${name}"؟\nسيتم حذف جميع المعاملات والميزانيات والأقساط والأهداف المرتبطة بهذه المحفظة نهائياً.`,
      `Are you sure you want to delete "${name}"? All related transactions, budgets, installments, and goals will be permanently deleted.`,
      `"${name}" എന്ന വാലറ്റ് നീക്കം ചെയ്യണമെന്ന് ഉറപ്പാണോ? ഇതിലുള്ള എല്ലാ ഇടപാടുകളും ബജറ്റുകളും ഗോളുകളും ശാശ്വതമായി മായ്ക്കപ്പെടും.`
    );

    setConfirmModalState({
      visible: true,
      title,
      message,
      confirmText: loc('حذف المحفظة', 'Delete Wallet', 'വാലറ്റ് നീക്കം ചെയ്യുക'),
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalState(prev => ({ ...prev, visible: false }));
        await removeWallet(id);
      }
    });
  };

  const handleApproveConfirm = async (item: RecurringTransaction) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await approveRecurringTransaction(item);
    setUndoState({
      visible: true,
      message: loc(`تم تأكيد مصروف ${getCategoryName(item.category, language)} بنجاح`, 'Transaction confirmed successfully', `${getCategoryName(item.category, language)} ഇടപാട് വിജയകരമായി സ്ഥിരീകരിച്ചു`),
      action: () => { },
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
      Alert.alert(loc('خطأ', 'Error', 'പിശക്'), loc('الرجاء إدخال مبلغ صحيح', 'Please enter a valid amount', 'സാധുവായ തുക നൽകുക'));
      return;
    }
    if (adjustingItem) {
      await approveRecurringTransaction(adjustingItem, amt);
      setUndoState({
        visible: true,
        message: loc('تم تعديل وتأكيد الفاتورة بنجاح', 'Adjusted bill confirmed', 'മാറ്റിയ ബിൽ തുക സ്ഥിരീകരിച്ചു'),
        action: () => { },
      });
    }
    setAdjustingItem(null);
  };

  const handleApproveSkip = async (item: RecurringTransaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await approveRecurringTransaction(item, undefined, true);
    setUndoState({
      visible: true,
      message: loc(`تم تخطي مصروف ${getCategoryName(item.category, language)}`, 'Transaction skipped', `${getCategoryName(item.category, language)} ഇടപാട് ഒഴിവാക്കി`),
      action: () => { },
    });
  };

  if (!isLoading && wallets.length === 0) {
    return (
      <LinearGradient
        colors={theme === 'dark' ? ['#070B14', '#0D1424', '#05070B'] : ['#F8FAFC', '#F1F5F9', '#E2E8F0']}
        style={styles.container}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 160 + (insets.bottom || 0), flexGrow: 1 }}
        >
          <View style={styles.topHeaderBar}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsMenuOpen(true);
              }}
              style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="menu-outline" size={24} color={colors.text} />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.topBarTitle, { color: colors.text }]}>MIZAN</Text>
              <View style={[
                styles.syncStatusBadge,
                { backgroundColor: syncState === 'synced' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)' }
              ]}>
                <View style={[
                  styles.syncStatusDot,
                  { backgroundColor: syncState === 'synced' ? '#10B981' : '#F59E0B' }
                ]} />
                <Text style={[
                  styles.syncStatusText,
                  { color: syncState === 'synced' ? '#10B981' : '#FBBF24' }
                ]}>
                  {syncState === 'synced' ? loc('متزامن', 'Synced', 'സിങ്ക് ചെയ്തു') : loc('محلي', 'Local', 'ലോക്കൽ')}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Pressable
                onPress={() => router.push('/notifications')}
                style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="notifications-outline" size={24} color={colors.text} />
                {unreadNotifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="settings-sharp" size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Top Center Logo Emblem */}
          <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 14 }}>
            <View
              style={{
                width: 140,
                height: 140,
                borderRadius: 30,
                overflow: 'hidden',
                backgroundColor: '#0A1D30',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                borderWidth: 1.5,
                borderColor: 'rgba(16, 185, 129, 0.3)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <Image
                source={require('../../assets/images/splash-icon.png')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Clean Harmonious First-Time Welcome Card */}
          <View style={{ paddingHorizontal: 16 }}>
            <LinearGradient
              colors={['#111A2E', '#0B132B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 22,
                borderWidth: 1.5,
                borderColor: 'rgba(16, 185, 129, 0.3)',
                shadowColor: '#10B981',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.2,
                shadowRadius: 20,
                elevation: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 22, color: '#FFF', textAlign: 'center', marginBottom: 8 }}>
                {loc('مرحباً بك في مِيزان ⚖️', 'Welcome to MIZAN ⚖️', 'മീസാനിലേക്ക് സ്വാഗതം ⚖️')}
              </Text>

              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10, marginBottom: 20 }}>
                {loc(
                  'مساعدك المالي الذكي لإدارة مصاريفك، المحافظ المتعددة، والادخار بسهولة وأمان.',
                  'Your intelligent multi-currency financial assistant to track expenses and manage wallets effortlessly.',
                  'നിങ്ങളുടെ ചെലവുകളും ഒന്നിലധികം വാലറ്റുകളും അനായാസം കൈകാര്യം ചെയ്യുന്ന സ്മാർട്ട് സാമ്പത്തിക സഹായി.'
                )}
              </Text>

              {/* Action Buttons */}
              <View style={{ width: '100%', gap: 10 }}>
                <Pressable
                  onPress={handleAddWallet}
                  style={({ pressed }) => [{
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#10B981',
                    borderRadius: 16,
                    paddingVertical: 15,
                    gap: 8,
                    shadowColor: '#10B981',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    elevation: 5,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  }]}
                >
                  <Ionicons name="add-circle" size={22} color="#FFF" />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: '#FFF' }}>
                    {loc('إنشاء محفظتك الأولى', 'Create Your First Wallet', 'നിങ്ങളുടെ ആദ്യ വാലറ്റ് ഉണ്ടാക്കുക')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/join-wallet')}
                  style={({ pressed }) => [{
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 16,
                    paddingVertical: 13,
                    gap: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                    opacity: pressed ? 0.8 : 1,
                  }]}
                >
                  <Ionicons name="people-outline" size={18} color="#FFF" />
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 14, color: '#FFF' }}>
                    {loc('الانضمام لمحفظة عبر كود', 'Join Shared Wallet via Code', 'കോഡ് വഴി ഷെയേർഡ് വാലറ്റിൽ ചേരുക')}
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>

          {/* Quick Feature Highlights Cards */}
          <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 15, color: colors.text, textAlign: 'left', marginBottom: 2 }}>
              {loc('لماذا تختار مِيزان؟ ⚖️', 'Why Choose MIZAN? ⚖️', 'എന്തുകൊണ്ട് മീസാൻ തിരഞ്ഞെടുക്കണം? ⚖️')}
            </Text>

            {/* Feature 1: AI Smart Robot Advisor */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#6366F118', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="hardware-chip-outline" size={22} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text, textAlign: 'left' }}>
                    {loc('روبوت ومستشار AI الذكي 🤖', 'Smart AI Robot Advisor 🤖', 'സ്മാർട്ട് AI റോബോട്ട് ഉപദേശകൻ 🤖')}
                  </Text>
                </View>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: 'left', marginTop: 2 }}>
                  {loc(
                    'تحليل عاداتك المالية لحظياً، قراءة رسائل البنك ومسح الفواتير بالذكاء الاصطناعي.',
                    'Real-time spending analysis, auto bank SMS parsing, and OCR receipt scanning.',
                    'തത്സമയ ചെലവ് വിശകലനം, ബാങ്ക് SMS റീഡിംഗ്, AI ബിൽ സ്കാനിംഗ്.'
                  )}
                </Text>
              </View>
            </View>

            {/* Feature 2: Spending Heatmap */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EF444418', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flame-outline" size={22} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text, textAlign: 'left' }}>
                  {loc('خريطة الإنفاق الحرارية (Heatmap) 🔥', 'Daily Spending Heatmap 🔥', 'പ്രതിദിന ചെലവ് ഹീറ്റ്‌മാപ്പ് 🔥')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: 'left', marginTop: 2 }}>
                  {loc(
                    'تقويم حراري بصري يكشف أيام ذروة الصرف وأيام الادخار الهادئة لميزانية متوازنة.',
                    'Visual calendar heatmap revealing peak spending and quiet saving days.',
                    'കൂടുതൽ ചെലവും കുറഞ്ഞ ചെലവുമുള്ള ദിവസങ്ങൾ കൃത്യമായി മനസ്സിലാക്കാൻ വിഷ്വൽ കലണ്ടർ.'
                  )}
                </Text>
              </View>
            </View>

            {/* Feature 3: Smooth Curve Chart & Forecast */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#06B6D418', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trending-up-outline" size={22} color="#06B6D4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text, textAlign: 'left' }}>
                  {loc('كيرف التدفق والتنبؤ المالي 📈', 'Cashflow Spline & Forecast 📈', 'ക്യാഷ്ഫ്ലോ പ്രവചന ചാർട്ട് 📈')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: 'left', marginTop: 2 }}>
                  {loc(
                    'منحنى بياني ذكي يتنبأ برصيدك المستقبلي ومسار نمو ثروتك لـ 30 يوماً قادمة.',
                    'Dynamic spline curves projecting your upcoming 30-day cashflows and net worth.',
                    'അടുത്ത 30 ദിവസത്തെ പണലഭ്യതയും ബാക്കി തുകയും മുൻകൂട്ടി പ്രവചിക്കുന്ന സ്മാർട്ട് ഗ്രാഫ്.'
                  )}
                </Text>
              </View>
            </View>

            {/* Feature 4: Multi-Currency Wallets */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#10B98118', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="card-outline" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text, textAlign: 'left' }}>
                  {loc('تعدد المحافظ والعملات الحية 💳', 'Multi-Currency Live Wallets 💳', 'ഒന്നിലധികം കറൻസികൾ & വാലറ്റുകൾ 💳')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: 'left', marginTop: 2 }}>
                  {loc(
                    'إدارة مصاريفك بالجنيه، الروبية الهندية (₹)، الدولار، والريال مع تحويل فوري حقيقي.',
                    'Manage wallets in EGP, INR ₹, USD, SAR with live currency conversion.',
                    'ഇന്ത്യൻ രൂപ (₹), ഡോളർ, റിയാൽ തുടങ്ങി വിവിധ കറൻസികളിൽ ലൈവ് എക്സ്ചേഞ്ചോടെ ഇടപാടുകൾ നടത്തുക.'
                  )}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <HomeMenuDrawer
          visible={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          language={language}
          colors={colors}
          onOpenMonthlyReport={() => setIsMonthlyDigestOpen(true)}
          onOpenConverterModal={() => setIsCurrencyConverterOpen(true)}
        />
      </LinearGradient>
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
        contentContainerStyle={{ paddingBottom: 140 + (insets.bottom || 0) }}
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
            <Ionicons name="menu-outline" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.topBarTitle, { color: colors.text }]}>MIZAN</Text>
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
                {syncState === 'synced' ? loc('متزامن', 'Synced', 'സിങ്ക് ചെയ്തു') :
                  syncState === 'syncing' ? loc('جاري المزامنة...', 'Syncing...', 'സിങ്ക് ചെയ്യുന്നു...') :
                    loc('محلي', 'Local', 'ലോക്കൽ')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/notifications');
              }}
              style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
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
              <Ionicons name="settings-outline" size={24} color={colors.text} />
            </Pressable>
          </View>
        </View>


        {/* 3D Bank Credit Cards Carousel */}
        <WalletCarousel
          wallets={wallets}
          selectedWallet={selectedWallet}
          transactions={transactions}
          currentUser={currentUser}
          language={language}
          colors={colors}
          healthScore={healthScore}
          onSelectWallet={selectWallet}
          onEditWallet={handleEditWallet}
          onDeleteWallet={handleDeleteWallet}
          onAddWallet={handleAddWallet}
        />

        {/* Quick Glance Widget (Expense / Voice / Income Action Buttons) */}
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
            language={language}
            onAddPress={() => router.push('/add-transaction')}
            onVoicePress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setIsVoiceModalOpen(true);
            }}
          />
        )}

        {/* Pending Recurring Bills Confirmation Widget */}
        <PendingRecurringSection
          walletPending={walletPending}
          currencySymbol={currencySymbol}
          language={language}
          colors={colors}
          wallets={wallets}
          onApproveConfirm={handleApproveConfirm}
          onApproveSkip={handleApproveSkip}
          onSaveAdjustedAmount={(item, amt) => approveRecurringTransaction(item, amt)}
        />

        {/* Horizontal Financial Journey Slider (Financial Pulse, Balance Picture, Goals) */}
        {selectedWallet && (
          <FinancialJourneySlider
            plan={plan}
            goals={goals}
            debts={debts}
            budgets={budgets}
            walletTransactions={walletTransactions}
            selectedWalletId={selectedWallet?.id}
            totalConsolidatedBalance={totalConsolidatedBalance}
            totalIncomeVal={totalIncome}
            totalExpenseVal={totalExpense}
            healthScore={healthScore}
            currencySymbol={currencySymbol}
            language={language}
            colors={colors}
            onOpenConverterModal={() => setIsCurrencyConverterOpen(true)}
            onOpenMonthlyReport={() => setIsMonthlyDigestOpen(true)}
          />
        )}

      </ScrollView>


      <HomeMenuDrawer
          visible={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          language={language}
          colors={colors}
          onOpenMonthlyReport={() => setIsMonthlyDigestOpen(true)}
          onOpenConverterModal={() => setIsCurrencyConverterOpen(true)}
        />

      {/* Custom Adjust Amount Modal */}
      {adjustingItem && (
        <Modal transparent visible animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.adjustModalContent}>
              <Text style={styles.adjustModalTitle}>
                {loc('تعديل قيمة الفاتورة', 'Adjust Bill Amount', 'ബിൽ തുക മാറ്റുക')}
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
                  <Text style={styles.adjustBtnTextCancel}>{loc('إلغاء', 'Cancel', 'റദ്ദാക്കുക')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.adjustBtn, styles.adjustBtnConfirm]}
                  onPress={handleSaveAdjustedAmount}
                >
                  <Text style={styles.adjustBtnTextConfirm}>{loc('حفظ وتسجيل', 'Save & Log', 'സേവ് ചെയ്ത് രേഖപ്പെടുത്തുക')}</Text>
                </Pressable>
              </View>

            </View>
          </View>
        </Modal>
      )}

      {/* Monthly Financial Digest Modal */}
      <MonthlyDigestModal
        visible={isMonthlyDigestOpen}
        transactions={walletTransactions}
        selectedWallet={selectedWallet}
        currencySymbol={currencySymbol}
        language={language as 'ar' | 'en'}
        onClose={() => setIsMonthlyDigestOpen(false)}
      />

      {/* Live Currency Converter Modal */}
      <CurrencyConverterModal
        visible={isCurrencyConverterOpen}
        onClose={() => setIsCurrencyConverterOpen(false)}
      />

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        visible={confirmModalState.visible}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmText={confirmModalState.confirmText}
        isDestructive={confirmModalState.isDestructive}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState(prev => ({ ...prev, visible: false }))}
      />

      {/* Smart Voice Entry Modal */}
      <VoiceTransactionModal
        visible={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSuccess={() => {
          refresh();
        }}
      />

      {/* Smart Clipboard Bank SMS Prompt Modal */}
      <ClipboardSmsPromptModal
        visible={!!detectedSms}
        data={detectedSms}
        onConfirm={handleConfirmClipboardSms}
        onDismiss={handleDismissClipboardSms}
        wallets={wallets}
        selectedWallet={selectedWallet}
        language={language}
      />

      
    </LinearGradient>
  );
}
