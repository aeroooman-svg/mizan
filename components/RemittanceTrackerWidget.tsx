import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { RemittanceStats } from '@/lib/remittanceStorage';
import { formatCurrency } from '@/lib/categories';

interface RemittanceTrackerWidgetProps {
  stats: RemittanceStats;
  currencySymbol: string;
  onSendPress: () => void;
}

export default function RemittanceTrackerWidget({
  stats,
  currencySymbol,
  onSendPress,
}: RemittanceTrackerWidgetProps) {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);

  if (!stats || !stats.latestRemittance) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="paper-plane" size={18} color="#3B82F6" />
            </View>
            <View>
              <Text style={styles.title}>
                {language === 'ar' ? 'حوالات المغتربين والبيت' : 'Expat Family Remittance'}
              </Text>
              <Text style={styles.subtitle}>
                {language === 'ar' ? 'تتبع مصاريف الحوالة العابرة للحدود' : 'Track cross-border remittances'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSendPress();
            }}
            style={styles.actionBtn}
          >
            <Ionicons name="add-circle" size={18} color="#3B82F6" />
            <Text style={styles.actionBtnText}>
              {language === 'ar' ? 'حوالة جديد' : 'New'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {language === 'ar'
              ? 'لم يتم تسجيل حوالة عائلية مؤخراً لهذه المحفظة.'
              : 'No family remittance registered for this wallet yet.'}
          </Text>
        </View>
      </View>
    );
  }

  const { latestRemittance, totalReceived, totalSpentSinceRemittance, remainingBalance, spentPercentage, estimatedDaysRunway } = stats;

  const isLowRunway = estimatedDaysRunway <= 7;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="paper-plane" size={18} color="#3B82F6" />
          </View>
          <View>
            <Text style={styles.title}>
              {language === 'ar' ? 'متابعة حوالة البيت' : 'Home Remittance Tracker'}
            </Text>
            <Text style={styles.subtitle}>
              {language === 'ar'
                ? `حوالة: ${latestRemittance.fromAmount} ${latestRemittance.fromCurrency} ➔ ${formatCurrency(latestRemittance.toAmount)} ${latestRemittance.toCurrency}`
                : `Remittance: ${latestRemittance.fromAmount} ${latestRemittance.fromCurrency} ➔ ${formatCurrency(latestRemittance.toAmount)} ${latestRemittance.toCurrency}`}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSendPress();
          }}
          style={styles.actionBtn}
        >
          <Ionicons name="paper-plane-outline" size={15} color="#3B82F6" />
          <Text style={styles.actionBtnText}>
            {language === 'ar' ? 'حوالة جديدة' : 'Remit'}
          </Text>
        </Pressable>
      </View>

      {/* Main Amounts Grid */}
      <View style={styles.amountsRow}>
        <View style={styles.amountCol}>
          <Text style={styles.amountLabel}>{language === 'ar' ? 'الحوالة المستلمة' : 'Received'}</Text>
          <Text style={[styles.amountValue, { color: '#3B82F6' }]}>
            {formatCurrency(totalReceived)} <Text style={styles.currency}>{currencySymbol}</Text>
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.amountCol}>
          <Text style={styles.amountLabel}>{language === 'ar' ? 'المصروف حتى الآن' : 'Spent'}</Text>
          <Text style={[styles.amountValue, { color: colors.expense }]}>
            {formatCurrency(totalSpentSinceRemittance)} <Text style={styles.currency}>{currencySymbol}</Text>
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.amountCol}>
          <Text style={styles.amountLabel}>{language === 'ar' ? 'المتبقي للبيت' : 'Remaining'}</Text>
          <Text style={[styles.amountValue, { color: '#10B981' }]}>
            {formatCurrency(remainingBalance)} <Text style={styles.currency}>{currencySymbol}</Text>
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${spentPercentage}%`,
                backgroundColor: spentPercentage > 85 ? '#EF4444' : spentPercentage > 60 ? '#F59E0B' : '#10B981',
              },
            ]}
          />
        </View>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressText}>
            {language === 'ar' ? `استهلاك الحوالة: ${spentPercentage}%` : `Consumed: ${spentPercentage}%`}
          </Text>
          <Text style={styles.progressText}>
            {language === 'ar' ? `المتبقي: ${100 - spentPercentage}%` : `Left: ${100 - spentPercentage}%`}
          </Text>
        </View>
      </View>

      {/* Runway Forecast Banner */}
      <View style={[styles.runwayBanner, { backgroundColor: isLowRunway ? '#EF444415' : '#10B98115' }]}>
        <Ionicons
          name={isLowRunway ? 'alert-circle-outline' : 'time-outline'}
          size={18}
          color={isLowRunway ? '#EF4444' : '#10B981'}
        />
        <Text style={[styles.runwayText, { color: isLowRunway ? '#EF4444' : '#10B981' }]}>
          {isLowRunway
            ? language === 'ar'
              ? `⚠️ تنبيه: رصيد الحوالة يكفي لـ ${estimatedDaysRunway} أيام فقط (تخطيط الحوالة القادمة)`
              : `⚠️ Warning: Remittance funds cover ~${estimatedDaysRunway} days left`
            : language === 'ar'
            ? `✨ السيولة الحالية للبيت كافية حتى ${estimatedDaysRunway} يوماً قادماً`
            : `✨ Current home liquidity covers ~${estimatedDaysRunway} days ahead`}
        </Text>
      </View>
    </View>
  );
}

const getStyles = (colors: any, theme: string) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 16,
      marginHorizontal: 20,
      marginTop: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: '#3B82F615',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 14,
      fontFamily: 'Cairo_700Bold',
      color: colors.text,
    },
    subtitle: {
      fontSize: 11,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#3B82F615',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    actionBtnText: {
      fontSize: 12,
      fontFamily: 'Cairo_700Bold',
      color: '#3B82F6',
    },
    emptyBox: {
      paddingVertical: 8,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 12,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    amountsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      padding: 12,
      borderRadius: 14,
    },
    amountCol: {
      flex: 1,
      alignItems: 'center',
    },
    amountLabel: {
      fontSize: 10,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    amountValue: {
      fontSize: 14,
      fontFamily: 'Cairo_700Bold',
    },
    currency: {
      fontSize: 10,
      fontFamily: 'Cairo_600SemiBold',
    },
    divider: {
      width: 1,
      height: '70%',
      backgroundColor: colors.border,
    },
    progressContainer: {
      gap: 4,
    },
    progressBarBg: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressText: {
      fontSize: 11,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
    },
    runwayBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },
    runwayText: {
      flex: 1,
      fontSize: 11,
      fontFamily: 'Cairo_700Bold',
      lineHeight: 16,
    },
  });
