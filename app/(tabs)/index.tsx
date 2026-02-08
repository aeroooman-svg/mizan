import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById, formatDate } from '@/lib/categories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { transactions, totalIncome, totalExpense, balance, isLoading, refresh } = useTransactions();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const recentTransactions = transactions.slice(0, 5);

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/add-transaction');
  };

  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const now = new Date();
  const currentMonth = months[now.getMonth()];
  const currentYear = now.getFullYear();

  return (
    <View style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: (insets.top || webTopInset) + 20 }]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{currentMonth} {currentYear}</Text>
              <Text style={styles.headerTitle}>الرصيد الحالي</Text>
            </View>
            <Pressable
              onPress={handleAddPress}
              style={({ pressed }) => [styles.addButton, { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <Ionicons name="add" size={28} color={Colors.primary} />
            </Pressable>
          </View>

          <Text style={styles.balanceAmount}>
            {balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(balance))} <Text style={styles.currency}>ج.م</Text>
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconWrap}>
                <Ionicons name="arrow-down" size={16} color="#4ADE80" />
              </View>
              <View>
                <Text style={styles.summaryLabel}>الدخل</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalIncome)}</Text>
              </View>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <View style={styles.summaryIconWrap}>
                <Ionicons name="arrow-up" size={16} color="#F87171" />
              </View>
              <View>
                <Text style={styles.summaryLabel}>المصاريف</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalExpense)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {totalIncome > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.sectionTitle}>نسبة الإنفاق</Text>
              <Text style={styles.progressPercent}>
                {totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0}%
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%`,
                    backgroundColor: (totalExpense / totalIncome) > 0.8 ? Colors.expense : Colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressNote}>
              {totalExpense / totalIncome > 0.8
                ? 'تنبيه: الإنفاق يقترب من الحد الأقصى'
                : 'الميزانية في وضع جيد'}
            </Text>
          </View>
        )}

        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>آخر المعاملات</Text>
            {transactions.length > 5 && (
              <Pressable onPress={() => router.push('/(tabs)/transactions')}>
                <Text style={styles.seeAll}>عرض الكل</Text>
              </Pressable>
            )}
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>لا توجد معاملات بعد</Text>
              <Text style={styles.emptySubtitle}>اضغط + لإضافة أول معاملة</Text>
            </View>
          ) : (
            recentTransactions.map((item) => {
              const cat = getCategoryById(item.category);
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.transactionItem, { opacity: pressed ? 0.7 : 1 }]}
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
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                    </Text>
                    <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <Pressable
        onPress={handleAddPress}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: 90 + (Platform.OS === 'web' ? 34 : 0),
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'left',
  },
  headerTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: '#fff',
    textAlign: 'left',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 36,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  currency: {
    fontSize: 18,
    fontFamily: 'Cairo_400Regular',
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  summaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  summaryValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#fff',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressSection: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressPercent: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  progressNote: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'left',
  },
  recentSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: Colors.text,
  },
  seeAll: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.surface,
    borderRadius: 16,
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
    fontSize: 15,
  },
  transactionDate: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  fabGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
