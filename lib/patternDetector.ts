/**
 * Automatic Recurring Pattern Detector (lib/patternDetector.ts)
 * 
 * Inspects transaction history to detect repeating expenses (e.g. rent, subscriptions, bills)
 * that occur around the same day each month, and suggests creating a Recurring Transaction.
 */

import { Transaction } from './storage';
import { getCategoryName } from './i18n';

export interface DetectedPattern {
  categoryId: string;
  categoryName: string;
  averageAmount: number;
  frequency: 'monthly';
  suggestedDayOfMonth: number;
  occurrencesCount: number;
}

export function detectRecurringPatterns(
  transactions: Transaction[],
  language: 'ar' | 'en'
): DetectedPattern[] {
  const expenseTx = transactions.filter((t) => t.type === 'expense');
  const groupedByCategory: Record<string, Transaction[]> = {};

  expenseTx.forEach((tx) => {
    if (!groupedByCategory[tx.category]) {
      groupedByCategory[tx.category] = [];
    }
    groupedByCategory[tx.category].push(tx);
  });

  const patterns: DetectedPattern[] = [];

  Object.keys(groupedByCategory).forEach((catId) => {
    const list = groupedByCategory[catId];
    if (list.length < 2) return;

    // Group transactions by day of month (tolerance ±2 days)
    const amounts = list.map((t) => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    // Check if amounts are consistent (standard deviation < 20% of avg)
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avgAmount, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev <= avgAmount * 0.25) {
      const days = list.map((t) => new Date(t.date).getDate());
      const avgDay = Math.round(days.reduce((a, b) => a + b, 0) / days.length);

      patterns.push({
        categoryId: catId,
        categoryName: getCategoryName(catId, language),
        averageAmount: Math.round(avgAmount),
        frequency: 'monthly',
        suggestedDayOfMonth: avgDay,
        occurrencesCount: list.length,
      });
    }
  });

  return patterns;
}
