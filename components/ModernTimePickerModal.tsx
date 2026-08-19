import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
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

interface ModernTimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  hour: number; // 1 - 12
  minute: number; // 0 - 59
  period: 'AM' | 'PM';
  onConfirm: (hour: number, minute: number, period: 'AM' | 'PM') => void;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 220

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
  width = 80,
}: WheelColumnProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const lastIndex = useRef(selectedIndex);
  const isUserScrolling = useRef(false);

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
          paddingVertical: ITEM_HEIGHT * 2, // 2 items top, 2 items bottom for 5-item window
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

export default function ModernTimePickerModal({
  visible,
  onClose,
  hour,
  minute,
  period,
  onConfirm,
}: ModernTimePickerModalProps) {
  const { language } = useLanguage();
  const { colors } = useTheme();

  // Internal state while modal is open
  const [tempHour, setTempHour] = useState(hour);
  const [tempMinute, setTempMinute] = useState(minute);
  const [tempPeriod, setTempPeriod] = useState(period);

  const [activeTab, setActiveTab] = useState<'wheel' | 'manual'>('wheel');
  const [manualHour, setManualHour] = useState(hour.toString());
  const [manualMinute, setManualMinute] = useState(minute.toString().padStart(2, '0'));

  useEffect(() => {
    if (visible) {
      setTempHour(hour);
      setTempMinute(minute);
      setTempPeriod(period);
      setManualHour(hour.toString());
      setManualMinute(minute.toString().padStart(2, '0'));
    }
  }, [visible, hour, minute, period]);

  const handleSetCurrentTime = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const p: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    setTempHour(h);
    setTempMinute(m);
    setTempPeriod(p);
    setManualHour(h.toString());
    setManualMinute(m.toString().padStart(2, '0'));
  };

  const handleManualHourChange = (text: string) => {
    const clean = normalizeArabicNumbers(text).replace(/[^0-9]/g, '');
    setManualHour(clean);
    const val = parseInt(clean, 10);
    if (!isNaN(val) && val >= 1 && val <= 12) {
      setTempHour(val);
    }
  };

  const handleManualMinuteChange = (text: string) => {
    const clean = normalizeArabicNumbers(text).replace(/[^0-9]/g, '');
    setManualMinute(clean);
    const val = parseInt(clean, 10);
    if (!isNaN(val) && val >= 0 && val <= 59) {
      setTempMinute(val);
    }
  };

  const handleSaveAndConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(tempHour, tempMinute, tempPeriod);
    onClose();
  };

  const hourIndex = Math.max(0, HOURS.indexOf(tempHour));
  const minuteIndex = Math.max(0, MINUTES.indexOf(tempMinute));
  const periodIndex = Math.max(0, PERIODS.indexOf(tempPeriod));

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
              <Ionicons name="time" size={22} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {language === 'ar' ? 'تحديد الوقت' : 'Select Time'}
              </Text>
            </View>

            <View style={styles.headerRightActions}>
              <Pressable
                onPress={handleSetCurrentTime}
                style={[styles.quickNowBtn, { backgroundColor: colors.primary + '18' }]}
              >
                <Ionicons name="flash" size={14} color={colors.primary} />
                <Text style={[styles.quickNowText, { color: colors.primary }]}>
                  {language === 'ar' ? 'الآن' : 'Now'}
                </Text>
              </Pressable>

              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Mode Switcher Tab (Wheel vs Manual) */}
          <View style={styles.tabContainer}>
            <View style={[styles.tabWrap, { backgroundColor: colors.surfaceAlt }]}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab('wheel');
                }}
                style={[
                  styles.tabBtn,
                  activeTab === 'wheel' && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Ionicons
                  name="disc-outline"
                  size={16}
                  color={activeTab === 'wheel' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'wheel' ? colors.primary : colors.textSecondary },
                    activeTab === 'wheel' && { fontFamily: 'Cairo_700Bold' },
                  ]}
                >
                  {language === 'ar' ? 'بكرة الوقت 🎡' : 'Wheel Drum 🎡'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab('manual');
                }}
                style={[
                  styles.tabBtn,
                  activeTab === 'manual' && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Ionicons
                  name="keypad-outline"
                  size={16}
                  color={activeTab === 'manual' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'manual' ? colors.primary : colors.textSecondary },
                    activeTab === 'manual' && { fontFamily: 'Cairo_700Bold' },
                  ]}
                >
                  {language === 'ar' ? 'إدخال يدوي ⌨️' : 'Manual ⌨️'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Active Mode Body */}
          {activeTab === 'wheel' ? (
            /* iOS Wheel Drum View */
            <View style={styles.wheelCard}>
              {/* Glass Lens Overlay */}
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

              <View style={styles.wheelColumnsRow}>
                {/* Hours Drum */}
                <WheelColumn
                  items={HOURS}
                  selectedIndex={hourIndex}
                  onSelect={(idx) => setTempHour(HOURS[idx])}
                  width={84}
                  renderItem={(h, isSelected) => (
                    <Text
                      style={[
                        styles.wheelText,
                        { color: isSelected ? colors.primary : colors.textTertiary },
                        isSelected && styles.selectedWheelText,
                      ]}
                    >
                      {h}
                    </Text>
                  )}
                />

                <View style={styles.colonWrapper}>
                  <Text style={[styles.colonText, { color: colors.textSecondary }]}>:</Text>
                </View>

                {/* Minutes Drum */}
                <WheelColumn
                  items={MINUTES}
                  selectedIndex={minuteIndex}
                  onSelect={(idx) => setTempMinute(MINUTES[idx])}
                  width={84}
                  renderItem={(m, isSelected) => (
                    <Text
                      style={[
                        styles.wheelText,
                        { color: isSelected ? colors.primary : colors.textTertiary },
                        isSelected && styles.selectedWheelText,
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
                  onSelect={(idx) => setTempPeriod(PERIODS[idx])}
                  width={84}
                  renderItem={(p, isSelected) => (
                    <Text
                      style={[
                        styles.wheelText,
                        styles.periodWheelText,
                        { color: isSelected ? colors.primary : colors.textTertiary },
                        isSelected && styles.selectedWheelText,
                      ]}
                    >
                      {language === 'ar' ? (p === 'AM' ? 'صباحاً' : 'مساءً') : p}
                    </Text>
                  )}
                />
              </View>
            </View>
          ) : (
            /* Spacious & Clean Manual Keypad View */
            <View style={styles.manualCard}>
              <View style={styles.manualInputsRow}>
                {/* Hour */}
                <View style={styles.manualCol}>
                  <Text style={[styles.manualColLabel, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'الساعة' : 'Hour'}
                  </Text>
                  <TextInput
                    style={[
                      styles.manualTextInput,
                      {
                        backgroundColor: colors.surfaceAlt,
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
                    textAlignVertical="center"
                    selectTextOnFocus
                  />
                </View>

                {/* Colon */}
                <View style={styles.manualColonCol}>
                  <Text style={[styles.manualColon, { color: colors.textSecondary }]}>:</Text>
                </View>

                {/* Minute */}
                <View style={styles.manualCol}>
                  <Text style={[styles.manualColLabel, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'الدقيقة' : 'Minute'}
                  </Text>
                  <TextInput
                    style={[
                      styles.manualTextInput,
                      {
                        backgroundColor: colors.surfaceAlt,
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
                    textAlignVertical="center"
                    selectTextOnFocus
                  />
                </View>

                {/* Period Selector */}
                <View style={[styles.manualCol, styles.manualPeriodCol]}>
                  <Text style={[styles.manualColLabel, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'الفترة' : 'Period'}
                  </Text>
                  <View style={[styles.periodSwitchWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTempPeriod('AM');
                      }}
                      style={[
                        styles.periodOptionBtn,
                        tempPeriod === 'AM' && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.periodOptionText,
                          tempPeriod === 'AM' ? { color: '#FFFFFF' } : { color: colors.textSecondary },
                        ]}
                      >
                        {language === 'ar' ? 'ص' : 'AM'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTempPeriod('PM');
                      }}
                      style={[
                        styles.periodOptionBtn,
                        tempPeriod === 'PM' && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.periodOptionText,
                          tempPeriod === 'PM' ? { color: '#FFFFFF' } : { color: colors.textSecondary },
                        ]}
                      >
                        {language === 'ar' ? 'م' : 'PM'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Time Preview Pill */}
          <View style={styles.previewContainer}>
            <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'الوقت المحدد:' : 'Selected Time:'}{' '}
              <Text style={[styles.previewValue, { color: colors.primary }]}>
                {tempHour}:{tempMinute.toString().padStart(2, '0')}{' '}
                {language === 'ar' ? (tempPeriod === 'AM' ? 'صباحاً' : 'مساءً') : tempPeriod}
              </Text>
            </Text>
          </View>

          {/* Confirm Button */}
          <View style={styles.footerContainer}>
            <Pressable
              onPress={handleSaveAndConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.confirmBtnText}>
                {language === 'ar' ? 'تأكيد وحفظ الوقت' : 'Confirm Time'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 28,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  quickNowText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  closeBtn: {
    padding: 4,
  },
  // Tabs
  tabContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tabWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 11,
    gap: 6,
  },
  tabBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  // Wheel card
  wheelCard: {
    height: PICKER_HEIGHT,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  centerLens: {
    position: 'absolute',
    height: ITEM_HEIGHT,
    left: 20,
    right: 20,
    borderRadius: 14,
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
  wheelText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 22,
    textAlign: 'center',
  },
  periodWheelText: {
    fontSize: 16,
  },
  selectedWheelText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 26,
    transform: [{ scale: 1.08 }],
  },
  colonWrapper: {
    height: PICKER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  colonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 26,
    marginTop: -4,
  },
  // Manual mode
  manualCard: {
    paddingHorizontal: 16,
    paddingVertical: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualInputsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
  },
  manualCol: {
    alignItems: 'center',
    gap: 8,
    width: 78,
  },
  manualPeriodCol: {
    width: 92,
  },
  manualColonCol: {
    height: 58,
    marginTop: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualColLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    textAlign: 'center',
  },
  manualTextInput: {
    width: 78,
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    fontFamily: 'Cairo_700Bold',
    fontSize: 26,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  manualColon: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 26,
    textAlign: 'center',
    lineHeight: 28,
  },
  periodSwitchWrap: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 3,
    height: 58,
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  periodOptionBtn: {
    flex: 1,
    height: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodOptionText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    textAlign: 'center',
  },
  // Preview
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  previewLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
  },
  previewValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  // Footer
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  confirmBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
