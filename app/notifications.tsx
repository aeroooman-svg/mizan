import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTransactions } from '@/lib/TransactionContext';
import { getCategoryName, formatDateLocalized } from '@/lib/i18n';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import Colors from '@/constants/colors';

const NOTIFICATIONS_KEY = '@mizan_notifications';
const NOTIFICATIONS_READ_KEY = '@mizan_notifications_read';

export interface AppNotification {
  id: string;
  type: 'budget_alert' | 'goal_reached' | 'recurring_due' | 'debt_reminder' | 'tip' | 'welcome' | 'achievement';
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  icon: string;
  iconColor: string;
  createdAt: string;
  read: boolean;
}

// Generate smart notifications based on user data
function generateNotifications(
  transactions: any[],
  wallets: any[],
  selectedWallet: any,
  totalIncome: number,
  totalExpense: number,
  balance: number,
  pendingRecurring: any[],
  currencySymbol: string,
  language: string,
): AppNotification[] {
  const notifications: AppNotification[] = [];
  const now = new Date();

  // Welcome notification (always first)
  notifications.push({
    id: 'welcome',
    type: 'welcome',
    title: 'مرحباً بك في ميزان! 🎉',
    titleEn: 'Welcome to MIZAN! 🎉',
    body: 'ابدأ بتسجيل معاملاتك اليومية لتتبع مصاريفك بذكاء.',
    bodyEn: 'Start logging your daily transactions to track expenses smartly.',
    icon: 'sparkles',
    iconColor: '#8B5CF6',
    createdAt: new Date(now.getTime() - 86400000 * 7).toISOString(),
    read: false,
  });

  // Budget warning: if expenses > 80% of income
  if (totalIncome > 0 && totalExpense / totalIncome > 0.8) {
    notifications.push({
      id: 'budget_warning_' + now.getMonth(),
      type: 'budget_alert',
      title: '⚠️ تنبيه الميزانية',
      titleEn: '⚠️ Budget Alert',
      body: `أنفقت ${Math.round((totalExpense / totalIncome) * 100)}% من دخلك هذا الشهر. حاول تقليل المصاريف غير الضرورية.`,
      bodyEn: `You've spent ${Math.round((totalExpense / totalIncome) * 100)}% of your income this month. Try reducing unnecessary expenses.`,
      icon: 'warning-outline',
      iconColor: '#F59E0B',
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
      read: false,
    });
  }

  // Savings achievement: if saved > 30%
  if (totalIncome > 0 && (totalIncome - totalExpense) / totalIncome > 0.3) {
    notifications.push({
      id: 'savings_achievement_' + now.getMonth(),
      type: 'achievement',
      title: '🏆 إنجاز رائع!',
      titleEn: '🏆 Great Achievement!',
      body: `وفّرت ${Math.round(((totalIncome - totalExpense) / totalIncome) * 100)}% من دخلك. استمر على هذا المنوال!`,
      bodyEn: `You saved ${Math.round(((totalIncome - totalExpense) / totalIncome) * 100)}% of your income. Keep it up!`,
      icon: 'trophy-outline',
      iconColor: '#10B981',
      createdAt: new Date(now.getTime() - 7200000).toISOString(),
      read: false,
    });
  }

  // Pending recurring transactions
  if (pendingRecurring.length > 0) {
    notifications.push({
      id: 'recurring_due_' + now.toISOString().slice(0, 10),
      type: 'recurring_due',
      title: '🔔 معاملات متكررة بانتظارك',
      titleEn: '🔔 Recurring Transactions Pending',
      body: `لديك ${pendingRecurring.length} معاملة متكررة تحتاج موافقتك.`,
      bodyEn: `You have ${pendingRecurring.length} recurring transaction(s) pending your approval.`,
      icon: 'repeat-outline',
      iconColor: '#3B82F6',
      createdAt: new Date(now.getTime() - 1800000).toISOString(),
      read: false,
    });
  }

  // Multiple wallets tip
  if (wallets.length > 1) {
    notifications.push({
      id: 'multi_wallet_tip',
      type: 'tip',
      title: '💡 نصيحة ذكية',
      titleEn: '💡 Smart Tip',
      body: `لديك ${wallets.length} محافظ. استخدم الرصيد الموحد لمتابعة ثروتك الإجمالية.`,
      bodyEn: `You have ${wallets.length} wallets. Use the consolidated balance to track your total wealth.`,
      icon: 'bulb-outline',
      iconColor: '#6366F1',
      createdAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
      read: false,
    });
  }

  // No transactions today tip
  const todayStr = now.toISOString().slice(0, 10);
  const todayTxns = transactions.filter(t => t.date.slice(0, 10) === todayStr);
  if (todayTxns.length === 0 && transactions.length > 0) {
    notifications.push({
      id: 'no_txn_today_' + todayStr,
      type: 'tip',
      title: '📝 لا تنسَ تسجيل معاملاتك',
      titleEn: '📝 Don\'t forget to log transactions',
      body: 'لم تسجّل أي معاملة اليوم. سجّل مصاريفك أولاً بأول للحصول على تحليلات دقيقة.',
      bodyEn: 'You haven\'t logged any transactions today. Log expenses regularly for accurate analysis.',
      icon: 'create-outline',
      iconColor: '#EC4899',
      createdAt: new Date(now.getTime() - 600000).toISOString(),
      read: false,
    });
  }

  // Negative balance warning
  if (balance < 0) {
    notifications.push({
      id: 'negative_balance_' + now.getMonth(),
      type: 'budget_alert',
      title: '🚨 رصيدك سالب!',
      titleEn: '🚨 Negative Balance!',
      body: `رصيد محفظتك الحالية سالب (${formatCurrency(balance, 'ar')}). راجع مصاريفك وحاول تعزيز دخلك.`,
      bodyEn: `Your current wallet balance is negative (${formatCurrency(balance, 'en')}). Review your expenses and boost your income.`,
      icon: 'alert-circle-outline',
      iconColor: '#EF4444',
      createdAt: new Date(now.getTime() - 900000).toISOString(),
      read: false,
    });
  }

  // Sort by date, newest first
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return notifications;
}

export default function NotificationsScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
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

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Load read notification IDs
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATIONS_READ_KEY);
        if (stored) {
          setReadIds(new Set(JSON.parse(stored)));
        }
      } catch (e) {}
    })();
  }, []);

  const notifications = useMemo(() => {
    return generateNotifications(
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
  }, [transactions, wallets, selectedWallet, totalIncome, totalExpense, balance, pendingRecurring, currencySymbol, language]);

  const markAllRead = useCallback(async () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadIds(allIds);
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify([...allIds]));
    } catch (e) {}
  }, [notifications]);

  const markAsRead = useCallback(async (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  // Mark all as read when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Small delay so user sees unread state briefly
      const timer = setTimeout(() => {
        markAllRead();
      }, 2000);
      return () => clearTimeout(timer);
    }, [markAllRead])
  );

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (language === 'ar') {
      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
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

  const webTopInset = Platform.OS === 'web' ? 10 : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight || '#0EA371']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }}
            hitSlop={20}
          >
            <Ionicons name={language === 'ar' ? 'chevron-forward' : 'chevron-back'} size={26} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {language === 'ar' ? 'الإشعارات' : 'Notifications'}
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              markAllRead();
            }}
            hitSlop={20}
          >
            <Ionicons name="checkmark-done-outline" size={24} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Notifications List */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: (insets.bottom || 0) + 100, paddingTop: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <Ionicons name="notifications" size={16} color={Colors.primary} />
            <Text style={styles.unreadBannerText}>
              {language === 'ar' 
                ? `${unreadCount} إشعار جديد` 
                : `${unreadCount} new notification${unreadCount > 1 ? 's' : ''}`}
            </Text>
          </View>
        )}

        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>
              {language === 'ar' ? 'لا توجد إشعارات' : 'No Notifications'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {language === 'ar' 
                ? 'ستظهر هنا التنبيهات والنصائح المالية الذكية'
                : 'Smart alerts and financial tips will appear here'}
            </Text>
          </View>
        ) : (
          notifications.map((notification, index) => {
            const isRead = readIds.has(notification.id);
            return (
              <Pressable
                key={notification.id}
                onPress={() => markAsRead(notification.id)}
                style={({ pressed }) => [
                  styles.notificationItem,
                  !isRead && styles.notificationItemUnread,
                  pressed && { opacity: 0.8 },
                  index === notifications.length - 1 && { marginBottom: 0 },
                ]}
              >
                <View style={[styles.notifIconWrap, { backgroundColor: notification.iconColor + '18' }]}>
                  <Ionicons name={notification.icon as any} size={22} color={notification.iconColor} />
                </View>
                <View style={styles.notifContent}>
                  <View style={styles.notifTitleRow}>
                    <Text style={[styles.notifTitle, !isRead && { color: colors.text }]} numberOfLines={1}>
                      {language === 'ar' ? notification.title : notification.titleEn}
                    </Text>
                    {!isRead && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifBody} numberOfLines={2}>
                    {language === 'ar' ? notification.body : notification.bodyEn}
                  </Text>
                  <Text style={styles.notifTime}>{getRelativeTime(notification.createdAt)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: '#FFF',
  },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary + '12',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '25',
  },
  unreadBannerText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.primary,
  },
  notificationItem: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  notificationItemUnread: {
    backgroundColor: colors.primary + '08',
    borderColor: colors.primary + '20',
  },
  notifIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: {
    flex: 1,
    gap: 4,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  notifBody: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  notifTime: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  emptySubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
