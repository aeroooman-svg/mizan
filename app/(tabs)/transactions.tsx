import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById, formatDate } from '@/lib/categories';
import { Transaction } from '@/lib/storage';

type FilterType = 'all' | 'income' | 'expense';

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const { walletTransactions, removeTransaction, currencySymbol, selectedWallet } = useTransactions();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = useMemo(() => {
    let result = walletTransactions;
    if (filter !== 'all') {
      result = result.filter(t => t.type === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(t => {
        const cat = getCategoryById(t.category);
        return (
          (cat?.nameAr || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          t.amount.toString().includes(q)
        );
      });
    }
    return result;
  }, [walletTransactions, filter, searchQuery]);

  const handleDelete = (item: Transaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const cat = getCategoryById(item.category);
    Alert.alert(
      'حذف المعاملة',
      `هل تريد حذف "${cat?.nameAr || item.category}" بمبلغ ${formatCurrency(item.amount)} ${currencySymbol}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => removeTransaction(item.id),
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const cat = getCategoryById(item.category);
    return (
      <Pressable
        style={({ pressed }) => [styles.transactionItem, { opacity: pressed ? 0.7 : 1 }]}
        onLongPress={() => handleDelete(item)}
      >
        <View style={[styles.catIcon, { backgroundColor: (cat?.color || '#999') + '18' }]}>
          <MaterialIcons name={cat?.icon as any || 'receipt'} size={22} color={cat?.color || '#999'} />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionCat}>{cat?.nameAr || item.category}</Text>
          {item.description ? (
            <Text style={styles.transactionDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: item.type === 'income' ? Colors.income : Colors.expense }]}>
            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)} {currencySymbol}
          </Text>
          <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>المعاملات</Text>
          {selectedWallet && (
            <View style={[styles.walletBadge, { backgroundColor: selectedWallet.color + '15' }]}>
              <MaterialIcons name={selectedWallet.icon as any} size={14} color={selectedWallet.color} />
              <Text style={[styles.walletBadgeText, { color: selectedWallet.color }]}>{selectedWallet.name}</Text>
            </View>
          )}
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="بحث..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <View style={styles.filterRow}>
          {([
            { key: 'all' as FilterType, label: 'الكل' },
            { key: 'income' as FilterType, label: 'دخل' },
            { key: 'expense' as FilterType, label: 'مصاريف' },
          ]).map(f => (
            <Pressable
              key={f.key}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f.key);
              }}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredTransactions}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        scrollEnabled={filteredTransactions.length > 0}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>لا توجد معاملات</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'جرب البحث بكلمة أخرى' : 'أضف معاملة جديدة من الشاشة الرئيسية'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: Colors.text,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  walletBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    color: Colors.text,
    textAlign: 'right',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
    gap: 2,
  },
  transactionCat: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  transactionDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  transactionAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  transactionDate: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
