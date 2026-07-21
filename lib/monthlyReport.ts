/**
 * Monthly Digest & Report Generator (lib/monthlyReport.ts)
 * 
 * Computes Month-over-Month comparison, top spending category, total savings,
 * and automated financial advice summary.
 */

import { Transaction, Wallet } from './storage';
import { getCategoryName } from './i18n';

export interface MonthlyReportData {
  monthName: string;
  year: number;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRatePercent: number;
  topCategoryName: string;
  topCategoryAmount: number;
  momExpenseChangePercent: number; // vs previous month
  insightsAr: string[];
  insightsEn: string[];
}

export function generateMonthlyReport(
  transactions: Transaction[],
  wallet: Wallet | null,
  year: number,
  month: number, // 0-indexed (0=Jan)
  language: 'ar' | 'en'
): MonthlyReportData {
  const isAr = language === 'ar';
  const monthNamesAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const walletTx = wallet ? transactions.filter((t) => t.walletId === wallet.id) : transactions;

  // Current Month Transactions
  const currentMonthTx = walletTx.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Previous Month Transactions
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthTx = walletTx.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  });

  const totalIncome = currentMonthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = currentMonthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRatePercent = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  const prevExpense = prevMonthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const momExpenseChangePercent = prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : 0;

  // Top spending category
  const categorySums: Record<string, number> = {};
  currentMonthTx.filter((t) => t.type === 'expense').forEach((t) => {
    categorySums[t.category] = (categorySums[t.category] || 0) + t.amount;
  });

  let topCatId = '';
  let topCatAmount = 0;
  Object.keys(categorySums).forEach((catId) => {
    if (categorySums[catId] > topCatAmount) {
      topCatAmount = categorySums[catId];
      topCatId = catId;
    }
  });

  const topCategoryName = topCatId ? getCategoryName(topCatId, language) : (isAr ? 'لا يوجد' : 'None');

  const insightsAr: string[] = [];
  const insightsEn: string[] = [];

  if (momExpenseChangePercent > 0) {
    insightsAr.push(`ارتفعت مصاريفك بنسبة ${momExpenseChangePercent}% مقارنة بالشهر السابق.`);
    insightsEn.push(`Your expenses increased by ${momExpenseChangePercent}% compared to last month.`);
  } else if (momExpenseChangePercent < 0) {
    insightsAr.push(`نجحت في خفض مصاريفك بنسبة ${Math.abs(momExpenseChangePercent)}% مقارنة بالشهر السابق! 🎉`);
    insightsEn.push(`Great job! Reduced expenses by ${Math.abs(momExpenseChangePercent)}% compared to last month! 🎉`);
  }

  if (topCatAmount > 0) {
    insightsAr.push(`أعلى فئة صرف هذا الشهر كانت (${topCategoryName}) بمبلغ ${topCatAmount.toFixed(1)} ${wallet?.currency || ''}.`);
    insightsEn.push(`Top spending category was (${topCategoryName}) at ${topCatAmount.toFixed(1)} ${wallet?.currency || ''}.`);
  }

  if (savingsRatePercent >= 20) {
    insightsAr.push(`معدل ادخارك رائع للغاية (${savingsRatePercent}%)، وهو أعلى من نسبة الـ 20% الموصى بها.`);
    insightsEn.push(`Excellent savings rate (${savingsRatePercent}%), exceeding the 20% benchmark.`);
  }

  return {
    monthName: isAr ? monthNamesAr[month] : monthNamesEn[month],
    year,
    totalIncome,
    totalExpense,
    netSavings,
    savingsRatePercent,
    topCategoryName,
    topCategoryAmount: topCatAmount,
    momExpenseChangePercent,
    insightsAr,
    insightsEn,
  };
}
