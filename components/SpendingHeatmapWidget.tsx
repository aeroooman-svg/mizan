import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Transaction } from '@/lib/storage';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';

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

  const [selectedDayInfo, setSelectedDayInfo] = useState<{
    dayNumber: number;
    dateStr: string;
    totalExpense: number;
    txList: Transaction[];
  } | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  // Aggregate spending by day
  const dailyData = useMemo(() => {
    const map: Record<number, { total: number; txs: Transaction[] }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      map[d] = { total: 0, txs: [] };
    }

    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      const d = new Date(tx.date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        const dayNum = d.getDate();
        if (map[dayNum]) {
          map[dayNum].total += tx.amount;
          map[dayNum].txs.push(tx);
        }
      }
    });

    return map;
  }, [transactions, currentYear, currentMonth, daysInMonth]);

  // Determine max expense for heat intensity scaling
  const maxDayExpense = useMemo(() => {
    let max = 0;
    Object.values(dailyData).forEach(item => {
      if (item.total > max) max = item.total;
    });
    return max || 100;
  }, [dailyData]);

  const getHeatColor = (amount: number) => {
    if (amount === 0) return colors.surfaceAlt;
    const ratio = amount / maxDayExpense;
    if (ratio < 0.25) return 'rgba(239, 68, 68, 0.25)';
    if (ratio < 0.55) return 'rgba(239, 68, 68, 0.50)';
    if (ratio < 0.85) return 'rgba(239, 68, 68, 0.75)';
    return '#EF4444'; // Peak spending day
  };

  const dayHeadersAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const dayHeadersEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayHeaders = isAr ? dayHeadersAr : dayHeadersEn;

  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="flame" size={20} color="#EF4444" />
          <Text style={styles.title}>
            {isAr ? 'الخريطة الحرارية للإنفاق' : 'Spending Heatmap'}
          </Text>
        </View>
        <Text style={styles.monthBadge}>
          {now.toLocaleString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}
        </Text>
      </View>

      {/* Weekday headers */}
      <View style={styles.gridRow}>
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
          const isToday = dayNum === now.getDate();
          const heatBg = getHeatColor(dayItem.total);

          return (
            <Pressable
              key={dayNum}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedDayInfo({
                  dayNumber: dayNum,
                  dateStr: `${dayNum} / ${currentMonth + 1} / ${currentYear}`,
                  totalExpense: dayItem.total,
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
                ]}
              >
                {dayNum}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>{isAr ? 'أقل' : 'Low'}</Text>
        <View style={[styles.legendBox, { backgroundColor: colors.surfaceAlt }]} />
        <View style={[styles.legendBox, { backgroundColor: 'rgba(239, 68, 68, 0.25)' }]} />
        <View style={[styles.legendBox, { backgroundColor: 'rgba(239, 68, 68, 0.55)' }]} />
        <View style={[styles.legendBox, { backgroundColor: '#EF4444' }]} />
        <Text style={styles.legendLabel}>{isAr ? 'أعلى إنفاق' : 'High'}</Text>
      </View>

      {/* Day Details Modal */}
      {selectedDayInfo && (
        <Modal transparent visible animationType="slide" onRequestClose={() => setSelectedDayInfo(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalDateTitle}>{selectedDayInfo.dateStr}</Text>
                  <Text style={styles.modalExpenseTotal}>
                    {isAr ? 'إجمالي الصرف:' : 'Total Spent:'}{' '}
                    <Text style={{ color: colors.expense }}>
                      {formatCurrency(selectedDayInfo.totalExpense, language)} {currencySymbol}
                    </Text>
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedDayInfo(null)} hitSlop={10}>
                  <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                {selectedDayInfo.txList.length === 0 ? (
                  <View style={styles.noTxBox}>
                    <Ionicons name="checkmark-done-circle" size={32} color={colors.income} />
                    <Text style={styles.noTxText}>
                      {isAr ? 'يوم ادخار مثالي! لا توجد مصاريف مسجلة.' : 'Great savings day! No expenses recorded.'}
                    </Text>
                  </View>
                ) : (
                  selectedDayInfo.txList.map(tx => {
                    const cat = getCategoryById(tx.category);
                    return (
                      <View key={tx.id} style={styles.txRow}>
                        <View style={[styles.txIcon, { backgroundColor: (cat?.color || colors.primary) + '20' }]}>
                          <MaterialIcons name={cat?.icon as any} size={18} color={cat?.color || colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.txCatName}>{getCategoryName(tx.category, language)}</Text>
                          {tx.description ? <Text style={styles.txDesc}>{tx.description}</Text> : null}
                        </View>
                        <Text style={styles.txAmount}>
                          -{formatCurrency(tx.amount, language)} {currencySymbol}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card || colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    monthBadge: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    gridRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
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
      flexDirection: 'row',
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
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
      marginTop: 4,
    },
    legendLabel: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 10,
      color: colors.textTertiary,
    },
    legendBox: {
      width: 12,
      height: 12,
      borderRadius: 3,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 20,
      padding: 18,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    modalDateTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.text,
    },
    modalExpenseTotal: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    noTxBox: {
      alignItems: 'center',
      paddingVertical: 20,
      gap: 6,
    },
    noTxText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.income,
      textAlign: 'center',
    },
    txRow: {
      flexDirection: 'row',
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
    },
    txDesc: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    txAmount: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.expense,
    },
  });
