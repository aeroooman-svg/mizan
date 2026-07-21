/**
 * Financial Engine Automated Unit Tests (__tests__/financialEngine.test.ts)
 */

import { predictCashflow, calculateHealthScore } from '../lib/financialEngine';
import { Transaction } from '../lib/storage';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test Failed: ${message}`);
  }
}

export function runFinancialEngineTests() {
  const dummyTransactions: Transaction[] = [
    {
      id: 'tx_1',
      type: 'income',
      amount: 1000,
      category: 'salary',
      description: 'Monthly Salary',
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      walletId: 'w_1',
    },
    {
      id: 'tx_2',
      type: 'expense',
      amount: 200,
      category: 'food',
      description: 'Groceries',
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      walletId: 'w_1',
    },
  ];

  // Test 1: Predict Cashflow safe
  const forecastSafe = predictCashflow(dummyTransactions, 800, 'EGP');
  assert(forecastSafe.status === 'safe', 'forecast status should be safe');

  // Test 2: Predict Cashflow depleted
  const forecastDepleted = predictCashflow(dummyTransactions, 0, 'EGP');
  assert(forecastDepleted.status === 'depleted', 'forecast status should be depleted');
  assert(forecastDepleted.daysRemaining === 0, 'daysRemaining should be 0');

  // Test 3: Calculate Health Score high
  const scoreHigh = calculateHealthScore(dummyTransactions, {}, 1000, 200, 'safe', 1);
  assert(scoreHigh >= 80, 'health score should be >= 80');

  // Test 4: Calculate Health Score budget overruns
  const budgets = { food: 100 };
  const scoreOverrun = calculateHealthScore(dummyTransactions, budgets, 1000, 200, 'safe', 0);
  const scoreNormal = calculateHealthScore(dummyTransactions, {}, 1000, 200, 'safe', 0);
  assert(scoreOverrun < scoreNormal, 'overrun score should be lower than normal score');

  console.log('✅ All Financial Engine Unit Tests Passed Successfully!');
}
