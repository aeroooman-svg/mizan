import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import Colors from '@/constants/colors';
import { FinancialPlan } from '@/lib/planStorage';
import { SavingsGoal } from '@/lib/goalStorage';
import { Debt } from '@/lib/debtStorage';
import { Transaction } from '@/lib/storage';
import { formatCurrency } from '@/lib/categories';

interface ActivePlanSectionProps {
  plan: FinancialPlan | null;
  goals: SavingsGoal[];
  debts: Debt[];
  walletTransactions: Transaction[];
  selectedWalletId: string | undefined;
  currencySymbol: string;
  language: 'ar' | 'en';
  colors: any;
}

export default function ActivePlanSection({
  plan,
  goals,
  debts,
  walletTransactions,
  selectedWalletId,
  currencySymbol,
  language,
  colors,
}: ActivePlanSectionProps) {
  const styles = getStyles(colors);

  if (!plan) return null;

  const totalMonths = plan.durationMonths;
  const expectedTotalSavings = plan.monthlySaving * totalMonths;

  const totalSavedInGoals = goals.reduce((sum, g) => sum + (g.savedAmount || 0), 0);
  const unpaidDebts = debts
    .filter((d) => d.type === 'debt_to_others' && d.status !== 'paid')
    .reduce((s, d) => s + (d.amount - (d.paidAmount || 0)), 0);
  const unpaidLoans = debts
    .filter((d) => d.type === 'debt_to_me' && d.status !== 'paid')
    .reduce((s, d) => s + (d.amount - (d.paidAmount || 0)), 0);

  const walletInc = walletTransactions
    .filter(
      (t) => t.type === 'income' || (t.type === 'transfer' && t.toWalletId === selectedWalletId)
    )
    .reduce((s, t) => s + t.amount, 0);
  const walletExp = walletTransactions
    .filter(
      (t) => t.type === 'expense' || (t.type === 'transfer' && t.walletId === selectedWalletId)
    )
    .reduce((s, t) => s + t.amount, 0);
  const walletNetBalance = walletInc - walletExp;
  const actualSavings = walletNetBalance + totalSavedInGoals - unpaidDebts + unpaidLoans;

  const isCompleted =
    plan.savingsGoal > 0
      ? actualSavings >= plan.savingsGoal
      : expectedTotalSavings > 0 && actualSavings >= expectedTotalSavings;
  const progressPercent = isCompleted
    ? 100
    : plan.savingsGoal > 0
    ? Math.min(100, Math.max(0, (actualSavings / plan.savingsGoal) * 100))
    : expectedTotalSavings > 0
    ? Math.min(100, Math.max(0, (actualSavings / expectedTotalSavings) * 100))
    : 0;

  const monthlyGroups: Record<string, { income: number; expense: number }> = {};
  walletTransactions.forEach((tx) => {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthlyGroups[key]) monthlyGroups[key] = { income: 0, expense: 0 };
    if (tx.type === 'income' || (tx.type === 'transfer' && tx.toWalletId === selectedWalletId)) {
      monthlyGroups[key].income += tx.amount;
    } else if (tx.type === 'expense' || (tx.type === 'transfer' && tx.walletId === selectedWalletId)) {
      monthlyGroups[key].expense += tx.amount;
    }
  });
  const monthsCount = Object.keys(monthlyGroups).length || 1;
  let totalInc = 0;
  let totalExp = 0;
  Object.values(monthlyGroups).forEach((group) => {
    totalInc += group.income;
    totalExp += group.expense;
  });
  const avgSaving = (totalInc - totalExp) / monthsCount;

  const isRealistic =
    avgSaving > 0 &&
    (plan.savingsGoal > 0
      ? (plan.savingsGoal - actualSavings) / avgSaving <= totalMonths - monthsCount
      : true);

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {language === 'ar' ? '📊 خطتك المالية النشطة' : 'ACTIVE FINANCIAL PLAN'}
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/financial-plan')}>
          <Text style={styles.seeAll}>{language === 'ar' ? 'عرض التفاصيل' : 'View Plan'}</Text>
        </Pressable>
      </View>

      <View>
        <Pressable
          style={styles.recentListCard}
          onPress={() => router.push('/(tabs)/financial-plan')}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: 'Cairo_700Bold',
                  fontSize: 15,
                  color: Colors.text,
                  textAlign: 'left',
                }}
              >
                {plan.goalName}
              </Text>
              <Text
                style={{
                  fontFamily: 'Cairo_600SemiBold',
                  fontSize: 11,
                  color: Colors.textSecondary,
                  textAlign: 'left',
                }}
              >
                {language === 'ar' ? 'الصافي الادخاري: ' : 'Net Saved: '}
                <Text style={{ color: Colors.primary }}>
                  {formatCurrency(actualSavings, language)} {currencySymbol}
                </Text>
              </Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: isRealistic ? Colors.income + '12' : Colors.expense + '12',
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Cairo_700Bold',
                    fontSize: 10,
                    color: isRealistic ? Colors.income : Colors.expense,
                  }}
                >
                  {isCompleted
                    ? language === 'ar'
                      ? '🏆 مكتملة'
                      : '🏆 COMPLETED'
                    : isRealistic
                    ? language === 'ar'
                      ? '✅ خطة منطقية'
                      : '✅ REALISTIC PLAN'
                    : language === 'ar'
                    ? '⚠️ غير منطقية ومتاخرة'
                    : '⚠️ UNREALISTIC / BEHIND'}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'center', justifyContent: 'center', width: 64, height: 64 }}>
              <Svg width={64} height={64}>
                <Circle
                  cx={32}
                  cy={32}
                  r={26}
                  fill="none"
                  stroke={Colors.surfaceAlt}
                  strokeWidth={6}
                />
                <Circle
                  cx={32}
                  cy={32}
                  r={26}
                  fill="none"
                  stroke={
                    isCompleted
                      ? Colors.accent
                      : isRealistic
                      ? Colors.income
                      : Colors.expense
                  }
                  strokeWidth={6}
                  strokeDasharray={`${(progressPercent / 100) * 2 * Math.PI * 26} ${
                    2 * Math.PI * 26
                  }`}
                  strokeLinecap="round"
                  transform="rotate(-90 32 32)"
                />
              </Svg>
              <View
                style={{
                  position: 'absolute',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.text }}>
                  {Math.round(progressPercent)}%
                </Text>
              </View>
            </View>
          </View>
        </Pressable>

        {!isCompleted && avgSaving > 0 && (() => {
          const target =
            plan.savingsGoal > 0
              ? plan.savingsGoal
              : plan.monthlySaving * plan.durationMonths;
          const remaining = Math.max(0, target - actualSavings);
          const monthsToGoal = Math.ceil(remaining / avgSaving);
          const completionDate = new Date();
          completionDate.setMonth(completionDate.getMonth() + monthsToGoal);
          const completionStr = completionDate.toLocaleDateString(
            language === 'ar' ? 'ar-EG' : 'en-US',
            { month: 'long', year: 'numeric' }
          );
          const isOnSchedule = isRealistic;
          return (
            <View
              style={{
                marginTop: 8,
                backgroundColor: isOnSchedule ? Colors.income + '10' : Colors.expense + '10',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Cairo_600SemiBold',
                  fontSize: 11,
                  color: isOnSchedule ? Colors.income : Colors.expense,
                  textAlign: 'left',
                }}
              >
                {isOnSchedule ? '✅ ' : '⚠️ '}
                {language === 'ar'
                  ? `متوقع التحقيق: ${completionStr}`
                  : `Est. completion: ${completionStr}`}
              </Text>
            </View>
          );
        })()}
      </View>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
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
    recentListCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
  });
