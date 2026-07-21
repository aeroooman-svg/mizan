import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import FinancialHealthScore from '@/components/FinancialHealthScore';
import CashflowForecastWidget from '@/components/CashflowForecastWidget';
import { CashflowForecast } from '@/lib/financialEngine';

interface HealthForecastRowProps {
  healthScore: number;
  selectedWalletBalance: number;
  currencySymbol: string;
  balance: number;
  forecast: CashflowForecast | null;
  language: 'ar' | 'en';
  colors: any;
}

export default function HealthForecastRow({
  healthScore,
  selectedWalletBalance,
  currencySymbol,
  balance,
  forecast,
  language,
  colors,
}: HealthForecastRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = getStyles(colors);

  const toggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      <View style={styles.twoColumnSection}>
        <FinancialHealthScore
          healthScore={healthScore}
          language={language}
          onPress={toggleExpand}
        />

        <CashflowForecastWidget
          selectedWalletBalance={selectedWalletBalance}
          currencySymbol={currencySymbol}
          balance={balance}
          forecast={forecast}
          language={language}
          onPress={toggleExpand}
        />
      </View>

      {isExpanded && forecast && (
        <View style={styles.forecastDetailCard}>
          <View style={styles.forecastDetailHeader}>
            <Ionicons
              name={forecast.status === 'safe' ? 'checkmark-circle' : 'alert-circle'}
              size={20}
              color={
                forecast.status === 'safe'
                  ? Colors.income
                  : forecast.status === 'risk'
                  ? Colors.accent
                  : Colors.expense
              }
            />
            <Text style={styles.forecastDetailTitle}>
              {language === 'ar' ? 'توقعات السيولة والمصاريف' : 'Detailed Cashflow Forecast'}
            </Text>
          </View>
          <Text style={styles.forecastDetailMessage}>
            {language === 'ar' ? forecast.messageAr : forecast.messageEn}
          </Text>

          {forecast.recommendedDailyReduction > 0 && (
            <View style={styles.reductionCard}>
              <Ionicons name="trending-down" size={18} color="#FF9800" />
              <Text style={styles.reductionText}>
                {language === 'ar'
                  ? `تقليل إنفاقك اليومي بـ ${forecast.recommendedDailyReduction.toFixed(1)} ${currencySymbol} سيحميك من نفاد المحفظة.`
                  : `Saving ${forecast.recommendedDailyReduction.toFixed(1)} ${currencySymbol} daily will keep your wallet funded.`}
              </Text>
            </View>
          )}
        </View>
      )}
    </>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    twoColumnSection: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 16,
      marginTop: 24,
      marginBottom: 24,
    },
    forecastDetailCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      marginHorizontal: 20,
      marginBottom: 16,
      padding: 16,
      gap: 8,
    },
    forecastDetailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    forecastDetailTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
      textAlign: 'left',
    },
    forecastDetailMessage: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'left',
      lineHeight: 18,
    },
    reductionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FF980012',
      borderWidth: 1,
      borderColor: '#FF980030',
      borderRadius: 10,
      padding: 10,
      gap: 8,
      marginTop: 4,
    },
    reductionText: {
      flex: 1,
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: '#D48000',
      textAlign: 'left',
      lineHeight: 16,
    },
  });
