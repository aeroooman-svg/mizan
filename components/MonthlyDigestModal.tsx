import React from 'react';
import { StyleSheet, Text, View, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { MonthlyReportData } from '@/lib/monthlyReport';
import { formatCurrency } from '@/lib/categories';

interface MonthlyDigestModalProps {
  visible: boolean;
  data: MonthlyReportData | null;
  currencySymbol: string;
  language: 'ar' | 'en';
  onClose: () => void;
}

export default function MonthlyDigestModal({
  visible,
  data,
  currencySymbol,
  language,
  onClose,
}: MonthlyDigestModalProps) {
  if (!visible || !data) return null;

  const isAr = language === 'ar';

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="sparkles" size={24} color={Colors.accent} />
              <Text style={styles.title}>
                {isAr ? `التقرير الشهري — ${data.monthName} ${data.year}` : `Monthly Digest — ${data.monthName} ${data.year}`}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close-circle" size={24} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Net Savings Metric Card */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>
                {isAr ? 'الصافي الادخاري' : 'Net Savings'}
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: data.netSavings >= 0 ? Colors.income : Colors.expense },
                ]}
              >
                {formatCurrency(data.netSavings, language)} {currencySymbol}
              </Text>
              <Text style={styles.metricSub}>
                {isAr
                  ? `معدل الادخار: ${data.savingsRatePercent}% من الدخل`
                  : `Savings Rate: ${data.savingsRatePercent}% of income`}
              </Text>
            </View>

            {/* Income & Expense Row */}
            <View style={styles.twoCol}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{isAr ? 'إجمالي الدخل' : 'Total Income'}</Text>
                <Text style={[styles.statValue, { color: Colors.income }]}>
                  {formatCurrency(data.totalIncome, language)} {currencySymbol}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{isAr ? 'إجمالي المصاريف' : 'Total Expenses'}</Text>
                <Text style={[styles.statValue, { color: Colors.expense }]}>
                  {formatCurrency(data.totalExpense, language)} {currencySymbol}
                </Text>
              </View>
            </View>

            {/* Top Spending Category */}
            <View style={styles.infoBox}>
              <Ionicons name="pie-chart-outline" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>{isAr ? 'أعلى فئة إنفاق' : 'Top Expense Category'}</Text>
                <Text style={styles.infoValue}>
                  {data.topCategoryName} — {formatCurrency(data.topCategoryAmount, language)} {currencySymbol}
                </Text>
              </View>
            </View>

            {/* Automated Insights List */}
            <View style={styles.insightsSection}>
              <Text style={styles.insightsHeader}>
                {isAr ? '💡 تحليلات وملاحظات ذكية' : '💡 Smart Insights'}
              </Text>
              {(isAr ? data.insightsAr : data.insightsEn).map((insight, idx) => (
                <View key={idx} style={styles.insightRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={Colors.primary} />
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{isAr ? 'تم وموافق' : 'Got it'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
  scroll: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: '#94A3B8',
  },
  metricValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 26,
  },
  metricSub: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#CBD5E1',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  statLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'left',
  },
  statValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    textAlign: 'left',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  infoTitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'left',
  },
  infoValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
    textAlign: 'left',
  },
  insightsSection: {
    gap: 8,
    marginTop: 4,
  },
  insightsHeader: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
    textAlign: 'left',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightText: {
    flex: 1,
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
    textAlign: 'left',
  },
  closeBtn: {
    backgroundColor: Colors.primary,
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
