import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface DailyQuizSectionProps {
  isAr: boolean;
  answeredToday: boolean;
  onAnswerCorrect: (xpReward: number) => void;
}

interface QuizItem {
  id: string;
  questionAr: string;
  questionEn: string;
  optionsAr: string[];
  optionsEn: string[];
  correctIndex: number;
  explanationAr: string;
  explanationEn: string;
}

const QUIZZES: QuizItem[] = [
  {
    id: 'quiz_1',
    questionAr: 'ما هي الطريقة الأذكى في استراتيجية الادخار الشخصي؟',
    questionEn: 'What is the smartest personal savings strategy?',
    optionsAr: [
      'استقطاع الادخار فور استلام الدخل 🎯',
      'ادخار ما يتبقى في نهاية الشهر ⏳',
    ],
    optionsEn: [
      'Pay yourself first upon payday 🎯',
      'Save whatever is left at month end ⏳',
    ],
    correctIndex: 0,
    explanationAr: 'استراتيجية "ادفع لنفسك أولاً" تضمن التوفير المستمر قبل أن يستهلك الصرف اليومي دخلك.',
    explanationEn: '"Pay yourself first" guarantees consistent savings before daily impulse spending kicks in.',
  },
  {
    id: 'quiz_2',
    questionAr: 'في قاعدة الميزانية الشهيرة 50/30/20، ماذا تمثل نسبة 20%؟',
    questionEn: 'In the popular 50/30/20 rule, what does the 20% represent?',
    optionsAr: [
      'الادخار وبناء صندوق الطوارئ 🛡️',
      'التسوق والمطاعم والترفيه 🛍️',
    ],
    optionsEn: [
      'Savings & Emergency fund 🛡️',
      'Shopping & Dining out 🛍️',
    ],
    correctIndex: 0,
    explanationAr: 'قاعدة 50% للضروريات، 30% للرغبات، و20% مخصصة للادخار والاستثمار وسداد الديون.',
    explanationEn: '50% for needs, 30% for wants, and 20% dedicated to savings, investing, and debt payoff.',
  },
  {
    id: 'quiz_3',
    questionAr: 'إذا وفرت 1.5 دينار يومياً من القهوة الجاهزة، كم توفر تقريباً في السنة؟',
    questionEn: 'If you save 1.5 KWD daily by making coffee at home, how much do you save per year?',
    optionsAr: [
      'أكثر من 540 دينار سنوياً! 💰',
      'حوالي 120 دينار فقط 🤏',
    ],
    optionsEn: [
      'Over 540 KWD annually! 💰',
      'Around 120 KWD only 🤏',
    ],
    correctIndex: 0,
    explanationAr: 'المصاريف الصغيرة اليومية تتراكم لتصنع مبالغ هائلة تكفي لتغطية استثمار أو رحلة سنوية.',
    explanationEn: 'Small daily leaks accumulate into huge sums over time, enough for vacation or investment.',
  },
];

export default function DailyQuizSection({
  isAr,
  answeredToday,
  onAnswerCorrect,
}: DailyQuizSectionProps) {
  // Pick quiz based on day of month so it rotates daily
  const todayQuiz = useMemo(() => {
    const day = new Date().getDate();
    return QUIZZES[day % QUIZZES.length];
  }, []);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(answeredToday);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSelectOption = (idx: number) => {
    if (answered || answeredToday) return;

    setSelectedIndex(idx);
    const correct = idx === todayQuiz.correctIndex;
    setIsCorrect(correct);
    setAnswered(true);

    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAnswerCorrect(30);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E1B4B', '#2E1065', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.iconCircle}>
              <Ionicons name="flash" size={18} color="#FDE047" />
            </View>
            <View>
              <Text style={styles.title}>
                {isAr ? 'كويز التحدي اليومي' : 'Daily Flash Quiz'}
              </Text>
              <Text style={styles.subtitle}>
                {isAr ? 'سؤال مالي سريع لرفع ذكائك المالي' : 'Quick trivia to level up financial IQ'}
              </Text>
            </View>
          </View>

          <View style={styles.rewardTag}>
            <Text style={styles.rewardTagText}>+30 XP</Text>
          </View>
        </View>

        {/* Question */}
        <Text style={styles.questionText}>
          {isAr ? todayQuiz.questionAr : todayQuiz.questionEn}
        </Text>

        {/* Options */}
        <View style={styles.optionsCol}>
          {(isAr ? todayQuiz.optionsAr : todayQuiz.optionsEn).map((opt, idx) => {
            const isChosen = selectedIndex === idx;
            const isRight = idx === todayQuiz.correctIndex;
            const showOutcome = answered || answeredToday;

            const isCorrectOption = showOutcome && isRight;
            const isWrongOption = showOutcome && isChosen && !isRight;

            return (
              <Pressable
                key={idx}
                onPress={() => handleSelectOption(idx)}
                disabled={answered || answeredToday}
                style={({ pressed }) => [
                  styles.optionBtn,
                  isCorrectOption && styles.optionBtnCorrect,
                  isWrongOption && styles.optionBtnWrong,
                  pressed && !showOutcome && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[
                    styles.optionBtnText,
                    isCorrectOption && styles.optionBtnTextCorrect,
                    isWrongOption && styles.optionBtnTextWrong,
                  ]}
                >
                  {opt}
                </Text>
                {showOutcome && isRight && (
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                )}
                {showOutcome && isChosen && !isRight && (
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Explanation when answered */}
        {(answered || answeredToday) && (
          <View style={styles.explanationBox}>
            <Ionicons name="information-circle-outline" size={18} color="#A78BFA" />
            <Text style={styles.explanationText}>
              {isAr ? todayQuiz.explanationAr : todayQuiz.explanationEn}
            </Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(253, 224, 71, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  subtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: '#C4B5FD',
  },
  rewardTag: {
    backgroundColor: 'rgba(253, 224, 71, 0.2)',
    borderWidth: 1,
    borderColor: '#FDE047',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  rewardTagText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: '#FDE047',
  },
  questionText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#F1F5F9',
    lineHeight: 22,
    marginBottom: 12,
  },
  optionsCol: {
    gap: 8,
  },
  optionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionBtnCorrect: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  optionBtnWrong: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  optionBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: '#E2E8F0',
    flex: 1,
  },
  optionBtnTextCorrect: {
    color: '#34D399',
    fontFamily: 'Cairo_700Bold',
  },
  optionBtnTextWrong: {
    color: '#F87171',
  },
  explanationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  explanationText: {
    flex: 1,
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 18,
  },
});
