import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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

  const loc = (ar: string, en: string, ml?: string) => {
    if (isMl) return ml || en;
    if (isAr) return ar;
    return en;
  };

  const kbSurvival = plan.kakeiboBudgets?.survival || 0;
  const kbWants = plan.kakeiboBudgets?.wants || 0;
  const kbCulture = plan.kakeiboBudgets?.culture || 0;
  const kbExtra = plan.kakeiboBudgets?.extra || 0;

  const totalBudget = kbSurvival + kbWants + kbCulture + kbExtra;
  const totalKakeiboSpent =
    spentByPillar.survival + spentByPillar.wants + spentByPillar.culture + spentByPillar.extra;
  const projectedNet = totalIncome - totalBudget;
  const remainingBudget = Math.max(0, totalBudget - totalKakeiboSpent);

  const pillars = [
    {
      id: 'survival',
      nameAr: 'الأساسيات (Survival)',
      nameEn: 'Survival / Needs',
      nameMl: 'അടിസ്ഥാനം (Needs)',
      icon: 'restaurant',
      color: '#10B981',
      spent: spentByPillar.survival,
      budget: kbSurvival,
    },
    {
      id: 'wants',
      nameAr: 'الرغبات (Wants)',
      nameEn: 'Wants / Optional',
      nameMl: 'ആഗ്രഹങ്ങൾ (Wants)',
      icon: 'shopping-bag',
      color: '#F59E0B',
      spent: spentByPillar.wants,
      budget: kbWants,
    },
    {
      id: 'culture',
      nameAr: 'الثقافة (Culture)',
      nameEn: 'Culture & Mind',
      nameMl: 'സംസ്കാരം (Culture)',
      icon: 'book',
      color: '#6366F1',
      spent: spentByPillar.culture,
      budget: kbCulture,
    },
    {
      id: 'extra',
      nameAr: 'الطوارئ (Extra)',
      nameEn: 'Extra / Unplanned',
      nameMl: 'അപ്രതീക്ഷിതം (Extra)',
      icon: 'more-horiz',
      color: '#EF4444',
      spent: spentByPillar.extra,
      budget: kbExtra,
    },
  ];

  const survivalRatio = totalKakeiboSpent > 0 ? (spentByPillar.survival / totalKakeiboSpent) : 0;
  const wantsRatio = totalKakeiboSpent > 0 ? (spentByPillar.wants / totalKakeiboSpent) : 0;
  const cultureRatio = totalKakeiboSpent > 0 ? (spentByPillar.culture / totalKakeiboSpent) : 0;
  const extraRatio = totalKakeiboSpent > 0 ? (spentByPillar.extra / totalKakeiboSpent) : 0;

  const wantsPctOfTotal = Math.round(wantsRatio * 100);
  const needsPctOfTotal = Math.round(survivalRatio * 100);
  const isMindfulBalanced = wantsPctOfTotal <= 25 && needsPctOfTotal <= 65;

  // Donut Ring Geometry
  const RING_R = 40;
  const CIRCUMFERENCE = 2 * Math.PI * RING_R;
  const survivalDash = survivalRatio * CIRCUMFERENCE;
  const wantsDash = wantsRatio * CIRCUMFERENCE;
  const cultureDash = cultureRatio * CIRCUMFERENCE;
  const extraDash = extraRatio * CIRCUMFERENCE;

  const moods = [
    { emoji: '🤩', labelAr: 'ممتازة', labelEn: 'Superb', labelMl: 'മികച്ചത്' },
    { emoji: '😊', labelAr: 'مستقرة', labelEn: 'Satisfied', labelMl: 'തൃപ്തികരം' },
    { emoji: '😐', labelAr: 'متوسطة', labelEn: 'Neutral', labelMl: 'ശരാശരി' },
    { emoji: '😓', labelAr: 'تحتاج تحسين', labelEn: 'Needs Work', labelMl: 'മെച്ചപ്പെടുത്തണം' },
  ];

  const quickActionOptions = [
    { id: 'cut_subs', labelAr: '✂️ إلغاء اشتراكات', labelEn: '✂️ Cancel subs', labelMl: '✂️ വരിസംഖ്യകൾ റദ്ദാക്കുക' },
    { id: 'reduce_delivery', labelAr: '🍳 تقليل طلبات المطاعم', labelEn: '🍳 Cut dining out', labelMl: '🍳 പുറത്തുനിന്നുള്ള ഭക്ഷണം' },
    { id: 'save_gas', labelAr: '⛽ ترشيد المواصلات', labelEn: '⛽ Save on fuel/rides', labelMl: '⛽ ഇന്ധനം ലാഭിക്കുക' },
    { id: 'boost_saving', labelAr: '💰 زيادة الادخار 5%', labelEn: '💰 Boost savings 5%', labelMl: '💰 സമ്പാദ്യം 5% കൂട്ടുക' },
    { id: 'delay_wants', labelAr: '🎁 منع الشراء العاطفي', labelEn: '🎁 Pause impulse buys', labelMl: '🎁 അനാവശ്യ വാങ്ങൽ' },
  ];

  const toggleAction = (actId: string) => {
    Haptics.selectionAsync();
    if (selectedQuickActions.includes(actId)) {
      setSelectedQuickActions(prev => prev.filter(a => a !== actId));
    } else {
      setSelectedQuickActions(prev => [...prev, actId]);
    }
  };

  const spentPctOfBudget = totalBudget > 0 ? Math.min(100, Math.round((totalKakeiboSpent / totalBudget) * 100)) : 0;

  return (
    <View style={{ gap: 14 }}>
      {/* 1. SMART MINDFULNESS & 4-PILLAR HUB CARD */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 14,
        }}
      >
        {/* Hub Header: Title + Status + Quick Edit Button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#8B5CF618', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={17} color="#8B5CF6" />
            </View>
            <View>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }}>
                {loc('دائرة الوعي وتوزيع الميزانية', 'Mindfulness & Budget Hub', 'സാമ്പത്തിക അവബോധ ചക്രം')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
                {loc('منهجية Kakeibo اليابانية الذكية', 'Smart Japanese Kakeibo Method', 'ജാപ്പനീസ് കാകെയ്ബോ രീതി')}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                backgroundColor: isMindfulBalanced ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isMindfulBalanced ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
              }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: isMindfulBalanced ? '#10B981' : '#F59E0B' }}>
                {isMindfulBalanced ? loc('🟢 متزن', '🟢 Balanced', '🟢 സമതുലിതം') : loc('🟡 مراجعة', '🟡 Review', '🟡 പരിശോധിക്കുക')}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenKakeiboBudgetModal();
              }}
              style={({ pressed }) => [{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.surfaceAlt,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="edit" size={12} color={colors.primary} />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: colors.primary }}>
                {loc('تعديل ✏️', 'Edit ✏️', 'മാറ്റുക ✏️')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Hub Body: Multi-Color Donut Ring + Pulse Indicators */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceAlt + '60',
          borderRadius: 18,
          padding: 12,
          gap: 14,
          borderWidth: 1,
          borderColor: colors.borderLight,
        }}>
          {/* Donut Chart */}
          <View style={{ width: 104, height: 104, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Svg width={104} height={104}>
              <Circle cx={52} cy={52} r={RING_R} fill="none" stroke={colors.surfaceAlt} strokeWidth={11} />
              {totalKakeiboSpent > 0 && (
                <>
                  {survivalDash > 0 && (
                    <Circle
                      cx={52}
                      cy={52}
                      r={RING_R}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth={11}
                      strokeDasharray={`${survivalDash} ${CIRCUMFERENCE}`}
                      strokeDashoffset={0}
                      strokeLinecap="round"
                      transform="rotate(-90 52 52)"
                    />
                  )}
                  {wantsDash > 0 && (
                    <Circle
                      cx={52}
                      cy={52}
                      r={RING_R}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth={11}
                      strokeDasharray={`${wantsDash} ${CIRCUMFERENCE}`}
                      strokeDashoffset={-survivalDash}
                      strokeLinecap="round"
                      transform="rotate(-90 52 52)"
                    />
                  )}
                  {cultureDash > 0 && (
                    <Circle
                      cx={52}
                      cy={52}
                      r={RING_R}
                      fill="none"
                      stroke="#6366F1"
                      strokeWidth={11}
                      strokeDasharray={`${cultureDash} ${CIRCUMFERENCE}`}
                      strokeDashoffset={-(survivalDash + wantsDash)}
                      strokeLinecap="round"
                      transform="rotate(-90 52 52)"
                    />
                  )}
                  {extraDash > 0 && (
                    <Circle
                      cx={52}
                      cy={52}
                      r={RING_R}
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth={11}
                      strokeDasharray={`${extraDash} ${CIRCUMFERENCE}`}
                      strokeDashoffset={-(survivalDash + wantsDash + cultureDash)}
                      strokeLinecap="round"
                      transform="rotate(-90 52 52)"
                    />
                  )}
                </>
              )}
            </Svg>
            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
                {formatCurrency(totalKakeiboSpent)}
              </Text>
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: colors.textSecondary }}>
                {spentPctOfBudget}% {loc('مستهلك', 'spent', 'ചെലവ്')}
              </Text>
            </View>
          </View>

          {/* Hub Summary Pulse Metrics */}
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
                {loc('الميزانية المحددة:', 'Kakeibo Budget:', 'ആകെ ബജറ്റ്:')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text }}>
                {formatCurrency(totalBudget)} {sym}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
                {loc('المتبقي من الميزانية:', 'Remaining Budget:', 'ബാക്കി തുക:')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: remainingBudget > 0 ? '#10B981' : colors.expense }}>
                {formatCurrency(remainingBudget)} {sym}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
                {loc('الادخار المتوقع:', 'Projected Savings:', 'പ്രതീക്ഷിത സമ്പാദ്യം:')}
              </Text>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: projectedNet >= 0 ? colors.primary : colors.expense }}>
                {formatCurrency(projectedNet)} {sym}
              </Text>
            </View>
          </View>
        </View>

        {/* Insight Badge Footer */}
        <View style={{
          backgroundColor: wantsPctOfTotal > 25 ? '#F59E0B15' : '#10B98115',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: wantsPctOfTotal > 25 ? '#F59E0B30' : '#10B98130',
        }}>
          <Text style={{
            fontFamily: 'Cairo_600SemiBold',
            fontSize: 11,
            color: wantsPctOfTotal > 25 ? '#F59E0B' : '#10B981',
            textAlign: 'left',
            lineHeight: 16,
          }}>
            {wantsPctOfTotal > 25
              ? loc(
                  `⚠️ تشكل الرغبات الترفيهية ${wantsPctOfTotal}% من المصاريف (المعدل المثالي ≤ 25%). ينصح بتأجيل الشراء العاطفي لحماية ادخارك.`,
                  `⚠️ Wants represent ${wantsPctOfTotal}% of total spending (recommended ≤ 25%). Try pausing impulse buys.`,
                  `⚠️ ആഗ്രഹങ്ങൾ ചെലവിന്റെ ${wantsPctOfTotal}% ആണ് (ശുപാർശ ചെയ്യുന്നത് ≤ 25%). അനാവശ്യ വാങ്ങലുകൾ മാറ്റിവെക്കുക.`
                )
              : loc(
                  `🟢 رائع! ميزانيتك متزنة بانضباط عالي، تشكل الرغبات ${wantsPctOfTotal}% فقط من الإنفاق.`,
                  `🟢 Great! Your spending is well balanced. Wants represent only ${wantsPctOfTotal}% of total spend.`,
                  `🟢 മികച്ചത്! നിങ്ങളുടെ ബജറ്റ് സമതുലിതമാണ്. ആഗ്രഹങ്ങൾ ${wantsPctOfTotal}% മാത്രമാണ്.`
                )}
          </Text>
        </View>
      </View>

      {/* 2. THE 4 PILLARS IN A SMART 2x2 INTERACTIVE GRID */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="grid-outline" size={15} color={colors.primary} />
            </View>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
              {loc('الأعمدة الأربعة (Kakeibo Pillars)', 'The 4 Kakeibo Pillars', '4 സ്തംഭങ്ങൾ')}
            </Text>
          </View>
          <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
            {loc('توزيع الميزانية والمنصرف', 'Budget vs Actual', 'ബജറ്റും ചെലവും')}
          </Text>
        </View>

        {/* 2x2 Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {pillars.map((p) => {
            const pct = p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
            const isOver = p.spent > p.budget;
            const remainingPillar = Math.max(0, p.budget - p.spent);

            return (
              <View
                key={p.id}
                style={{
                  width: '48.4%',
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: isOver ? colors.expense : colors.borderLight,
                  gap: 6,
                  justifyContent: 'space-between',
                }}
              >
                {/* Pillar Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: p.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name={p.icon as any} size={14} color={p.color} />
                    </View>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.text }} numberOfLines={1}>
                      {isMl ? p.nameMl.split(' ')[0] : isAr ? p.nameAr.split(' ')[0] : p.nameEn.split(' ')[0]}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: isOver ? colors.expense : colors.text }}>
                    {formatCurrency(p.spent)}
                  </Text>
                </View>

                {/* Subtitle Budget */}
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary }}>
                  {loc(`الميزانية: ${formatCurrency(p.budget)} ${sym}`, `Budget: ${formatCurrency(p.budget)} ${sym}`, `ബജറ്റ്: ${formatCurrency(p.budget)}`)}
                </Text>

                {/* Mini Progress Bar */}
                <View style={{ height: 5, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: isOver ? colors.expense : p.color,
                      borderRadius: 3,
                    }}
                  />
                </View>

                {/* Footer Metrics */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: isOver ? colors.expense : colors.textSecondary }}>
                    {pct}%
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: isOver ? colors.expense : '#10B981' }}>
                    {isOver
                      ? loc(`+${formatCurrency(p.spent - p.budget)}`, `+${formatCurrency(p.spent - p.budget)}`, `+${formatCurrency(p.spent - p.budget)}`)
                      : loc(`${formatCurrency(remainingPillar)} متبقي`, `${formatCurrency(remainingPillar)} left`, `${formatCurrency(remainingPillar)} ബാക്കി`)}
                  </Text>
                </View>

                {/* Overrun 1-Tap Rebalance */}
                {isOver && (
                  <Pressable
                    onPress={() => onApplyKakeiboRebalance(p.spent - p.budget, p.id)}
                    style={({ pressed }) => [{
                      backgroundColor: colors.expense + '20',
                      borderRadius: 8,
                      paddingVertical: 4,
                      paddingHorizontal: 6,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: colors.expense + '40',
                      marginTop: 2,
                    }, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 9, color: colors.expense }}>
                      {loc('⚖️ إعادة توازن', '⚖️ Rebalance', '⚖️ റീബാലൻസ്')}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* 3. INTERACTIVE MINDFUL JOURNALING & SMART ACTIONS */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="border-color" size={15} color="#F59E0B" />
            </View>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
              {loc('التأمل المالي والقرارات الذكية', 'Mindful Journaling & Decisions', 'സാമ്പത്തിക ചിന്തകളും തീരുമാനങ്ങളും')}
            </Text>
          </View>

          {plan.kakeiboReflections && plan.kakeiboReflections.length > 0 && (
            <Pressable
              onPress={() => setShowHistory(!showHistory)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.primary }}>
                {loc(`السجل (${plan.kakeiboReflections.length})`, `History (${plan.kakeiboReflections.length})`, `ചരിത്രം (${plan.kakeiboReflections.length})`)}
              </Text>
              <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={12} color={colors.primary} />
            </Pressable>
          )}
        </View>

        {/* Mood Selector Row */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary, textAlign: 'left' }}>
            {loc('كيف تقيّم انضباطك المالي هذا الشهر؟', 'How do you feel about your discipline?', 'സാമ്പത്തിക അച്ചടക്കം എങ്ങനെ?')}
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
                    backgroundColor: isSelected ? colors.primary + '18' : colors.surfaceAlt,
                    borderColor: isSelected ? colors.primary : colors.borderLight,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingVertical: 8,
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{m.emoji}</Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 9, color: isSelected ? colors.primary : colors.textSecondary }}>
                    {isMl ? m.labelMl : isAr ? m.labelAr : m.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 1-Tap Improvement Decision Chips */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary, textAlign: 'left' }}>
            {loc('قرارات التحسين للشهر القادم بنقرة واحدة:', '1-Tap Improvements for next month:', 'അടുത്ത മാസത്തേക്കുള്ള മാറ്റങ്ങൾ:')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {quickActionOptions.map((opt) => {
              const isSelected = selectedQuickActions.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => toggleAction(opt.id)}
                  style={{
                    backgroundColor: isSelected ? colors.accent + '22' : colors.surfaceAlt,
                    borderColor: isSelected ? colors.accent : colors.borderLight,
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingVertical: 5,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: isSelected ? colors.accent : colors.text }}>
                    {isMl ? opt.labelMl : isAr ? opt.labelAr : opt.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Personal Note Input */}
        <View style={{ gap: 4 }}>
          <TextInput
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.borderLight,
              padding: 10,
              color: colors.text,
              fontFamily: 'Cairo_400Regular',
              fontSize: 11,
              minHeight: 38,
              textAlign: isAr ? 'right' : 'left',
            }}
            placeholder={loc('ملاحظات شخصية أو أهداف ترغب في تذكرها (اختياري)...', 'Personal goals or notes (optional)...', 'വ്യക്തിഗത കുറിപ്പുകൾ...')}
            placeholderTextColor={colors.textSecondary}
            value={refQ4}
            onChangeText={setRefQ4}
          />
        </View>

        {/* Save Reflection Button */}
        <Pressable
          onPress={onSaveKakeiboReflection}
          style={({ pressed }) => [{
            backgroundColor: '#F59E0B',
            borderRadius: 12,
            height: 40,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
        >
          <Ionicons name="save-outline" size={15} color="#FFF" />
          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: '#FFF' }}>
            {loc('حفظ التأمل المالي الذكي 🎯', 'Save Reflection 🎯', 'ചിന്തകൾ സേവ് ചെയ്യുക 🎯')}
          </Text>
        </Pressable>

        {/* Collapsible Saved Reflections History */}
        {showHistory && plan.kakeiboReflections && plan.kakeiboReflections.length > 0 && (
          <View style={{ gap: 8, marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.textSecondary, textAlign: 'left' }}>
              {loc('📖 سجل القرارات والتأملات المحفوظة:', '📖 Saved Reflections History:', '📖 സേവ് ചെയ്ത ചിന്തകൾ:')}
            </Text>
            {plan.kakeiboReflections.map((ref, rIdx) => (
              <View
                key={rIdx}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 12,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 15 }}>{ref.emojiMood || '😊'}</Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.text }}>
                      {ref.monthKey}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: '#10B981' }}>
                    {loc('محفوظ 🟢', 'Saved 🟢', 'സേവ് ചെയ്തു 🟢')}
                  </Text>
                </View>

                {ref.quickActions && ref.quickActions.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {ref.quickActions.map((actId) => {
                      const actObj = quickActionOptions.find((o) => o.id === actId);
                      return (
                        <View key={actId} style={{ backgroundColor: colors.accent + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: colors.accent }}>
                            {actObj ? (isMl ? actObj.labelMl : isAr ? actObj.labelAr : actObj.labelEn) : actId}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {ref.q4 ? (
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
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
