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
import Svg, { Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SavingsGoalsScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const { language, t } = useLanguage();
  const isAr = language === 'ar';
  const { wallets, selectedWallet, addTransaction, currencySymbol } = useTransactions();

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [rules, setRules] = useState<SavingsRule[]>([]);

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
    const [gList, rList] = await Promise.all([getGoals(), getRules()]);
    setGoals(gList);
    setRules(rList);
    if (gList.length > 0 && !ruleGoalId) {
      setRuleGoalId(gList[0].id);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Executive Totals Computation
  const totalSavedAll = useMemo(() => goals.reduce((s, g) => s + (g.savedAmount || 0), 0), [goals]);
  const totalTargetAll = useMemo(() => goals.reduce((s, g) => s + (g.targetAmount || 0), 0), [goals]);
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
    setDeadline(goal.deadline ? goal.deadline.split('T')[0] : '');
    setGoalWalletId(goal.walletId);
    setAddGoalVisible(true);
  };

  const handleSaveGoal = async () => {
    if (!goalName.trim()) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إدخال اسم هدف الادخار' : 'Please enter goal name');
      return;
    }
    const target = parseFloat(targetAmount);
    if (isNaN(target) || target <= 0) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى إدخال مبلغ استثماري/مستهدف صحيح' : 'Please enter valid target amount');
      return;
    }
    if (!goalWalletId) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى تحديد المحفظة المرتبطة' : 'Please select wallet');
      return;
    }

    const goalItem: SavingsGoal = {
      id: editingGoal ? editingGoal.id : Crypto.randomUUID(),
      name: goalName.trim(),
      targetAmount: target,
      savedAmount: editingGoal ? editingGoal.savedAmount : 0,
      deadline: deadline || (editingGoal ? editingGoal.deadline : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      walletId: goalWalletId,
      createdAt: editingGoal ? editingGoal.createdAt : new Date().toISOString(),
    };

    await saveGoal(goalItem);
    setAddGoalVisible(false);
    setEditingGoal(null);
    setGoalName('');
    setTargetAmount('');
    setDeadline('');

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadAllData();
  };

  // Rule Handlers
  const handleAddRule = async () => {
    if (!ruleGoalId) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى اختيار هدف ادخار مرتبط' : 'Please select a savings goal');
      return;
    }

    let parsedAmount = 0;
    if (ruleType !== 'round_up') {
      parsedAmount = parseFloat(ruleAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى إدخال مبلغ صحيح للقاعدة' : 'Please enter a valid rule amount');
        return;
      }
    }

    const newRule: SavingsRule = {
      id: Crypto.randomUUID(),
      type: ruleType,
      amount: parsedAmount || undefined,
      targetGoalId: ruleGoalId,
      walletId: ruleWalletId,
      isActive: true,
    };

    await saveRule(newRule);
    setAddRuleVisible(false);
    setRuleAmount('');

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadAllData();
  };

  const handleToggleRule = async (rule: SavingsRule) => {
    Haptics.selectionAsync();
    const updated = { ...rule, isActive: !rule.isActive };
    await saveRule(updated);
    await loadAllData();
  };

  const handleDeleteRule = (id: string) => {
    const confirmMsg = isAr ? 'هل تريد حذف هذه القاعدة الذكية؟' : 'Are you sure you want to delete this smart rule?';
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
      {/* Top Bar Header */}
      <View style={styles.headerRow}>
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
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        <Text style={styles.headerTitle}>
          {isAr ? '🎯 أهداف الادخار والحصالات' : '🎯 Savings Goals & Jars'}
        </Text>

        <Pressable onPress={handleOpenAddGoal} style={styles.headerAddBtn} hitSlop={10}>
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Executive Dashboard Overview Banner */}
        <View style={styles.heroSummaryCard}>
          <LinearGradient
            colors={['#F59E0B25', '#F59E0B08']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <View style={styles.heroHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.trophyIconCircle}>
                <Ionicons name="trophy" size={22} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.heroTitle}>
                  {isAr ? 'الملخص الادخاري الشامل' : 'Overall Savings Summary'}
                </Text>
                <Text style={styles.heroSubTitle}>
                  {isAr ? `${goals.length} أهداف ادخارية | ${activeRulesCount} قواعد ذكية` : `${goals.length} Goals | ${activeRulesCount} Smart Rules`}
                </Text>
              </View>
            </View>

            <View style={styles.heroProgressBadge}>
              <Text style={styles.heroProgressText}>{overallProgressPct}%</Text>
            </View>
          </View>

          {/* Hero Metrics Row */}
          <View style={styles.heroMetricsGrid}>
            <View style={styles.heroMetricItem}>
              <Text style={styles.heroMetricLabel}>{isAr ? 'إجمالي الموفر بالحصالات:' : 'Total Saved:'}</Text>
              <Text style={[styles.heroMetricValue, { color: colors.income }]}>
                {formatCurrency(totalSavedAll)} {currencySymbol}
              </Text>
            </View>

            <View style={styles.heroMetricDivider} />

            <View style={styles.heroMetricItem}>
              <Text style={styles.heroMetricLabel}>{isAr ? 'إجمالي المبلغ المستهدف:' : 'Total Target:'}</Text>
              <Text style={[styles.heroMetricValue, { color: colors.text }]}>
                {formatCurrency(totalTargetAll)} {currencySymbol}
              </Text>
            </View>
          </View>

          {/* Overall Progress Bar */}
          <View style={styles.heroProgressBarBg}>
            <View style={[styles.heroProgressBarFill, { width: `${overallProgressPct}%` }]} />
          </View>
        </View>

        {/* --- SECTION 1: SAVINGS TARGETS --- */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="flag" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              {isAr ? `الأهداف الحالية (${goals.length})` : `Active Goals (${goals.length})`}
            </Text>
          </View>

          <Pressable onPress={handleOpenAddGoal} style={styles.addBtnSmall}>
            <Ionicons name="add" size={16} color="#FFF" />
            <Text style={styles.addBtnSmallText}>{isAr ? 'هدف جديد' : 'New Goal'}</Text>
          </Pressable>
        </View>

        {goals.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="trophy-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {isAr ? 'لا توجد أهداف ادخار مفعلة بعد' : 'No Savings Goals Set Yet'}
            </Text>
            <Text style={styles.emptySub}>
              {isAr
                ? 'ابدأ الآن وحدد هدفك (مثل: صندوق طوارئ، شراء لابتوب، سفرية) وسنساعدك على تحقيقه بسهولة!'
                : 'Set a savings goal (Emergency fund, laptop, travel) and start saving step-by-step!'}
            </Text>
            <Pressable style={styles.emptyActionBtn} onPress={handleOpenAddGoal}>
              <Ionicons name="add-circle" size={18} color="#FFF" />
              <Text style={styles.emptyActionBtnText}>{isAr ? '+ إنشاء هدف ادخار جديد' : '+ Create Savings Goal'}</Text>
            </Pressable>
          </View>
        ) : (
          goals.map(goal => {
            const pct = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
            const wallet = wallets.find(w => w.id === goal.walletId);
            const remainingAmt = Math.max(0, goal.targetAmount - goal.savedAmount);

            return (
              <View key={goal.id} style={styles.goalCard}>
                {/* Goal Card Header */}
                <View style={styles.goalHeaderRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Ionicons name="trophy-outline" size={18} color="#F59E0B" />
                      <Text style={styles.goalName}>{goal.name}</Text>
                    </View>
                    <Text style={styles.goalTargetText}>
                      {isAr ? `المستهدف الكلي: ${formatCurrency(goal.targetAmount)} ${currencySymbol}` : `Target: ${formatCurrency(goal.targetAmount)} ${currencySymbol}`}
                    </Text>
                  </View>

                  {/* Actions Bar */}
                  <View style={styles.goalActionsRow}>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedGoal(goal);
                        setManualWalletId(goal.walletId);
                        setManualVisible(true);
                      }}
                      style={styles.actionBtnIcon}
                      hitSlop={8}
                    >
                      <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
                    </Pressable>

                    <Pressable
                      onPress={() => handleOpenEditGoal(goal)}
                      style={styles.actionBtnIcon}
                      hitSlop={8}
                    >
                      <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                    </Pressable>

                    <Pressable
                      onPress={() => handleDeleteGoal(goal.id, goal.name)}
                      style={styles.actionBtnIcon}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>

                {/* Progress Bar & Badges */}
                <View style={styles.goalProgressBox}>
                  <View style={styles.progressHeaderRow}>
                    <Text style={styles.progressSavedText}>
                      {isAr ? 'تم توفير:' : 'Saved:'} {formatCurrency(goal.savedAmount)} {currencySymbol}
                    </Text>
                    <View style={styles.pctBadge}>
                      <Text style={styles.pctBadgeText}>{pct}%</Text>
                    </View>
                  </View>

                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: wallet?.color || '#F59E0B' }]} />
                  </View>

                  <View style={styles.progressFooterRow}>
                    <Text style={styles.progressMetaText}>
                      {remainingAmt === 0
                        ? (isAr ? '🎉 تم اكتمل ادخار هذا الهدف بالكامل!' : '🎉 Fully Achieved!')
                        : (isAr ? `متبقي ${formatCurrency(remainingAmt)} ${currencySymbol}` : `${formatCurrency(remainingAmt)} left`)}
                    </Text>

                    <Text style={styles.progressDeadlineText}>
                      📅 {formatDateLocalized(goal.deadline, language)}
                    </Text>
                  </View>
                </View>

                {/* Card Footer Actions & Wallet Tag */}
                <View style={styles.goalFooterRow}>
                  {wallet && (
                    <View style={styles.walletTagChip}>
                      <MaterialIcons name={wallet.icon as any} size={14} color={wallet.color} />
                      <Text style={[styles.walletTagText, { color: wallet.color }]}>{wallet.name}</Text>
                    </View>
                  )}

                  <Pressable
                    style={styles.quickDepositBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedGoal(goal);
                      setManualWalletId(goal.walletId);
                      setManualVisible(true);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                    <Text style={styles.quickDepositBtnText}>{isAr ? 'إيداع / سحب' : 'Deposit / Withdraw'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {/* --- SECTION 2: SMART SAVINGS RULES --- */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="flash" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              {isAr ? `قواعد الادخار الذكي (${rules.length})` : `Smart Rules (${rules.length})`}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              if (goals.length === 0) {
                Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إضافة هدف ادخار أولاً لربط القواعد به' : 'Please create a goal first');
                return;
              }
              setRuleGoalId(goals[0].id);
              setRuleWalletId(selectedWallet?.id || wallets[0].id);
              setAddRuleVisible(true);
            }}
            style={styles.addBtnSmall}
          >
            <Ionicons name="flash-outline" size={15} color="#FFF" />
            <Text style={styles.addBtnSmallText}>{isAr ? 'قاعدة جديدة' : 'New Rule'}</Text>
          </Pressable>
        </View>

        {rules.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="flash-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {isAr ? 'لا توجد قواعد ادخار نشطة' : 'No Active Smart Rules'}
            </Text>
            <Text style={styles.emptySub}>
              {isAr
                ? 'فّعل "حصالة الفكة" لتقريب المعاملات، أو خصّص اقتطاعاً أسبوعياً آلياً لتسريع الوصول لأهدافك!'
                : 'Activate Round-up or automated weekly transfers to boost your savings seamlessly!'}
            </Text>
          </View>
        ) : (
          rules.map(rule => {
            const targetGoal = goals.find(g => g.id === rule.targetGoalId);
            const wallet = wallets.find(w => w.id === rule.walletId);

            return (
              <View key={rule.id} style={styles.ruleCard}>
                <View style={styles.ruleHeaderRow}>
                  <View style={styles.ruleIconCircle}>
                    <Ionicons
                      name={rule.type === 'round_up' ? 'wallet' : rule.type === 'weekly_transfer' ? 'repeat' : 'warning'}
                      size={20}
                      color={colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleTitle}>
                      {rule.type === 'round_up'
                        ? (isAr ? '🪙 حصالة الفكة والكسور (Round-up)' : 'Round-up Change') :
                       rule.type === 'weekly_transfer'
                        ? (isAr ? `🔄 تحويل أسبوعي آلي (${rule.amount} ${currencySymbol})` : `Weekly fixed saving (${rule.amount})`) :
                        (isAr ? `⚠️ عقوبة تجاوز الميزانية (${rule.amount} ${currencySymbol})` : `Budget Exceeded Penalty (${rule.amount})`)}
                    </Text>

                    <Text style={styles.ruleSubDetail}>
                      🎯 {isAr ? 'الحصالة المستهدفة:' : 'Saving to:'} {targetGoal?.name || (isAr ? 'غير محدد' : 'Not set')}
                    </Text>
                    {wallet && (
                      <Text style={styles.ruleSubDetail}>
                        💳 {isAr ? 'من محفظة:' : 'From:'} {wallet.name}
                      </Text>
                    )}
                  </View>

                  <View style={styles.ruleActionsColumn}>
                    <Switch
                      value={rule.isActive}
                      onValueChange={() => handleToggleRule(rule)}
                      trackColor={{ false: colors.border, true: colors.primary + '60' }}
                      thumbColor={rule.isActive ? colors.primary : colors.textTertiary}
                    />

                    <Pressable onPress={() => handleDeleteRule(rule.id)} style={styles.ruleDeleteBtn} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* --- MODAL 1: Add/Edit Goal --- */}
      <Modal visible={addGoalVisible} animationType="slide" transparent onRequestClose={() => setAddGoalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGoal
                  ? (isAr ? 'تعديل هدف الادخار' : 'Edit Savings Goal')
                  : (isAr ? 'إنشاء هدف ادخار جديد' : 'New Savings Goal')}
              </Text>
              <Pressable onPress={() => setAddGoalVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? 'ما الذي تدخر لأجله؟' : 'Goal Name'}</Text>
                <TextInput
                  style={[styles.modalInput, isAr ? styles.modalInputAr : styles.modalInputEn]}
                  placeholder={isAr ? 'مثال: شراء لابتوب، سفرية، صندوق طوارئ...' : 'e.g. Emergency Fund, Laptop'}
                  placeholderTextColor={colors.textTertiary}
                  value={goalName}
                  onChangeText={setGoalName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? 'المبلغ المستهدف الإجمالي' : 'Target Amount'}</Text>
                <TextInput
                  style={[styles.modalInput, isAr ? styles.modalInputAr : styles.modalInputEn]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? 'تاريخ الاستحقاق (YYYY-MM-DD)' : 'Target Date'}</Text>
                <TextInput
                  style={[styles.modalInput, isAr ? styles.modalInputAr : styles.modalInputEn]}
                  placeholder="2027-07-20"
                  placeholderTextColor={colors.textTertiary}
                  value={deadline}
                  onChangeText={setDeadline}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? 'المحفظة المرتبطة للخصم والادخار' : 'Source Wallet'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {wallets.map(w => {
                    const isSelected = goalWalletId === w.id;
                    return (
                      <Pressable
                        key={w.id}
                        onPress={() => setGoalWalletId(w.id)}
                        style={[
                          styles.walletChip,
                          isSelected && { backgroundColor: w.color + '22', borderColor: w.color, borderWidth: 2 }
                        ]}
                      >
                        <MaterialIcons name={w.icon as any} size={16} color={w.color} />
                        <Text style={[styles.walletChipText, isSelected && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                          {w.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <Pressable onPress={handleSaveGoal} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>
                  {editingGoal
                    ? (isAr ? 'حفظ التعديلات 🎯' : 'Update Goal 🎯')
                    : (isAr ? 'إنشاء وتفعيل الهدف 🎯' : 'Save Goal 🎯')}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 2: Add Rule --- */}
      <Modal visible={addRuleVisible} animationType="slide" transparent onRequestClose={() => setAddRuleVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isAr ? 'إضافة قاعدة ادخار ذكية' : 'New Smart Savings Rule'}</Text>
              <Pressable onPress={() => setAddRuleVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? 'نوع القاعدة الذكية' : 'Rule Type'}</Text>
                <View style={styles.ruleTypeRow}>
                  <Pressable
                    onPress={() => setRuleType('round_up')}
                    style={[styles.ruleTypeChip, ruleType === 'round_up' && styles.ruleTypeChipActive]}
                  >
                    <Ionicons name="wallet-outline" size={16} color={ruleType === 'round_up' ? '#FFF' : colors.primary} />
                    <Text style={[styles.ruleTypeChipText, ruleType === 'round_up' && styles.ruleTypeChipTextActive]}>
                      {isAr ? 'حصالة فكة' : 'Round-up'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setRuleType('weekly_transfer')}
                    style={[styles.ruleTypeChip, ruleType === 'weekly_transfer' && styles.ruleTypeChipActive]}
                  >
                    <Ionicons name="repeat-outline" size={16} color={ruleType === 'weekly_transfer' ? '#FFF' : colors.primary} />
                    <Text style={[styles.ruleTypeChipText, ruleType === 'weekly_transfer' && styles.ruleTypeChipTextActive]}>
                      {isAr ? 'ادخار أسبوعي' : 'Weekly Saving'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setRuleType('penalty')}
                    style={[styles.ruleTypeChip, ruleType === 'penalty' && styles.ruleTypeChipActive]}
                  >
                    <Ionicons name="warning-outline" size={16} color={ruleType === 'penalty' ? '#FFF' : colors.primary} />
                    <Text style={[styles.ruleTypeChipText, ruleType === 'penalty' && styles.ruleTypeChipTextActive]}>
                      {isAr ? 'عقوبة صرف' : 'Penalty'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.ruleExplainBox}>
                  <Text style={styles.ruleExplainText}>
                    {ruleType === 'round_up'
                      ? (isAr ? '💡 تقريب كل معاملة مصروف لأقرب 10 جنيهات وتحويل الفائض تلقائياً للهدف.' : '💡 Rounds up expenses to nearest 10 units.')
                      : ruleType === 'weekly_transfer'
                        ? (isAr ? '💡 تحويل تلقائي لمبلغ محدد أسبوعياً من المحفظة للادخار.' : '💡 Automated weekly savings transfer.')
                        : (isAr ? '💡 اقتطاع مبلغ كـ "عقوبة تأديبية" للادخار عند تجاوز ميزانية أي فئة.' : '💡 Penalty transfer on budget overspend.')}
                  </Text>
                </View>
              </View>

              {ruleType !== 'round_up' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{isAr ? 'مبلغ الخصم' : 'Transfer Amount'}</Text>
                  <TextInput
                    style={[styles.modalInput, isAr ? styles.modalInputAr : styles.modalInputEn]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={ruleAmount}
                    onChangeText={setRuleAmount}
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? 'إيداع في هدف' : 'Target Goal'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {goals.map(g => (
                    <Pressable
                      key={g.id}
                      onPress={() => setRuleGoalId(g.id)}
                      style={[
                        styles.walletChip,
                        ruleGoalId === g.id && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primary + '18' }
                      ]}
                    >
                      <Ionicons name="trophy-outline" size={14} color={colors.primary} />
                      <Text style={[styles.walletChipText, ruleGoalId === g.id && { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>
                        {g.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Pressable onPress={handleAddRule} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>{isAr ? 'حفظ وتفعيل القاعدة الذكية' : 'Save Rule'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 3: Manual Deposit / Withdraw --- */}
      <Modal visible={manualVisible} animationType="slide" transparent onRequestClose={() => setManualVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAr ? 'تعديل رصيد الحصالة' : 'Deposit / Withdraw'}
              </Text>
              <Pressable onPress={() => setManualVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              {selectedGoal && (
                <View style={styles.goalNoticeBox}>
                  <Text style={styles.goalNoticeText}>
                    🎯 {selectedGoal.name} | {isAr ? 'المتوفر حالياً:' : 'Saved:'} {formatCurrency(selectedGoal.savedAmount)} {currencySymbol}
                  </Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? 'نوع المعاملة' : 'Transaction Type'}</Text>
                <View style={styles.ruleTypeRow}>
                  <Pressable
                    onPress={() => setManualType('deposit')}
                    style={[styles.ruleTypeChip, manualType === 'deposit' && { backgroundColor: colors.income }]}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#FFF" />
                    <Text style={[styles.ruleTypeChipText, { color: '#FFF' }]}>{isAr ? 'إيداع / ادخار' : 'Deposit'}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setManualType('withdraw')}
                    style={[styles.ruleTypeChip, manualType === 'withdraw' && { backgroundColor: '#EF4444' }]}
                  >
                    <Ionicons name="remove-circle-outline" size={16} color="#FFF" />
                    <Text style={[styles.ruleTypeChipText, { color: '#FFF' }]}>{isAr ? 'سحب من الحصالة' : 'Withdraw'}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? 'المبلغ' : 'Amount'}</Text>
                <TextInput
                  style={[styles.modalInput, isAr ? styles.modalInputAr : styles.modalInputEn]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={manualAmount}
                  onChangeText={setManualAmount}
                />
              </View>

              <Pressable
                onPress={handleManualTransaction}
                style={[styles.submitBtn, { backgroundColor: manualType === 'deposit' ? colors.income : '#EF4444' }]}
              >
                <Text style={styles.submitBtnText}>{isAr ? 'تأكيد وحفظ الحركة' : 'Confirm'}</Text>
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: colors.text,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  /* Hero Summary Card */
  heroSummaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    overflow: 'hidden',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trophyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F59E0B18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  heroSubTitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  heroProgressBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  heroProgressText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  heroMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  heroMetricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  heroMetricLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  heroMetricValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  heroProgressBarBg: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  heroProgressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },

  /* Section Headers */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addBtnSmallText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: '#FFF',
  },

  /* Goal Cards */
  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  goalName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  goalTargetText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  goalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtnIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  /* Goal Progress Box */
  goalProgressBox: {
    backgroundColor: colors.surfaceAlt + '60',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressSavedText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.income,
  },
  pctBadge: {
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pctBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: '#F59E0B',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressMetaText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  progressDeadlineText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  goalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  walletTagText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  quickDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  quickDepositBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.primary,
  },

  /* Rules Cards */
  ruleCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ruleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  ruleSubDetail: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ruleActionsColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  ruleDeleteBtn: {
    padding: 4,
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  emptyActionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },

  /* Modals Layout */
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  modalForm: {
    gap: 14,
  },
  formGroup: {
    gap: 6,
    marginBottom: 12,
  },
  formLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalInputAr: {
    textAlign: 'right',
  },
  modalInputEn: {
    textAlign: 'left',
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  ruleTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ruleTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ruleTypeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ruleTypeChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  ruleTypeChipTextActive: {
    color: '#FFF',
    fontFamily: 'Cairo_700Bold',
  },
  ruleExplainBox: {
    backgroundColor: colors.primary + '12',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '25',
    marginTop: 4,
  },
  ruleExplainText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.primary,
    lineHeight: 16,
  },
  goalNoticeBox: {
    backgroundColor: colors.surfaceAlt,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  goalNoticeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.text,
  },
});
