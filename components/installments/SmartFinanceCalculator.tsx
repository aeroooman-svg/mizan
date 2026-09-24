import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
import { saveInstallmentPlan } from '@/lib/installmentStorage';

interface SmartFinanceCalculatorProps {
  onPlanCreated?: () => void;
  onSwitchToInstallmentsTab?: () => void;
}

// Realistic currency-based presets and interest rates
function getCurrencyDefaults(currency: string) {
  const c = (currency || '').toUpperCase();
  if (['KWD', 'BHD', 'OMR'].includes(c)) {
    return {
      cashPrice: '300',
      downPayment: '0',
      months: '12',
      monthlyInstallment: '25',
      yieldPresets: [
        { labelAr: 'ودائع بنكية / مرابحة (4.5%)', labelEn: 'Bank Deposit (4.5%)', rate: 4.5, icon: 'bank' },
        { labelAr: 'صناديق استثمار / صكوك (8.0%)', labelEn: 'Investment Funds (8.0%)', rate: 8.0, icon: 'chart-line' },
      ],
      defaultYieldRate: 4.5,
    };
  }
  if (['SAR', 'AED', 'QAR'].includes(c)) {
    return {
      cashPrice: '3000',
      downPayment: '0',
      months: '12',
      monthlyInstallment: '250',
      yieldPresets: [
        { labelAr: 'وديعة بنكية / مرابحة (5.0%)', labelEn: 'Bank Deposit (5.0%)', rate: 5.0, icon: 'bank' },
        { labelAr: 'صكوك واستثمارات (8.5%)', labelEn: 'Sukuk & Funds (8.5%)', rate: 8.5, icon: 'chart-line' },
      ],
      defaultYieldRate: 5.0,
    };
  }
  if (['EGP'].includes(c)) {
    return {
      cashPrice: '25000',
      downPayment: '0',
      months: '12',
      monthlyInstallment: '2500',
      yieldPresets: [
        { labelAr: 'شهادات بنكية (22%)', labelEn: 'Bank CDs (22%)', rate: 22.0, icon: 'bank' },
        { labelAr: 'أذون خزانة وصناديق (20%)', labelEn: 'T-Bills & Funds (20%)', rate: 20.0, icon: 'shield-check' },
      ],
      defaultYieldRate: 22.0,
    };
  }
  // USD / EUR / Other
  return {
    cashPrice: '1000',
    downPayment: '0',
    months: '12',
    monthlyInstallment: '85',
    yieldPresets: [
      { labelAr: 'حساب عوائد بنكي (5.0%)', labelEn: 'High-Yield Savings (5.0%)', rate: 5.0, icon: 'bank' },
      { labelAr: 'مؤشر أسهم / استثمار (9.0%)', labelEn: 'Index Funds (9.0%)', rate: 9.0, icon: 'chart-line' },
    ],
    defaultYieldRate: 5.0,
  };
}

export default function SmartFinanceCalculator({
  onPlanCreated,
  onSwitchToInstallmentsTab,
}: SmartFinanceCalculatorProps) {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { selectedWallet, wallets } = useTransactions();
  const currency = selectedWallet?.currency || 'KWD';

  const currencyDefaults = useMemo(() => getCurrencyDefaults(currency), [currency]);

  // Form Inputs
  const [productTitle, setProductTitle] = useState(isAr ? 'هاتف ذكي / جهاز' : 'Smartphone / Gadget');
  const [cashPriceInput, setCashPriceInput] = useState(currencyDefaults.cashPrice);
  const [downPaymentInput, setDownPaymentInput] = useState(currencyDefaults.downPayment);
  const [monthsInput, setMonthsInput] = useState(currencyDefaults.months);
  const [monthlyInstallmentInput, setMonthlyInstallmentInput] = useState(currencyDefaults.monthlyInstallment);

  // Strategy Mode: Direct comparison (from salary) vs investing the cash
  const [enableInvestmentMode, setEnableInvestmentMode] = useState(false);
  const [annualYieldRate, setAnnualYieldRate] = useState<number>(currencyDefaults.defaultYieldRate);
  const [customYieldInput, setCustomYieldInput] = useState(currencyDefaults.defaultYieldRate.toString());
  const [isCustomYield, setIsCustomYield] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync defaults when currency changes
  useEffect(() => {
    setCashPriceInput(currencyDefaults.cashPrice);
    setDownPaymentInput(currencyDefaults.downPayment);
    setMonthsInput(currencyDefaults.months);
    setMonthlyInstallmentInput(currencyDefaults.monthlyInstallment);
    setAnnualYieldRate(currencyDefaults.defaultYieldRate);
    setCustomYieldInput(currencyDefaults.defaultYieldRate.toString());
  }, [currencyDefaults]);

  // Numeric parsed values
  const cashPrice = Math.max(0, parseFloat(cashPriceInput) || 0);
  const downPayment = Math.max(0, parseFloat(downPaymentInput) || 0);
  const months = Math.max(1, parseInt(monthsInput, 10) || 1);
  const monthlyInstallment = Math.max(0, parseFloat(monthlyInstallmentInput) || 0);
  const yieldRate = isCustomYield ? (parseFloat(customYieldInput) || 0) : annualYieldRate;

  // Duration Presets
  const durationPresets = [3, 6, 12, 24, 36];

  // Core Financial Logic
  const calculation = useMemo(() => {
    // Total amount paid via installment
    const totalInstallmentPaid = downPayment + (monthlyInstallment * months);

    // Financing Markup & Interest (Difference between installment & cash price)
    const financingFee = Math.max(0, totalInstallmentPaid - cashPrice);
    const markupPercent = cashPrice > 0 ? ((totalInstallmentPaid - cashPrice) / cashPrice) * 100 : 0;
    const isZeroInterest = totalInstallmentPaid <= cashPrice && cashPrice > 0;

    // Approximate annual financing APR (فائدة التقسيط السنوية الفعلية)
    const annualizedAPR = months > 0 && cashPrice > 0
      ? Math.max(0, (markupPercent / (months / 12)))
      : 0;

    // Investment Capital: The cash retained in your pocket if you choose installment
    const investableAmount = Math.max(0, cashPrice - downPayment);

    // Monthly & Total Return if capital is kept in savings/investments
    const monthlyReturn = enableInvestmentMode ? (investableAmount * (yieldRate / 100)) / 12 : 0;
    const totalReturnsEarned = enableInvestmentMode ? monthlyReturn * months : 0;

    // Net Out-of-pocket monthly payment after deducting returns
    const netMonthlyOutflow = Math.max(0, monthlyInstallment - monthlyReturn);

    // Percentage of monthly installment covered by investment
    const monthlyCoverPercent = monthlyInstallment > 0 && enableInvestmentMode
      ? Math.min(100, Math.round((monthlyReturn / monthlyInstallment) * 100))
      : 0;

    // Net Financial Advantage:
    // If NO investment: advantage of cash = saving the financing fee.
    // If WITH investment: advantage = investment return - financing fee.
    const netInvestmentGain = totalReturnsEarned - financingFee;

    // Decision Logic:
    let verdictType: 'zero_interest' | 'invest_wins' | 'cash_wins';
    if (isZeroInterest) {
      verdictType = 'zero_interest';
    } else if (enableInvestmentMode && netInvestmentGain > 0) {
      verdictType = 'invest_wins';
    } else {
      verdictType = 'cash_wins';
    }

    return {
      totalInstallmentPaid,
      financingFee,
      markupPercent: Math.round(markupPercent * 10) / 10,
      annualizedAPR: Math.round(annualizedAPR * 10) / 10,
      isZeroInterest,
      investableAmount,
      monthlyReturn,
      totalReturnsEarned,
      netMonthlyOutflow,
      monthlyCoverPercent,
      netInvestmentGain: Math.abs(netInvestmentGain),
      verdictType,
    };
  }, [cashPrice, downPayment, months, monthlyInstallment, yieldRate, enableInvestmentMode]);

  // Handle Save Plan into Mizan Installments
  const handleSaveToInstallments = async () => {
    if (!productTitle.trim() || cashPrice <= 0 || monthlyInstallment <= 0) {
      Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'يرجى إكمال بيانات السعر والقسط أولاً' : 'Please fill price and installment details');
      return;
    }

    try {
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const targetWalletId = selectedWallet?.id || wallets[0]?.id || '';

      await saveInstallmentPlan({
        title: productTitle.trim(),
        totalAmount: calculation.totalInstallmentPaid,
        monthlyAmount: monthlyInstallment,
        totalMonths: months,
        remainingMonths: months,
        provider: calculation.isZeroInterest ? 'tabby' : 'bank_card',
        dueDay: 5,
        category: 'shopping',
        walletId: targetWalletId,
        isSmartYieldFunded: enableInvestmentMode,
        smartYieldCoverPercent: calculation.monthlyCoverPercent,
        smartYieldMonthlyReturn: Math.round(calculation.monthlyReturn),
        smartAssetCashPrice: cashPrice,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        isAr ? 'تمت إضافة القسط بنجاح! 🚀' : 'Plan Added! 🚀',
        isAr
          ? `تم إدراج "${productTitle}" ضمن أقساطك النشطة بقسط شهري ${formatCurrency(monthlyInstallment)} ${currency}.`
          : `"${productTitle}" added to active installments (${formatCurrency(monthlyInstallment)} ${currency}/mo).`,
        [
          {
            text: isAr ? 'عرض الأقساط' : 'View Installments',
            onPress: () => {
              if (onPlanCreated) onPlanCreated();
              if (onSwitchToInstallmentsTab) onSwitchToInstallmentsTab();
            },
          },
          { text: isAr ? 'إغلاق' : 'Close', style: 'cancel' },
        ]
      );
    } catch (e) {
      console.error('Error saving smart installment:', e);
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'تعذر حفظ القسط، يرجى المحاولة لاحقاً' : 'Failed to save installment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Intro Header Banner */}
      <LinearGradient
        colors={theme === 'dark' ? ['#1E1B4B', '#2E1065', '#0F172A'] : ['#EDE9FE', '#F3E8FF', '#EFF6FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroHeaderRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.heroTagBadge}>
              <Ionicons name="sparkles" size={13} color="#8B5CF6" />
              <Text style={styles.heroTagText}>
                {isAr ? 'مقارن القرار المالي الذكي' : 'Smart Financial Decision'}
              </Text>
            </View>
            <Text style={[styles.heroHeading, { color: theme === 'dark' ? '#FFF' : '#1E1B4B' }]}>
              {isAr ? 'كاش ولا تقسيط؟ 💡' : 'Cash vs Installment? 💡'}
            </Text>
            <Text style={[styles.heroDescription, { color: theme === 'dark' ? '#CBD5E1' : '#64748B' }]}>
              {isAr
                ? 'اكتشف بدقة: هل الدفع كاش أوفر لك، أم التقسيط يحميك من استنزاف السيولة؟ وحساب نسبة الفائدة الحقيقية على القسط.'
                : 'Compare upfront cash vs installment costs, unveil real financing markup, and see if investing your capital is wiser.'}
            </Text>
          </View>

          <View style={styles.heroIconCircle}>
            <MaterialCommunityIcons name="scale-balance" size={32} color="#8B5CF6" />
          </View>
        </View>
      </LinearGradient>

      {/* 1. Item Details Card */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="cart-outline" size={18} color={colors.primary} />
          <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>
            {isAr ? 'بيانات السلعة ونظام التقسيط' : 'Item & Financing Details'}
          </Text>
        </View>

        {/* Product Title */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {isAr ? 'اسم السلعة / المنتج' : 'Item Name'}
          </Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            value={productTitle}
            onChangeText={setProductTitle}
            placeholder={isAr ? 'مثال: آيفون، لابتوب، جهاز منزلي...' : 'e.g. Phone, Laptop...'}
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Cash Price & Down Payment */}
        <View style={styles.twoColRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: isAr ? 0 : 10, marginLeft: isAr ? 10 : 0 }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              {isAr ? `سعر الكاش (${currency})` : `Cash Price (${currency})`}
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={cashPriceInput}
              onChangeText={setCashPriceInput}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              {isAr ? `المقدم المدفوع (${currency})` : `Down Payment (${currency})`}
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={downPaymentInput}
              onChangeText={setDownPaymentInput}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>

        {/* Duration in Months */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {isAr ? 'مدة التقسيط' : 'Installment Duration'}
          </Text>
          <View style={styles.presetsRow}>
            {durationPresets.map(preset => (
              <Pressable
                key={preset}
                onPress={() => {
                  Haptics.selectionAsync();
                  setMonthsInput(preset.toString());
                }}
                style={[
                  styles.presetBtn,
                  { borderColor: colors.border, backgroundColor: colors.background },
                  months === preset && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    { color: colors.text },
                    months === preset && { color: '#FFF', fontFamily: 'Cairo_700Bold' },
                  ]}
                >
                  {preset} {isAr ? 'أشهر' : 'mo'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Monthly Installment Input */}
        <View style={styles.inputGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              {isAr ? `القسط الشهري المطلوب (${currency})` : `Monthly Installment (${currency})`}
            </Text>
            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.primary }}>
              {isAr ? `إجمالي السداد: ${formatCurrency(calculation.totalInstallmentPaid)} ${currency}` : `Total: ${formatCurrency(calculation.totalInstallmentPaid)}`}
            </Text>
          </View>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            value={monthlyInstallmentInput}
            onChangeText={setMonthlyInstallmentInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      </View>

      {/* 2. Real Interest & Markup Breakdown Card (Where did interest come from?) */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="calculator-outline" size={18} color="#8B5CF6" />
          <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>
            {isAr ? 'تحليل فائدة التقسيط الحقيقية' : 'Real Financing Markup Analysis'}
          </Text>
        </View>

        <View style={[styles.breakdownBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
              {isAr ? 'سعر الشراء كاش:' : 'Cash Price:'}
            </Text>
            <Text style={[styles.breakdownVal, { color: colors.text }]}>
              {formatCurrency(cashPrice)} {currency}
            </Text>
          </View>

          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
              {isAr ? `إجمالي ما ستدفعه بالتقسيط (${months} شهر):` : `Total Installments (${months} mo):`}
            </Text>
            <Text style={[styles.breakdownVal, { color: colors.text, fontFamily: 'Cairo_700Bold' }]}>
              {formatCurrency(calculation.totalInstallmentPaid)} {currency}
            </Text>
          </View>

          <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />

          {/* Real Interest Result */}
          <View style={styles.breakdownRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={calculation.isZeroInterest ? "checkmark-circle" : "alert-circle"}
                size={16}
                color={calculation.isZeroInterest ? "#10B981" : "#F59E0B"}
              />
              <Text style={[styles.breakdownLabel, { color: calculation.isZeroInterest ? "#10B981" : "#F59E0B", fontFamily: 'Cairo_700Bold' }]}>
                {calculation.isZeroInterest
                  ? (isAr ? 'فائدة التقسيط الفعلية:' : 'Financing Interest:')
                  : (isAr ? 'تكلفة التقسيط الإضافية (الفائدة):' : 'Financing Markup / Cost:')}
              </Text>
            </View>
            <Text
              style={[
                styles.breakdownVal,
                { color: calculation.isZeroInterest ? '#10B981' : '#F59E0B', fontFamily: 'Cairo_700Bold' },
              ]}
            >
              {calculation.isZeroInterest
                ? (isAr ? '0% (بدون أي فوائد 🎉)' : '0% (Zero Interest 🎉)')
                : `+${formatCurrency(calculation.financingFee)} ${currency} (+${calculation.markupPercent}%)`}
            </Text>
          </View>

          {!calculation.isZeroInterest && calculation.annualizedAPR > 0 && (
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textTertiary, marginTop: 4, textAlign: 'left' }}>
              {isAr
                ? `💡 هذه الزيادة تعادل معدل فائدة سنوي حقيقي قدره حوالي ${calculation.annualizedAPR}% على مدة التقسيط.`
                : `💡 This represents an annualized financing rate of approx ~${calculation.annualizedAPR}%.`}
            </Text>
          )}
        </View>
      </View>

      {/* 3. Optional: Invest Capital Strategy Switch */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setEnableInvestmentMode(prev => !prev);
          }}
          style={styles.switchHeaderRow}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.switchIconCircle, { backgroundColor: enableInvestmentMode ? '#8B5CF622' : colors.background }]}>
              <MaterialCommunityIcons
                name="trending-up"
                size={20}
                color={enableInvestmentMode ? '#8B5CF6' : colors.textSecondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>
                {isAr ? 'مقارنة مع استثمار رأس المال 📈' : 'Compare with Investing Capital 📈'}
              </Text>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                {isAr
                  ? 'إذا كنت تملك مبلغ الكاش وتفكر في تشغيله في وديعة أو صندوق واستخدام العائد لسداد القسط'
                  : 'If you have the cash and consider investing it to let yields cover the installment'}
              </Text>
            </View>
          </View>
          <Ionicons
            name={enableInvestmentMode ? 'checkbox' : 'square-outline'}
            size={24}
            color={enableInvestmentMode ? '#8B5CF6' : colors.textTertiary}
          />
        </Pressable>

        {enableInvestmentMode && (
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              {isAr ? `عائد الاستثمار البنكي الواقعي (${currency}):` : `Realistic Investment Yield (${currency}):`}
            </Text>

            <View style={styles.presetsColumn}>
              {currencyDefaults.yieldPresets.map(preset => {
                const isSelected = !isCustomYield && annualYieldRate === preset.rate;
                return (
                  <Pressable
                    key={preset.rate}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setIsCustomYield(false);
                      setAnnualYieldRate(preset.rate);
                    }}
                    style={[
                      styles.yieldCard,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      isSelected && { borderColor: '#8B5CF6', backgroundColor: '#8B5CF618' },
                    ]}
                  >
                    <View style={styles.yieldCardLeft}>
                      <MaterialCommunityIcons
                        name={preset.icon as any}
                        size={18}
                        color={isSelected ? '#8B5CF6' : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.yieldCardTitle,
                          { color: colors.text },
                          isSelected && { color: '#8B5CF6', fontFamily: 'Cairo_700Bold' },
                        ]}
                      >
                        {isAr ? preset.labelAr : preset.labelEn}
                      </Text>
                    </View>
                    <View style={[styles.yieldPercentBadge, isSelected && { backgroundColor: '#8B5CF6' }]}>
                      <Text style={[styles.yieldPercentText, isSelected && { color: '#FFF' }]}>
                        {preset.rate}%
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {/* Custom Yield Option */}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsCustomYield(true);
                }}
                style={[
                  styles.yieldCard,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  isCustomYield && { borderColor: '#8B5CF6', backgroundColor: '#8B5CF618' },
                ]}
              >
                <View style={styles.yieldCardLeft}>
                  <MaterialCommunityIcons
                    name="tune"
                    size={18}
                    color={isCustomYield ? '#8B5CF6' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.yieldCardTitle,
                      { color: colors.text },
                      isCustomYield && { color: '#8B5CF6', fontFamily: 'Cairo_700Bold' },
                    ]}
                  >
                    {isAr ? 'عائد سنوي مخصص' : 'Custom Annual Yield'}
                  </Text>
                </View>

                {isCustomYield ? (
                  <TextInput
                    style={[styles.customYieldInput, { color: '#8B5CF6', borderColor: '#8B5CF6' }]}
                    value={customYieldInput}
                    onChangeText={setCustomYieldInput}
                    keyboardType="decimal-pad"
                    placeholder="%"
                  />
                ) : (
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 13, color: colors.textSecondary }}>
                    {customYieldInput}%
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Yield Impact Snapshot */}
            <View style={[styles.yieldImpactBox, { backgroundColor: '#8B5CF612', borderColor: '#8B5CF630' }]}>
              <Ionicons name="sparkles" size={16} color="#8B5CF6" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: '#8B5CF6' }}>
                  {isAr ? 'تأثير الاستثمار على القسط:' : 'Investment Yield Impact:'}
                </Text>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  {isAr
                    ? `رأس المال المتبقي (${formatCurrency(calculation.investableAmount)} ${currency}) يولد أرباحاً قدرها ${formatCurrency(calculation.monthlyReturn)} ${currency}/شهرياً، فتغطي ${calculation.monthlyCoverPercent}% من قسطك!`
                    : `Investing ${formatCurrency(calculation.investableAmount)} ${currency} generates ${formatCurrency(calculation.monthlyReturn)} ${currency}/mo, covering ${calculation.monthlyCoverPercent}% of your installment.`}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 4. Smart Verdict & Recommendation */}
      <LinearGradient
        colors={
          calculation.verdictType === 'zero_interest'
            ? theme === 'dark' ? ['#064E3B', '#065F46', '#022C22'] : ['#ECFDF5', '#D1FAE5', '#A7F3D0']
            : calculation.verdictType === 'invest_wins'
              ? theme === 'dark' ? ['#1E1B4B', '#312E81', '#0F172A'] : ['#EDE9FE', '#DDD6FE', '#C4B5FD']
              : theme === 'dark' ? ['#7F1D1D', '#991B1B', '#450A0A'] : ['#FEF2F2', '#FEE2E2', '#FECACA']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.verdictCard}
      >
        <View style={styles.verdictIconRow}>
          <View
            style={[
              styles.verdictIconWrapper,
              {
                backgroundColor:
                  calculation.verdictType === 'zero_interest'
                    ? '#10B98135'
                    : calculation.verdictType === 'invest_wins'
                      ? '#8B5CF635'
                      : '#EF444435',
              },
            ]}
          >
            <Ionicons
              name={
                calculation.verdictType === 'zero_interest'
                  ? 'checkmark-done-circle'
                  : calculation.verdictType === 'invest_wins'
                    ? 'trophy'
                    : 'wallet'
              }
              size={26}
              color={
                calculation.verdictType === 'zero_interest'
                  ? '#10B981'
                  : calculation.verdictType === 'invest_wins'
                    ? '#8B5CF6'
                    : '#EF4444'
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.verdictTitle,
                {
                  color:
                    calculation.verdictType === 'zero_interest'
                      ? (theme === 'dark' ? '#6EE7B7' : '#065F46')
                      : calculation.verdictType === 'invest_wins'
                        ? (theme === 'dark' ? '#C4B5FD' : '#4C1D95')
                        : (theme === 'dark' ? '#FCA5A5' : '#991B1B'),
                },
              ]}
            >
              {calculation.verdictType === 'zero_interest'
                ? (isAr ? '🎉 التقسيط هو الأفضل (بدون أي فوائد 0%)' : '🎉 Installment Wins (0% Interest)')
                : calculation.verdictType === 'invest_wins'
                  ? (isAr ? '🏆 التقسيط مع الاستثمار رابح!' : '🏆 Financing + Investing Wins!')
                  : (isAr ? '💵 الشراء كاش هو الأوفر لك!' : '💵 Paying Cash is Cheaper!')}
            </Text>
            <Text
              style={[
                styles.verdictSubtitle,
                { color: theme === 'dark' ? '#E2E8F0' : '#334155' },
              ]}
            >
              {calculation.verdictType === 'zero_interest'
                ? (isAr
                  ? `بما أن إجمالي الأقساط يساوي سعر الكاش تماماً بدون فوائد، فالتقسيط خيار ذكي ومريح يحافظ على سيولتك النقدية للطوارئ دون دفع أي فلس إضافي.`
                  : `Since total installments equal the cash price with zero interest, installment preserves your cash flow with zero penalty.`)
                : calculation.verdictType === 'invest_wins'
                  ? (isAr
                    ? `عوائد استثمار رأس المال (${formatCurrency(calculation.totalReturnsEarned)} ${currency}) تتفوق على تكلفة فوائد التقسيط (${formatCurrency(calculation.financingFee)} ${currency}) بصافي ربح ${formatCurrency(calculation.netInvestmentGain)} ${currency} لصالحك!`
                    : `Investment returns (${formatCurrency(calculation.totalReturnsEarned)} ${currency}) beat financing fees (${formatCurrency(calculation.financingFee)} ${currency}) by +${formatCurrency(calculation.netInvestmentGain)} ${currency}!`)
                  : (isAr
                    ? `تكلفة فوائد التقسيط الإضافية هي ${formatCurrency(calculation.financingFee)} ${currency}. إن كانت السيولة متوفرة لديك، فالدفع كاش يوفر عليك هذا المبلغ تماماً.`
                    : `Financing adds an extra ${formatCurrency(calculation.financingFee)} ${currency} in markup. Paying cash saves you this markup entirely.`)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* 5. Direct Side-by-Side Comparison */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="git-compare-outline" size={18} color={colors.primary} />
          <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>
            {isAr ? 'مقارنة الخيارين وجهاً لوجه' : 'Head-to-Head Comparison'}
          </Text>
        </View>

        {/* Option 1: Cash */}
        <View style={[styles.scenarioRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.scenarioLeft}>
            <View style={[styles.scenarioDot, { backgroundColor: '#10B981' }]} />
            <View>
              <Text style={[styles.scenarioTitle, { color: colors.text }]}>
                {isAr ? 'خيار (١): الدفع كاش فوراً' : 'Option 1: Pay Cash'}
              </Text>
              <Text style={[styles.scenarioSub, { color: colors.textSecondary }]}>
                {calculation.isZeroInterest
                  ? (isAr ? 'دفع المبلغ دفعة واحدة، لا التزامات لاحقة' : 'One-time payment, no monthly debt')
                  : (isAr ? `يوفر عليك ${formatCurrency(calculation.financingFee)} ${currency} فوائد` : `Saves ${formatCurrency(calculation.financingFee)} ${currency} in fees`)}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.scenarioVal, { color: colors.text }]}>
              {formatCurrency(cashPrice)} {currency}
            </Text>
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
              {isAr ? 'دفعة واحدة' : 'Upfront'}
            </Text>
          </View>
        </View>

        {/* Option 2: Installment */}
        <View style={[styles.scenarioRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.scenarioLeft}>
            <View style={[styles.scenarioDot, { backgroundColor: '#8B5CF6' }]} />
            <View>
              <Text style={[styles.scenarioTitle, { color: colors.text }]}>
                {isAr ? 'خيار (٢): الشراء بالتقسيط' : 'Option 2: Installment'}
              </Text>
              <Text style={[styles.scenarioSub, { color: colors.textSecondary }]}>
                {isAr ? `${formatCurrency(monthlyInstallment)} ${currency} شهرياً × ${months} شهر` : `${formatCurrency(monthlyInstallment)} ${currency}/mo for ${months} mo`}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.scenarioVal, { color: '#8B5CF6' }]}>
              {formatCurrency(calculation.totalInstallmentPaid)} {currency}
            </Text>
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
              {isAr ? 'إجمالي السداد' : 'Total Paid'}
            </Text>
          </View>
        </View>
      </View>

      {/* 6. Expandable Financial Tip */}
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setShowExplanation(prev => !prev);
        }}
        style={[styles.accordionHeader, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
      >
        <View style={styles.accordionHeaderLeft}>
          <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
          <Text style={[styles.accordionTitle, { color: colors.text }]}>
            {isAr ? '💡 نصائح ذهبية عند الشراء كاش أو قسط' : '💡 Golden Rules for Cash vs Installment'}
          </Text>
        </View>
        <Ionicons
          name={showExplanation ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {showExplanation && (
        <View style={[styles.accordionBody, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
            {isAr
              ? `1️⃣ متى تختار التقسيط؟\n- إذا كان بدون فوائد ومصاريف إدارية (0%)، فهو دائماً خيار ممتاز للحفاظ على السيولة.\n- إذا كانت الأقساط الشهرية لا تتعدى 25% من دخلك الشهري.\n\n` +
                `2️⃣ متى تختار الكاش؟\n- إذا كان التاجر يضيف فائدة كبيرة تفوق أي عائد استثماري قد تحققه.\n- إذا كنت تملك سيولة طوارئ كافية ولا تريد التزامات شهرية تشغل بالك.\n\n` +
                `3️⃣ من أين تأتي الفائدة؟\n- فائدة التقسيط ليست رقماً عشوائياً، بل هي (إجمالي ما ستدفعه مقسطاً مطروحاً منه سعر الكاش). ميزان يحسبها لك آلياً بدقة.`
              : `1️⃣ When to choose installment?\n- Zero-interest promotions (0% APR) preserve liquidity.\n- When monthly debt remains under 25% of your income.\n\n` +
                `2️⃣ When to choose cash?\n- When financing markup is higher than safe investment yields.\n- When you have plenty of emergency savings and want peace of mind.\n\n` +
                `3️⃣ How is interest calculated?\n- It is the exact difference between total installments paid and the cash price.`}
          </Text>
        </View>
      )}

      {/* 7. Action Button: Save as Active Installment */}
      <Pressable
        onPress={handleSaveToInstallments}
        disabled={isSaving}
        style={({ pressed }) => [
          styles.actionBtn,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
      >
        <Ionicons name="add-circle-outline" size={20} color="#FFF" style={{ marginHorizontal: 6 }} />
        <Text style={styles.actionBtnText}>
          {isSaving
            ? (isAr ? 'جاري الحفظ...' : 'Saving...')
            : (isAr ? 'اعتماد وحفظ القسط في خطتك الشهرية 🚀' : 'Save Plan as Active Installment 🚀')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
    gap: 4,
  },
  heroTagText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#8B5CF6',
  },
  heroHeading: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    marginBottom: 4,
  },
  heroDescription: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  heroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  sectionCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    marginBottom: 6,
  },
  textInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
  },
  twoColRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  breakdownBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  breakdownLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  breakdownVal: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  breakdownDivider: {
    height: 1,
    marginVertical: 8,
  },
  switchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsColumn: {
    gap: 8,
  },
  yieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  yieldCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  yieldCardTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  yieldPercentBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  yieldPercentText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: '#8B5CF6',
  },
  customYieldInput: {
    width: 60,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  yieldImpactBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  verdictCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  verdictIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  verdictIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    marginBottom: 4,
  },
  verdictSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  scenarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  scenarioLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  scenarioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scenarioTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  scenarioSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
  },
  scenarioVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  accordionBody: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  explanationText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    lineHeight: 20,
  },
  actionBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 6,
  },
  actionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
});
