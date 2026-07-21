import React, { useMemo } from 'react';
import { useTheme } from '@/lib/ThemeContext';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

interface FinancialHealthScoreProps {
  healthScore: number;
  language: 'ar' | 'en';
  onPress?: () => void;
}

export default function FinancialHealthScore({ healthScore, language, onPress }: FinancialHealthScoreProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isExcellent = healthScore >= 85;
  const isGood = healthScore >= 60;
  
  const statusColor = isExcellent ? '#10B981' : isGood ? '#F59E0B' : '#EF4444';
  const statusColorDark = isExcellent ? '#059669' : isGood ? '#D97706' : '#DC2626';
  const statusBg = isExcellent ? '#10B98115' : isGood ? '#F59E0B15' : '#EF444415';
  
  const statusLabel = isExcellent 
    ? (language === 'ar' ? 'ممتاز' : 'EXCELLENT') 
    : isGood 
      ? (language === 'ar' ? 'مستقر' : 'GOOD') 
      : (language === 'ar' ? 'خطر' : 'WARNING');

  return (
    <Pressable 
      style={({ pressed }) => [styles.healthCard2Col, pressed && { opacity: 0.95 }]}
      onPress={onPress}
    >
      <Text style={styles.cardHeaderTitle2Col}>
        {language === 'ar' ? 'الصحة المالية' : 'FINANCIAL HEALTH'}
      </Text>
      
      <View style={styles.healthCircleContainer}>
        <Svg width={64} height={64} viewBox="0 0 80 80">
          <Defs>
            <SvgLinearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={statusColor} />
              <Stop offset="100%" stopColor={statusColorDark} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx="40" cy="40" r="32" stroke="#1F293D" strokeWidth="6" fill="transparent" />
          <Circle 
            cx="40" 
            cy="40" 
            r="32" 
            stroke="url(#healthGrad)" 
            strokeWidth="6" 
            fill="transparent" 
            strokeDasharray={2 * Math.PI * 32}
            strokeDashoffset={2 * Math.PI * 32 * (1 - healthScore / 100)}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
        </Svg>
        <View style={styles.healthScoreCenterText}>
          <Text style={styles.healthScoreNumber}>{healthScore}</Text>
        </View>
      </View>

      <View style={[styles.healthBadge2Col, { backgroundColor: statusBg }]}>
        <Text style={[styles.healthBadgeText2Col, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  healthCard2Col: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 160,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  cardHeaderTitle2Col: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  healthCircleContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  healthScoreCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreNumber: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  healthBadge2Col: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  healthBadgeText2Col: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
