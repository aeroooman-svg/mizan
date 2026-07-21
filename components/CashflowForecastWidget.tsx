import React, { useMemo } from 'react';
import { useTheme } from '@/lib/ThemeContext';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Colors from '@/constants/colors';
import { formatCurrency } from '@/lib/categories';

interface CashflowForecast {
  status: 'safe' | 'risk' | 'depleted';
  daysRemaining: number;
  depletionDate: Date | null;
  messageAr: string;
  messageEn: string;
  recommendedDailyReduction: number;
}

interface CashflowForecastWidgetProps {
  selectedWalletBalance: number;
  currencySymbol: string;
  balance: number;
  forecast: CashflowForecast | null;
  language: 'ar' | 'en';
  onPress?: () => void;
}

export default function CashflowForecastWidget({
  selectedWalletBalance,
  currencySymbol,
  balance,
  forecast,
  language,
  onPress,
}: CashflowForecastWidgetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  
  const isSafe = forecast?.status === 'safe';
  const isRisk = forecast?.status === 'risk';
  
  const statusColor = isSafe ? '#10B981' : isRisk ? '#FF9800' : '#EF4444';
  const statusBg = isSafe ? '#10B98115' : isRisk ? '#FF980015' : '#EF444415';
  
  const statusText = isSafe
    ? (language === 'ar' ? '✅ الوضع المالي آمن' : '✅ STATUS SAFE')
    : isRisk
      ? (language === 'ar' ? `⚠️ نفاد خلال ${forecast.daysRemaining} يوم` : `⚠️ Runout in ${forecast.daysRemaining}d`)
      : (language === 'ar' ? '🚨 الرصيد منتهٍ!' : '🚨 BALANCE DEPLETED');

  return (
    <Pressable 
      style={({ pressed }) => [styles.forecastCard2Col, pressed && { opacity: 0.95 }]}
      onPress={onPress}
    >
      <Text style={styles.cardHeaderTitle2Col}>
        {language === 'ar' ? 'توقعات السيولة' : 'CASHFLOW FORECAST'}
      </Text>
      
      <View style={styles.forecastSummaryRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.forecastSubLabel}>{language === 'ar' ? 'إجمالي الرصيد' : 'TOTAL BALANCE'}</Text>
          <Text style={styles.forecastValueText} numberOfLines={1}>
            {formatCurrency(selectedWalletBalance, language)} <Text style={{ fontSize: 9 }}>{currencySymbol}</Text>
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
          <Text style={styles.forecastSubLabel}>{language === 'ar' ? 'التدفق الصافي' : 'NET FLOW'}</Text>
          <Text 
            style={[
              styles.forecastNetFlowText, 
              { color: balance >= 0 ? '#10B981' : '#EF4444' }
            ]}
            numberOfLines={1}
          >
            {balance >= 0 ? '+' : ''}{formatCurrency(balance, language)}
          </Text>
        </View>
      </View>

      <View style={[styles.forecastBadge, { backgroundColor: statusBg }]}>
        <Text style={[styles.forecastBadgeText, { color: statusColor }]}>
          {statusText}
        </Text>
      </View>
    </Pressable>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  forecastCard2Col: {
    flex: 1.15,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
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
    textAlign: 'left',
  },
  forecastSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  forecastSubLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 9,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 2,
    textAlign: 'left',
  },
  forecastValueText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
    textAlign: 'left',
  },
  forecastNetFlowText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    textAlign: 'right',
  },
  forecastBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  forecastBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
