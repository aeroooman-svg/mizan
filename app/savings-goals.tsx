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
  Switch,
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { useTheme } from '@/lib/ThemeContext';
import { formatCurrency } from '@/lib/categories';
import { formatDateLocalized } from '@/lib/i18n';
import {
  getGoals,
  saveGoal,
  deleteGoal,
  addFundsToGoal,
  getRules,
  saveRule,
  deleteRule,
  SavingsGoal,
  SavingsRule,
} from '@/lib/goalStorage';
import { getJameyas, Jameya } from '@/lib/jameyaStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SavingsGoalsScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const insets = useSafeAreaInsets();
  const { language, t } = useLanguage();
  const isAr = language === 'ar';
  const { wallets, selectedWallet, addTransaction, currencySymbol } = useTransactions();

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [rules, setRules] = useState<SavingsRule[]>([]);
  const [jameyas, setJameyas] = useState<Jameya[]>([]);
  const [activeTab, setActiveTab] = useState<'goals' | 'rules' | 'jameya'>('goals');

  // Add/Edit Goal Modal states
  const [addGoalVisible, setAddGoalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [goalWalletId, setGoalWalletId] = useState(selectedWallet?.id || '');

  // Add Rule Modal states
  const [addRuleVisible, setAddRuleVisible] = useState(false);
  const [ruleType, setRuleType] = useState<'round_up' | 'weekly_transfer' | 'penalty'>('round_up');
  const [ruleAmount, setRuleAmount] = useState('');
  const [ruleGoalId, setRuleGoalId] = useState('');
  const [ruleWalletId, setRuleWalletId] = useState(selectedWallet?.id || '');

  // Manual Transaction (Deposit / Withdraw) modal
  const [manualVisible, setManualVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [manualAmount, setManualAmount] = useState('');
  const [manualType, setManualType] = useState<'deposit' | 'withdraw'>('deposit');
  const [manualWalletId, setManualWalletId] = useState(selectedWallet?.id || '');

  const loadAllData = async () => {
    const [gList, rList, jList] = await Promise.all([getGoals(), getRules(), getJameyas()]);
    setGoals(gList);
    setRules(rList);
    setJameyas(jList || []);
    if (gList.length > 0 && !ruleGoalId) {
      setRuleGoalId(gList[0].id);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Executive Totals Computation
  const totalSavedAll = useMemo(() => goals.reduce((s, g) => s + (g.savedAmount || 0), 0), [goals]);
  const totalJameyaSaved = useMemo(() => {
    return jameyas.reduce((sum, j) => {
      const paid = Math.min(j.paidMonthsCount || 0, j.totalMonths || 0);
      return sum + (paid * (j.monthlyAmount || 0));
    }, 0);
  }, [jameyas]);
  const totalTargetAll = useMemo(() => goals.reduce((s, g) => s + (g.targetAmount || 0), 0), [goals]);
  const remainingAll = Math.max(0, totalTargetAll - totalSavedAll);
  const overallProgressPct = totalTargetAll > 0 ? Math.min(100, Math.round((totalSavedAll / totalTargetAll) * 100)) : 0;
  const activeRulesCount = useMemo(() => rules.filter(r => r.isActive !== false).length, [rules]);

  // Goal Modal Handlers
  const handleOpenAddGoal = () => {
    Haptics.selectionAsync();
    setEditingGoal(null);
    setGoalName('');
    setTargetAmount('');
    setDeadline('');
    setGoalWalletId(selectedWallet?.id || (wallets[0]?.id || ''));
    setAddGoalVisible(true);
  };

  const handleOpenEditGoal = (goal: SavingsGoal) => {
    Haptics.selectionAsync();
    setEditingGoal(goal);
    setGoalName(goal.name);
    setTargetAmount(goal.targetAmount.toString());
    setDeadline(goal.deadline || '');
    setGoalWalletId(goal.walletId);
    setAddGoalVisible(true);
  };

  const handleSaveGoal = async () => {
    if (!goalName.trim()) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إدخال اسم الهدف' : 'Please enter goal name');
      return;
    }
    const target = parseFloat(targetAmount);
    if (isNaN(target) || target <= 0) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إدخال مبلغ مستهدف صحيح' : 'Please enter valid target amount');
      return;
    }
    if (!goalWalletId) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى اختيار محفظة' : 'Please select a wallet');
      return;
    }

    if (editingGoal) {
      const updated: SavingsGoal = {
        ...editingGoal,
        name: goalName.trim(),
        targetAmount: target,
        deadline: deadline.trim() || '',
        walletId: goalWalletId,
      };
      await saveGoal(updated);
    } else {
      const newGoal: SavingsGoal = {
        id: Crypto.randomUUID(),
        name: goalName.trim(),
        targetAmount: target,
        savedAmount: 0,
        deadline: deadline.trim() || '',
        walletId: goalWalletId,
        createdAt: new Date().toISOString(),
      };
      await saveGoal(newGoal);
    }

    setAddGoalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadAllData();
  };

  const handleToggleRule = async (rule: SavingsRule) => {
    Haptics.selectionAsync();
    const updated = { ...rule, isActive: !rule.isActive };
    await saveRule(updated);
    await loadAllData();
  };

  const handleAddRule = async () => {
    if (!ruleGoalId) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى تحديد هدف الادخار' : 'Please select a target goal');
      return;
    }
    const amt = parseFloat(ruleAmount);
    if (ruleType !== 'round_up' && (isNaN(amt) || amt <= 0)) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إدخال مبلغ صحيح' : 'Please enter valid amount');
      return;
    }

    const newRule: SavingsRule = {
      id: Crypto.randomUUID(),
      type: ruleType,
      amount: ruleType === 'round_up' ? 10 : amt,
      targetGoalId: ruleGoalId,
      walletId: ruleWalletId || wallets[0]?.id || '',
      isActive: true,
    };

    await saveRule(newRule);
    setAddRuleVisible(false);
    setRuleAmount('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadAllData();
  };

  const handleDeleteRule = (id: string) => {
    const confirmMsg = isAr ? 'هل أنت متأكد من حذف هذه القاعدة الذكية؟' : 'Are you sure you want to delete this rule?';

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        deleteRule(id).then(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          loadAllData();
        });
      }
      return;
    }

    Alert.alert(
      isAr ? 'حذف القاعدة' : 'Delete Rule',
      confirmMsg,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            await deleteRule(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await loadAllData();
          }
        }
      ]
    );
  };

  const handleDeleteGoal = (id: string, goalNameStr?: string) => {
    const confirmMsg = isAr
      ? `هل أنت متأكد من حذف هدف الادخار "${goalNameStr || ''}"؟ سيتم حذف القواعد المرتبطة به أيضاً.`
      : `Deleting this goal will also delete its linked rules. Proceed?`;

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        deleteGoal(id).then(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          loadAllData();
        });
      }
      return;
    }

    Alert.alert(
      isAr ? 'حذف الهدف' : 'Delete Goal',
      confirmMsg,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            await deleteGoal(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await loadAllData();
          }
        }
      ]
    );
  };

  const handleManualTransaction = async () => {
    if (!selectedGoal) return;
    const val = parseFloat(manualAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى إدخال مبلغ صحيح' : 'Please enter valid amount');
      return;
    }

    const diff = manualType === 'deposit' ? val : -val;
    const updated = await addFundsToGoal(selectedGoal.id, diff);
    if (updated) {
      const walletTxType = manualType === 'deposit' ? 'expense' : 'income';
      const descAr = manualType === 'deposit'
        ? `ادخار يدوي لهدف: ${selectedGoal.name}`
        : `سحب مدخرات من هدف: ${selectedGoal.name}`;
      const descEn = manualType === 'deposit'
        ? `Manual saving for goal: ${selectedGoal.name}`
        : `Withdraw savings from goal: ${selectedGoal.name}`;

      await addTransaction({
        id: Crypto.randomUUID(),
        walletId: manualWalletId,
        type: walletTxType,
        amount: val,
        category: 'investment',
        description: isAr ? descAr : descEn,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      setManualVisible(false);
      setManualAmount('');
      setSelectedGoal(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadAllData();
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
              router.replace('/(tabs)');
            }
          }}
          hitSlop={15}
          style={styles.headerBackBtn}
        >
          <Ionicons name={isAr ? "chevron-forward" : "chevron-back"} size={22} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isAr ? '🎯 أهداف الادخار والحصالات' : '🎯 Savings Goals & Jars'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {isAr ? 'خطة ادخار ذكية لتحقيق طموحاتك المالية' : 'Smart savings targets & automated rules'}
          </Text>
        </View>

        <Pressable
          onPress={activeTab === 'goals' ? handleOpenAddGoal : () => {
            if (goals.length === 0) {
              Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إضافة هدف ادخار أولاً لربط القواعد به' : 'Please create a goal first');
              return;
            }
            setRuleGoalId(goals[0].id);
            setRuleWalletId(selectedWallet?.id || wallets[0].id);
            setAddRuleVisible(true);
          }}
          style={styles.headerAddBtn}
          hitSlop={10}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 90 }]}
      >
        {/* Executive Dashboard Overview Banner (Like Jameya) */}
        <LinearGradient
          colors={
            theme === 'dark'
              ? ['#78350F', '#451A03', '#0B132B']
              : ['#FEF3C7', '#FDE68A', '#EFF6FF']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.heroPositionBadge}>
                <Ionicons name="trophy" size={15} color="#F59E0B" />
                <Text style={styles.heroPositionText}>
                  {isAr ? `إجمالي نسبة الإنجاز: ${overallProgressPct}%` : `Overall Achievement: ${overallProgressPct}%`}
                </Text>
              </View>

              <Text style={[styles.heroMainAmount, { color: theme === 'dark' ? '#FFF' : '#78350F' }]}>
                {formatCurrency(totalSavedAll)} <Text style={styles.heroCurrencySymbol}>{currencySymbol}</Text>
              </Text>
            </View>

            <View style={[styles.heroIconBadge, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)' }]}>
              <MaterialCommunityIcons name="piggy-bank-outline" size={32} color="#F59E0B" />
            </View>
          </View>

          {/* Sub Metrics Grid (3 Pill Cards) */}
          <View style={styles.heroSubGrid}>
            <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' }]}>
              <View style={styles.heroSubCardHeader}>
                <Ionicons name="flag-outline" size={13} color="#F59E0B" />
                <Text style={styles.heroSubLabel}>{isAr ? 'المستهدف الكلي' : 'Total Target'}</Text>
              </View>
              <Text style={[styles.heroSubVal, { color: colors.text }]}>
                {formatCurrency(totalTargetAll)} <Text style={{ fontSize: 9 }}>{currencySymbol}</Text>
              </Text>
              <Text style={styles.heroSubCount}>
                {goals.length} {isAr ? 'أهداف' : 'goals'}
              </Text>
            </View>

            <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' }]}>
              <View style={styles.heroSubCardHeader}>
                <Ionicons name="hourglass-outline" size={13} color="#3B82F6" />
                <Text style={styles.heroSubLabel}>{isAr ? 'المتبقي للوصول' : 'Remaining'}</Text>
              </View>
              <Text style={[styles.heroSubVal, { color: '#3B82F6' }]}>
                {formatCurrency(remainingAll)} <Text style={{ fontSize: 9 }}>{currencySymbol}</Text>
              </Text>
              <Text style={styles.heroSubCount}>
                {100 - overallProgressPct}% {isAr ? 'متبقي' : 'left'}
              </Text>
            </View>

            <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' }]}>
              <View style={styles.heroSubCardHeader}>
                <Ionicons name="flash-outline" size={13} color="#10B981" />
                <Text style={styles.heroSubLabel}>{isAr ? 'قواعد ذكية' : 'Smart Rules'}</Text>
              </View>
              <Text style={[styles.heroSubVal, { color: '#10B981' }]}>
                {activeRulesCount}
              </Text>
              <Text style={styles.heroSubCount}>
                {rules.length} {isAr ? 'إجمالي' : 'total'}
              </Text>
            </View>

            {totalJameyaSaved > 0 && (
              <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.75)' }]}>
                <View style={styles.heroSubCardHeader}>
                  <Ionicons name="gift-outline" size={13} color="#0D7C66" />
                  <Text style={styles.heroSubLabel}>{isAr ? 'مدخر الجمعيات' : 'ROSCA Saved'}</Text>
                </View>
                <Text style={[styles.heroSubVal, { color: '#0D7C66' }]}>
                  {formatCurrency(totalJameyaSaved)} <Text style={{ fontSize: 9 }}>{currencySymbol}</Text>
                </Text>
                <Text style={styles.heroSubCount}>
                  {jameyas.length} {isAr ? 'جمعيات' : 'circles'}
                </Text>
              </View>
            )}
          </View>

          {/* Progress Bar inside Hero Banner */}
          <View style={styles.heroProgressBarContainer}>
            <View style={styles.heroProgressBarTrack}>
              <View style={[styles.heroProgressBarFill, { width: `${overallProgressPct}%` }]} />
            </View>
          </View>

          {/* Milestone Tag */}
          <View style={styles.heroNoticeTag}>
            <Ionicons name="sparkles" size={15} color="#F59E0B" />
            <Text style={styles.heroNoticeText} numberOfLines={1}>
              {overallProgressPct >= 100
                ? (isAr ? '🎉 مبروك! حققت 100% من أهدافك الادخارية الحالية!' : '🎉 Congratulations! 100% of goals achieved!')
                : (isAr
                    ? `أنت على بعد ${formatCurrency(remainingAll)} ${currencySymbol} من إكمال خطتك الادخارية!`
                    : `You are ${formatCurrency(remainingAll)} ${currencySymbol} away from your goal!`)}
            </Text>
          </View>
        </LinearGradient>

        {/* Action Shortcut Banner */}
        <Pressable
          onPress={handleOpenAddGoal}
          style={({ pressed }) => [
            styles.createActionBanner,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={styles.createActionLeft}>
            <View style={[styles.createActionIcon, { backgroundColor: '#F59E0B18' }]}>
              <Ionicons name="add-circle" size={26} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.createActionTitle, { color: colors.text }]}>
                {isAr ? 'إنشاء هدف ادخار جديد' : 'Create New Savings Goal'}
              </Text>
              <Text style={[styles.createActionSubtitle, { color: colors.textSecondary }]}>
                {isAr ? 'حدد حصالة لهدفك (سفر، جهاز، طوارئ) بمستهدف وتاريخ' : 'Set a target amount, date & linked wallet'}
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
              setActiveTab('goals');
            }}
            style={[styles.tabBtn, activeTab === 'goals' && styles.tabBtnActive]}
          >
            <Ionicons
              name="trophy-outline"
              size={16}
              color={activeTab === 'goals' ? '#F59E0B' : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'goals' && { color: colors.text, fontFamily: 'Cairo_700Bold' }]}>
              {isAr ? 'أهداف الادخار' : 'Goals'}
            </Text>
            <View style={[styles.tabBadge, { backgroundColor: activeTab === 'goals' ? '#F59E0B20' : colors.surfaceAlt }]}>
              <Text style={[styles.tabBadgeText, { color: activeTab === 'goals' ? '#F59E0B' : colors.textTertiary }]}>
                {goals.length}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('jameya');
            }}
            style={[styles.tabBtn, activeTab === 'jameya' && styles.tabBtnActive]}
          >
            <Ionicons
              name="gift-outline"
              size={16}
              color={activeTab === 'jameya' ? '#0D7C66' : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'jameya' && { color: colors.text, fontFamily: 'Cairo_700Bold' }]}>
              {isAr ? 'الجمعيات' : 'ROSCAs'}
            </Text>
            <View style={[styles.tabBadge, { backgroundColor: activeTab === 'jameya' ? '#0D7C6620' : colors.surfaceAlt }]}>
              <Text style={[styles.tabBadgeText, { color: activeTab === 'jameya' ? '#0D7C66' : colors.textTertiary }]}>
                {jameyas.length}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('rules');
            }}
            style={[styles.tabBtn, activeTab === 'rules' && styles.tabBtnActive]}
          >
            <Ionicons
              name="flash-outline"
              size={16}
              color={activeTab === 'rules' ? '#10B981' : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'rules' && { color: colors.text, fontFamily: 'Cairo_700Bold' }]}>
              {isAr ? 'القواعد' : 'Rules'}
            </Text>
            <View style={[styles.tabBadge, { backgroundColor: activeTab === 'rules' ? '#10B98120' : colors.surfaceAlt }]}>
              <Text style={[styles.tabBadgeText, { color: activeTab === 'rules' ? '#10B981' : colors.textTertiary }]}>
                {rules.length}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* SECTION 1: GOALS LIST */}
        {activeTab === 'goals' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                {isAr ? 'قائمة الحصالات النشطة' : 'Active Savings Targets'}
              </Text>
              <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
                ({goals.length})
              </Text>
            </View>

            {goals.length === 0 ? (
              <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.emptyIconCircle, { backgroundColor: '#F59E0B18' }]}>
                  <Ionicons name="trophy-outline" size={48} color="#F59E0B" />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {isAr ? 'لا توجد أهداف ادخار مسجلة بعد' : 'No Savings Goals Set Yet'}
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  {isAr
                    ? 'ابدأ الآن وحدد هدفك (مثل: صندوق طوارئ، شراء لابتوب، سفرية) وسنساعدك على تحقيقه خطوة بخطوة!'
                    : 'Set a savings goal (Emergency fund, laptop, travel) and start saving step-by-step!'}
                </Text>
                <Pressable onPress={handleOpenAddGoal} style={[styles.emptyBtn, { backgroundColor: '#F59E0B' }]}>
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.emptyBtnText}>{isAr ? 'إنشاء أول هدف ادخار' : 'Create First Goal'}</Text>
                </Pressable>
              </View>
            ) : (
              goals.map(goal => {
                const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
                const wallet = wallets.find(w => w.id === goal.walletId);
                const remainingAmt = Math.max(0, goal.targetAmount - goal.savedAmount);
                const isFinished = pct >= 100;

                return (
                  <View
                    key={goal.id}
                    style={[
                      styles.cardContainer,
                      { backgroundColor: colors.card, borderColor: isFinished ? '#10B98140' : colors.border },
                    ]}
                  >
                    {/* Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={[styles.avatarCircle, { backgroundColor: isFinished ? '#10B98120' : '#F59E0B20' }]}>
                          <Ionicons
                            name={isFinished ? "checkmark-done-circle" : "trophy"}
                            size={22}
                            color={isFinished ? '#10B981' : '#F59E0B'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                            {goal.name}
                          </Text>
                          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                            {isAr ? 'المستهدف:' : 'Target:'} {formatCurrency(goal.targetAmount)} {currencySymbol}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardHeaderRight}>
                        {isFinished ? (
                          <View style={[styles.statusBadge, { backgroundColor: '#10B98118' }]}>
                            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                            <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>
                              {isAr ? 'مكتمل ✅' : 'Achieved ✅'}
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.statusBadge, { backgroundColor: '#F59E0B18' }]}>
                            <Text style={[styles.statusBadgeText, { color: '#F59E0B' }]}>
                              {pct}%
                            </Text>
                          </View>
                        )}

                        <Pressable
                          onPress={() => handleOpenEditGoal(goal)}
                          style={[styles.cardIconBtn, { backgroundColor: colors.surfaceAlt }]}
                          hitSlop={8}
                        >
                          <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                        </Pressable>

                        <Pressable
                          onPress={() => handleDeleteGoal(goal.id, goal.name)}
                          style={[styles.cardIconBtn, { backgroundColor: '#EF444415' }]}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>

                    {/* 3-Pill Financial Metrics Grid */}
                    <View style={[styles.cardMetricsGrid, { backgroundColor: colors.surfaceAlt }]}>
                      <View style={styles.cardMetricItem}>
                        <Text style={[styles.cardMetricLabel, { color: colors.textSecondary }]}>
                          {isAr ? 'المستهدف' : 'Target'}
                        </Text>
                        <Text style={[styles.cardMetricValue, { color: colors.text }]}>
                          {formatCurrency(goal.targetAmount)} <Text style={{ fontSize: 9 }}>{currencySymbol}</Text>
                        </Text>
                      </View>

                      <View style={styles.cardMetricItem}>
                        <Text style={[styles.cardMetricLabel, { color: colors.textSecondary }]}>
                          {isAr ? 'المدخر حالياً' : 'Saved'}
                        </Text>
                        <Text style={[styles.cardMetricValue, { color: isFinished ? '#10B981' : '#F59E0B' }]}>
                          {formatCurrency(goal.savedAmount)} <Text style={{ fontSize: 9 }}>{currencySymbol}</Text>
                        </Text>
                      </View>

                      <View style={styles.cardMetricItem}>
                        <Text style={[styles.cardMetricLabel, { color: colors.textSecondary }]}>
                          {isAr ? 'المتبقي' : 'Remaining'}
                        </Text>
                        <Text style={[styles.cardMetricValue, { color: isFinished ? '#10B981' : colors.primary, fontFamily: 'Cairo_700Bold' }]}>
                          {formatCurrency(remainingAmt)} <Text style={{ fontSize: 9 }}>{currencySymbol}</Text>
                        </Text>
                      </View>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.progressSection}>
                      <View style={styles.progressHeader}>
                        <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                          {isAr ? 'نسبة التحقيق:' : 'Progress:'} {pct}%
                        </Text>
                        <Text style={[styles.progressDetail, { color: colors.textTertiary }]}>
                          {formatCurrency(goal.savedAmount)} / {formatCurrency(goal.targetAmount)} {currencySymbol}
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: colors.borderLight || colors.surfaceAlt }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: isFinished ? '#10B981' : '#F59E0B',
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Footer Tags */}
                    <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                      {goal.deadline ? (
                        <View style={[styles.footerPill, { backgroundColor: colors.surfaceAlt }]}>
                          <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                          <Text style={[styles.footerPillText, { color: colors.textSecondary }]}>
                            {isAr ? 'الموعد:' : 'Target:'} {goal.deadline}
                          </Text>
                        </View>
                      ) : null}

                      {wallet && (
                        <View style={[styles.footerPill, { backgroundColor: colors.surfaceAlt }]}>
                          <MaterialIcons name={wallet.icon as any} size={13} color={wallet.color} />
                          <Text style={[styles.footerPillText, { color: colors.textSecondary }]}>
                            {wallet.name}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Prominent Action Button: Deposit / Withdraw */}
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedGoal(goal);
                        setManualWalletId(goal.walletId);
                        setManualVisible(true);
                      }}
                      style={({ pressed }) => [
                        styles.mainActionBtn,
                        {
                          backgroundColor: isFinished ? '#10B981' : '#F59E0B',
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="wallet-outline" size={18} color="#FFF" />
                      <Text style={styles.mainActionBtnText}>
                        {isAr ? '💰 إيداع أو سحب من الحصالة' : '💰 Deposit or Withdraw Funds'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* SECTION 2: SMART RULES */}
        {activeTab === 'rules' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                {isAr ? 'القواعد الذكية لتسريع الادخار' : 'Smart Automated Rules'}
              </Text>
              <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
                ({rules.length})
              </Text>
            </View>

            {rules.length === 0 ? (
              <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.emptyIconCircle, { backgroundColor: '#10B98118' }]}>
                  <Ionicons name="flash-outline" size={48} color="#10B981" />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {isAr ? 'لا توجد قواعد ادخار نشطة' : 'No Active Smart Rules'}
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  {isAr
                    ? 'فّعل "حصالة الفكة" لتقريب المعاملات، أو خصّص اقتطاعاً أسبوعياً آلياً لتسريع الوصول لأهدافك!'
                    : 'Activate Round-up or automated weekly transfers to boost your savings seamlessly!'}
                </Text>
                <Pressable
                  onPress={() => {
                    if (goals.length === 0) {
                      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إضافة هدف ادخار أولاً لربط القواعد به' : 'Please create a goal first');
                      return;
                    }
                    setRuleGoalId(goals[0].id);
                    setRuleWalletId(selectedWallet?.id || wallets[0].id);
                    setAddRuleVisible(true);
                  }}
                  style={[styles.emptyBtn, { backgroundColor: '#10B981' }]}
                >
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.emptyBtnText}>{isAr ? 'إضافة قاعدة ذكية' : 'Add Smart Rule'}</Text>
                </Pressable>
              </View>
            ) : (
              rules.map(rule => {
                const targetGoal = goals.find(g => g.id === rule.targetGoalId);
                const wallet = wallets.find(w => w.id === rule.walletId);

                return (
                  <View
                    key={rule.id}
                    style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={[styles.avatarCircle, { backgroundColor: '#10B98118' }]}>
                          <Ionicons
                            name={rule.type === 'round_up' ? 'wallet' : rule.type === 'weekly_transfer' ? 'repeat' : 'warning'}
                            size={20}
                            color="#10B981"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, { color: colors.text }]}>
                            {rule.type === 'round_up'
                              ? (isAr ? '🪙 حصالة الفكة والكسور (Round-up)' : 'Round-up Change')
                              : rule.type === 'weekly_transfer'
                              ? (isAr ? `🔄 تحويل أسبوعي آلي (${rule.amount} ${currencySymbol})` : `Weekly fixed saving (${rule.amount})`)
                              : (isAr ? `⚠️ عقوبة تجاوز الميزانية (${rule.amount} ${currencySymbol})` : `Budget Exceeded Penalty (${rule.amount})`)}
                          </Text>
                          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                            🎯 {isAr ? 'الهدف:' : 'Goal:'} {targetGoal?.name || (isAr ? 'غير محدد' : 'Not set')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardHeaderRight}>
                        <Switch
                          value={rule.isActive}
                          onValueChange={() => handleToggleRule(rule)}
                          trackColor={{ false: colors.border, true: '#10B98180' }}
                          thumbColor={rule.isActive ? '#10B981' : colors.textTertiary}
                        />
                        <Pressable
                          onPress={() => handleDeleteRule(rule.id)}
                          style={[styles.cardIconBtn, { backgroundColor: '#EF444415' }]}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>

                    {wallet && (
                      <View style={[styles.footerPill, { backgroundColor: colors.surfaceAlt, alignSelf: 'flex-start', marginTop: 4 }]}>
                        <MaterialIcons name={wallet.icon as any} size={13} color={wallet.color} />
                        <Text style={[styles.footerPillText, { color: colors.textSecondary }]}>
                          {isAr ? 'خصم من:' : 'From:'} {wallet.name}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* SECTION 3: JAMEYAS (ROSCAs) LIST */}
        {activeTab === 'jameya' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                {isAr ? 'الجمعيات المالية النشطة' : 'Active ROSCA Money Circles'}
              </Text>
              <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
                ({jameyas.length})
              </Text>
            </View>

            {jameyas.length === 0 ? (
              <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.emptyIconCircle, { backgroundColor: '#0D7C6618' }]}>
                  <Ionicons name="gift-outline" size={32} color="#0D7C66" />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {isAr ? 'لا توجد جمعيات نشطة حالياً' : 'No Active Circles'}
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  {isAr
                    ? 'الجمعيات وسيلة تعاونية ممتازة للادخار واستلام مبالغ كبيرة بدون فوائد. أضف جمعيتك الآن لتتبعها بسهولة!'
                    : 'ROSCAs are great for cooperative savings. Add your first money circle now to track it!'}
                </Text>
                <Pressable
                  onPress={() => router.push('/jameya' as any)}
                  style={[styles.emptyBtn, { backgroundColor: '#0D7C66' }]}
                >
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.emptyBtnText}>
                    {isAr ? 'إضافة جمعية جديدة' : 'Add New Circle'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              jameyas.map((j) => {
                const paidCount = Math.min(j.paidMonthsCount || 0, j.totalMonths || 0);
                const circleSaved = paidCount * (j.monthlyAmount || 0);
                const totalPot = (j.totalMonths || 0) * (j.monthlyAmount || 0);
                const pct = totalPot > 0 ? Math.min(100, Math.round((circleSaved / totalPot) * 100)) : 0;
                const isComplete = paidCount >= j.totalMonths;
                const wallet = wallets.find(w => w.id === j.walletId);

                return (
                  <View
                    key={j.id}
                    style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={[styles.avatarCircle, { backgroundColor: '#0D7C6618' }]}>
                          <Ionicons name="gift-outline" size={20} color="#0D7C66" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, { color: colors.text }]}>
                            {j.name}
                          </Text>
                          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                            {isAr
                              ? `قسط شهري: ${formatCurrency(j.monthlyAmount)} ${currencySymbol}`
                              : `Monthly: ${formatCurrency(j.monthlyAmount)} ${currencySymbol}`}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.statusBadge, { backgroundColor: isComplete ? '#10B98120' : '#0D7C6620' }]}>
                        <Text style={[styles.statusBadgeText, { color: isComplete ? '#10B981' : '#0D7C66' }]}>
                          {isComplete
                            ? (isAr ? 'مكتملة 🎉' : 'Completed')
                            : (isAr ? `${paidCount}/${j.totalMonths} أشهر` : `${paidCount}/${j.totalMonths} mo`)}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.progressSection}>
                      <View style={styles.progressHeader}>
                        <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                          {isAr ? 'المدخر حتى الآن:' : 'Saved so far:'} {formatCurrency(circleSaved)} {currencySymbol}
                        </Text>
                        <Text style={[styles.progressDetail, { color: colors.textTertiary }]}>
                          {pct}%
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: colors.borderLight || colors.surfaceAlt }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: isComplete ? '#10B981' : '#0D7C66',
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Footer Tags */}
                    <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                      {j.payoutMonth ? (
                        <View style={[styles.footerPill, { backgroundColor: colors.surfaceAlt }]}>
                          <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                          <Text style={[styles.footerPillText, { color: colors.textSecondary }]}>
                            {isAr ? `شهر القبض: الـ ${j.payoutMonth}` : `Payout: Mo ${j.payoutMonth}`}
                          </Text>
                        </View>
                      ) : null}

                      {wallet && (
                        <View style={[styles.footerPill, { backgroundColor: colors.surfaceAlt }]}>
                          <MaterialIcons name={wallet.icon as any} size={13} color={wallet.color} />
                          <Text style={[styles.footerPillText, { color: colors.textSecondary }]}>
                            {wallet.name}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Action button to manage circle */}
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push('/jameya' as any);
                      }}
                      style={({ pressed }) => [
                        styles.mainActionBtn,
                        {
                          backgroundColor: '#0D7C66',
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="settings-outline" size={16} color="#FFF" />
                      <Text style={styles.mainActionBtnText}>
                        {isAr ? 'إدارة الجمعية وتسديد الأقساط' : 'Manage Circle & Payments'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <Pressable
        onPress={
          activeTab === 'goals'
            ? handleOpenAddGoal
            : activeTab === 'jameya'
            ? () => router.push('/jameya' as any)
            : () => {
                if (goals.length === 0) {
                  Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إضافة هدف ادخار أولاً' : 'Please create a goal first');
                  return;
                }
                setRuleGoalId(goals[0].id);
                setRuleWalletId(selectedWallet?.id || wallets[0]?.id || '');
                setRuleAmount('');
                setAddRuleVisible(true);
              }
        }
        style={[
          styles.floatingAddBtn,
          { backgroundColor: activeTab === 'goals' ? '#F59E0B' : activeTab === 'jameya' ? '#0D7C66' : '#10B981', bottom: Math.max(insets.bottom + 20, 30) },
        ]}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </Pressable>

      {/* MODAL 1: Add/Edit Goal */}
      <Modal visible={addGoalVisible} animationType="slide" transparent onRequestClose={() => setAddGoalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingGoal
                    ? (isAr ? 'تعديل هدف الادخار' : 'Edit Savings Goal')
                    : (isAr ? 'إنشاء هدف ادخار جديد' : 'New Savings Goal')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                  {isAr ? 'حدد المبلغ والهدف لتتبع تقدمك المالي' : 'Set your financial milestone'}
                </Text>
              </View>
              <Pressable onPress={() => setAddGoalVisible(false)} style={styles.modalCloseBtn} hitSlop={15}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'ما الذي تدخر لأجله؟' : 'Goal Name'} *
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  placeholder={isAr ? 'مثال: شراء لابتوب، سفرية، صندوق طوارئ...' : 'e.g. Emergency Fund, Laptop'}
                  placeholderTextColor={colors.textTertiary}
                  value={goalName}
                  onChangeText={setGoalName}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'المبلغ المستهدف الإجمالي' : 'Target Amount'} ({currencySymbol}) *
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'تاريخ الاستحقاق (اختياري)' : 'Target Date (Optional)'}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  value={deadline}
                  onChangeText={setDeadline}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'المحفظة المرتبطة للخصم والادخار' : 'Linked Wallet'} *
                </Text>
                <View style={styles.walletsRow}>
                  {wallets.map(w => (
                    <Pressable
                      key={w.id}
                      onPress={() => setGoalWalletId(w.id)}
                      style={[
                        styles.walletSelectorCard,
                        { backgroundColor: colors.surfaceAlt },
                        goalWalletId === w.id && { borderColor: w.color, borderWidth: 2, backgroundColor: w.color + '15' }
                      ]}
                    >
                      <MaterialIcons name={w.icon as any} size={16} color={w.color} />
                      <Text style={[styles.walletSelectorText, { color: colors.textSecondary }, goalWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                        {w.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={handleSaveGoal}
                style={[styles.saveBtn, { backgroundColor: '#F59E0B' }]}
              >
                <Text style={styles.saveBtnText}>
                  {editingGoal ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إنشاء وتفعيل الهدف 🎯' : 'Create Goal 🎯')}
                </Text>
              </Pressable>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Add Rule */}
      <Modal visible={addRuleVisible} animationType="slide" transparent onRequestClose={() => setAddRuleVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{isAr ? 'إضافة قاعدة ادخار ذكية' : 'New Smart Savings Rule'}</Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                  {isAr ? 'أتمتة الادخار مع كل معاملة' : 'Automate your savings habits'}
                </Text>
              </View>
              <Pressable onPress={() => setAddRuleVisible(false)} style={styles.modalCloseBtn} hitSlop={15}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{isAr ? 'نوع القاعدة الذكية' : 'Rule Type'}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <Pressable
                    onPress={() => setRuleType('round_up')}
                    style={[styles.quickAmountChip, { backgroundColor: colors.surfaceAlt, borderColor: ruleType === 'round_up' ? '#10B981' : colors.border }, ruleType === 'round_up' && { backgroundColor: '#10B98115' }]}
                  >
                    <Text style={[styles.quickAmountChipText, { color: ruleType === 'round_up' ? '#10B981' : colors.textSecondary }]}>
                      {isAr ? '🪙 حصالة فكة' : 'Round-up'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setRuleType('weekly_transfer')}
                    style={[styles.quickAmountChip, { backgroundColor: colors.surfaceAlt, borderColor: ruleType === 'weekly_transfer' ? '#10B981' : colors.border }, ruleType === 'weekly_transfer' && { backgroundColor: '#10B98115' }]}
                  >
                    <Text style={[styles.quickAmountChipText, { color: ruleType === 'weekly_transfer' ? '#10B981' : colors.textSecondary }]}>
                      {isAr ? '🔄 أسبوعي' : 'Weekly'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setRuleType('penalty')}
                    style={[styles.quickAmountChip, { backgroundColor: colors.surfaceAlt, borderColor: ruleType === 'penalty' ? '#10B981' : colors.border }, ruleType === 'penalty' && { backgroundColor: '#10B98115' }]}
                  >
                    <Text style={[styles.quickAmountChipText, { color: ruleType === 'penalty' ? '#10B981' : colors.textSecondary }]}>
                      {isAr ? '⚠️ عقوبة صرف' : 'Penalty'}
                    </Text>
                  </Pressable>
                </View>

                <View style={{ marginTop: 8, backgroundColor: colors.surfaceAlt, padding: 10, borderRadius: 10 }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.primary, textAlign: 'left' }}>
                    {ruleType === 'round_up'
                      ? (isAr ? '💡 تقريب كل معاملة مصروف لأقرب 10 جنيهات وتحويل الفائض تلقائياً للهدف.' : '💡 Rounds up expenses to nearest 10 units.')
                      : ruleType === 'weekly_transfer'
                        ? (isAr ? '💡 تحويل تلقائي لمبلغ محدد أسبوعياً من المحفظة للادخار.' : '💡 Automated weekly savings transfer.')
                        : (isAr ? '💡 اقتطاع مبلغ كـ "عقوبة تأديبية" للادخار عند تجاوز ميزانية أي فئة.' : '💡 Penalty transfer on budget overspend.')}
                  </Text>
                </View>
              </View>

              {ruleType !== 'round_up' && (
                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{isAr ? 'مبلغ الخصم' : 'Transfer Amount'}</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={ruleAmount}
                    onChangeText={setRuleAmount}
                  />
                </View>
              )}

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{isAr ? 'إيداع في هدف' : 'Target Goal'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {goals.map(g => (
                    <Pressable
                      key={g.id}
                      onPress={() => setRuleGoalId(g.id)}
                      style={[
                        styles.walletSelectorCard,
                        { backgroundColor: colors.surfaceAlt },
                        ruleGoalId === g.id && { borderColor: '#10B981', borderWidth: 2, backgroundColor: '#10B98115' }
                      ]}
                    >
                      <Ionicons name="trophy-outline" size={14} color="#10B981" />
                      <Text style={[styles.walletSelectorText, ruleGoalId === g.id && { color: '#10B981', fontFamily: 'Cairo_700Bold' }]}>
                        {g.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Pressable onPress={handleAddRule} style={[styles.saveBtn, { backgroundColor: '#10B981' }]}>
                <Text style={styles.saveBtnText}>{isAr ? 'حفظ وتفعيل القاعدة الذكية' : 'Save Rule'}</Text>
              </Pressable>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Manual Deposit / Withdraw */}
      <Modal visible={manualVisible} animationType="slide" transparent onRequestClose={() => setManualVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {isAr ? 'تعديل رصيد الحصالة' : 'Deposit / Withdraw'}
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                  {selectedGoal?.name}
                </Text>
              </View>
              <Pressable onPress={() => setManualVisible(false)} style={styles.modalCloseBtn} hitSlop={15}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={[styles.modalForm, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
              {selectedGoal && (
                <View style={[styles.payHeaderSubBox, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={styles.payHeaderSubRow}>
                    <Text style={[styles.payHeaderLabel, { color: colors.textSecondary }]}>
                      {isAr ? 'الرصيد المدخر حالياً:' : 'Current Saved:'}
                    </Text>
                    <Text style={[styles.payHeaderVal, { color: '#F59E0B' }]}>
                      {formatCurrency(selectedGoal.savedAmount)} {currencySymbol}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{isAr ? 'نوع المعاملة' : 'Transaction Type'}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => setManualType('deposit')}
                    style={[
                      styles.quickAmountChip,
                      { flex: 1, alignItems: 'center', backgroundColor: manualType === 'deposit' ? '#10B981' : colors.surfaceAlt, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.quickAmountChipText, { color: manualType === 'deposit' ? '#FFF' : colors.text }]}>
                      {isAr ? '📥 إيداع / ادخار' : '📥 Deposit'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setManualType('withdraw')}
                    style={[
                      styles.quickAmountChip,
                      { flex: 1, alignItems: 'center', backgroundColor: manualType === 'withdraw' ? '#EF4444' : colors.surfaceAlt, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.quickAmountChipText, { color: manualType === 'withdraw' ? '#FFF' : colors.text }]}>
                      {isAr ? '📤 سحب من الحصالة' : '📤 Withdraw'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'المبلغ' : 'Amount'} ({currencySymbol}) *
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={manualAmount}
                  onChangeText={setManualAmount}
                />
              </View>

              <Pressable
                onPress={handleManualTransaction}
                style={[styles.saveBtn, { backgroundColor: manualType === 'deposit' ? '#10B981' : '#EF4444' }]}
              >
                <Text style={styles.saveBtnText}>{isAr ? 'تأكيد وحفظ الحركة' : 'Confirm'}</Text>
              </Pressable>
            </View>
          </View>
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
    fontSize: 18,
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
    backgroundColor: '#F59E0B',
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
    color: '#F59E0B',
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
    marginBottom: 12,
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
  heroProgressBarContainer: {
    marginBottom: 10,
  },
  heroProgressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  heroProgressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  heroNoticeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.75)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroNoticeText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.text,
    textAlign: 'left',
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
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
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
  cardContainer: {
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
  cardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    textAlign: 'left',
  },
  cardSubtitle: {
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
  cardFooter: {
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
