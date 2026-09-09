import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCategoryName } from './i18n';
import { formatCurrency } from './categories';
import { getDebts, Debt } from './debtStorage';
import { getInstallmentPlans, InstallmentPlan } from './installmentStorage';
import { getGoals, SavingsGoal } from './goalStorage';
import { getJameyas, Jameya } from './jameyaStorage';
import { getAllBudgets } from './budgetStorage';
import { getGoldAndSilverPrices } from './goldPriceApi';

export const NOTIFICATIONS_READ_KEY = '@mizan_notifications_read_v2';
export const NOTIFICATIONS_DISMISSED_KEY = '@mizan_notifications_dismissed_v2';

export type NotificationCategory = 'all' | 'budget' | 'debt_installment' | 'savings_goal' | 'ai_zakat';

export interface AppNotification {
  id: string;
  category: 'budget' | 'debt_installment' | 'savings_goal' | 'ai_zakat' | 'general';
  type: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  icon: string;
  iconType?: 'ionicons' | 'material' | 'fontAwesome5' | 'materialCommunity';
  iconColor: string;
  badgeLabel: string;
  badgeLabelEn: string;
  badgeColor: string;
  createdAt: string;
  actionText?: string;
  actionTextEn?: string;
  actionRoute?: string;
  actionParams?: Record<string, any>;
  priority: 'high' | 'normal' | 'low';
}

/**
 * Generate comprehensive smart notifications across the entire application ecosystem.
 * Safe and fault-tolerant against missing or malformed records.
 */
export async function generateFullAppNotifications(
  transactions: any[] = [],
  wallets: any[] = [],
  selectedWallet: any = null,
  totalIncome: number = 0,
  totalExpense: number = 0,
  balance: number = 0,
  pendingRecurring: any[] = [],
  currencySymbol: string = '',
  language: string = 'ar',
): Promise<AppNotification[]> {
  const notifications: AppNotification[] = [];
  const now = new Date();
  const currentMonthKey = now.toISOString().slice(0, 7); // YYYY-MM
  const todayStr = now.toISOString().slice(0, 10);

  const safeTxns = Array.isArray(transactions) ? transactions : [];
  const safePendingRecurring = Array.isArray(pendingRecurring) ? pendingRecurring : [];

  // Fetch cross-module records in parallel
  const [debtsRaw, installmentsRaw, goalsRaw, jameyasRaw, allBudgetsRaw, goldRates] = await Promise.all([
    getDebts().catch(() => [] as Debt[]),
    getInstallmentPlans().catch(() => [] as InstallmentPlan[]),
    getGoals().catch(() => [] as SavingsGoal[]),
    getJameyas().catch(() => [] as Jameya[]),
    getAllBudgets().catch(() => ({})),
    getGoldAndSilverPrices().catch(() => null),
  ]);

  const debts = Array.isArray(debtsRaw) ? debtsRaw : [];
  const installments = Array.isArray(installmentsRaw) ? installmentsRaw : [];
  const goals = Array.isArray(goalsRaw) ? goalsRaw : [];
  const jameyas = Array.isArray(jameyasRaw) ? jameyasRaw : [];
  const allBudgets = (allBudgetsRaw && typeof allBudgetsRaw === 'object') ? allBudgetsRaw : {};

  // ========================================================
  // 1. BUDGETS & SPENDING INTELLIGENCE (الميزانية والمصاريف)
  // ========================================================

  // A. Category Budget Alerts
  try {
    const walletBudgets: Record<string, number> =
      (selectedWallet?.id && (allBudgets as Record<string, Record<string, number>>)[selectedWallet.id]) || {};

    Object.keys(walletBudgets).forEach(catId => {
      const limit = Number(walletBudgets[catId]) || 0;
      if (limit > 0) {
        const monthTxns = safeTxns.filter(t =>
          t &&
          t.type === 'expense' &&
          t.category === catId &&
          typeof t.date === 'string' &&
          t.date.slice(0, 7) === currentMonthKey
        );
        const spent = monthTxns.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        let catName = catId;
        try {
          catName = getCategoryName(catId, language as any);
        } catch (_) {}

        if (spent >= limit) {
          notifications.push({
            id: `budget_exceeded_${catId}_${currentMonthKey}`,
            category: 'budget',
            type: 'budget_exceeded',
            title: `🚨 تجاوزت ميزانية ${catName}`,
            titleEn: `🚨 Exceeded ${catName} Budget`,
            body: `أنفقت ${formatCurrency(spent)} ${currencySymbol} من أصل ${formatCurrency(limit)} ${currencySymbol} المحددة لهذا الشهر.`,
            bodyEn: `You've spent ${formatCurrency(spent)} ${currencySymbol} of your ${formatCurrency(limit)} ${currencySymbol} budget for this month.`,
            icon: 'alert-circle',
            iconType: 'ionicons',
            iconColor: '#EF4444',
            badgeLabel: 'تجاوز ميزانية',
            badgeLabelEn: 'Budget Exceeded',
            badgeColor: '#EF4444',
            createdAt: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
            actionText: 'تعديل الميزانية',
            actionTextEn: 'Adjust Budget',
            actionRoute: '/(tabs)/plan',
            priority: 'high',
          });
        } else if (limit > 0 && spent / limit >= 0.8) {
          const remaining = Math.max(0, limit - spent);
          notifications.push({
            id: `budget_warn_${catId}_${currentMonthKey}`,
            category: 'budget',
            type: 'budget_warning',
            title: `⚠️ اقتربت من حد ميزانية ${catName}`,
            titleEn: `⚠️ Approaching ${catName} Limit`,
            body: `استهلكت ${Math.round((spent / limit) * 100)}% من ميزانية (${catName}). متبقي لديك فقط ${formatCurrency(remaining)} ${currencySymbol}.`,
            bodyEn: `You have consumed ${Math.round((spent / limit) * 100)}% of your (${catName}) budget. Remaining: ${formatCurrency(remaining)} ${currencySymbol}.`,
            icon: 'warning',
            iconType: 'ionicons',
            iconColor: '#F59E0B',
            badgeLabel: 'تنبيه ميزانية',
            badgeLabelEn: 'Budget Alert',
            badgeColor: '#F59E0B',
            createdAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
            actionText: 'عرض التفاصيل',
            actionTextEn: 'View Details',
            actionRoute: '/(tabs)/plan',
            priority: 'normal',
          });
        }
      }
    });
  } catch (err) {
    console.warn('Error processing budget notifications:', err);
  }

  // B. Overall Monthly Budget Ratio (> 85% of monthly income)
  if (totalIncome > 0 && totalExpense / totalIncome > 0.85) {
    const ratio = Math.round((totalExpense / totalIncome) * 100);
    notifications.push({
      id: `general_budget_warning_${currentMonthKey}`,
      category: 'budget',
      type: 'budget_alert',
      title: '⚠️ تحذير: استهلاك معظم الدخل الشهري',
      titleEn: '⚠️ Warning: Most Monthly Income Spent',
      body: `أنفقت حتى الآن ${ratio}% من إجمالي دخلك لهذا الشهر. يُنصح بمراجعة المصاريف غير الضرورية فوراً.`,
      bodyEn: `You have spent ${ratio}% of your monthly income so far. It is recommended to review unnecessary expenses.`,
      icon: 'trending-down',
      iconType: 'ionicons',
      iconColor: '#F97316',
      badgeLabel: 'الميزانية العامة',
      badgeLabelEn: 'General Budget',
      badgeColor: '#F97316',
      createdAt: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
      actionText: 'تحليل المصاريف',
      actionTextEn: 'Analyze Expenses',
      actionRoute: '/(tabs)/stats',
      priority: 'high',
    });
  }

  // C. Negative Balance Warning
  if (balance < 0) {
    notifications.push({
      id: `negative_balance_${currentMonthKey}`,
      category: 'budget',
      type: 'negative_balance',
      title: '🚨 رصيد المحفظة بالسالب!',
      titleEn: '🚨 Negative Wallet Balance!',
      body: `رصيد محفظتك الحالية هو (${formatCurrency(balance)} ${currencySymbol}). يرجى التحقق من مصادر الدخل وتسوية المعاملات.`,
      bodyEn: `Your current wallet balance is (${formatCurrency(balance)} ${currencySymbol}). Please verify income and settle transactions.`,
      icon: 'wallet',
      iconType: 'ionicons',
      iconColor: '#EF4444',
      badgeLabel: 'رصيد سالب',
      badgeLabelEn: 'Negative Balance',
      badgeColor: '#EF4444',
      createdAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      actionText: 'إضافة دخل',
      actionTextEn: 'Add Income',
      actionRoute: '/add-transaction',
      priority: 'high',
    });
  }

  // D. Daily Log Activity Reminder
  const todayTxns = safeTxns.filter(t => t && typeof t.date === 'string' && t.date.slice(0, 10) === todayStr);
  if (todayTxns.length === 0 && safeTxns.length > 0) {
    notifications.push({
      id: `daily_reminder_${todayStr}`,
      category: 'budget',
      type: 'daily_reminder',
      title: '📝 حافظ على سجلك المالي اليومي',
      titleEn: '📝 Keep Up Your Daily Financial Log',
      body: 'لم تقم بتسجيل أي معاملة اليوم. تسجيل المصاريف اللحظي يساعدك على معرفة أين تذهب أموالك بدقة.',
      bodyEn: 'You have not logged any transactions today. Logging expenses immediately gives you clear financial vision.',
      icon: 'create',
      iconType: 'ionicons',
      iconColor: '#00E676',
      badgeLabel: 'تذكير يومي',
      badgeLabelEn: 'Daily Reminder',
      badgeColor: '#00E676',
      createdAt: new Date(now.getTime() - 1000 * 60 * 10).toISOString(),
      actionText: 'تسجيل معاملة ⚡',
      actionTextEn: 'Add Transaction ⚡',
      actionRoute: '/add-transaction',
      priority: 'normal',
    });
  }

  // ========================================================
  // 2. DEBTS & INSTALLMENT PLANS (الأقساط والديون والجمعيات)
  // ========================================================

  // A. Installment Plans Due
  installments.forEach(plan => {
    if (plan && plan.remainingMonths > 0) {
      const isPaidThisMonth = plan.lastPaidMonth === currentMonthKey;
      if (!isPaidThisMonth) {
        const providerName =
          plan.provider === 'valu' ? 'ValU (فاليو)' :
          plan.provider === 'tabby' ? 'Tabby (تابي)' :
          plan.provider === 'tamara' ? 'Tamara (تمارا)' :
          plan.provider === 'bank_card' ? 'البنك' : 'الأقساط';

        notifications.push({
          id: `installment_due_${plan.id}_${currentMonthKey}`,
          category: 'debt_installment',
          type: 'installment_due',
          title: `💳 قسط مستحق: ${plan.title || ''}`,
          titleEn: `💳 Installment Due: ${plan.title || ''}`,
          body: `مستحق سداد مبلغ ${formatCurrency(plan.monthlyAmount || 0)} ${currencySymbol} عبر ${providerName} (متبقي ${plan.remainingMonths} من ${plan.totalMonths} أشهر).`,
          bodyEn: `Payment of ${formatCurrency(plan.monthlyAmount || 0)} ${currencySymbol} is due via ${providerName} (${plan.remainingMonths} of ${plan.totalMonths} months remaining).`,
          icon: 'card',
          iconType: 'ionicons',
          iconColor: '#3B82F6',
          badgeLabel: `قسط ${providerName}`,
          badgeLabelEn: 'Installment',
          badgeColor: '#3B82F6',
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
          actionText: 'سداد القسط الآن',
          actionTextEn: 'Pay Installment',
          actionRoute: '/installments',
          priority: 'high',
        });
      }
    }
  });

  // B. Debts & Loans Due
  debts.forEach(debt => {
    if (debt && debt.status !== 'paid') {
      const remainingAmount = (Number(debt.amount) || 0) - (Number(debt.paidAmount) || 0);
      const isDueToMe = debt.type === 'debt_to_me';
      const isOverdue = debt.dueDate && !isNaN(new Date(debt.dueDate).getTime()) && new Date(debt.dueDate).getTime() < now.getTime();
      const person = debt.personName || 'شخص';

      notifications.push({
        id: `debt_alert_${debt.id}`,
        category: 'debt_installment',
        type: 'debt_due',
        title: isDueToMe
          ? `💰 موعد تحصيل دين من (${person})`
          : `🤝 موعد سداد دين لـ (${person})`,
        titleEn: isDueToMe
          ? `💰 Collect Debt from (${person})`
          : `🤝 Pay Debt to (${person})`,
        body: isDueToMe
          ? `متبقي لك مبلغ ${formatCurrency(remainingAmount)} ${currencySymbol} طرف ${person}.${isOverdue ? ' (تجاوز التاريخ المحدد)' : ''}`
          : `متبقي عليك مبلغ ${formatCurrency(remainingAmount)} ${currencySymbol} لصالح ${person}.${isOverdue ? ' (تجاوز التاريخ المحدد)' : ''}`,
        bodyEn: isDueToMe
          ? `Remaining amount to collect: ${formatCurrency(remainingAmount)} ${currencySymbol} from ${person}.`
          : `Remaining amount to pay: ${formatCurrency(remainingAmount)} ${currencySymbol} to ${person}.`,
        icon: isDueToMe ? 'arrow-down-circle' : 'arrow-up-circle',
        iconType: 'ionicons',
        iconColor: isDueToMe ? '#10B981' : '#F59E0B',
        badgeLabel: isDueToMe ? 'دين لك' : 'دين عليك',
        badgeLabelEn: isDueToMe ? 'Receivable' : 'Payable',
        badgeColor: isDueToMe ? '#10B981' : '#F59E0B',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 4).toISOString(),
        actionText: 'إدارة الديون',
        actionTextEn: 'Manage Debts',
        actionRoute: '/debts',
        priority: isOverdue ? 'high' : 'normal',
      });
    }
  });

  // C. Jameya Turns
  jameyas.forEach(jameya => {
    if (jameya) {
      const isPaidThisMonth = jameya.lastPaidMonth === currentMonthKey;
      const isCompleted = (Number(jameya.paidMonthsCount) || 0) >= (Number(jameya.totalMonths) || 1);

      if (!isCompleted) {
        const currentMonthIndex = (Number(jameya.paidMonthsCount) || 0) + 1;
        const isPayoutTurn = (jameya.payoutMonths || [jameya.payoutMonth]).includes(currentMonthIndex);

        if (isPayoutTurn && !jameya.isPayoutReceived) {
          notifications.push({
            id: `jameya_payout_${jameya.id}_${currentMonthKey}`,
            category: 'debt_installment',
            type: 'jameya_payout',
            title: `🎉 مبروك! دورك في قبض جمعية (${jameya.name || ''})`,
            titleEn: `🎉 Congratulations! Your payout turn in (${jameya.name || ''})`,
            body: `هذا الشهر هو موعد استلام حصتك وقبض مبلغ الجمعية البالغ ${formatCurrency((Number(jameya.monthlyAmount) || 0) * (Number(jameya.totalMonths) || 1))} ${currencySymbol}.`,
            bodyEn: `This month is your turn to receive the Jameya payout of ${formatCurrency((Number(jameya.monthlyAmount) || 0) * (Number(jameya.totalMonths) || 1))} ${currencySymbol}.`,
            icon: 'gift',
            iconType: 'ionicons',
            iconColor: '#8B5CF6',
            badgeLabel: 'قبض جمعية 🎉',
            badgeLabelEn: 'Jameya Payout',
            badgeColor: '#8B5CF6',
            createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 1).toISOString(),
            actionText: 'تفاصيل الجمعية',
            actionTextEn: 'View Jameya',
            actionRoute: '/jameya',
            priority: 'high',
          });
        } else if (!isPaidThisMonth) {
          notifications.push({
            id: `jameya_due_${jameya.id}_${currentMonthKey}`,
            category: 'debt_installment',
            type: 'jameya_due',
            title: `🤝 قسط جمعية: ${jameya.name || ''}`,
            titleEn: `🤝 Jameya Due: ${jameya.name || ''}`,
            body: `تذكير بسداد القسط الشهري لجمعية ${jameya.name || ''} بمبلغ ${formatCurrency(Number(jameya.monthlyAmount) || 0)} ${currencySymbol} (الشهر ${(Number(jameya.paidMonthsCount) || 0) + 1} من ${Number(jameya.totalMonths) || 1}).`,
            bodyEn: `Reminder to pay monthly share for ${jameya.name || ''} of ${formatCurrency(Number(jameya.monthlyAmount) || 0)} ${currencySymbol} (Month ${(Number(jameya.paidMonthsCount) || 0) + 1} of ${Number(jameya.totalMonths) || 1}).`,
            icon: 'people',
            iconType: 'ionicons',
            iconColor: '#6366F1',
            badgeLabel: 'جمعية مالية',
            badgeLabelEn: 'Jameya',
            badgeColor: '#6366F1',
            createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
            actionText: 'سداد قسط الجمعية',
            actionTextEn: 'Pay Jameya',
            actionRoute: '/jameya',
            priority: 'normal',
          });
        }
      }
    }
  });

  // ========================================================
  // 3. SAVINGS GOALS & ACHIEVEMENTS (الأهداف والادخار)
  // ========================================================

  goals.forEach(goal => {
    if (goal && Number(goal.targetAmount) > 0) {
      const target = Number(goal.targetAmount);
      const saved = Number(goal.savedAmount) || 0;
      const progress = Math.min(100, Math.round((saved / target) * 100));

      if (progress >= 100) {
        notifications.push({
          id: `goal_completed_${goal.id}`,
          category: 'savings_goal',
          type: 'goal_completed',
          title: `🏆 مبروك! حققت هدفك (${goal.name || ''}) بالكامل!`,
          titleEn: `🏆 Congrats! Completed your goal (${goal.name || ''})!`,
          body: `تم ادخار كامل المبلغ المطلوب ${formatCurrency(target)} ${currencySymbol} بنجاح باهر! 🎯`,
          bodyEn: `You have successfully saved the entire target amount ${formatCurrency(target)} ${currencySymbol}! 🎯`,
          icon: 'trophy',
          iconType: 'ionicons',
          iconColor: '#10B981',
          badgeLabel: 'هدف مكتمل 🏆',
          badgeLabelEn: 'Goal Achieved',
          badgeColor: '#10B981',
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
          actionText: 'عرض الهدف',
          actionTextEn: 'View Goal',
          actionRoute: '/savings-goals',
          priority: 'high',
        });
      } else if (progress >= 50) {
        notifications.push({
          id: `goal_half_${goal.id}`,
          category: 'savings_goal',
          type: 'goal_milestone',
          title: `🎯 اقتربت! أنجزت ${progress}% من هدف (${goal.name || ''})`,
          titleEn: `🎯 Halfway there! Reached ${progress}% of (${goal.name || ''})`,
          body: `وفّرت حتى الآن ${formatCurrency(saved)} من أصل ${formatCurrency(target)} ${currencySymbol}. استمر بنفس العزيمة!`,
          bodyEn: `You have saved ${formatCurrency(saved)} of ${formatCurrency(target)} ${currencySymbol}. Keep the momentum!`,
          icon: 'ribbon',
          iconType: 'ionicons',
          iconColor: '#8B5CF6',
          badgeLabel: 'إنجاز ادخار',
          badgeLabelEn: 'Goal Milestone',
          badgeColor: '#8B5CF6',
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
          actionText: 'إيداع في الهدف',
          actionTextEn: 'Add to Goal',
          actionRoute: '/savings-goals',
          priority: 'normal',
        });
      }
    }
  });

  // Savings ratio achievement (> 25%)
  if (totalIncome > 0 && (totalIncome - totalExpense) / totalIncome >= 0.25) {
    const savedRatio = Math.round(((totalIncome - totalExpense) / totalIncome) * 100);
    notifications.push({
      id: `savings_ratio_achievement_${currentMonthKey}`,
      category: 'savings_goal',
      type: 'savings_achievement',
      title: '🌟 نسبة ادخار ممتازة هذا الشهر!',
      titleEn: '🌟 Excellent Savings Rate This Month!',
      body: `لقد نجحت في ادخار ${savedRatio}% من إجمالي دخلك حتى الآن! هذا يضعك في مصاف أصحاب الإدارة المالية الذكية.`,
      bodyEn: `You have successfully saved ${savedRatio}% of your total income so far! Great financial health.`,
      icon: 'sparkles',
      iconType: 'ionicons',
      iconColor: '#00E676',
      badgeLabel: 'وسام الادخار',
      badgeLabelEn: 'Savings Badge',
      badgeColor: '#00E676',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 8).toISOString(),
      actionText: 'تفاصيل الإحصائيات',
      actionTextEn: 'View Statistics',
      actionRoute: '/(tabs)/stats',
      priority: 'normal',
    });
  }

  // ========================================================
  // 4. ZAKAT & AI SMART ADVISOR (الزكاة والذكاء الاصطناعي)
  // ========================================================

  const goldGramRate = goldRates?.gold24kUsdPerGram || 148;
  const nisabUsd = 85 * goldGramRate;
  if (balance >= nisabUsd * 0.5 && balance > 0) {
    notifications.push({
      id: `zakat_nisab_alert_${now.getFullYear()}`,
      category: 'ai_zakat',
      type: 'zakat_nisab',
      title: '🕌 حاسبة الزكاة الشرعية المباشرة',
      titleEn: '🕌 Live Sharia Zakat Calculator',
      body: 'تابع رصيد أموالك ومدخراتك مع أسعار الذهب والفضة اللحظية لحساب مقدار الزكاة الواجبة بدقة شرعية متكاملة.',
      bodyEn: 'Track your wealth and savings with real-time gold and silver prices to calculate your due Zakat accurately.',
      icon: 'moon',
      iconType: 'ionicons',
      iconColor: '#EAB308',
      badgeLabel: 'الزكاة الشرعية',
      badgeLabelEn: 'Zakat Calculator',
      badgeColor: '#EAB308',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 18).toISOString(),
      actionText: 'حساب زكاتك الآن 🕌',
      actionTextEn: 'Calculate Zakat 🕌',
      actionRoute: '/zakat-calculator',
      priority: 'normal',
    });
  }

  // AI Financial Advisor Insight
  notifications.push({
    id: `ai_advisor_insight_${currentMonthKey}`,
    category: 'ai_zakat',
    type: 'ai_tip',
    title: '🤖 نصيحة مستشارك المالي الذكي (Gemini)',
    titleEn: '🤖 AI Financial Advisor Insight',
    body: 'قم بمراجعة اشتراكاتك المتكررة ومصاريف التسوق الأسبوعية لتحديد فرص توفير قد توفر لك ما يصل إلى 15% شهرياً.',
    bodyEn: 'Review your recurring subscriptions and shopping expenses to discover saving opportunities up to 15% monthly.',
    icon: 'hardware-chip',
    iconType: 'ionicons',
    iconColor: '#8B5CF6',
    badgeLabel: 'المستشار الذكي AI',
    badgeLabelEn: 'Smart AI Advisor',
    badgeColor: '#8B5CF6',
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 36).toISOString(),
    actionText: 'استشارة الذكاء الاصطناعي',
    actionTextEn: 'Ask AI Advisor',
    actionRoute: '/ai-advisor',
    priority: 'normal',
  });

  // ========================================================
  // 5. RECURRING & WELCOME NOTIFICATIONS (المعاملات المتكررة والترحيب)
  // ========================================================

  if (safePendingRecurring.length > 0) {
    notifications.push({
      id: `recurring_pending_${todayStr}`,
      category: 'budget',
      type: 'recurring_due',
      title: '🔔 معاملات واشتراكات متكررة بانتظارك',
      titleEn: '🔔 Pending Recurring Transactions',
      body: `لديك ${safePendingRecurring.length} معاملة متكررة تستحق التسجيل والموافقة لمطابقة رصيدك.`,
      bodyEn: `You have ${safePendingRecurring.length} recurring transaction(s) pending your confirmation.`,
      icon: 'repeat',
      iconType: 'ionicons',
      iconColor: '#0284C7',
      badgeLabel: 'معاملات متكررة',
      badgeLabelEn: 'Recurring',
      badgeColor: '#0284C7',
      createdAt: new Date(now.getTime() - 1000 * 60 * 20).toISOString(),
      actionText: 'مراجعة المعاملات',
      actionTextEn: 'Review Transactions',
      actionRoute: '/recurring-list',
      priority: 'high',
    });
  }

  // Welcome to MIZAN
  notifications.push({
    id: 'welcome_mizan',
    category: 'general',
    type: 'welcome',
    title: 'مرحباً بك في مِيزان MIZAN! 🎉',
    titleEn: 'Welcome to MIZAN! 🎉',
    body: 'تطبيقك المالي الذكي لإدارة المصاريف، الميزانية، حاسبة الزكاة الشرعية، وتتبع الأقساط والديون بأعلى درجات الخصوصية والأمان.',
    bodyEn: 'Your smart financial companion for expense tracking, budgets, Zakat calculator, and installment management with complete privacy.',
    icon: 'sparkles',
    iconType: 'ionicons',
    iconColor: '#00E676',
    badgeLabel: 'مرحباً بك',
    badgeLabelEn: 'Welcome',
    badgeColor: '#00E676',
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    actionText: 'استكشاف المميزات',
    actionTextEn: 'Explore Features',
    actionRoute: '/(tabs)',
    priority: 'low',
  });

  // Sort by createdAt descending
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return notifications;
}

/**
 * Calculates the exact unread notifications count, synchronized with the Notifications screen.
 * If all notifications are dismissed or read, or if none exist, returns 0.
 */
export async function getUnreadNotificationsCount(params: {
  transactions: any[];
  wallets: any[];
  selectedWallet: any;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  pendingRecurring: any[];
  currencySymbol?: string;
  language?: string;
}): Promise<number> {
  try {
    const [readData, dismissedData] = await Promise.all([
      AsyncStorage.getItem(NOTIFICATIONS_READ_KEY),
      AsyncStorage.getItem(NOTIFICATIONS_DISMISSED_KEY),
    ]);

    const readIds = new Set<string>(readData ? JSON.parse(readData) : []);
    const dismissedIds = new Set<string>(dismissedData ? JSON.parse(dismissedData) : []);

    const allNotifications = await generateFullAppNotifications(
      params.transactions,
      params.wallets,
      params.selectedWallet,
      params.totalIncome,
      params.totalExpense,
      params.balance,
      params.pendingRecurring,
      params.currencySymbol || '',
      params.language || 'ar',
    );

    // Filter out dismissed notifications
    const visibleNotifications = allNotifications.filter(n => !dismissedIds.has(n.id));

    // Count unread among visible notifications only
    const unreadCount = visibleNotifications.filter(n => !readIds.has(n.id)).length;

    return unreadCount;
  } catch (e) {
    console.warn('Error calculating unread notification count:', e);
    return 0;
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(id: string): Promise<Set<string>> {
  try {
    const readData = await AsyncStorage.getItem(NOTIFICATIONS_READ_KEY);
    const readIds = new Set<string>(readData ? JSON.parse(readData) : []);
    readIds.add(id);
    await AsyncStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify([...readIds]));
    return readIds;
  } catch (e) {
    return new Set([id]);
  }
}

/**
 * Mark a list of notifications as read
 */
export async function markAllNotificationsAsRead(ids: string[]): Promise<Set<string>> {
  try {
    const readData = await AsyncStorage.getItem(NOTIFICATIONS_READ_KEY);
    const readIds = new Set<string>(readData ? JSON.parse(readData) : []);
    ids.forEach(id => readIds.add(id));
    await AsyncStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify([...readIds]));
    return readIds;
  } catch (e) {
    return new Set(ids);
  }
}
