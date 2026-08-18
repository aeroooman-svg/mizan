import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { normalizeArabicNumbers } from '@/lib/arabicNumbers';

interface IOSWheelTimePickerProps {
  hour: number; // 1 - 12
  minute: number; // 0 - 59
  period: 'AM' | 'PM';
  onTimeChange: (hour: number, minute: number, period: 'AM' | 'PM') => void;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 132

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // [1, 2, ..., 12]
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // [0, 1, ..., 59]
const PERIODS: ('AM' | 'PM')[] = ['AM', 'PM'];

interface WheelColumnProps<T> {
  items: T[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  width?: number | string;
}

function WheelColumn<T>({
  items,
  selectedIndex,
  onSelect,
  renderItem,
  width = 64,
}: WheelColumnProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const lastIndex = useRef(selectedIndex);
  const isUserScrolling = useRef(false);

  // Sync scroll position when selectedIndex changes externally
  useEffect(() => {
    if (!isUserScrolling.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [selectedIndex]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    
    if (clampedIndex !== lastIndex.current) {
      lastIndex.current = clampedIndex;
      Haptics.selectionAsync();
      onSelect(clampedIndex);
    }
    isUserScrolling.current = false;
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isUserScrolling.current = true;
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    
    if (clampedIndex !== lastIndex.current) {
      lastIndex.current = clampedIndex;
      Haptics.selectionAsync();
      onSelect(clampedIndex);
    }
  };

  return (
    <View style={[styles.columnWrapper, { width: width as any }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={32}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT, // 1 item top, 1 item bottom for 3-item window
        }}
      >
        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Pressable
              key={i}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(i);
                scrollRef.current?.scrollTo({
                  y: i * ITEM_HEIGHT,
                  animated: true,
                });
              }}
              style={styles.itemWrapper}
            >
              {renderItem(item, isSelected)}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function IOSWheelTimePicker({
  hour,
  minute,
  period,
  onTimeChange,
}: IOSWheelTimePickerProps) {
  const { language } = useLanguage();
  const { colors } = useTheme();

  const [isManualMode, setIsManualMode] = useState(false);
  const [manualHour, setManualHour] = useState(hour.toString());
  const [manualMinute, setManualMinute] = useState(minute.toString().padStart(2, '0'));

  // Keep manual inputs synced if props change
  useEffect(() => {
    setManualHour(hour.toString());
    setManualMinute(minute.toString().padStart(2, '0'));
  }, [hour, minute]);

  const handleHourSelect = (index: number) => {
    const newHour = HOURS[index];
    onTimeChange(newHour, minute, period);
  };

  const handleMinuteSelect = (index: number) => {
    const newMinute = MINUTES[index];
    onTimeChange(hour, newMinute, period);
  };

  const handlePeriodSelect = (index: number) => {
    const newPeriod = PERIODS[index];
    onTimeChange(hour, minute, newPeriod);
  };

  const handleSetCurrentTime = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const p: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    onTimeChange(h, m, p);
  };

  const handleManualHourChange = (text: string) => {
    const clean = normalizeArabicNumbers(text).replace(/[^0-9]/g, '');
    setManualHour(clean);
    const val = parseInt(clean, 10);
    if (!isNaN(val) && val >= 1 && val <= 12) {
      onTimeChange(val, minute, period);
    }
  };

  const handleManualMinuteChange = (text: string) => {
    const clean = normalizeArabicNumbers(text).replace(/[^0-9]/g, '');
    setManualMinute(clean);
    const val = parseInt(clean, 10);
    if (!isNaN(val) && val >= 0 && val <= 59) {
      onTimeChange(hour, val, period);
    }
  };

  const hourIndex = Math.max(0, HOURS.indexOf(hour));
  const minuteIndex = Math.max(0, MINUTES.indexOf(minute));
  const periodIndex = Math.max(0, PERIODS.indexOf(period));

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      {/* Header with Title and Mode Toggle Buttons */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>
            {language === 'ar' ? 'الوقت' : 'Time'}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          {/* Quick "Now" Button */}
          <Pressable
            onPress={handleSetCurrentTime}
            style={({ pressed }) => [
              styles.quickBtn,
              { backgroundColor: colors.primary + '18' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="flash-outline" size={13} color={colors.primary} />
            <Text style={[styles.quickBtnText, { color: colors.primary }]}>
              {language === 'ar' ? 'الآن' : 'Now'}
            </Text>
          </Pressable>

          {/* Mode Switch (Wheel / Manual) */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setIsManualMode(!isManualMode);
            }}
            style={({ pressed }) => [
              styles.modeBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons
              name={isManualMode ? 'disc-outline' : 'keypad-outline'}
              size={14}
              color={colors.textSecondary}
            />
            <Text style={[styles.modeBtnText, { color: colors.textSecondary }]}>
              {isManualMode
                ? (language === 'ar' ? 'بكرة الوقت 🎡' : 'Wheel 🎡')
                : (language === 'ar' ? 'إدخال يدوي ⌨️' : 'Manual ⌨️')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Time Control Area */}
      {isManualMode ? (
        /* Manual Direct Number Keypad Inputs */
        <View style={styles.manualContainer}>
          <View style={styles.manualInputGroup}>
            <Text style={[styles.manualLabel, { color: colors.textTertiary }]}>
              {language === 'ar' ? 'الساعة' : 'Hour'}
            </Text>
            <TextInput
              style={[
                styles.manualInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={manualHour}
              onChangeText={handleManualHourChange}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="12"
              placeholderTextColor={colors.textTertiary}
              textAlign="center"
            />
          </View>

          <Text style={[styles.timeColon, { color: colors.textSecondary }]}>:</Text>

          <View style={styles.manualInputGroup}>
            <Text style={[styles.manualLabel, { color: colors.textTertiary }]}>
              {language === 'ar' ? 'الدقيقة' : 'Minute'}
            </Text>
            <TextInput
              style={[
                styles.manualInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={manualMinute}
              onChangeText={handleManualMinuteChange}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="00"
              placeholderTextColor={colors.textTertiary}
              textAlign="center"
            />
          </View>

          {/* AM / PM Toggle in Manual Mode */}
          <View style={styles.manualPeriodWrap}>
            <Text style={[styles.manualLabel, { color: colors.textTertiary }]}>
              {language === 'ar' ? 'الفترة' : 'Period'}
            </Text>
            <View style={styles.manualPeriodButtons}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  onTimeChange(hour, minute, 'AM');
                }}
                style={[
                  styles.manualPeriodBtn,
                  period === 'AM' && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.manualPeriodText,
                    period === 'AM' ? { color: '#fff' } : { color: colors.textSecondary },
                  ]}
                >
                  {language === 'ar' ? 'ص' : 'AM'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  onTimeChange(hour, minute, 'PM');
                }}
                style={[
                  styles.manualPeriodBtn,
                  period === 'PM' && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.manualPeriodText,
                    period === 'PM' ? { color: '#fff' } : { color: colors.textSecondary },
                  ]}
                >
                  {language === 'ar' ? 'م' : 'PM'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        /* iOS-Style Drum / Cylinder Wheel Roller */
        <View style={styles.wheelContainer}>
          {/* Glass / Highlight Lens Overlay in center */}
          <View
            pointerEvents="none"
            style={[
              styles.centerLens,
              {
                borderColor: colors.primary + '35',
                backgroundColor: colors.primary + '12',
              },
            ]}
          />

          {/* Columns */}
          <View style={styles.wheelColumnsRow}>
            {/* Hours Drum */}
            <WheelColumn
              items={HOURS}
              selectedIndex={hourIndex}
              onSelect={handleHourSelect}
              width={76}
              renderItem={(h, isSelected) => (
                <Text
                  style={[
                    styles.wheelItemText,
                    { color: isSelected ? colors.primary : colors.textTertiary },
                    isSelected && styles.wheelItemSelectedText,
                  ]}
                >
                  {h}
                </Text>
              )}
            />

            {/* Separator Colon */}
            <View style={styles.colonWrapper}>
              <Text style={[styles.wheelColonText, { color: colors.textSecondary }]}>:</Text>
            </View>

            {/* Minutes Drum */}
            <WheelColumn
              items={MINUTES}
              selectedIndex={minuteIndex}
              onSelect={handleMinuteSelect}
              width={76}
              renderItem={(m, isSelected) => (
                <Text
                  style={[
                    styles.wheelItemText,
                    { color: isSelected ? colors.primary : colors.textTertiary },
                    isSelected && styles.wheelItemSelectedText,
                  ]}
                >
                  {m.toString().padStart(2, '0')}
                </Text>
              )}
            />

            {/* AM / PM Drum */}
            <WheelColumn
              items={PERIODS}
              selectedIndex={periodIndex}
              onSelect={handlePeriodSelect}
              width={68}
              renderItem={(p, isSelected) => (
                <Text
                  style={[
                    styles.wheelItemText,
                    styles.periodItemText,
                    { color: isSelected ? colors.primary : colors.textTertiary },
                    isSelected && styles.wheelItemSelectedText,
                  ]}
                >
                  {language === 'ar' ? (p === 'AM' ? 'صباحاً' : 'مساءً') : p}
                </Text>
              )}
            />
          </View>
        </View>
      )}

      {/* Current Selection summary pill */}
      <View style={styles.summaryBar}>
        <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
          {language === 'ar' ? 'الوقت المحدد:' : 'Selected Time:'}{' '}
          <Text style={[styles.summaryTime, { color: colors.primary }]}>
            {hour}:{minute.toString().padStart(2, '0')}{' '}
            {language === 'ar' ? (period === 'AM' ? 'ص' : 'م') : period}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  quickBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  modeBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  // Wheel styles
  wheelContainer: {
    height: PICKER_HEIGHT,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLens: {
    position: 'absolute',
    height: ITEM_HEIGHT,
    left: 12,
    right: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    zIndex: 1,
  },
  wheelColumnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  columnWrapper: {
    height: PICKER_HEIGHT,
  },
  itemWrapper: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 22,
    textAlign: 'center',
  },
  periodItemText: {
    fontSize: 15,
  },
  wheelItemSelectedText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    transform: [{ scale: 1.05 }],
  },
  colonWrapper: {
    height: PICKER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  wheelColonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    marginTop: -4,
  },
  // Manual mode styles
  manualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  manualInputGroup: {
    alignItems: 'center',
    gap: 4,
  },
  manualLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  manualInput: {
    width: 64,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
  },
  timeColon: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    marginTop: 14,
  },
  manualPeriodWrap: {
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
  },
  manualPeriodButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 3,
    gap: 3,
    height: 52,
    alignItems: 'center',
  },
  manualPeriodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  manualPeriodText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  // Summary
  summaryBar: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
  },
  summaryTime: {
    fontFamily: 'Cairo_700Bold',
  },
});
