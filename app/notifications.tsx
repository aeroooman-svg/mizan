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
import { getCategoryName } from '@/lib/i18n';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getDebts, Debt } from '@/lib/debtStorage';
import { getInstallmentPlans, InstallmentPlan } from '@/lib/installmentStorage';
import { getGoals, SavingsGoal } from '@/lib/goalStorage';
import { getJameyas, Jameya } from '@/lib/jameyaStorage';
import { getAllBudgets } from '@/lib/budgetStorage';
import { getGoldAndSilverPrices } from '@/lib/goldPriceApi';

const NOTIFICATIONS_READ_KEY = '@mizan_notifications_read_v2';
const NOTIFICATIONS_DISMISSED_KEY = '@mizan_notifications_dismissed_v2';

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

// Generate comprehensive smart notifications across the entire application ecosystem
async function generateFullAppNotifications(
  transactions: any[],
  wallets: any[],
  selectedWallet: any,
  totalIncome: number,
  totalExpense: number,
  balance: number,
  pendingRecurring: any[],
  currencySymbol: string,
  language: string,
): Promise<AppNotification[]> {
  const notifications: AppNotification[] = [];
  const now = new Date();
  const currentMonthKey = now.toISOString().slice(0, 7); // YYYY-MM
  const todayStr = now.toISOString().slice(0, 10);

  // Fetch cross-module records in parallel
  const [debts, installments, goals, jameyas, allBudgets, goldRates] = await Promise.all([
    getDebts().catch(() => [] as Debt[]),
    getInstallmentPlans().catch(() => [] as InstallmentPlan[]),
    getGoals().catch(() => [] as SavingsGoal[]),
    getJameyas().catch(() => [] as Jameya[]),
    getAllBudgets().catch(() => ({})),
    getGoldAndSilverPrices().catch(() => null),
  ]);

  // ========================================================
  // 1. BUDGETS & SPENDING INTELLIGENCE (الميزانية والمصاريف)
  // ========================================================

  // A. Category Budget Alerts (تجاوز أو اقتراب ميزانية فئة معينة)
  const walletBudgets: Record<string, number> = (selectedWallet?.id && (allBudgets as Record<string, Record<string, number>>)[selectedWallet.id]) || {};
  Object.keys(walletBudgets).forEach(catId => {
    const limit = walletBudgets[catId];
    if (limit > 0) {
      const monthTxns = transactions.filter(t => 
        t.type === 'expense' && 
        t.category === catId && 
        t.date.slice(0, 7) === currentMonthKey
      );
      const spent = monthTxns.reduce((s, t) => s + t.amount, 0);
      const catName = getCategoryName(catId, language as any);

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
      } else if (spent / limit >= 0.8) {
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

  // B. Overall Monthly Budget Ratio (إنفاق > 80% من إجمالي الدخل)
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

  // C. Negative / Low Balance Warning (رصيد سالب أو منخفض)
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

  // D. Daily Log Activity Reminder (تذكير تسجيل مصاريف اليوم)
  const todayTxns = transactions.filter(t => t.date.slice(0, 10) === todayStr);
  if (todayTxns.length === 0 && transactions.length > 0) {
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

  // A. Installment Plans Due (أقساط فاليو، تابي، تمارا، كروت البنوك)
  installments.forEach(plan => {
    if (plan.remainingMonths > 0) {
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
          title: `💳 قسط مستحق: ${plan.title}`,
          titleEn: `💳 Installment Due: ${plan.title}`,
          body: `مستحق سداد مبلغ ${formatCurrency(plan.monthlyAmount)} ${currencySymbol} عبر ${providerName} (متبقي ${plan.remainingMonths} من ${plan.totalMonths} أشهر).`,
          bodyEn: `Payment of ${formatCurrency(plan.monthlyAmount)} ${currencySymbol} is due via ${providerName} (${plan.remainingMonths} of ${plan.totalMonths} months remaining).`,
          icon: 'card',
          iconType: 'ionicons',
          iconColor: '#3B82F6',
          badgeLabel: `قسط ${providerName}`,
          badgeLabelEn: `Installment`,
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

  // B. Debts & Loans Due (الديون المستحقة والسلف)
  debts.forEach(debt => {
    if (debt.status !== 'paid') {
      const remainingAmount = debt.amount - (debt.paidAmount || 0);
      const isDueToMe = debt.type === 'debt_to_me';
      const isOverdue = debt.dueDate && new Date(debt.dueDate).getTime() < now.getTime();

      notifications.push({
        id: `debt_alert_${debt.id}`,
        category: 'debt_installment',
        type: 'debt_due',
        title: isDueToMe 
          ? `💰 موعد تحصيل دين من (${debt.personName})`
          : `🤝 موعد سداد دين لـ (${debt.personName})`,
        titleEn: isDueToMe 
          ? `💰 Collect Debt from (${debt.personName})`
          : `🤝 Pay Debt to (${debt.personName})`,
        body: isDueToMe
          ? `متبقي لك مبلغ ${formatCurrency(remainingAmount)} ${currencySymbol} طرف ${debt.personName}.${isOverdue ? ' (تجاوز التاريخ المحدد)' : ''}`
          : `متبقي عليك مبلغ ${formatCurrency(remainingAmount)} ${currencySymbol} لصالح ${debt.personName}.${isOverdue ? ' (تجاوز التاريخ المحدد)' : ''}`,
        bodyEn: isDueToMe
          ? `Remaining amount to collect: ${formatCurrency(remainingAmount)} ${currencySymbol} from ${debt.personName}.`
          : `Remaining amount to pay: ${formatCurrency(remainingAmount)} ${currencySymbol} to ${debt.personName}.`,
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

  // C. Jameya Turns (الجمعيات المالية - قسط أو قبض)
  jameyas.forEach(jameya => {
    const isPaidThisMonth = jameya.lastPaidMonth === currentMonthKey;
    const isCompleted = jameya.paidMonthsCount >= jameya.totalMonths;

    if (!isCompleted) {
      // Check if current month is payout month
      const currentMonthIndex = jameya.paidMonthsCount + 1;
      const isPayoutTurn = (jameya.payoutMonths || [jameya.payoutMonth]).includes(currentMonthIndex);

      if (isPayoutTurn && !jameya.isPayoutReceived) {
        notifications.push({
          id: `jameya_payout_${jameya.id}_${currentMonthKey}`,
          category: 'debt_installment',
          type: 'jameya_payout',
          title: `🎉 مبروك! دورك في قبض جمعية (${jameya.name})`,
          titleEn: `🎉 Congratulations! Your payout turn in (${jameya.name})`,
          body: `هذا الشهر هو موعد استلام حصتك وقبض مبلغ الجمعية البالغ ${formatCurrency(jameya.monthlyAmount * jameya.totalMonths)} ${currencySymbol}.`,
          bodyEn: `This month is your turn to receive the Jameya payout of ${formatCurrency(jameya.monthlyAmount * jameya.totalMonths)} ${currencySymbol}.`,
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
          title: `🤝 قسط جمعية: ${jameya.name}`,
          titleEn: `🤝 Jameya Due: ${jameya.name}`,
          body: `تذكير بسداد القسط الشهري لجمعية ${jameya.name} بمبلغ ${formatCurrency(jameya.monthlyAmount)} ${currencySymbol} (الشهر ${jameya.paidMonthsCount + 1} من ${jameya.totalMonths}).`,
          bodyEn: `Reminder to pay monthly share for ${jameya.name} of ${formatCurrency(jameya.monthlyAmount)} ${currencySymbol} (Month ${jameya.paidMonthsCount + 1} of ${jameya.totalMonths}).`,
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
  });

  // ========================================================
  // 3. SAVINGS GOALS & ACHIEVEMENTS (الأهداف والادخار)
  // ========================================================

  // A. Savings Goals Milestones (أهداف الادخار والحصالة)
  goals.forEach(goal => {
    if (goal.targetAmount > 0) {
      const progress = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
      if (progress >= 100) {
        notifications.push({
          id: `goal_completed_${goal.id}`,
          category: 'savings_goal',
          type: 'goal_completed',
          title: `🏆 مبروك! حققت هدفك (${goal.name}) بالكامل!`,
          titleEn: `🏆 Congrats! Completed your goal (${goal.name})!`,
          body: `تم ادخار كامل المبلغ المطلوب ${formatCurrency(goal.targetAmount)} ${currencySymbol} بنجاح باهر! 🎯`,
          bodyEn: `You have successfully saved the entire target amount ${formatCurrency(goal.targetAmount)} ${currencySymbol}! 🎯`,
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
          title: `🎯 اقتربت! أنجزت ${progress}% من هدف (${goal.name})`,
          titleEn: `🎯 Halfway there! Reached ${progress}% of (${goal.name})`,
          body: `وفّرت حتى الآن ${formatCurrency(goal.savedAmount)} من أصل ${formatCurrency(goal.targetAmount)} ${currencySymbol}. استمر بنفس العزيمة!`,
          bodyEn: `You have saved ${formatCurrency(goal.savedAmount)} of ${formatCurrency(goal.targetAmount)} ${currencySymbol}. Keep the momentum!`,
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

  // B. Savings Ratio Achievement (إنجاز نسبة ادخار > 25%)
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

  // A. Zakat Legal Nisab Alert (بلوغ نصاب الزكاة الشرعي بناء على أسعار الذهب اللحظية)
  const goldGramRate = goldRates?.gold24kUsdPerGram || 148;
  const nisabUsd = 85 * goldGramRate; // 85 grams 24K
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

  // B. AI Financial Advisor Tip (نصيحة المستشار المالي بالذكاء الاصطناعي)
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

  if (pendingRecurring.length > 0) {
    notifications.push({
      id: `recurring_pending_${todayStr}`,
      category: 'budget',
      type: 'recurring_due',
      title: '🔔 معاملات واشتراكات متكررة بانتظارك',
      titleEn: '🔔 Pending Recurring Transactions',
      body: `لديك ${pendingRecurring.length} معاملة متكررة تستحق التسجيل والموافقة لمطابقة رصيدك.`,
      bodyEn: `You have ${pendingRecurring.length} recurring transaction(s) pending your confirmation.`,
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

  // Sort by created date descending
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return notifications;
}

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
