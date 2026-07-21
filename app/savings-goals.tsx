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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { useTheme } from '@/lib/ThemeContext';
import { formatCurrency } from '@/lib/categories';
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
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language, t } = useLanguage();
  const { wallets, selectedWallet, addTransaction, currencySymbol } = useTransactions();

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [rules, setRules] = useState<SavingsRule[]>([]);

  // Add Goal Modal states
  const [addGoalVisible, setAddGoalVisible] = useState(false);
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

  // Manual Transaction modal
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

  const handleAddGoal = async () => {
    if (!goalName.trim()) {
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'يرجى إدخال اسم الهدف' : 'Please enter goal name');
      return;
    }
    const target = parseFloat(targetAmount);
    if (isNaN(target) || target <= 0) {
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'يرجى إدخال مبلغ هدف صحيح' : 'Please enter valid target amount');
      return;
    }
    if (!goalWalletId) {
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'يرجى تحديد المحفظة' : 'Please select wallet');
      return;
    }

    const newGoal: SavingsGoal = {
      id: Crypto.randomUUID(),
      name: goalName.trim(),
      targetAmount: target,
      savedAmount: 0,
      deadline: deadline || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year default
      walletId: goalWalletId,
      createdAt: new Date().toISOString(),
    };

    await saveGoal(newGoal);
    setAddGoalVisible(false);
    setGoalName('');
    setTargetAmount('');
    setDeadline('');
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadAllData();
  };

  const handleAddRule = async () => {
    if (!ruleGoalId) {
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'يرجى اختيار هدف ادخار' : 'Please select a savings goal');
      return;
    }
    
    let parsedAmount = 0;
    if (ruleType !== 'round_up') {
      parsedAmount = parseFloat(ruleAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'يرجى إدخال مبلغ صحيح للقاعدة' : 'Please enter a valid rule amount');
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
    loadAllData();
  };

  const handleToggleRule = async (rule: SavingsRule) => {
    Haptics.selectionAsync();
    const updated = { ...rule, isActive: !rule.isActive };
    await saveRule(updated);
    loadAllData();
  };

  const handleDeleteRule = (id: string) => {
    Alert.alert(
      language === 'ar' ? 'حذف القاعدة' : 'Delete Rule',
      language === 'ar' ? 'هل تريد حذف هذه القاعدة الذكية؟' : 'Are you sure you want to delete this smart rule?',
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            await deleteRule(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            loadAllData();
          }
        }
      ]
    );
  };

  const handleDeleteGoal = (id: string) => {
    Alert.alert(
      language === 'ar' ? 'حذف الهدف' : 'Delete Goal',
      language === 'ar' ? 'حذف الهدف سيحذف القواعد المرتبطة به. هل أنت متأكد؟' : 'Deleting this goal will also delete its linked rules. Proceed?',
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            await deleteGoal(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            loadAllData();
          }
        }
      ]
    );
  };

  const handleManualTransaction = async () => {
    if (!selectedGoal) return;
    const val = parseFloat(manualAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter valid amount');
      return;
    }

    const diff = manualType === 'deposit' ? val : -val;
    const updated = await addFundsToGoal(selectedGoal.id, diff);
    if (updated) {
      // Add wallet transaction to reflect the manual movement
      const walletTxType = manualType === 'deposit' ? 'expense' : 'income'; // depositing into goal is an expense for the wallet, withdrawing is income
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
        description: language === 'ar' ? descAr : descEn,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      setManualVisible(false);
      setManualAmount('');
      setSelectedGoal(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadAllData();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerRow, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12, zIndex: 10, elevation: 10 }]}>
        <Text style={styles.sheetTitle}>
          {language === 'ar' ? 'أهداف الادخار والحصالات' : 'Savings Goals'}
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Goals List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {language === 'ar' ? '🎯 الأهداف الحالية' : 'SAVINGS TARGETS'}
          </Text>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              if (wallets.length === 0) {
                Alert.alert(language === 'ar' ? 'تنبيه' : 'Warning', language === 'ar' ? 'يرجى إنشاء محفظة أولاً' : 'Please create a wallet first');
                return;
              }
              setGoalWalletId(selectedWallet?.id || wallets[0].id);
              setAddGoalVisible(true);
            }}
            style={styles.addBtnSmall}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addBtnSmallText}>{language === 'ar' ? 'هدف جديد' : 'New Goal'}</Text>
          </Pressable>
        </View>

        {goals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="ribbon-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyCardText}>
              {language === 'ar' ? 'لم تضف أي أهداف بعد. ابدأ الآن ووفر لشراء ما تحب!' : 'No savings goals set yet.'}
            </Text>
          </View>
        ) : (
          goals.map(goal => {
            const pct = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
            const wallet = wallets.find(w => w.id === goal.walletId);
            
            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
                    <Text style={styles.goalTargetText}>
                      {language === 'ar' ? 'المستهدف:' : 'Target:'} {formatCurrency(goal.targetAmount)} {currencySymbol}
                    </Text>
                  </View>
                  
                  {/* Actions */}
                  <View style={styles.goalActions}>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedGoal(goal);
                        setManualWalletId(goal.walletId);
                        setManualVisible(true);
                      }}
                      style={styles.actionBtnIcon}
                    >
                      <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteGoal(goal.id)}
                      style={styles.actionBtnIcon}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.expense} />
                    </Pressable>
                  </View>
                </View>

                {/* Progress Indicators */}
                <View style={styles.progressRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: wallet?.color || colors.primary }]} />
                    </View>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressLeft}>
                        {language === 'ar' ? 'تم توفير:' : 'Saved:'} {formatCurrency(goal.savedAmount)} {currencySymbol}
                      </Text>
                      <Text style={styles.progressPct}>{pct}%</Text>
                    </View>
                  </View>
                  
                  {/* Circle indicator */}
                  <View style={styles.pctCircleWrap}>
                    <Svg width={44} height={44} viewBox="0 0 50 50">
                      <Circle cx="25" cy="25" r="20" stroke="#1F293D" strokeWidth="4" fill="transparent" />
                      <Circle
                        cx="25"
                        cy="25"
                        r="20"
                        stroke={wallet?.color || colors.primary}
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 20}
                        strokeDashoffset={2 * Math.PI * 20 * (1 - pct / 100)}
                        strokeLinecap="round"
                        transform="rotate(-90 25 25)"
                      />
                    </Svg>
                    <Text style={styles.circlePctText}>{pct}%</Text>
                  </View>
                </View>

                <View style={styles.goalFooter}>
                  <Text style={styles.deadlineText}>📅 {language === 'ar' ? 'الموعد:' : 'By:'} {goal.deadline}</Text>
                  {wallet && (
                    <Text style={[styles.walletTagText, { color: wallet.color }]}>💳 {wallet.name}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Rules Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {language === 'ar' ? '⚡ قواعد الادخار الذكي' : 'SMART SAVINGS RULES'}
          </Text>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              if (goals.length === 0) {
                Alert.alert(language === 'ar' ? 'تنبيه' : 'Warning', language === 'ar' ? 'يجب إضافة هدف ادخار أولاً' : 'Please create a savings goal first');
                return;
              }
              setRuleGoalId(goals[0].id);
              setRuleWalletId(selectedWallet?.id || wallets[0].id);
              setAddRuleVisible(true);
            }}
            style={styles.addBtnSmall}
          >
            <Ionicons name="flash-outline" size={15} color="#fff" />
            <Text style={styles.addBtnSmallText}>{language === 'ar' ? 'قاعدة جديدة' : 'New Rule'}</Text>
          </Pressable>
        </View>

        {rules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="flash-off-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyCardText}>
              {language === 'ar' ? 'لا توجد قواعد ادخار نشطة. قّرب الفكة أو خصّص مبالغ للادخار التلقائي!' : 'No auto-savings rules configured yet.'}
            </Text>
          </View>
        ) : (
          rules.map(rule => {
            const targetGoal = goals.find(g => g.id === rule.targetGoalId);
            const wallet = wallets.find(w => w.id === rule.walletId);
            
            return (
              <View key={rule.id} style={styles.ruleCard}>
                <View style={styles.ruleInfoRow}>
                  <View style={styles.ruleIconWrap}>
                    <Ionicons 
                      name={rule.type === 'round_up' ? 'wallet' : rule.type === 'weekly_transfer' ? 'repeat' : 'warning'} 
                      size={20} 
                      color={colors.primary} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleTypeName}>
                      {rule.type === 'round_up' 
                        ? (language === 'ar' ? 'حصالة الفكة والكسور (Round-up)' : 'Round-up Change') :
                       rule.type === 'weekly_transfer' 
                        ? (language === 'ar' ? `تحويل أسبوعي ثابت (${rule.amount} ${currencySymbol})` : `Weekly fixed saving (${rule.amount})`) :
                        (language === 'ar' ? `تأديب الصرف وعقوبة التبذير (${rule.amount} ${currencySymbol})` : `Budget Exceeded Penalty (${rule.amount})`)}
                    </Text>
                    <Text style={styles.ruleGoalName}>
                      🎯 {language === 'ar' ? 'الحصالة المستهدفة:' : 'Saving to:'} {targetGoal?.name || (language === 'ar' ? 'غير معروف' : 'Unknown')}
                    </Text>
                    {wallet && (
                      <Text style={styles.ruleWalletName}>
                        💳 {language === 'ar' ? 'من محفظة:' : 'From:'} {wallet.name}
                      </Text>
                    )}
                  </View>
                  
                  {/* Toggle */}
                  <View style={styles.ruleActionArea}>
                    <Switch
                      value={rule.isActive}
                      onValueChange={() => handleToggleRule(rule)}
                      trackColor={{ false: '#2C3A4E', true: colors.primary }}
                      thumbColor="#fff"
                    />
                    <Pressable
                      onPress={() => handleDeleteRule(rule.id)}
                      style={styles.ruleDeleteBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.expense} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal visible={addGoalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{language === 'ar' ? 'إنشاء هدف ادخار جديد' : 'New Savings Goal'}</Text>
              <Pressable onPress={() => setAddGoalVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'ما الذي تدخر لأجله؟' : 'Goal Name'}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={language === 'ar' ? 'شراء لابتوب، سفرية الصيف...' : 'Laptop, Vacation...'}
                  placeholderTextColor={colors.textTertiary}
                  value={goalName}
                  onChangeText={setGoalName}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'المبلغ المستهدف' : 'Target Amount'}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'موعد تحقيق الهدف (YYYY-MM-DD)' : 'Target Date'}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="2027-07-20"
                  placeholderTextColor={colors.textTertiary}
                  value={deadline}
                  onChangeText={setDeadline}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'المحفظة المرتبطة للخصم' : 'Source Wallet'}</Text>
                <View style={styles.walletsRow}>
                  {wallets.map(w => (
                    <Pressable
                      key={w.id}
                      onPress={() => setGoalWalletId(w.id)}
                      style={[
                        styles.walletSelectorCard,
                        goalWalletId === w.id && { borderColor: w.color, borderWidth: 2 }
                      ]}
                    >
                      <MaterialIcons name={w.icon as any} size={16} color={w.color} />
                      <Text style={[styles.walletSelectorText, goalWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                        {w.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable onPress={handleAddGoal} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.saveBtnText}>{t.save}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Rule Modal */}
      <Modal visible={addRuleVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{language === 'ar' ? 'إضافة قاعدة ادخار ذكية' : 'New Smart Savings Rule'}</Text>
              <Pressable onPress={() => setAddRuleVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'نوع القاعدة الذكية' : 'Rule Type'}</Text>
                <View style={styles.ruleTypeButtons}>
                  <Pressable
                    onPress={() => setRuleType('round_up')}
                    style={[styles.typeSelectBtn, ruleType === 'round_up' && styles.typeSelectBtnActive]}
                  >
                    <Ionicons name="wallet-outline" size={18} color={ruleType === 'round_up' ? '#fff' : colors.primary} />
                    <Text style={[styles.typeSelectText, ruleType === 'round_up' && styles.typeSelectTextActive]}>
                      {language === 'ar' ? 'حصالة فكة' : 'Round-up'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setRuleType('weekly_transfer')}
                    style={[styles.typeSelectBtn, ruleType === 'weekly_transfer' && styles.typeSelectBtnActive]}
                  >
                    <Ionicons name="repeat-outline" size={18} color={ruleType === 'weekly_transfer' ? '#fff' : colors.primary} />
                    <Text style={[styles.typeSelectText, ruleType === 'weekly_transfer' && styles.typeSelectTextActive]}>
                      {language === 'ar' ? 'ادخار أسبوعي' : 'Weekly Saving'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setRuleType('penalty')}
                    style={[styles.typeSelectBtn, ruleType === 'penalty' && styles.typeSelectBtnActive]}
                  >
                    <Ionicons name="warning-outline" size={18} color={ruleType === 'penalty' ? '#fff' : colors.primary} />
                    <Text style={[styles.typeSelectText, ruleType === 'penalty' && styles.typeSelectTextActive]}>
                      {language === 'ar' ? 'عقوبة صرف' : 'Spend Penalty'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.ruleExplanation}>
                  {ruleType === 'round_up' 
                    ? (language === 'ar' ? '💡 يقوم النظام بتقريب كل معاملة مصروف لأقرب 10 جنيهات وتحويل الفائض تلقائياً للهدف المحدد.' : '💡 Rounds up every expense to the nearest 10 units and saves the difference.')
                    : ruleType === 'weekly_transfer'
                      ? (language === 'ar' ? '💡 تحويل تلقائي لمبلغ محدد أسبوعياً من رصيد المحفظة إلى الحصالة.' : '💡 Automates a weekly transfer of a fixed amount to your savings goal.')
                      : (language === 'ar' ? '💡 عند تجاوز الميزانية المحددة لأي فئة، يتم خصم مبلغ كـ "عقوبة تأديبية" وإيداعه في الادخار.' : '💡 Deducts a penalty amount into your savings goal when you exceed category budget limits.')}
                </Text>
              </View>

              {ruleType !== 'round_up' && (
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>{language === 'ar' ? 'مبلغ الخصم' : 'Transfer Amount'}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={ruleAmount}
                    onChangeText={setRuleAmount}
                  />
                </View>
              )}

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'إيداع في هدف' : 'Target Goal'}</Text>
                <View style={styles.walletsRow}>
                  {goals.map(g => (
                    <Pressable
                      key={g.id}
                      onPress={() => setRuleGoalId(g.id)}
                      style={[
                        styles.walletSelectorCard,
                        ruleGoalId === g.id && { borderColor: colors.primary, borderWidth: 2 }
                      ]}
                    >
                      <Ionicons name="ribbon-outline" size={16} color={colors.primary} />
                      <Text style={[styles.walletSelectorText, ruleGoalId === g.id && { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>
                        {g.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'خصم من محفظة' : 'Source Wallet'}</Text>
                <View style={styles.walletsRow}>
                  {wallets.map(w => (
                    <Pressable
                      key={w.id}
                      onPress={() => setRuleWalletId(w.id)}
                      style={[
                        styles.walletSelectorCard,
                        ruleWalletId === w.id && { borderColor: w.color, borderWidth: 2 }
                      ]}
                    >
                      <MaterialIcons name={w.icon as any} size={16} color={w.color} />
                      <Text style={[styles.walletSelectorText, ruleWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                        {w.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable onPress={handleAddRule} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.saveBtnText}>{t.save}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Transactions Modal (Deposit/Withdraw) */}
      <Modal visible={manualVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'ar' ? 'تعديل رصيد الحصالة يدوياً' : 'Add/Withdraw Savings'}
              </Text>
              <Pressable onPress={() => setManualVisible(false)} hitSlop={15}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              {selectedGoal && (
                <Text style={styles.payHeaderSub}>
                  {language === 'ar' ? 'الهدف:' : 'Goal:'} {selectedGoal.name} | {language === 'ar' ? 'المتوفر حالياً:' : 'Saved:'} {formatCurrency(selectedGoal.savedAmount)} {currencySymbol}
                </Text>
              )}

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'نوع العملية' : 'Transaction Type'}</Text>
                <View style={styles.ruleTypeButtons}>
                  <Pressable
                    onPress={() => setManualType('deposit')}
                    style={[styles.typeSelectBtn, manualType === 'deposit' && { backgroundColor: colors.income }]}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#fff" />
                    <Text style={[styles.typeSelectText, { color: '#fff' }]}>
                      {language === 'ar' ? 'ادخار / إيداع' : 'Deposit'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setManualType('withdraw')}
                    style={[styles.typeSelectBtn, manualType === 'withdraw' && { backgroundColor: colors.expense }]}
                  >
                    <Ionicons name="remove-circle-outline" size={18} color="#fff" />
                    <Text style={[styles.typeSelectText, { color: '#fff' }]}>
                      {language === 'ar' ? 'سحب رصيد' : 'Withdraw'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{t.amount}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={manualAmount}
                  onChangeText={setManualAmount}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>{language === 'ar' ? 'حساب / محفظة المعاملة' : 'Wallet'}</Text>
                <View style={styles.walletsRow}>
                  {wallets.map(w => (
                    <Pressable
                      key={w.id}
                      onPress={() => setManualWalletId(w.id)}
                      style={[
                        styles.walletSelectorCard,
                        manualWalletId === w.id && { borderColor: w.color, borderWidth: 2 }
                      ]}
                    >
                      <MaterialIcons name={w.icon as any} size={16} color={w.color} />
                      <Text style={[styles.walletSelectorText, manualWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                        {w.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={handleManualTransaction}
                style={[styles.saveBtn, { backgroundColor: manualType === 'deposit' ? colors.income : colors.expense }]}
              >
                <Text style={styles.saveBtnText}>
                  {language === 'ar' ? 'تأكيد العملية' : 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 18,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnSmallText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: '#fff',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyCardText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  goalName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
    textAlign: 'left',
  },
  goalTargetText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'left',
  },
  goalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnIcon: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 14,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLeft: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressPct: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.text,
  },
  pctCircleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePctText: {
    position: 'absolute',
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    color: colors.text,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  deadlineText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textTertiary,
  },
  walletTagText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  ruleCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ruleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleTypeName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    textAlign: 'left',
  },
  ruleGoalName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'left',
  },
  ruleWalletName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'left',
  },
  ruleActionArea: {
    alignItems: 'flex-end',
    gap: 8,
  },
  ruleDeleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.expense + '12',
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
    maxHeight: '90%',
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
  ruleTypeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    gap: 6,
  },
  typeSelectBtnActive: {
    backgroundColor: colors.primary,
  },
  typeSelectText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  typeSelectTextActive: {
    color: '#fff',
    fontFamily: 'Cairo_700Bold',
  },
  ruleExplanation: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'left',
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
