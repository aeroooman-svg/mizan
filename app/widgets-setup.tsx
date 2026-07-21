import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
import { getWidgetData, exportWidgetNativePayload } from '@/lib/widgetDataProvider';

export default function WidgetsSetupScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const { transactions, wallets, selectedWallet, balance, totalExpense } = useTransactions();

  const [selectedWidgetSize, setSelectedWidgetSize] = useState<'small' | 'medium' | 'large'>('medium');

  const widgetData = useMemo(() => {
    return getWidgetData(
      transactions,
      wallets,
      selectedWallet,
      85,
      {},
      selectedWallet?.currency || 'EGP'
    );
  }, [transactions, wallets, selectedWallet]);

  const payload = exportWidgetNativePayload(widgetData);

  const copyPayload = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(payload);
    Alert.alert(
      language === 'ar' ? 'تم نسخ رمز التزامن' : 'Widget Data Copied',
      language === 'ar'
        ? 'تم نسخ حزمة بيانات الويدجت للتزامن التلقائي على الشاشة الرئيسية'
        : 'Live widget JSON payload copied to clipboard'
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {language === 'ar' ? '📱 ودجت الشاشة الرئيسية' : '📱 Home Screen Widgets'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Intro */}
        <View style={styles.infoCard}>
          <Ionicons name="hardware-chip-outline" size={36} color={colors.primary} />
          <Text style={styles.infoTitle}>
            {language === 'ar' ? 'تابع ميزانيتك مباشرة من شاشة الهاتف' : 'Track Balance Live on Home Screen'}
          </Text>
          <Text style={styles.infoSub}>
            {language === 'ar'
              ? 'تتيح لك ودجت ميزان متابعة رصيدك والمصروف اليومي وإضافة معاملة بنقرة واحدة من شاشة هاتف الرئيسية (iOS & Android).'
              : 'MIZAN Live Widget lets you monitor current balance, today spending, and quick actions directly from your phone home screen.'}
          </Text>
        </View>

        {/* Size Selector */}
        <View style={styles.sizeSelectorRow}>
          {(['small', 'medium', 'large'] as const).map(sz => (
            <Pressable
              key={sz}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedWidgetSize(sz);
              }}
              style={[
                styles.sizeBtn,
                selectedWidgetSize === sz && { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
              ]}
            >
              <Text style={[styles.sizeBtnText, selectedWidgetSize === sz && { color: colors.primary }]}>
                {sz === 'small' ? (language === 'ar' ? 'صغير (Small)' : 'Small') :
                 sz === 'medium' ? (language === 'ar' ? 'متوسط (Medium)' : 'Medium') :
                 (language === 'ar' ? 'كبير (Large)' : 'Large')}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Live Widget Interactive Preview */}
        <Text style={styles.sectionTitle}>
          {language === 'ar' ? 'معاينة شكل الويدجت التفاعلي:' : 'Live Widget Preview:'}
        </Text>

        <View style={[styles.widgetPreviewBox, selectedWidgetSize === 'small' && { height: 140, width: 160, alignSelf: 'center' }]}>
          <View style={styles.widgetHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="scale-outline" size={16} color={colors.primary} />
              <Text style={styles.widgetAppName}>ميزان MIZAN</Text>
            </View>
            <Text style={styles.widgetWalletName}>{widgetData.walletName}</Text>
          </View>

          <View style={styles.widgetBalanceRow}>
            <Text style={styles.widgetBalanceLabel}>
              {language === 'ar' ? 'الرصيد المتبقي' : 'Balance'}
            </Text>
            <Text style={styles.widgetBalanceVal}>
              {formatCurrency(balance)} {selectedWallet?.currency}
            </Text>
          </View>

          {selectedWidgetSize !== 'small' && (
            <View style={styles.widgetDetailsRow}>
              <View style={styles.widgetStatCol}>
                <Text style={styles.widgetStatLabel}>{language === 'ar' ? 'صرفت اليوم' : 'Today Spent'}</Text>
                <Text style={[styles.widgetStatVal, { color: colors.expense }]}>
                  {formatCurrency(widgetData.todaySpent)} {selectedWallet?.currency}
                </Text>
              </View>

              <View style={styles.widgetStatCol}>
                <Text style={styles.widgetStatLabel}>{language === 'ar' ? 'مؤشر الصحة' : 'Health'}</Text>
                <Text style={[styles.widgetStatVal, { color: colors.income }]}>
                  {widgetData.healthScore}/100
                </Text>
              </View>
            </View>
          )}

          <View style={styles.widgetQuickBtnRow}>
            <Pressable style={styles.widgetQuickBtn}>
              <Ionicons name="add" size={14} color="#FFF" />
              <Text style={styles.widgetQuickBtnText}>{language === 'ar' ? 'إضافة' : 'Add'}</Text>
            </Pressable>
            <Pressable style={[styles.widgetQuickBtn, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="card-outline" size={14} color={colors.text} />
              <Text style={[styles.widgetQuickBtnText, { color: colors.text }]}>{language === 'ar' ? 'أقساط' : 'Pay'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Sync & Setup Button */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {language === 'ar' ? '🔄 مزامنة ودجت الهاتف' : '🔄 Sync Phone Widget'}
          </Text>
          <Text style={styles.cardSub}>
            {language === 'ar'
              ? 'اضغط أدناه لنسخ وحفظ رمز البيانات التفاعلية لتأكيده على الشاشة الرئيسية'
              : 'Copy widget live data payload for Android/iOS homescreen sync'}
          </Text>

          <Pressable onPress={copyPayload} style={styles.primaryBtn}>
            <Ionicons name="sync" size={20} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.primaryBtnText}>
              {language === 'ar' ? 'مزامنة ونسخ بيانات الويدجت' : 'Sync & Copy Data'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  infoCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
  },
  infoSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  sizeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  sizeBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
    textAlign: 'left',
  },
  widgetPreviewBox: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.primary + '50',
    gap: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  widgetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  widgetAppName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.primary,
  },
  widgetWalletName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  widgetBalanceRow: {
    alignItems: 'center',
  },
  widgetBalanceLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  widgetBalanceVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: '#FFF',
  },
  widgetDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 10,
  },
  widgetStatCol: {
    alignItems: 'center',
  },
  widgetStatLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textSecondary,
  },
  widgetStatVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  widgetQuickBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  widgetQuickBtn: {
    flex: 1,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  widgetQuickBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: '#FFF',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
    textAlign: 'left',
  },
  cardSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
