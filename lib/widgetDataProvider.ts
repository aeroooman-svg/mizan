/**
 * Widget Data Provider — مزود بيانات الويدجت الذكي
 * 
 * Aggregates financial data into a single object for the
 * Quick Glance Widget. Also prepares the infrastructure
 * for native Android/iOS widgets in the future.
 */

import { Transaction, Wallet } from './storage';
import { getCategoryName } from './i18n';
import { predictCashflow } from './financialEngine';

export interface WidgetData {
  balance: number;
  currencySymbol: string;
  walletName: string;
  walletColor: string;

  // Today
  todaySpent: number;
  todayEarned: number;
  todayCount: number;

  // Health
  healthStatus: 'excellent' | 'good' | 'warning' | 'danger';
  healthScore: number;
  healthColor: string;
  healthLabel: { ar: string; en: string };

  // Budget remaining
  dailyBudgetRemaining: number | null; // null if no budget set

  // Last transaction
  lastTransaction: {
    amount: number;
    category: string;
    categoryName: { ar: string; en: string };
    type: 'income' | 'expense' | 'transfer';
    timeAgo: { ar: string; en: string };
  } | null;

  // Quick stats
  monthlyIncome: number;
  monthlyExpense: number;
  savingsRate: number; // percentage
}

function getTimeAgo(dateStr: string): { ar: string; en: string } {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return { ar: 'الآن', en: 'Just now' };
  if (diffMin < 60) return { ar: `قبل ${diffMin} دقيقة`, en: `${diffMin}m ago` };
  if (diffHours < 24) return { ar: `قبل ${diffHours} ساعة`, en: `${diffHours}h ago` };
  if (diffDays < 7) return { ar: `قبل ${diffDays} يوم`, en: `${diffDays}d ago` };
  return { ar: `قبل ${Math.floor(diffDays / 7)} أسبوع`, en: `${Math.floor(diffDays / 7)}w ago` };
}

function getHealthFromScore(score: number): {
  status: WidgetData['healthStatus'];
  color: string;
  label: { ar: string; en: string };
} {
  if (score >= 80) return { status: 'excellent', color: '#10B981', label: { ar: 'ممتاز', en: 'Excellent' } };
  if (score >= 60) return { status: 'good', color: '#3B82F6', label: { ar: 'جيد', en: 'Good' } };
  if (score >= 40) return { status: 'warning', color: '#F59E0B', label: { ar: 'تنبيه', en: 'Warning' } };
  return { status: 'danger', color: '#EF4444', label: { ar: 'خطر', en: 'Danger' } };
}

export function getWidgetData(
  transactions: Transaction[],
  wallets: Wallet[],
  selectedWallet: Wallet | null,
  healthScore: number,
  budgets: Record<string, number>,
  currencySymbol: string,
): WidgetData {
  const wallet = selectedWallet || wallets[0] || null;
  const now = new Date();

  // Filter wallet transactions
  const walletTxns = wallet
    ? transactions.filter(t =>
        t.walletId === wallet.id ||
        (t.type === 'transfer' && t.toWalletId === wallet.id)
      )
    : transactions;

  // Current month transactions
  const monthlyTxns = walletTxns.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const monthlyIncome = monthlyTxns
    .filter(t => t.type === 'income' || (t.type === 'transfer' && wallet && t.toWalletId === wallet.id))
    .reduce((s, t) => s + t.amount, 0);
  const monthlyExpense = monthlyTxns
    .filter(t => t.type === 'expense' || (t.type === 'transfer' && wallet && t.walletId === wallet.id))
    .reduce((s, t) => s + t.amount, 0);
  const balance = monthlyIncome - monthlyExpense;

  // Today
  const todayTxns = walletTxns.filter(t => {
    const d = new Date(t.date);
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const todaySpent = todayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const todayEarned = todayTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  // Daily budget remaining
  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyBudget = totalBudget > 0 ? totalBudget / daysInMonth : null;
  const dailyBudgetRemaining = dailyBudget !== null ? Math.max(0, dailyBudget - todaySpent) : null;

  // Last transaction
  const sorted = [...walletTxns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const last = sorted[0] || null;
  const lastTransaction = last ? {
    amount: last.amount,
    category: last.category,
    categoryName: {
      ar: getCategoryName(last.category, 'ar'),
      en: getCategoryName(last.category, 'en'),
    },
    type: last.type,
    timeAgo: getTimeAgo(last.createdAt),
  } : null;

  // Health
  const health = getHealthFromScore(healthScore);

  // Savings rate
  const savingsRate = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0;

  return {
    balance,
    currencySymbol,
    walletName: wallet?.name || '',
    walletColor: wallet?.color || '#10B981',

    todaySpent,
    todayEarned,
    todayCount: todayTxns.length,

    healthStatus: health.status,
    healthScore,
    healthColor: health.color,
    healthLabel: health.label,

    dailyBudgetRemaining,

    lastTransaction,

    monthlyIncome,
    monthlyExpense,
    savingsRate,
  };
}

/**
 * Generates a compact JSON string suitable for iOS WidgetKit & Android AppWidget storage
 */
export function exportWidgetNativePayload(data: WidgetData): string {
  return JSON.stringify({
    version: '1.0',
    timestamp: new Date().toISOString(),
    walletName: data.walletName,
    balance: data.balance,
    currency: data.currencySymbol,
    todaySpent: data.todaySpent,
    healthScore: data.healthScore,
    lastTxn: data.lastTransaction
      ? `${data.lastTransaction.type === 'income' ? '+' : '-'}${data.lastTransaction.amount} (${data.lastTransaction.categoryName.ar})`
      : 'لا توجد معاملات مؤخراً',
  }, null, 2);
}
