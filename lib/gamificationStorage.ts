import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Wallet } from './storage';

export interface CustomChallenge {
  id: string;
  title: string;
  description: string;
  walletId: string; // 'all' or specific wallet id
  categoryId: string; // 'all' | 'non_essential' | specific category id
  type: 'limit_spend' | 'target_savings' | 'no_spend_days';
  targetAmount: number;
  targetDays: number;
  startDate: string;
  endDate: string;
  xpReward: number;
  createdAt: string;
}

const CUSTOM_CHALLENGES_KEY = '@mizan_custom_challenges_v1';
const CLAIMED_QUESTS_KEY = '@mizan_claimed_quests_v1';
const BONUS_XP_KEY = '@mizan_bonus_xp_v1';

export async function getCustomChallenges(): Promise<CustomChallenge[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_CHALLENGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveCustomChallenge(challenge: CustomChallenge): Promise<void> {
  const existing = await getCustomChallenges();
  const updated = [challenge, ...existing.filter(c => c.id !== challenge.id)];
  await AsyncStorage.setItem(CUSTOM_CHALLENGES_KEY, JSON.stringify(updated));
}

export async function deleteCustomChallenge(id: string): Promise<void> {
  const existing = await getCustomChallenges();
  const updated = existing.filter(c => c.id !== id);
  await AsyncStorage.setItem(CUSTOM_CHALLENGES_KEY, JSON.stringify(updated));
}

export async function getClaimedDailyQuests(dateKey: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(`${CLAIMED_QUESTS_KEY}_${dateKey}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function claimDailyQuest(questId: string, dateKey: string): Promise<void> {
  const existing = await getClaimedDailyQuests(dateKey);
  if (!existing.includes(questId)) {
    existing.push(questId);
    await AsyncStorage.setItem(`${CLAIMED_QUESTS_KEY}_${dateKey}`, JSON.stringify(existing));
  }
}

export async function getBonusXP(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BONUS_XP_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function addBonusXP(amount: number): Promise<number> {
  const current = await getBonusXP();
  const next = current + amount;
  await AsyncStorage.setItem(BONUS_XP_KEY, next.toString());
  return next;
}

// Level definition
export interface UserLevelInfo {
  level: number;
  titleAr: string;
  titleEn: string;
  icon: string;
  minXP: number;
  maxXP: number;
  color: string;
}

export const USER_LEVELS: UserLevelInfo[] = [
  { level: 1, titleAr: 'مبتدئ مالي 🌱', titleEn: 'Financial Novice 🌱', icon: 'leaf', minXP: 0, maxXP: 250, color: '#10B981' },
  { level: 2, titleAr: 'مقتصد واعد 🪙', titleEn: 'Promising Saver 🪙', icon: 'cash', minXP: 250, maxXP: 600, color: '#3B82F6' },
  { level: 3, titleAr: 'حارس الميزانية 🛡️', titleEn: 'Budget Guardian 🛡️', icon: 'shield-checkmark', minXP: 600, maxXP: 1200, color: '#6366F1' },
  { level: 4, titleAr: 'مخطط ذكي 📊', titleEn: 'Smart Planner 📊', icon: 'stats-chart', minXP: 1200, maxXP: 2200, color: '#8B5CF6' },
  { level: 5, titleAr: 'صائد التوفير 🎯', titleEn: 'Savings Hunter 🎯', icon: 'disc', minXP: 2200, maxXP: 3800, color: '#EC4899' },
  { level: 6, titleAr: 'خبير الإدارة 🧠', titleEn: 'Finance Master 🧠', icon: 'school', minXP: 3800, maxXP: 6000, color: '#F59E0B' },
  { level: 7, titleAr: 'مستثمر ناشئ 🚀', titleEn: 'Rising Investor 🚀', icon: 'rocket', minXP: 6000, maxXP: 9000, color: '#EF4444' },
  { level: 8, titleAr: 'فارس الأمان 🏰', titleEn: 'Wealth Knight 🏰', icon: 'star', minXP: 9000, maxXP: 13000, color: '#14B8A6' },
  { level: 9, titleAr: 'أستاذ الثروة 💎', titleEn: 'Wealth Master 💎', icon: 'diamond', minXP: 13000, maxXP: 18000, color: '#06B6D4' },
  { level: 10, titleAr: 'أسطورة الاستقلال 👑', titleEn: 'Financial Legend 👑', icon: 'trophy', minXP: 18000, maxXP: 999999, color: '#FBBF24' },
];

export function getUserLevel(totalXP: number): { current: UserLevelInfo; next: UserLevelInfo | null; progress: number } {
  let current = USER_LEVELS[0];
  for (let i = USER_LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= USER_LEVELS[i].minXP) {
      current = USER_LEVELS[i];
      break;
    }
  }

  const currentIndex = USER_LEVELS.findIndex(l => l.level === current.level);
  const next = currentIndex < USER_LEVELS.length - 1 ? USER_LEVELS[currentIndex + 1] : null;

  let progress = 100;
  if (next) {
    const range = next.minXP - current.minXP;
    const gained = totalXP - current.minXP;
    progress = Math.min(100, Math.max(0, Math.round((gained / range) * 100)));
  }

  return { current, next, progress };
}

// Calculate streak of consecutive active days
export function calculateStreak(transactions: Transaction[]): number {
  if (!transactions || transactions.length === 0) return 0;

  const dateSet = new Set<string>();
  transactions.forEach(t => {
    try {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dateSet.add(key);
      }
    } catch {}
  });

  const today = new Date();
  const format = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let streak = 0;
  let checkDate = new Date(today);

  // Check if today has a transaction; if not, check from yesterday to not break streak mid-day
  const todayKey = format(today);
  if (!dateSet.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = format(checkDate);
    if (dateSet.has(key)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Calculate Wallet Health Score (0-100)
export function calculateWalletHealth(
  transactions: Transaction[],
  income: number,
  expense: number
): { score: number; labelAr: string; labelEn: string; grade: 'A' | 'B' | 'C' | 'D'; color: string } {
  if (income <= 0 && expense <= 0) {
    return { score: 70, labelAr: 'مستقرة 🌱', labelEn: 'Stable 🌱', grade: 'B', color: '#3B82F6' };
  }

  let score = 50;

  // Savings ratio component (up to +35 pts)
  if (income > 0) {
    const savingsRatio = (income - expense) / income;
    if (savingsRatio >= 0.5) score += 35;
    else if (savingsRatio >= 0.3) score += 25;
    else if (savingsRatio >= 0.1) score += 15;
    else if (savingsRatio >= 0) score += 5;
    else score -= 20; // Deficit
  }

  // Consistency component (up to +15 pts)
  const txCount = transactions.length;
  if (txCount >= 20) score += 15;
  else if (txCount >= 10) score += 10;
  else if (txCount >= 5) score += 5;

  score = Math.max(10, Math.min(100, score));

  if (score >= 85) {
    return { score, labelAr: 'ممتازة وذكية 🌟', labelEn: 'Excellent 🌟', grade: 'A', color: '#10B981' };
  }
  if (score >= 70) {
    return { score, labelAr: 'صحية وجيدة 👍', labelEn: 'Healthy 👍', grade: 'B', color: '#3B82F6' };
  }
  if (score >= 50) {
    return { score, labelAr: 'معتدلة ⚠️', labelEn: 'Moderate ⚠️', grade: 'C', color: '#F59E0B' };
  }
  return { score, labelAr: 'تحتاج ترشيد 🚨', labelEn: 'Needs Care 🚨', grade: 'D', color: '#EF4444' };
}
