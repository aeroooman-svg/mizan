function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test Failed: ${message}`);
  }
}

// Zakat threshold constants (Nisab = 85 grams of 24k gold)
export function calculateZakat(cashAmount: number, goldGrams24k: number, goldGramPrice: number) {
  const goldValue = goldGrams24k * goldGramPrice;
  const totalWealth = cashAmount + goldValue;
  const nisabThreshold = 85 * goldGramPrice;

  const isEligible = totalWealth >= nisabThreshold;
  const zakatDue = isEligible ? totalWealth * 0.025 : 0;

  return {
    totalWealth,
    nisabThreshold,
    isEligible,
    zakatDue,
  };
}

export function runZakatTests() {
  const goldPrice = 4000; // EGP per gram 24k

  // Test 1: Below Nisab threshold
  const resultBelow = calculateZakat(10000, 0, goldPrice); // Nisab is 85 * 4000 = 340,000
  assert(!resultBelow.isEligible, 'Should not be eligible below Nisab');
  assert(resultBelow.zakatDue === 0, 'Zakat due should be 0 below Nisab');

  // Test 2: Above Nisab threshold
  const resultAbove = calculateZakat(400000, 10, goldPrice); // Total = 440,000
  assert(resultAbove.isEligible, 'Should be eligible above Nisab');
  assert(resultAbove.zakatDue === 11000, `Zakat should be 2.5% of 440,000 = 11,000, got ${resultAbove.zakatDue}`);

  console.log('✅ All Zakat Calculator Unit Tests Passed!');
}
