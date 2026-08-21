import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';

interface ModernDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDay: number;
  selectedMonth: number; // 0-11
  selectedYear: number;
  onSelectDate: (day: number, month: number, year: number) => void;
}

export default function ModernDatePickerModal({
  visible,
  onClose,
  selectedDay,
  selectedMonth,
  selectedYear,
  onSelectDate,
}: ModernDatePickerModalProps) {
  const { language, t } = useLanguage();
  const { colors } = useTheme();

  // Browsing month & year inside the calendar
  const [viewMonth, setViewMonth] = useState(selectedMonth);
  const [viewYear, setViewYear] = useState(selectedYear);

  // Synchronize view with selected date whenever opened
  React.useEffect(() => {
    if (visible) {
      setViewMonth(selectedMonth);
      setViewYear(selectedYear);
    }
  }, [visible, selectedMonth, selectedYear]);

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  // Weekdays (Saturday to Friday for Arabic RTL feel)
  const arabicWeekdays = ['سبت', 'أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع'];
  const englishWeekdays = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const weekdays = language === 'ar' ? arabicWeekdays : englishWeekdays;

  const handlePrevMonth = () => {
    Haptics.selectionAsync();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    Haptics.selectionAsync();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    Haptics.selectionAsync();
    onSelectDate(day, viewMonth, viewYear);
    onClose();
  };

  // Quick Preset Handlers
  const handleQuickPreset = (type: 'today' | 'yesterday' | 'day_before' | 'month_start') => {
    Haptics.selectionAsync();
    const d = new Date();
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    } else if (type === 'day_before') {
      d.setDate(d.getDate() - 2);
    } else if (type === 'month_start') {
      d.setDate(1);
    }
    onSelectDate(d.getDate(), d.getMonth(), d.getFullYear());
    onClose();
  };

  // Generate calendar days for viewMonth & viewYear
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    // We want week to start on Saturday (index 6 in JS getDay)
    // JS getDay(): Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    // If starting on Sat: Sat->0, Sun->1, Mon->2, Tue->3, Wed->4, Thu->5, Fri->6
    const offset = (firstDayIndex + 1) % 7;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; isCurrentMonth: boolean; isPrev?: boolean; isNext?: boolean }[] = [];

    // Preceding days from prev month
    for (let i = offset - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        isPrev: true,
      });
    }

    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        day: i,
        isCurrentMonth: true,
      });
    }

    // Trailing days to fill 5 or 6 weeks (multiples of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        isCurrentMonth: false,
        isNext: true,
      });
    }

    return cells;
  }, [viewMonth, viewYear]);

  const monthName = t.months[viewMonth] || '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={e => e.stopPropagation()}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {language === 'ar' ? 'اختيار التاريخ' : 'Select Date'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Quick Action Chips */}
            <View style={styles.quickChipsSection}>
              <Text style={[styles.quickChipsLabel, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'اختيارات سريعة:' : 'Quick Shortcuts:'}
              </Text>
              <View style={styles.chipsRow}>
                <Pressable
                  onPress={() => handleQuickPreset('today')}
                  style={[
                    styles.chipBtn,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    selectedDay === todayDay && selectedMonth === todayMonth && selectedYear === todayYear && {
                      backgroundColor: colors.primary + '20',
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Ionicons name="today-outline" size={14} color={colors.primary} />
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.text },
                      selectedDay === todayDay && selectedMonth === todayMonth && selectedYear === todayYear && {
                        color: colors.primary,
                        fontFamily: 'Cairo_700Bold',
                      },
                    ]}
                  >
                    {t.today}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleQuickPreset('yesterday')}
                  style={[styles.chipBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                    {t.yesterday}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleQuickPreset('day_before')}
                  style={[styles.chipBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Ionicons name="play-back-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'أول أمس' : '2 Days Ago'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleQuickPreset('month_start')}
                  style={[styles.chipBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'أول الشهر' : '1st of Month'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Month & Year Navigation Bar */}
            <View style={[styles.calendarCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={styles.monthNavRow}>
                <Pressable
                  onPress={handlePrevMonth}
                  style={({ pressed }) => [
                    styles.navBtn,
                    { backgroundColor: colors.surface },
                    pressed && { opacity: 0.7 },
                  ]}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>

                <View style={styles.monthTitleWrap}>
                  <Text style={[styles.monthText, { color: colors.text }]}>
                    {monthName} {viewYear}
                  </Text>
                </View>

                <Pressable
                  onPress={handleNextMonth}
                  style={({ pressed }) => [
                    styles.navBtn,
                    { backgroundColor: colors.surface },
                    pressed && { opacity: 0.7 },
                  ]}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </Pressable>
              </View>

              {/* Weekdays Row */}
              <View style={styles.weekdaysRow}>
                {weekdays.map((wd, i) => (
                  <View key={i} style={styles.weekdayCell}>
                    <Text style={[styles.weekdayText, { color: colors.textTertiary }]}>{wd}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar Days Grid */}
              <View style={styles.daysGrid}>
                {calendarGrid.map((cell, idx) => {
                  const isSelected =
                    cell.isCurrentMonth &&
                    cell.day === selectedDay &&
                    viewMonth === selectedMonth &&
                    viewYear === selectedYear;

                  const isToday =
                    cell.isCurrentMonth &&
                    cell.day === todayDay &&
                    viewMonth === todayMonth &&
                    viewYear === todayYear;

                  return (
                    <Pressable
                      key={idx}
                      onPress={() => {
                        if (cell.isCurrentMonth) {
                          handleSelectDay(cell.day);
                        } else if (cell.isPrev) {
                          handlePrevMonth();
                        } else if (cell.isNext) {
                          handleNextMonth();
                        }
                      }}
                      style={[
                        styles.dayCell,
                        isSelected && [styles.selectedDayCell, { backgroundColor: colors.primary }],
                        isToday && !isSelected && [styles.todayCell, { borderColor: colors.primary }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: cell.isCurrentMonth ? colors.text : colors.textTertiary + '55' },
                          isSelected && styles.selectedDayText,
                          isToday && !isSelected && { color: colors.primary, fontFamily: 'Cairo_700Bold' },
                        ]}
                      >
                        {cell.day}
                      </Text>
                      {isToday && !isSelected && (
                        <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  // Quick Chips
  quickChipsSection: {
    marginBottom: 16,
  },
  quickChipsLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  // Calendar Card
  calendarCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleWrap: {
    alignItems: 'center',
  },
  monthText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginVertical: 2,
    position: 'relative',
  },
  selectedDayCell: {
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  todayCell: {
    borderWidth: 1.5,
  },
  dayText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  todayDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
