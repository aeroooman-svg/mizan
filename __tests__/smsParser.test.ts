import { parseBankSMS } from '../lib/smsParser';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test Failed: ${message}`);
  }
}

export function runSmsParserTests() {
  // Test 1: Parse CIB Purchase SMS
  const cibSms = 'CIB Purchase: EGP 450.00 at Carrefour on Card ***1234';
  const result1 = parseBankSMS(cibSms);
  assert(result1 !== null && result1.amount === 450, `Amount should be 450, got ${result1?.amount}`);
  assert(result1 !== null && result1.type === 'expense', `Type should be expense, got ${result1?.type}`);
  assert(result1 !== null && result1.category === 'food', `Category should be food, got ${result1?.category}`);
  assert(result1 !== null && result1.cardNumber === '1234', `Card number should be 1234, got ${result1?.cardNumber}`);

  // Test 2: Parse Arabic NBE Deposit SMS
  const nbeSms = 'تم إيداع مبلغ 5000 ج.م في حسابك لدى البنك الأهلي المصري';
  const result2 = parseBankSMS(nbeSms);
  assert(result2 !== null && result2.amount === 5000, `Amount should be 5000, got ${result2?.amount}`);
  assert(result2 !== null && result2.type === 'income', `Type should be income, got ${result2?.type}`);
  assert(result2 !== null && result2.currency === 'EGP', `Currency should be EGP, got ${result2?.currency}`);

  // Test 3: Parse Al Rajhi Bank SMS in KWD
  const rajhiSms = 'Purchase KWD 15.500 at Starbucks';
  const result3 = parseBankSMS(rajhiSms);
  assert(result3 !== null && result3.amount === 15.5, `Amount should be 15.5, got ${result3?.amount}`);
  assert(result3 !== null && result3.currency === 'KWD', `Currency should be KWD, got ${result3?.currency}`);
  // Test 4: Parse InstaPay transfer
  const instapaySms = 'تم استلام تحويل بمبلغ 1500.00 ج.م عبر انستاباي InstaPay في حسابك';
  const result4 = parseBankSMS(instapaySms);
  assert(result4 !== null && result4.amount === 1500, `Amount should be 1500, got ${result4?.amount}`);
  assert(result4 !== null && result4.type === 'income', `Type should be income, got ${result4?.type}`);
  assert(result4 !== null && result4.bankName.includes('InstaPay'), `Bank should be InstaPay, got ${result4?.bankName}`);

  // Test 5: Parse NBK Kuwait POS purchase
  const nbkSms = 'NBK POS Purchase of KWD 25.500 at Carrefour with card 5678';
  const result5 = parseBankSMS(nbkSms);
  assert(result5 !== null && result5.amount === 25.5, `Amount should be 25.5, got ${result5?.amount}`);
  assert(result5 !== null && result5.currency === 'KWD', `Currency should be KWD, got ${result5?.currency}`);
  assert(result5 !== null && result5.category === 'food', `Category should be food, got ${result5?.category}`);

  console.log('✅ All SMS Parser Unit Tests Passed!');
}

