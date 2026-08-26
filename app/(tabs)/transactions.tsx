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
  Modal,
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
import ConfirmModal from '@/components/ConfirmModal';
import SpendingHeatmapWidget from '@/components/SpendingHeatmapWidget';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';

import { getExchangeRates, convertAmount } from '@/lib/currencyApi';
import { getAllTags, Tag, parseTransactionTags } from '@/lib/tagStorage';

type FilterType = 'all' | 'expense' | 'savings' | 'income';
type ViewMode = 'list' | 'heatmap';

export default function TransactionsScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 10 : 0;
  const { walletTransactions, removeTransaction, currencySymbol, selectedWallet, wallets, customCategories, selectWallet } = useTransactions();
  const { t, language } = useLanguage();
  const isAr = language === 'ar';

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Options & Delete Modal States (Web & Mobile Compatible)
  const [selectedTxForOptions, setSelectedTxForOptions] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  React.useEffect(() => {
    async function loadInitialData() {
      try {
        const [r, tList] = await Promise.all([
          getExchangeRates().catch(() => ({})),
          getAllTags().catch(() => []),
        ]);
        setRates(r);
        setAvailableTags(tList);
      } catch (e) {}
    }
    loadInitialData();
  }, []);

  // Helper to check if tx is savings/loans/investments
  const isSavingsTx = (tx: Transaction) => {
    if (tx.category === 'jameya_savings' || tx.category === 'investment') return true;
    if (tx.category === 'debt_loan' && tx.type === 'expense') return true; // lending money
    return false;
  };

  // Grouped Categories for filtering
  const allCategoriesForFilter = useMemo(() => {
    const staticCats = filter === 'income' ? incomeCategories : expenseCategories;
    const userCats = customCategories.filter(c => filter === 'all' || (filter === 'income' ? c.type === 'income' : c.type === 'expense'));
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategoryFilter) count++;
    if (selectedTagFilter) count++;
    return count;
  }, [selectedCategoryFilter, selectedTagFilter]);

  const filteredTransactions = useMemo(() => {
    let result = walletTransactions;

    if (filter === 'expense') {
      result = result.filter(t => t.type === 'expense' && !isSavingsTx(t) && t.category !== 'debt_loan');
    } else if (filter === 'savings') {
      result = result.filter(t => isSavingsTx(t));
    } else if (filter === 'income') {
      result = result.filter(t => t.type === 'income' && t.category !== 'debt_loan');
    }

    if (selectedCategoryFilter) {
      result = result.filter(t => t.category === selectedCategoryFilter);
    }
    if (selectedTagFilter) {
      result = result.filter(t => {
        const txTags = parseTransactionTags(t.tags);
        return txTags.includes(selectedTagFilter);
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(t => {
        const catName = getCategoryName(t.category, language);
        const tagsStr = (t.tags || '').toLowerCase();
        return (
          catName.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          t.amount.toString().includes(q) ||
          tagsStr.includes(q)
        );
      });
    }
    return result;
  }, [walletTransactions, filter, selectedCategoryFilter, selectedTagFilter, searchQuery, language]);

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
    setSelectedTxForOptions(item);
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const isTransfer = item.type === 'transfer';
    const isIncomingTransfer = isTransfer && item.toWalletId === selectedWallet?.id;
    const cat = isTransfer 
      ? { icon: 'swap-horiz', color: isIncomingTransfer ? '#3b82f6' : '#94a3b8' } 
      : getCategoryById(item.category);

    const fromWallet = isIncomingTransfer ? wallets.find(w => w.id === item.walletId) : null;
    const fromCurrency = fromWallet ? fromWallet.currency : null;
    const isCrossCurrency = isIncomingTransfer && fromCurrency && selectedWallet?.currency && fromCurrency !== selectedWallet.currency;
    const displayAmount = isCrossCurrency
      ? convertAmount(item.amount, fromCurrency, selectedWallet?.currency || 'USD', rates)
      : item.amount;

    let categoryName = getCategoryName(item.category, language);
    if (isTransfer) {
      if (isIncomingTransfer) {
        const fromWalletName = fromWallet?.name || '';
        categoryName = language === 'ar' ? `تحويل من ${fromWalletName}` : `Transfer from ${fromWalletName}`;
      } else {
        const toWalletName = wallets.find(w => w.id === item.toWalletId)?.name || '';
        categoryName = language === 'ar' ? `تحويل إلى ${toWalletName}` : `Transfer to ${toWalletName}`;
      }
    }

    const isSavings = isSavingsTx(item);

    return (
      <Pressable
        style={({ pressed }) => [styles.transactionCard, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
        onLongPress={() => handleLongPress(item)}
        onPress={() => handleLongPress(item)}
      >
        <View style={[styles.catIconWrap, { backgroundColor: (isSavings ? '#8B5CF6' : (cat?.color || '#999')) + '15' }]}>
          <MaterialIcons name={(cat?.icon || (isSavings ? 'account-balance-wallet' : 'receipt')) as any} size={20} color={isSavings ? '#8B5CF6' : (cat?.color || '#999')} />
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
          {item.tags ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
              {parseTransactionTags(item.tags).map(tagStr => {
                const tagObj = availableTags.find(t => t.id === tagStr);
                return (
                  <View key={tagStr} style={{ backgroundColor: (tagObj?.color || colors.primary) + '18', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: tagObj?.color || colors.primary }}>
                      #{tagObj ? (language === 'ar' ? tagObj.nameAr : tagObj.nameEn) : tagStr}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {isCrossCurrency && (
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textTertiary, textAlign: 'left', marginTop: 1 }}>
              {language === 'ar' 
                ? `(المبلغ الأصلي: ${formatCurrency(item.amount)} ${fromCurrency} بسعر الصرف اللحظي)`
                : `(Original: ${formatCurrency(item.amount)} ${fromCurrency} at live rate)`}
            </Text>
          )}
        </View>

        <View style={styles.transactionRight}>
          {item.category === 'jameya_savings' ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.transactionAmount, { color: '#8B5CF6' }]}>
                {formatCurrency(displayAmount)} <Text style={styles.currencySymbol}>{currencySymbol}</Text>
              </Text>
              <View style={{ backgroundColor: '#8B5CF618', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2 }}>
                <Text style={{ color: '#8B5CF6', fontFamily: 'Cairo_700Bold', fontSize: 9 }}>
                  {language === 'ar' ? 'ادخار جمعية' : 'Jameya Savings'}
                </Text>
              </View>
            </View>
          ) : isSavings ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.transactionAmount, { color: '#8B5CF6' }]}>
                {formatCurrency(displayAmount)} <Text style={styles.currencySymbol}>{currencySymbol}</Text>
              </Text>
              <View style={{ backgroundColor: '#8B5CF618', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2 }}>
                <Text style={{ color: '#8B5CF6', fontFamily: 'Cairo_700Bold', fontSize: 9 }}>
                  {language === 'ar' ? 'ادخار / سلفة' : 'Savings / Loan'}
                </Text>
              </View>
            </View>
          ) : (
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
              {formatCurrency(displayAmount)} <Text style={styles.currencySymbol}>{currencySymbol}</Text>
            </Text>
          )}
        </View>
        <MaterialIcons name={language === 'ar' ? "chevron-left" : "chevron-right"} size={16} color={colors.textTertiary} style={styles.chevron} />
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
      {/* Top Header Row with View Switcher */}
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={styles.headerTitle}>{t.transactions}</Text>
            <Pressable onPress={handleExport} style={styles.exportHeaderBtn} hitSlop={8}>
              <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Clean Modern View Mode Switcher */}
          <View style={styles.viewModeSwitcher}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode('list');
              }}
              style={[
                styles.viewModeBtn,
                viewMode === 'list' && styles.viewModeBtnActive,
              ]}
            >
              <Ionicons
                name="list"
                size={14}
                color={viewMode === 'list' ? '#FFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.viewModeBtnText,
                  viewMode === 'list' && styles.viewModeBtnTextActive,
                ]}
              >
                {isAr ? 'قائمة' : 'List'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode('heatmap');
              }}
              style={[
                styles.viewModeBtn,
                viewMode === 'heatmap' && { backgroundColor: '#8B5CF6' },
              ]}
            >
              <Ionicons
                name="calendar"
                size={14}
                color={viewMode === 'heatmap' ? '#FFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.viewModeBtnText,
                  viewMode === 'heatmap' && { color: '#FFF', fontFamily: 'Cairo_700Bold' },
                ]}
              >
                {isAr ? 'خريطة' : 'Heatmap'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Compact Wallet Selector Chips */}
        <View style={{ marginBottom: 8 }}>
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
                    isSelected && { borderColor: wallet.color, backgroundColor: wallet.color + '20' }
                  ]}
                >
                  <MaterialIcons name={wallet.icon as any} size={14} color={isSelected ? wallet.color : colors.textSecondary} />
                  <Text style={[styles.walletChipText, { color: isSelected ? wallet.color : colors.textSecondary, fontFamily: isSelected ? 'Cairo_700Bold' : 'Cairo_600SemiBold' }]}>
                    {wallet.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Streamlined Search Bar & Filter Drawer Toggle in 1 Unified Row */}
        <View style={styles.searchAndFilterRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder={t.search}
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* Quick Filter Modal Trigger Button */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setIsFilterSheetOpen(true);
            }}
            style={[
              styles.filterSheetTriggerBtn,
              activeFilterCount > 0 && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
            ]}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeFilterCount > 0 ? colors.primary : colors.textSecondary}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterActiveBadge}>
                <Text style={styles.filterActiveBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Unified Horizontal Quick Filter Pills */}
        <View style={{ marginTop: 6 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsScroll}
          >
            {([
              { key: 'all' as FilterType, label: t.all, icon: 'apps-outline', color: colors.primary },
              { key: 'expense' as FilterType, label: isAr ? 'المصروفات' : 'Expenses', icon: 'flame', color: '#EF4444' },
              { key: 'savings' as FilterType, label: isAr ? 'الادخار والسلف' : 'Savings & Loans', icon: 'shield-checkmark', color: '#8B5CF6' },
              { key: 'income' as FilterType, label: isAr ? 'الإيرادات' : 'Income', icon: 'trending-up', color: '#10B981' },
            ]).map(f => {
              const isActive = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFilter(f.key);
                  }}
                  style={[
                    styles.quickFilterPill,
                    isActive && { backgroundColor: f.color, borderColor: f.color },
                  ]}
                >
                  <Ionicons
                    name={f.icon as any}
                    size={13}
                    color={isActive ? '#FFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.quickFilterPillText,
                      isActive && { color: '#FFF', fontFamily: 'Cairo_700Bold' },
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}

            {/* Active Category Removable Chip */}
            {selectedCategoryFilter && (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCategoryFilter(null);
                }}
                style={styles.activeRemovableChip}
              >
                <Text style={styles.activeRemovableChipText}>
                  🏷️ {getCategoryName(selectedCategoryFilter, language)}
                </Text>
                <Ionicons name="close-circle" size={14} color="#FFF" />
              </Pressable>
            )}

            {/* Active Tag Removable Chip */}
            {selectedTagFilter && (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedTagFilter(null);
                }}
                style={[styles.activeRemovableChip, { backgroundColor: '#3B82F6' }]}
              >
                <Text style={styles.activeRemovableChipText}>
                  #{availableTags.find(t => t.id === selectedTagFilter)?.nameAr || selectedTagFilter}
                </Text>
                <Ionicons name="close-circle" size={14} color="#FFF" />
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Main Content Area based on ViewMode */}
      {viewMode === 'heatmap' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.heatmapScrollContainer, { paddingBottom: 120 + (insets.bottom || 0) }]}
        >
          <SpendingHeatmapWidget
            transactions={walletTransactions}
            currencySymbol={currencySymbol}
          />
        </ScrollView>
      ) : (
        <SectionList
          sections={groupedTransactions}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 120 + (insets.bottom || 0) }]}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          scrollEnabled={filteredTransactions.length > 0}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>{t.noTransactions}</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || activeFilterCount > 0 ? t.tryAnotherSearch : t.addFromHome}
              </Text>
            </View>
          }
        />
      )}

      {/* Filter Bottom Sheet Modal for Categories and Tags */}
      <Modal
        visible={isFilterSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterSheetOpen(false)}
      >
        <View style={styles.modalBg}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsFilterSheetOpen(false)}
          />
          <View style={styles.filterSheetContent}>
            <View style={styles.filterSheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="options" size={20} color={colors.primary} />
                <Text style={styles.filterSheetTitle}>{isAr ? 'تصفية المعاملات' : 'Filter Transactions'}</Text>
              </View>
              <Pressable
                onPress={() => {
                  setSelectedCategoryFilter(null);
                  setSelectedTagFilter(null);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Text style={styles.filterResetBtnText}>{isAr ? 'إعادة ضبط' : 'Reset All'}</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {/* Category Filter Section */}
              <Text style={styles.filterSectionTitle}>
                {isAr ? 'الفئات' : 'Categories'}
              </Text>
              <View style={styles.filterPillsGrid}>
                {allCategoriesForFilter.map(cat => {
                  const isSelected = selectedCategoryFilter === cat.id;
                  const catColor = cat.color || colors.primary;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedCategoryFilter(isSelected ? null : cat.id);
                      }}
                      style={[
                        styles.filterGridChip,
                        isSelected && { borderColor: catColor, backgroundColor: catColor + '20' },
                      ]}
                    >
                      <MaterialIcons name={cat.icon as any} size={14} color={isSelected ? catColor : colors.textSecondary} />
                      <Text style={[styles.filterGridChipText, isSelected && { color: catColor, fontFamily: 'Cairo_700Bold' }]}>
                        {getCategoryName(cat.id, language)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Tag Filter Section */}
              {availableTags.length > 0 && (
                <>
                  <Text style={[styles.filterSectionTitle, { marginTop: 16 }]}>
                    {isAr ? 'الوسوم' : 'Tags'}
                  </Text>
                  <View style={styles.filterPillsGrid}>
                    {availableTags.map(tagObj => {
                      const isSelected = selectedTagFilter === tagObj.id;
                      return (
                        <Pressable
                          key={tagObj.id}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedTagFilter(isSelected ? null : tagObj.id);
                          }}
                          style={[
                            styles.filterGridChip,
                            isSelected && { borderColor: tagObj.color, backgroundColor: tagObj.color + '20' },
                          ]}
                        >
                          <Ionicons name="pricetag" size={12} color={isSelected ? tagObj.color : colors.textTertiary} />
                          <Text style={[styles.filterGridChipText, isSelected && { color: tagObj.color, fontFamily: 'Cairo_700Bold' }]}>
                            #{language === 'ar' ? tagObj.nameAr : tagObj.nameEn}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setIsFilterSheetOpen(false);
              }}
              style={styles.applyFilterBtn}
            >
              <Text style={styles.applyFilterBtnText}>{isAr ? 'تطبيق الفلاتر' : 'Apply Filters'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Transaction Options Modal (Web & Mobile Compatible) */}
      <Modal
        visible={!!selectedTxForOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTxForOptions(null)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            {selectedTxForOptions && (
              <>
                <View style={styles.modalSheetHeader}>
                  <Text style={styles.modalSheetTitle}>
                    {getCategoryName(selectedTxForOptions.category, language)}
                  </Text>
                  <Text style={[styles.modalSheetAmount, { color: selectedTxForOptions.type === 'income' ? colors.income : colors.expense }]}>
                    {selectedTxForOptions.type === 'income' ? '+' : '-'}{formatCurrency(selectedTxForOptions.amount)} {currencySymbol}
                  </Text>
                  {selectedTxForOptions.description ? (
                    <Text style={styles.modalSheetDesc}>{selectedTxForOptions.description}</Text>
                  ) : null}
                </View>

                <View style={styles.modalOptionsContainer}>
                  <Pressable
                    onPress={() => {
                      const tx = selectedTxForOptions;
                      setSelectedTxForOptions(null);
                      router.push({
                        pathname: '/add-transaction',
                        params: { editId: tx.id },
                      });
                    }}
                    style={styles.optionBtn}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.primary} />
                    <Text style={styles.optionBtnText}>{t.edit}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      const tx = selectedTxForOptions;
                      setSelectedTxForOptions(null);
                      setDeletingTx(tx);
                    }}
                    style={[styles.optionBtn, styles.deleteOptionBtn]}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.expense} />
                    <Text style={[styles.optionBtnText, { color: colors.expense }]}>{t.delete}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setSelectedTxForOptions(null)}
                    style={styles.cancelOptionBtn}
                  >
                    <Text style={styles.cancelOptionText}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={!!deletingTx}
        title={t.deleteTransaction}
        message={
          deletingTx
            ? t.deleteTransactionConfirm
                .replace('{category}', getCategoryName(deletingTx.category, language))
                .replace('{amount}', formatCurrency(deletingTx.amount))
                .replace('{currency}', currencySymbol)
            : ''
        }
        confirmText={t.delete}
        cancelText={t.cancel}
        isDestructive
        onConfirm={async () => {
          if (deletingTx) {
            await removeTransaction(deletingTx.id);
            setDeletingTx(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }}
        onCancel={() => setDeletingTx(null)}
      />
    </LinearGradient>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.text,
  },
  exportHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt + '80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt + '90',
    borderRadius: 12,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  viewModeBtnActive: {
    backgroundColor: colors.primary,
  },
  viewModeBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  viewModeBtnTextActive: {
    color: '#FFF',
    fontFamily: 'Cairo_700Bold',
  },
  walletSelectorScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt + '60',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  walletChipText: {
    fontSize: 11,
  },
  searchAndFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface + '80',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.text,
    textAlign: 'left',
  },
  filterSheetTriggerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface + '80',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  filterActiveBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterActiveBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 9,
    color: '#FFF',
  },
  filterPillsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  quickFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt + '60',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickFilterPillText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  activeRemovableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  activeRemovableChipText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: '#FFF',
  },
  heatmapScrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  filterSheetContent: {
    backgroundColor: colors.surface || colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '75%',
    gap: 12,
  },
  filterSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterSheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  filterResetBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.expense,
  },
  filterSectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  filterPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterGridChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt + '80',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterGridChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  applyFilterBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  applyFilterBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: 16,
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
    marginVertical: 10,
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
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalSheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 16,
  },
  modalSheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  modalSheetAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    marginTop: 4,
  },
  modalSheetDesc: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  modalOptionsContainer: {
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  optionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  deleteOptionBtn: {
    backgroundColor: colors.expense + '15',
  },
  cancelOptionBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 6,
  },
  cancelOptionText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.textSecondary,
  },
});
