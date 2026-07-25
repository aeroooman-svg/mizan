function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test Failed: ${message}`);
  }
}

export function calculateMoMChange(currentAmount: number, prevAmount: number): number {
  if (prevAmount <= 0) {
    return currentAmount > 0 ? 100 : 0;
  }
  return Math.round(((currentAmount - prevAmount) / prevAmount) * 100);
}

export function runAnalyticsTests() {
  // Test 1: Decrease in spending
  const decrease = calculateMoMChange(8000, 10000);
  assert(decrease === -20, `Should be -20%, got ${decrease}%`);

  // Test 2: Increase in spending
  const increase = calculateMoMChange(12000, 10000);
  assert(increase === 20, `Should be +20%, got ${increase}%`);

  // Test 3: No previous spending
  const newSpending = calculateMoMChange(5000, 0);
  assert(newSpending === 100, `Should be 100%, got ${newSpending}%`);

  // Test 4: Zero spending in both
  const zeroSpending = calculateMoMChange(0, 0);
  assert(zeroSpending === 0, `Should be 0%, got ${zeroSpending}%`);

  console.log('✅ All Analytics MoM Unit Tests Passed!');
}
