import { Transaction } from './storage';
import { formatCurrency } from './categories';

export interface CashflowForecast {
  status: 'safe' | 'risk' | 'depleted';
  daysRemaining: number;
  depletionDate: Date | null;
  messageAr: string;
  messageEn: string;
  messageHi: string;
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
      messageHi: 'वॉलेट की धनराशि पहले ही समाप्त हो चुकी है! कृपया किसी भी अतिरिक्त खर्च से बचें।',
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
      messageHi: 'आपकी दैनिक खर्च दर बहुत सुरक्षित है। इस महीने अभी तक कोई बड़ा खर्च दर्ज नहीं हुआ है।',
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
    const formattedDateHi = depletionDate.toLocaleDateString('hi-IN', { month: 'short', day: 'numeric' });

    return {
      status: 'risk',
      daysRemaining: Math.round(daysUntilDepletion),
      depletionDate,
      messageAr: `⚠️ تنبيه: بناءً على معدل صرفك اليومي (${formatCurrency(averageDailySpend, 'ar')} ${currencySymbol})، ستنفد أموالك في تاريخ ${formattedDate}. ننصح بتقليل الإنفاق اليومي بمقدار ${formatCurrency(recommendedDailyReduction, 'ar')} ${currencySymbol} لتفادي ذلك.`,
      messageEn: `⚠️ Warning: Based on your daily spend (${formatCurrency(averageDailySpend, 'en')} ${currencySymbol}), you will run out on ${formattedDateEn}. We recommend reducing daily spend by ${formatCurrency(recommendedDailyReduction, 'en')} ${currencySymbol} to stay safe.`,
      messageHi: `⚠️ चेतावनी: आपके दैनिक खर्च (${formatCurrency(averageDailySpend, 'hi')} ${currencySymbol}) के आधार पर, आपका फंड ${formattedDateHi} को समाप्त हो जाएगा। सुरक्षित रहने के लिए दैनिक खर्च को ${formatCurrency(recommendedDailyReduction, 'hi')} ${currencySymbol} कम करने की सलाह दी जाती है।`,
      recommendedDailyReduction,
    };
  }

  return {
    status: 'safe',
    daysRemaining: Math.round(daysUntilDepletion),
    depletionDate: null,
    messageAr: 'أنت في أمان! معدل الصرف اليومي مناسب وميزانيتك الحالية تكفيك حتى نهاية الشهر.',
    messageEn: 'You are safe! Your daily spending is appropriate and your current balance will last until the end of the month.',
    messageHi: 'आप सुरक्षित स्थिति में हैं! आपका दैनिक खर्च संतुलित है और वर्तमान शेष महीने के अंत तक पर्याप्त रहेगा।',
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
  // 0. Empty / brand new wallet protection: 100% balanced
  if (transactions.length === 0 && totalIncome === 0 && totalExpense === 0) {
    return 100;
  }

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

  score -= overruns * 18;

  // 2. Savings rate & deficit factor
  if (totalIncome > 0) {
    const savings = totalIncome - totalExpense;
    const savingsRate = savings / totalIncome;
    if (savingsRate < 0) {
      score -= 35; // Severe penalty for spending more than income
    } else {
      score += Math.round(savingsRate * 15); // Up to +15 bonus
    }
  } else if (totalExpense > 0) {
    score -= 30; // Expense without income penalty
  }

  // 3. Challenges bonus
  score += challengesCompletedCount * 4;

  // 4. Cashflow forecasting penalty
  if (forecastStatus === 'risk') {
    score -= 15;
  } else if (forecastStatus === 'depleted') {
    score -= 35;
  }

  return Math.min(100, Math.max(10, score));
}
