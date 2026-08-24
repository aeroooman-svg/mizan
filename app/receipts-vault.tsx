import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Modal,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName, formatDateLocalized } from '@/lib/i18n';
import { Transaction } from '@/lib/storage';
import ConfirmModal from '@/components/ConfirmModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 44) / 2;

export default function ReceiptsVaultScreen() {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const isAr = language === 'ar';
  const { walletTransactions, currencySymbol, updateTransaction } = useTransactions();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<Transaction | null>(null);
  const [txToDeleteReceipt, setTxToDeleteReceipt] = useState<Transaction | null>(null);

  // Transactions with receipts
  const receiptTransactions = useMemo(() => {
    return walletTransactions.filter(tx => Boolean(tx.receiptUri));
  }, [walletTransactions]);

  // Filtered receipts
  const filteredReceipts = useMemo(() => {
    return receiptTransactions.filter(tx => {
      if (selectedCategoryFilter && tx.category !== selectedCategoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const desc = (tx.description || '').toLowerCase();
        const cat = getCategoryName(tx.category, language).toLowerCase();
        const amt = tx.amount.toString();
        const note = (tx.note || '').toLowerCase();
        return desc.includes(q) || cat.includes(q) || amt.includes(q) || note.includes(q);
      }
      return true;
    });
  }, [receiptTransactions, selectedCategoryFilter, searchQuery, language]);

  // Summary Metrics
  const totalAmount = useMemo(() => {
    return receiptTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [receiptTransactions]);

  // Unique Categories for receipts
  const receiptCategories = useMemo(() => {
    const set = new Set(receiptTransactions.map(tx => tx.category));
    return Array.from(set);
  }, [receiptTransactions]);

  const handleShareReceipt = async (uri?: string) => {
    if (!uri) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert(isAr ? 'تنبيه' : 'Alert', isAr ? 'المشاركة غير متاحة على هذا الجهاز' : 'Sharing is not available');
      }
    } catch (e) {
      console.error('Sharing error:', e);
    }
  };

  const handleRemoveReceiptAttachment = async () => {
    if (!txToDeleteReceipt) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const updatedTx: Transaction = {
        ...txToDeleteReceipt,
        receiptUri: undefined,
      };
      await updateTransaction(updatedTx);
      setSelectedReceiptTx(null);
      setTxToDeleteReceipt(null);
    } catch (e) {
      console.error('Error removing receipt:', e);
    }
  };

  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
          <Text style={styles.title}>{isAr ? 'خزينة ومعرض الفواتير' : 'Receipts Vault'}</Text>
          <Text style={styles.subTitle}>
            {isAr ? 'أرشيف مرئي لجميع فواتير وإيصالات الشراء' : 'Visual archive for all purchase receipts'}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/scan-receipt');
          }}
          style={styles.scanBtn}
        >
          <Ionicons name="camera" size={18} color="#000" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stats Hero Card */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{isAr ? 'إجمالي الفواتير' : 'Total Receipts'}</Text>
            <Text style={styles.statNumber}>{receiptTransactions.length}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{isAr ? 'القيمة الموثقة' : 'Documented Value'}</Text>
            <Text style={[styles.statNumber, { color: colors.expense }]}>
              {formatCurrency(totalAmount, language)} {currencySymbol}
            </Text>
          </View>
        </View>

        {/* Search & Filters */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={isAr ? 'بحث بالمتجر، الوصف، أو المبلغ...' : 'Search store, note, amount...'}
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {/* Category Filter Pills */}
        {receiptCategories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedCategoryFilter(null);
              }}
              style={[
                styles.filterPill,
                selectedCategoryFilter === null && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedCategoryFilter === null && { color: '#000', fontFamily: 'Cairo_700Bold' },
                ]}
              >
                {isAr ? 'الكل' : 'All'}
              </Text>
            </Pressable>

            {receiptCategories.map(catId => {
              const catObj = getCategoryById(catId);
              const isSelected = selectedCategoryFilter === catId;
              return (
                <Pressable
                  key={catId}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCategoryFilter(isSelected ? null : catId);
                  }}
                  style={[
                    styles.filterPill,
                    isSelected && { backgroundColor: (catObj?.color || colors.primary) + '25', borderColor: catObj?.color || colors.primary },
                  ]}
                >
                  {catObj && <MaterialIcons name={catObj.icon as any} size={14} color={catObj.color || colors.text} />}
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected && { color: catObj?.color || colors.primary, fontFamily: 'Cairo_700Bold' },
                    ]}
                  >
                    {getCategoryName(catId, language)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Grid List */}
        {filteredReceipts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={54} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>
              {isAr ? 'لا توجد فواتير محفوظة' : 'No receipts found'}
            </Text>
            <Text style={styles.emptySub}>
              {isAr
                ? 'يمكنك التقاط صورة لأي فاتورة عند إضافة معاملة جديدة'
                : 'You can snap receipt photos when adding new expenses'}
            </Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/add-transaction');
              }}
              style={styles.addReceiptBtn}
            >
              <Text style={styles.addReceiptBtnText}>{isAr ? 'إضافة معاملة جديدة' : 'Add Transaction'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredReceipts.map((tx) => {
              const cat = getCategoryById(tx.category);
              return (
                <Pressable
                  key={tx.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedReceiptTx(tx);
                  }}
                  style={styles.gridCard}
                >
                  <Image
                    source={{ uri: tx.receiptUri }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardCategory} numberOfLines={1}>
                        {getCategoryName(tx.category, language)}
                      </Text>
                      <Text style={styles.cardAmount}>
                        {formatCurrency(tx.amount, language)} {currencySymbol}
                      </Text>
                    </View>
                    <Text style={styles.cardDesc} numberOfLines={1}>
                      {tx.description || (isAr ? 'فاتورة مشتريات' : 'Purchase Receipt')}
                    </Text>
                    <Text style={styles.cardDate}>
                      {formatDateLocalized(tx.date, language)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Fullscreen Receipt Modal Viewer */}
      {selectedReceiptTx && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedReceiptTx(null)}>
          <View style={styles.viewerOverlay}>
            <View style={[styles.viewerHeader, { paddingTop: insets.top + 10 }]}>
              <Pressable onPress={() => setSelectedReceiptTx(null)} hitSlop={10} style={styles.viewerBtn}>
                <Ionicons name="close" size={24} color="#FFF" />
              </Pressable>
              <Text style={styles.viewerTitle} numberOfLines={1}>
                {selectedReceiptTx.description || getCategoryName(selectedReceiptTx.category, language)}
              </Text>
              <Pressable onPress={() => handleShareReceipt(selectedReceiptTx.receiptUri)} hitSlop={10} style={styles.viewerBtn}>
                <Ionicons name="share-outline" size={22} color="#FFF" />
              </Pressable>
            </View>

            <View style={styles.viewerImageWrapper}>
              <Image
                source={{ uri: selectedReceiptTx.receiptUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>

            <View style={[styles.viewerBottomCard, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.detailRow}>
                <View>
                  <Text style={styles.detailLabel}>{isAr ? 'المبلغ' : 'Amount'}</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedReceiptTx.amount, language)} {currencySymbol}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.detailLabel}>{isAr ? 'التاريخ' : 'Date'}</Text>
                  <Text style={styles.detailValueSmall}>
                    {formatDateLocalized(selectedReceiptTx.date, language)}
                  </Text>
                </View>
              </View>

              <View style={styles.actionButtonsRow}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    const txId = selectedReceiptTx.id;
                    setSelectedReceiptTx(null);
                    router.push({ pathname: '/add-transaction', params: { editId: txId } });
                  }}
                  style={styles.editBtn}
                >
                  <Ionicons name="pencil" size={16} color="#FFF" />
                  <Text style={styles.editBtnText}>{isAr ? 'تعديل المعاملة' : 'Edit'}</Text>
                </Pressable>

                <Pressable
                  onPress={() => setTxToDeleteReceipt(selectedReceiptTx)}
                  style={styles.removeReceiptBtn}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={styles.removeReceiptBtnText}>{isAr ? 'إزالة الفاتورة' : 'Remove'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Remove Receipt Confirmation */}
      <ConfirmModal
        visible={!!txToDeleteReceipt}
        title={isAr ? 'إزالة صورة الفاتورة' : 'Remove Receipt'}
        message={isAr ? 'هل تريد إزالة صورة الفاتورة من هذه المعاملة؟ ستبقى المعاملة مسجلة.' : 'Remove receipt image from this transaction?'}
        confirmText={isAr ? 'إزالة' : 'Remove'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        onConfirm={handleRemoveReceiptAttachment}
        onCancel={() => setTxToDeleteReceipt(null)}
      />
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      padding: 4,
    },
    title: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: colors.text,
    },
    subTitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
    },
    scanBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: 16,
      gap: 14,
    },
    statsCard: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    statDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
    },
    statLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    statNumber: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: colors.text,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      textAlign: 'right',
    },
    filterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterPillText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 6,
    },
    gridCard: {
      width: COLUMN_WIDTH,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardImage: {
      width: '100%',
      height: 140,
      backgroundColor: colors.background,
    },
    cardInfo: {
      padding: 10,
      gap: 4,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardCategory: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.text,
      flex: 1,
    },
    cardAmount: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.expense,
    },
    cardDesc: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    cardDate: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 10,
      color: colors.textTertiary,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 50,
      gap: 10,
    },
    emptyTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.text,
    },
    emptySub: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 260,
    },
    addReceiptBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      marginTop: 8,
    },
    addReceiptBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#000',
    },
    viewerOverlay: {
      flex: 1,
      backgroundColor: '#000',
    },
    viewerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 10,
      zIndex: 10,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    viewerTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: '#FFF',
      maxWidth: SCREEN_WIDTH - 120,
    },
    viewerBtn: {
      padding: 8,
    },
    viewerImageWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullImage: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT * 0.65,
    },
    viewerBottomCard: {
      backgroundColor: '#0F172A',
      padding: 16,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      gap: 14,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailLabel: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: '#94A3B8',
    },
    detailValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: '#FF6B6B',
    },
    detailValueSmall: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: '#FFF',
    },
    actionButtonsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    editBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#3B82F6',
      paddingVertical: 12,
      borderRadius: 12,
    },
    editBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#FFF',
    },
    removeReceiptBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderWidth: 1,
      borderColor: '#EF4444',
      paddingVertical: 12,
      borderRadius: 12,
    },
    removeReceiptBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#EF4444',
    },
  });
