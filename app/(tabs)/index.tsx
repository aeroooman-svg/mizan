import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { useLanguage } from '@/lib/LanguageContext';
import { getCategoryName, formatDateLocalized } from '@/lib/i18n';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    walletTransactions,
    totalIncome,
    totalExpense,
    balance,
    isLoading,
    refresh,
    wallets,
    selectedWallet,
    selectWallet,
    removeWallet,
    currencySymbol,
  } = useTransactions();
  const { t, language } = useLanguage();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const recentTransactions = walletTransactions.slice(0, 5);

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/add-transaction');
  };

  const handleAddWallet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-wallet');
  };

  const handleDeleteWallet = (id: string, name: string) => {
    if (wallets.length <= 1) {
      Alert.alert(t.warning, t.cantDeleteLast);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      t.deleteWallet,
      t.deleteWalletConfirm.replace('{name}', name),
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.delete, style: 'destructive', onPress: () => removeWallet(id) },
      ],
    );
  };

  const now = new Date();
  const dayName = t.days[now.getDay()];
  const currentDay = now.getDate();
  const currentMonth = t.months[now.getMonth()];
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
          colors={[selectedWallet?.color || Colors.primary, Colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: (insets.top || webTopInset) + 16 }]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{dayName}، {currentDay} {currentMonth} {currentYear}</Text>
              <Text style={styles.headerTitle}>{t.currentBalance}</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.settingsBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="language" size={20} color="rgba(255,255,255,0.85)" />
              </Pressable>
              <Pressable
                onPress={handleAddPress}
                style={({ pressed }) => [styles.addButton, { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
              >
                <Ionicons name="add" size={28} color={selectedWallet?.color || Colors.primary} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.balanceAmount}>
            {balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(balance))} <Text style={styles.currency}>{currencySymbol}</Text>
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconWrap}>
                <Ionicons name="arrow-down" size={16} color="#4ADE80" />
              </View>
              <View>
                <Text style={styles.summaryLabel}>{t.income}</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalIncome)}</Text>
              </View>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <View style={styles.summaryIconWrap}>
                <Ionicons name="arrow-up" size={16} color="#F87171" />
              </View>
              <View>
                <Text style={styles.summaryLabel}>{t.expenses}</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalExpense)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.walletsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t.wallets}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.walletsScroll}>
            {wallets.map(wallet => {
              const isSelected = selectedWallet?.id === wallet.id;
              return (
                <Pressable
                  key={wallet.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    selectWallet(wallet.id);
                  }}
                  onLongPress={() => handleDeleteWallet(wallet.id, wallet.name)}
                  style={[
                    styles.walletCard,
                    isSelected && { borderColor: wallet.color, borderWidth: 2 },
                  ]}
                >
                  <View style={[styles.walletIcon, { backgroundColor: wallet.color + '18' }]}>
                    <MaterialIcons name={wallet.icon as any} size={22} color={wallet.color} />
                  </View>
                  <Text style={[styles.walletName, isSelected && { color: wallet.color, fontFamily: 'Cairo_700Bold' as const }]} numberOfLines={1}>
                    {wallet.name}
                  </Text>
                  <Text style={styles.walletCurrency}>
                    {wallet.currency}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={handleAddWallet}
              style={styles.addWalletCard}
            >
              <View style={styles.addWalletIconWrap}>
                <Ionicons name="add" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.addWalletText}>{t.newWallet}</Text>
            </Pressable>
          </ScrollView>
        </View>

        {totalIncome > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.sectionTitle}>{t.spendingRatio}</Text>
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
              {totalExpense / totalIncome > 0.8 ? t.budgetWarning : t.budgetGood}
            </Text>
          </View>
        )}

        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t.recentTransactions}</Text>
            {walletTransactions.length > 5 && (
              <Pressable onPress={() => router.push('/(tabs)/transactions')}>
                <Text style={styles.seeAll}>{t.viewAll}</Text>
              </Pressable>
            )}
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>{t.noTransactions}</Text>
              <Text style={styles.emptySubtitle}>{t.tapToAdd}</Text>
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
                    <Text style={styles.transactionCat}>{getCategoryName(item.category, language)}</Text>
                    {item.description ? (
                      <Text style={styles.transactionDesc} numberOfLines={1}>{item.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={[styles.transactionAmount, { color: item.type === 'income' ? Colors.income : Colors.expense }]}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)} {currencySymbol}
                    </Text>
                    <Text style={styles.transactionDate}>{formatDateLocalized(item.date, language)}</Text>
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
          colors={[selectedWallet?.color || Colors.primary, Colors.primaryDark]}
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
    marginBottom: 12,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 34,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  currency: {
    fontSize: 16,
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
  walletsSection: {
    marginTop: 16,
    paddingLeft: 20,
  },
  walletsScroll: {
    paddingRight: 20,
    gap: 10,
    paddingVertical: 4,
  },
  walletCard: {
    width: 110,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: Colors.text,
    textAlign: 'center',
  },
  walletCurrency: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
  },
  addWalletCard: {
    width: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
    borderWidth: 2,
    borderColor: Colors.primary + '30',
    borderStyle: 'dashed',
  },
  addWalletIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWalletText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
    textAlign: 'center',
  },
  progressSection: {
    marginHorizontal: 20,
    marginTop: 16,
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
    marginTop: 16,
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
    fontSize: 14,
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
