import { Remittance, calculateRemittanceStats } from '../lib/remittanceStorage';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test Failed: ${message}`);
  }
}

export function runRemittanceTests() {
  const dummyRemittance: Remittance = {
    id: 'rem_123',
    fromWalletId: 'w_kwd',
    toWalletId: 'w_egp',
    fromAmount: 300,
    fromCurrency: 'KWD',
    toAmount: 49500,
    toCurrency: 'EGP',
    exchangeRate: 165,
    note: 'July Allowance',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
  };

  const dummyTxns = [
    {
      id: 'tx_1',
      walletId: 'w_egp',
      type: 'expense',
      amount: 15000,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'tx_2',
      walletId: 'w_egp',
      type: 'expense',
      amount: 14500,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const stats = calculateRemittanceStats([dummyRemittance], 'w_egp', dummyTxns);

  // Test 1: Total received match
  assert(stats.totalReceived === 49500, `Total received should be 49500, got ${stats.totalReceived}`);

  // Test 2: Total spent match (15000 + 14500 = 29500)
  assert(
    stats.totalSpentSinceRemittance === 29500,
    `Total spent should be 29500, got ${stats.totalSpentSinceRemittance}`
  );

  // Test 3: Remaining balance match (49500 - 29500 = 20000)
  assert(stats.remainingBalance === 20000, `Remaining balance should be 20000, got ${stats.remainingBalance}`);

  // Test 4: Spent percentage match (29500 / 49500 ~ 60%)
  assert(stats.spentPercentage === 60, `Spent percentage should be 60%, got ${stats.spentPercentage}%`);

  console.log('✅ All Expat Remittance Unit Tests Passed!');
}
