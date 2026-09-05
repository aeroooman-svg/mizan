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
  walletTransactions: Transaction[];
  selectedWalletId: string | undefined;
  totalConsolidatedBalance?: number;
  totalIncomeVal?: number;
  totalExpenseVal?: number;
  healthScore?: number;
  currencySymbol: string;
  language: 'ar' | 'en' | 'hi';
  colors: any;
  onOpenConverterModal: () => void;
  onOpenMonthlyReport?: () => void;
}

export default function FinancialJourneySlider({
  plan,
  goals,
  debts,
  budgets,
  walletTransactions,
  selectedWalletId,
  totalConsolidatedBalance = 0,
  totalIncomeVal = 0,
  totalExpenseVal = 0,
  healthScore = 100,
  currencySymbol,
  language,
  colors,
  onOpenConverterModal,
  onOpenMonthlyReport,
}: FinancialJourneySliderProps) {
  const loc = (ar: string, en: string, hi: string) => {
    if (language === 'hi') return hi;
    if (language === 'ar') return ar;
    return en;
  };

  const { width: windowWidth } = useWindowDimensions();
  const effectiveWidth = Math.min(windowWidth, 480);
  const cardGap = 16;
  const cardWidth = Math.max(280, effectiveWidth - 32);
  const styles = useMemo(() => getStyles(colors, cardWidth), [colors, cardWidth]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [pulseTab, setPulseTab] = useState<'weekly' | 'monthly'>('weekly');
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

  const pulseStats = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDay = now.getDate();
    const daysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();

    const msInDay = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = new Date(now.getTime() - 7 * msInDay);

    const prevMonthDate = new Date(curYear, curMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    let thisWeekSpent = 0;
    const weeklyCatMap: Record<string, number> = {};
    let biggestTx: Transaction | null = null;

    let curMonthTotal = 0;
    let prevMonthToDateTotal = 0;

    walletTransactions.forEach(tx => {
      const isExpense = tx.type === 'expense' && tx.category !== 'jameya_savings' && tx.category !== 'debt_loan';
      if (!isExpense) return;

      const d = new Date(tx.date);
      const txYear = d.getFullYear();
      const txMonth = d.getMonth();
      const txDay = d.getDate();

      // Weekly
      if (d >= sevenDaysAgo && d <= now) {
        thisWeekSpent += tx.amount;
        weeklyCatMap[tx.category] = (weeklyCatMap[tx.category] || 0) + tx.amount;

        if (!biggestTx || tx.amount > biggestTx.amount) {
          biggestTx = tx;
        }
      }

      // Monthly
      if (txYear === curYear && txMonth === curMonth) {
        curMonthTotal += tx.amount;
      } else if (txYear === prevYear && txMonth === prevMonth) {
        if (txDay <= curDay) {
          prevMonthToDateTotal += tx.amount;
        }
      }
    });

    let topCatId: string | null = null;
    let topCatAmount = 0;
    Object.entries(weeklyCatMap).forEach(([catId, amount]) => {
      if (amount > topCatAmount) {
        topCatAmount = amount;
        topCatId = catId;
      }
    });

    const dailyAverage = curDay > 0 ? curMonthTotal / curDay : 0;
    const projectedTotal = dailyAverage * daysInCurMonth;

    return {
      thisWeekSpent,
      topCatId,
      topCatAmount,
      biggestTx: biggestTx as Transaction | null,
      curMonthTotal,
      prevMonthToDateTotal,
      dailyAverage,
      projectedTotal,
    };
  }, [walletTransactions]);

  const pulseTopCategoryObj = pulseStats.topCatId ? getCategoryById(pulseStats.topCatId) : null;

  const totalJameyaSavings = useMemo(() => {
    return jameyaItems.reduce((sum, j) => {
      const sharesCount = j.sharesCount || 1;
      const singleShareVal = j.singleShareAmount || (j.monthlyAmount / sharesCount);
      const paidForOneShare = singleShareVal * j.paidMonthsCount;
      return sum + (paidForOneShare * sharesCount);
    }, 0);
  }, [jameyaItems]);

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
            {loc('رؤيتك المالية والادخار 🎯', 'Financial & Savings Outlook 🎯', 'वित्तीय और बचत दृष्टिकोण 🎯')}
          </Text>
        </View>

        <View style={[styles.arrowControls, { direction: 'ltr', flexDirection: 'row' } as any]}>
          {/* Left Button (<) */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              scrollToIndex(activeIndex === 0 ? 2 : activeIndex - 1);
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
              scrollToIndex(activeIndex === 2 ? 0 : activeIndex + 1);
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
          if (idx !== activeIndex && idx >= 0 && idx <= 2) {
            setActiveIndex(idx);
          }
        }}
      >
        {/* CARD 1: النبض المالي ومعدل الصرف */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="flash" size={17} color="#10B981" />
              <Text style={styles.cardTitle}>
                {loc('النبض المالي ومعدل الصرف', 'Financial Pulse & Pace', 'वित्तीय नब्ज और खर्च गति')}
              </Text>
            </View>

            {/* Tab switch */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 2, gap: 2 }}>
              <Pressable
                onPress={() => {
                  try { Haptics.selectionAsync(); } catch {}
                  setPulseTab('weekly');
                }}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                  backgroundColor: pulseTab === 'weekly' ? colors.primary : 'transparent',
                }}
              >
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: pulseTab === 'weekly' ? '#FFF' : colors.textSecondary }}>
                  {loc('7 أيام', '7 Days', '7 दिन')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  try { Haptics.selectionAsync(); } catch {}
                  setPulseTab('monthly');
                }}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                  backgroundColor: pulseTab === 'monthly' ? colors.primary : 'transparent',
                }}
              >
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: pulseTab === 'monthly' ? '#FFF' : colors.textSecondary }}>
                  {loc('الشهري', 'Monthly', 'मासिक')}
                </Text>
              </Pressable>
            </View>
          </View>

          {pulseTab === 'weekly' ? (
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={{ gap: 8 }}>
                {/* 7 Days Spending Box */}
                <View style={{ backgroundColor: colors.surfaceAlt, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                      {loc('منصرف الـ 7 أيام الماضية:', 'Past 7 Days Spending:', 'पिछले 7 दिनों का खर्च:')}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 18, color: colors.expense, marginTop: 1 }}>
                      {formatCurrency(pulseStats.thisWeekSpent, language)} <Text style={{ fontSize: 11 }}>{currencySymbol}</Text>
                    </Text>
                  </View>

                  {pulseStats.biggestTx && (
                    <View style={{ alignItems: 'flex-end', backgroundColor: '#EF444412', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: colors.textSecondary }}>
                        {loc('أكبر عملية', 'Largest', 'सबसे बड़ा')}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.expense }}>
                        {formatCurrency(pulseStats.biggestTx.amount, language)} {currencySymbol}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Top Category Chip */}
                {pulseStats.topCatId && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                    <MaterialIcons
                      name={(pulseTopCategoryObj?.icon as any) || 'local-grocery-store'}
                      size={16}
                      color={pulseTopCategoryObj?.color || colors.primary}
                    />
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary, flex: 1 }}>
                      {loc('أعلى فئة صرف:', 'Top Category:', 'शीर्ष खर्च श्रेणी:')}{' '}
                      <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>
                        {getCategoryName(pulseStats.topCatId, language)}
                      </Text>
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.text }}>
                      {formatCurrency(pulseStats.topCatAmount, language)} {currencySymbol}
                    </Text>
                  </View>
                )}
              </View>

              {/* Monthly Digest Button */}
              {onOpenMonthlyReport && (
                <Pressable
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    onOpenMonthlyReport();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#10B981',
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    marginTop: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="sparkles" size={13} color="#FFF" />
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: '#FFF' }}>
                      {loc('عرض التقرير الشهري الشامل', 'View Monthly Digest', 'मासिक सारांश रिपोर्ट देखें')}
                    </Text>
                  </View>
                  <Ionicons name={language === 'ar' ? 'chevron-back' : 'chevron-forward'} size={14} color="#FFF" />
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={{ gap: 8 }}>
                {/* Daily Pace & Projected Grid */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9.5, color: colors.textSecondary }}>
                      {loc('معدل الصرف اليومي', 'Daily Pace', 'दैनिक खर्च दर')}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text, marginTop: 2 }}>
                      {formatCurrency(pulseStats.dailyAverage, language)} <Text style={{ fontSize: 9 }}>{currencySymbol}{loc('/يوم', '/day', '/दिन')}</Text>
                    </Text>
                  </View>

                  <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9.5, color: colors.textSecondary }}>
                      {loc('التوقع لنهاية الشهر', 'Projected End', 'महीने के अंत तक अनुमान')}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text, marginTop: 2 }}>
                      {formatCurrency(pulseStats.projectedTotal, language)} <Text style={{ fontSize: 9 }}>{currencySymbol}</Text>
                    </Text>
                  </View>
                </View>

                {/* MoM Comparison info */}
                <View style={{ backgroundColor: colors.surfaceAlt, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                    {loc('نفس الفترة الشهر الماضي:', 'Same Period Last Month:', 'पिछले महीने की समान अवधि:')}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.textSecondary }}>
                    {formatCurrency(pulseStats.prevMonthToDateTotal, language)} {currencySymbol}
                  </Text>
                </View>
              </View>

              {/* Monthly Digest Button */}
              {onOpenMonthlyReport && (
                <Pressable
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    onOpenMonthlyReport();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#10B981',
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    marginTop: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="sparkles" size={13} color="#FFF" />
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: '#FFF' }}>
                      {loc('عرض التقرير الشهري الشامل', 'View Monthly Digest', 'मासिक सारांश रिपोर्ट देखें')}
                    </Text>
                  </View>
                  <Ionicons name={language === 'ar' ? 'chevron-back' : 'chevron-forward'} size={14} color="#FFF" />
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* CARD 2: الصورة الكاملة للوضع المالي */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {loc('الصورة الكاملة للوضع المالي', 'Full Financial Picture', 'वित्तीय स्थिति का संपूर्ण दृश्य')}
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/stats')}>
              <Text style={styles.cardAction}>{loc('التحليلات', 'Analytics', 'विश्लेषण')}</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <View style={{ backgroundColor: colors.primary + '12', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '25', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary, marginBottom: 1 }}>
                {loc('إجمالي الرصيد الشامل للمحافظ', 'Total Consolidated Balance', 'समेकित कुल शेष')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 20, color: totalConsolidatedBalance >= 0 ? colors.income : colors.expense }}>
                {totalConsolidatedBalance >= 0 ? '' : '-'}
                {formatCurrency(Math.abs(totalConsolidatedBalance), language)} {currencySymbol}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceAlt + '60', padding: 8, borderRadius: 12 }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>{loc('الدخل', 'Income', 'आय')}</Text>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: '#10B981', marginTop: 1 }}>
                  +{formatCurrency(totalIncomeVal, language)}
                </Text>
              </View>

              <View style={{ width: 1, height: 20, backgroundColor: colors.border }} />

              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>{loc('المصروف', 'Expense', 'खर्च')}</Text>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: '#EF4444', marginTop: 1 }}>
                  -{formatCurrency(totalExpenseVal, language)}
                </Text>
              </View>

              <View style={{ width: 1, height: 20, backgroundColor: colors.border }} />

              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>{loc('الصحة', 'Health', 'स्वास्थ्य')}</Text>
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
                {isDetailsExpanded
                  ? loc('إخفاء التفاصيل 🔼', 'Hide Details 🔼', 'विवरण छिपाएं 🔼')
                  : loc('عرض باقي تفاصيل الوضع المالي 🔽', 'Show Full Breakdown 🔽', 'पूर्ण वित्तीय विवरण देखें 🔽')}
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
                      {loc(`الحصالات الادخارية (${goals.length}):`, `Savings Jars (${goals.length}):`, `बचत गुल्लक (${goals.length}):`)}
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
                      {loc(`مدفوعات الجمعيات (ادخار ${jameyaItems.length}):`, `ROSCA Savings (${jameyaItems.length}):`, `समिति बचत (${jameyaItems.length}):`)}
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
                      {loc('ديون مستحقة عليّ:', 'Debts I Owe:', 'मुझे चुकाना है:')}
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
                      {loc('أموال لي بالخارج:', 'Loans Owed to Me:', 'मुझे मिलना है:')}
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
                    {loc('الصافي الادخاري الكلي الحقيقي:', 'Total Net Savings:', 'वास्तविक कुल शुद्ध बचत:')}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: totalNetSavings >= 0 ? colors.income : colors.expense }}>
                    {formatCurrency(totalNetSavings, language)} {currencySymbol}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {/* CARD 3: الأهداف المالية وحصالة الادخار المبتكرة */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="trophy" size={18} color="#F59E0B" />
              <Text style={styles.cardTitle}>
                {loc('أهداف الادخار والحصالات', 'Savings Goals & Jars', 'बचत लक्ष्य और गुल्लक')}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/savings-goals')}>
              <Text style={styles.cardAction}>{loc('إدارة ⚙️', 'Manage ⚙️', 'प्रबंधन ⚙️')}</Text>
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
                    {loc(`تم توفير بـ ${goals.length} حصالات:`, `Saved in ${goals.length} Jars:`, `${goals.length} लक्ष्यों में बचत:`)}
                  </Text>
                  <Text style={styles.goalSavedSub}>
                    {formatCurrency(totalGoalSaved, language)} {currencySymbol}
                  </Text>
                  <Text style={styles.goalTargetSub}>
                    {loc(`إجمالي المستهدف: ${formatCurrency(totalGoalTarget, language)}`, `Target: ${formatCurrency(totalGoalTarget, language)}`, `कुल लक्ष्य: ${formatCurrency(totalGoalTarget, language)}`)}
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
                {loc('لا توجد أهداف ادخار مفعلة بعد', 'No savings goals created yet', 'अभी तक कोई बचत लक्ष्य नहीं बनाया गया')}
              </Text>
              <Pressable
                onPress={() => router.push('/savings-goals')}
                style={styles.cardBtn}
              >
                <Text style={styles.cardBtnText}>{loc('+ إنشاء هدف ادخار', '+ New Goal', '+ नया बचत लक्ष्य')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.paginationDots}>
        {[0, 1, 2].map((idx) => (
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
      paddingHorizontal: 16,
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
      paddingHorizontal: 16,
      gap: 16,
    },
    card: {
      width: cardWidth,
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
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
