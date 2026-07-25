import { convertAmount, FALLBACK_RATES } from '../lib/currencyApi';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test Failed: ${message}`);
  }
}

export function runCurrencyApiTests() {
  // Test 1: Same currency conversion returns original amount
  const sameAmt = convertAmount(500, 'EGP', 'EGP', FALLBACK_RATES);
  assert(sameAmt === 500, 'Conversion between same currency should be identity');

  // Test 2: Convert USD to EGP
  const usdToEgp = convertAmount(100, 'USD', 'EGP', FALLBACK_RATES);
  assert(usdToEgp > 5000, '100 USD should be > 5000 EGP');

  // Test 3: Convert KWD to USD
  const kwdToUsd = convertAmount(10, 'KWD', 'USD', FALLBACK_RATES);
  assert(kwdToUsd > 30, '10 KWD should be > 30 USD');

  // Test 4: Convert EGP to USD
  const egpToUsd = convertAmount(513, 'EGP', 'USD', FALLBACK_RATES);
  assert(Math.round(egpToUsd) === 10, '513 EGP should be approximately 10 USD');

  console.log('✅ All Currency API Unit Tests Passed!');
}
