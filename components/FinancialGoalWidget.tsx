import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';

export default function FinancialGoalWidget() {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [userGoal, setUserGoal] = useState<string>('saving');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function loadGoal() {
      try {
        const savedGoal = await AsyncStorage.getItem('@mizan_user_goal');
        if (savedGoal) {
          setUserGoal(savedGoal);
        }
      } catch (e) {}
    }
    loadGoal();
  }, []);

  const getGoalInfo = () => {
    switch (userGoal) {
      case 'debts':
        return {
          title: isAr ? 'مسارك المالي: سداد الديون والالتزامات' : 'Goal: Pay Off Debts',
          desc: isAr ? 'ركّز هذا الشهر على التخلص من الديون الصغيرة أولاً لتصفية التزاماتك المالية.' : 'Focus on clearing smallest liabilities first to build debt-free momentum.',
          btnText: isAr ? 'إدارة وسداد الديون 💳' : 'Manage & Settle Debts 💳',
          targetRoute: '/debts',
          color: '#EF4444',
          icon: 'card-outline',
        };
      case 'tracking':
        return {
          title: isAr ? 'مسارك المالي: ضبط النفقات والسيولة' : 'Goal: Expense & Cashflow Control',
          desc: isAr ? 'تتبع مصاريفك اليومية والتزم بالحد الأقصى لكل فئة لتجنب العجز المالي.' : 'Track daily category limits and prevent budget overspending.',
          btnText: isAr ? 'استعراض خطة الميزانية 📊' : 'Review Budget Plan 📊',
          targetRoute: '/(tabs)/financial-plan',
          color: '#6366F1',
          icon: 'pie-chart-outline',
        };
      case 'saving':
      default:
        return {
          title: isAr ? 'مسارك المالي: توفير المال وبناء الأمان' : 'Goal: Savings & Emergency Fund',
          desc: isAr ? 'ادخر 20% من دخلك شهرياً في أهداف التوفير وحصالة الفكة التلقائية.' : 'Set aside 20% income monthly into dedicated savings jars and round-ups.',
          btnText: isAr ? 'فتح أهداف الادخار 🎯' : 'Open Savings Goals 🎯',
          targetRoute: '/savings-goals',
          color: '#10B981',
          icon: 'shield-checkmark-outline',
        };
    }
  };

  const info = getGoalInfo();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: info.color + '30' }]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setIsExpanded(!isExpanded);
        }}
        style={styles.headerRow}
      >
        <View style={[styles.iconBox, { backgroundColor: info.color + '18' }]}>
          <Ionicons name={info.icon as any} size={18} color={info.color} />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.badgeTitle, { color: colors.text }]} numberOfLines={1}>{info.title}</Text>
        </View>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
      </Pressable>

      {isExpanded && (
        <View style={styles.expandedBody}>
          <Text style={[styles.badgeDesc, { color: colors.textSecondary }]}>{info.desc}</Text>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push(info.targetRoute as any);
            }}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: info.color + '15', borderColor: info.color + '40' },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.actionBtnText, { color: info.color }]}>{info.btnText}</Text>
            <Ionicons name={isAr ? "chevron-back" : "chevron-forward"} size={16} color={info.color} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  badgeTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  expandedBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  badgeDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
});

