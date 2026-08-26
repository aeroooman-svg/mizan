import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { MonthlyReportData, generateMonthlyReport } from '@/lib/monthlyReport';
import { formatCurrency } from '@/lib/categories';
import { Transaction, Wallet } from '@/lib/storage';

interface MonthlyDigestModalProps {
  visible: boolean;
  transactions: Transaction[];
  selectedWallet: Wallet | null;
  currencySymbol: string;
  language: 'ar' | 'en';
  onClose: () => void;
}

export default function MonthlyDigestModal({
  visible,
  transactions,
  selectedWallet,
  currencySymbol,
  language,
  onClose,
}: MonthlyDigestModalProps) {
  const { colors } = useTheme();
  const isAr = language === 'ar';

  const today = useMemo(() => new Date(), []);
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0); // 0 = current, -1 = last month, -2 = 2 months ago

  const targetDate = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + selectedMonthOffset, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [today, selectedMonthOffset]);

  const reportData: MonthlyReportData = useMemo(() => {
    return generateMonthlyReport(
      transactions,
      selectedWallet,
      targetDate.year,
      targetDate.month,
      language
    );
  }, [transactions, selectedWallet, targetDate, language]);

  const styles = useMemo(() => getStyles(colors, isAr), [colors, isAr]);

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="sparkles" size={20} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.title}>
                  {isAr ? 'التقرير المالي الشهري 📊' : 'Monthly Financial Digest 📊'}
                </Text>
                <Text style={styles.subTitle}>
                  {reportData.monthName} {reportData.year}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
              }}
              hitSlop={12}
              style={styles.closeIconBtn}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Month Selector Tabs */}
          <View style={styles.monthTabs}>
            {[
              { offset: -2, labelAr: 'قبل شهرين', labelEn: '2 Months Ago' },
              { offset: -1, labelAr: 'الشهر الماضي', labelEn: 'Last Month' },
              { offset: 0, labelAr: 'الشهر الحالي', labelEn: 'This Month' },
            ].map((tab) => {
              const isSelected = selectedMonthOffset === tab.offset;
              return (
                <Pressable
                  key={tab.offset}
                  style={[
                    styles.monthTabBtn,
                    isSelected && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedMonthOffset(tab.offset);
                  }}
                >
                  <Text
                    style={[
                      styles.monthTabText,
                      isSelected ? { color: '#FFF', fontFamily: 'Cairo_700Bold' } : { color: colors.textSecondary },
                    ]}
                  >
                    {isAr ? tab.labelAr : tab.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Net Savings Metric Card */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>
                {isAr ? 'صافي الادخار لهذا الشهر' : 'Net Monthly Savings'}
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: reportData.netSavings >= 0 ? '#10B981' : '#EF4444' },
                ]}
              >
                {formatCurrency(reportData.netSavings, language)} {currencySymbol}
              </Text>
              <View style={styles.savingsRateBadge}>
                <Ionicons
                  name={reportData.savingsRatePercent >= 20 ? 'shield-checkmark' : 'information-circle-outline'}
                  size={14}
                  color={reportData.savingsRatePercent >= 20 ? '#10B981' : '#F59E0B'}
                />
                <Text style={styles.metricSub}>
                  {isAr
                    ? `معدل التوفير: ${reportData.savingsRatePercent}% من إجمالي الدخل`
                    : `Savings Rate: ${reportData.savingsRatePercent}% of total income`}
                </Text>
              </View>
            </View>

            {/* Income & Expense Comparative Row */}
            <View style={styles.twoCol}>
              <View style={[styles.statBox, { borderLeftColor: '#10B981', borderLeftWidth: 4 }]}>
                <View style={styles.statIconRow}>
                  <Ionicons name="arrow-down-circle" size={18} color="#10B981" />
                  <Text style={styles.statLabel}>{isAr ? 'إجمالي الدخل' : 'Total Income'}</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatCurrency(reportData.totalIncome, language)} {currencySymbol}
                </Text>
              </View>

              <View style={[styles.statBox, { borderLeftColor: '#EF4444', borderLeftWidth: 4 }]}>
                <View style={styles.statIconRow}>
                  <Ionicons name="arrow-up-circle" size={18} color="#EF4444" />
                  <Text style={styles.statLabel}>{isAr ? 'إجمالي المصاريف' : 'Total Expenses'}</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatCurrency(reportData.totalExpense, language)} {currencySymbol}
                </Text>
              </View>
            </View>

            {/* Jameya Savings Dedicated Asset Box */}
            {reportData.totalJameyaSavings > 0 && (
              <View style={[styles.infoBox, { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
                <View style={[styles.infoIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="people" size={18} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>{isAr ? '🤝 مدفوعات ادخار الجمعيات' : '🤝 Jameya Savings Asset'}</Text>
                  <Text style={[styles.infoValue, { color: '#10B981' }]}>
                    +{formatCurrency(reportData.totalJameyaSavings, language)} {currencySymbol}
                  </Text>
                </View>
              </View>
            )}

            {/* Top Spending Category */}
            <View style={styles.infoBox}>
              <View style={styles.infoIconCircle}>
                <Ionicons name="pie-chart" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>{isAr ? 'أعلى فئة إنفاق في هذا الشهر' : 'Top Spending Category'}</Text>
                <Text style={styles.infoValue}>
                  {reportData.topCategoryName}{' '}
                  {reportData.topCategoryAmount > 0 ? `(${formatCurrency(reportData.topCategoryAmount, language)} ${currencySymbol})` : ''}
                </Text>
              </View>
            </View>

            {/* Automated Smart Insights List */}
            <View style={styles.insightsSection}>
              <View style={styles.insightsTitleRow}>
                <Ionicons name="bulb-outline" size={18} color="#F59E0B" />
                <Text style={styles.insightsHeader}>
                  {isAr ? 'تحليلات وتوصيات ذكية' : 'Smart Financial Insights'}
                </Text>
              </View>

              {(isAr ? reportData.insightsAr : reportData.insightsEn).length === 0 ? (
                <View style={styles.emptyInsight}>
                  <Text style={styles.emptyInsightText}>
                    {isAr ? 'لا توجد بيانات كافية لاستخراج توصيات لهذا الشهر.' : 'Not enough transaction data for this month.'}
                  </Text>
                </View>
              ) : (
                (isAr ? reportData.insightsAr : reportData.insightsEn).map((insight, idx) => (
                  <View key={idx} style={styles.insightRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {/* Close Button */}
          <Pressable
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
          >
            <Text style={styles.closeBtnText}>{isAr ? 'إغلاق التقرير' : 'Close Digest'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, isAr: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    content: {
      width: '100%',
      maxHeight: '85%',
      backgroundColor: colors.surface || colors.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
        },
        android: {
          elevation: 10,
        },
      }),
    },
    header: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleRow: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    headerIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.text,
      textAlign: isAr ? 'right' : 'left',
    },
    subTitle: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: isAr ? 'right' : 'left',
    },
    closeIconBtn: {
      padding: 6,
      borderRadius: 20,
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.05)',
    },
    monthTabs: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.05)',
      borderRadius: 14,
      padding: 4,
      gap: 4,
    },
    monthTabBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthTabText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
    },
    scroll: {
      gap: 12,
      paddingBottom: 6,
    },
    metricCard: {
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.04)',
      borderRadius: 18,
      padding: 16,
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    metricValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 28,
    },
    savingsRateBadge: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.05)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
    },
    metricSub: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    twoCol: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      gap: 10,
    },
    statBox: {
      flex: 1,
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.03)',
      borderRadius: 14,
      padding: 12,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statIconRow: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
    },
    statLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    statValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      textAlign: isAr ? 'right' : 'left',
    },
    infoBox: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
      borderRadius: 14,
      padding: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    infoIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoTitle: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: isAr ? 'right' : 'left',
    },
    infoValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
      textAlign: isAr ? 'right' : 'left',
    },
    insightsSection: {
      gap: 8,
      backgroundColor: colors.surfaceAlt || 'rgba(255,255,255,0.03)',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    insightsTitleRow: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    insightsHeader: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
    },
    emptyInsight: {
      paddingVertical: 8,
      alignItems: 'center',
    },
    emptyInsightText: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    insightRow: {
      flexDirection: isAr ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    insightText: {
      flex: 1,
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.text,
      lineHeight: 18,
      textAlign: isAr ? 'right' : 'left',
    },
    closeBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: '#FFF',
    },
  });
