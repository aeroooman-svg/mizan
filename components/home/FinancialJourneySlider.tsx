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
    return () => { isMounted = false; };
  }, [selectedWalletId, walletTransactions]);

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

  const totalNetSavings = totalConsolidatedBalance + totalSavedInGoals - totalOwed + totalCollect;

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
            {isAr ? 'رحلتي المالية' : 'Financial Journey'}
          </Text>
        </View>

        <View style={[styles.arrowControls, { direction: 'ltr', flexDirection: 'row' } as any]}>
          {/* Left Button (<) */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              scrollToIndex(activeIndex === 0 ? 5 : activeIndex - 1);
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
              scrollToIndex((activeIndex + 1) % 6);
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
          if (idx !== activeIndex && idx >= 0 && idx <= 5) {
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
        {/* CARD 1: الأهداف المالية وحصالة الادخار */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isAr ? 'الأهداف المالية' : 'Savings Goals'}
            </Text>
            <Pressable onPress={() => router.push('/savings-goals')}>
              <Text style={styles.cardAction}>{isAr ? 'إدارة' : 'Manage'}</Text>
            </Pressable>
          </View>

          <View style={styles.goalContentRow}>
            <View style={styles.svgRingContainer}>
              <Svg width={76} height={76}>
                <Circle cx={38} cy={38} r={30} fill="none" stroke={colors.border} strokeWidth={6} />
                <Circle
                  cx={38}
                  cy={38}
                  r={30}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={6}
                  strokeDasharray={`${(goalProgress / 100) * 2 * Math.PI * 30} ${2 * Math.PI * 30}`}
                  strokeLinecap="round"
                  transform="rotate(-90 38 38)"
                />
              </Svg>
              <View style={styles.svgCenterText}>
                <Text style={styles.svgPctText}>{goalProgress}%</Text>
              </View>
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.goalCountText}>
                {isAr ? `إجمالي الأهداف: ${goals.length}` : `Total Goals: ${goals.length}`}
              </Text>
              <Text style={styles.goalSavedSub}>
                {formatCurrency(totalGoalSaved, language)} {currencySymbol}
              </Text>
              <Text style={styles.goalTargetSub}>
                {isAr ? `المستهدف: ${formatCurrency(totalGoalTarget, language)}` : `Target: ${formatCurrency(totalGoalTarget, language)}`}
              </Text>
            </View>
          </View>
        </View>

        {/* CARD 2: قارئ الفواتير بالذكاء الاصطناعي (فاتورة) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isAr ? 'فاتورة (مسح أوتوماتيكي)' : 'Receipt Scanner AI'}
            </Text>
            <Pressable onPress={() => router.push('/scan-receipt')}>
              <Text style={styles.cardAction}>{isAr ? 'افتح المسح' : 'Scan'}</Text>
            </Pressable>
          </View>

          <View style={styles.emptyCardContent}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="receipt" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.emptyCardText}>
              {isAr ? 'التقط صورة أي فاتورة لاستخراج البيانات أوتوماتيكياً' : 'Snap a photo of any receipt to auto-extract transaction'}
            </Text>
            <Pressable
              onPress={() => router.push('/scan-receipt')}
              style={styles.cardBtn}
            >
              <Text style={styles.cardBtnText}>{isAr ? '📷 مسح فاتورة' : '📷 Scan Receipt'}</Text>
            </Pressable>
          </View>
        </View>

        {/* CARD 3: كشف حساب (استيراد بنكي) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isAr ? 'كشف حساب (استيراد)' : 'Bank Statement'}
            </Text>
            <Pressable onPress={() => router.push('/import-statement' as any)}>
              <Text style={styles.cardAction}>{isAr ? 'استيراد' : 'Import'}</Text>
            </Pressable>
          </View>

          <View style={styles.emptyCardContent}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#3B82F618', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="document-text" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.emptyCardText}>
              {isAr ? 'رفع وتفريغ كشف الحساب البنكي بتنسيقات متعددة' : 'Upload and extract bank statements seamlessly'}
            </Text>
            <Pressable
              onPress={() => router.push('/import-statement' as any)}
              style={styles.cardBtn}
            >
              <Text style={styles.cardBtnText}>{isAr ? '📄 رفع كشف حساب' : '📄 Import Statement'}</Text>
            </Pressable>
          </View>
        </View>

        {/* CARD 4: المعاملات المتكررة الفعليه */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isAr ? 'المعاملات المتكررة' : 'Recurring Transactions'}
            </Text>
            <Pressable onPress={() => router.push('/recurring-list')}>
              <Text style={styles.cardAction}>{isAr ? 'عرض الكل 📋' : 'View All 📋'}</Text>
            </Pressable>
          </View>

          {recurringItems.length > 0 ? (
            <View style={{ gap: 8 }}>
              {/* Summary Header Row with Totals */}
              <View style={{ backgroundColor: colors.surfaceAlt + '60', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                    {isAr ? '📥 دخل متكرر:' : '📥 Recurring Income:'}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.income }}>
                    +{formatCurrency(recurringTotals.incomeTotal, language)} {currencySymbol}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                    {isAr ? '📤 مصاريف وتحويلات:' : '📤 Outflows & Bills:'}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.expense }}>
                    -{formatCurrency(recurringTotals.outflowTotal, language)} {currencySymbol}
                  </Text>
                </View>
              </View>

              {/* Transactions List */}
              <View style={styles.subsList}>
                {(showAllRecurring ? recurringItems : recurringItems.slice(0, 3)).map((item) => {
                  const cat = getCategoryById(item.category);
                  const name = item.description || (cat ? getCategoryName(cat.id, language) : item.category);
                  const iconName = item.icon || cat?.icon || 'sync-outline';
                  const isInc = item.type === 'income';
                  const itemColor = isInc ? colors.income : colors.expense;
                  const prefix = isInc ? '+' : '-';

                  return (
                    <View key={item.id} style={styles.subItem}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' }}>
                        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: (item.color || itemColor) + '15', alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialIcons name={iconName as any} size={16} color={item.color || itemColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subName} numberOfLines={1}>
                            {name}
                          </Text>
                          <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                            {item.frequency === 'daily' ? (isAr ? 'يومي' : 'Daily') :
                             item.frequency === 'weekly' ? (isAr ? 'أسبوعي' : 'Weekly') :
                             item.frequency === 'yearly' ? (isAr ? 'سنوي' : 'Yearly') :
                             (isAr ? 'شهري' : 'Monthly')}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: itemColor }}>
                        {prefix}{formatCurrency(item.amount, language)} {currencySymbol}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Dropdown / Collapsible Expand Toggle */}
              {recurringItems.length > 3 && (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowAllRecurring(!showAllRecurring);
                  }}
                  style={{ alignItems: 'center', paddingTop: 4 }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.primary }}>
                    {isAr
                      ? (showAllRecurring ? 'عرض أقل 🔼' : `عرض باقي المعاملات المتكررة (${recurringItems.length - 3}) 🔽`)
                      : (showAllRecurring ? 'Show Less 🔼' : `Show All (${recurringItems.length - 3}) 🔽`)}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.emptyCardContent}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="sync" size={22} color={colors.primary} />
              </View>
              <Text style={styles.emptyCardText}>
                {isAr ? 'لا توجد معاملات متكررة مضافة بعد' : 'No recurring transactions scheduled yet'}
              </Text>
              <Pressable
                onPress={() => router.push('/add-recurring')}
                style={styles.cardBtn}
              >
                <Text style={styles.cardBtnText}>{isAr ? '+ إضافة معاملة' : '+ Add Recurring'}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* CARD 4: حوالات المغتربين والبيت */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isAr ? 'حوالات المغتربين والبيت' : 'Family Remittances'}
            </Text>
            <Pressable onPress={onOpenRemittanceModal}>
              <Text style={styles.cardAction}>{isAr ? '+ إرسال' : '+ Send'}</Text>
            </Pressable>
          </View>

          <View style={styles.remittanceCardBody}>
            <View style={styles.remittanceIconCircle}>
              <Ionicons name="paper-plane" size={24} color="#10B981" />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.remittanceTotalText}>
                {remittanceStats
                  ? `${formatCurrency(remittanceStats.totalReceived, language)} ${currencySymbol}`
                  : `0.00 ${currencySymbol}`}
              </Text>
              <Text style={styles.remittanceSubText}>
                {isAr ? 'إجمالي المحول للعائلة هذا الشهر' : 'Total sent to family this month'}
              </Text>
            </View>
          </View>

          <Pressable onPress={onOpenRemittanceModal} style={styles.remittanceBtn}>
            <Ionicons name="send-outline" size={16} color="#FFF" />
            <Text style={styles.remittanceBtnText}>
              {isAr ? 'تسجيل حوالة جديدة' : 'Record New Remittance'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.paginationDots}>
        {[0, 1, 2, 3, 4, 5].map((idx) => (
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
