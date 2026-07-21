import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useMemo } from 'react';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName, formatDateLocalized } from '@/lib/i18n';
import {
  RecurringTransaction,
  getRecurringTransactions,
  deleteRecurringTransaction,
  updateRecurringTransaction,
} from '@/lib/recurringStorage';

export default function RecurringListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 10 : 0;
  const { t, language } = useLanguage();
  const { currencySymbol, selectedWallet } = useTransactions();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecurring = async () => {
    setLoading(true);
    const data = await getRecurringTransactions();
    // Filter to current wallet if set
    if (selectedWallet) {
      setItems(data.filter(item => item.walletId === selectedWallet.id));
    } else {
      setItems(data);
    }
    setLoading(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadRecurring();
    }, [selectedWallet])
  );

  const handleToggleActive = async (item: RecurringTransaction, val: boolean) => {
    Haptics.selectionAsync();
    const updated = { ...item, isActive: val };
    await updateRecurringTransaction(updated);
    // Update local state
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
  };

  const handleDelete = (id: string, description: string, categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const catName = getCategoryName(categoryId, language);
    const displayName = description ? `${catName} (${description})` : catName;
    
    Alert.alert(
      t.deletePlan,
      language === 'ar' ? `هل تريد حذف المعاملة المتكررة "${displayName}"؟` : `Delete recurring transaction "${displayName}"?`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            await deleteRecurringTransaction(id);
            loadRecurring();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return t.daily;
      case 'weekly': return t.weekly;
      case 'monthly': return t.monthly;
      case 'yearly': return t.yearly;
      default: return freq;
    }
  };

  const renderItem = ({ item }: { item: RecurringTransaction }) => {
    const cat = getCategoryById(item.category);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.catIcon, { backgroundColor: (cat?.color || '#999') + '18' }]}>
            <MaterialIcons name={cat?.icon as any || 'receipt'} size={22} color={cat?.color || '#999'} />
          </View>
          <View style={styles.info}>
            <Text style={styles.catName}>{getCategoryName(item.category, language)}</Text>
            {item.description ? <Text style={styles.desc} numberOfLines={1}>{item.description}</Text> : null}
            <View style={styles.badgeRow}>
              <View style={styles.frequencyBadge}>
                <Text style={styles.frequencyText}>{getFrequencyLabel(item.frequency)}</Text>
              </View>
              <Text style={styles.nextDue}>
                {t.nextDueDate}: {formatDateLocalized(item.nextDueDate, language)}
              </Text>
            </View>
          </View>
          <View style={styles.actionColumn}>
            <Text style={[styles.amount, { color: item.type === 'income' ? Colors.income : Colors.expense }]}>
              {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)} {currencySymbol}
            </Text>
            <View style={styles.actions}>
              <Switch
                value={item.isActive}
                onValueChange={(val) => handleToggleActive(item, val)}
                trackColor={{ false: Colors.border, true: Colors.primary + '50' }}
                thumbColor={item.isActive ? Colors.primary : Colors.textTertiary}
              />
              <Pressable
                onPress={() => handleDelete(item.id, item.description, item.category)}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.expense} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: (insets.top || webTopInset) + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>{t.recurringTransactions}</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/add-recurring');
          }}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>{t.noRecurring}</Text>
          <Pressable
            onPress={() => router.push('/add-recurring')}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>{t.addRecurring}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    justifyContent: 'space-between',
    zIndex: 10,
    elevation: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  catName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.text,
    textAlign: 'left',
  },
  desc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  frequencyBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  frequencyText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
  },
  nextDue: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
  },
  actionColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  amount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  emptyButtonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
});
