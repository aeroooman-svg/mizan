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
  { code: 'USD', symbol: '$', nameAr: 'دولار أمريكي', nameEn: 'US Dollar' },
  { code: 'EGP', symbol: 'ج.م', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound' },
  { code: 'KWD', symbol: 'د.ك', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar' },
  { code: 'SAR', symbol: 'ر.س', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham' },
  { code: 'EUR', symbol: '€', nameAr: 'يورو أوروبي', nameEn: 'Euro' },
  { code: 'GBP', symbol: '£', nameAr: 'جنيه إسترليني', nameEn: 'British Pound' },
];

interface CurrencyConverterModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CurrencyConverterModal({ visible, onClose }: CurrencyConverterModalProps) {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fetchRates(true);
  };

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
                {language === 'ar' ? 'محول العملات الحي' : 'Live Currency Converter'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
            {/* Rates Status Indicator */}
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
                    ? language === 'ar'
                      ? 'أسعار حية مباشرة'
                      : 'Live Market Rates'
                    : language === 'ar'
                    ? 'أسعار غير متصلة (أوفلاين)'
                    : 'Offline Fallback Rates'}
                </Text>
              </View>
              <Pressable onPress={handleRefresh} style={styles.refreshBtn} disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <Ionicons name="refresh-outline" size={16} color="#10B981" />
                )}
                <Text style={styles.refreshBtnText}>
                  {language === 'ar' ? 'تحديث' : 'Refresh'}
                </Text>
              </Pressable>
            </View>

            {/* Input Amount */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{language === 'ar' ? 'المبلغ المراد تحويله' : 'Amount'}</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="100"
                placeholderTextColor={colors.textSecondary + '60'}
              />
            </View>

            {/* Currency Selection Grid */}
            <View style={styles.converterBox}>
              {/* From Currency Selector */}
              <View style={styles.selectorCol}>
                <Text style={styles.label}>{language === 'ar' ? 'من' : 'From'}</Text>
                <ScrollView style={{ maxHeight: 120 }}>
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
                        {c.code} ({c.symbol})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Swap Button */}
              <Pressable onPress={handleSwap} style={styles.swapBtn}>
                <Ionicons name="swap-horizontal" size={22} color="#FFFFFF" />
              </Pressable>

              {/* To Currency Selector */}
              <View style={styles.selectorCol}>
                <Text style={styles.label}>{language === 'ar' ? 'إلى' : 'To'}</Text>
                <ScrollView style={{ maxHeight: 120 }}>
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
                        {c.code} ({c.symbol})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Result Box */}
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>
                {language === 'ar' ? 'النتيجة المحولة' : 'Converted Result'}
              </Text>
              <Text style={styles.resultAmount}>
                {convertedValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <Text style={styles.resultCurrency}>{toCurrency}</Text>
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

const getStyles = (colors: any, theme: string) =>
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
    },
    amountInput: {
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 20,
      fontFamily: 'Cairo_700Bold',
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      textAlign: 'center',
    },
    converterBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    selectorCol: {
      flex: 1,
      gap: 6,
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
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#10B981',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
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
