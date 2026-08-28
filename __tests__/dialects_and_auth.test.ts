import { parseTransactionText, extractArabicAmount } from '../lib/nlpParser';
import { normalizeArabicNumbers, normalizeAmountInput } from '../lib/arabicNumbers';
import { Wallet } from '../lib/storage';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Test Failed: ${message}`);
  }
}

export function runAllDialectsTests() {
  console.log('🚀 Running Universal Arabic Dialects & NLP Test Suite...');

  const mockWallets: Wallet[] = [
    { id: 'w1', name: 'كاش Cash', initialBalance: 1000, color: '#10B981', icon: 'payments', currency: 'EGP', createdAt: '' },
    { id: 'w2', name: 'بطاقة الراجحي Al Rajhi', initialBalance: 5000, color: '#3B82F6', icon: 'credit-card', currency: 'SAR', createdAt: '' },
    { id: 'w3', name: 'بنك الكويت الوطني NBK', initialBalance: 2000, color: '#F59E0B', icon: 'account-balance', currency: 'KWD', createdAt: '' },
  ];

  // 1. Egyptian Dialect
  console.log('Testing Egyptian Dialect...');
  const eg1 = parseTransactionText('صرفت 85 جنيه كشري وفول كاش', mockWallets);
  assert(eg1.amount === 85, `Amount should be 85, got ${eg1.amount}`);
  assert(eg1.category === 'food', `Category should be food, got ${eg1.category}`);
  assert(eg1.type === 'expense', `Type should be expense, got ${eg1.type}`);
  assert(eg1.walletId === 'w1', `Wallet should be Cash (w1), got ${eg1.walletId}`);

  const eg2 = parseTransactionText('قبضت الجمعية 5000 جنيه', mockWallets);
  assert(eg2.amount === 5000, `Amount should be 5000, got ${eg2.amount}`);
  assert(eg2.type === 'income', `Type should be income, got ${eg2.type}`);

  // 2. Saudi & Gulf Dialect
  console.log('Testing Saudi & Gulf Dialect...');
  const sa1 = parseTransactionText('عبيت بنزين ب 120 ريال من بطاقة الراجحي', mockWallets);
  assert(sa1.amount === 120, `Amount should be 120, got ${sa1.amount}`);
  assert(sa1.category === 'transport', `Category should be transport, got ${sa1.category}`);
  assert(sa1.walletId === 'w2', `Wallet should be Al Rajhi (w2), got ${sa1.walletId}`);

  const sa2 = parseTransactionText('تقضيت مقاضي البيت من بنده ب 450 ريال', mockWallets);
  assert(sa2.amount === 450, `Amount should be 450, got ${sa2.amount}`);
  assert(sa2.category === 'shopping' || sa2.category === 'food', `Category should be shopping or food, got ${sa2.category}`);

  const sa3 = parseTransactionText('نزل الراتب 8500 ريال', mockWallets);
  assert(sa3.amount === 8500, `Amount should be 8500, got ${sa3.amount}`);
  assert(sa3.type === 'income', `Type should be income, got ${sa3.type}`);

  // 3. Levantine Dialect (Jordan, Syria, Lebanon, Palestine)
  console.log('Testing Levantine Dialect...');
  const lev1 = parseTransactionText('اشتريت مناقيش وفطور ب 6 دنانير كاش', mockWallets);
  assert(lev1.amount === 6, `Amount should be 6, got ${lev1.amount}`);
  assert(lev1.category === 'food', `Category should be food, got ${lev1.category}`);

  const lev2 = parseTransactionText('دفعت اجرة الطريق 15 دينار', mockWallets);
  assert(lev2.amount === 15, `Amount should be 15, got ${lev2.amount}`);
  assert(lev2.category === 'transport', `Category should be transport, got ${lev2.category}`);

  // 4. Maghrebi Dialect (Morocco, Algeria, Tunisia)
  console.log('Testing Maghrebi Dialect...');
  const mag1 = parseTransactionText('شريت حوايج ب 350 درهم كاش', mockWallets);
  assert(mag1.amount === 350, `Amount should be 350, got ${mag1.amount}`);
  assert(mag1.category === 'clothes' || mag1.category === 'shopping', `Category should be clothes or shopping, got ${mag1.category}`);

  const mag2 = parseTransactionText('خلصت فاتورة الماء والكهرباء 220 درهم', mockWallets);
  assert(mag2.amount === 220, `Amount should be 220, got ${mag2.amount}`);
  assert(mag2.category === 'bills', `Category should be bills, got ${mag2.category}`);

  // 5. Franco-Arab / Arabizi
  console.log('Testing Franco-Arab & English...');
  const fr1 = parseTransactionText('sarft 60 egp cafe', mockWallets);
  assert(fr1.amount === 60, `Amount should be 60, got ${fr1.amount}`);
  assert(fr1.category === 'food', `Category should be food, got ${fr1.category}`);

  // 6. Spoken composite numbers
  console.log('Testing Spoken Composite Numbers...');
  const spk1 = extractArabicAmount('ألفين وخمسمية');
  assert(spk1.amount === 2500, `Amount for 'ألفين وخمسمية' should be 2500, got ${spk1.amount}`);

  const spk2 = extractArabicAmount('تلتمية وخمسين');
  assert(spk2.amount === 350, `Amount for 'تلتمية وخمسين' should be 350, got ${spk2.amount}`);

  // 7. Eastern Arabic Digits Normalization
  console.log('Testing Eastern Arabic Digits Normalization...');
  assert(normalizeArabicNumbers('١٢٥٠') === '1250', '١٢٥٠ should be normalized to 1250');
  assert(normalizeAmountInput('١٥،٥٠') === '15.50', '١٥،٥٠ should normalize to 15.50');

  console.log('🎉 ALL DIALECTS & NLP TESTS PASSED SUCCESSFULLY! 100% SUCCESS');
}

runAllDialectsTests();
