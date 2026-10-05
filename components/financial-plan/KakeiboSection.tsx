import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { formatCurrency } from '@/lib/categories';
import { FinancialPlan } from '@/lib/planStorage';

interface KakeiboPillarSpending {
  survival: number;
  wants: number;
  culture: number;
  extra: number;
}

interface KakeiboSectionProps {
  plan: FinancialPlan;
  spentByPillar: KakeiboPillarSpending;
  totalIncome: number;
  sym: string;
  language: string;
  colors: any;
  selectedEmojiMood: string;
  setSelectedEmojiMood: (emoji: string) => void;
  selectedQuickActions: string[];
  setSelectedQuickActions: React.Dispatch<React.SetStateAction<string[]>>;
  refQ4: string;
  setRefQ4: (val: string) => void;
  onOpenKakeiboBudgetModal: () => void;
  onSaveKakeiboReflection: () => void;
  onApplyKakeiboRebalance: (excess: number, pillarId: string) => void;
}

// Japanese Financial Wisdom Quotes
const ZEN_PROVERBS = [
  {
    kanji: '塵も積もれば山となる',
    romaji: 'Chiri mo tsumoreba yama to naru',
    ar: 'حبات الغبار تصنع جبلاً شامخاً.. كل قرش تدخره اليوم يبني حريتك غداً.',
    en: 'Even dust, when piled up, becomes a mountain. Every coin saved builds your freedom.',
  },
  {
    kanji: '知足安分',
    romaji: 'Chisoku Anbun',
    ar: 'الرضا بما تملك سلام باطن.. الإنفاق بوعي يحميك من فخ الرغبات المؤقتة.',
    en: 'Contentment brings peace. Mindful spending protects you from fleeting impulses.',
  },
  {
    kanji: '改善',
    romaji: 'Kaizen',
    ar: 'التحسين المستمر يبدأ بخطوة صغيرة.. اضبط عاداتك اليوم تكسب غداً.',
    en: 'Continuous improvement begins with one small step. Refine your daily habits.',
  },
  {
    kanji: '腹八分目',
    romaji: 'Hara Hachi Bun Me',
    ar: 'لا تستهلك كل طاقتك.. اترك دائماً 20% في جيبك للأمان والطمأنينة.',
    en: 'Do not consume everything. Keep a 20% cushion for peace and resilience.',
  },
];

export const KakeiboSection: React.FC<KakeiboSectionProps> = ({
  plan,
  spentByPillar,
  totalIncome,
  sym,
  language,
  colors,
  selectedEmojiMood,
  setSelectedEmojiMood,
  selectedQuickActions,
  setSelectedQuickActions,
  refQ4,
  setRefQ4,
  onOpenKakeiboBudgetModal,
  onSaveKakeiboReflection,
  onApplyKakeiboRebalance,
}) => {
  const isAr = language === 'ar';
  const isMl = language === 'ml' || language === 'hi';
  const [showHistory, setShowHistory] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);

  const loc = (ar: string, en: string, ml?: string) => {
    if (isMl) return ml || en;
    if (isAr) return ar;
    return en;
  };

  const currentQuote = ZEN_PROVERBS[quoteIdx % ZEN_PROVERBS.length];

  const handleNextQuote = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuoteIdx((prev) => (prev + 1) % ZEN_PROVERBS.length);
  };

  const kbSurvival = plan.kakeiboBudgets?.survival || 0;
  const kbWants = plan.kakeiboBudgets?.wants || 0;
  const kbCulture = plan.kakeiboBudgets?.culture || 0;
  const kbExtra = plan.kakeiboBudgets?.extra || 0;

  const totalBudget = kbSurvival + kbWants + kbCulture + kbExtra;
  const totalKakeiboSpent =
    spentByPillar.survival + spentByPillar.wants + spentByPillar.culture + spentByPillar.extra;

  // Compute realistic effective planned income
  const basePlannedIncome =
    (plan.monthlyIncome && plan.monthlyIncome > 0)
      ? plan.monthlyIncome
      : (totalIncome > 0 ? totalIncome : totalBudget);

  const projectedNet = Math.max(0, basePlannedIncome - totalBudget);
  const remainingBudget = Math.max(0, totalBudget - totalKakeiboSpent);

  // The 4 Sacred Washi Pillars with Japanese Kanji & Philosophy
  const pillars = [
    {
      id: 'survival',
      kanji: '生活',
      kanjiReading: 'Seikatsu',
      nameAr: 'نبض الحياة (الأساسيات)',
      nameEn: 'Vital Survival',
      nameMl: 'അടിസ്ഥാനം (Needs)',
      descAr: 'الطعام، السكن، الفواتير والصحة',
      descEn: 'Food, housing, bills & health',
      icon: 'restaurant-outline',
      color: '#10B981', // Bamboo Emerald
      spent: spentByPillar.survival,
      budget: kbSurvival,
    },
    {
      id: 'wants',
      kanji: '希望',
      kanjiReading: 'Kibou',
      nameAr: 'بهجة النفس (الرغبات)',
      nameEn: 'Soul & Wants',
      nameMl: 'ആഗ്രഹങ്ങൾ (Wants)',
      descAr: 'الترفيه، المقاهي، التسوق المبهج',
      descEn: 'Leisure, dining out, personal joy',
      icon: 'heart-outline',
      color: '#F43F5E', // Sakura Coral
      spent: spentByPillar.wants,
      budget: kbWants,
    },
    {
      id: 'culture',
      kanji: '教養',
      kanjiReading: 'Kyōyō',
      nameAr: 'غذاء العقل (الثقافة)',
      nameEn: 'Mind & Culture',
      nameMl: 'സംസ്കാരം (Culture)',
      descAr: 'الكتب، الدورات والارتقاء الذاتي',
      descEn: 'Books, courses & personal growth',
      icon: 'book-outline',
      color: '#6366F1', // Indigo Wisdom
      spent: spentByPillar.culture,
      budget: kbCulture,
    },
    {
      id: 'extra',
      kanji: '特別',
      kanjiReading: 'Tokubetsu',
      nameAr: 'أمان الطوارئ (المفاجآت)',
      nameEn: 'Extra & Buffer',
      nameMl: 'അപ്രതീക്ഷിതം (Extra)',
      descAr: 'المناسبات، الهدايا والإصلاحات',
      descEn: 'Gifts, sudden repairs & buffer',
      icon: 'shield-checkmark-outline',
      color: '#F59E0B', // Amber Flame
      spent: spentByPillar.extra,
      budget: kbExtra,
    },
  ];

  const survivalRatio = totalKakeiboSpent > 0 ? spentByPillar.survival / totalKakeiboSpent : 0;
  const wantsRatio = totalKakeiboSpent > 0 ? spentByPillar.wants / totalKakeiboSpent : 0;
  const cultureRatio = totalKakeiboSpent > 0 ? spentByPillar.culture / totalKakeiboSpent : 0;
  const extraRatio = totalKakeiboSpent > 0 ? spentByPillar.extra / totalKakeiboSpent : 0;

  const wantsPctOfTotal = Math.round(wantsRatio * 100);
  const needsPctOfTotal = Math.round(survivalRatio * 100);

  // Zen Status Aura Determination
  const isOverAnyPillar = pillars.some((p) => p.budget > 0 && p.spent > p.budget);
  let zenAuraStatus = {
    title: loc('🧘‍♂️ حكيم الزن (Zen Master)', '🧘‍♂️ Zen Master Aura', '🧘‍♂️ സെൻ മാസ്റ്റർ'),
    subtitle: loc('انضباط مثالي وهدوء مالي فائق', 'Flawless discipline and serenity', 'മികച്ച അച്ചടക്കം'),
    badgeColor: '#10B981',
    bg: '#10B98115',
    border: '#10B98135',
  };

  if (isOverAnyPillar) {
    zenAuraStatus = {
      title: loc('🌊 يحتاج ضبطاً وتوازناً', '🌊 Needs Centering Flow', '🌊 ബാലൻസ് ചെയ്യുക'),
      subtitle: loc('يوجد ركن تجاوز ميزانيته، أعد الاتزان', 'A pillar exceeded its envelope', 'ഒരു സ്തംഭത്തിൽ ചെലവ് കൂടി'),
      badgeColor: '#F59E0B',
      bg: '#F59E0B15',
      border: '#F59E0B35',
    };
  } else if (wantsPctOfTotal > 28) {
    zenAuraStatus = {
      title: loc('🌸 بهجة مرتفعة (High Wants)', '🌸 High Wants Flow', '🌸 ആഗ്രഹങ്ങൾ കൂടുതൽ'),
      subtitle: loc('الرغبات تتجاوز المعدل المثالي 25%', 'Wants exceed recommended 25%', 'ആഗ്രഹങ്ങൾ 25% കൂടുതൽ'),
      badgeColor: '#F43F5E',
      bg: '#F43F5E15',
      border: '#F43F5E35',
    };
  } else {
    zenAuraStatus = {
      title: loc('🎋 توازن انسيابي (Harmonious Flow)', '🎋 Harmonious Flow', '🎋 സുഗമമായ ഒഴുക്ക്'),
      subtitle: loc('المصاريف تسير بوعي وتناغم متزن', 'Mindful spending in steady flow', 'അച്ചടക്കത്തോടെയുള്ള ചെലവുകൾ'),
      badgeColor: '#6366F1',
      bg: '#6366F115',
      border: '#6366F135',
    };
  }

  // Donut Ring Geometry
  const RING_R = 40;
  const CIRCUMFERENCE = 2 * Math.PI * RING_R;
  const survivalDash = survivalRatio * CIRCUMFERENCE;
  const wantsDash = wantsRatio * CIRCUMFERENCE;
  const cultureDash = cultureRatio * CIRCUMFERENCE;
  const extraDash = extraRatio * CIRCUMFERENCE;

  // Zen Mood States
  const moods = [
    { emoji: '🤩', labelAr: 'فخر وانضباط', labelEn: 'Superb', labelMl: 'മികച്ചത്', aura: '#10B981' },
    { emoji: '🧘‍♂️', labelAr: 'سكينة ورضا', labelEn: 'Centered', labelMl: 'തൃപ്തികരം', aura: '#6366F1' },
    { emoji: '😐', labelAr: 'مستقر وعادي', labelEn: 'Neutral', labelMl: 'ശരാശരി', aura: '#F59E0B' },
    { emoji: '🌪️', labelAr: 'يحتاج كايزن', labelEn: 'Needs Kaizen', labelMl: 'മാറ്റണം', aura: '#EF4444' },
  ];

  // Kaizen 1-Tap Micro-Pledges
  const quickActionOptions = [
    { id: 'coffee_pause', labelAr: '☕ صيام قهوة الكافيهات 3 أيام', labelEn: '☕ 3-Day Café Fast', labelMl: '☕ കാപ്പി ലാഭിക്കുക' },
    { id: 'rule_24h', labelAr: '⏳ قاعدة 24 ساعة للرغبات', labelEn: '⏳ 24h Impulse Rule', labelMl: '⏳ 24 മണിക്കൂർ കാത്തിരിക്കുക' },
    { id: 'cook_home', labelAr: '🍱 يومين طبخ منزلي بدون دليفري', labelEn: '🍱 2 Days Home Bento', labelMl: '🍱 വീട്ടിലെ ഭക്ഷണം' },
    { id: 'cut_subs', labelAr: '✂️ إلغاء اشتراك غير مستخدم', labelEn: '✂️ Cut 1 Unused Sub', labelMl: '✂️ വരിസംഖ്യ നിർത്തുക' },
    { id: 'boost_5pct', labelAr: '💰 توجيه 5% زيادة للادخار', labelEn: '💰 Push +5% to Savings', labelMl: '💰 സമ്പാദ്യം 5% കൂട്ടുക' },
    { id: 'protect_extra', labelAr: '🛡️ حماية ظرف الطوارئ', labelEn: '🛡️ Shield Extra Buffer', labelMl: '🛡️ അടിയന്തര ഫണ്ട് സൂക്ഷിക്കുക' },
  ];

  const toggleAction = (actId: string) => {
    Haptics.selectionAsync();
    if (selectedQuickActions.includes(actId)) {
      setSelectedQuickActions((prev) => prev.filter((a) => a !== actId));
    } else {
      setSelectedQuickActions((prev) => [...prev, actId]);
    }
  };

  const spentPctOfBudget =
    totalBudget > 0 ? Math.min(100, Math.round((totalKakeiboSpent / totalBudget) * 100)) : 0;

  return (
    <View style={{ gap: 14 }}>
      {/* 🌸 1. ZEN WISDOM INSPIRATION BANNER (Clickable Proverb) */}
      <Pressable
        onPress={handleNextQuote}
        style={({ pressed }) => [
          {
            backgroundColor: '#8B5CF612',
            borderRadius: 18,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: '#8B5CF628',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: '#8B5CF620',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18 }}>🎎</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: '#A78BFA' }}>
              {currentQuote.kanji} • {currentQuote.romaji}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="refresh-outline" size={11} color="#A78BFA" />
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: '#A78BFA' }}>
                {loc('حكمة زن', 'Zen Insight', 'സെൻ ചിന്ത')}
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontFamily: 'Cairo_600SemiBold',
              fontSize: 11,
              color: colors.text,
              lineHeight: 17,
              textAlign: isAr ? 'right' : 'left',
            }}
          >
            {isAr ? currentQuote.ar : currentQuote.en}
          </Text>
        </View>
      </Pressable>

      {/* 🏯 2. ZEN MINDFULNESS & HARMONY HUB CARD */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 24,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 14,
        }}
      >
        {/* Hub Header: Zen Aura Status + Quick Edit Envelope Button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: zenAuraStatus.bg,
                borderWidth: 1,
                borderColor: zenAuraStatus.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="leaf-outline" size={18} color={zenAuraStatus.badgeColor} />
            </View>
            <View>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }}>
                {zenAuraStatus.title}
              </Text>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                {zenAuraStatus.subtitle}
              </Text>
            </View>
          </View>

          {/* Edit Budgets Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onOpenKakeiboBudgetModal();
            }}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: colors.surfaceAlt,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <MaterialIcons name="tune" size={13} color={colors.primary} />
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.primary }}>
              {loc('ضبط الأظرف', 'Envelopes', 'മാറ്റുക')}
            </Text>
          </Pressable>
        </View>

        {/* Hub Body: Zen Multi-Color Ring & Flow Metrics */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceAlt + '70',
            borderRadius: 20,
            padding: 14,
            gap: 14,
            borderWidth: 1,
            borderColor: colors.borderLight,
          }}
        >
          {/* Donut Chart */}
          <View style={{ width: 106, height: 106, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Svg width={106} height={106}>
              <Circle cx={53} cy={53} r={RING_R} fill="none" stroke={colors.surfaceAlt} strokeWidth={11} />
              {totalKakeiboSpent > 0 ? (
                <>
                  {survivalDash > 0 && (
                    <Circle
                      cx={53}
                      cy={53}
                      r={RING_R}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth={11}
                      strokeDasharray={`${survivalDash} ${CIRCUMFERENCE}`}
                      strokeDashoffset={0}
                      strokeLinecap="round"
                      transform="rotate(-90 53 53)"
                    />
                  )}
                  {wantsDash > 0 && (
                    <Circle
                      cx={53}
                      cy={53}
                      r={RING_R}
                      fill="none"
                      stroke="#F43F5E"
                      strokeWidth={11}
                      strokeDasharray={`${wantsDash} ${CIRCUMFERENCE}`}
                      strokeDashoffset={-survivalDash}
                      strokeLinecap="round"
                      transform="rotate(-90 53 53)"
                    />
                  )}
                  {cultureDash > 0 && (
                    <Circle
                      cx={53}
                      cy={53}
                      r={RING_R}
                      fill="none"
                      stroke="#6366F1"
                      strokeWidth={11}
                      strokeDasharray={`${cultureDash} ${CIRCUMFERENCE}`}
                      strokeDashoffset={-(survivalDash + wantsDash)}
                      strokeLinecap="round"
                      transform="rotate(-90 53 53)"
                    />
                  )}
                  {extraDash > 0 && (
                    <Circle
                      cx={53}
                      cy={53}
                      r={RING_R}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth={11}
                      strokeDasharray={`${extraDash} ${CIRCUMFERENCE}`}
                      strokeDashoffset={-(survivalDash + wantsDash + cultureDash)}
                      strokeLinecap="round"
                      transform="rotate(-90 53 53)"
                    />
                  )}
                </>
              ) : (
                <Circle
                  cx={53}
                  cy={53}
                  r={RING_R}
                  fill="none"
                  stroke="#10B98130"
                  strokeWidth={11}
                  strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset={0}
                  transform="rotate(-90 53 53)"
                />
              )}
            </Svg>
            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
                {formatCurrency(totalKakeiboSpent)}
              </Text>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: colors.textSecondary }}>
                {totalBudget > 0 ? `${spentPctOfBudget}% ` : ''}{loc('منصرف', 'spent', 'ചെലവ്')}
              </Text>
            </View>
          </View>

          {/* Flow Metrics */}
          <View style={{ flex: 1, gap: 7 }}>
            {/* Total Envelope Budget */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#8B5CF6' }} />
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                  {loc('إجمالي الأظرف:', 'Total Envelopes:', 'ആകെ ബജറ്റ്:')}
                </Text>
              </View>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text }}>
                {formatCurrency(totalBudget)} {sym}
              </Text>
            </View>

            {/* Safe Buffer Left */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                  {loc('المتبقي الآمن:', 'Safe Buffer Left:', 'ബാക്കി തുക:')}
                </Text>
              </View>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: '#10B981' }}>
                {formatCurrency(remainingBudget)} {sym}
              </Text>
            </View>

            {/* Planned Savings Target */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                  {loc('الادخار المخطط:', 'Target Savings:', 'ലക്ഷ്യ സമ്പാദ്യം:')}
                </Text>
              </View>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary }}>
                +{formatCurrency(projectedNet)} {sym}
              </Text>
            </View>
          </View>
        </View>

        {/* Mindful Advice Pill */}
        <View
          style={{
            backgroundColor: wantsPctOfTotal > 25 ? '#F43F5E12' : '#10B98112',
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: wantsPctOfTotal > 25 ? '#F43F5E25' : '#10B98125',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ionicons
            name={wantsPctOfTotal > 25 ? 'alert-circle-outline' : 'sparkles-outline'}
            size={16}
            color={wantsPctOfTotal > 25 ? '#F43F5E' : '#10B981'}
          />
          <Text
            style={{
              flex: 1,
              fontFamily: 'Cairo_600SemiBold',
              fontSize: 10,
              color: wantsPctOfTotal > 25 ? '#F43F5E' : '#10B981',
              textAlign: isAr ? 'right' : 'left',
              lineHeight: 15,
            }}
          >
            {wantsPctOfTotal > 25
              ? loc(
                  `تشكل الرغبات ${wantsPctOfTotal}% من المصروف (المثالي ≤ 25%). جرّب قاعدة الـ 24 ساعة لحماية ادخارك.`,
                  `Wants take ${wantsPctOfTotal}% of spend (target ≤ 25%). Try the 24h delay rule to shield your savings.`,
                  `ആഗ്രഹങ്ങൾ ${wantsPctOfTotal}% ആണ്. അനാവശ്യ വാങ്ങലുകൾ മാറ്റിവെക്കുക.`
                )
              : loc(
                  `رائع! إنفاقك في حالة تناغم وسكينة. الرغبات تشكل ${wantsPctOfTotal}% فقط من المصروف.`,
                  `Serene harmony! Your wants represent only ${wantsPctOfTotal}% of total spend.`,
                  `മികച്ച ബാലൻസ്! ആഗ്രഹങ്ങൾ ${wantsPctOfTotal}% മാത്രമാണ്.`
                )}
          </Text>
        </View>
      </View>

      {/* 🏮 3. THE 4 SACRED WASHI ENVELOPES (الأركان الأربعة) */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 24,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                backgroundColor: colors.primary + '18',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="folder-open-outline" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
                {loc('أظرف الكاكيبو الأربعة (Washi Envelopes)', 'The 4 Kakeibo Envelopes', '4 കാകെയ്ബോ കവറുകൾ')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                {loc('ميزانية كل ظرف مقابل المنصرف الفعلي', 'Budget vs Actual Spending', 'ബജറ്റും ചെലവും')}
              </Text>
            </View>
          </View>
        </View>

        {/* 2x2 Japanese Envelope Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {pillars.map((p) => {
            const pct = p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
            const isOver = p.budget > 0 && p.spent > p.budget;
            const remainingPillar = Math.max(0, p.budget - p.spent);

            return (
              <View
                key={p.id}
                style={{
                  width: '48.4%',
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 18,
                  padding: 12,
                  borderWidth: 1.5,
                  borderColor: isOver ? colors.expense : p.color + '30',
                  gap: 8,
                  justifyContent: 'space-between',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Kanji Watermark Accent in the Corner */}
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 8,
                    opacity: 0.12,
                  }}
                  pointerEvents="none"
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 24, color: p.color }}>
                    {p.kanji}
                  </Text>
                </View>

                {/* Pillar Header: Icon + Kanji Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        backgroundColor: p.color + '22',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={p.icon as any} size={14} color={p.color} />
                    </View>
                    <View
                      style={{
                        backgroundColor: p.color + '18',
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        borderRadius: 5,
                      }}
                    >
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 9, color: p.color }}>
                        {p.kanji}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      fontFamily: 'Cairo_700Bold',
                      fontSize: 12,
                      color: isOver ? colors.expense : colors.text,
                    }}
                  >
                    {formatCurrency(p.spent)}
                  </Text>
                </View>

                {/* Titles */}
                <View>
                  <Text
                    style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.text }}
                    numberOfLines={1}
                  >
                    {isMl ? p.nameMl : isAr ? p.nameAr : p.nameEn}
                  </Text>
                  <Text
                    style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary }}
                    numberOfLines={1}
                  >
                    {isAr ? p.descAr : p.descEn}
                  </Text>
                </View>

                {/* Smooth Progress Bar */}
                <View style={{ gap: 4 }}>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: colors.surface,
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.min(100, pct)}%`,
                        backgroundColor: isOver ? colors.expense : p.color,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: colors.textSecondary }}>
                      {loc(`الميزانية: ${formatCurrency(p.budget)}`, `Budget: ${formatCurrency(p.budget)}`, `ബജറ്റ്: ${formatCurrency(p.budget)}`)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Cairo_700Bold',
                        fontSize: 9,
                        color: isOver ? colors.expense : '#10B981',
                      }}
                    >
                      {isOver
                        ? `+${formatCurrency(p.spent - p.budget)}`
                        : `${formatCurrency(remainingPillar)} ${loc('متبقي', 'left', 'ബാക്കി')}`}
                    </Text>
                  </View>
                </View>

                {/* Overrun 1-Tap Rebalance Button */}
                {isOver && (
                  <Pressable
                    onPress={() => onApplyKakeiboRebalance(p.spent - p.budget, p.id)}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.expense + '20',
                        borderRadius: 8,
                        paddingVertical: 5,
                        paddingHorizontal: 6,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: colors.expense + '40',
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: colors.expense }}>
                      {loc('⚖️ إعادة اتزان فوري', '⚖️ Rebalance Envelope', '⚖️ റീബാലൻസ്')}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* 🍵 4. ZEN REFLECTION CEREMONY & KAIZEN HABITS (طقس التأمل والتحسين) */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 24,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: '#F59E0B18',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16 }}>🍵</Text>
            </View>
            <View>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
                {loc('طقس التأمل المالي وتطوير الذات (Kaizen)', 'Zen Mindful Reflection (Kaizen)', 'സെൻ സാമ്പത്തിക ധ്യാനം')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                {loc('محاسبة النفس الهادئة وبناء عادات واعية', 'Weekly calm review & conscious habits', 'ശാന്തമായ ചിന്തകൾ')}
              </Text>
            </View>
          </View>

          {plan.kakeiboReflections && plan.kakeiboReflections.length > 0 && (
            <Pressable
              onPress={() => setShowHistory(!showHistory)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.surfaceAlt,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: colors.primary }}>
                {loc(`الأرشيف (${plan.kakeiboReflections.length})`, `Archive (${plan.kakeiboReflections.length})`, `ചരിത്രം (${plan.kakeiboReflections.length})`)}
              </Text>
              <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={12} color={colors.primary} />
            </Pressable>
          )}
        </View>

        {/* 1. Zen Discipline & Mood Selector */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.textSecondary, textAlign: isAr ? 'right' : 'left' }}>
            {loc('1. كيف تشعر تجاه سكينة انضباطك المالي؟', '1. How centered was your financial discipline?', '1. സാമ്പത്തിക അച്ചടക്കം എങ്ങനെ?')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {moods.map((m) => {
              const isSelected = selectedEmojiMood === m.emoji;
              return (
                <Pressable
                  key={m.emoji}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedEmojiMood(m.emoji);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: isSelected ? m.aura + '20' : colors.surfaceAlt,
                    borderColor: isSelected ? m.aura : colors.borderLight,
                    borderWidth: 1.5,
                    borderRadius: 14,
                    paddingVertical: 10,
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                  <Text
                    style={{
                      fontFamily: 'Cairo_700Bold',
                      fontSize: 9,
                      color: isSelected ? m.aura : colors.textSecondary,
                    }}
                  >
                    {isMl ? m.labelMl : isAr ? m.labelAr : m.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 2. Kaizen 1-Tap Micro-Pledges */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.textSecondary, textAlign: isAr ? 'right' : 'left' }}>
              {loc('2. عهود «كايزن» الصغيرة للشهر القادم:', '2. Kaizen Micro-Pledges for next month:', '2. അടുത്ത മാസത്തേക്കുള്ള മാറ്റങ്ങൾ:')}
            </Text>
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.primary }}>
              {loc('اختر ما يناسبك', 'Select any', 'തിരഞ്ഞെടുക്കുക')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {quickActionOptions.map((opt) => {
              const isSelected = selectedQuickActions.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => toggleAction(opt.id)}
                  style={{
                    backgroundColor: isSelected ? '#8B5CF622' : colors.surfaceAlt,
                    borderColor: isSelected ? '#8B5CF6' : colors.borderLight,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Cairo_700Bold',
                      fontSize: 10,
                      color: isSelected ? '#A78BFA' : colors.text,
                    }}
                  >
                    {isMl ? opt.labelMl : isAr ? opt.labelAr : opt.labelEn}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={13} color="#A78BFA" />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 3. Mindful Personal Notes Input */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.textSecondary, textAlign: isAr ? 'right' : 'left' }}>
            {loc('3. ومضة أو هدف شخصي تود تذكره (اختياري):', '3. A mindful note or goal to remember:', '3. ഓർക്കാനുള്ള കുറിപ്പ്:')}
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.borderLight,
              padding: 12,
              color: colors.text,
              fontFamily: 'Cairo_400Regular',
              fontSize: 11,
              minHeight: 44,
              textAlign: isAr ? 'right' : 'left',
            }}
            placeholder={loc(
              'مثال: سألتزم بظرف القهوة، وسأشتري كتاباً استثمارياً جديداً...',
              'E.g. Will stick to the coffee envelope, invest in a new book...',
              'വ്യക്തിഗത കുറിപ്പുകൾ...'
            )}
            placeholderTextColor={colors.textSecondary}
            value={refQ4}
            onChangeText={setRefQ4}
          />
        </View>

        {/* 4. Zen Save Reflection Button */}
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSaveKakeiboReflection();
          }}
          style={({ pressed }) => [
            {
              backgroundColor: '#8B5CF6',
              borderRadius: 14,
              height: 44,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#8B5CF6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            },
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          <Ionicons name="bookmark-outline" size={16} color="#FFF" />
          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#FFF' }}>
            {loc('اعتماد طقس التأمل والقرارات ⛩️', 'Seal Zen Reflection ⛩️', 'ചിന്തകൾ ഉറപ്പിക്കുക ⛩️')}
          </Text>
        </Pressable>

        {/* Collapsible Saved Reflections Archive */}
        {showHistory && plan.kakeiboReflections && plan.kakeiboReflections.length > 0 && (
          <View
            style={{
              gap: 8,
              marginTop: 4,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: colors.borderLight,
            }}
          >
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.textSecondary, textAlign: isAr ? 'right' : 'left' }}>
              {loc('📜 أرشيف طقوس التأمل السابقة:', '📜 Previous Zen Reflection Logs:', '📜 മുൻകാല ചിന്തകൾ:')}
            </Text>
            {plan.kakeiboReflections.map((ref, rIdx) => (
              <View
                key={rIdx}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 14,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{ref.emojiMood || '🧘‍♂️'}</Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text }}>
                      {ref.monthKey}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 9, color: '#10B981' }}>
                      {loc('معتمد ⛩️', 'Sealed ⛩️', 'ഉറപ്പിച്ചു ⛩️')}
                    </Text>
                  </View>
                </View>

                {ref.quickActions && ref.quickActions.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {ref.quickActions.map((actId) => {
                      const actObj = quickActionOptions.find((o) => o.id === actId);
                      return (
                        <View
                          key={actId}
                          style={{
                            backgroundColor: '#8B5CF618',
                            borderRadius: 6,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderWidth: 1,
                            borderColor: '#8B5CF630',
                          }}
                        >
                          <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: '#A78BFA' }}>
                            {actObj ? (isMl ? actObj.labelMl : isAr ? actObj.labelAr : actObj.labelEn) : actId}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {ref.q4 ? (
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' }}>
                    {`"${ref.q4}"`}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};
