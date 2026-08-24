import { parseTransactionText, extractArabicAmount } from '../lib/nlpParser';
import { Wallet } from '../lib/storage';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test Failed: ${message}`);
  }
}

export function runNlpParserTests() {
  const mockWallets: Wallet[] = [
    { id: 'w1', name: 'كاش Cash', initialBalance: 1000, color: '#10B981', icon: 'payments', currency: 'KWD', createdAt: '' },
    { id: 'w2', name: 'بنك الكويت الوطني NBK', initialBalance: 5000, color: '#3B82F6', icon: 'account-balance', currency: 'KWD', createdAt: '' },
  ];

  // Test 1: User's exact prompt from image 3: "مصاريف مطعم شطه دينار و"
  const res1 = parseTransactionText('مصاريف مطعم شطه دينار و', mockWallets);
  assert(res1.amount === 1, `Amount for 'مصاريف مطعم شطه دينار و' should be 1, got ${res1.amount}`);
  assert(res1.category === 'food', `Category should be food, got ${res1.category}`);
  assert(res1.description === 'مطعم شطه', `Description should be 'مطعم شطه', got '${res1.description}'`);

  // Test 2: Spoken Kuwaiti Dinars with fractions: "دينار ونص"
  const res2 = parseTransactionText('غداء دينار ونص', mockWallets);
  assert(res2.amount === 1.5, `Amount for 'غداء دينار ونص' should be 1.5, got ${res2.amount}`);
  assert(res2.category === 'food', `Category should be food, got ${res2.category}`);

  // Test 3: Dual currency: "دينارين"
  const res3 = parseTransactionText('بنزين دينارين من الكاش', mockWallets);
  assert(res3.amount === 2, `Amount for 'بنزين دينارين' should be 2, got ${res3.amount}`);
  assert(res3.category === 'transport', `Category should be transport, got ${res3.category}`);
  assert(res3.walletId === 'w1', `Wallet should be Cash (w1), got ${res3.walletId}`);

  // Test 4: Fractions like "نص دينار"
  const res4 = parseTransactionText('شاي نص دينار', mockWallets);
  assert(res4.amount === 0.5, `Amount for 'شاي نص دينار' should be 0.5, got ${res4.amount}`);

  // Test 5: Fils subunit: "250 فلس"
  const res5 = parseTransactionText('قهوة 250 فلس', mockWallets);
  assert(res5.amount === 0.25, `Amount for 'قهوة 250 فلس' should be 0.25, got ${res5.amount}`);

  // Test 6: Compound words: "خمسة وعشرين دينار"
  const res6 = parseTransactionText('ملابس خمسة وعشرين دينار', mockWallets);
  assert(res6.amount === 25, `Amount for 'خمسة وعشرين دينار' should be 25, got ${res6.amount}`);
  assert(res6.category === 'clothes', `Category should be clothes, got ${res6.category}`);

  // Test 7: Transfer between wallets
  const res7 = parseTransactionText('تحويل 500 دينار من كاش إلى بنك الكويت الوطني', mockWallets);
  assert(res7.type === 'transfer', `Type should be transfer, got ${res7.type}`);
  assert(res7.amount === 500, `Amount should be 500, got ${res7.amount}`);
  assert(res7.walletId === 'w1', `Source wallet should be w1, got ${res7.walletId}`);
  assert(res7.toWalletId === 'w2', `Target wallet should be w2, got ${res7.toWalletId}`);

  // Test 8: Digits with decimals e.g. "1.750"
  const res8 = parseTransactionText('سوبرماركت كارفور 1.750', mockWallets);
  assert(res8.amount === 1.75, `Amount should be 1.75, got ${res8.amount}`);
  assert(res8.category === 'food', `Category should be food, got ${res8.category}`);

  console.log('✅ All Arabic Voice & Text NLP Unit Tests Passed!');
}
