import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Transaction } from '@/lib/storage';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SpendingHeatmapWidgetProps {
  transactions: Transaction[];
  currencySymbol: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 64) / 7);

export default function SpendingHeatmapWidget({
  transactions,
  currencySymbol,
}: SpendingHeatmapWidgetProps) {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const today = useMemo(() => new Date(), []);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [viewType, setViewType] = useState<'expense' | 'savings' | 'income'>('expense');

  // Helper to identify savings/loans/investments
  const isSavingsTx = (tx: Transaction) => {
    if (tx.category === 'jameya_savings' || tx.category === 'investment') return true;
    if (tx.category === 'debt_loan' && tx.type === 'expense') return true; // lending to someone
    return false;
  };

  // Month navigation offset (0 = current month, -1 = last month, etc.)
  const [monthOffset, setMonthOffset] = useState(0);

  const activeDate = useMemo(() => {
    return new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  }, [today, monthOffset]);

  const activeYear = activeDate.getFullYear();
  const activeMonth = activeDate.getMonth();
  const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(activeYear, activeMonth, 1).getDay();

  const isCurrentMonth = monthOffset === 0;

  const [selectedDayInfo, setSelectedDayInfo] = useState<{
    dayNumber: number;
    dateStr: string;
    totalAmount: number;
    txList: Transaction[];
  } | null>(null);

  // Toggle Collapse with animation
  const toggleCollapse = () => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsCollapsed(prev => !prev);
  };

  // Month navigation handlers
  const handlePrevMonth = () => {
    Haptics.selectionAsync();
    setMonthOffset(prev => prev - 1);
  };

  const handleNextMonth = () => {
    Haptics.selectionAsync();
    setMonthOffset(prev => prev + 1);
  };

  const handleResetMonth = () => {
    Haptics.selectionAsync();
    setMonthOffset(0);
  };

  // Aggregate spending/savings/income by day for the active month
  const dailyData = useMemo(() => {
    const map: Record<number, { total: number; txs: Transaction[] }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      map[d] = { total: 0, txs: [] };
    }

    transactions.forEach(tx => {
      let matches = false;
      if (viewType === 'expense') {
        // Only operational expenses (exclude savings, ROSCA, loan given, investments)
        matches = tx.type === 'expense' && !isSavingsTx(tx) && tx.category !== 'debt_loan';
      } else if (viewType === 'savings') {
        // Savings, ROSCA (jameya), goals/piggy bank, and loans given out
        matches = isSavingsTx(tx);
      } else if (viewType === 'income') {
        // Pure income (excluding debt loans)
        matches = tx.type === 'income' && tx.category !== 'debt_loan';
      }

      if (!matches) return;

      const d = new Date(tx.date);
      if (d.getFullYear() === activeYear && d.getMonth() === activeMonth) {
        const dayNum = d.getDate();
        if (map[dayNum]) {
          map[dayNum].total += tx.amount;
          map[dayNum].txs.push(tx);
        }
      }
    });

    return map;
  }, [transactions, activeYear, activeMonth, daysInMonth, viewType]);

  // Statistics for the active month
  const stats = useMemo(() => {
    let max = 0;
    let peakDay = 0;
    let zeroDaysCount = 0;
    let activeDaysCount = 0;
    let grandTotal = 0;
    const daysEvaluated = isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth;

    for (let d = 1; d <= daysInMonth; d++) {
      const amt = dailyData[d]?.total || 0;
      grandTotal += amt;
      if (amt > max) {
        max = amt;
        peakDay = d;
      }
      if (d <= daysEvaluated && amt === 0) {
        zeroDaysCount++;
      }
      if (amt > 0) {
        activeDaysCount++;
      }
    }

    const dailyAverage = daysEvaluated > 0 ? grandTotal / daysEvaluated : 0;

    return {
      maxAmount: max || 100,
      peakDay,
      peakAmount: max,
      zeroDaysCount,
      activeDaysCount,
      grandTotal,
      dailyAverage,
    };
  }, [dailyData, daysInMonth, isCurrentMonth, today]);

  // Color intensity calculator
  const getCellColor = (amount: number, isPassedDay: boolean) => {
    if (amount === 0) {
      if (viewType === 'expense' && isPassedDay) {
        // Zero-spend celebration color (subtle emerald tint)
        return 'rgba(16, 185, 129, 0.12)';
      }
      return colors.surfaceAlt || 'rgba(255,255,255,0.03)';
    }

    const ratio = amount / stats.maxAmount;

    if (viewType === 'expense') {
      if (ratio < 0.25) return 'rgba(245, 158, 11, 0.25)'; // Amber low
      if (ratio < 0.55) return 'rgba(249, 115, 22, 0.50)'; // Orange med
      if (ratio < 0.85) return 'rgba(239, 68, 68, 0.75)'; // Crimson high
      return '#EF4444'; // Peak high
    } else if (viewType === 'savings') {
      if (ratio < 0.25) return 'rgba(139, 92, 246, 0.25)'; // Purple low
      if (ratio < 0.55) return 'rgba(139, 92, 246, 0.50)'; // Purple med
      if (ratio < 0.85) return 'rgba(139, 92, 246, 0.80)'; // Purple high
      return '#8B5CF6'; // Peak savings
    } else {
      // Income mode
      if (ratio < 0.25) return 'rgba(6, 182, 212, 0.25)'; // Cyan low
      if (ratio < 0.55) return 'rgba(16, 185, 129, 0.50)'; // Emerald med
      if (ratio < 0.85) return 'rgba(16, 185, 129, 0.75)'; // Deep Emerald
      return '#10B981'; // Peak income
    }
  };

  const dayHeadersAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const dayHeadersEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayHeaders = isAr ? dayHeadersAr : dayHeadersEn;

  const monthNamesAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const formattedMonthName = isAr
    ? `${monthNamesAr[activeMonth]} ${activeYear}`
    : `${monthNamesEn[activeMonth]} ${activeYear}`;

  const styles = useMemo(() => getStyles(colors, isAr), [colors, isAr]);

  const viewThemeColor = viewType === 'expense' ? '#EF4444' : viewType === 'savings' ? '#8B5CF6' : '#10B981';
  const viewThemeBg = viewType === 'expense' ? 'rgba(239, 68, 68, 0.12)' : viewType === 'savings' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)';
  const viewIconName = viewType === 'expense' ? 'flame' : viewType === 'savings' ? 'shield-checkmark' : 'wallet';

  const viewTitle = isAr
    ? viewType === 'expense'
      ? 'الخريطة الحرارية للإنفاق'
      : viewType === 'savings'
      ? 'الخريطة الحرارية للادخار والسلف'
      : 'الخريطة الحرارية للإيرادات'
    : viewType === 'expense'
    ? 'Spending Heatmap'
    : viewType === 'savings'
    ? 'Savings & Loans Heatmap'
    : 'Income Heatmap';

  return (
    <View style={styles.card}>
      {/* Accordion / Collapsible Header */}
      <Pressable
        style={styles.headerPressable}
        onPress={toggleCollapse}
      >
        <View style={styles.titleRow}>
          <View style={[styles.iconCircle, { backgroundColor: viewThemeBg }]}>
            <Ionicons
              name={viewIconName}
              size={18}
              color={viewThemeColor}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {viewTitle}
            </Text>
            {isCollapsed && (
              <Text style={styles.collapsedSubtitle}>
                {formattedMonthName} • {
                  viewType === 'expense'
                    ? (isAr ? `${stats.zeroDaysCount} يوم توفير 🛡️` : `${stats.zeroDaysCount} No-Spend Days`)
                    : viewType === 'savings'
                    ? (isAr ? `${stats.activeDaysCount} يوم ادخار 💎` : `${stats.activeDaysCount} Savings Days`)
                    : (isAr ? `${stats.activeDaysCount} يوم دخل 💵` : `${stats.activeDaysCount} Income Days`)
                }
              </Text>
            )}
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.collapseToggleBtn}>
            <Ionicons
              name={isCollapsed ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </Pressable>

      {/* Expanded Content */}
      {!isCollapsed && (
        <View style={styles.expandedContent}>
          {/* Controls Bar: Type Switcher & Month Navigation */}
          <View style={styles.controlsBar}>
            {/* Type Selector (Expenses vs Savings vs Income) */}
            <View style={styles.typeSelector}>
              <Pressable
                style={[
                  styles.typeTabBtn,
                  viewType === 'expense' && { backgroundColor: '#EF4444' },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setViewType('expense');
                }}
              >
                <Ionicons name="flame" size={12} color={viewType === 'expense' ? '#FFF' : colors.textSecondary} />
                <Text
                  style={[
                    styles.typeTabText,
                    viewType === 'expense' ? { color: '#FFF', fontFamily: 'Cairo_700Bold' } : { color: colors.textSecondary },
                  ]}
                >
                  {isAr ? 'المصروفات' : 'Expenses'}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.typeTabBtn,
                  viewType === 'savings' && { backgroundColor: '#8B5CF6' },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setViewType('savings');
                }}
              >
                <Ionicons name="shield-checkmark" size={12} color={viewType === 'savings' ? '#FFF' : colors.textSecondary} />
                <Text
                  style={[
                    styles.typeTabText,
                    viewType === 'savings' ? { color: '#FFF', fontFamily: 'Cairo_700Bold' } : { color: colors.textSecondary },
                  ]}
                >
                  {isAr ? 'الادخار' : 'Savings'}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.typeTabBtn,
                  viewType === 'income' && { backgroundColor: '#10B981' },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setViewType('income');
                }}
              >
                <Ionicons name="trending-up" size={12} color={viewType === 'income' ? '#FFF' : colors.textSecondary} />
                <Text
                  style={[
                    styles.typeTabText,
                    viewType === 'income' ? { color: '#FFF', fontFamily: 'Cairo_700Bold' } : { color: colors.textSecondary },
                  ]}
                >
                  {isAr ? 'الإيرادات' : 'Income'}
                </Text>
              </Pressable>
            </View>

            {/* Month Navigator */}
            <View style={styles.monthNav}>
              <Pressable onPress={handlePrevMonth} hitSlop={8} style={styles.navArrowBtn}>
                <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={16} color={colors.text} />
              </Pressable>
              <Pressable onPress={handleResetMonth}>
                <Text style={styles.monthNavLabel}>{formattedMonthName}</Text>
              </Pressable>
              <Pressable onPress={handleNextMonth} hitSlop={8} style={styles.navArrowBtn}>
                <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Quick Insights Summary Bar */}
          <View style={styles.insightsBar}>
            {viewType === 'expense' ? (
              <>
                <View style={styles.insightStatItem}>
                  <Text style={styles.insightStatLabel}>
                    {isAr ? '🟢 أيام التوفير' : '🟢 No-Spend'}
                  </Text>
                  <Text style={[styles.insightStatValue, { color: '#10B981' }]}>
                    {stats.zeroDaysCount} {isAr ? 'يوم' : 'days'}
                  </Text>
                </View>

                <View style={styles.insightDivider} />

                <View style={styles.insightStatItem}>
                  <Text style={styles.insightStatLabel}>
                    {isAr ? '🔴 يوم الذروة' : '🔴 Peak Day'}
                  </Text>
                  <Text style={[styles.insightStatValue, { color: '#EF4444' }]}>
                    {stats.peakDay > 0 ? (isAr ? `يوم ${stats.peakDay}` : `Day ${stats.peakDay}`) : '-'}
                  </Text>
                </View>

                <View style={styles.insightDivider} />

                <View style={styles.insightStatItem}>
                  <Text style={styles.insightStatLabel}>
                    {isAr ? '⚡ المتوسط اليومي' : '⚡ Daily Avg'}
                  </Text>
                  <Text style={[styles.insightStatValue, { color: colors.text }]}>
                    {formatCurrency(stats.dailyAverage, language)} {currencySymbol}
                  </Text>
                </View>
              </>
            ) : viewType === 'savings' ? (
              <>
                <View style={styles.insightStatItem}>
                  <Text style={styles.insightStatLabel}>
                    {isAr ? '💎 أيام الادخار' : '💎 Savings Days'}
                  </Text>
                  <Text style={[styles.insightStatValue, { color: '#8B5CF6' }]}>
                    {stats.activeDaysCount} {isAr ? 'يوم' : 'days'}
                  </Text>
                </View>

                <View style={styles.insightDivider} />

                <View style={styles.insightStatItem}>
                  <Text style={styles.insightStatLabel}>
                    {isAr ? '🏆 أعلى ادخار' : '🏆 Peak Saved'}
                  </Text>
                  <Text style={[styles.insightStatValue, { color: '#8B5CF6' }]}>
                    {stats.peakDay > 0 ? (isAr ? `يوم ${stats.peakDay}` : `Day ${stats.peakDay}`) : '-'}
                  </Text>
                </View>

                <View style={styles.insightDivider} />

                <View style={styles.insightStatItem}>
                  <Text style={styles.insightStatLabel}>
                    {isAr ? '💰 إجمالي المدخرات' : '💰 Total Saved'}
                  </Text>
                  <Text style={[styles.insightStatValue, { color: colors.text }]}>
                    {formatCurrency(stats.grandTotal, language)} {currencySymbol}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.insightStatItem}>
                  <Text style={styles.insightStatLabel}>
                    {isAr ? '💵 أيام الدخل' : '💵 Income Days'}
                  </Text>
                  <Text style={[styles.insightStatValue, { color: '#10B981' }]}>
                    {stats.activeDaysCount} {isAr ? 'يوم' : 'days'}
                  </Text>
                </View>

                <View style={styles.insightDivider} />

                <View style={styles.insightStatItem}>
                  <Text style={styles.insightStatLabel}>
                    {isAr ? '⭐ أعلى دخل' : '⭐ Peak Income'}
                  </Text>
                  <Text style={[styles.insightStatValue, { color: '#10B981' }]}>
                    {stats.peakDay > 0 ? (isAr ? `يوم ${stats.peakDay}` : `Day ${stats.peakDay}`) : '-'}
                  </Text>
                </View>

                <View style={styles.insightDivider} />

                <View style={styles.insightStatItem}>
                  <Text style={styles.insightStatLabel}>
                    {isAr ? '📈 إجمالي الإيراد' : '📈 Total Income'}
                  </Text>
                  <Text style={[styles.insightStatValue, { color: colors.text }]}>
                    {formatCurrency(stats.grandTotal, language)} {currencySymbol}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Weekday headers */}
          <View style={styles.gridHeaderRow}>
            {dayHeaders.map((day, i) => (
              <View key={i} style={styles.cellHeader}>
                <Text style={styles.cellHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Heatmap Grid */}
          <View style={styles.gridContainer}>
            {/* Leading empty cells for month offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.cellEmpty} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayItem = dailyData[dayNum];
              const isToday = isCurrentMonth && dayNum === today.getDate();
              const isPassedDay = isCurrentMonth ? dayNum <= today.getDate() : true;
              const heatBg = getCellColor(dayItem.total, isPassedDay);
              const isZeroSpend = dayItem.total === 0 && isPassedDay && viewType === 'expense';

              return (
                <Pressable
                  key={dayNum}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedDayInfo({
                      dayNumber: dayNum,
                      dateStr: `${dayNum} ${formattedMonthName}`,
                      totalAmount: dayItem.total,
                      txList: dayItem.txs,
                    });
                  }}
                  style={[
                    styles.cell,
                    { backgroundColor: heatBg },
                    isToday && styles.todayCell,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumText,
                      dayItem.total > 0 && { color: '#FFF', fontFamily: 'Cairo_700Bold' },
                      isZeroSpend && { color: '#10B981' },
                    ]}
                  >
                    {dayNum}
                  </Text>
                  {isZeroSpend && (
                    <View style={styles.zeroDot} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            {viewType === 'expense' ? (
              <>
                <View style={styles.legendZeroGroup}>
                  <View style={[styles.legendBox, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981', borderWidth: 0.5 }]} />
                  <Text style={styles.legendLabel}>{isAr ? 'يوم توفير 🛡️' : 'Zero-Spend 🛡️'}</Text>
                </View>

                <View style={styles.legendScaleGroup}>
                  <Text style={styles.legendLabel}>{isAr ? 'أقل' : 'Low'}</Text>
                  <View style={[styles.legendBox, { backgroundColor: 'rgba(245, 158, 11, 0.25)' }]} />
                  <View style={[styles.legendBox, { backgroundColor: 'rgba(249, 115, 22, 0.50)' }]} />
                  <View style={[styles.legendBox, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendLabel}>{isAr ? 'ذروة' : 'High'}</Text>
                </View>
              </>
            ) : viewType === 'savings' ? (
              <>
                <View style={styles.legendZeroGroup}>
                  <View style={[styles.legendBox, { backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.05)' }]} />
                  <Text style={styles.legendLabel}>{isAr ? 'لا مدخرات' : 'No Savings'}</Text>
                </View>

                <View style={styles.legendScaleGroup}>
                  <Text style={styles.legendLabel}>{isAr ? 'أقل' : 'Low'}</Text>
                  <View style={[styles.legendBox, { backgroundColor: 'rgba(139, 92, 246, 0.25)' }]} />
                  <View style={[styles.legendBox, { backgroundColor: 'rgba(139, 92, 246, 0.50)' }]} />
                  <View style={[styles.legendBox, { backgroundColor: '#8B5CF6' }]} />
                  <Text style={styles.legendLabel}>{isAr ? 'قمة' : 'Peak'}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.legendZeroGroup}>
                  <View style={[styles.legendBox, { backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.05)' }]} />
                  <Text style={styles.legendLabel}>{isAr ? 'بدون دخل' : 'No Income'}</Text>
                </View>

                <View style={styles.legendScaleGroup}>
                  <Text style={styles.legendLabel}>{isAr ? 'أقل' : 'Low'}</Text>
                  <View style={[styles.legendBox, { backgroundColor: 'rgba(6, 182, 212, 0.25)' }]} />
                  <View style={[styles.legendBox, { backgroundColor: 'rgba(16, 185, 129, 0.50)' }]} />
                  <View style={[styles.legendBox, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendLabel}>{isAr ? 'ذروة' : 'High'}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Day Details Modal */}
      {selectedDayInfo && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setSelectedDayInfo(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalDateTitle}>{selectedDayInfo.dateStr}</Text>
                  <Text style={styles.modalExpenseTotal}>
                    {viewType === 'expense'
                      ? (isAr ? 'إجمالي الصرف:' : 'Total Spent:')
                      : viewType === 'savings'
                      ? (isAr ? 'إجمالي الادخار والسلف:' : 'Total Savings:')
                      : (isAr ? 'إجمالي الدخل:' : 'Total Income:')}{' '}
                    <Text style={{ color: viewThemeColor, fontFamily: 'Cairo_700Bold' }}>
                      {formatCurrency(selectedDayInfo.totalAmount, language)} {currencySymbol}
                    </Text>
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedDayInfo(null)}
                  hitSlop={10}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {selectedDayInfo.txList.length === 0 ? (
                  <View style={styles.noTxBox}>
                    <Ionicons
                      name={viewType === 'expense' ? 'shield-checkmark' : viewType === 'savings' ? 'wallet-outline' : 'cash-outline'}
                      size={36}
                      color={viewThemeColor}
                    />
                    <Text style={[styles.noTxTitle, { color: viewThemeColor }]}>
                      {viewType === 'expense'
                        ? (isAr ? 'يوم ادخار وبدون مصاريف! 🎉' : 'Zero-Spend Day! 🎉')
                        : viewType === 'savings'
                        ? (isAr ? 'لا توجد مدخرات مسجلة اليوم' : 'No Savings Recorded Today')
                        : (isAr ? 'لا توجد إيرادات مسجلة اليوم' : 'No Income Recorded Today')}
                    </Text>
                    <Text style={styles.noTxSub}>
                      {viewType === 'expense'
                        ? (isAr
                            ? 'لم تسجل أي مصاريف استهلاكية في هذا اليوم، ممتاز في تعزيز أهدافك المالية.'
                            : 'No consumption expenses recorded on this day. Great job!')
                        : viewType === 'savings'
                        ? (isAr
                            ? 'لم تقم بأي عمليات ادخار، أقساط جمعية أو إقراض في هذا اليوم.'
                            : 'No savings, ROSCA, or loans recorded on this day.')
                        : (isAr
                            ? 'لم تسجل أي تدفقات دخل في هذا اليوم.'
                            : 'No income flows recorded on this day.')}
                    </Text>
                  </View>
                ) : (
                  selectedDayInfo.txList.map(tx => {
                    const cat = getCategoryById(tx.category);
                    const isSavings = isSavingsTx(tx);
                    const itemColor = isSavings ? '#8B5CF6' : tx.type === 'expense' ? colors.expense : colors.income;
                    return (
                      <View key={tx.id} style={styles.txRow}>
                        <View style={[styles.txIcon, { backgroundColor: (cat?.color || viewThemeColor) + '20' }]}>
                          <MaterialIcons name={(cat?.icon || 'account-balance-wallet') as any} size={18} color={cat?.color || viewThemeColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.txCatName}>{getCategoryName(tx.category, language)}</Text>
                          {tx.description ? <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text> : null}
                        </View>
                        <Text
                          style={[
                            styles.txAmount,
                            { color: itemColor },
                          ]}
                        >
                          {isSavings ? '💎 ' : tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount, language)} {currencySymbol}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* Action Button: Add Transaction for this day */}
              <Pressable
                style={({ pressed }) => [
                  styles.addTxBtn,
                  { backgroundColor: viewThemeColor },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => {
                  const targetDay = selectedDayInfo.dayNumber;
                  setSelectedDayInfo(null);
                  const selectedDateObj = new Date(activeYear, activeMonth, targetDay, 12, 0, 0);
                  router.push({
                    pathname: '/add-transaction',
                    params: {
                      prefillDate: selectedDateObj.toISOString(),
                      prefillType: viewType === 'savings' ? 'expense' : viewType,
                    },
                  } as any);
                }}
              >
                <Ionicons name="add-circle" size={18} color="#FFF" />
                <Text style={styles.addTxBtnText}>
                  {isAr ? `إضافة عملية ليوم ${selectedDayInfo.dayNumber}` : `Add Transaction for Day ${selectedDayInfo.dayNumber}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const getStyles = (colors: any, isAr: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card || colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    headerPressable: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleRow: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    iconCircle: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
      textAlign: isAr ? 'right' : 'left',
    },
    collapsedSubtitle: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: isAr ? 'right' : 'left',
      marginTop: 1,
    },
    headerRight: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
    },
    collapseToggleBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    expandedContent: {
      gap: 12,
      paddingTop: 4,
    },
    controlsBar: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    typeSelector: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.04)',
      borderRadius: 10,
      padding: 3,
      gap: 2,
    },
    typeTabBtn: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    typeTabText: {
      fontSize: 11,
      fontFamily: 'Cairo_600SemiBold',
    },
    monthNav: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.04)',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    navArrowBtn: {
      padding: 4,
    },
    monthNavLabel: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
      color: colors.text,
      paddingHorizontal: 4,
    },
    insightsBar: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.03)',
      borderRadius: 12,
      padding: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    insightStatItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    insightDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.border,
    },
    insightStatLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    insightStatValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      textAlign: 'center',
    },
    gridHeaderRow: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
    },
    cellHeader: {
      width: CELL_SIZE,
      alignItems: 'center',
    },
    cellHeaderText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10,
      color: colors.textTertiary,
    },
    gridContainer: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    cellEmpty: {
      width: CELL_SIZE,
      height: CELL_SIZE,
    },
    cell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
      position: 'relative',
    },
    todayCell: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    dayNumText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    zeroDot: {
      position: 'absolute',
      bottom: 3,
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: '#10B981',
    },
    legendRow: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
      paddingHorizontal: 2,
    },
    legendZeroGroup: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendScaleGroup: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendLabel: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 10,
      color: colors.textTertiary,
    },
    legendBox: {
      width: 10,
      height: 10,
      borderRadius: 3,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContent: {
      width: '100%',
      backgroundColor: colors.surface || colors.card,
      borderRadius: 20,
      padding: 18,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    modalHeader: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    modalDateTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
      textAlign: isAr ? 'right' : 'left',
    },
    modalExpenseTotal: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      textAlign: isAr ? 'right' : 'left',
    },
    modalCloseBtn: {
      padding: 4,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.05)',
    },
    noTxBox: {
      alignItems: 'center',
      paddingVertical: 18,
      gap: 6,
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.03)',
      borderRadius: 14,
      paddingHorizontal: 12,
    },
    noTxTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: '#10B981',
      textAlign: 'center',
    },
    noTxSub: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
    txRow: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
      gap: 10,
    },
    txIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txCatName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
      textAlign: isAr ? 'right' : 'left',
    },
    txDesc: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: isAr ? 'right' : 'left',
    },
    txAmount: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
    },
    addTxBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 11,
      marginTop: 2,
    },
    addTxBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#FFF',
    },
  });
