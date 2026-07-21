import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';
import { parseBankStatementText, ParsedStatementTransaction } from '@/lib/statementParser';

export default function ImportStatementScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const { selectedWallet, addTransaction, refresh } = useTransactions();

  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedStatementTransaction[]>([]);
  const [isParsed, setIsParsed] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleParse = () => {
    if (!rawText.trim()) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Warning',
        language === 'ar' ? 'يرجى لصق نص الكشف البنكي أو محتوى CSV أولاً' : 'Please paste bank statement CSV text first'
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const items = parseBankStatementText(rawText);
    if (items.length === 0) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Warning',
        language === 'ar' ? 'لم يتم العثور على معاملات صالحة في النص المدخل' : 'No valid transactions found in text'
      );
      return;
    }

    setParsedItems(items);
    setIsParsed(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleSelect = (id: string) => {
    Haptics.selectionAsync();
    setParsedItems(prev =>
      prev.map(item => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const toggleSelectAll = () => {
    Haptics.selectionAsync();
    const allSelected = parsedItems.every(i => i.selected);
    setParsedItems(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  const handleImport = async () => {
    const selectedToImport = parsedItems.filter(i => i.selected);
    if (selectedToImport.length === 0) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Warning',
        language === 'ar' ? 'يرجى تحديد معاملة واحدة على الأقل للاستيراد' : 'Select at least 1 transaction'
      );
      return;
    }

    if (!selectedWallet) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'يرجى اختيار محفظة أولاً' : 'Please select a wallet first'
      );
      return;
    }

    setIsImporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      for (const item of selectedToImport) {
        await addTransaction({
          id: item.id || `stmt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          amount: item.amount,
          type: item.type,
          category: item.categoryId,
          description: item.description,
          date: item.date,
          createdAt: new Date().toISOString(),
          walletId: selectedWallet.id,
        });
      }

      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        language === 'ar' ? 'تم الاستيراد بنجاح! 🎉' : 'Import Successful! 🎉',
        language === 'ar'
          ? `تم إضافة ${selectedToImport.length} معاملة بنجاح إلى محفظة ${selectedWallet.name}`
          : `Successfully imported ${selectedToImport.length} transactions to ${selectedWallet.name}`,
        [
          {
            text: language === 'ar' ? 'حسناً' : 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء حفظ المعاملات' : 'Failed to import transactions'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const sampleCsvData = `Date,Description,Amount,Type\n2026-07-15,Uber Ride,85.00,Debit\n2026-07-16,Carrefour Grocery,420.50,Debit\n2026-07-18,Monthly Salary,15000.00,Credit\n2026-07-19,Vodafone Bill,210.00,Debit`;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {language === 'ar' ? '📄 استيراد كشف حساب بنكي' : '📄 Import Bank Statement'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!isParsed ? (
          <>
            <View style={styles.infoCard}>
              <Ionicons name="document-text" size={32} color={colors.primary} />
              <Text style={styles.infoTitle}>
                {language === 'ar' ? 'استيراد المعاملات بنقرة واحدة' : 'Bulk Import Bank Transactions'}
              </Text>
              <Text style={styles.infoSub}>
                {language === 'ar'
                  ? 'انسخ وانقش محتوى كشف الحساب البنكي (CSV أو نص المعاملات) وسيتم تصنيف المبالغ والتواريخ تلقائياً.'
                  : 'Paste your CSV bank statement or transaction logs text. Amounts, dates, and categories will be detected automatically.'}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.inputLabel}>
                {language === 'ar' ? 'نص الكشف البنكي أو محتوى CSV:' : 'Bank Statement CSV or Raw Text:'}
              </Text>
              <TextInput
                style={[styles.textArea, language === 'ar' ? styles.inputAr : styles.inputEn]}
                placeholder={sampleCsvData}
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={8}
                value={rawText}
                onChangeText={setRawText}
              />

              <Pressable
                onPress={() => setRawText(sampleCsvData)}
                style={styles.sampleBtn}
              >
                <Text style={styles.sampleBtnText}>
                  {language === 'ar' ? '💡 استخدام نموذج تجريبي' : '💡 Load Sample Data'}
                </Text>
              </Pressable>

              <Pressable onPress={handleParse} style={styles.primaryBtn}>
                <Ionicons name="search" size={20} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>
                  {language === 'ar' ? 'تحليل ومعاينة المعاملات' : 'Parse & Preview'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.summaryBar}>
              <Text style={styles.summaryText}>
                {language === 'ar'
                  ? `تم العثور على ${parsedItems.length} معاملة (${parsedItems.filter(i => i.selected).length} محددة)`
                  : `Found ${parsedItems.length} transactions (${parsedItems.filter(i => i.selected).length} selected)`}
              </Text>
              <Pressable onPress={toggleSelectAll} style={styles.selectAllBtn}>
                <Text style={styles.selectAllText}>
                  {parsedItems.every(i => i.selected)
                    ? (language === 'ar' ? 'إلغاء التحديد' : 'Deselect All')
                    : (language === 'ar' ? 'تحديد الكل' : 'Select All')}
                </Text>
              </Pressable>
            </View>

            {parsedItems.map(item => {
              const category = getCategoryById(item.categoryId);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleSelect(item.id)}
                  style={[
                    styles.itemCard,
                    item.selected && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                  ]}
                >
                  <Ionicons
                    name={item.selected ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={item.selected ? colors.primary : colors.textTertiary}
                  />
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={styles.itemDesc} numberOfLines={1}>
                      {item.description}
                    </Text>
                    <Text style={styles.itemSub}>
                      {item.date} • {getCategoryName(item.categoryId, language)}
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { color: item.type === 'income' ? '#10B981' : colors.text }]}>
                    {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)} {selectedWallet?.currency}
                  </Text>
                </Pressable>
              );
            })}

            <View style={styles.actionRow}>
              <Pressable onPress={() => setIsParsed(false)} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>
                  {language === 'ar' ? 'تعديل النص' : 'Edit Text'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleImport}
                disabled={isImporting}
                style={[styles.primaryBtn, { flex: 2 }]}
              >
                <Ionicons name="download" size={20} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>
                  {isImporting
                    ? (language === 'ar' ? 'جاري الاستيراد...' : 'Importing...')
                    : (language === 'ar' ? 'حفظ المعاملات المختارة' : 'Import Selected')}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  infoSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
    marginBottom: 10,
    textAlign: 'left',
  },
  textArea: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: '#FFF',
    minHeight: 140,
    textAlignVertical: 'top',
  },
  inputAr: { textAlign: 'right' },
  inputEn: { textAlign: 'left' },
  sampleBtn: {
    alignSelf: 'flex-start',
    marginVertical: 12,
  },
  sampleBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.primary,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  summaryText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  selectAllBtn: {
    padding: 6,
  },
  selectAllText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  itemDesc: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  itemSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  itemAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
  },
});
