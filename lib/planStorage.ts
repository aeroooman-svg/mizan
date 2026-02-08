import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FinancialPlan {
  id: string;
  goalName: string;
  durationMonths: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySaving: number;
  savingsGoal: number;
  currency: string;
  currencySymbol: string;
  createdAt: string;
  walletId: string;
}

const PLAN_KEY = '@masarif_financial_plan';

export async function getFinancialPlan(): Promise<FinancialPlan | null> {
  const data = await AsyncStorage.getItem(PLAN_KEY);
  if (!data) return null;
  return JSON.parse(data);
}

export async function saveFinancialPlan(plan: FinancialPlan): Promise<void> {
  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

export async function deleteFinancialPlan(): Promise<void> {
  await AsyncStorage.removeItem(PLAN_KEY);
}
