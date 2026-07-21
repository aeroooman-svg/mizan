/**
 * Smart Advisor Engine — محرك المستشار المالي الذكي
 * 
 * Analyzes real user financial data to provide personalized,
 * context-aware responses. Built with a provider pattern so
 * it can be swapped with Gemini/OpenAI API later.
 */

import { Transaction, Wallet } from './storage';
import { getCategoryById } from './categories';
import { getCategoryName } from './i18n';

// ── Types ──────────────────────────────────────────────

export interface FinancialContext {
  transactions: Transaction[];
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  budgets: Record<string, number>;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  currencySymbol: string;
  language: 'ar' | 'en';
}

interface SpendingPattern {
  dayOfWeek: { day: string; dayIndex: number; avgSpend: number }[];
  highestDay: { day: string; avgSpend: number };
  lowestDay: { day: string; avgSpend: number };
}

interface CategoryTrend {
  categoryId: string;
  categoryName: string;
  thisMonth: number;
  lastMonth: number;
  changePercent: number;
  direction: 'up' | 'down' | 'stable';
}

interface AnomalyDetection {
  isAnomaly: boolean;
  categoryId: string;
  categoryName: string;
  currentWeekSpend: number;
  weeklyAverage: number;
  percentAbove: number;
}

interface SuggestedQuestion {
  textAr: string;
  textEn: string;
}

// ── Day/Month Helpers ──────────────────────────────────

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ── Analysis Functions ─────────────────────────────────

function getWalletTransactions(ctx: FinancialContext): Transaction[] {
  if (!ctx.selectedWallet) return ctx.transactions;
  return ctx.transactions.filter(t =>
    t.walletId === ctx.selectedWallet!.id ||
    (t.type === 'transfer' && t.toWalletId === ctx.selectedWallet!.id)
  );
}

function getCurrentMonthTxns(txns: Transaction[]): Transaction[] {
  const now = new Date();
  return txns.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function getLastMonthTxns(txns: Transaction[]): Transaction[] {
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return txns.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === lastMonth && d.getFullYear() === lastYear;
  });
}

/** Analyze spending by day of week */
function analyzeDayOfWeekPattern(txns: Transaction[], lang: 'ar' | 'en'): SpendingPattern {
  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
  const days = lang === 'ar' ? DAYS_AR : DAYS_EN;

  const expenses = txns.filter(t => t.type === 'expense');
  for (const tx of expenses) {
    const dayIndex = new Date(tx.date).getDay();
    dayTotals[dayIndex] += tx.amount;
    dayCounts[dayIndex]++;
  }

  // Count unique weeks in dataset for better averaging
  const weekSet = new Set<string>();
  for (const tx of expenses) {
    const d = new Date(tx.date);
    const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}`;
    weekSet.add(weekKey);
  }
  const numWeeks = Math.max(weekSet.size, 1);

  const pattern = days.map((day, i) => ({
    day,
    dayIndex: i,
    avgSpend: dayCounts[i] > 0 ? Math.round(dayTotals[i] / numWeeks) : 0,
  }));

  const sorted = [...pattern].sort((a, b) => b.avgSpend - a.avgSpend);
  return {
    dayOfWeek: pattern,
    highestDay: sorted[0],
    lowestDay: sorted.filter(d => d.avgSpend > 0).pop() || sorted[sorted.length - 1],
  };
}

/** Compare category spending between this month and last month */
function analyzeCategoryTrends(txns: Transaction[], lang: 'ar' | 'en'): CategoryTrend[] {
  const thisMonthTxns = getCurrentMonthTxns(txns).filter(t => t.type === 'expense');
  const lastMonthTxns = getLastMonthTxns(txns).filter(t => t.type === 'expense');

  const thisMonthMap: Record<string, number> = {};
  const lastMonthMap: Record<string, number> = {};

  for (const tx of thisMonthTxns) {
    thisMonthMap[tx.category] = (thisMonthMap[tx.category] || 0) + tx.amount;
  }
  for (const tx of lastMonthTxns) {
    lastMonthMap[tx.category] = (lastMonthMap[tx.category] || 0) + tx.amount;
  }

  const allCats = new Set([...Object.keys(thisMonthMap), ...Object.keys(lastMonthMap)]);
  const trends: CategoryTrend[] = [];

  for (const catId of allCats) {
    const thisMonth = thisMonthMap[catId] || 0;
    const lastMonth = lastMonthMap[catId] || 0;

    if (lastMonth === 0 && thisMonth === 0) continue;

    const changePercent = lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : (thisMonth > 0 ? 100 : 0);

    trends.push({
      categoryId: catId,
      categoryName: getCategoryName(catId, lang),
      thisMonth,
      lastMonth,
      changePercent: Math.abs(changePercent),
      direction: changePercent > 10 ? 'up' : changePercent < -10 ? 'down' : 'stable',
    });
  }

  return trends.sort((a, b) => b.changePercent - a.changePercent);
}

/** Detect unusual spending in the current week compared to weekly averages */
function detectAnomalies(txns: Transaction[], lang: 'ar' | 'en'): AnomalyDetection[] {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const expenses = txns.filter(t => t.type === 'expense');

  // This week's spending by category
  const thisWeek: Record<string, number> = {};
  for (const tx of expenses) {
    const d = new Date(tx.date);
    if (d >= oneWeekAgo && d <= now) {
      thisWeek[tx.category] = (thisWeek[tx.category] || 0) + tx.amount;
    }
  }

  // Last 4 weeks average by category (excluding this week)
  const last4Weeks: Record<string, number> = {};
  for (const tx of expenses) {
    const d = new Date(tx.date);
    if (d >= fourWeeksAgo && d < oneWeekAgo) {
      last4Weeks[tx.category] = (last4Weeks[tx.category] || 0) + tx.amount;
    }
  }

  const anomalies: AnomalyDetection[] = [];
  for (const catId of Object.keys(thisWeek)) {
    const weeklyAvg = (last4Weeks[catId] || 0) / 3; // average of 3 previous weeks
    if (weeklyAvg > 0 && thisWeek[catId] > weeklyAvg * 1.5) {
      anomalies.push({
        isAnomaly: true,
        categoryId: catId,
        categoryName: getCategoryName(catId, lang),
        currentWeekSpend: thisWeek[catId],
        weeklyAverage: Math.round(weeklyAvg),
        percentAbove: Math.round(((thisWeek[catId] - weeklyAvg) / weeklyAvg) * 100),
      });
    }
  }

  return anomalies.sort((a, b) => b.percentAbove - a.percentAbove);
}

/** Predict future savings based on current trajectory */
function predictFutureSavings(txns: Transaction[], months: number): { total: number; monthlyAvg: number } {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const recentTxns = txns.filter(t => new Date(t.date) >= threeMonthsAgo);
  const income = recentTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = recentTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const monthsInData = Math.max(1, Math.min(3, Math.ceil((now.getTime() - threeMonthsAgo.getTime()) / (30 * 24 * 60 * 60 * 1000))));
  const monthlyAvgSaving = (income - expense) / monthsInData;

  return {
    total: Math.round(monthlyAvgSaving * months),
    monthlyAvg: Math.round(monthlyAvgSaving),
  };
}

/** Get top spending categories this month */
function getTopCategories(txns: Transaction[], lang: 'ar' | 'en', limit = 3): { name: string; total: number; percent: number }[] {
  const monthlyExpenses = getCurrentMonthTxns(txns).filter(t => t.type === 'expense');
  const totalExpense = monthlyExpenses.reduce((s, t) => s + t.amount, 0);
  if (totalExpense === 0) return [];

  const catMap: Record<string, number> = {};
  for (const tx of monthlyExpenses) {
    catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount;
  }

  return Object.entries(catMap)
    .map(([catId, total]) => ({
      name: getCategoryName(catId, lang),
      total,
      percent: Math.round((total / totalExpense) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/** Get today's spending summary */
function getTodaySummary(txns: Transaction[]): { spent: number; earned: number; count: number } {
  const now = new Date();
  const today = txns.filter(t => {
    const d = new Date(t.date);
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return {
    spent: today.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    earned: today.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    count: today.length,
  };
}

// ── Intent Detection ───────────────────────────────────

type QuestionIntent =
  | 'saving_tips'
  | 'spending_pattern'
  | 'can_afford'
  | 'debt_advice'
  | 'investment'
  | 'budget_status'
  | 'comparison'
  | 'prediction'
  | 'anomaly_check'
  | 'today_summary'
  | 'top_categories'
  | 'general';

function detectIntent(question: string): QuestionIntent {
  const q = question.toLowerCase();

  // Affordability
  if (/أشتري|أقدر أشتري|هل أقدر|can i (buy|afford)|purchase|شراء/.test(q)) return 'can_afford';

  // Saving
  if (/توفير|ادخار|وفر|أوفر|save|saving|ادخر/.test(q)) return 'saving_tips';

  // Spending pattern
  if (/نمط|عادة|يوم|أكثر يوم|pattern|habit|day|أصرف|بصرف/.test(q)) return 'spending_pattern';

  // Debt
  if (/دين|ديون|سداد|debt|payoff|owe|مديون/.test(q)) return 'debt_advice';

  // Investment
  if (/استثمار|ذهب|بورصة|أسهم|invest|gold|stock|crypto/.test(q)) return 'investment';

  // Budget status
  if (/ميزانية|budget|حد|limit|تجاوز|overrun/.test(q)) return 'budget_status';

  // Comparison
  if (/مقارنة|الشهر اللي فات|الشهر الماضي|compar|last month|previous/.test(q)) return 'comparison';

  // Prediction
  if (/توقع|مستقبل|predict|forecast|كم هوفر|هوصل/.test(q)) return 'prediction';

  // Anomaly
  if (/غريب|unusual|مصروف كبير|زيادة|ارتفاع|spike/.test(q)) return 'anomaly_check';

  // Today
  if (/النهارده|اليوم|today/.test(q)) return 'today_summary';

  // Top categories
  if (/أكثر فئة|أعلى|top|highest|بصرف على إيه|أصرف على/.test(q)) return 'top_categories';

  return 'general';
}

// ── Smart Response Generator ──────────────────────────

export function getSmartResponse(question: string, ctx: FinancialContext): string {
  const { language: lang, currencySymbol: cur } = ctx;
  const walletTxns = getWalletTransactions(ctx);
  const intent = detectIntent(question);

  switch (intent) {

    case 'spending_pattern': {
      const pattern = analyzeDayOfWeekPattern(walletTxns, lang);
      if (pattern.highestDay.avgSpend === 0) {
        return lang === 'ar'
          ? 'لا توجد بيانات كافية لتحليل أنماط الإنفاق. سجّل بعض المعاملات أولاً وسأحلل لك أنماطك بالتفصيل!'
          : 'Not enough data to analyze spending patterns. Log some transactions first and I\'ll analyze your patterns in detail!';
      }
      const topDays = pattern.dayOfWeek
        .filter(d => d.avgSpend > 0)
        .sort((a, b) => b.avgSpend - a.avgSpend)
        .slice(0, 3);

      if (lang === 'ar') {
        let msg = `📊 تحليل أنماط إنفاقك:\n\n`;
        msg += `🔴 أكثر يوم إنفاقاً: **${pattern.highestDay.day}** بمتوسط ${pattern.highestDay.avgSpend} ${cur} أسبوعياً.\n`;
        msg += `🟢 أقل يوم: **${pattern.lowestDay.day}** بمتوسط ${pattern.lowestDay.avgSpend} ${cur}.\n\n`;
        msg += `💡 نصيحة: حاول تقليل الإنفاق يوم ${pattern.highestDay.day} بنسبة 20% فقط — ستوفر حوالي ${Math.round(pattern.highestDay.avgSpend * 0.2 * 4)} ${cur} شهرياً!`;
        return msg;
      } else {
        let msg = `📊 Your spending patterns analysis:\n\n`;
        msg += `🔴 Highest spending day: **${pattern.highestDay.day}** — avg ${pattern.highestDay.avgSpend} ${cur}/week\n`;
        msg += `🟢 Lowest spending day: **${pattern.lowestDay.day}** — avg ${pattern.lowestDay.avgSpend} ${cur}/week\n\n`;
        msg += `💡 Tip: Reducing ${pattern.highestDay.day} spending by just 20% would save you ~${Math.round(pattern.highestDay.avgSpend * 0.2 * 4)} ${cur}/month!`;
        return msg;
      }
    }

    case 'can_afford': {
      // Extract amount from question
      const numMatch = question.match(/(\d[\d,\.]*)/);
      let targetAmount = numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : 0;

      // Common item prices if no amount specified
      if (targetAmount === 0) {
        if (/آيفون|iphone/i.test(question)) targetAmount = 50000;
        else if (/لابتوب|laptop/i.test(question)) targetAmount = 30000;
        else if (/سيارة|car/i.test(question)) targetAmount = 500000;
        else if (/بلايستيشن|playstation|ps5/i.test(question)) targetAmount = 25000;
      }

      if (targetAmount === 0) {
        return lang === 'ar'
          ? 'حدد المبلغ أو المنتج اللي عايز تشتريه وهحسبلك لو تقدر تحمله ولا لا. مثال: "هل أقدر أشتري آيفون؟" أو "هل أقدر أصرف 5000 جنيه؟"'
          : 'Please specify the amount or product you want to buy, and I\'ll calculate if you can afford it. Example: "Can I buy an iPhone?" or "Can I spend 5000?"';
      }

      const prediction = predictFutureSavings(walletTxns, 1);
      const currentBalance = ctx.balance;
      const monthlyNet = prediction.monthlyAvg;

      if (currentBalance >= targetAmount) {
        const percentOfBalance = Math.round((targetAmount / currentBalance) * 100);
        if (lang === 'ar') {
          return `✅ نعم! يمكنك تحمل هذا الشراء (${targetAmount.toLocaleString()} ${cur}).\n\n` +
            `💰 رصيدك الحالي: ${currentBalance.toLocaleString()} ${cur}\n` +
            `📊 سيستهلك ${percentOfBalance}% من رصيدك.\n` +
            (percentOfBalance > 50
              ? `\n⚠️ لكن انتبه! سيأخذ أكثر من نصف رصيدك. ننصحك بالتوفير شهرياً بدلاً من الشراء دفعة واحدة.`
              : `\n👍 هذا مبلغ معقول بالنسبة لرصيدك. يمكنك الشراء بثقة.`);
        } else {
          return `✅ Yes! You can afford this purchase (${targetAmount.toLocaleString()} ${cur}).\n\n` +
            `💰 Current balance: ${currentBalance.toLocaleString()} ${cur}\n` +
            `📊 It would consume ${percentOfBalance}% of your balance.\n` +
            (percentOfBalance > 50
              ? `\n⚠️ However, it takes over half your balance. Consider saving monthly instead of buying outright.`
              : `\n👍 This is reasonable for your balance. You can buy with confidence.`);
        }
      } else {
        const deficit = targetAmount - currentBalance;
        const monthsToSave = monthlyNet > 0 ? Math.ceil(deficit / monthlyNet) : -1;
        if (lang === 'ar') {
          let msg = `⚠️ ليس الآن. تحتاج ${deficit.toLocaleString()} ${cur} إضافية.\n\n`;
          msg += `💰 رصيدك الحالي: ${currentBalance.toLocaleString()} ${cur}\n`;
          msg += `🎯 المبلغ المطلوب: ${targetAmount.toLocaleString()} ${cur}\n`;
          if (monthsToSave > 0) {
            msg += `\n📅 بمعدل ادخارك الحالي (${monthlyNet.toLocaleString()} ${cur}/شهر)، ستحتاج حوالي **${monthsToSave} شهر** لتوفير المبلغ.`;
          } else {
            msg += `\n📉 مصاريفك حالياً تتجاوز دخلك. ننصحك بتقليل المصاريف أولاً قبل التفكير في هذا الشراء.`;
          }
          return msg;
        } else {
          let msg = `⚠️ Not right now. You need ${deficit.toLocaleString()} ${cur} more.\n\n`;
          msg += `💰 Current balance: ${currentBalance.toLocaleString()} ${cur}\n`;
          msg += `🎯 Target amount: ${targetAmount.toLocaleString()} ${cur}\n`;
          if (monthsToSave > 0) {
            msg += `\n📅 At your current saving rate (${monthlyNet.toLocaleString()} ${cur}/month), you'll need about **${monthsToSave} months**.`;
          } else {
            msg += `\n📉 Your expenses currently exceed your income. Focus on reducing expenses first.`;
          }
          return msg;
        }
      }
    }

    case 'comparison': {
      const trends = analyzeCategoryTrends(walletTxns, lang);
      const increasing = trends.filter(t => t.direction === 'up').slice(0, 3);
      const decreasing = trends.filter(t => t.direction === 'down').slice(0, 3);

      const thisMonthTotal = getCurrentMonthTxns(walletTxns).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const lastMonthTotal = getLastMonthTxns(walletTxns).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const overallChange = lastMonthTotal > 0 ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : 0;

      if (lang === 'ar') {
        let msg = `📊 مقارنة هذا الشهر بالشهر الماضي:\n\n`;
        msg += `💸 إجمالي المصاريف: ${thisMonthTotal.toLocaleString()} ${cur} `;
        msg += overallChange > 0 ? `(⬆️ +${overallChange}%)\n\n` : overallChange < 0 ? `(⬇️ ${overallChange}%)\n\n` : `(مستقر)\n\n`;

        if (increasing.length > 0) {
          msg += `📈 فئات ارتفعت:\n`;
          for (const t of increasing) {
            msg += `  • ${t.categoryName}: ${t.thisMonth.toLocaleString()} ← ${t.lastMonth.toLocaleString()} (+${t.changePercent}%)\n`;
          }
        }
        if (decreasing.length > 0) {
          msg += `\n📉 فئات انخفضت:\n`;
          for (const t of decreasing) {
            msg += `  • ${t.categoryName}: ${t.thisMonth.toLocaleString()} ← ${t.lastMonth.toLocaleString()} (-${t.changePercent}%)\n`;
          }
        }
        if (increasing.length === 0 && decreasing.length === 0) {
          msg += 'لا توجد تغييرات كبيرة بين الشهرين.';
        }
        return msg;
      } else {
        let msg = `📊 This month vs. last month:\n\n`;
        msg += `💸 Total expenses: ${thisMonthTotal.toLocaleString()} ${cur} `;
        msg += overallChange > 0 ? `(⬆️ +${overallChange}%)\n\n` : overallChange < 0 ? `(⬇️ ${overallChange}%)\n\n` : `(stable)\n\n`;

        if (increasing.length > 0) {
          msg += `📈 Increased categories:\n`;
          for (const t of increasing) {
            msg += `  • ${t.categoryName}: ${t.thisMonth.toLocaleString()} ← ${t.lastMonth.toLocaleString()} (+${t.changePercent}%)\n`;
          }
        }
        if (decreasing.length > 0) {
          msg += `\n📉 Decreased categories:\n`;
          for (const t of decreasing) {
            msg += `  • ${t.categoryName}: ${t.thisMonth.toLocaleString()} ← ${t.lastMonth.toLocaleString()} (-${t.changePercent}%)\n`;
          }
        }
        if (increasing.length === 0 && decreasing.length === 0) {
          msg += 'No significant changes between the two months.';
        }
        return msg;
      }
    }

    case 'prediction': {
      const pred3 = predictFutureSavings(walletTxns, 3);
      const pred6 = predictFutureSavings(walletTxns, 6);
      const pred12 = predictFutureSavings(walletTxns, 12);

      if (lang === 'ar') {
        let msg = `🔮 توقعات مدخراتك المستقبلية:\n\n`;
        msg += `📊 معدل الادخار الشهري الحالي: ${pred3.monthlyAvg.toLocaleString()} ${cur}\n\n`;
        if (pred3.monthlyAvg > 0) {
          msg += `في 3 شهور: ~${pred3.total.toLocaleString()} ${cur}\n`;
          msg += `في 6 شهور: ~${pred6.total.toLocaleString()} ${cur}\n`;
          msg += `في سنة: ~${pred12.total.toLocaleString()} ${cur}\n\n`;
          msg += `💡 نصيحة: لو زودت ادخارك بـ 10% فقط، هتوفر ${Math.round(pred12.total * 1.1).toLocaleString()} ${cur} في سنة بدلاً من ${pred12.total.toLocaleString()} ${cur}!`;
        } else {
          msg += `⚠️ حالياً مصاريفك تتجاوز دخلك بـ ${Math.abs(pred3.monthlyAvg).toLocaleString()} ${cur} شهرياً. ننصحك بتقليل المصاريف فوراً.`;
        }
        return msg;
      } else {
        let msg = `🔮 Future savings forecast:\n\n`;
        msg += `📊 Current monthly savings rate: ${pred3.monthlyAvg.toLocaleString()} ${cur}\n\n`;
        if (pred3.monthlyAvg > 0) {
          msg += `In 3 months: ~${pred3.total.toLocaleString()} ${cur}\n`;
          msg += `In 6 months: ~${pred6.total.toLocaleString()} ${cur}\n`;
          msg += `In 1 year: ~${pred12.total.toLocaleString()} ${cur}\n\n`;
          msg += `💡 Tip: Increasing savings by just 10% would yield ${Math.round(pred12.total * 1.1).toLocaleString()} ${cur} in a year instead of ${pred12.total.toLocaleString()} ${cur}!`;
        } else {
          msg += `⚠️ Your expenses exceed income by ${Math.abs(pred3.monthlyAvg).toLocaleString()} ${cur}/month. We recommend reducing expenses immediately.`;
        }
        return msg;
      }
    }

    case 'anomaly_check': {
      const anomalies = detectAnomalies(walletTxns, lang);
      if (anomalies.length === 0) {
        return lang === 'ar'
          ? '✅ لم أجد أي إنفاق غير طبيعي هذا الأسبوع. أنت ملتزم بمعدلاتك المعتادة — أحسنت! 👏'
          : '✅ No unusual spending detected this week. You\'re sticking to your usual patterns — great job! 👏';
      }

      if (lang === 'ar') {
        let msg = `🚨 اكتشفت ${anomalies.length} حالة إنفاق غير طبيعي هذا الأسبوع:\n\n`;
        for (const a of anomalies) {
          msg += `⚠️ **${a.categoryName}**: صرفت ${a.currentWeekSpend.toLocaleString()} ${cur} هذا الأسبوع، أعلى بـ ${a.percentAbove}% من متوسطك الأسبوعي (${a.weeklyAverage.toLocaleString()} ${cur}).\n\n`;
        }
        msg += `💡 راجع مصاريف هذه الفئات وحاول العودة لمعدلاتك الطبيعية.`;
        return msg;
      } else {
        let msg = `🚨 Found ${anomalies.length} unusual spending patterns this week:\n\n`;
        for (const a of anomalies) {
          msg += `⚠️ **${a.categoryName}**: Spent ${a.currentWeekSpend.toLocaleString()} ${cur} this week, ${a.percentAbove}% above your weekly avg (${a.weeklyAverage.toLocaleString()} ${cur}).\n\n`;
        }
        msg += `💡 Review these categories and try returning to your normal spending levels.`;
        return msg;
      }
    }

    case 'today_summary': {
      const today = getTodaySummary(walletTxns);
      if (today.count === 0) {
        return lang === 'ar'
          ? '📭 لم تسجل أي معاملات اليوم بعد. يوم مثالي لتوفير المال! 😊'
          : '📭 No transactions recorded today yet. A perfect day for saving money! 😊';
      }
      if (lang === 'ar') {
        return `📊 ملخص اليوم:\n\n` +
          `💸 صرفت: ${today.spent.toLocaleString()} ${cur}\n` +
          `💰 دخلك: ${today.earned.toLocaleString()} ${cur}\n` +
          `📝 عدد المعاملات: ${today.count}\n` +
          `${today.spent > today.earned ? '\n⚠️ المصاريف أعلى من الدخل اليوم. حاول تقليل الإنفاق بقية اليوم.' : '\n✅ يوم إيجابي — دخلك أعلى من مصاريفك!'}`;
      } else {
        return `📊 Today's summary:\n\n` +
          `💸 Spent: ${today.spent.toLocaleString()} ${cur}\n` +
          `💰 Earned: ${today.earned.toLocaleString()} ${cur}\n` +
          `📝 Transactions: ${today.count}\n` +
          `${today.spent > today.earned ? '\n⚠️ Spending exceeds income today. Try to reduce expenses for the rest of the day.' : '\n✅ Positive day — income exceeds expenses!'}`;
      }
    }

    case 'top_categories': {
      const top = getTopCategories(walletTxns, lang, 5);
      if (top.length === 0) {
        return lang === 'ar'
          ? 'لا توجد مصاريف مسجلة هذا الشهر لتحليلها.'
          : 'No expenses recorded this month to analyze.';
      }
      if (lang === 'ar') {
        let msg = `🏆 أعلى فئات الإنفاق هذا الشهر:\n\n`;
        top.forEach((c, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  •';
          msg += `${medal} ${c.name}: ${c.total.toLocaleString()} ${cur} (${c.percent}%)\n`;
        });
        msg += `\n💡 فئة "${top[0].name}" تستهلك ${top[0].percent}% من إجمالي إنفاقك. ركز عليها لتحقيق أكبر وفر.`;
        return msg;
      } else {
        let msg = `🏆 Top spending categories this month:\n\n`;
        top.forEach((c, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  •';
          msg += `${medal} ${c.name}: ${c.total.toLocaleString()} ${cur} (${c.percent}%)\n`;
        });
        msg += `\n💡 "${top[0].name}" consumes ${top[0].percent}% of your total spending. Focus here for maximum savings.`;
        return msg;
      }
    }

    case 'saving_tips': {
      const top = getTopCategories(walletTxns, lang, 3);
      const pattern = analyzeDayOfWeekPattern(walletTxns, lang);
      const savingsRate = ctx.totalIncome > 0 ? Math.round(((ctx.totalIncome - ctx.totalExpense) / ctx.totalIncome) * 100) : 0;

      if (lang === 'ar') {
        let msg = `💰 خطة ادخار مخصصة لك:\n\n`;
        msg += `📊 نسبة ادخارك الحالية: ${savingsRate}% ${savingsRate >= 20 ? '✅' : savingsRate >= 10 ? '⚠️' : '🔴'}\n\n`;

        if (top.length > 0) {
          msg += `🎯 نصائح مبنية على بياناتك:\n`;
          msg += `  1. قلل "${top[0].name}" بنسبة 15% = توفير ~${Math.round(top[0].total * 0.15).toLocaleString()} ${cur}/شهر\n`;
          if (top.length > 1) {
            msg += `  2. حدد سقف لـ "${top[1].name}" = ممكن توفر ~${Math.round(top[1].total * 0.1).toLocaleString()} ${cur}/شهر\n`;
          }
          if (pattern.highestDay.avgSpend > 0) {
            msg += `  3. قلل إنفاق يوم ${pattern.highestDay.day} = توفير ~${Math.round(pattern.highestDay.avgSpend * 0.2 * 4).toLocaleString()} ${cur}/شهر\n`;
          }
          const totalPotential = Math.round(top[0].total * 0.15) + (top.length > 1 ? Math.round(top[1].total * 0.1) : 0);
          msg += `\n🏆 إجمالي التوفير المحتمل: ~${totalPotential.toLocaleString()} ${cur}/شهر!`;
        } else {
          msg += 'سجّل بعض المعاملات أولاً لأقدر أحللك خطة ادخار مخصصة.';
        }
        return msg;
      } else {
        let msg = `💰 Your personalized savings plan:\n\n`;
        msg += `📊 Current savings rate: ${savingsRate}% ${savingsRate >= 20 ? '✅' : savingsRate >= 10 ? '⚠️' : '🔴'}\n\n`;

        if (top.length > 0) {
          msg += `🎯 Data-driven recommendations:\n`;
          msg += `  1. Reduce "${top[0].name}" by 15% = save ~${Math.round(top[0].total * 0.15).toLocaleString()} ${cur}/month\n`;
          if (top.length > 1) {
            msg += `  2. Cap "${top[1].name}" spending = save ~${Math.round(top[1].total * 0.1).toLocaleString()} ${cur}/month\n`;
          }
          if (pattern.highestDay.avgSpend > 0) {
            msg += `  3. Reduce ${pattern.highestDay.day} spending = save ~${Math.round(pattern.highestDay.avgSpend * 0.2 * 4).toLocaleString()} ${cur}/month\n`;
          }
          const totalPotential = Math.round(top[0].total * 0.15) + (top.length > 1 ? Math.round(top[1].total * 0.1) : 0);
          msg += `\n🏆 Total savings potential: ~${totalPotential.toLocaleString()} ${cur}/month!`;
        } else {
          msg += 'Log some transactions first so I can create a personalized savings plan for you.';
        }
        return msg;
      }
    }

    case 'budget_status': {
      const budgets = ctx.budgets;
      const catKeys = Object.keys(budgets);
      if (catKeys.length === 0) {
        return lang === 'ar'
          ? '📋 لم تحدد ميزانية لأي فئة بعد. اذهب لصفحة الإحصائيات وحدد ميزانية لفئاتك لأتابع لك تلقائياً!'
          : '📋 No category budgets set yet. Go to Stats and set budgets so I can track them for you!';
      }

      const monthlyExpenses = getCurrentMonthTxns(walletTxns).filter(t => t.type === 'expense');
      const catTotals: Record<string, number> = {};
      for (const tx of monthlyExpenses) {
        catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
      }

      const overBudget: string[] = [];
      const nearBudget: string[] = [];
      const safe: string[] = [];

      for (const catId of catKeys) {
        const limit = budgets[catId];
        const spent = catTotals[catId] || 0;
        const percent = Math.round((spent / limit) * 100);
        const name = getCategoryName(catId, lang);

        if (percent >= 100) {
          overBudget.push(`🔴 ${name}: ${spent.toLocaleString()}/${limit.toLocaleString()} ${cur} (${percent}%)`);
        } else if (percent >= 75) {
          nearBudget.push(`🟡 ${name}: ${spent.toLocaleString()}/${limit.toLocaleString()} ${cur} (${percent}%)`);
        } else {
          safe.push(`🟢 ${name}: ${spent.toLocaleString()}/${limit.toLocaleString()} ${cur} (${percent}%)`);
        }
      }

      if (lang === 'ar') {
        let msg = '📋 حالة الميزانيات هذا الشهر:\n\n';
        if (overBudget.length > 0) msg += 'تجاوزت الحد:\n' + overBudget.join('\n') + '\n\n';
        if (nearBudget.length > 0) msg += 'قاربت على الحد:\n' + nearBudget.join('\n') + '\n\n';
        if (safe.length > 0) msg += 'في الأمان:\n' + safe.join('\n');
        return msg;
      } else {
        let msg = '📋 Budget status this month:\n\n';
        if (overBudget.length > 0) msg += 'Over budget:\n' + overBudget.join('\n') + '\n\n';
        if (nearBudget.length > 0) msg += 'Near limit:\n' + nearBudget.join('\n') + '\n\n';
        if (safe.length > 0) msg += 'Safe:\n' + safe.join('\n');
        return msg;
      }
    }

    case 'debt_advice': {
      if (lang === 'ar') {
        return `💳 نصائح ذكية لسداد الديون:\n\n` +
          `1️⃣ **طريقة كرة الثلج**: رتب ديونك من الأصغر للأكبر. سدد الأصغر أولاً مع دفع الحد الأدنى للبقية. يعطيك دافع نفسي قوي.\n\n` +
          `2️⃣ **طريقة الانهيار الثلجي**: سدد الدين بأعلى فائدة أولاً. توفر أكثر على المدى الطويل.\n\n` +
          `3️⃣ **قاعدة 20%**: خصص 20% من دخلك لسداد الديون حتى لو كان المبلغ صغيراً.\n\n` +
          `💡 استخدم صفحة الديون في التطبيق لتتبع سداداتك وتفعيل التذكيرات!`;
      } else {
        return `💳 Smart debt payoff strategies:\n\n` +
          `1️⃣ **Snowball Method**: List debts smallest to largest. Pay off smallest first for quick psychological wins.\n\n` +
          `2️⃣ **Avalanche Method**: Pay off highest-interest debt first. Saves more in the long run.\n\n` +
          `3️⃣ **20% Rule**: Allocate 20% of income to debt repayment, even if it's a small amount.\n\n` +
          `💡 Use the Debts screen in the app to track payments and set reminders!`;
      }
    }

    case 'investment': {
      const savingsRate = ctx.totalIncome > 0 ? (ctx.totalIncome - ctx.totalExpense) / ctx.totalIncome : 0;
      if (lang === 'ar') {
        let msg = `📈 نصائح استثمارية مخصصة:\n\n`;
        if (savingsRate < 0.1) {
          msg += `⚠️ نسبة ادخارك ${Math.round(savingsRate * 100)}% — ننصحك بزيادة مدخراتك قبل الاستثمار. ابدأ بالوصول لـ 20% ادخار شهري.\n\n`;
        }
        msg += `🏆 خيارات استثمارية مناسبة:\n`;
        msg += `  🥇 الذهب: ملاذ آمن ضد التضخم. خصص 10-15% من فائضك.\n`;
        msg += `  🥈 شهادات الادخار البنكية: عائد ثابت ومضمون.\n`;
        msg += `  🥉 صناديق الاستثمار: تنويع بدون خبرة.\n\n`;
        msg += `💡 القاعدة الذهبية: لا تستثمر أموالاً تحتاجها في الـ 6 شهور القادمة.`;
        return msg;
      } else {
        let msg = `📈 Personalized investment advice:\n\n`;
        if (savingsRate < 0.1) {
          msg += `⚠️ Your savings rate is ${Math.round(savingsRate * 100)}% — build savings before investing. Aim for 20% monthly savings first.\n\n`;
        }
        msg += `🏆 Suitable investment options:\n`;
        msg += `  🥇 Gold: Safe haven against inflation. Allocate 10-15% of surplus.\n`;
        msg += `  🥈 Bank CDs/Savings Certificates: Fixed guaranteed returns.\n`;
        msg += `  🥉 Mutual Funds/ETFs: Diversification without expertise.\n\n`;
        msg += `💡 Golden Rule: Never invest money you'll need in the next 6 months.`;
        return msg;
      }
    }

    default: {
      // General: provide a quick overview based on real data
      const today = getTodaySummary(walletTxns);
      const top = getTopCategories(walletTxns, lang, 2);
      const anomalies = detectAnomalies(walletTxns, lang);

      if (lang === 'ar') {
        let msg = `مرحباً! إليك نظرة سريعة على وضعك المالي:\n\n`;
        msg += `💰 الرصيد: ${ctx.balance.toLocaleString()} ${cur}\n`;
        msg += `📊 هذا الشهر: دخل ${ctx.totalIncome.toLocaleString()} | مصاريف ${ctx.totalExpense.toLocaleString()} ${cur}\n`;
        if (today.count > 0) {
          msg += `📅 اليوم: صرفت ${today.spent.toLocaleString()} ${cur}\n`;
        }
        if (anomalies.length > 0) {
          msg += `\n🚨 تنبيه: إنفاق غير طبيعي في "${anomalies[0].categoryName}" هذا الأسبوع!\n`;
        }
        if (top.length > 0) {
          msg += `\n🎯 أعلى فئة إنفاق: ${top[0].name} (${top[0].percent}%)\n`;
        }
        msg += `\nاسألني عن أي شيء: توفير، استثمار، مقارنة شهرية، أو هل تقدر تشتري شيء معين!`;
        return msg;
      } else {
        let msg = `Hello! Here's a quick look at your finances:\n\n`;
        msg += `💰 Balance: ${ctx.balance.toLocaleString()} ${cur}\n`;
        msg += `📊 This month: Income ${ctx.totalIncome.toLocaleString()} | Expenses ${ctx.totalExpense.toLocaleString()} ${cur}\n`;
        if (today.count > 0) {
          msg += `📅 Today: Spent ${today.spent.toLocaleString()} ${cur}\n`;
        }
        if (anomalies.length > 0) {
          msg += `\n🚨 Alert: Unusual spending in "${anomalies[0].categoryName}" this week!\n`;
        }
        if (top.length > 0) {
          msg += `\n🎯 Top expense: ${top[0].name} (${top[0].percent}%)\n`;
        }
        msg += `\nAsk me about: saving tips, investments, monthly comparison, or if you can afford something!`;
        return msg;
      }
    }
  }
}

// ── Suggested Questions Generator ─────────────────────

export function generateSuggestedQuestions(ctx: FinancialContext): SuggestedQuestion[] {
  const suggestions: SuggestedQuestion[] = [];
  const walletTxns = getWalletTransactions(ctx);

  // Always include core questions
  suggestions.push(
    { textAr: '📊 إيه نمط إنفاقي الأسبوعي؟', textEn: '📊 What\'s my weekly spending pattern?' },
    { textAr: '💰 إزاي أوفر أكتر؟', textEn: '💰 How can I save more?' },
  );

  // Dynamic: anomaly check
  const anomalies = detectAnomalies(walletTxns, ctx.language);
  if (anomalies.length > 0) {
    suggestions.unshift({
      textAr: '🚨 فيه إنفاق غريب هذا الأسبوع؟',
      textEn: '🚨 Any unusual spending this week?',
    });
  }

  // Dynamic: comparison (if there's data from last month)
  const lastMonth = getLastMonthTxns(walletTxns);
  if (lastMonth.length > 0) {
    suggestions.push({
      textAr: '📈 قارن هذا الشهر بالشهر الماضي',
      textEn: '📈 Compare this month to last month',
    });
  }

  // Dynamic: prediction
  if (walletTxns.length > 10) {
    suggestions.push({
      textAr: '🔮 كم هوفر في 6 شهور؟',
      textEn: '🔮 How much will I save in 6 months?',
    });
  }

  // Dynamic: affordability
  suggestions.push({
    textAr: '🛒 هل أقدر أشتري آيفون؟',
    textEn: '🛒 Can I afford an iPhone?',
  });

  // Dynamic: budget status
  if (Object.keys(ctx.budgets).length > 0) {
    suggestions.push({
      textAr: '📋 إيه حالة ميزانياتي؟',
      textEn: '📋 What\'s my budget status?',
    });
  }

  // Dynamic: top categories
  suggestions.push({
    textAr: '🏆 بصرف على إيه أكتر؟',
    textEn: '🏆 What do I spend the most on?',
  });

  return suggestions.slice(0, 6); // Max 6 suggestions
}
