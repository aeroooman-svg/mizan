import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { SavingsGoal } from '@/lib/goalStorage';
import { Debt } from '@/lib/debtStorage';
import { FinancialPlan } from '@/lib/planStorage';
import { Transaction } from '@/lib/storage';
import { formatCurrency } from '@/lib/categories';

interface GoalsDebtsSectionsProps {
  goals: SavingsGoal[];
  debts: Debt[];
  plan: FinancialPlan | null;
  walletTransactions: Transaction[];
  selectedWalletId: string | undefined;
  currencySymbol: string;
  language: 'ar' | 'en';
  colors: any;
}

export default function GoalsDebtsSections({
  goals,
  debts,
  plan,
  walletTransactions,
  selectedWalletId,
  currencySymbol,
  language,
  colors,
}: GoalsDebtsSectionsProps) {
  const styles = getStyles(colors);

  const totalOwed = debts
    .filter((d) => d.type === 'debt_to_others' && d.status !== 'paid')
    .reduce((s, d) => s + (d.amount - (d.paidAmount || 0)), 0);
  const totalCollect = debts
    .filter((d) => d.type === 'debt_to_me' && d.status !== 'paid')
    .reduce((s, d) => s + (d.amount - (d.paidAmount || 0)), 0);

  return (
    <>
      {/* Widget 1: Savings Goals & Jars */}
      <View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {language === 'ar' ? '🎯 حصالات وأهداف الادخار' : 'SAVINGS GOALS'}
          </Text>
          <Pressable onPress={() => router.push('/savings-goals')}>
            <Text style={styles.seeAll}>{language === 'ar' ? 'إدارة' : 'Manage'}</Text>
          </Pressable>
        </View>

        {goals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="gift-outline"
              size={40}
              color={Colors.textTertiary}
              style={{ marginBottom: 4 }}
            />
            <Text style={styles.emptyTitle}>
              {language === 'ar' ? 'لا توجد أهداف ادخار نشطة' : 'No active savings goals'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {language === 'ar' ? 'ابدأ بإنشاء حصالتك الأولى الآن!' : 'Start your first savings goal now!'}
            </Text>
          </View>
        ) : (
          <View style={styles.recentListCard}>
            {goals.slice(0, 3).map((goal) => {
              const progress =
                goal.targetAmount > 0
                  ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100))
                  : 0;
              return (
                <View key={goal.id} style={{ marginVertical: 8 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: Colors.primary + '15',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MaterialIcons name="flag" size={18} color={Colors.primary} />
                      </View>
                      <View>
                        <Text
                          style={{
                            fontFamily: 'Cairo_700Bold',
                            fontSize: 14,
                            color: Colors.text,
                            textAlign: 'left',
                          }}
                        >
                          {goal.name}
                        </Text>
                        <Text
                          style={{
                            fontFamily: 'Cairo_400Regular',
                            fontSize: 10,
                            color: Colors.textSecondary,
                            textAlign: 'left',
                          }}
                        >
                          {formatCurrency(goal.savedAmount, language)} / {formatCurrency(goal.targetAmount, language)} {currencySymbol}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        fontFamily: 'Cairo_700Bold',
                        fontSize: 14,
                        color: Colors.primary,
                      }}
                    >
                      {progress}%
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: Colors.surfaceAlt,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: 6,
                        width: `${progress}%`,
                        backgroundColor:
                          progress >= 100 ? Colors.accent : Colors.primary,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Widget 2: Debts & Loans Summary */}
      <View style={{ marginTop: 20 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {language === 'ar' ? '🤝 سجل الديون والالتزامات' : 'DEBTS & LOANS'}
          </Text>
          <Pressable onPress={() => router.push('/debts')}>
            <Text style={styles.seeAll}>{language === 'ar' ? 'إدارة' : 'Manage'}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              padding: 14,
              gap: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'Cairo_600SemiBold',
                fontSize: 10,
                color: colors.textTertiary,
                textAlign: 'left',
              }}
            >
              {language === 'ar' ? 'ديون مستحقة عليّ' : 'I OWE (DEBTS)'}
            </Text>
            <Text
              style={{
                fontFamily: 'Cairo_700Bold',
                fontSize: 16,
                color: Colors.expense,
                textAlign: 'left',
              }}
            >
              {formatCurrency(totalOwed, language)} {currencySymbol}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              padding: 14,
              gap: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'Cairo_600SemiBold',
                fontSize: 10,
                color: colors.textTertiary,
                textAlign: 'left',
              }}
            >
              {language === 'ar' ? 'أموال لي بالخارج' : 'OWED TO ME (LOANS)'}
            </Text>
            <Text
              style={{
                fontFamily: 'Cairo_700Bold',
                fontSize: 16,
                color: Colors.income,
                textAlign: 'left',
              }}
            >
              {formatCurrency(totalCollect, language)} {currencySymbol}
            </Text>
          </View>
        </View>
      </View>

      {/* Widget 3: Smart Integration Summary */}
      {plan && (() => {
        const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
        const planTarget =
          plan.savingsGoal > 0
            ? plan.savingsGoal
            : plan.monthlySaving * plan.durationMonths;
        const walletInc = walletTransactions
          .filter(
            (t) =>
              t.type === 'income' ||
              (t.type === 'transfer' && t.toWalletId === selectedWalletId)
          )
          .reduce((s, t) => s + t.amount, 0);
        const walletExp = walletTransactions
          .filter(
            (t) =>
              t.type === 'expense' ||
              (t.type === 'transfer' && t.walletId === selectedWalletId)
          )
          .reduce((s, t) => s + t.amount, 0);
        const walletNet = walletInc - walletExp;
        const netSavings = walletNet + totalSaved - totalOwed + totalCollect;
        const planProgress =
          planTarget > 0 ? Math.min(100, Math.max(0, (netSavings / planTarget) * 100)) : 0;

        return (
          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.primary + '30',
              borderRadius: 20,
              padding: 16,
              marginTop: 20,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="link" size={16} color={colors.primary} />
              <Text
                style={{
                  fontFamily: 'Cairo_700Bold',
                  fontSize: 13,
                  color: colors.text,
                }}
              >
                {language === 'ar' ? 'الصورة الكاملة للوضع المالي' : 'Complete Financial Picture'}
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              {/* Wallet Balance */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="wallet-outline" size={14} color={colors.textSecondary} />
                  <Text
                    style={{
                      fontFamily: 'Cairo_400Regular',
                      fontSize: 12,
                      color: colors.textSecondary,
                    }}
                  >
                    {language === 'ar' ? 'رصيد المحفظة' : 'Wallet Balance'}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: 'Cairo_600SemiBold',
                    fontSize: 12,
                    color: walletNet >= 0 ? Colors.income : Colors.expense,
                  }}
                >
                  {walletNet >= 0 ? '+' : ''}
                  {formatCurrency(walletNet, language)} {currencySymbol}
                </Text>
              </View>

              {/* Savings Jars */}
              <Pressable
                onPress={() => router.push('/savings-goals')}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="gift-outline" size={14} color={colors.primary} />
                  <Text
                    style={{
                      fontFamily: 'Cairo_400Regular',
                      fontSize: 12,
                      color: colors.primary,
                    }}
                  >
                    {language === 'ar'
                      ? `الحصالات (${goals.length})`
                      : `Savings Jars (${goals.length})`}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: 'Cairo_600SemiBold',
                    fontSize: 12,
                    color: colors.primary,
                  }}
                >
                  +{formatCurrency(totalSaved, language)} {currencySymbol}
                </Text>
              </Pressable>

              {/* Debts I owe */}
              {totalOwed > 0 && (
                <Pressable
                  onPress={() => router.push('/debts')}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name="arrow-down-circle-outline"
                      size={14}
                      color={Colors.expense}
                    />
                    <Text
                      style={{
                        fontFamily: 'Cairo_400Regular',
                        fontSize: 12,
                        color: Colors.expense,
                      }}
                    >
                      {language === 'ar' ? 'ديون مستحقة عليّ' : 'Debts I owe'}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: 'Cairo_600SemiBold',
                      fontSize: 12,
                      color: Colors.expense,
                    }}
                  >
                    -{formatCurrency(totalOwed, language)} {currencySymbol}
                  </Text>
                </Pressable>
              )}

              {/* Loans owed to me */}
              {totalCollect > 0 && (
                <Pressable
                  onPress={() => router.push('/debts')}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name="arrow-up-circle-outline"
                      size={14}
                      color={Colors.income}
                    />
                    <Text
                      style={{
                        fontFamily: 'Cairo_400Regular',
                        fontSize: 12,
                        color: Colors.income,
                      }}
                    >
                      {language === 'ar' ? 'قروض لي بالخارج' : 'Loans owed to me'}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: 'Cairo_600SemiBold',
                      fontSize: 12,
                      color: Colors.income,
                    }}
                  >
                    +{formatCurrency(totalCollect, language)} {currencySymbol}
                  </Text>
                </Pressable>
              )}

              <View style={{ height: 1, backgroundColor: colors.border }} />

              {/* Total Net Savings */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Cairo_700Bold',
                    fontSize: 13,
                    color: colors.text,
                  }}
                >
                  {language === 'ar' ? 'الصافي الادخاري الكلي' : 'Total Net Savings'}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Cairo_700Bold',
                    fontSize: 14,
                    color: netSavings >= 0 ? Colors.primary : Colors.expense,
                  }}
                >
                  {formatCurrency(netSavings, language)} {currencySymbol}
                </Text>
              </View>

              {/* Progress bar */}
              {planTarget > 0 && (
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text
                      style={{
                        fontFamily: 'Cairo_400Regular',
                        fontSize: 10,
                        color: Colors.textSecondary,
                      }}
                    >
                      {language === 'ar'
                        ? `هدف الخطة: ${formatCurrency(planTarget, language)} ${currencySymbol}`
                        : `Plan Target: ${formatCurrency(planTarget, language)} ${currencySymbol}`}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Cairo_700Bold',
                        fontSize: 10,
                        color: planProgress >= 100 ? Colors.accent : Colors.primary,
                      }}
                    >
                      {Math.round(planProgress)}%
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 5,
                      backgroundColor: Colors.surfaceAlt,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: 5,
                        width: `${Math.min(100, planProgress)}%`,
                        backgroundColor:
                          planProgress >= 100 ? Colors.accent : Colors.primary,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      })()}
    </>
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
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 30,
      backgroundColor: colors.surface,
      borderRadius: 16,
      gap: 6,
    },
    emptyTitle: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 15,
      color: colors.textSecondary,
    },
    emptySubtitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 13,
      color: colors.textTertiary,
    },
    recentListCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
  });
