import { Transaction } from './storage';

export interface CashflowForecast {
  status: 'safe' | 'risk' | 'depleted';
  daysRemaining: number;
  depletionDate: Date | null;
  messageAr: string;
  messageEn: string;
  recommendedDailyReduction: number;
}

export function predictCashflow(
  transactions: Transaction[],
  balance: number,
  currencySymbol: string
): CashflowForecast {
  const now = new Date();
  const currentDay = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemainingInMonth = lastDay - currentDay + 1;

  // Filter expenses in the current month
  const currentMonthExpenses = transactions.filter(t => {
    if (t.type !== 'expense') return false;
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalExpenseThisMonth = currentMonthExpenses.reduce((sum, t) => sum + t.amount, 0);
  const averageDailySpend = currentDay > 0 ? (totalExpenseThisMonth / currentDay) : 0;

  if (balance <= 0) {
    return {
      status: 'depleted',
      daysRemaining: 0,
      depletionDate: now,
      messageAr: 'لقد نفذت أموال المحفظة بالفعل! يرجى تجنب أي مصاريف إضافية.',
      messageEn: 'Wallet funds are already depleted! Please avoid any extra expenses.',
      recommendedDailyReduction: 0,
    };
  }

  if (averageDailySpend <= 0) {
    return {
      status: 'safe',
      daysRemaining: 999,
      depletionDate: null,
      messageAr: 'معدل الصرف اليومي آمن جداً. لم تسجل أي مصاريف كبيرة هذا الشهر حتى الآن.',
      messageEn: 'Your daily spending velocity is very safe. No major expenses logged this month yet.',
      recommendedDailyReduction: 0,
    };
  }

  const daysUntilDepletion = balance / averageDailySpend;

  if (daysUntilDepletion < daysRemainingInMonth) {
    const depletionDate = new Date(now.getTime() + daysUntilDepletion * 24 * 60 * 60 * 1000);
    const expectedSpendForRestOfMonth = averageDailySpend * daysRemainingInMonth;
    const overrun = expectedSpendForRestOfMonth - balance;
    const recommendedDailyReduction = overrun / daysRemainingInMonth;

    const formattedDate = depletionDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    const formattedDateEn = depletionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      status: 'risk',
      daysRemaining: Math.round(daysUntilDepletion),
      depletionDate,
      messageAr: `⚠️ تنبيه: بناءً على معدل صرفك اليومي (${averageDailySpend.toFixed(1)} ${currencySymbol})، ستنفد أموالك في تاريخ ${formattedDate}. ننصح بتقليل الإنفاق اليومي بمقدار ${recommendedDailyReduction.toFixed(1)} ${currencySymbol} لتفادي ذلك.`,
      messageEn: `⚠️ Warning: Based on your daily spend (${averageDailySpend.toFixed(1)} ${currencySymbol}), you will run out on ${formattedDateEn}. We recommend reducing daily spend by ${recommendedDailyReduction.toFixed(1)} ${currencySymbol} to stay safe.`,
      recommendedDailyReduction,
    };
  }

  return {
    status: 'safe',
    daysRemaining: Math.round(daysUntilDepletion),
    depletionDate: null,
    messageAr: 'أنت في أمان! معدل الصرف اليومي مناسب وميزانيتك الحالية تكفيك حتى نهاية الشهر.',
    messageEn: 'You are safe! Your daily spending is appropriate and your current balance will last until the end of the month.',
    recommendedDailyReduction: 0,
  };
}

export function calculateHealthScore(
  transactions: Transaction[],
  budgets: Record<string, number>,
  totalIncome: number,
  totalExpense: number,
  forecastStatus: 'safe' | 'risk' | 'depleted',
  challengesCompletedCount: number
): number {
  let score = 100;

  // 1. Budget overruns penalty
  const categoryTotals: Record<string, number> = {};
  const now = new Date();
  const currentMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  currentMonthTx.forEach(t => {
    if (t.type === 'expense') {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    }
  });

  let overruns = 0;
  Object.keys(budgets).forEach(catId => {
    const limit = budgets[catId];
    const total = categoryTotals[catId] || 0;
    if (total > limit) {
      overruns++;
    }
  });

  score -= overruns * 15;

  // 2. Savings rate factor
  if (totalIncome > 0) {
    const savings = totalIncome - totalExpense;
    const savingsRate = savings / totalIncome;
    if (savingsRate < 0) {
      score -= 15; // Penalty for negative savings
    } else {
      score += Math.round(savingsRate * 20); // Up to +20 points bonus
    }
  } else if (totalExpense > 0) {
    score -= 15; // Expense without income penalty
  }

  // 3. Challenges bonus
  score += challengesCompletedCount * 5; // +5 points per completed challenge

  // 4. Cashflow forecasting penalty
  if (forecastStatus === 'risk') {
    score -= 10;
  } else if (forecastStatus === 'depleted') {
    score -= 20;
  }

  // Cap between 10 and 100
  return Math.min(100, Math.max(10, score));
}
