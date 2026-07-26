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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  { code: 'USD', symbol: '$', nameAr: 'دولار أمريكي', flag: '🇺🇸' },
  { code: 'EGP', symbol: 'ج.م', nameAr: 'جنيه مصري', flag: '🇪🇬' },
  { code: 'SAR', symbol: 'ر.س', nameAr: 'ريال سعودي', flag: '🇸🇦' },
  { code: 'KWD', symbol: 'د.ك', nameAr: 'دينار كويتي', flag: '🇰🇼' },
  { code: 'AED', symbol: 'د.إ', nameAr: 'درهم إماراتي', flag: '🇦🇪' },
  { code: 'EUR', symbol: '€', nameAr: 'يورو أوروبي', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', nameAr: 'جنيه إسترليني', flag: '🇬🇧' },
];

interface CurrencyConverterModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CurrencyConverterModal({ visible, onClose }: CurrencyConverterModalProps) {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const styles = useMemo(() => getStyles(colors, theme, isAr), [colors, theme, isAr]);

  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EGP');
  const [amount, setAmount] = useState('100');
  const [ratesData, setRatesData] = useState<RatesDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRates = async (force = false) => {
    setLoading(true);
    try {
      const details = await getExchangeRatesDetails(force);
      setRatesData(details);
      if (force) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        Alert.alert(
          isAr ? 'تم التحديث! 🔄' : 'Updated! 🔄',
          isAr ? 'تم تحديث أسعار الصرف الحية بنجاح من المورد العالمي.' : 'Live exchange rates refreshed successfully.',
        );
      }
    } catch (e) {
      console.warn('Error fetching currency rates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchRates(false);
    }
  }, [visible]);

  const convertedValue = useMemo(() => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return 0;
    const rates = ratesData?.rates || FALLBACK_RATES;
    return convertAmount(num, fromCurrency, toCurrency, rates);
  }, [amount, fromCurrency, toCurrency, ratesData]);

  const unitRate = useMemo(() => {
    const rates = ratesData?.rates || FALLBACK_RATES;
    return convertAmount(1, fromCurrency, toCurrency, rates);
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.iconCircle}>
                <Ionicons name="repeat" size={20} color="#10B981" />
              </View>
              <Text style={styles.title}>
                {isAr ? 'محول العملات الحي' : 'Live Currency Converter'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
            {/* Status & Refresh Bar */}
            <View style={styles.statusRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: ratesData?.isLive ? '#10B981' : '#F59E0B' },
                  ]}
                />
                <Text style={styles.statusText}>
                  {ratesData?.isLive
                    ? (isAr ? 'أسعار حية مباشرة' : 'Live Market Rates')
                    : (isAr ? 'أسعار أوفلاين محفوضة' : 'Offline Fallback Rates')}
                </Text>
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
                  {isAr ? 'تحديث الأسعار' : 'Refresh'}
                </Text>
              </Pressable>
            </View>

            {/* Input Amount */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{isAr ? 'المبلغ المراد تحويله' : 'Amount to Convert'}</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="100"
                placeholderTextColor={colors.textSecondary + '60'}
              />
            </View>

            {/* Currency Selector Grid (Clear & Fixed Direction) */}
            <View style={styles.selectorsRow}>
              {/* FROM Currency Column */}
              <View style={styles.selectorCol}>
                <View style={styles.colHeader}>
                  <Text style={styles.colLabel}>{isAr ? 'من (العملة الأصلية)' : 'From'}</Text>
                  <Text style={styles.activeFlag}>{fromCurrObj.flag}</Text>
                </View>
                <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
                  {CURRENCIES.map((c) => (
                    <Pressable
                      key={'from_' + c.code}
                      onPress={() => setFromCurrency(c.code)}
                      style={[
                        styles.currencyItem,
                        fromCurrency === c.code && styles.currencyItemSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyCode,
                          fromCurrency === c.code && styles.currencyTextSelected,
                        ]}
                      >
                        {c.flag} {c.code} ({c.symbol})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Swap Button */}
              <Pressable onPress={handleSwap} style={styles.swapBtn}>
                <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
              </Pressable>

              {/* TO Currency Column */}
              <View style={styles.selectorCol}>
                <View style={styles.colHeader}>
                  <Text style={styles.colLabel}>{isAr ? 'إلى (العملة المستهدفة)' : 'To'}</Text>
                  <Text style={styles.activeFlag}>{toCurrObj.flag}</Text>
                </View>
                <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
                  {CURRENCIES.map((c) => (
                    <Pressable
                      key={'to_' + c.code}
                      onPress={() => setToCurrency(c.code)}
                      style={[
                        styles.currencyItem,
                        toCurrency === c.code && styles.currencyItemSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyCode,
                          toCurrency === c.code && styles.currencyTextSelected,
                        ]}
                      >
                        {c.flag} {c.code} ({c.symbol})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Result Box */}
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>
                {isAr ? `النتيجة بحسب سعر الصرف الحالي` : 'Converted Result'}
              </Text>
              <Text style={styles.resultAmount}>
                {convertedValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <Text style={styles.resultCurrency}>{toCurrObj.symbol}</Text>
              </Text>

              <View style={styles.rateUnitRow}>
                <Text style={styles.rateUnitText}>
                  1 {fromCurrency} = {unitRate.toFixed(4)} {toCurrency}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, theme: string, isAr: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 20,
      maxHeight: '85%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#10B98118',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 18,
      fontFamily: 'Cairo_700Bold',
      color: colors.text,
    },
    closeBtn: {
      padding: 6,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 12,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#10B98115',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    refreshBtnText: {
      fontSize: 12,
      fontFamily: 'Cairo_700Bold',
      color: '#10B981',
    },
    inputGroup: {
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
      textAlign: 'left',
    },
    amountInput: {
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 24,
      fontFamily: 'Cairo_700Bold',
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      textAlign: 'center',
    },
    selectorsRow: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    selectorCol: {
      flex: 1,
      gap: 6,
    },
    colHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    colLabel: {
      fontSize: 12,
      fontFamily: 'Cairo_700Bold',
      color: colors.text,
    },
    activeFlag: {
      fontSize: 14,
    },
    currencyItem: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.background,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    currencyItemSelected: {
      backgroundColor: '#10B98118',
      borderColor: '#10B981',
    },
    currencyCode: {
      fontSize: 12,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.text,
      textAlign: 'center',
    },
    currencyTextSelected: {
      color: '#10B981',
      fontFamily: 'Cairo_700Bold',
    },
    swapBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#10B981',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
      elevation: 3,
    },
    resultCard: {
      backgroundColor: '#10B98110',
      borderRadius: 20,
      padding: 18,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#10B98130',
      marginTop: 8,
    },
    resultLabel: {
      fontSize: 12,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    resultAmount: {
      fontSize: 28,
      fontFamily: 'Cairo_700Bold',
      color: '#10B981',
    },
    resultCurrency: {
      fontSize: 16,
      fontFamily: 'Cairo_600SemiBold',
    },
    rateUnitRow: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#10B98120',
      width: '100%',
      alignItems: 'center',
    },
    rateUnitText: {
      fontSize: 12,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
    },
  });
