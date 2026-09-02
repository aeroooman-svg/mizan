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
  weeklyDigestEnabled: boolean;
  savingsMilestonesEnabled: boolean;
  smartInsightsEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyReminderEnabled: true,
  dailyReminderHour: 21,
  dailyReminderMinute: 0,
  budgetAlertsEnabled: true,
  monthlyDigestEnabled: true,
  streakRemindersEnabled: true,
  weeklyDigestEnabled: true,
  savingsMilestonesEnabled: true,
  smartInsightsEnabled: true,
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

    if (updated.weeklyDigestEnabled) {
      await scheduleWeeklyDigestNotification();
    } else {
      await cancelWeeklyDigestNotification();
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

export async function scheduleInstallmentReminder(
  planId: string,
  title: string,
  monthlyAmount: number,
  currencySymbol: string,
  dueDay: number,
  providerName: string = 'التقسيط'
) {
  if (Platform.OS === 'web') return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await cancelInstallmentReminder(planId);

  const now = new Date();
  let nextDate = new Date(now.getFullYear(), now.getMonth(), dueDay, 10, 0, 0);
  if (nextDate.getTime() <= now.getTime()) {
    nextDate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay, 10, 0, 0);
  }

  const notifTitle = `💳 موعد سداد قسط (${title})`;
  const notifBody = `تذكير بموعد سداد قسط ${title} بقيمة ${monthlyAmount} ${currencySymbol} عبر ${providerName}.`;

  await Notifications.scheduleNotificationAsync({
    identifier: `installment_${planId}`,
    content: {
      title: notifTitle,
      body: notifBody,
      sound: true,
      data: { type: 'installment', planId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextDate,
    } as any,
  });
}

export async function cancelInstallmentReminder(planId: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`installment_${planId}`);
  } catch (e) {
    console.error('Error canceling installment reminder:', e);
  }
}

export async function scheduleJameyaTurnReminder(
  jameyaId: string,
  jameyaName: string,
  monthlyAmount: number,
  currencySymbol: string,
  isPayoutMonth: boolean
) {
  if (Platform.OS === 'web') return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  const title = isPayoutMonth ? '🎉 حان موعد قبض جمعيتك!' : '🤝 موعد دفع قسط الجمعية';
  const body = isPayoutMonth
    ? `مبروك! هذا الشهر هو موعد استلام وقبض جمعية (${jameyaName}) المباركة.`
    : `تذكير بموعد دفع قسط جمعية (${jameyaName}) بقيمة ${monthlyAmount} ${currencySymbol}.`;

  await Notifications.scheduleNotificationAsync({
    identifier: `jameya_${jameyaId}`,
    content: {
      title,
      body,
      sound: true,
      data: { type: 'jameya', jameyaId },
    },
    trigger: null,
  });
}

export async function scheduleGoalMilestoneNotification(
  goalTitle: string,
  percent: number,
  language: 'ar' | 'en' = 'ar'
) {
  if (Platform.OS === 'web') return;

  const title = language === 'ar' ? '🎯 إنجاز رائع في هدفك المالي!' : '🎯 Great Goal Milestone!';
  const body = language === 'ar'
    ? `وصلت إلى ${percent}% من هدفك (${goalTitle})! واصل التقدم لتحقيق طموحك 🚀`
    : `You reached ${percent}% of your goal (${goalTitle})! Keep going 🚀`;

  await sendImmediateNotification(title, body, { type: 'goal_milestone', goalTitle });
}

export async function scheduleZakatReminder(
  nisabAmount: number,
  currencySymbol: string,
  language: 'ar' | 'en' = 'ar'
) {
  if (Platform.OS === 'web') return;

  const title = language === 'ar' ? '🕌 تنبيه نصاب الزكاة الشرعية' : '🕌 Zakat Nisab Threshold Alert';
  const body = language === 'ar'
    ? `بلغت مدخراتك النصاب الشرعي المقدر بـ ${Math.round(nisabAmount)} ${currencySymbol}. تفقد حاسبة الزكاة لحساب مقدار الواجب إخراجه بدقة.`
    : `Your savings reached the legal Zakat threshold (${Math.round(nisabAmount)} ${currencySymbol}). Check the Zakat calculator to calculate your due.`;

  await sendImmediateNotification(title, body, { type: 'zakat_nisab' });
}

// ── NEW SMART NOTIFICATIONS ─────────────────────────────

/**
 * Schedule weekly financial digest notification (every Friday at 6PM)
 */
export async function scheduleWeeklyDigestNotification() {
  if (Platform.OS === 'web') return;

  try {
    const settings = await getNotificationSettings();
    if (!settings.weeklyDigestEnabled) return;

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    await cancelWeeklyDigestNotification();

    await Notifications.scheduleNotificationAsync({
      identifier: 'weekly_digest',
      content: {
        title: '📊 ملخصك المالي الأسبوعي جاهز!',
        body: 'اكتشف كم صرفت هذا الأسبوع وقارن مع الأسبوع الماضي. افتح ميزان لمراجعة التفاصيل 💰',
        sound: true,
        data: { type: 'weekly_digest' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 6, // Friday (1=Sunday, 6=Friday)
        hour: 18,
        minute: 0,
      } as any,
    });
  } catch (err) {
    console.warn('Failed to schedule weekly digest notification:', err);
  }
}

export async function cancelWeeklyDigestNotification() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync('weekly_digest');
  } catch (e) {
    console.error('Error canceling weekly digest notification:', e);
  }
}

/**
 * Send a weekly digest with actual financial data
 */
export async function sendWeeklyDigestWithData(
  weeklyExpense: number,
  weeklyIncome: number,
  topCategoryName: string,
  topCategoryAmount: number,
  currencySymbol: string,
  language: 'ar' | 'en' = 'ar'
) {
  if (Platform.OS === 'web') return;

  try {
    const settings = await getNotificationSettings();
    if (!settings.weeklyDigestEnabled) return;

    const netSaved = weeklyIncome - weeklyExpense;

    const title = language === 'ar' ? '📊 ملخصك المالي الأسبوعي' : '📊 Your Weekly Financial Summary';
    const body = language === 'ar'
      ? `صرفت ${formatAmount(weeklyExpense)} ${currencySymbol} هذا الأسبوع. أعلى فئة: ${topCategoryName} (${formatAmount(topCategoryAmount)} ${currencySymbol}). ${netSaved >= 0 ? `وفرت ${formatAmount(netSaved)} ${currencySymbol} 🎉` : `تجاوزت الدخل بـ ${formatAmount(Math.abs(netSaved))} ${currencySymbol} ⚠️`}`
      : `Spent ${formatAmount(weeklyExpense)} ${currencySymbol} this week. Top: ${topCategoryName} (${formatAmount(topCategoryAmount)} ${currencySymbol}). ${netSaved >= 0 ? `Saved ${formatAmount(netSaved)} ${currencySymbol} 🎉` : `Overspent by ${formatAmount(Math.abs(netSaved))} ${currencySymbol} ⚠️`}`;

    await sendImmediateNotification(title, body, { type: 'weekly_digest_data' });
  } catch (err) {
    console.warn('Error sending weekly digest with data:', err);
  }
}

/**
 * Notify user when reaching savings goal milestones (25%, 50%, 75%, 100%)
 */
export async function notifySavingsMilestone(
  savedAmount: number,
  targetAmount: number,
  goalName: string,
  currencySymbol: string,
  language: 'ar' | 'en' = 'ar'
) {
  if (Platform.OS === 'web' || targetAmount <= 0) return;

  try {
    const settings = await getNotificationSettings();
    if (!settings.savingsMilestonesEnabled) return;

    const percent = Math.round((savedAmount / targetAmount) * 100);
    const milestones = [25, 50, 75, 100];
    const hitMilestone = milestones.find(m => percent >= m && percent < m + 5);
    
    if (!hitMilestone) return;

    // Check if already notified for this milestone
    const milestoneKey = `@mizan_milestone_${goalName}_${hitMilestone}`;
    const alreadyNotified = await AsyncStorage.getItem(milestoneKey);
    if (alreadyNotified) return;

    await AsyncStorage.setItem(milestoneKey, 'true');

    const emojis: Record<number, string> = { 25: '🌱', 50: '🔥', 75: '🚀', 100: '🏆' };
    const emoji = emojis[hitMilestone] || '🎯';

    let title: string;
    let body: string;

    if (hitMilestone === 100) {
      title = language === 'ar' ? `🏆 مبروك! حققت هدف (${goalName})!` : `🏆 Congrats! Goal (${goalName}) achieved!`;
      body = language === 'ar'
        ? `وصلت لـ ${formatAmount(savedAmount)} ${currencySymbol} من أصل ${formatAmount(targetAmount)} ${currencySymbol}. إنجاز رائع!`
        : `Reached ${formatAmount(savedAmount)} ${currencySymbol} of ${formatAmount(targetAmount)} ${currencySymbol}. Amazing achievement!`;
    } else {
      title = language === 'ar'
        ? `${emoji} وصلت لـ ${hitMilestone}% من هدف (${goalName})!`
        : `${emoji} Reached ${hitMilestone}% of (${goalName})!`;
      body = language === 'ar'
        ? `وفرت ${formatAmount(savedAmount)} ${currencySymbol} من أصل ${formatAmount(targetAmount)} ${currencySymbol}. واصل التقدم!`
        : `Saved ${formatAmount(savedAmount)} ${currencySymbol} of ${formatAmount(targetAmount)} ${currencySymbol}. Keep going!`;
    }

    await sendImmediateNotification(title, body, { type: 'savings_milestone', goalName, milestone: hitMilestone });
  } catch (err) {
    console.warn('Error sending savings milestone notification:', err);
  }
}

/**
 * Schedule streak reminder — fires if user hasn't logged transactions for 2 days
 */
export async function scheduleStreakReminderIfNeeded(
  lastTransactionDateStr: string | null,
  language: 'ar' | 'en' = 'ar'
) {
  if (Platform.OS === 'web') return;

  try {
    const settings = await getNotificationSettings();
    if (!settings.streakRemindersEnabled) return;

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    await cancelStreakReminder();

    if (!lastTransactionDateStr) return;

    const lastDate = new Date(lastTransactionDateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    // Only send if 2+ days have passed without logging
    if (diffDays < 2) {
      // Schedule for 2 days from last transaction
      const reminderDate = new Date(lastDate.getTime() + 2 * 24 * 60 * 60 * 1000);
      reminderDate.setHours(20, 0, 0, 0); // 8 PM

      if (reminderDate.getTime() <= now.getTime()) return;

      const title = language === 'ar' ? '🔥 حافظ على سلسلة التسجيل!' : '🔥 Keep Your Streak Alive!';
      const body = language === 'ar'
        ? 'مر يومين بدون تسجيل مصاريف. سجل معاملات اليوم عشان ما تفقدش الـ streak!'
        : "It's been 2 days since your last entry. Log today's expenses to keep your streak!";

      await Notifications.scheduleNotificationAsync({
        identifier: 'streak_reminder',
        content: { title, body, sound: true, data: { type: 'streak_reminder' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate } as any,
      });
    } else if (diffDays >= 2) {
      // Send immediately
      const title = language === 'ar' ? '🔥 رجعت وحشتنا!' : '🔥 Welcome Back!';
      const body = language === 'ar'
        ? `مر ${diffDays} ${diffDays > 10 ? 'يوم' : 'أيام'} بدون تسجيل. سجل مصاريف اليوم وارجع للمسار الصحيح!`
        : `It's been ${diffDays} days since your last entry. Log today and get back on track!`;

      await sendImmediateNotification(title, body, { type: 'streak_reminder' });
    }
  } catch (err) {
    console.warn('Error scheduling streak reminder:', err);
  }
}

export async function cancelStreakReminder() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync('streak_reminder');
  } catch (e) {
    console.error('Error canceling streak reminder:', e);
  }
}

/**
 * Smart spending insight — compares current week vs previous week by category
 */
export async function sendSmartSpendingInsight(
  currentWeekSpend: number,
  previousWeekSpend: number,
  topChangedCategory: string,
  changePercent: number,
  currencySymbol: string,
  language: 'ar' | 'en' = 'ar'
) {
  if (Platform.OS === 'web') return;

  try {
    const settings = await getNotificationSettings();
    if (!settings.smartInsightsEnabled) return;

    // Only send if there's a meaningful change (>15%)
    if (Math.abs(changePercent) < 15) return;

    // Don't spam — max once per week
    const lastInsightKey = '@mizan_last_spending_insight';
    const lastInsight = await AsyncStorage.getItem(lastInsightKey);
    if (lastInsight) {
      const lastDate = new Date(lastInsight);
      const daysSinceLast = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLast < 6) return;
    }
    await AsyncStorage.setItem(lastInsightKey, new Date().toISOString());

    let title: string;
    let body: string;

    if (changePercent > 0) {
      title = language === 'ar' ? '💡 تنبيه: زيادة في الإنفاق' : '💡 Spending Alert';
      body = language === 'ar'
        ? `إنفاقك هذا الأسبوع (${formatAmount(currentWeekSpend)} ${currencySymbol}) زاد ${Math.round(changePercent)}% عن الأسبوع الماضي. أعلى زيادة في: ${topChangedCategory}`
        : `This week's spending (${formatAmount(currentWeekSpend)} ${currencySymbol}) is ${Math.round(changePercent)}% higher than last week. Biggest increase: ${topChangedCategory}`;
    } else {
      title = language === 'ar' ? '🎉 ممتاز! إنفاقك في تحسن' : '🎉 Great! Your Spending Improved';
      body = language === 'ar'
        ? `إنفاقك هذا الأسبوع (${formatAmount(currentWeekSpend)} ${currencySymbol}) أقل بنسبة ${Math.abs(Math.round(changePercent))}% عن الأسبوع الماضي. استمر!`
        : `This week's spending (${formatAmount(currentWeekSpend)} ${currencySymbol}) is ${Math.abs(Math.round(changePercent))}% lower than last week. Keep it up!`;
    }

    await sendImmediateNotification(title, body, { type: 'smart_insight', changePercent });
  } catch (err) {
    console.warn('Error sending smart spending insight:', err);
  }
}

// ── Helper ──────────────────────────────────────────────
function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString();
}
