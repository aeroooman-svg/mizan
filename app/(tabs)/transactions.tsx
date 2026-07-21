import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Text,
  View,
  SectionList,
  FlatList,
  Pressable,
  Platform,
  Alert,
  TextInput,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById, expenseCategories, incomeCategories } from '@/lib/categories';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { getCategoryName, formatDateLocalized } from '@/lib/i18n';
import { Transaction } from '@/lib/storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

type FilterType = 'all' | 'income' | 'expense';

export default function TransactionsScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 10 : 0;
  const { walletTransactions, removeTransaction, currencySymbol, selectedWallet, wallets, customCategories, selectWallet } = useTransactions();
  const { t, language } = useLanguage();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  // Grouped Categories for filtering
  const allCategoriesForFilter = useMemo(() => {
    const staticCats = filter === 'income' ? incomeCategories : expenseCategories;
    const userCats = customCategories.filter(c => filter === 'all' || c.type === filter);
    const staticCombined = filter === 'all' ? [...expenseCategories, ...incomeCategories] : staticCats;
    
    const seen = new Set<string>();
    const uniqueCats: typeof staticCombined = [];
    [...staticCombined, ...userCats].forEach(c => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        uniqueCats.push(c);
      }
    });
    return uniqueCats;
  }, [filter, customCategories]);

  // Handle resetting category filter on filter type change
  const handleTypeFilterChange = (newType: FilterType) => {
    Haptics.selectionAsync();
    setFilter(newType);
    setSelectedCategoryFilter(null);
  };

  const filteredTransactions = useMemo(() => {
    let result = walletTransactions;
    if (filter !== 'all') {
      result = result.filter(t => t.type === filter);
    }
    if (selectedCategoryFilter) {
      result = result.filter(t => t.category === selectedCategoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(t => {
        const catName = getCategoryName(t.category, language);
        return (
          catName.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          t.amount.toString().includes(q)
        );
      });
    }
    return result;
  }, [walletTransactions, filter, selectedCategoryFilter, searchQuery, language]);

  // Group Transactions by Date for SectionList
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(tx => {
      const dateKey = tx.date.split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(tx);
    });

    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return sortedDates.map(dateKey => {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let title = '';
      if (dateKey === todayStr) {
        title = language === 'ar' ? 'اليوم' : 'Today';
      } else if (dateKey === yesterdayStr) {
        title = language === 'ar' ? 'أمس' : 'Yesterday';
      } else {
        title = formatDateLocalized(dateKey, language);
      }

      return {
        title,
        data: groups[dateKey],
      };
    });
  }, [filteredTransactions, language]);

  const handleExportPDF = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const totalInc = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExp = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const bal = totalInc - totalExp;

    const title = language === 'ar' ? 'تقرير المعاملات المالية' : 'Financial Transactions Report';
    const walletName = selectedWallet?.name || (language === 'ar' ? 'المحفظة' : 'Wallet');
    const sym = currencySymbol;

    let rowsHtml = '';
    filteredTransactions.forEach((tx, idx) => {
      const catName = getCategoryName(tx.category, language);
      const dateStr = formatDateLocalized(tx.date, language);
      const isIncome = tx.type === 'income';
      const amountFormatted = `${isIncome ? '+' : '-'}${formatCurrency(tx.amount)} ${sym}`;
      const amountColor = isIncome ? '#0D7C66' : '#DC3545';
      
      rowsHtml += `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
          <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 13px;">${dateStr}</td>
          <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 13px;">${language === 'ar' ? (isIncome ? 'دخل' : 'مصروف') : tx.type}</td>
          <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 13px; font-weight: bold;">${catName}</td>
          <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 13px; color: #6c757d;">${tx.description || ''}</td>
          <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 14px; font-weight: bold; color: ${amountColor}; text-align: right;">${amountFormatted}</td>
        </tr>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1d26; margin: 0; padding: 30px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0D7C66; padding-bottom: 15px; margin-bottom: 30px; }
          .header-title { font-size: 26px; font-weight: bold; color: #0D7C66; margin: 0; }
          .header-meta { text-align: ${language === 'ar' ? 'left' : 'right'}; font-size: 12px; color: #6c757d; }
          .summary-box { display: flex; gap: 20px; margin-bottom: 30px; }
          .summary-card { flex: 1; background-color: #f0f2f5; border-radius: 10px; padding: 15px; text-align: center; }
          .summary-label { font-size: 12px; color: #6b7280; margin-bottom: 5px; }
          .summary-val { font-size: 18px; font-weight: bold; }
          .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #0D7C66; color: white; padding: 12px 10px; text-align: ${language === 'ar' ? 'right' : 'left'}; font-size: 13px; }
          .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="header-title">${title}</h1>
            <div style="font-size: 14px; margin-top: 5px; color: #4b5563;">${language === 'ar' ? 'محفظة' : 'Wallet'}: <strong>${walletName}</strong></div>
          </div>
          <div class="header-meta">
            <div>${language === 'ar' ? 'تاريخ التصدير' : 'Export Date'}: ${new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</div>
            <div>${language === 'ar' ? 'عدد المعاملات' : 'Transactions Count'}: ${filteredTransactions.length}</div>
          </div>
        </div>

        <div class="summary-box">
          <div class="summary-card">
            <div class="summary-label">${language === 'ar' ? 'إجمالي الدخل' : 'Total Income'}</div>
            <div class="summary-val" style="color: #0D7C66;">+${formatCurrency(totalInc)} ${sym}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">${language === 'ar' ? 'إجمالي المصاريف' : 'Total Expenses'}</div>
            <div class="summary-val" style="color: #DC3545;">-${formatCurrency(totalExp)} ${sym}</div>
          </div>
          <div class="summary-card" style="background-color: ${bal >= 0 ? '#E6F5F0' : '#FDE8EA'};">
            <div class="summary-label">${language === 'ar' ? 'صافي الرصيد' : 'Net Balance'}</div>
            <div class="summary-val" style="color: ${bal >= 0 ? '#0D7C66' : '#DC3545'};">${bal >= 0 ? '+' : ''}${formatCurrency(bal)} ${sym}</div>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>${language === 'ar' ? 'التاريخ' : 'Date'}</th>
              <th>${language === 'ar' ? 'النوع' : 'Type'}</th>
              <th>${language === 'ar' ? 'الفئة' : 'Category'}</th>
              <th>${language === 'ar' ? 'الوصف' : 'Description'}</th>
              <th style="text-align: right;">${language === 'ar' ? 'المبلغ' : 'Amount'}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          ${language === 'ar' ? 'تم إنشاء هذا التقرير تلقائياً بواسطة تطبيق مِيزان' : 'This report was auto-generated by MIZAN App'}
        </div>
      </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        const { uri } = await Print.printToFileAsync({ html });
        const link = document.createElement('a');
        link.href = uri;
        link.download = `report_${selectedWallet?.name || 'wallet'}.pdf`;
        link.click();
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Report PDF' });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not generate PDF');
    }
  };

  const handleExportCSV = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    let csv = 'ID,Date,Type,Category,Amount,Description\n';
    
    filteredTransactions.forEach((tx) => {
      const catName = getCategoryName(tx.category, language);
      const row = [
        tx.id,
        tx.date,
        tx.type,
        `"${catName.replace(/"/g, '""')}"`,
        tx.amount,
        `"${(tx.description || '').replace(/"/g, '""')}"`
      ].join(',');
      csv += row + '\n';
    });

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions_${selectedWallet?.name || 'wallet'}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      Alert.alert('✅', t.exportSuccess);
    } else {
      const { uri } = await Print.printToFileAsync({ html: `<pre>${csv}</pre>` });
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Share CSV Report' });
    }
  };

  const handleExport = () => {
    Alert.alert(
      language === 'ar' ? 'تصدير البيانات' : 'Export Data',
      language === 'ar' ? 'اختر صيغة الملف المراد تصديره:' : 'Choose the export format:',
      [
        { text: 'PDF Document', onPress: handleExportPDF },
        { text: 'CSV Spreadsheet', onPress: handleExportCSV },
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleLongPress = (item: Transaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const catName = getCategoryName(item.category, language);
    Alert.alert(
      language === 'ar' ? 'خيارات المعاملة' : 'Transaction Options',
      `${catName}: ${formatCurrency(item.amount)} ${currencySymbol}`,
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: t.edit,
          onPress: () => {
            router.push({
              pathname: '/add-transaction',
              params: { editId: item.id },
            });
          },
        },
        {
          text: t.delete,
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t.deleteTransaction,
              t.deleteTransactionConfirm
                .replace('{category}', catName)
                .replace('{amount}', formatCurrency(item.amount))
                .replace('{currency}', currencySymbol),
              [
                { text: t.cancel, style: 'cancel' },
                {
                  text: t.delete,
                  style: 'destructive',
                  onPress: () => removeTransaction(item.id),
                },
              ],
            );
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const isTransfer = item.type === 'transfer';
    const isIncomingTransfer = isTransfer && item.toWalletId === selectedWallet?.id;
    const cat = isTransfer 
      ? { icon: 'swap-horiz', color: isIncomingTransfer ? '#3b82f6' : '#94a3b8' } 
      : getCategoryById(item.category);

    let categoryName = getCategoryName(item.category, language);
    if (isTransfer) {
      if (isIncomingTransfer) {
        const fromWalletName = wallets.find(w => w.id === item.walletId)?.name || '';
        categoryName = language === 'ar' ? `تحويل من ${fromWalletName}` : `Transfer from ${fromWalletName}`;
      } else {
        const toWalletName = wallets.find(w => w.id === item.toWalletId)?.name || '';
        categoryName = language === 'ar' ? `تحويل إلى ${toWalletName}` : `Transfer to ${toWalletName}`;
      }
    }

    return (
      <Pressable
        style={({ pressed }) => [styles.transactionCard, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
        onLongPress={() => handleLongPress(item)}
        onPress={() => handleLongPress(item)}
      >
        <View style={[styles.catIconWrap, { backgroundColor: (cat?.color || '#999') + '15' }]}>
          <MaterialIcons name={cat?.icon as any || 'receipt'} size={20} color={cat?.color || '#999'} />
        </View>
        
        <View style={styles.transactionMiddle}>
          <Text style={styles.transactionCatName}>{categoryName}</Text>
          <View style={styles.metaRow}>
            {item.addedBy && (
              <View style={styles.addedByBadge}>
                <Ionicons name="person-outline" size={8} color={colors.primary} />
                <Text style={styles.addedByText}>{item.addedBy}</Text>
              </View>
            )}
            {item.description ? (
              <Text style={styles.transactionDesc} numberOfLines={1}>{item.description}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.transactionRight}>
          <Text style={[
            styles.transactionAmount, 
            { 
              color: isTransfer 
                ? (isIncomingTransfer ? '#3b82f6' : '#94a3b8') 
                : (item.type === 'income' ? colors.income : colors.expense) 
            }
          ]}>
            {isTransfer 
              ? (isIncomingTransfer ? '+' : '-') 
              : (item.type === 'income' ? '+' : '-')}
            {formatCurrency(item.amount)} <Text style={styles.currencySymbol}>{currencySymbol}</Text>
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={16} color={colors.textTertiary} style={styles.chevron} />
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section: { title } }: { section: { title: string } }) => (
    <View style={styles.sectionHeaderContainer}>
      <View style={styles.sectionHeaderLine} />
      <View style={styles.sectionHeaderBubble}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
      </View>
      <View style={styles.sectionHeaderLine} />
    </View>
  );

  return (
    <LinearGradient
      colors={theme === 'dark' ? ['#070B14', '#0D1424', '#05070B'] : ['#F8FAFC', '#F1F5F9', '#E2E8F0']}
      style={styles.container}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
    >
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t.transactions}</Text>
          
          <View style={styles.actionButtonsRow}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/recurring-list');
              }}
              style={({ pressed }) => [styles.actionHeaderBtn, pressed && { opacity: 0.7 }]}
              hitSlop={8}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.actionHeaderBtnText}>{language === 'ar' ? 'المتكررة' : 'Recurring'}</Text>
            </Pressable>

            {filteredTransactions.length > 0 && (
              <Pressable
                onPress={handleExport}
                style={({ pressed }) => [styles.actionHeaderBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <MaterialIcons name="file-download" size={18} color={colors.primary} />
                <Text style={styles.actionHeaderBtnText}>{language === 'ar' ? 'تصدير' : 'Export'}</Text>
              </Pressable>
            )}

            {selectedWallet && (
              <View style={[styles.walletBadge, { backgroundColor: selectedWallet.color + '15' }]}>
                <MaterialIcons name={selectedWallet.icon as any} size={12} color={selectedWallet.color} />
                <Text style={[styles.walletBadgeText, { color: selectedWallet.color }]}>{selectedWallet.name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Wallet Selector Row */}
        <View style={{ marginBottom: 4 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.walletSelectorScroll}
          >
            {wallets.map((wallet) => {
              const isSelected = selectedWallet?.id === wallet.id;
              return (
                <Pressable
                  key={wallet.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    selectWallet(wallet.id);
                  }}
                  style={[
                    styles.walletChip,
                    isSelected && { borderColor: wallet.color, backgroundColor: wallet.color + '15' }
                  ]}
                >
                  <MaterialIcons name={wallet.icon as any} size={16} color={isSelected ? wallet.color : colors.textSecondary} />
                  <Text style={[styles.walletChipText, { color: isSelected ? wallet.color : colors.textSecondary }]}>
                    {wallet.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t.search}
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <View style={styles.filterRow}>
          {([
            { key: 'all' as FilterType, label: t.all },
            { key: 'income' as FilterType, label: t.incomeType },
            { key: 'expense' as FilterType, label: t.expenses },
          ]).map(f => (
            <Pressable
              key={f.key}
              onPress={() => handleTypeFilterChange(f.key)}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.categoryCarouselWrapper}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={allCategoriesForFilter}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedCategoryFilter === item.id;
              const catColor = item.color || colors.primary;
              return (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCategoryFilter(isSelected ? null : item.id);
                  }}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    isSelected && { 
                      borderColor: catColor, 
                      backgroundColor: catColor + '12',
                      shadowColor: catColor,
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                    },
                    pressed && { opacity: 0.8 }
                  ]}
                >
                  <MaterialIcons name={item.icon as any} size={14} color={isSelected ? catColor : colors.textSecondary} />
                  <Text style={[
                    styles.categoryChipText, 
                    isSelected && { color: catColor, fontFamily: 'Cairo_700Bold' }
                  ]}>
                    {getCategoryName(item.id, language)}
                  </Text>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.categoryCarouselScroll}
          />
        </View>
      </View>

      <SectionList
        sections={groupedTransactions}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 110 }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        scrollEnabled={filteredTransactions.length > 0}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>{t.noTransactions}</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? t.tryAnotherSearch : t.addFromHome}
            </Text>
          </View>
        }
      />
    </LinearGradient>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent to let the LinearGradient show through!
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: colors.text,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  actionHeaderBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  walletBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface + '60',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: colors.text,
    textAlign: 'left',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt + '60',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFF',
  },
  categoryCarouselWrapper: {
    height: 38,
    marginTop: 2,
    marginBottom: 4,
  },
  categoryCarouselScroll: {
    gap: 8,
    paddingRight: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surface + '60',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    marginRight: 6,
  },
  categoryChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface + '60',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionMiddle: {
    flex: 1,
    gap: 2,
  },
  transactionCatName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
    textAlign: 'left',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addedByBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  addedByText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 8,
    color: colors.primary,
  },
  transactionDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textTertiary,
    flex: 1,
    textAlign: 'left',
  },
  transactionRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  transactionAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  currencySymbol: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
  },
  chevron: {
    marginLeft: -4,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: colors.border,
  },
  sectionHeaderBubble: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginHorizontal: 10,
  },
  sectionHeaderTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  walletSelectorScroll: {
    paddingHorizontal: 20,
    gap: 8,
    marginVertical: 10,
    flexDirection: 'row',
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt + '80',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  walletChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
});
