import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import {
  getExchangeRatesDetails,
  convertAmount,
  FALLBACK_RATES,
  RatesDetails,
} from '@/lib/currencyApi';

const CURRENCIES = [
  { code: 'USD', symbol: '$', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', flag: '🇺🇸' },
  { code: 'EGP', symbol: 'ج.م', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', flag: '🇪🇬' },
  { code: 'SAR', symbol: 'ر.س', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'AED', symbol: 'د.إ', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'KWD', symbol: 'د.ك', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar', flag: '🇰🇼' },
  { code: 'QAR', symbol: 'ر.ق', nameAr: 'ريال قطري', nameEn: 'Qatari Riyal', flag: '🇶🇦' },
  { code: 'BHD', symbol: 'د.ب', nameAr: 'دينار بحريني', nameEn: 'Bahraini Dinar', flag: '🇧🇭' },
  { code: 'OMR', symbol: 'ر.ع', nameAr: 'ريال عماني', nameEn: 'Omani Rial', flag: '🇴🇲' },
  { code: 'JOD', symbol: 'د.أ', nameAr: 'دينار أردني', nameEn: 'Jordanian Dinar', flag: '🇯🇴' },
  { code: 'EUR', symbol: '€', nameAr: 'يورو أوروبي', nameEn: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', nameAr: 'جنيه إسترليني', nameEn: 'British Pound', flag: '🇬🇧' },
  { code: 'TRY', symbol: '₺', nameAr: 'ليرة تركية', nameEn: 'Turkish Lira', flag: '🇹🇷' },
  { code: 'CAD', symbol: 'C$', nameAr: 'دولار كندي', nameEn: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'MAD', symbol: 'د.م.', nameAr: 'درهم مغربي', nameEn: 'Moroccan Dirham', flag: '🇲🇦' },
];

const PRESETS = [100, 500, 1000, 5000];

interface CurrencyConverterModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CurrencyConverterModal({ visible, onClose }: CurrencyConverterModalProps) {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);

  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EGP');
  const [amount, setAmount] = useState('100');
  const [ratesData, setRatesData] = useState<RatesDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetchedTime, setLastFetchedTime] = useState<string>('');

  const fetchRates = async (force = false) => {
    setLoading(true);
    try {
      const details = await getExchangeRatesDetails(force);
      setRatesData(details);
      setLastFetchedTime(new Date().toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (force) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }
    } catch (e) {
      console.warn('Error fetching currency rates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchRates(true);
    }
  }, [visible]);

  const parsedAmount = useMemo(() => {
    const num = parseFloat(amount.replace(/,/g, ''));
    return isNaN(num) || num < 0 ? 0 : num;
  }, [amount]);

  const convertedValue = useMemo(() => {
    if (parsedAmount <= 0) return 0;
    const rates = ratesData?.rates || FALLBACK_RATES;
    return convertAmount(parsedAmount, fromCurrency, toCurrency, rates);
  }, [parsedAmount, fromCurrency, toCurrency, ratesData]);

  const unitRateFromTo = useMemo(() => {
    const rates = ratesData?.rates || FALLBACK_RATES;
    return convertAmount(1, fromCurrency, toCurrency, rates);
  }, [fromCurrency, toCurrency, ratesData]);

  const unitRateToFrom = useMemo(() => {
    const rates = ratesData?.rates || FALLBACK_RATES;
    return convertAmount(1, toCurrency, fromCurrency, rates);
  }, [fromCurrency, toCurrency, ratesData]);

  const handleSwap = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const handleRefresh = () => {
    fetchRates(true);
  };

  const fromCurrObj = CURRENCIES.find(c => c.code === fromCurrency) || CURRENCIES[0];
  const toCurrObj = CURRENCIES.find(c => c.code === toCurrency) || CURRENCIES[1];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.iconCircle}>
                <Ionicons name="swap-horizontal" size={22} color="#10B981" />
              </View>
              <View>
                <Text style={styles.title}>
                  {isAr ? 'محول العملات المباشر' : 'Live Currency Converter'}
                </Text>
                <Text style={styles.subTitle}>
                  {isAr ? 'أسعار الصرف الحية اللحظية من السوق' : 'Real-time live market exchange rates'}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Live Status Bar */}
            <View style={styles.statusBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: ratesData?.isLive ? '#10B981' : '#F59E0B' },
                  ]}
                />
                <View>
                  <Text style={styles.statusTitle}>
                    {ratesData?.isLive
                      ? (isAr ? '🟢 متصل بالسوق اللحظي' : '🟢 Live Market Stream')
                      : (isAr ? '⚪ أسعار محفوظة' : '⚪ Cached Rates')}
                  </Text>
                  {lastFetchedTime ? (
                    <Text style={styles.statusSubtitle}>
                      {isAr ? `آخر فحص: ${lastFetchedTime}` : `Last checked: ${lastFetchedTime}`}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                onPress={handleRefresh}
                style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.8 }]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <Ionicons name="refresh-outline" size={16} color="#10B981" />
                )}
                <Text style={styles.refreshBtnText}>
                  {isAr ? 'تحديث الآن' : 'Refresh'}
                </Text>
              </Pressable>
            </View>

            {/* Input Amount Section */}
            <View style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <Text style={styles.inputLabel}>{isAr ? 'المبلغ المراد تحويله' : 'Amount to Convert'}</Text>
                <Text style={styles.inputCodeBadge}>{fromCurrency} ({fromCurrObj.symbol})</Text>
              </View>
              <View style={styles.amountInputRow}>
                <TextInput
                  style={[styles.amountInput, isAr ? { textAlign: 'right' } : { textAlign: 'left' }]}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  selectTextOnFocus
                />
              </View>

              {/* Quick Presets */}
              <View style={styles.presetsRow}>
                {PRESETS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => {
                      try { Haptics.selectionAsync(); } catch {}
                      setAmount(p.toString());
                    }}
                    style={[
                      styles.presetChip,
                      parsedAmount === p && styles.presetChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        parsedAmount === p && styles.presetChipTextActive,
                      ]}
                    >
                      {p.toLocaleString()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Currency Selectors with Swap */}
            <View style={styles.selectorsCard}>
              {/* FROM Selector */}
              <View style={styles.selectorCol}>
                <Text style={styles.colHeader}>{isAr ? 'من العملة' : 'From'}</Text>
                <ScrollView style={styles.currList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {CURRENCIES.map((c) => {
                    const isSelected = fromCurrency === c.code;
                    return (
                      <Pressable
                        key={'from_' + c.code}
                        onPress={() => {
                          try { Haptics.selectionAsync(); } catch {}
                          setFromCurrency(c.code);
                        }}
                        style={[styles.currencyItem, isSelected && styles.currencyItemSelected]}
                      >
                        <Text style={styles.currencyFlag}>{c.flag}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.currencyCode, isSelected && styles.currencyCodeSelected]}>
                            {c.code}
                          </Text>
                          <Text style={styles.currencyName} numberOfLines={1}>
                            {isAr ? c.nameAr : c.nameEn}
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={16} color="#10B981" />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Central Swap Button */}
              <Pressable
                onPress={handleSwap}
                style={({ pressed }) => [styles.swapButton, pressed && { transform: [{ scale: 0.92 }] }]}
              >
                <Ionicons name="swap-horizontal" size={22} color="#FFFFFF" />
              </Pressable>

              {/* TO Selector */}
              <View style={styles.selectorCol}>
                <Text style={styles.colHeader}>{isAr ? 'إلى العملة' : 'To'}</Text>
                <ScrollView style={styles.currList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {CURRENCIES.map((c) => {
                    const isSelected = toCurrency === c.code;
                    return (
                      <Pressable
                        key={'to_' + c.code}
                        onPress={() => {
                          try { Haptics.selectionAsync(); } catch {}
                          setToCurrency(c.code);
                        }}
                        style={[styles.currencyItem, isSelected && styles.currencyItemSelected]}
                      >
                        <Text style={styles.currencyFlag}>{c.flag}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.currencyCode, isSelected && styles.currencyCodeSelected]}>
                            {c.code}
                          </Text>
                          <Text style={styles.currencyName} numberOfLines={1}>
                            {isAr ? c.nameAr : c.nameEn}
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={16} color="#10B981" />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Premium Converted Result Card */}
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultLabel}>{isAr ? 'القيمة المحولة الصافية' : 'Converted Value'}</Text>
                <View style={styles.toFlagBadge}>
                  <Text style={{ fontSize: 16 }}>{toCurrObj.flag}</Text>
                  <Text style={styles.toFlagCode}>{toCurrObj.code}</Text>
                </View>
              </View>

              <View style={styles.resultValueContainer}>
                <Text style={styles.resultSymbol}>{toCurrObj.symbol}</Text>
                <Text style={styles.resultAmount} numberOfLines={1} adjustsFontSizeToFit>
                  {convertedValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>

              {/* Rate Details Matrix */}
              <View style={styles.rateMatrix}>
                <View style={styles.ratePill}>
                  <Text style={styles.ratePillText}>
                    1 {fromCurrency} = {unitRateFromTo.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {toCurrency}
                  </Text>
                </View>
                <View style={styles.ratePill}>
                  <Text style={styles.ratePillText}>
                    1 {toCurrency} = {unitRateToFrom.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {fromCurrency}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, theme: string) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '90%',
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      borderTopWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.text,
    },
    subTitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      padding: 16,
      gap: 14,
    },
    statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.text,
    },
    statusSubtitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 10,
      color: colors.textTertiary,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    refreshBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
      color: '#10B981',
    },
    inputCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    inputLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
    },
    inputCodeBadge: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    amountInputRow: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    amountInput: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 26,
      color: colors.text,
      padding: 0,
    },
    presetsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    presetChip: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    presetChipActive: {
      backgroundColor: 'rgba(16, 185, 129, 0.18)',
      borderColor: '#10B981',
    },
    presetChipText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    presetChipTextActive: {
      color: '#10B981',
      fontFamily: 'Cairo_700Bold',
    },
    selectorsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    selectorCol: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 18,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colHeader: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    currList: {
      maxHeight: 160,
    },
    currencyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 10,
      marginBottom: 4,
    },
    currencyItemSelected: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    currencyFlag: {
      fontSize: 18,
    },
    currencyCode: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.text,
    },
    currencyCodeSelected: {
      color: '#10B981',
    },
    currencyName: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 10,
      color: colors.textTertiary,
    },
    swapButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: '#10B981',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    resultCard: {
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      borderRadius: 20,
      padding: 18,
      borderWidth: 1.5,
      borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    resultLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
    },
    toFlagBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    toFlagCode: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
      color: colors.text,
    },
    resultValueContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginVertical: 4,
    },
    resultSymbol: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 20,
      color: '#10B981',
    },
    resultAmount: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 32,
      color: '#10B981',
      flex: 1,
    },
    rateMatrix: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    ratePill: {
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ratePillText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
  });
