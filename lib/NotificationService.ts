import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Set up notification handler so notifications show up even if the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

export async function sendImmediateNotification(title: string, body: string) {
  if (Platform.OS === 'web') return;
  
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null, // null means trigger immediately
  });
}

export async function scheduleDailyReminder(hour: number = 21, minute: number = 0) {
  if (Platform.OS === 'web') return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  // Cancel any existing daily reminders first
  await cancelDailyReminder();

  await Notifications.scheduleNotificationAsync({
    identifier: 'daily_reminder',
    content: {
      title: '📝 سجل مصاريفك اليوم!',
      body: 'حافظ على صحتك المالية ولا تنسَ تسجيل معاملاتك اليومية.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    } as any,
  });
}

export async function cancelDailyReminder() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync('daily_reminder');
  } catch (e) {
    console.error('Error canceling daily reminder:', e);
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
  // Set notification for 10:00 AM on the due date
  dueDate.setHours(10, 0, 0, 0);

  if (dueDate.getTime() <= Date.now()) {
    // If due date is already in the past, don't schedule a future notification
    return;
  }

  // Cancel any existing reminder for this debt
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
