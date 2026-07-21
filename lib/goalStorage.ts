import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string;
  walletId: string;
  createdAt: string;
}

export interface SavingsRule {
  id: string;
  type: 'round_up' | 'weekly_transfer' | 'penalty';
  amount?: number; // for weekly_transfer or penalty
  targetGoalId: string;
  walletId: string;
  isActive: boolean;
}

const GOALS_KEY = '@masarif_goals';
const RULES_KEY = '@masarif_savings_rules';

export async function getGoals(): Promise<SavingsGoal[]> {
  try {
    const data = await AsyncStorage.getItem(GOALS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Error loading goals:', e);
    return [];
  }
}

export async function saveGoal(goal: SavingsGoal): Promise<void> {
  try {
    const list = await getGoals();
    const existingIndex = list.findIndex(g => g.id === goal.id);
    if (existingIndex !== -1) {
      list[existingIndex] = goal;
    } else {
      list.unshift(goal);
    }
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving goal:', e);
  }
}

export async function deleteGoal(id: string): Promise<void> {
  try {
    const list = await getGoals();
    const filtered = list.filter(g => g.id !== id);
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(filtered));

    // Also delete associated rules
    const rules = await getRules();
    const filteredRules = rules.filter(r => r.targetGoalId !== id);
    await AsyncStorage.setItem(RULES_KEY, JSON.stringify(filteredRules));
  } catch (e) {
    console.error('Error deleting goal:', e);
  }
}

export async function addFundsToGoal(goalId: string, amount: number): Promise<SavingsGoal | null> {
  try {
    const list = await getGoals();
    const index = list.findIndex(g => g.id === goalId);
    if (index === -1) return null;

    const goal = list[index];
    goal.savedAmount += amount;
    if (goal.savedAmount < 0) goal.savedAmount = 0; // prevent negative balance

    list[index] = goal;
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(list));
    return goal;
  } catch (e) {
    console.error('Error adding funds to goal:', e);
    return null;
  }
}

export async function getRules(): Promise<SavingsRule[]> {
  try {
    const data = await AsyncStorage.getItem(RULES_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Error loading rules:', e);
    return [];
  }
}

export async function saveRule(rule: SavingsRule): Promise<void> {
  try {
    const list = await getRules();
    const existingIndex = list.findIndex(r => r.id === rule.id);
    if (existingIndex !== -1) {
      list[existingIndex] = rule;
    } else {
      list.push(rule);
    }
    await AsyncStorage.setItem(RULES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving rule:', e);
  }
}

export async function deleteRule(id: string): Promise<void> {
  try {
    const list = await getRules();
    const filtered = list.filter(r => r.id !== id);
    await AsyncStorage.setItem(RULES_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting rule:', e);
  }
}
