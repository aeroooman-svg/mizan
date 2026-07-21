import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { formatCurrency } from '@/lib/categories';

interface ConsolidatedBalanceCardProps {
  totalConsolidatedBalance: number;
  currencySymbol: string;
  language: 'ar' | 'en';
  colors: any;
}

export default function ConsolidatedBalanceCard({
  totalConsolidatedBalance,
  currencySymbol,
  language,
  colors,
}: ConsolidatedBalanceCardProps) {
  const styles = getStyles(colors);

  return (
    <View style={styles.consolidatedCard}>
      <View style={styles.consolidatedHeader}>
        <Ionicons name="stats-chart" size={14} color={Colors.primary} />
        <Text style={styles.consolidatedLabel}>
          {language === 'ar' ? 'إجمالي الثروة الموحدة' : 'Consolidated Net Worth'}
        </Text>
      </View>
      <Text style={styles.consolidatedValue}>
        {formatCurrency(totalConsolidatedBalance, language)}{' '}
        <Text style={{ fontSize: 14, fontFamily: 'Cairo_600SemiBold' }}>
          {currencySymbol}
        </Text>
      </Text>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    consolidatedCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      marginHorizontal: 20,
      marginTop: 15,
      marginBottom: 5,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.04)',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
    },
    consolidatedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    consolidatedLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    consolidatedValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 24,
      color: colors.text,
    },
  });
