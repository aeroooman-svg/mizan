import React, { useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
import { getExchangeRates, convertAmount } from '@/lib/currencyApi';
import { getLocalMetalPrices } from '@/lib/goldPriceApi';

export default function ZakatCalculatorScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const { selectedWallet, wallets } = useTransactions();
  
  // Base currency info
  const currency = selectedWallet?.currency || 'EGP';
  
  // Inputs
  const [cash, setCash] = useState('');
  const [goldGrams, setGoldGrams] = useState('');
  const [silverGrams, setSilverGrams] = useState('');
  const [investments, setInvestments] = useState('');
  const [liabilities, setLiabilities] = useState('');
  
  // Live Price State
  const [livePrices, setLivePrices] = useState<{ gold24kLocal: number; silverLocal: number; isLive: boolean } | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(true);

  // Output states
  const [calculated, setCalculated] = useState(false);
  const [totalAssets, setTotalAssets] = useState(0);
  const [netAssets, setNetAssets] = useState(0);
  const [nisabVal, setNisabVal] = useState(0);
  const [zakatDue, setZakatDue] = useState(0);
  const [meetsNisab, setMeetsNisab] = useState(false);

  const NISAB_GOLD_GRAMS = 85.0;

  const refreshPrices = async (force = false) => {
    setLoadingPrices(true);
    try {
      const data = await getLocalMetalPrices(currency, force);
      setLivePrices(data);
      if (force) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.warn('Error refreshing metal prices:', e);
    } finally {
      setLoadingPrices(false);
    }
  };

  useEffect(() => {
    refreshPrices(false);
  }, [currency]);

  const handleCalculate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const valCash = parseFloat(cash) || 0;
    const valGoldGrams = parseFloat(goldGrams) || 0;
    const valSilverGrams = parseFloat(silverGrams) || 0;
    const valInvestments = parseFloat(investments) || 0;
    const valLiabilities = parseFloat(liabilities) || 0;

    let goldPriceLocal = livePrices?.gold24kLocal || 3800; // default local estimate
    let silverPriceLocal = livePrices?.silverLocal || 45;

    if (!livePrices) {
      try {
        const fetched = await getLocalMetalPrices(currency);
        goldPriceLocal = fetched.gold24kLocal;
        silverPriceLocal = fetched.silverLocal;
      } catch (e) {}
    }

    const goldValueLocal = valGoldGrams * goldPriceLocal;
    const silverValueLocal = valSilverGrams * silverPriceLocal;

    const calculatedTotalAssets = valCash + goldValueLocal + silverValueLocal + valInvestments;
    const calculatedNetAssets = Math.max(0, calculatedTotalAssets - valLiabilities);
    
    const localNisab = NISAB_GOLD_GRAMS * goldPriceLocal;
    
    setTotalAssets(calculatedTotalAssets);
    setNetAssets(calculatedNetAssets);
    setNisabVal(localNisab);

    if (calculatedNetAssets >= localNisab) {
      setZakatDue(calculatedNetAssets * 0.025); // 2.5% Zakat
      setMeetsNisab(true);
    } else {
      setZakatDue(0);
      setMeetsNisab(false);
    }

    setCalculated(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCash('');
    setGoldGrams('');
    setSilverGrams('');
    setInvestments('');
    setLiabilities('');
    setCalculated(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Top Header */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backBtn}
        >
          <Ionicons name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {language === 'ar' ? '🕌 حاسبة الزكاة الشرعية' : '🕌 Zakat Calculator'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Intro Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerTitle}>
            {language === 'ar' ? 'ما هي زكاة المال؟' : 'What is Zakat?'}
          </Text>
          <Text style={styles.infoBannerText}>
            {language === 'ar'
              ? 'الزكاة ركن أساسي من أركان الإسلام، وتُفرَض بنسبة 2.5% سنوياً على الأموال والمدخرات التي بلغت النصاب وحال عليها الحول (عام كامل).'
              : 'Zakat is an obligatory charity in Islam. It is calculated at 2.5% of your net accumulated wealth that exceeds the Nisab (equivalent to 85g of gold) held for a full lunar year.'}
          </Text>
        </View>

        {/* Live Gold Rate Badge */}
        {livePrices && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFD70015',
            borderColor: '#FFD70050',
            borderWidth: 1,
            borderRadius: 14,
            padding: 12,
            gap: 10,
            marginBottom: 16,
          }}>
            <Ionicons name="sparkles" size={20} color="#FFD700" />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#FFD700' }}>
                  {language === 'ar' ? 'سعر الذهب المباشر:' : 'Live Gold Rate:'}
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: livePrices.isLive ? '#22c55e' : colors.textTertiary }}>
                  {livePrices.isLive ? (language === 'ar' ? '🟢 متزامن حي' : '🟢 Live Synced') : (language === 'ar' ? '⚪ مخزن' : '⚪ Cached')}
                </Text>
              </View>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                {language === 'ar' ? `عيار 24: ${formatCurrency(livePrices.gold24kLocal)} ${currency} / جرام` : `24K: ${formatCurrency(livePrices.gold24kLocal)} ${currency}/g`}
              </Text>
            </View>
            <Pressable
              onPress={() => refreshPrices(true)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.7 }
              ]}
            >
              <Ionicons name="refresh-outline" size={14} color={colors.primary} />
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.primary }}>
                {language === 'ar' ? 'تحديث' : 'Refresh'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Zakat Inputs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {language === 'ar' ? 'أدخل أصولك المالية' : 'Enter Your Assets'}
          </Text>

          {/* Cash input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {language === 'ar' ? 'السيولة النقدية والمدخرات' : 'Cash & Savings'}
            </Text>
            <View style={styles.inputFieldWrapper}>
              <TextInput
                style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={cash}
                onChangeText={setCash}
              />
              <Text style={styles.currencyTag}>{currency}</Text>
            </View>
          </View>

          {/* Gold input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {language === 'ar' ? 'الذهب المملوك (بالجرام - عيار 24)' : 'Gold Owned (Grams - 24K)'}
            </Text>
            <View style={styles.inputFieldWrapper}>
              <TextInput
                style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={goldGrams}
                onChangeText={setGoldGrams}
              />
              <Text style={styles.currencyTag}>{language === 'ar' ? 'جرام' : 'g'}</Text>
            </View>
          </View>

          {/* Silver input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {language === 'ar' ? 'الفضة المملوكة (بالجرام)' : 'Silver Owned (Grams)'}
            </Text>
            <View style={styles.inputFieldWrapper}>
              <TextInput
                style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={silverGrams}
                onChangeText={setSilverGrams}
              />
              <Text style={styles.currencyTag}>{language === 'ar' ? 'جرام' : 'g'}</Text>
            </View>
          </View>

          {/* Investments input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {language === 'ar' ? 'الأسهم والصناديق الاستثمارية' : 'Stocks & Mutual Funds'}
            </Text>
            <View style={styles.inputFieldWrapper}>
              <TextInput
                style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={investments}
                onChangeText={setInvestments}
              />
              <Text style={styles.currencyTag}>{currency}</Text>
            </View>
          </View>

          {/* Liabilities input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {language === 'ar' ? 'الديون والالتزامات المستحقة حالاً (تُخصم)' : 'Immediate Liabilities/Debts (Deducted)'}
            </Text>
            <View style={styles.inputFieldWrapper}>
              <TextInput
                style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={liabilities}
                onChangeText={setLiabilities}
              />
              <Text style={styles.currencyTag}>{currency}</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.actionButtons}>
            <Pressable
              onPress={handleCalculate}
              style={[styles.btn, styles.btnPrimary]}
            >
              <Text style={styles.btnTextPrimary}>
                {language === 'ar' ? 'احسب الزكاة' : 'Calculate'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleReset}
              style={[styles.btn, styles.btnSecondary]}
            >
              <Text style={styles.btnTextSecondary}>
                {language === 'ar' ? 'إعادة ضبط' : 'Reset'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Results view */}
        {calculated && (
          <View style={[styles.card, styles.resultCard]}>
            <Text style={styles.resultTitle}>
              {language === 'ar' ? 'تقرير حساب الزكاة' : 'Zakat Report'}
            </Text>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>
                {language === 'ar' ? 'إجمالي الأصول المقومة:' : 'Total Assets Value:'}
              </Text>
              <Text style={styles.resultValue}>{formatCurrency(totalAssets)} {currency}</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>
                {language === 'ar' ? 'نصاب الزكاة الحالي (٨٥ جرام ذهب):' : 'Nisab Threshold (85g Gold):'}
              </Text>
              <Text style={[styles.resultValue, { color: colors.accent }]}>
                {formatCurrency(nisabVal)} {currency}
              </Text>
            </View>

            <View style={styles.divider} />

            {meetsNisab ? (
              <View style={styles.dueContainer}>
                <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
                <Text style={styles.dueTitle}>
                  {language === 'ar' ? 'أموالك بلغت النصاب الشرعي' : 'Assets exceed Nisab limit'}
                </Text>
                <Text style={styles.dueSub}>
                  {language === 'ar'
                    ? 'قيمة الزكاة المستحقة (٢.٥٪) لتطهير مالك هي:'
                    : 'The total Zakat due (2.5%) for your wealth is:'}
                </Text>
                <Text style={styles.dueValue}>
                  {formatCurrency(zakatDue)} {currency}
                </Text>
              </View>
            ) : (
              <View style={styles.dueContainer}>
                <Ionicons name="information-circle" size={32} color={colors.textSecondary} />
                <Text style={[styles.dueTitle, { color: colors.text }]}>
                  {language === 'ar' ? 'لم تبلغ النصاب الشرعي للزكاة' : 'Assets below Nisab limit'}
                </Text>
                <Text style={[styles.dueSub, { textAlign: 'center' }]}>
                  {language === 'ar'
                    ? 'صافي أصولك أقل من نصاب الذهب الحالي. لا تجب عليك الزكاة فرضاً، ولكن يمكنك دائماً إخراج الصدقة التطوعية.'
                    : 'Your net wealth is below the Zakat threshold. You have no Zakat obligation, but you can always make a voluntary charity (Sadakah).'}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  infoBanner: {
    backgroundColor: colors.primary + '12',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  infoBannerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.primary,
    marginBottom: 4,
    textAlign: 'left',
  },
  infoBannerText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'left',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    elevation: 3,
  },
  cardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
    marginBottom: 16,
    textAlign: 'left',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'left',
  },
  inputFieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 44,
    fontFamily: 'Cairo_400Regular',
    color: '#FFF',
    fontSize: 14,
  },
  inputAr: {
    textAlign: 'right',
  },
  inputEn: {
    textAlign: 'left',
  },
  currencyTag: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.primary,
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnSecondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnTextPrimary: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  btnTextSecondary: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  resultCard: {
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
  },
  resultTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'left',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resultLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  resultValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  dueContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  dueTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.primary,
    marginTop: 4,
  },
  dueSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  dueValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    color: colors.primary,
    marginTop: 6,
  },
});
