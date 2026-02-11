import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency } from '@/lib/categories';
import { normalizeAmountInput } from '@/lib/arabicNumbers';
import { FinancialPlan, getFinancialPlan, saveFinancialPlan, deleteFinancialPlan } from '@/lib/planStorage';
import Svg, { Circle, Rect } from 'react-native-svg';

export default function FinancialPlanScreen() {
  const insets = useSafeAreaInsets();
  const { selectedWallet, currencySymbol, currencyCode, totalIncome, totalExpense } = useTransactions();
  const { t, language } = useLanguage();

  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [goalName, setGoalName] = useState('');
  const [durationYears, setDurationYears] = useState(1);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [monthlyExpense, setMonthlyExpense] = useState('');
  const [savingsGoal, setSavingsGoal] = useState('');

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    const saved = await getFinancialPlan();
    if (saved) {
      setPlan(saved);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    const incomeVal = parseFloat(monthlyIncome) || 0;
    const expenseVal = parseFloat(monthlyExpense) || 0;
    const goalVal = parseFloat(savingsGoal) || 0;

    if (incomeVal <= 0) {
      Alert.alert(t.error, t.enterAmount);
      return;
    }

    const monthlySaving = incomeVal - expenseVal;
    const newPlan: FinancialPlan = {
      id: Crypto.randomUUID(),
      goalName: goalName.trim() || t.savingsGoal,
      durationMonths: durationYears * 12,
      monthlyIncome: incomeVal,
      monthlyExpense: expenseVal,
      monthlySaving,
      savingsGoal: goalVal,
      currency: currencyCode,
      currencySymbol,
      createdAt: new Date().toISOString(),
      walletId: selectedWallet?.id || '',
    };

    await saveFinancialPlan(newPlan);
    setPlan(newPlan);
    setIsEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = () => {
    Alert.alert(
      t.deletePlan,
      t.deletePlanConfirm,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            await deleteFinancialPlan();
            setPlan(null);
            setIsEditing(false);
            setGoalName('');
            setDurationYears(1);
            setMonthlyIncome('');
            setMonthlyExpense('');
            setSavingsGoal('');
          },
        },
      ],
    );
  };

  const startEdit = () => {
    if (plan) {
      setGoalName(plan.goalName);
      setDurationYears(Math.round(plan.durationMonths / 12));
      setMonthlyIncome(plan.monthlyIncome.toString());
      setMonthlyExpense(plan.monthlyExpense.toString());
      setSavingsGoal(plan.savingsGoal.toString());
    }
    setIsEditing(true);
  };

  const renderForm = () => {
    const textAlign = language === 'ar' ? 'right' as const : 'left' as const;
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.label}>{t.savingsGoal}</Text>
          <TextInput
            style={[styles.input, { textAlign }]}
            placeholder={t.goalPlaceholder}
            placeholderTextColor={Colors.textTertiary}
            value={goalName}
            onChangeText={setGoalName}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t.planDuration}</Text>
          <View style={styles.durationRow}>
            {[1, 2, 3, 5].map(y => (
              <Pressable
                key={y}
                onPress={() => {
                  Haptics.selectionAsync();
                  setDurationYears(y);
                }}
                style={[
                  styles.durationChip,
                  durationYears === y && styles.durationChipActive,
                ]}
              >
                <Text style={[styles.durationText, durationYears === y && styles.durationTextActive]}>
                  {y} {y === 1 ? t.year : t.years}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t.monthlyIncome}</Text>
          <View style={styles.inputWithCurrency}>
            <View style={styles.inputCurrencyTag}>
              <Text style={styles.inputCurrencyText}>{currencySymbol}</Text>
            </View>
            <TextInput
              style={styles.currencyInput}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
              value={monthlyIncome}
              onChangeText={(text) => setMonthlyIncome(normalizeAmountInput(text))}
              textAlign="right"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t.monthlyExpense}</Text>
          <View style={styles.inputWithCurrency}>
            <View style={styles.inputCurrencyTag}>
              <Text style={styles.inputCurrencyText}>{currencySymbol}</Text>
            </View>
            <TextInput
              style={styles.currencyInput}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
              value={monthlyExpense}
              onChangeText={(text) => setMonthlyExpense(normalizeAmountInput(text))}
              textAlign="right"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t.savingsGoal} ({currencySymbol})</Text>
          <View style={styles.inputWithCurrency}>
            <View style={styles.inputCurrencyTag}>
              <Text style={styles.inputCurrencyText}>{currencySymbol}</Text>
            </View>
            <TextInput
              style={styles.currencyInput}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
              value={savingsGoal}
              onChangeText={(text) => setSavingsGoal(normalizeAmountInput(text))}
              textAlign="right"
            />
          </View>
        </View>

        {(parseFloat(monthlyIncome) || 0) > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{t.monthlySaving}</Text>
            <Text style={[
              styles.previewAmount,
              { color: ((parseFloat(monthlyIncome) || 0) - (parseFloat(monthlyExpense) || 0)) >= 0 ? Colors.income : Colors.expense },
            ]}>
              {formatCurrency((parseFloat(monthlyIncome) || 0) - (parseFloat(monthlyExpense) || 0))} {currencySymbol}
            </Text>
            <Text style={styles.previewSub}>
              {t.totalSavings}: {formatCurrency(((parseFloat(monthlyIncome) || 0) - (parseFloat(monthlyExpense) || 0)) * durationYears * 12)} {currencySymbol}
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleCreate}
          style={({ pressed }) => [
            styles.saveButton,
            {
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Ionicons name="checkmark" size={22} color="#fff" />
          <Text style={styles.saveText}>{t.createPlan}</Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderPlanView = () => {
    if (!plan) return null;

    const totalMonths = plan.durationMonths;
    const now = new Date();
    const created = new Date(plan.createdAt);
    const monthsElapsed = Math.max(0, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()));
    const monthsRemaining = Math.max(0, totalMonths - monthsElapsed);

    const expectedTotalSavings = plan.monthlySaving * totalMonths;
    const currentSavings = plan.monthlySaving * monthsElapsed;
    const actualSavings = (totalIncome - totalExpense);

    const progressPercent = plan.savingsGoal > 0
      ? Math.min(100, Math.max(0, (actualSavings / plan.savingsGoal) * 100))
      : expectedTotalSavings > 0
        ? Math.min(100, Math.max(0, (actualSavings / expectedTotalSavings) * 100))
        : 0;

    const isOnTrack = actualSavings >= currentSavings * 0.8;
    const sym = plan.currencySymbol;

    const CHART_SIZE = 140;
    const STROKE = 14;
    const R = (CHART_SIZE - STROKE) / 2;
    const C = 2 * Math.PI * R;
    const progressLength = (progressPercent / 100) * C;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      >
        <View style={styles.planHeader}>
          <View style={styles.planBadge}>
            <MaterialIcons name="flag" size={16} color={Colors.primary} />
            <Text style={styles.planBadgeText}>{t.planActive}</Text>
          </View>
          <View style={styles.planActions}>
            <Pressable onPress={startEdit} hitSlop={8} style={styles.planActionBtn}>
              <MaterialIcons name="edit" size={18} color={Colors.primary} />
            </Pressable>
            <Pressable onPress={handleDelete} hitSlop={8} style={styles.planActionBtn}>
              <MaterialIcons name="delete-outline" size={18} color={Colors.expense} />
            </Pressable>
          </View>
        </View>

        <View style={styles.goalCard}>
          <MaterialIcons name="emoji-events" size={28} color={Colors.accent} />
          <Text style={styles.goalName}>{plan.goalName}</Text>
          <Text style={styles.goalDuration}>
            {Math.round(plan.durationMonths / 12)} {Math.round(plan.durationMonths / 12) === 1 ? t.year : t.years}
          </Text>
        </View>

        <View style={styles.chartWrap}>
          <Svg width={CHART_SIZE} height={CHART_SIZE}>
            <Circle
              cx={CHART_SIZE / 2}
              cy={CHART_SIZE / 2}
              r={R}
              fill="none"
              stroke={Colors.surfaceAlt}
              strokeWidth={STROKE}
            />
            <Circle
              cx={CHART_SIZE / 2}
              cy={CHART_SIZE / 2}
              r={R}
              fill="none"
              stroke={isOnTrack ? Colors.income : Colors.expense}
              strokeWidth={STROKE}
              strokeDasharray={`${progressLength} ${C - progressLength}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.chartCenterAbs}>
            <Text style={styles.chartPercent}>{Math.round(progressPercent)}%</Text>
            <Text style={[styles.chartStatus, { color: isOnTrack ? Colors.income : Colors.expense }]}>
              {isOnTrack ? t.onTrack : t.offTrack}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t.monthlyIncome}</Text>
            <Text style={[styles.summaryValue, { color: Colors.income }]}>
              {formatCurrency(plan.monthlyIncome)} {sym}
            </Text>
            <View style={styles.actualRow}>
              <Text style={styles.actualLabel}>{t.actualIncome}</Text>
              <Text style={[styles.actualValue, { color: Colors.income }]}>
                {formatCurrency(totalIncome)} {sym}
              </Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t.monthlyExpense}</Text>
            <Text style={[styles.summaryValue, { color: Colors.expense }]}>
              {formatCurrency(plan.monthlyExpense)} {sym}
            </Text>
            <View style={styles.actualRow}>
              <Text style={styles.actualLabel}>{t.actualExpense}</Text>
              <Text style={[styles.actualValue, { color: Colors.expense }]}>
                {formatCurrency(totalExpense)} {sym}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t.monthlySaving}</Text>
            <Text style={[styles.summaryValue, { color: plan.monthlySaving >= 0 ? Colors.income : Colors.expense }]}>
              {formatCurrency(plan.monthlySaving)} {sym}
            </Text>
            <View style={styles.actualRow}>
              <Text style={styles.actualLabel}>{t.actualSaving}</Text>
              <Text style={[styles.actualValue, { color: actualSavings >= 0 ? Colors.income : Colors.expense }]}>
                {formatCurrency(actualSavings)} {sym}
              </Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t.totalSavings}</Text>
            <Text style={[styles.summaryValue, { color: Colors.primary }]}>
              {formatCurrency(expectedTotalSavings)} {sym}
            </Text>
          </View>
        </View>

        {plan.savingsGoal > 0 && (
          <View style={styles.goalProgressSection}>
            <View style={styles.goalProgressHeader}>
              <Text style={styles.goalProgressTitle}>{t.savingsGoal}</Text>
              <Text style={styles.goalProgressAmount}>
                {formatCurrency(plan.savingsGoal)} {sym}
              </Text>
            </View>
            <View style={styles.goalBar}>
              <View style={[styles.goalBarFill, {
                width: `${Math.min(100, progressPercent)}%`,
                backgroundColor: isOnTrack ? Colors.income : Colors.expense,
              }]} />
            </View>
            <View style={styles.goalProgressFooter}>
              <Text style={styles.goalProgressLabel}>
                {formatCurrency(Math.max(0, actualSavings))} {sym}
              </Text>
              <Text style={styles.goalProgressRemaining}>
                {monthsRemaining} {t.months[0] ? '' : ''}{language === 'ar' ? 'شهر متبقي' : 'months remaining'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.timelineSection}>
          <Text style={styles.timelineTitle}>{t.monthlyBreakdown}</Text>
          {Array.from({ length: Math.min(12, totalMonths) }, (_, i) => {
            const monthDate = new Date(created);
            monthDate.setMonth(created.getMonth() + i);
            const monthName = t.months[monthDate.getMonth()];
            const year = monthDate.getFullYear();
            const isPast = i < monthsElapsed;
            const isCurrent = i === monthsElapsed;

            return (
              <View key={i} style={[styles.timelineRow, isCurrent && styles.timelineRowCurrent]}>
                <View style={[styles.timelineDot, {
                  backgroundColor: isPast ? Colors.income : isCurrent ? Colors.primary : Colors.surfaceAlt,
                }]}>
                  {isPast && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineMonth, isCurrent && { color: Colors.primary, fontFamily: 'Cairo_700Bold' as const }]}>
                    {monthName} {year}
                  </Text>
                  <Text style={styles.timelineAmount}>
                    +{formatCurrency(plan.monthlySaving)} {sym}
                  </Text>
                </View>
                <Text style={styles.timelineTotal}>
                  {formatCurrency(plan.monthlySaving * (i + 1))} {sym}
                </Text>
              </View>
            );
          })}
          {totalMonths > 12 && (
            <View style={styles.moreMonths}>
              <Text style={styles.moreMonthsText}>
                +{totalMonths - 12} {language === 'ar' ? 'شهر آخر' : 'more months'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const showForm = !plan || isEditing;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <View style={[styles.headerRow, { paddingTop: (insets.top || (Platform.OS === 'web' ? 67 : 0)) + 16 }]}>
          <Text style={styles.sheetTitle}>{t.financialPlan}</Text>
        </View>

        {showForm ? renderForm() : renderPlanView()}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: Colors.text,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  durationChipActive: {
    backgroundColor: Colors.primary + '12',
    borderColor: Colors.primary,
  },
  durationText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  durationTextActive: {
    color: Colors.primary,
  },
  inputWithCurrency: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    paddingLeft: 4,
    paddingRight: 16,
    height: 56,
    gap: 10,
  },
  inputCurrencyTag: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputCurrencyText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: Colors.primary,
  },
  currencyInput: {
    flex: 1,
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: Colors.text,
  },
  previewCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
  },
  previewTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  previewAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
  },
  previewSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    backgroundColor: Colors.primary,
    marginBottom: 20,
  },
  saveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: '#fff',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '12',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  planBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },
  planActions: {
    flexDirection: 'row',
    gap: 8,
  },
  planActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  goalName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: Colors.text,
  },
  goalDuration: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    height: 140,
  },
  chartCenterAbs: {
    position: 'absolute',
    alignItems: 'center',
  },
  chartPercent: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: Colors.text,
  },
  chartStatus: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  summaryLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  actualRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actualLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
  },
  actualValue: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  goalProgressSection: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
    marginBottom: 16,
  },
  goalProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalProgressTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  goalProgressAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: Colors.primary,
  },
  goalBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalBarFill: {
    height: 8,
    borderRadius: 4,
  },
  goalProgressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  goalProgressLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: Colors.text,
  },
  goalProgressRemaining: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  timelineSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  timelineTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
    marginBottom: 2,
  },
  timelineRowCurrent: {
    backgroundColor: Colors.primary + '08',
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineContent: {
    flex: 1,
  },
  timelineMonth: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  timelineAmount: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: Colors.income,
  },
  timelineTotal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  moreMonths: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  moreMonthsText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
