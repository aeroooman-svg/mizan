import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTransactions } from '@/lib/TransactionContext';
import {
  AppNotification,
  NotificationCategory,
  NOTIFICATIONS_READ_KEY,
  NOTIFICATIONS_DISMISSED_KEY,
  generateFullAppNotifications,
  markAllNotificationsAsRead,
} from '@/lib/smartNotifications';

export default function NotificationsScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const webTopInset = Platform.OS === 'web' ? 10 : 0;

  const {
    transactions,
    wallets,
    selectedWallet,
    totalIncome,
    totalExpense,
    balance,
    pendingRecurring,
    currencySymbol,
  } = useTransactions();

  const [rawNotifications, setRawNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load storage states
  const loadStoredData = useCallback(async () => {
    try {
      const [readData, dismissedData] = await Promise.all([
        AsyncStorage.getItem(NOTIFICATIONS_READ_KEY),
        AsyncStorage.getItem(NOTIFICATIONS_DISMISSED_KEY),
      ]);
      if (readData) setReadIds(new Set(JSON.parse(readData)));
      if (dismissedData) setDismissedIds(new Set(JSON.parse(dismissedData)));
    } catch (e) {
      console.warn('Error loading notification states:', e);
    }
  }, []);

  // Generate notifications
  const refreshNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await generateFullAppNotifications(
        transactions,
        wallets,
        selectedWallet,
        totalIncome,
        totalExpense,
        balance,
        pendingRecurring,
        currencySymbol,
        language,
      );
      setRawNotifications(list);
    } catch (e) {
      console.warn('Error generating notifications:', e);
    } finally {
      setIsLoading(false);
    }
  }, [transactions, wallets, selectedWallet, totalIncome, totalExpense, balance, pendingRecurring, currencySymbol, language]);

  useEffect(() => {
    loadStoredData();
    refreshNotifications();
  }, [loadStoredData, refreshNotifications]);

  // When leaving the screen, automatically mark viewed notifications as read so home badge is cleared
  useEffect(() => {
    return () => {
      if (rawNotifications.length > 0) {
        markAllNotificationsAsRead(rawNotifications.map(n => n.id)).catch(() => {});
      }
    };
  }, [rawNotifications]);

  // Filtered notifications
  const visibleNotifications = useMemo(() => {
    return rawNotifications
      .filter(n => !dismissedIds.has(n.id))
      .filter(n => {
        if (selectedCategory === 'all') return true;
        return n.category === selectedCategory;
      })
      .filter(n => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.titleEn.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.bodyEn.toLowerCase().includes(q) ||
          n.badgeLabel.toLowerCase().includes(q)
        );
      });
  }, [rawNotifications, dismissedIds, selectedCategory, searchQuery]);

  const unreadCount = useMemo(() => {
    return rawNotifications.filter(n => !dismissedIds.has(n.id) && !readIds.has(n.id)).length;
  }, [rawNotifications, dismissedIds, readIds]);

  const markAllRead = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const allIds = new Set([...readIds, ...rawNotifications.map(n => n.id)]);
    setReadIds(allIds);
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify([...allIds]));
    } catch (e) {}
  }, [rawNotifications, readIds]);

  const markAsRead = useCallback(async (id: string) => {
    if (readIds.has(id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [readIds]);

  const dismissNotification = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(NOTIFICATIONS_DISMISSED_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const handleClearAll = () => {
    Alert.alert(
      isAr ? 'مسح جميع الإشعارات' : 'Clear All Notifications',
      isAr ? 'هل أنت متأكد من رغبتك في مسح كافة الإشعارات الحالية؟' : 'Are you sure you want to clear all notifications?',
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAr ? 'مسح الكل' : 'Clear All',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const allIds = new Set([...dismissedIds, ...rawNotifications.map(n => n.id)]);
            setDismissedIds(allIds);
            await AsyncStorage.setItem(NOTIFICATIONS_DISMISSED_KEY, JSON.stringify([...allIds])).catch(() => {});
          },
        },
      ]
    );
  };

  const handleAction = (item: AppNotification) => {
    markAsRead(item.id);
    if (item.actionRoute) {
      Haptics.selectionAsync();
      router.push(item.actionRoute as any);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (isAr) {
      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} د`;
      if (diffHours < 24) return `منذ ${diffHours} س`;
      if (diffDays === 1) return 'أمس';
      if (diffDays < 7) return `منذ ${diffDays} أيام`;
      return `منذ ${Math.floor(diffDays / 7)} أسبوع`;
    } else {
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return `${Math.floor(diffDays / 7)}w ago`;
    }
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, budget: 0, debt_installment: 0, savings_goal: 0, ai_zakat: 0 };
    rawNotifications.filter(n => !dismissedIds.has(n.id)).forEach(n => {
      counts.all++;
      if (counts[n.category] !== undefined) counts[n.category]++;
    });
    return counts;
  }, [rawNotifications, dismissedIds]);

  return (
    <LinearGradient
      colors={theme === 'dark' ? ['#070B14', '#0D1424', '#05070B'] : ['#F8FAFC', '#F1F5F9', '#E2E8F0']}
      style={styles.container}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
    >
      {/* Sleek Modern Header */}
      <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }}
            style={styles.headerIconBtn}
            hitSlop={10}
          >
            <Ionicons name={isAr ? "arrow-forward" : "arrow-back"} size={20} color={colors.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{isAr ? 'مركز الإشعارات' : 'Notifications'}</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountBadgeText}>
                  {unreadCount} {isAr ? 'جديد' : 'new'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <Pressable onPress={markAllRead} style={styles.headerActionBtn} hitSlop={8}>
                <Ionicons name="checkmark-done-outline" size={18} color="#00E676" />
              </Pressable>
            )}
            {visibleNotifications.length > 0 && (
              <Pressable onPress={handleClearAll} style={styles.headerActionBtn} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Search Input Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder={isAr ? 'البحث في الإشعارات والتنبيهات...' : 'Search notifications...'}
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
        </View>

        {/* Categories Tab Selector */}
        <View style={{ marginTop: 10 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {([
              { key: 'all' as NotificationCategory, label: isAr ? 'الكل' : 'All', icon: 'apps-outline', color: '#00E676' },
              { key: 'budget' as NotificationCategory, label: isAr ? 'الميزانية والإنفاق' : 'Budgets', icon: 'pie-chart-outline', color: '#EF4444' },
              { key: 'debt_installment' as NotificationCategory, label: isAr ? 'الأقساط والديون' : 'Debts & Plans', icon: 'card-outline', color: '#3B82F6' },
              { key: 'savings_goal' as NotificationCategory, label: isAr ? 'الأهداف والادخار' : 'Goals', icon: 'trophy-outline', color: '#8B5CF6' },
              { key: 'ai_zakat' as NotificationCategory, label: isAr ? 'الذكاء والزكاة' : 'AI & Zakat', icon: 'sparkles-outline', color: '#EAB308' },
            ]).map(cat => {
              const isSelected = selectedCategory === cat.key;
              const count = categoryCounts[cat.key] || 0;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCategory(cat.key);
                  }}
                  style={[
                    styles.categoryChip,
                    isSelected && { backgroundColor: cat.color + '20', borderColor: cat.color },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={14}
                    color={isSelected ? cat.color : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && { color: cat.color, fontFamily: 'Cairo_700Bold' },
                    ]}
                  >
                    {cat.label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.categoryBadge, isSelected && { backgroundColor: cat.color }]}>
                      <Text style={[styles.categoryBadgeText, isSelected && { color: '#FFF' }]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Notifications Feed */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + (insets.bottom || 0) }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E676" />
        }
      >
        {visibleNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={42} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>
              {isAr ? 'لا توجد إشعارات حالياً' : 'No Notifications'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? (isAr ? 'لم يتم العثور على نتائج تطابق بحثك' : 'No results matching your search')
                : (isAr ? 'أمورك المالية ممتازة ومستقرة! ستصلك التنبيهات الذكية فور حدوثها.' : 'Everything is on track! Smart alerts will appear here.')}
            </Text>
            <Pressable
              onPress={() => router.push('/add-transaction')}
              style={styles.emptyCtaBtn}
            >
              <Ionicons name="add-circle" size={18} color="#FFF" />
              <Text style={styles.emptyCtaBtnText}>
                {isAr ? 'تسجيل معاملة جديدة' : 'Add New Transaction'}
              </Text>
            </Pressable>
          </View>
        ) : (
          visibleNotifications.map((item) => {
            const isRead = readIds.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => markAsRead(item.id)}
                style={({ pressed }) => [
                  styles.card,
                  !isRead && styles.cardUnread,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                ]}
              >
                {/* Glow & Unread Indicator */}
                {!isRead && <View style={[styles.unreadGlowBar, { backgroundColor: item.badgeColor }]} />}

                <View style={styles.cardHeader}>
                  {/* Glowing Category Badge */}
                  <View style={[styles.badgePill, { backgroundColor: item.badgeColor + '18', borderColor: item.badgeColor + '40' }]}>
                    <Text style={[styles.badgePillText, { color: item.badgeColor }]}>
                      {isAr ? item.badgeLabel : item.badgeLabelEn}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.cardTime}>{getRelativeTime(item.createdAt)}</Text>
                    <Pressable
                      onPress={() => dismissNotification(item.id)}
                      style={styles.dismissBtn}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.cardBodyRow}>
                  {/* High Contrast Gradient Icon Bubble */}
                  <View style={[styles.iconBubble, { backgroundColor: item.iconColor + '18', borderColor: item.iconColor + '30' }]}>
                    <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
                  </View>

                  <View style={styles.cardTextContent}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.cardTitle, !isRead && { color: colors.text, fontFamily: 'Cairo_700Bold' }]}>
                        {isAr ? item.title : item.titleEn}
                      </Text>
                      {!isRead && <View style={[styles.unreadDot, { backgroundColor: item.iconColor }]} />}
                    </View>

                    <Text style={styles.cardBodyText}>
                      {isAr ? item.body : item.bodyEn}
                    </Text>

                    {/* Quick Direct Action Button */}
                    {item.actionText && (
                      <Pressable
                        onPress={() => handleAction(item)}
                        style={[styles.actionBtn, { borderColor: item.iconColor + '30', backgroundColor: item.iconColor + '12' }]}
                      >
                        <Text style={[styles.actionBtnText, { color: item.iconColor }]}>
                          {isAr ? item.actionText : item.actionTextEn}
                        </Text>
                        <Ionicons
                          name={isAr ? "arrow-back" : "arrow-forward"}
                          size={13}
                          color={item.iconColor}
                        />
                      </Pressable>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const getStyles = (colors: any, theme: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '50',
    backgroundColor: theme === 'dark' ? 'rgba(9, 14, 23, 0.7)' : 'rgba(255, 255, 255, 0.8)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt + '80',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  unreadCountBadge: {
    backgroundColor: '#00E676',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadCountBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt + '70',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchRow: {
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface + '90',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.text,
    textAlign: 'left',
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt + '60',
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  categoryBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 9,
    color: colors.textTertiary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: colors.surface + '85',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  cardUnread: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  unreadGlowBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 3.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgePillText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
  },
  cardTime: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textTertiary,
  },
  dismissBtn: {
    padding: 3,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt + '50',
  },
  cardBodyRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardTextContent: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cardTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'left',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cardBodyText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11.5,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'left',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  actionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceAlt + '60',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  emptySubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00E676',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyCtaBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#000',
  },
});
