import React, { useState, useMemo } from 'react';
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

export default function SmartFinanceCalculator({
  onPlanCreated,
  onSwitchToInstallmentsTab,
}: SmartFinanceCalculatorProps) {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { selectedWallet, wallets } = useTransactions();
  const currency = selectedWallet?.currency || 'EGP';

  // Inputs
  const [productTitle, setProductTitle] = useState(isAr ? 'سيارة جديدة' : 'New Car');
  const [cashPriceInput, setCashPriceInput] = useState('600000');
  const [downPaymentInput, setDownPaymentInput] = useState('100000');
  const [monthsInput, setMonthsInput] = useState('36');
  const [monthlyInstallmentInput, setMonthlyInstallmentInput] = useState('18500');
  const [annualYieldRate, setAnnualYieldRate] = useState<number>(27); // Default 27% (Egyptian certificates)
  const [customYieldInput, setCustomYieldInput] = useState('27');
  const [isCustomYield, setIsCustomYield] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Numeric parsed values
  const cashPrice = Math.max(0, parseFloat(cashPriceInput) || 0);
  const downPayment = Math.max(0, parseFloat(downPaymentInput) || 0);
  const months = Math.max(1, parseInt(monthsInput, 10) || 1);
  const monthlyInstallment = Math.max(0, parseFloat(monthlyInstallmentInput) || 0);
  const yieldRate = isCustomYield ? (parseFloat(customYieldInput) || 0) : annualYieldRate;

  // Investment Presets
  const yieldPresets = [
    { labelAr: 'شهادات بنكية 27%', labelEn: 'CDs 27%', rate: 27, icon: 'bank' },
    { labelAr: 'أذون خزانة 23%', labelEn: 'T-Bills 23%', rate: 23, icon: 'shield-check' },
    { labelAr: 'صناديق نقدية 19%', labelEn: 'Money Funds 19%', rate: 19, icon: 'chart-line' },
  ];

  // Duration Presets
  const durationPresets = [12, 24, 36, 48, 60];

  // Core Financial Logic
  const calculation = useMemo(() => {
    // Investable capital if choosing installment: cash price minus down payment
    const investableAmount = Math.max(0, cashPrice - downPayment);

    // Monthly return from investment
    // Annual return = investableAmount * (yieldRate / 100)
    // Monthly return = Annual return / 12
    const monthlyReturn = (investableAmount * (yieldRate / 100)) / 12;

    // Total returns over the entire installment duration
    const totalReturnsEarned = monthlyReturn * months;

    // Total paid via installment: downPayment + (monthlyInstallment * months)
    const totalInstallmentPaid = downPayment + (monthlyInstallment * months);

    // The nominal installment interest (over cash price)
    const rawFinancingFee = Math.max(0, totalInstallmentPaid - cashPrice);

    // Net actual cost of the asset if investing the capital:
    // (Total Paid - Total Investment Return)
    const netActualCost = Math.max(0, totalInstallmentPaid - totalReturnsEarned);

    // Net Effective percentage of cash price (e.g. 52% of cash price!)
    const effectivePricePercent = cashPrice > 0 ? (netActualCost / cashPrice) * 100 : 0;

    // Percentage of monthly installment covered by investment returns
    const monthlyCoverPercent = monthlyInstallment > 0
      ? Math.min(100, Math.round((monthlyReturn / monthlyInstallment) * 100))
      : 0;

    // Net monthly out-of-pocket payment
    const netMonthlyOutflow = Math.max(0, monthlyInstallment - monthlyReturn);

    // Net benefit of smart strategy vs paying cash:
    // Scenario A (Pay Cash): You spend cashPrice now. Remaining capital = 0.
    // Scenario B (Smart Financing): You pay downPayment now, invest remainder.
    // At end of term, you still have investableAmount capital!
    // Total financial gain = Total Returns - Raw Financing Fee
    const netFinancialAdvantage = totalReturnsEarned - rawFinancingFee;
    const isSmartWin = netFinancialAdvantage > 0;

    return {
      investableAmount,
      monthlyReturn,
      totalReturnsEarned,
      totalInstallmentPaid,
      rawFinancingFee,
      netActualCost,
      effectivePricePercent: Math.round(effectivePricePercent),
      monthlyCoverPercent,
      netMonthlyOutflow,
      netFinancialAdvantage: Math.abs(netFinancialAdvantage),
      isSmartWin,
    };
  }, [cashPrice, downPayment, months, monthlyInstallment, yieldRate]);

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
        provider: 'bank_card',
        dueDay: 5,
        category: 'shopping',
        walletId: targetWalletId,
        isSmartYieldFunded: true,
        smartYieldCoverPercent: calculation.monthlyCoverPercent,
        smartYieldMonthlyReturn: Math.round(calculation.monthlyReturn),
        smartAssetCashPrice: cashPrice,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        isAr ? 'تمت إضافة القسط بنجاح! 🚀' : 'Plan Added! 🚀',
        isAr
          ? `تم إدراج "${productTitle}" ضمن أقساطك النشطة مع وسم التمويل الذكي من الاستثمار بنسبة تغطية ${calculation.monthlyCoverPercent}%.`
          : `"${productTitle}" added to active installments with smart yield coverage badge (${calculation.monthlyCoverPercent}%).`,
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
      {/* Concept Hero Header Banner */}
      <LinearGradient
        colors={theme === 'dark' ? ['#1E1B4B', '#31104B', '#0F172A'] : ['#EDE9FE', '#F3E8FF', '#EFF6FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroHeaderRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.heroTagBadge}>
              <Ionicons name="sparkles" size={13} color="#8B5CF6" />
              <Text style={styles.heroTagText}>
                {isAr ? 'استراتيجية بيزنساوي للشراء الذكي' : 'Smart Opportunity Cost Strategy'}
              </Text>
            </View>
            <Text style={[styles.heroHeading, { color: theme === 'dark' ? '#FFF' : '#1E1B4B' }]}>
              {isAr ? 'كاش ولا تقسيط واستثمار؟ 💡' : 'Cash or Smart Financing? 💡'}
            </Text>
            <Text style={[styles.heroDescription, { color: theme === 'dark' ? '#CBD5E1' : '#64748B' }]}>
              {isAr
                ? 'قارن بين دفع الكاش فوراً وبين تشغيل رأس المال في أوعية ذات عائد دوري ليسدد القسط نيابة عنك.'
                : 'Compare paying upfront vs investing the capital to let monthly yields pay off your installments.'}
            </Text>
          </View>

          <View style={styles.heroIconCircle}>
            <MaterialCommunityIcons name="calculator-variant" size={32} color="#8B5CF6" />
          </View>
        </View>
      </LinearGradient>

      {/* Input Section Card */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="create-outline" size={18} color={colors.primary} />
          <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>
            {isAr ? 'بيانات السلعة والتمويل' : 'Asset & Financing Details'}
          </Text>
        </View>

        {/* Product Title */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {isAr ? 'اسم السلعة / المنتج' : 'Item / Asset Name'}
          </Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            value={productTitle}
            onChangeText={setProductTitle}
            placeholder={isAr ? 'مثال: سيارة، أجهزة كهربائية...' : 'e.g. Car, Laptop...'}
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Row: Cash Price & Down Payment */}
        <View style={styles.twoColRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: isAr ? 0 : 10, marginLeft: isAr ? 10 : 0 }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              {isAr ? `سعر الكاش (${currency})` : `Cash Price (${currency})`}
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={cashPriceInput}
              onChangeText={setCashPriceInput}
              keyboardType="numeric"
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
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>

        {/* Duration in Months */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {isAr ? 'مدة التقسيط (بالأشهر)' : 'Installment Duration (Months)'}
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
                  {preset} {isAr ? 'ش' : 'mo'}
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
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.primary }}>
              {isAr ? `إجمالي السداد: ${formatCurrency(calculation.totalInstallmentPaid)} ${currency}` : `Total: ${formatCurrency(calculation.totalInstallmentPaid)}`}
            </Text>
          </View>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            value={monthlyInstallmentInput}
            onChangeText={setMonthlyInstallmentInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Alternative Investment Yield Presets */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {isAr ? 'عائد الوعاء الاستثماري البديل (سنوياً %)' : 'Alternative Investment Return (% p.a.)'}
          </Text>
          <View style={styles.presetsColumn}>
            {yieldPresets.map(preset => {
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
                      size={20}
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
                  size={20}
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
                  keyboardType="numeric"
                  placeholder="%"
                />
              ) : (
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 13, color: colors.textSecondary }}>
                  {customYieldInput}%
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Smart Verdict Banner */}
      <LinearGradient
        colors={
          calculation.isSmartWin
            ? theme === 'dark'
              ? ['#064E3B', '#065F46', '#022C22']
              : ['#ECFDF5', '#D1FAE5', '#A7F3D0']
            : theme === 'dark'
              ? ['#7F1D1D', '#991B1B', '#450A0A']
              : ['#FEF2F2', '#FEE2E2', '#FECACA']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.verdictCard}
      >
        <View style={styles.verdictIconRow}>
          <View
            style={[
              styles.verdictIconWrapper,
              { backgroundColor: calculation.isSmartWin ? '#10B98130' : '#EF444430' },
            ]}
          >
            <Ionicons
              name={calculation.isSmartWin ? 'trophy' : 'alert-circle'}
              size={26}
              color={calculation.isSmartWin ? '#10B981' : '#EF4444'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.verdictTitle,
                { color: calculation.isSmartWin ? (theme === 'dark' ? '#6EE7B7' : '#065F46') : (theme === 'dark' ? '#FCA5A5' : '#991B1B') },
              ]}
            >
              {calculation.isSmartWin
                ? (isAr ? '🏆 استراتيجية رابحة: التقسيط مع الاستثمار أفضل!' : '🏆 Winning Strategy: Smart Financing is Superior!')
                : (isAr ? '⚠️ تنبيه: الشراء كاش أوفر لك في هذه الحالة!' : '⚠️ Notice: Paying Cash is Cheaper!')}
            </Text>
            <Text
              style={[
                styles.verdictSubtitle,
                { color: theme === 'dark' ? '#E2E8F0' : '#334155' },
              ]}
            >
              {calculation.isSmartWin
                ? (isAr
                  ? `استثمار مبلغ الكاش (${formatCurrency(calculation.investableAmount)}) سيحقق لك عائداً إجمالياً قدره ${formatCurrency(calculation.totalReturnsEarned)} ${currency}، متفوقاً على فوائد التقسيط بفارق صافٍ قدره ${formatCurrency(calculation.netFinancialAdvantage)} ${currency}!`
                  : `Investing the cash (${formatCurrency(calculation.investableAmount)}) yields ${formatCurrency(calculation.totalReturnsEarned)} ${currency}, beating financing costs by ${formatCurrency(calculation.netFinancialAdvantage)} ${currency}!`)
                : (isAr
                  ? `فوائد التقسيط البالغة ${formatCurrency(calculation.rawFinancingFee)} ${currency} تفوق عوائد الاستثمار المتاحة بمقدار ${formatCurrency(calculation.netFinancialAdvantage)} ${currency}. الأفضل الدفع كاش إن توفرت السيولة.`
                  : `Financing interest exceeds available investment returns by ${formatCurrency(calculation.netFinancialAdvantage)} ${currency}. Cash is better.`)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Real Magic Analytics Metrics */}
      <View style={styles.metricsGrid}>
        {/* Metric 1: Coverage Percent */}
        <View style={[styles.metricCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Ionicons name="pie-chart-outline" size={16} color="#8B5CF6" />
            <Text style={[styles.metricTitle, { color: colors.textSecondary }]}>
              {isAr ? 'تغطية القسط من العائد' : 'Yield Coverage'}
            </Text>
          </View>
          <Text style={[styles.metricBigVal, { color: '#8B5CF6' }]}>
            {calculation.monthlyCoverPercent}%
          </Text>
          <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
            {isAr ? 'يسدد الاستثمار تلقائياً شهرياً' : 'Paid automatically each month'}
          </Text>
        </View>

        {/* Metric 2: Net Monthly Out-of-pocket */}
        <View style={[styles.metricCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Ionicons name="wallet-outline" size={16} color="#10B981" />
            <Text style={[styles.metricTitle, { color: colors.textSecondary }]}>
              {isAr ? 'صافي ما تدفعه شهرياً' : 'Net Monthly Paid'}
            </Text>
          </View>
          <Text style={[styles.metricBigVal, { color: '#10B981' }]}>
            {formatCurrency(calculation.netMonthlyOutflow)} <Text style={{ fontSize: 11 }}>{currency}</Text>
          </Text>
          <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
            {isAr ? `بدلاً من ${formatCurrency(monthlyInstallment)}` : `instead of ${formatCurrency(monthlyInstallment)}`}
          </Text>
        </View>

        {/* Metric 3: Monthly Return Earned */}
        <View style={[styles.metricCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Ionicons name="trending-up" size={16} color="#3B82F6" />
            <Text style={[styles.metricTitle, { color: colors.textSecondary }]}>
              {isAr ? 'العائد الشهري للاستثمار' : 'Monthly Yield'}
            </Text>
          </View>
          <Text style={[styles.metricBigVal, { color: '#3B82F6' }]}>
            +{formatCurrency(calculation.monthlyReturn)} <Text style={{ fontSize: 11 }}>{currency}</Text>
          </Text>
          <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
            {isAr ? `بمعدل عائد سنوي ${yieldRate}%` : `@ ${yieldRate}% annual rate`}
          </Text>
        </View>

        {/* Metric 4: Effective Price Paid */}
        <View style={[styles.metricCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Ionicons name="pricetag-outline" size={16} color="#F59E0B" />
            <Text style={[styles.metricTitle, { color: colors.textSecondary }]}>
              {isAr ? 'التكلفة الصافية الفعلية' : 'Effective Net Cost'}
            </Text>
          </View>
          <Text style={[styles.metricBigVal, { color: '#F59E0B' }]}>
            {calculation.effectivePricePercent}%
          </Text>
          <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
            {isAr
              ? (calculation.effectivePricePercent <= 50 ? '🎉 اشتريتها بأقل من نصف ثمنها!' : 'من سعر الكاش الأصلي')
              : 'of original cash price'}
          </Text>
        </View>
      </View>

      {/* Side by Side Comparison Visual Card */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="git-compare-outline" size={18} color="#8B5CF6" />
          <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>
            {isAr ? 'مقارنة السيناريوهين بعد انتهاء المدة' : 'Scenario Comparison at End of Term'}
          </Text>
        </View>

        {/* Scenario 1: Paying Cash */}
        <View style={[styles.scenarioRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.scenarioLeft}>
            <View style={[styles.scenarioDot, { backgroundColor: '#EF4444' }]} />
            <View>
              <Text style={[styles.scenarioTitle, { color: colors.text }]}>
                {isAr ? 'المسار أ: الدفع كاش فوراً' : 'Path A: Pay Cash Upfront'}
              </Text>
              <Text style={[styles.scenarioSub, { color: colors.textSecondary }]}>
                {isAr ? 'خروج السيولة بالكامل فوراً وتوقف نموها' : 'Total cash drain upfront, zero growth'}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.scenarioVal, { color: '#EF4444' }]}>
              -{formatCurrency(cashPrice)} {currency}
            </Text>
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
              {isAr ? 'المتبقي معك: 0 ج.م' : 'Remaining cash: 0'}
            </Text>
          </View>
        </View>

        {/* Scenario 2: Smart Financing + Investing */}
        <View style={[styles.scenarioRow, { backgroundColor: colors.background, borderColor: '#8B5CF6' }]}>
          <View style={styles.scenarioLeft}>
            <View style={[styles.scenarioDot, { backgroundColor: '#10B981' }]} />
            <View>
              <Text style={[styles.scenarioTitle, { color: colors.text }]}>
                {isAr ? 'المسار ب: التقسيط مع الاستثمار (بيزنساوي)' : 'Path B: Smart Financing + Investing'}
              </Text>
              <Text style={[styles.scenarioSub, { color: colors.textSecondary }]}>
                {isAr ? 'أصل المال محفوظ والعائد يسدد القسط' : 'Principal preserved, yields pay debt'}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.scenarioVal, { color: '#10B981' }]}>
              +{formatCurrency(calculation.investableAmount)} {currency}
            </Text>
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: '#10B981' }}>
              {isAr ? 'رأس مالك لا زال في جيبك!' : 'Principal still with you!'}
            </Text>
          </View>
        </View>
      </View>

      {/* Accordion Explaining the concept */}
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
            {isAr ? '💡 كيف تعمل هذه الاستراتيجية؟ ومتى تطبقها؟' : '💡 How does this strategy work?'}
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
              ? `1️⃣ تكلفة الفرصة البديلة (Opportunity Cost): عندما تشتري كاش في بيئة ذات فائدة وتضخم مرتفع، فإنك تضحي بالأرباح التي كان من الممكن أن يولدها رأس مالك شهرياً.\n\n` +
                `2️⃣ سداد القسط من الأرباح (Yield-funded): بوضع ثمن السلعة في شهادات أو أذون خزانة، يقوم البنك بدفع أرباح شهرية لك، وتلك الأرباح تسدد الجزء الأكبر من قسطك الشهري.\n\n` +
                `3️⃣ التضخم لصالحك: بعد مرور سنتين أو 3 سنوات، القسط الثابت بالجنيه تقل قيمته الشرائية بفعل التضخم، بينما أصل مالك وأرباحك ظلت تنمو.\n\n` +
                `⚠️ شروط الأمان المالي: هذه الخطة تشترط أن يكون لديك ثمن السلعة بالفعل ولا تخاطر به في استثمارات مجهولة، بل في أوعية آمنة (شهادات/أذون/صناديق نقدية) مع التزامك بالانضباط بعدم سحب رأس المال.`
              : `1️⃣ Opportunity Cost: Paying cash destroys the monthly returns your capital could generate.\n\n` +
                `2️⃣ Yield-funded debt: High-yield CDs or T-bills generate monthly interest that pays the majority of your installment.\n\n` +
                `3️⃣ Inflation leverage: Fixed installment burdens decrease in real value over time, while your invested capital remains yours.\n\n` +
                `⚠️ Safety First: This strategy requires having the liquidity upfront and placing it strictly into low-risk, guaranteed yield vehicles.`}
          </Text>
        </View>
      )}

      {/* Action Button: Save as Plan into Mizan */}
      <Pressable
        onPress={handleSaveToInstallments}
        disabled={isSaving}
        style={({ pressed }) => [
          styles.actionBtn,
          { backgroundColor: '#8B5CF6' },
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
      >
        <Ionicons name="add-circle-outline" size={20} color="#FFF" style={{ marginHorizontal: 6 }} />
        <Text style={styles.actionBtnText}>
          {isSaving
            ? (isAr ? 'جاري الحفظ...' : 'Saving...')
            : (isAr ? 'اعتماد الخطة وحفظها كقسط في ميزان 🚀' : 'Save Plan as Active Installment 🚀')}
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
    fontSize: 15,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metricTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  metricBigVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    marginBottom: 2,
  },
  metricSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
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
    shadowColor: '#8B5CF6',
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
