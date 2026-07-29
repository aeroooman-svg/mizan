import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import Colors from '@/constants/colors';
import { FinancialPlan } from '@/lib/planStorage';
import { SavingsGoal } from '@/lib/goalStorage';
import { Debt } from '@/lib/debtStorage';
import { Transaction } from '@/lib/storage';
import { RemittanceStats } from '@/lib/remittanceStorage';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';
import { getRecurringTransactions, RecurringTransaction } from '@/lib/recurringStorage';
import { getJameyas, Jameya } from '@/lib/jameyaStorage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface FinancialJourneySliderProps {
  plan: FinancialPlan | null;
  goals: SavingsGoal[];
  debts: Debt[];
  budgets: Record<string, number>;
  remittanceStats: RemittanceStats | null;
  walletTransactions: Transaction[];
  selectedWalletId: string | undefined;
  totalConsolidatedBalance?: number;
  totalIncomeVal?: number;
  totalExpenseVal?: number;
  healthScore?: number;
  currencySymbol: string;
  language: 'ar' | 'en';
  colors: any;
  onOpenRemittanceModal: () => void;
  onOpenConverterModal: () => void;
}

export default function FinancialJourneySlider({
  plan,
  goals,
  debts,
  budgets,
  remittanceStats,
  walletTransactions,
  selectedWalletId,
  totalConsolidatedBalance = 0,
  totalIncomeVal = 0,
  totalExpenseVal = 0,
  healthScore = 100,
  currencySymbol,
  language,
  colors,
  onOpenRemittanceModal,
  onOpenConverterModal,
}: FinancialJourneySliderProps) {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.min(360, Math.max(290, windowWidth - 48));
  const cardGap = 16;
  const styles = getStyles(colors, cardWidth);

  const [activeIndex, setActiveIndex] = useState(0);
  const [recurringItems, setRecurringItems] = useState<RecurringTransaction[]>([]);
  const [showAllRecurring, setShowAllRecurring] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const isAr = language === 'ar';

  const [jameyaItems, setJameyaItems] = useState<Jameya[]>([]);

  useEffect(() => {
    let isMounted = true;
    getRecurringTransactions().then((items) => {
      if (isMounted) {
        if (selectedWalletId) {
          setRecurringItems(items.filter(i => i.walletId === selectedWalletId || i.toWalletId === selectedWalletId));
        } else {
          setRecurringItems(items);
        }
      }
    });
    getJameyas().then((list) => {
      if (isMounted) {
        if (selectedWalletId) {
          setJameyaItems(list.filter(j => j.walletId === selectedWalletId));
        } else {
          setJameyaItems(list);
        }
      }
    });
    return () => { isMounted = false; };
  }, [selectedWalletId, walletTransactions]);

  const totalJameyaSavings = useMemo(() => {
    return jameyaItems.reduce((sum, j) => {
      const sharesCount = j.sharesCount || 1;
      const singleShareVal = j.singleShareAmount || (j.monthlyAmount / sharesCount);
      const paidForOneShare = singleShareVal * j.paidMonthsCount;
      return sum + (paidForOneShare * sharesCount);
    }, 0);
  }, [jameyaItems]);

  const recurringTotals = useMemo(() => {
    let incomeTotal = 0;
    let outflowTotal = 0;
    recurringItems.forEach(item => {
      if (item.isActive === false) return;
      let amt = item.amount;
      if (item.frequency === 'daily') amt *= 30;
      else if (item.frequency === 'weekly') amt *= 4.33;
      else if (item.frequency === 'yearly') amt /= 12;

      if (item.type === 'income') {
        incomeTotal += amt;
      } else {
        outflowTotal += amt;
      }
    });
    return { incomeTotal, outflowTotal };
  }, [recurringItems]);

  const totalSavedInGoals = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
  const totalOwed = debts
    .filter((d) => d.type === 'debt_to_others' && d.status !== 'paid')
    .reduce((s, d) => s + (d.amount - (d.paidAmount || 0)), 0);
  const totalCollect = debts
    .filter((d) => d.type === 'debt_to_me' && d.status !== 'paid')
    .reduce((s, d) => s + (d.amount - (d.paidAmount || 0)), 0);

  const totalNetSavings = totalConsolidatedBalance + totalSavedInGoals + totalJameyaSavings - totalOwed + totalCollect;

  const totalGoalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
  const totalGoalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const goalProgress = totalGoalTarget > 0 ? Math.min(100, Math.round((totalGoalSaved / totalGoalTarget) * 100)) : 0;

  const budgetCategories = Object.keys(budgets);
  const topBudgets = budgetCategories.slice(0, 3).map(catKey => {
    const limit = budgets[catKey] || 0;
    const spent = walletTransactions
      .filter(t => t.category === catKey && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    return { name: catKey, limit, spent, pct };
  });

  const scrollToIndex = (index: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ x: index * (cardWidth + cardGap), animated: true });
      setActiveIndex(index);
    }
  };

  return (
    <View style={styles.container}>
      {/* Slider Header with Title and Arrows */}
      <View style={styles.sliderHeader}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={18} color="#F59E0B" />
          <Text style={styles.sliderTitle}>
            {isAr ? 'رؤيتك المالية والادخار 🎯' : 'Financial & Savings Outlook 🎯'}
          </Text>
        </View>

        <View style={[styles.arrowControls, { direction: 'ltr', flexDirection: 'row' } as any]}>
          {/* Left Button (<) */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              scrollToIndex(activeIndex === 0 ? 1 : activeIndex - 1);
            }}
            style={({ pressed }) => [
              styles.arrowBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={colors.text}
            />
          </Pressable>

          {/* Right Button (>) */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              scrollToIndex((activeIndex + 1) % 2);
            }}
            style={({ pressed }) => [
              styles.arrowBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.text}
            />
          </Pressable>
        </View>
      </View>

      {/* Horizontal Scroll Cards */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + cardGap}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContainer}
        onMomentumScrollEnd={(e) => {
          const offsetX = e.nativeEvent.contentOffset.x;
          const idx = Math.round(offsetX / (cardWidth + cardGap));
          if (idx !== activeIndex && idx >= 0 && idx <= 1) {
            setActiveIndex(idx);
          }
        }}
      >
        {/* CARD 1: الصورة الكاملة للوضع المالي */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isAr ? 'الصورة الكاملة للوضع المالي' : 'Full Financial Picture'}
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/stats')}>
              <Text style={styles.cardAction}>{isAr ? 'التحليلات' : 'Analytics'}</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <View style={{ backgroundColor: colors.primary + '12', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '25', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary, marginBottom: 1 }}>
                {isAr ? 'إجمالي الرصيد الشامل للمحافظ' : 'Total Consolidated Balance'}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 20, color: totalConsolidatedBalance >= 0 ? colors.income : colors.expense }}>
                {totalConsolidatedBalance >= 0 ? '' : '-'}
                {formatCurrency(Math.abs(totalConsolidatedBalance), language)} {currencySymbol}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceAlt + '60', padding: 8, borderRadius: 12 }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>{isAr ? 'الدخل' : 'Income'}</Text>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: '#10B981', marginTop: 1 }}>
                  +{formatCurrency(totalIncomeVal, language)}
                </Text>
              </View>

              <View style={{ width: 1, height: 20, backgroundColor: colors.border }} />

              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>{isAr ? 'المصروف' : 'Expense'}</Text>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: '#EF4444', marginTop: 1 }}>
                  -{formatCurrency(totalExpenseVal, language)}
                </Text>
              </View>

              <View style={{ width: 1, height: 20, backgroundColor: colors.border }} />

              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>{isAr ? 'الصحة' : 'Health'}</Text>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: '#F59E0B', marginTop: 1 }}>
                  {healthScore}%
                </Text>
              </View>
            </View>

            {/* Expandable Dropdown Toggle Button */}
            <Pressable
              onPress={() => {
                try { Haptics.selectionAsync(); } catch {}
                setIsDetailsExpanded(!isDetailsExpanded);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 8,
                backgroundColor: colors.primary + '15',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.primary + '30',
              }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.primary }}>
                {isAr ? (isDetailsExpanded ? 'إخفاء التفاصيل 🔼' : 'عرض باقي تفاصيل الوضع المالي 🔽') : (isDetailsExpanded ? 'Hide Details 🔼' : 'Show Full Breakdown 🔽')}
              </Text>
            </Pressable>

            {/* Detailed Breakdown List (When Expanded) */}
            {isDetailsExpanded && (
              <View style={{ gap: 6, backgroundColor: colors.surfaceAlt + '40', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                {/* Savings Goals */}
                <Pressable onPress={() => router.push('/savings-goals')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="gift-outline" size={13} color="#10B981" />
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                      {isAr ? `الحصالات الادخارية (${goals.length}):` : `Savings Jars (${goals.length}):`}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: '#10B981' }}>
                    +{formatCurrency(totalSavedInGoals, language)} {currencySymbol}
                  </Text>
                </Pressable>

                {/* ROSCA Jameya Savings */}
                <Pressable onPress={() => router.push('/jameya' as any)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="piggy-bank" size={13} color="#0D7C66" />
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                      {isAr ? `مدفوعات الجمعيات (ادخار ${jameyaItems.length}):` : `ROSCA Savings (${jameyaItems.length}):`}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: '#0D7C66' }}>
                    +{formatCurrency(totalJameyaSavings, language)} {currencySymbol}
                  </Text>
                </Pressable>

                {/* Debts I Owe */}
                <Pressable onPress={() => router.push('/debts')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="receipt-outline" size={13} color={totalOwed > 0 ? '#EF4444' : colors.textSecondary} />
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: totalOwed > 0 ? '#EF4444' : colors.textSecondary }}>
                      {isAr ? 'ديون مستحقة عليّ:' : 'Debts I Owe:'}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: totalOwed > 0 ? '#EF4444' : colors.textSecondary }}>
                    {totalOwed > 0 ? '-' : ''}{formatCurrency(totalOwed, language)} {currencySymbol}
                  </Text>
                </Pressable>

                {/* Loans Owed to Me */}
                <Pressable onPress={() => router.push('/debts')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="cash-outline" size={13} color={totalCollect > 0 ? '#10B981' : colors.textSecondary} />
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: totalCollect > 0 ? '#10B981' : colors.textSecondary }}>
                      {isAr ? 'أموال لي بالخارج:' : 'Loans Owed to Me:'}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: totalCollect > 0 ? '#10B981' : colors.textSecondary }}>
                    {totalCollect > 0 ? '+' : ''}{formatCurrency(totalCollect, language)} {currencySymbol}
                  </Text>
                </Pressable>

                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 1 }} />

                {/* Total Net Savings */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.text }}>
                    {isAr ? 'الصافي الادخاري الكلي الحقيقي:' : 'Total Net Savings:'}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: totalNetSavings >= 0 ? colors.income : colors.expense }}>
                    {formatCurrency(totalNetSavings, language)} {currencySymbol}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {/* CARD 2: الأهداف المالية وحصالة الادخار المبتكرة */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="trophy" size={18} color="#F59E0B" />
              <Text style={styles.cardTitle}>
                {isAr ? 'أهداف الادخار والحصالات' : 'Savings Goals & Jars'}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/savings-goals')}>
              <Text style={styles.cardAction}>{isAr ? 'إدارة ⚙️' : 'Manage ⚙️'}</Text>
            </Pressable>
          </View>

          {goals.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View style={styles.goalContentRow}>
                <View style={styles.svgRingContainer}>
                  <Svg width={72} height={72}>
                    <Circle cx={36} cy={36} r={28} fill="none" stroke={colors.border} strokeWidth={6} />
                    <Circle
                      cx={36}
                      cy={36}
                      r={28}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth={6}
                      strokeDasharray={`${(goalProgress / 100) * 2 * Math.PI * 28} ${2 * Math.PI * 28}`}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                    />
                  </Svg>
                  <View style={styles.svgCenterText}>
                    <Text style={styles.svgPctText}>{goalProgress}%</Text>
                  </View>
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.goalCountText}>
                    {isAr ? `تم توفير بـ ${goals.length} حصالات:` : `Saved in ${goals.length} Jars:`}
                  </Text>
                  <Text style={styles.goalSavedSub}>
                    {formatCurrency(totalGoalSaved, language)} {currencySymbol}
                  </Text>
                  <Text style={styles.goalTargetSub}>
                    {isAr ? `إجمالي المستهدف: ${formatCurrency(totalGoalTarget, language)}` : `Target: ${formatCurrency(totalGoalTarget, language)}`}
                  </Text>
                </View>
              </View>

              {/* Nearest Active Goal Preview Bar */}
              {goals[0] && (
                <Pressable
                  onPress={() => router.push('/savings-goals')}
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    padding: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 4,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.text }} numberOfLines={1}>
                      🎯 {goals[0].name}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: '#F59E0B' }}>
                      {Math.min(100, Math.round((goals[0].savedAmount / goals[0].targetAmount) * 100))}%
                    </Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.round((goals[0].savedAmount / goals[0].targetAmount) * 100))}%`,
                        backgroundColor: '#F59E0B',
                        borderRadius: 2,
                      }}
                    />
                  </View>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.emptyCardContent}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trophy-outline" size={22} color="#F59E0B" />
              </View>
              <Text style={styles.emptyCardText}>
                {isAr ? 'لا توجد أهداف ادخار مفعلة بعد' : 'No savings goals created yet'}
              </Text>
              <Pressable
                onPress={() => router.push('/savings-goals')}
                style={styles.cardBtn}
              >
                <Text style={styles.cardBtnText}>{isAr ? '+ إنشاء هدف ادخار' : '+ New Goal'}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.paginationDots}>
        {[0, 1].map((idx) => (
          <Pressable
            key={idx}
            onPress={() => scrollToIndex(idx)}
            style={[
              styles.dot,
              activeIndex === idx && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const getStyles = (colors: any, cardWidth: number) =>
  StyleSheet.create({
    container: {
      marginVertical: 16,
    },
    sliderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sliderTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.text,
    },
    arrowControls: {
      flexDirection: 'row',
      gap: 8,
    },
    arrowBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    arrowBtnDisabled: {
      opacity: 0.3,
    },
    scrollContainer: {
      paddingHorizontal: 20,
      gap: 16,
    },
    card: {
      width: cardWidth,
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'space-between',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    cardTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
    },
    cardAction: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.primary,
    },
    budgetsList: {
      gap: 10,
    },
    budgetItem: {
      gap: 4,
    },
    budgetMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    budgetName: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.text,
    },
    budgetAmount: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    barBg: {
      height: 6,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 3,
    },
    emptyCardContent: {
      alignItems: 'center',
      paddingVertical: 16,
      gap: 8,
    },
    emptyCardText: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    cardBtn: {
      backgroundColor: colors.primary + '18',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 10,
    },
    cardBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.primary,
    },
    goalContentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    svgRingContainer: {
      width: 76,
      height: 76,
      alignItems: 'center',
      justifyContent: 'center',
    },
    svgCenterText: {
      position: 'absolute',
    },
    svgPctText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
    },
    goalCountText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
    },
    goalSavedSub: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: '#F59E0B',
    },
    goalTargetSub: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    subsList: {
      gap: 8,
    },
    subItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceAlt,
      padding: 10,
      borderRadius: 12,
    },
    subName: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.text,
      flex: 1,
    },
    subStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    subStatusText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 10,
    },
    remittanceCardBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    remittanceIconCircle: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: '#10B98118',
      alignItems: 'center',
      justifyContent: 'center',
    },
    remittanceTotalText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: colors.text,
    },
    remittanceSubText: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    remittanceBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#10B981',
      paddingVertical: 10,
      borderRadius: 12,
    },
    remittanceBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: '#FFF',
    },
    paginationDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 20,
      backgroundColor: colors.primary,
    },
  });
