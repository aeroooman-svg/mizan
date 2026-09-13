import React from 'react';
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

  const loc = (ar: string, en: string, ml?: string) => {
    if (isMl) return ml || en;
    if (isAr) return ar;
    return en;
  };

  const kbSurvival = plan.kakeiboBudgets?.survival || 0;
  const kbWants = plan.kakeiboBudgets?.wants || 0;
  const kbCulture = plan.kakeiboBudgets?.culture || 0;
  const kbExtra = plan.kakeiboBudgets?.extra || 0;

  const pillars = [
    {
      id: 'survival',
      nameAr: 'الاحتياجات الأساسية (Survival)',
      nameEn: 'Survival / Needs',
      nameMl: 'അടിസ്ഥാന ആവശ്യങ്ങൾ (Survival)',
      icon: 'restaurant',
      color: '#10B981',
      spent: spentByPillar.survival,
      budget: kbSurvival,
    },
    {
      id: 'wants',
      nameAr: 'الرغبات الترفيهية (Wants)',
      nameEn: 'Wants / Optional',
      nameMl: 'വിനോദവും ആഗ്രഹങ്ങളും (Wants)',
      icon: 'shopping-bag',
      color: '#F59E0B',
      spent: spentByPillar.wants,
      budget: kbWants,
    },
    {
      id: 'culture',
      nameAr: 'الثقافة والتعليم (Culture)',
      nameEn: 'Culture & Mind',
      nameMl: 'സംസ്കാരവും വിദ്യാഭ്യാസവും (Culture)',
      icon: 'book',
      color: '#6366F1',
      spent: spentByPillar.culture,
      budget: kbCulture,
    },
    {
      id: 'extra',
      nameAr: 'مصاريف طارئة/أخرى (Extra)',
      nameEn: 'Extra / Unplanned',
      nameMl: 'അപ്രതീക്ഷിത ചെലവുകൾ (Extra)',
      icon: 'more-horiz',
      color: '#EF4444',
      spent: spentByPillar.extra,
      budget: kbExtra,
    },
  ];

  const totalKakeiboSpent =
    spentByPillar.survival + spentByPillar.wants + spentByPillar.culture + spentByPillar.extra;
  const wantsRatio = totalKakeiboSpent > 0 ? (spentByPillar.wants / totalKakeiboSpent) * 100 : 0;
  const needsRatio = totalKakeiboSpent > 0 ? (spentByPillar.survival / totalKakeiboSpent) * 100 : 0;
  const isMindfulBalanced = wantsRatio <= 25 && needsRatio <= 65;

  const moods = [
    { emoji: '🤩', labelAr: 'ممتاز جداً', labelEn: 'Superb', labelMl: 'വളരെ മികച്ചത്' },
    { emoji: '😊', labelAr: 'مستقر وراضٍ', labelEn: 'Satisfied', labelMl: 'തൃപ്തികരം' },
    { emoji: '😐', labelAr: 'متوسط', labelEn: 'Neutral', labelMl: 'ശരാശരി' },
    { emoji: '😓', labelAr: 'يحتاج تحسين', labelEn: 'Needs Improvement', labelMl: 'മെച്ചപ്പെടുത്തേണ്ടതുണ്ട്' },
  ];

  const quickActionOptions = [
    { id: 'cut_subs', labelAr: '✂️ إلغاء اشتراكات غير مستغلة', labelEn: '✂️ Cancel unused subs', labelMl: '✂️ വരിസംഖ്യകൾ റദ്ദാക്കുക' },
    { id: 'reduce_delivery', labelAr: '🍳 تقليل طلبات المطاعم', labelEn: '🍳 Cut dining out', labelMl: '🍳 പുറത്തുനിന്നുള്ള ഭക്ഷണം കുറയ്ക്കുക' },
    { id: 'save_gas', labelAr: '⛽ ترشيد البنزين والمواصلات', labelEn: '⛽ Save on fuel/rides', labelMl: '⛽ ഇന്ധനച്ചെലവ് ലാഭിക്കുക' },
    { id: 'boost_saving', labelAr: '💰 زيادة الادخار الشهري 5%', labelEn: '💰 Boost savings 5%', labelMl: '💰 സമ്പാദ്യം 5% കൂട്ടുക' },
    { id: 'delay_wants', labelAr: '🎁 تأجيل الشراء العاطفي', labelEn: '🎁 Pause impulse buys', labelMl: '🎁 അനാവശ്യ വാങ്ങലുകൾ മാറ്റിവെക്കുക' },
  ];

  const toggleAction = (actId: string) => {
    Haptics.selectionAsync();
    if (selectedQuickActions.includes(actId)) {
      setSelectedQuickActions(prev => prev.filter(a => a !== actId));
    } else {
      setSelectedQuickActions(prev => [...prev, actId]);
    }
  };

  const totalBudget = kbSurvival + kbWants + kbCulture + kbExtra;
  const projectedNet = totalIncome - totalBudget;

  return (
    <View style={styles.container}>
      {/* Live Income & Kakeibo Balance Summary Bar */}
      <View style={[styles.summaryBar, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={styles.iconTextRow}>
            <Ionicons name="wallet-outline" size={16} color={colors.income} />
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              {loc('الدخل الفعلي للشهر الحالي:', 'Actual Monthly Income:', 'ഈ മാസത്തെ യഥാർത്ഥ വരുമാനം:')}
            </Text>
          </View>
          <Text style={[styles.summaryAmount, { color: colors.income }]}>
            +{formatCurrency(totalIncome)} {sym}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.iconTextRow}>
            <Ionicons name="pie-chart-outline" size={16} color={colors.primary} />
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              {loc('إجمالي ميزانية الأعمدة الأربعة:', 'Total 4 Pillars Budget:', '4 സ്തംഭങ്ങളുടെ ആകെ ബജറ്റ്:')}
            </Text>
          </View>
          <Text style={[styles.summaryAmount, { color: colors.text }]}>
            {formatCurrency(totalBudget)} {sym}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.summaryRow}>
          <Text style={[styles.boldLabel, { color: colors.text }]}>
            {loc('الادخار المتوقع (الدخل - الميزانية):', 'Projected Net Savings:', 'പ്രതീക്ഷിത അറ്റ സമ്പാദ്യം:')}
          </Text>
          <Text
            style={[
              styles.summaryAmount,
              { color: projectedNet >= 0 ? colors.primary : colors.expense },
            ]}
          >
            {formatCurrency(projectedNet)} {sym}
          </Text>
        </View>
      </View>

      {/* Visual Japanese Mindfulness Donut Chart Card */}
      <View
        style={[
          styles.donutCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.donutHeader}>
          <View style={styles.donutHeaderTitle}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text style={[styles.donutHeading, { color: colors.text }]} numberOfLines={1}>
              {loc('دائرة الوعي المالي', 'Mindfulness Ring', 'സാമ്പത്തിക അവബോധ ചക്രം')}
            </Text>
          </View>
          <View
            style={[
              styles.badgeStatus,
              {
                backgroundColor: isMindfulBalanced
                  ? 'rgba(16,185,129,0.15)'
                  : 'rgba(245,158,11,0.15)',
              },
            ]}
          >
            <Text
              style={[
                styles.badgeStatusText,
                { color: isMindfulBalanced ? '#10B981' : '#F59E0B' },
              ]}
            >
              {isMindfulBalanced
                ? loc('🟢 متزن', '🟢 Balanced', '🟢 സമതുലിതം')
                : loc('🟡 تنبيه', '🟡 Review', '🟡 പരിശോധിക്കുക')}
            </Text>
          </View>
        </View>

        {/* Donut Visual Display */}
        <View style={styles.donutRow}>
          <View style={styles.donutSvgWrap}>
            <Svg width={110} height={110}>
              <Circle cx={55} cy={55} r={42} fill="none" stroke={colors.surfaceAlt} strokeWidth={14} />
              <Circle
                cx={55}
                cy={55}
                r={42}
                fill="none"
                stroke="#10B981"
                strokeWidth={14}
                strokeDasharray={`${(needsRatio / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
                strokeLinecap="round"
                transform="rotate(-90 55 55)"
              />
            </Svg>
            <View style={styles.donutCenter}>
              <Text style={[styles.donutTotalSpent, { color: colors.text }]}>
                {formatCurrency(totalKakeiboSpent)}
              </Text>
              <Text style={[styles.donutSpentSub, { color: colors.textSecondary }]}>
                {sym} {loc('منصرف', 'spent', 'ചെലവഴിച്ചത്')}
              </Text>
            </View>
          </View>

          {/* Legend Grid */}
          <View style={styles.donutLegend}>
            {pillars.map((p) => (
              <View key={p.id} style={styles.legendRow}>
                <View style={styles.legendLeft}>
                  <View style={[styles.legendDot, { backgroundColor: p.color }]} />
                  <Text style={[styles.legendName, { color: colors.text }]}>
                    {isMl ? p.nameMl.split(' ')[0] : isAr ? p.nameAr.split(' ')[0] : p.nameEn.split(' ')[0]}
                  </Text>
                </View>
                <Text style={[styles.legendSpent, { color: colors.textSecondary }]}>
                  {formatCurrency(p.spent)} {sym}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Smart Feedback Note */}
        <View style={[styles.feedbackNote, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.feedbackNoteText, { color: colors.textSecondary }]}>
            {wantsRatio > 25
              ? loc(
                  `⚠️ تشكل رغباتك الترفيهية ${Math.round(wantsRatio)}% من مصاريفك (أعلى من الحد الموصى به 25%). ينصح بتأجيل مشتريات الترفيه غير الحاكمة.`,
                  `⚠️ Wants represent ${Math.round(wantsRatio)}% of spending (higher than recommended 25%). Try pausing impulse buys.`,
                  `⚠️ ആഗ്രഹങ്ങൾ ചെലവിന്റെ ${Math.round(wantsRatio)}% ആണ് (ശുപാർശ ചെയ്യുന്ന 25% പരിധിക്ക് മുകളിൽ). അനാവശ്യ വാങ്ങലുകൾ മാറ്റിവെക്കുന്നത് നല്ലതാണ്.`
                )
              : loc(
                  `🟢 رائع! ميزانيتك متزنة تماماً. رغباتك الترفيهية تشكل ${Math.round(wantsRatio)}% فقط من منصرفك.`,
                  `🟢 Great! Your wants represent only ${Math.round(wantsRatio)}% of total spending.`,
                  `🟢 മികച്ചത്! നിങ്ങളുടെ ബജറ്റ് സമതുലിതമാണ്. ആഗ്രഹങ്ങൾ ആകെ ചെലവിന്റെ ${Math.round(wantsRatio)}% മാത്രമാണ്.`
                )}
          </Text>
        </View>
      </View>

      {/* Pillars List */}
      <View style={styles.pillarsList}>
        {pillars.map((p) => {
          const pct = p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
          const isOver = p.spent > p.budget;
          return (
            <View
              key={p.id}
              style={[
                styles.pillarCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.pillarHeader}>
                <View style={styles.pillarHeaderLeft}>
                  <View style={[styles.pillarIconWrap, { backgroundColor: p.color + '15' }]}>
                    <MaterialIcons name={p.icon as any} size={18} color={p.color} />
                  </View>
                  <View>
                    <Text style={[styles.pillarName, { color: colors.text }]}>
                      {isMl ? p.nameMl : isAr ? p.nameAr : p.nameEn}
                    </Text>
                    <Text style={[styles.pillarBudgetSubtitle, { color: colors.textSecondary }]}>
                      {loc(`الميزانية: ${formatCurrency(p.budget)} ${sym}`, `Budget: ${formatCurrency(p.budget)} ${sym}`, `ബജറ്റ്: ${formatCurrency(p.budget)} ${sym}`)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.pillarSpentAmount, { color: isOver ? colors.expense : colors.text }]}>
                  {formatCurrency(p.spent)} {sym}
                </Text>
              </View>

              <View style={[styles.pillarProgressBg, { backgroundColor: colors.surfaceAlt }]}>
                <View
                  style={[
                    styles.pillarProgressFill,
                    { width: `${Math.min(100, pct)}%`, backgroundColor: p.color },
                  ]}
                />
              </View>

              <View style={styles.pillarStatusRow}>
                <Text
                  style={[
                    styles.progressNoteText,
                    { color: colors.textSecondary },
                    isOver && { color: colors.expense, fontFamily: 'Cairo_700Bold' },
                  ]}
                >
                  {isOver
                    ? loc(
                        `⚠️ تجاوزت الميزانية بـ ${formatCurrency(p.spent - p.budget)} ${sym}!`,
                        `⚠️ Over budget by ${formatCurrency(p.spent - p.budget)} ${sym}!`,
                        `⚠️ ബജറ്റിനേക്കാൾ ${formatCurrency(p.spent - p.budget)} ${sym} കവിഞ്ഞു!`
                      )
                    : loc(`${pct}% من الميزانية`, `${pct}% of budget`, `ബജറ്റിന്റെ ${pct}%`)}
                </Text>
                {p.budget > p.spent && (
                  <Text style={[styles.progressNoteText, { color: colors.textSecondary }]}>
                    {loc(
                      `المتبقي: ${formatCurrency(p.budget - p.spent)} ${sym}`,
                      `Remaining: ${formatCurrency(p.budget - p.spent)} ${sym}`,
                      `ബാക്കി: ${formatCurrency(p.budget - p.spent)} ${sym}`
                    )}
                  </Text>
                )}
              </View>

              {/* Instant Overrun Rebalance Action Plan */}
              {isOver && (
                <View
                  style={[
                    styles.rebalanceBox,
                    {
                      backgroundColor: colors.expense + '12',
                      borderColor: colors.expense + '30',
                    },
                  ]}
                >
                  <Text style={[styles.rebalanceText, { color: colors.expense }]}>
                    {loc(
                      `💡 خطة التوازن التلقائية: تم رصد تجاوز بـ ${formatCurrency(p.spent - p.budget)} ${sym}. خصم المبلغ من ركيزة (الطوارئ/الرغبات) يحمي ادخارك النهائي.`,
                      `💡 Rebalance Plan: Overrun of ${formatCurrency(p.spent - p.budget)} ${sym} detected. Offsetting protects your savings.`,
                      `💡 ഓട്ടോ-റീബാലൻസ് പ്ലാൻ: അധികം വന്ന ${formatCurrency(p.spent - p.budget)} ${sym} ക്രമീകരിക്കുന്നത് നിങ്ങളുടെ സമ്പാദ്യത്തെ സംരക്ഷിക്കും.`
                    )}
                  </Text>
                  <Pressable
                    onPress={() => onApplyKakeiboRebalance(p.spent - p.budget, p.id)}
                    style={({ pressed }) => [
                      styles.rebalanceBtn,
                      { backgroundColor: colors.expense },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={styles.rebalanceBtnText}>
                      {loc('تطبيق إعادة التوازن المالي ⚖️', 'Apply Auto-Rebalance ⚖️', 'റീബാലൻസ് നടപ്പിലാക്കുക ⚖️')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Adjust Kakeibo Budget Button */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenKakeiboBudgetModal();
        }}
        style={({ pressed }) => [
          styles.adjustBtn,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.9 },
        ]}
      >
        <MaterialIcons name="edit" size={16} color="#FFF" />
        <Text style={styles.adjustBtnText}>
          {loc('تعديل ميزانية الأعمدة الأربعة', 'Edit Kakeibo Pillar Budgets', '4 സ്തംഭ ബജറ്റ് മാറ്റുക')}
        </Text>
      </Pressable>

      {/* Interactive Quick Mindful Reflection Card */}
      <View style={[styles.reflectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.reflectionHeader}>
          <MaterialIcons name="border-color" size={20} color={colors.accent} />
          <Text style={[styles.reflectionTitle, { color: colors.text }]}>
            {loc('التأمل والتخطيط المالي السريع', 'Interactive Mindful Journaling', 'ദ്രുത സാമ്പത്തിക ചിന്തകളും പ്ലാനിംഗും')}
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          {/* 1. Emoji Mood Selector */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.reflectionLabel, { color: colors.textSecondary }]}>
              {loc(
                'كيف تقيّم شعورك المالي وانظباطك هذا الشهر؟',
                'How do you feel about your finances this month?',
                'ഈ മാസം നിങ്ങളുടെ സാമ്പത്തിക അച്ചടക്കത്തെ എങ്ങനെ വിലയിരുത്തുന്നു?'
              )}
            </Text>
            <View style={styles.moodsRow}>
              {moods.map((m) => (
                <Pressable
                  key={m.emoji}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedEmojiMood(m.emoji);
                  }}
                  style={[
                    styles.moodBtn,
                    {
                      borderColor: selectedEmojiMood === m.emoji ? colors.primary : colors.border,
                      backgroundColor:
                        selectedEmojiMood === m.emoji ? colors.primary + '15' : colors.surfaceAlt,
                    },
                  ]}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text
                    style={[
                      styles.moodText,
                      {
                        color:
                          selectedEmojiMood === m.emoji ? colors.primary : colors.textSecondary,
                      },
                    ]}
                  >
                    {isMl ? m.labelMl : isAr ? m.labelAr : m.labelEn}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 2. Quick Action Chips for Next Month */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.reflectionLabel, { color: colors.textSecondary }]}>
              {loc(
                'اختر قرار التغيير للشهر القادم بنقرة واحدة:',
                'Pick 1-tap improvements for next month:',
                'അടുത്ത മാസത്തേക്കുള്ള മാറ്റങ്ങൾ തിരഞ്ഞെടുക്കുക:'
              )}
            </Text>
            <View style={styles.actionsGrid}>
              {quickActionOptions.map((opt) => {
                const isSelected = selectedQuickActions.includes(opt.id);
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => toggleAction(opt.id)}
                    style={[
                      styles.actionChip,
                      {
                        borderColor: isSelected ? colors.accent : colors.border,
                        backgroundColor: isSelected ? colors.accent + '20' : colors.surfaceAlt,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionChipText,
                        { color: isSelected ? colors.accent : colors.text },
                      ]}
                    >
                      {isMl ? opt.labelMl : isAr ? opt.labelAr : opt.labelEn}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Explanatory Note on Impact */}
          <View
            style={[
              styles.impactNote,
              {
                backgroundColor: colors.primary + '10',
                borderColor: colors.primary + '30',
              },
            ]}
          >
            <Text style={[styles.impactNoteText, { color: colors.primary }]}>
              {loc(
                '💡 تأثير التأمل الياباني: يحدد هذا الجزء مدى انضباطك المالي، وتُستخدم قراراتك لتعديل الميزانية تلقائياً بالشهر القادم وتحديث مؤشر دائرة الوعي المالي.',
                '💡 Kakeibo Impact: Your monthly reflection adjusts next month’s budget allocation automatically and updates your Mindfulness Ring.',
                '💡 കാകെയ്ബോ സ്വാധീനം: നിങ്ങളുടെ പ്രതിമാസ ചിന്തകൾ അടുത്ത മാസത്തെ ബജറ്റ് ക്രമീകരിക്കാൻ സഹായിക്കുന്നു.'
              )}
            </Text>
          </View>

          {/* Text Notes input */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.reflectionLabel, { color: colors.textSecondary }]}>
              {loc('ملاحظات إضافية وقراراتك الذاتية (اختياري):', 'Additional Reflection Notes (Optional):', 'കൂടുതൽ കുറിപ്പുകൾ (ഓപ്ഷണൽ):')}
            </Text>
            <TextInput
              style={[
                styles.reflectionInput,
                {
                  backgroundColor: colors.surfaceAlt,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              multiline
              placeholder={loc('اكتب طموحاتك وملاحظاتك المالية...', 'Write your notes or goals...', 'നിങ്ങളുടെ സാമ്പത്തിക കുറിപ്പുകൾ ഇവിടെ എഴുതുക...')}
              placeholderTextColor={colors.textSecondary}
              value={refQ4}
              onChangeText={setRefQ4}
            />
          </View>

          <Pressable
            onPress={onSaveKakeiboReflection}
            style={({ pressed }) => [
              styles.saveReflectionBtn,
              { backgroundColor: colors.accent },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Ionicons name="save-outline" size={16} color="#FFF" />
            <Text style={styles.saveReflectionBtnText}>
              {loc('حفظ التأمل المالي بنقرة واحدة', 'Save Reflection Journal', 'സാമ്പത്തിക ചിന്തകൾ സേവ് ചെയ്യുക')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Saved Reflections & Decision Log History */}
      {plan.kakeiboReflections && plan.kakeiboReflections.length > 0 && (
        <View style={[styles.historyCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <View style={styles.historyHeader}>
            <Ionicons name="journal-outline" size={18} color={colors.primary} />
            <Text style={[styles.historyTitle, { color: colors.text }]}>
              {loc('📖 سجل التأملات والقرارات المحفوظة', '📖 Saved Reflections History Log', '📖 സേവ് ചെയ്ത ചിന്തകളുടെ ചരിത്രം')}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            {plan.kakeiboReflections.map((ref, rIdx) => (
              <View
                key={rIdx}
                style={[
                  styles.historyItem,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.historyItemTop}>
                  <View style={styles.historyItemTopLeft}>
                    <Text style={{ fontSize: 18 }}>{ref.emojiMood || '😊'}</Text>
                    <Text style={[styles.historyMonthName, { color: colors.text }]}>
                      {loc(`تأمل شهر ${ref.monthKey}`, `Reflection ${ref.monthKey}`, `പ്രതിമാസ ചിന്ത ${ref.monthKey}`)}
                    </Text>
                  </View>
                  <View style={[styles.savedTag, { backgroundColor: colors.primary + '18' }]}>
                    <Text style={[styles.savedTagText, { color: colors.primary }]}>
                      {loc('تم حفظ القرار 🟢', 'Decision Saved 🟢', 'തീരുമാനം സേവ് ചെയ്തു 🟢')}
                    </Text>
                  </View>
                </View>

                {ref.quickActions && ref.quickActions.length > 0 && (
                  <View style={styles.historyChipsRow}>
                    {ref.quickActions.map((actId) => {
                      const actObj = quickActionOptions.find((o) => o.id === actId);
                      return (
                        <View
                          key={actId}
                          style={[styles.historyChip, { backgroundColor: colors.accent + '15' }]}
                        >
                          <Text style={[styles.historyChipText, { color: colors.accent }]}>
                            {actObj ? (isMl ? actObj.labelMl : isAr ? actObj.labelAr : actObj.labelEn) : actId}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {ref.q4 ? (
                  <Text style={[styles.historyNotes, { color: colors.textSecondary }]}>
                    {`"${ref.q4}"`}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  summaryBar: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  summaryAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  boldLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  divider: {
    height: 1,
  },
  donutCard: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  donutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
    gap: 8,
  },
  donutHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  donutHeading: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    flex: 1,
  },
  badgeStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeStatusText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 8,
  },
  donutSvgWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutTotalSpent: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  donutSpentSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 9,
  },
  donutLegend: {
    gap: 6,
    flex: 1,
    marginLeft: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  legendSpent: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  feedbackNote: {
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
    width: '100%',
  },
  feedbackNoteText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    textAlign: 'left',
    lineHeight: 16,
  },
  pillarsList: {
    gap: 12,
  },
  pillarCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  pillarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillarIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  pillarBudgetSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  pillarSpentAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  pillarProgressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 12,
  },
  pillarProgressFill: {
    height: 8,
    borderRadius: 4,
  },
  pillarStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressNoteText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  rebalanceBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    gap: 6,
  },
  rebalanceText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    textAlign: 'left',
    lineHeight: 16,
  },
  rebalanceBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  rebalanceBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: '#FFF',
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  adjustBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
  reflectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  reflectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  reflectionLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  moodsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  moodEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  moodText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 9,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  impactNote: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
  },
  impactNoteText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    textAlign: 'left',
    lineHeight: 16,
  },
  reflectionInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  saveReflectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  saveReflectionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
  historyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  historyItem: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyMonthName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  savedTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savedTagText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
  historyChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  historyChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  historyChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
  historyNotes: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
});
