import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Set up notification handler so notifications show up even if the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

export const NOTIFICATION_SETTINGS_KEY = '@mizan_notification_settings';

export interface NotificationSettings {
  dailyReminderEnabled: boolean;
  dailyReminderHour: number;
  dailyReminderMinute: number;
  budgetAlertsEnabled: boolean;
  monthlyDigestEnabled: boolean;
  streakRemindersEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyReminderEnabled: true,
  dailyReminderHour: 21,
  dailyReminderMinute: 0,
  budgetAlertsEnabled: true,
  monthlyDigestEnabled: true,
  streakRemindersEnabled: true,
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load notification settings:', e);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

export async function saveNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
  try {
    const current = await getNotificationSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));
    
    // Apply changes
    if (updated.dailyReminderEnabled) {
      await scheduleDailyReminder(updated.dailyReminderHour, updated.dailyReminderMinute);
    } else {
      await cancelDailyReminder();
    }

    if (updated.monthlyDigestEnabled) {
      await scheduleMonthlyDigestNotification();
    } else {
      await cancelMonthlyDigestNotification();
    }

    return updated;
  } catch (e) {
    console.warn('Failed to save notification settings:', e);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'تنبيهات ميزان',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00E676',
      });
    } catch (e) {
      console.warn('Failed to create notification channel:', e);
    }
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

export async function sendImmediateNotification(title: string, body: string, data?: Record<string, any>) {
  if (Platform.OS === 'web') return;
  
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: data || {},
    },
    trigger: null, // null means trigger immediately
  });
}

export async function scheduleDailyReminder(hour: number = 21, minute: number = 0) {
  if (Platform.OS === 'web') return;

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    // Cancel any existing daily reminders first
    await cancelDailyReminder();

    await Notifications.scheduleNotificationAsync({
      identifier: 'daily_reminder',
      content: {
        title: '📝 سجل مصاريفك اليوم!',
        body: 'حافظ على صحتك المالية واستمر في تتبع معاملاتك اليومية لتحقيق أهدافك 🎯',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      } as any,
    });
  } catch (err) {
    console.warn('Failed to schedule daily reminder:', err);
  }
}

export async function cancelDailyReminder() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync('daily_reminder');
  } catch (e) {
    console.error('Error canceling daily reminder:', e);
  }
}

/**
 * Checks budget status after an expense and fires an alert if threshold exceeded
 */
export async function checkAndNotifyBudgetExceeded(
  categoryName: string,
  spentAmount: number,
  budgetAmount: number,
  currencySymbol: string,
  language: 'ar' | 'en' = 'ar'
) {
  if (Platform.OS === 'web' || budgetAmount <= 0) return;

  try {
    const settings = await getNotificationSettings();
    if (!settings.budgetAlertsEnabled) return;

    const ratio = spentAmount / budgetAmount;
    if (ratio >= 1.0) {
      const title = language === 'ar' ? '🚨 تجاوزت الميزانية المحددة!' : '🚨 Budget Limit Exceeded!';
      const body = language === 'ar'
        ? `لقد تجاوزت ميزانية (${categoryName})! إجمالي المصروف: ${Math.round(spentAmount)} ${currencySymbol} من أصل ${budgetAmount} ${currencySymbol}.`
        : `You exceeded your budget for (${categoryName})! Total spent: ${Math.round(spentAmount)} ${currencySymbol} of ${budgetAmount} ${currencySymbol}.`;
      await sendImmediateNotification(title, body, { type: 'budget_exceeded', categoryName });
    } else if (ratio >= 0.8) {
      const title = language === 'ar' ? '⚠️ تنبيه: اقتربت من حد الميزانية' : '⚠️ Warning: Approaching Budget Limit';
      const body = language === 'ar'
        ? `أنفقت ${Math.round(ratio * 100)}% من ميزانية (${categoryName}). متبقي لديك ${Math.max(0, Math.round(budgetAmount - spentAmount))} ${currencySymbol}.`
        : `You have spent ${Math.round(ratio * 100)}% of your (${categoryName}) budget. Remaining: ${Math.max(0, Math.round(budgetAmount - spentAmount))} ${currencySymbol}.`;
      await sendImmediateNotification(title, body, { type: 'budget_warning', categoryName });
    }
  } catch (err) {
    console.warn('Error checking budget notifications:', err);
  }
}

/**
 * Schedule monthly review notification for the 1st day of next month
 */
export async function scheduleMonthlyDigestNotification() {
  if (Platform.OS === 'web') return;

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    await cancelMonthlyDigestNotification();

    const now = new Date();
    // 1st of next month at 10:00 AM
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0, 0);

    await Notifications.scheduleNotificationAsync({
      identifier: 'monthly_digest_reminder',
      content: {
        title: '📊 تقريرك المالي الشهري جاهز!',
        body: 'اكتشف ملخص مصاريفك ونسبة ادخارك وإنجازاتك المالية للشهر الماضي في ميزان ✨',
        sound: true,
        data: { type: 'monthly_digest' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextMonthDate,
      } as any,
    });
  } catch (err) {
    console.warn('Failed to schedule monthly digest notification:', err);
  }
}

export async function cancelMonthlyDigestNotification() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync('monthly_digest_reminder');
  } catch (e) {
    console.error('Error canceling monthly digest notification:', e);
  }
}

export async function scheduleDebtReminder(
  debtId: string,
  personName: string,
  amount: number,
  currencySymbol: string,
  dueDateStr: string,
  isDebtToMe: boolean
) {
  if (Platform.OS === 'web') return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  const dueDate = new Date(dueDateStr);
  dueDate.setHours(10, 0, 0, 0);

  if (dueDate.getTime() <= Date.now()) {
    return;
  }

  await cancelDebtReminder(debtId);

  const title = isDebtToMe ? '⏰ موعد تحصيل دين' : '⏰ موعد سداد دين';
  const body = isDebtToMe
    ? `تذكير: اليوم هو موعد تحصيل مبلغ ${amount} ${currencySymbol} من ${personName}.`
    : `تذكير: اليوم هو موعد سداد مبلغ ${amount} ${currencySymbol} لـ ${personName}.`;

  await Notifications.scheduleNotificationAsync({
    identifier: `debt_${debtId}`,
    content: {
      title,
      body,
      sound: true,
      data: { debtId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: dueDate,
    } as any,
  });
}

export async function cancelDebtReminder(debtId: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`debt_${debtId}`);
  } catch (e) {
    console.error('Error canceling debt reminder:', e);
  }
}

