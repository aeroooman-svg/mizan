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
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
import { getLocalMetalPrices } from '@/lib/goldPriceApi';

const AVAILABLE_CURRENCIES = [
  { code: 'EGP', symbol: 'ج.م', nameAr: 'جنيه مصري', flag: '🇪🇬' },
  { code: 'SAR', symbol: 'ر.س', nameAr: 'ريال سعودي', flag: '🇸🇦' },
  { code: 'USD', symbol: '$', nameAr: 'دولار أمريكي', flag: '🇺🇸' },
  { code: 'AED', symbol: 'د.إ', nameAr: 'درهم إماراتي', flag: '🇦🇪' },
  { code: 'KWD', symbol: 'د.ك', nameAr: 'دينار كويتي', flag: '🇰🇼' },
  { code: 'QAR', symbol: 'ر.ق', nameAr: 'ريال قطري', flag: '🇶🇦' },
  { code: 'EUR', symbol: '€', nameAr: 'يورو', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', nameAr: 'جنيه إسترليني', flag: '🇬🇧' },
];

export default function ZakatCalculatorScreen() {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { selectedWallet, balance } = useTransactions();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);

  // Selected Calculation Currency
  const [currency, setCurrency] = useState(selectedWallet?.currency || 'EGP');

  // Inputs
  const [cash, setCash] = useState('');
  const [gold24Grams, setGold24Grams] = useState('');
  const [gold21Grams, setGold21Grams] = useState('');
  const [gold18Grams, setGold18Grams] = useState('');
  const [silverGrams, setSilverGrams] = useState('');
  const [investments, setInvestments] = useState('');
  const [businessStock, setBusinessStock] = useState('');
  const [liabilities, setLiabilities] = useState('');

  // Metal Prices State
  const [metalData, setMetalData] = useState<{
    gold24kLocal: number;
    gold22kLocal: number;
    gold21kLocal: number;
    gold18kLocal: number;
    silverLocal: number;
    goldNisabLocal: number;
    silverNisabLocal: number;
    isLive: boolean;
    lastUpdated: string;
  } | null>(null);

  const [loadingPrices, setLoadingPrices] = useState(true);
  const [customGoldPrice, setCustomGoldPrice] = useState<string>('');
  const [isCustomGoldActive, setIsCustomGoldActive] = useState(false);
  const [nisabStandard, setNisabStandard] = useState<'gold' | 'silver'>('gold');

  // Output states
  const [calculated, setCalculated] = useState(false);
  const [totalAssets, setTotalAssets] = useState(0);
  const [netAssets, setNetAssets] = useState(0);
  const [currentNisabVal, setCurrentNisabVal] = useState(0);
  const [zakatDue, setZakatDue] = useState(0);
  const [meetsNisab, setMeetsNisab] = useState(false);

  const refreshPrices = async (force = false) => {
    setLoadingPrices(true);
    try {
      const data = await getLocalMetalPrices(currency, force);
      setMetalData(data);
      if (force) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
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

  // Sync wallet balance helper
  const handleImportWalletBalance = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const activeBalance = Math.max(0, balance);
    setCash(activeBalance.toString());
  };

  const handleCalculate = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    const valCash = parseFloat(cash.replace(/,/g, '')) || 0;
    const valG24 = parseFloat(gold24Grams.replace(/,/g, '')) || 0;
    const valG21 = parseFloat(gold21Grams.replace(/,/g, '')) || 0;
    const valG18 = parseFloat(gold18Grams.replace(/,/g, '')) || 0;
    const valSilver = parseFloat(silverGrams.replace(/,/g, '')) || 0;
    const valInvestments = parseFloat(investments.replace(/,/g, '')) || 0;
    const valStock = parseFloat(businessStock.replace(/,/g, '')) || 0;
    const valLiabilities = parseFloat(liabilities.replace(/,/g, '')) || 0;

    let p24 = metalData?.gold24kLocal || 7500;
    let p21 = metalData?.gold21kLocal || (p24 * 21) / 24;
    let p18 = metalData?.gold18kLocal || (p24 * 18) / 24;
    const pSilver = metalData?.silverLocal || 110;

    if (isCustomGoldActive && parseFloat(customGoldPrice) > 0) {
      p24 = parseFloat(customGoldPrice);
      p21 = (p24 * 21) / 24;
      p18 = (p24 * 18) / 24;
    }

    const goldValue = valG24 * p24 + valG21 * p21 + valG18 * p18;
    const silverValue = valSilver * pSilver;

    const computedGross = valCash + goldValue + silverValue + valInvestments + valStock;
    const computedNet = Math.max(0, computedGross - valLiabilities);

    const nisabThreshold = nisabStandard === 'gold' ? p24 * 85 : pSilver * 595;

    setTotalAssets(computedGross);
    setNetAssets(computedNet);
    setCurrentNisabVal(nisabThreshold);

    if (computedNet >= nisabThreshold) {
      setZakatDue(computedNet * 0.025); // 2.5% Zakat
      setMeetsNisab(true);
    } else {
      setZakatDue(0);
      setMeetsNisab(false);
    }

    setCalculated(true);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  };

  const handleReset = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setCash('');
    setGold24Grams('');
    setGold21Grams('');
    setGold18Grams('');
    setSilverGrams('');
    setInvestments('');
    setBusinessStock('');
    setLiabilities('');
    setCalculated(false);
  };

  const handleShareReport = async () => {
    try {
      const report = isAr
        ? `🕌 تقرير حساب زكاة المال (${new Date().toLocaleDateString('ar-EG')})
━━━━━━━━━━━━━━━━
• العملة: ${currency}
• إجمالي الأصول: ${formatCurrency(totalAssets)} ${currency}
• الديون المخصومة: ${formatCurrency(parseFloat(liabilities) || 0)} ${currency}
• صافي المال الخاضع: ${formatCurrency(netAssets)} ${currency}
• النصاب الشرعي (${nisabStandard === 'gold' ? '٨٥ جرام ذهب' : '٥٩٥ جرام فضة'}): ${formatCurrency(currentNisabVal)} ${currency}
• حالة النصاب: ${meetsNisab ? 'بلغ النصاب ✅' : 'لم يبلغ النصاب ℹ️'}
• مقدار الزكاة الواجبة (٢.٥٪): ${formatCurrency(zakatDue)} ${currency}
━━━━━━━━━━━━━━━━
تم الحساب بواسطة تطبيق ميزان - Mizan`
        : `🕌 Zakat Calculation Report (${new Date().toLocaleDateString()})
━━━━━━━━━━━━━━━━
• Currency: ${currency}
• Gross Assets: ${formatCurrency(totalAssets)} ${currency}
• Deductible Debts: ${formatCurrency(parseFloat(liabilities) || 0)} ${currency}
• Net Zakat-Eligible: ${formatCurrency(netAssets)} ${currency}
• Nisab Limit: ${formatCurrency(currentNisabVal)} ${currency}
• Nisab Status: ${meetsNisab ? 'Eligible ✅' : 'Below Nisab ℹ️'}
• Zakat Due (2.5%): ${formatCurrency(zakatDue)} ${currency}
━━━━━━━━━━━━━━━━
Calculated via Mizan App`;

      await Share.share({ message: report });
    } catch (e) {
      console.warn(e);
    }
  };

  const handleGoBack = () => {
    try { Haptics.selectionAsync(); } catch {}
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Top Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={handleGoBack} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>
            {isAr ? '🕌 حاسبة الزكاة الشرعية' : '🕌 Zakat Calculator'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isAr ? 'حساب دقيق ومحدث لحظياً بأسعار البورصة' : 'Live Spot Metal Prices & Fatwa Guide'}
          </Text>
        </View>
        <Pressable onPress={handleGoBack} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Currency Switcher Bar */}
        <View style={styles.currencySelectCard}>
          <Text style={styles.currencySelectLabel}>
            {isAr ? 'اختر عملة الحساب:' : 'Select Calculation Currency:'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {AVAILABLE_CURRENCIES.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => {
                  try { Haptics.selectionAsync(); } catch {}
                  setCurrency(c.code);
                }}
                style={[styles.currPill, currency === c.code && styles.currPillActive]}
              >
                <Text style={styles.currPillFlag}>{c.flag}</Text>
                <Text style={[styles.currPillText, currency === c.code && styles.currPillTextActive]}>
                  {c.code} ({c.symbol})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Live Precious Metals Rates Card */}
        <View style={styles.metalsCard}>
          <View style={styles.metalsHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.goldIconBadge}>
                <Ionicons name="sparkles" size={18} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.metalsTitle}>
                  {isAr ? 'أسعار الذهب والفضة الحية' : 'Live Gold & Silver Spot Rates'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <View style={[styles.liveDot, { backgroundColor: metalData?.isLive ? '#10B981' : '#F59E0B' }]} />
                  <Text style={styles.liveTag}>
                    {metalData?.isLive
                      ? (isAr ? 'متزامن لحظياً مع البورصة العالمية' : 'Live Real-Time Market Stream')
                      : (isAr ? 'أسعار تقديرية محفوظة' : 'Cached Market Rates')}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={() => refreshPrices(true)}
              style={({ pressed }) => [styles.refreshMetalBtn, pressed && { opacity: 0.7 }]}
              disabled={loadingPrices}
            >
              {loadingPrices ? (
                <ActivityIndicator size="small" color="#F59E0B" />
              ) : (
                <Ionicons name="refresh-outline" size={16} color="#F59E0B" />
              )}
            </Pressable>
          </View>

          {/* Grid of Metal Prices */}
          <View style={styles.metalPricesGrid}>
            <View style={styles.metalPriceBox}>
              <Text style={styles.metalKaratName}>{isAr ? 'ذهب عيار 24 (سبائك)' : 'Gold 24K (Pure)'}</Text>
              <Text style={styles.metalPriceValue}>
                {metalData ? formatCurrency(metalData.gold24kLocal) : '...'} <Text style={styles.metalPriceCurr}>{currency}/g</Text>
              </Text>
            </View>

            <View style={styles.metalPriceBox}>
              <Text style={styles.metalKaratName}>{isAr ? 'ذهب عيار 21 (مشغولات)' : 'Gold 21K'}</Text>
              <Text style={styles.metalPriceValue}>
                {metalData ? formatCurrency(metalData.gold21kLocal) : '...'} <Text style={styles.metalPriceCurr}>{currency}/g</Text>
              </Text>
            </View>

            <View style={styles.metalPriceBox}>
              <Text style={styles.metalKaratName}>{isAr ? 'ذهب عيار 18' : 'Gold 18K'}</Text>
              <Text style={styles.metalPriceValue}>
                {metalData ? formatCurrency(metalData.gold18kLocal) : '...'} <Text style={styles.metalPriceCurr}>{currency}/g</Text>
              </Text>
            </View>

            <View style={styles.metalPriceBox}>
              <Text style={styles.metalKaratName}>{isAr ? 'فضة نقية 999' : 'Silver (999)'}</Text>
              <Text style={styles.metalPriceValue}>
                {metalData ? formatCurrency(metalData.silverLocal) : '...'} <Text style={styles.metalPriceCurr}>{currency}/g</Text>
              </Text>
            </View>
          </View>

          {/* Nisab Threshold Highlights */}
          <View style={styles.nisabSummaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nisabSummaryLabel}>
                {isAr ? 'نصاب الذهب الشرعي (85 جرام عيار 24):' : 'Gold Nisab (85g 24K):'}
              </Text>
              <Text style={styles.nisabSummaryValue}>
                {metalData ? formatCurrency(metalData.goldNisabLocal) : '...'} {currency}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nisabSummaryLabel}>
                {isAr ? 'نصاب الفضة الشرعي (595 جرام):' : 'Silver Nisab (595g):'}
              </Text>
              <Text style={styles.nisabSummaryValue}>
                {metalData ? formatCurrency(metalData.silverNisabLocal) : '...'} {currency}
              </Text>
            </View>
          </View>

          {/* Manual Gold Price Override Toggle */}
          <View style={styles.customPriceToggleRow}>
            <Pressable
              onPress={() => setIsCustomGoldActive(!isCustomGoldActive)}
              style={styles.toggleCustomBtn}
            >
              <Ionicons
                name={isCustomGoldActive ? 'checkbox' : 'square-outline'}
                size={18}
                color={isCustomGoldActive ? '#F59E0B' : colors.textSecondary}
              />
              <Text style={styles.toggleCustomText}>
                {isAr ? 'تعديل سعر جرام الذهب يدوياً (حسب سعر الصاغة المحلي)' : 'Manually override gold gram price'}
              </Text>
            </Pressable>
          </View>

          {isCustomGoldActive && (
            <View style={styles.customInputRow}>
              <Text style={styles.customInputLabel}>{isAr ? 'سعر جرام عيار 24 يدوياً:' : 'Manual 24K Gram Price:'}</Text>
              <TextInput
                style={styles.customInput}
                keyboardType="decimal-pad"
                placeholder={metalData ? metalData.gold24kLocal.toString() : '0.00'}
                placeholderTextColor={colors.textTertiary}
                value={customGoldPrice}
                onChangeText={setCustomGoldPrice}
              />
              <Text style={{ fontFamily: 'Cairo_700Bold', color: '#F59E0B' }}>{currency}</Text>
            </View>
          )}
        </View>

        {/* Nisab Standard Selector */}
        <View style={styles.nisabChoiceCard}>
          <Text style={styles.nisabChoiceTitle}>
            {isAr ? 'معيار النصاب المعتمد للحساب:' : 'Select Nisab Standard:'}
          </Text>
          <View style={styles.nisabButtonsRow}>
            <Pressable
              onPress={() => setNisabStandard('gold')}
              style={[styles.nisabBtn, nisabStandard === 'gold' && styles.nisabBtnActive]}
            >
              <Ionicons name="trophy" size={16} color={nisabStandard === 'gold' ? '#F59E0B' : colors.textSecondary} />
              <Text style={[styles.nisabBtnText, nisabStandard === 'gold' && styles.nisabBtnTextActive]}>
                {isAr ? 'نصاب الذهب (85 جرام) - الراجح' : 'Gold Nisab (85g) - Standard'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setNisabStandard('silver')}
              style={[styles.nisabBtn, nisabStandard === 'silver' && styles.nisabBtnActive]}
            >
              <MaterialCommunityIcons
                name="circle-multiple-outline"
                size={16}
                color={nisabStandard === 'silver' ? '#94A3B8' : colors.textSecondary}
              />
              <Text style={[styles.nisabBtnText, nisabStandard === 'silver' && styles.nisabBtnTextActive]}>
                {isAr ? 'نصاب الفضة (595 جرام) - الأحوط' : 'Silver Nisab (595g)'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Inputs Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isAr ? 'الأصول والمدخرات المالية' : 'Your Financial Assets'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isAr ? 'أدخل ما تملكه وحال عليه الحول (سنة هجرية كاملة)' : 'Assets held for a full lunar year'}
            </Text>
          </View>

          {/* 1. Cash & Savings */}
          <View style={styles.inputContainer}>
            <View style={styles.inputLabelRow}>
              <Text style={styles.inputLabel}>
                {isAr ? '💰 السيولة النقدية والودائع البنكية' : '💰 Cash & Bank Deposits'}
              </Text>
              {balance > 0 && (
                <Pressable onPress={handleImportWalletBalance} style={styles.importWalletBtn}>
                  <Ionicons name="wallet-outline" size={14} color="#10B981" />
                  <Text style={styles.importWalletText}>
                    {isAr ? 'استيراد رصيد المحفظة' : 'Import Balance'}
                  </Text>
                </Pressable>
              )}
            </View>
            <View style={styles.inputFieldWrapper}>
              <TextInput
                style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={cash}
                onChangeText={setCash}
              />
              <Text style={styles.currencyTag}>{currency}</Text>
            </View>
          </View>

          {/* 2. Gold Section (24k, 21k, 18k) */}
          <View style={styles.goldInputsSection}>
            <Text style={styles.inputGroupTitle}>{isAr ? '🪙 الذهب المملوك المدخر (بالجرام)' : '🪙 Owned Gold (in Grams)'}</Text>
            <View style={styles.multiGramsRow}>
              {/* 24K */}
              <View style={styles.multiGramCol}>
                <Text style={styles.miniLabel}>{isAr ? 'عيار 24 (سبائك)' : '24K (Pure)'}</Text>
                <View style={styles.miniInputWrap}>
                  <TextInput
                    style={styles.miniInput}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={gold24Grams}
                    onChangeText={setGold24Grams}
                  />
                  <Text style={styles.gramTag}>{isAr ? 'جم' : 'g'}</Text>
                </View>
              </View>

              {/* 21K */}
              <View style={styles.multiGramCol}>
                <Text style={styles.miniLabel}>{isAr ? 'عيار 21 (مشغولات)' : '21K'}</Text>
                <View style={styles.miniInputWrap}>
                  <TextInput
                    style={styles.miniInput}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={gold21Grams}
                    onChangeText={setGold21Grams}
                  />
                  <Text style={styles.gramTag}>{isAr ? 'جم' : 'g'}</Text>
                </View>
              </View>

              {/* 18K */}
              <View style={styles.multiGramCol}>
                <Text style={styles.miniLabel}>{isAr ? 'عيار 18' : '18K'}</Text>
                <View style={styles.miniInputWrap}>
                  <TextInput
                    style={styles.miniInput}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={gold18Grams}
                    onChangeText={setGold18Grams}
                  />
                  <Text style={styles.gramTag}>{isAr ? 'جم' : 'g'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 3. Silver */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {isAr ? '🥈 الفضة المدخرة (بالجرام)' : '🥈 Owned Silver (Grams)'}
            </Text>
            <View style={styles.inputFieldWrapper}>
              <TextInput
                style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={silverGrams}
                onChangeText={setSilverGrams}
              />
              <Text style={styles.currencyTag}>{isAr ? 'جرام فضة' : 'g Silver'}</Text>
            </View>
          </View>

          {/* 4. Stocks & Investments */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {isAr ? '📈 الأسهم والصناديق الاستثمارية (القيمة السوقية)' : '📈 Stocks & Investment Funds'}
            </Text>
            <View style={styles.inputFieldWrapper}>
              <TextInput
                style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={investments}
                onChangeText={setInvestments}
              />
              <Text style={styles.currencyTag}>{currency}</Text>
            </View>
          </View>

          {/* 5. Business inventory */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {isAr ? '📦 عروض التجارة وبضائع البيع' : '📦 Business Trade Inventory'}
            </Text>
            <View style={styles.inputFieldWrapper}>
              <TextInput
                style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={businessStock}
                onChangeText={setBusinessStock}
              />
              <Text style={styles.currencyTag}>{currency}</Text>
            </View>
          </View>

          {/* 6. Liabilities (Deductions) */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: '#EF4444' }]}>
              {isAr ? '📉 الديون والالتزامات المستحقة حالاً (تُخصم من الوعاء)' : '📉 Immediate Debts & Liabilities (Deducted)'}
            </Text>
            <View style={[styles.inputFieldWrapper, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <TextInput
                style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={liabilities}
                onChangeText={setLiabilities}
              />
              <Text style={[styles.currencyTag, { color: '#EF4444' }]}>{currency}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable
              onPress={handleCalculate}
              style={[styles.btn, styles.btnPrimary]}
            >
              <Ionicons name="calculator" size={20} color="#FFFFFF" />
              <Text style={styles.btnTextPrimary}>
                {isAr ? 'احسب الزكاة الشرعية' : 'Calculate Zakat'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleReset}
              style={[styles.btn, styles.btnSecondary]}
            >
              <Text style={styles.btnTextSecondary}>
                {isAr ? 'إعادة ضبط' : 'Reset'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Results View */}
        {calculated && (
          <View style={[styles.card, styles.resultCard]}>
            <View style={styles.resultCardHeader}>
              <Text style={styles.resultTitle}>
                {isAr ? '📋 تقرير وعاء الزكاة والنتيجة' : '📋 Zakat Assessment Report'}
              </Text>
              <Pressable onPress={handleShareReport} style={styles.shareReportBtn}>
                <Ionicons name="share-social-outline" size={18} color="#F59E0B" />
                <Text style={styles.shareReportText}>{isAr ? 'مشاركة' : 'Share'}</Text>
              </Pressable>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>
                {isAr ? 'إجمالي الأصول المقومة:' : 'Gross Assets Value:'}
              </Text>
              <Text style={styles.resultValue}>{formatCurrency(totalAssets)} {currency}</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>
                {isAr ? 'الديون والالتزامات المخصومة:' : 'Deducted Liabilities:'}
              </Text>
              <Text style={[styles.resultValue, { color: '#EF4444' }]}>
                - {formatCurrency(parseFloat(liabilities) || 0)} {currency}
              </Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>
                {isAr ? 'صافي الوعاء الزكوي الخاضع:' : 'Net Zakat-Eligible Wealth:'}
              </Text>
              <Text style={[styles.resultValue, { color: '#10B981', fontFamily: 'Cairo_700Bold' }]}>
                {formatCurrency(netAssets)} {currency}
              </Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>
                {isAr ? `قيمة النصاب (${nisabStandard === 'gold' ? '٨٥ جم ذهب' : '٥٩٥ جم فضة'}):` : 'Current Nisab Limit:'}
              </Text>
              <Text style={[styles.resultValue, { color: '#F59E0B' }]}>
                {formatCurrency(currentNisabVal)} {currency}
              </Text>
            </View>

            <View style={styles.divider} />

            {meetsNisab ? (
              <View style={styles.dueContainer}>
                <View style={styles.dueIconWrapSuccess}>
                  <Ionicons name="checkmark-done" size={32} color="#10B981" />
                </View>
                <Text style={styles.dueTitle}>
                  {isAr ? 'الحمد لله، أموالك بلغت النصاب الشرعي' : 'Assets Met the Nisab Limit'}
                </Text>
                <Text style={styles.dueSub}>
                  {isAr
                    ? 'مقدار الزكاة الواجب إخراجها شرعاً (٢.٥٪) لتطهير وبركة مالك:'
                    : 'The total obligatory Zakat due (2.5%) for your wealth is:'}
                </Text>
                <Text style={styles.dueValue}>
                  {formatCurrency(zakatDue)} <Text style={{ fontSize: 20 }}>{currency}</Text>
                </Text>
                <View style={styles.quranQuoteBox}>
                  <Text style={styles.quranQuoteText}>
                    {isAr
                      ? '﴿ خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ وَتُزَكِّيهِم بِهَا ﴾ [التوبة: 103]'
                      : '“Take from their wealth a charity by which you purify them and cause them increase.”'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.dueContainer}>
                <View style={styles.dueIconWrapInfo}>
                  <Ionicons name="information" size={30} color="#F59E0B" />
                </View>
                <Text style={[styles.dueTitle, { color: colors.text }]}>
                  {isAr ? 'صافي المال لم يبلغ النصاب الشرعي' : 'Assets are Below Nisab Limit'}
                </Text>
                <Text style={[styles.dueSub, { textAlign: 'center' }]}>
                  {isAr
                    ? `صافي ثروتك (${formatCurrency(netAssets)} ${currency}) أقل من قيمة النصاب المطلوب (${formatCurrency(currentNisabVal)} ${currency}). لا تجب عليك الزكاة فرضاً، ولكن الصدقة التطوعية مستحبة وتفتح أبواب الرزق.`
                    : 'Your net wealth is below the Zakat threshold. You have no obligatory Zakat, but voluntary charity (Sadaqah) is always blessed.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom Back Button */}
        <Pressable
          onPress={handleGoBack}
          style={({ pressed }) => [styles.bottomBackBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="home-outline" size={18} color="#10B981" />
          <Text style={styles.bottomBackBtnText}>
            {isAr ? 'العودة للرئيسية والتطبيق 🏠' : 'Close & Return to Home'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, theme: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 52 : 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    headerTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.text,
    },
    headerSubtitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 10,
      color: colors.textSecondary,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 14,
    },
    currencySelectCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    currencySelectLabel: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    currPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    currPillActive: {
      backgroundColor: 'rgba(245, 158, 11, 0.18)',
      borderColor: '#F59E0B',
    },
    currPillFlag: {
      fontSize: 14,
    },
    currPillText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    currPillTextActive: {
      fontFamily: 'Cairo_700Bold',
      color: '#F59E0B',
    },
    metalsCard: {
      backgroundColor: 'rgba(245, 158, 11, 0.06)',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1.5,
      borderColor: 'rgba(245, 158, 11, 0.3)',
      gap: 12,
    },
    metalsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    goldIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    metalsTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    liveTag: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10,
      color: colors.textTertiary,
    },
    refreshMetalBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    metalPricesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metalPriceBox: {
      flex: 1,
      minWidth: '47%',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metalKaratName: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    metalPriceValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: '#F59E0B',
      marginTop: 2,
    },
    metalPriceCurr: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 10,
      color: colors.textTertiary,
    },
    nisabSummaryRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nisabSummaryLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    nisabSummaryValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: '#10B981',
      marginTop: 2,
    },
    customPriceToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    toggleCustomBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toggleCustomText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    customInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: '#F59E0B',
    },
    customInputLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    customInput: {
      flex: 1,
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
      padding: 4,
    },
    nisabChoiceCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    nisabChoiceTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    nisabButtonsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    nisabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nisabBtnActive: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      borderColor: '#F59E0B',
    },
    nisabBtnText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    nisabBtnTextActive: {
      fontFamily: 'Cairo_700Bold',
      color: colors.text,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      marginBottom: 14,
    },
    cardTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
      textAlign: 'left',
    },
    cardSubtitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'left',
    },
    inputContainer: {
      marginBottom: 14,
    },
    inputLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    inputLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'left',
    },
    importWalletBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    importWalletText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 10,
      color: '#10B981',
    },
    inputFieldWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    input: {
      flex: 1,
      height: 46,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.text,
      fontSize: 15,
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
      color: '#10B981',
      marginLeft: 8,
    },
    goldInputsSection: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputGroupTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.text,
      marginBottom: 8,
    },
    multiGramsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    multiGramCol: {
      flex: 1,
    },
    miniLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    miniInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
    },
    miniInput: {
      flex: 1,
      height: 38,
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
    },
    gramTag: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10,
      color: colors.textTertiary,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    btn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    btnPrimary: {
      backgroundColor: '#10B981',
      flex: 2,
    },
    btnSecondary: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnTextPrimary: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: '#FFFFFF',
    },
    btnTextSecondary: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.textSecondary,
    },
    resultCard: {
      borderWidth: 2,
      borderColor: 'rgba(16, 185, 129, 0.4)',
      backgroundColor: 'rgba(16, 185, 129, 0.04)',
    },
    resultCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    resultTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
    },
    shareReportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    shareReportText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
      color: '#F59E0B',
    },
    resultRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    resultLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
    },
    resultValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    dueContainer: {
      alignItems: 'center',
      paddingVertical: 8,
      gap: 6,
    },
    dueIconWrapSuccess: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    dueIconWrapInfo: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    dueTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: '#10B981',
      textAlign: 'center',
    },
    dueSub: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    dueValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 32,
      color: '#10B981',
      marginVertical: 6,
    },
    quranQuoteBox: {
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.2)',
      marginTop: 6,
    },
    quranQuoteText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: '#10B981',
      textAlign: 'center',
    },
    bottomBackBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
    },
    bottomBackBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
    },
  });
