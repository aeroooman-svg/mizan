import AsyncStorage from '@react-native-async-storage/async-storage';

const ENVELOPES_KEY = '@masarif_envelope_budgets';

export interface Envelope {
  id: string;
  walletId: string;
  title: string;
  allocatedAmount: number;
  spentAmount: number;
  icon: string;
  color: string;
  categoryId: string;
  createdAt: string;
}

export const DEFAULT_ENVELOPES: Omit<Envelope, 'id' | 'walletId' | 'spentAmount' | 'createdAt'>[] = [
  { title: 'ظرف الأكل والبقالة', allocatedAmount: 3000, icon: 'restaurant', color: '#FF6B6B', categoryId: 'food' },
  { title: 'ظرف المواصلات والبنزين', allocatedAmount: 1500, icon: 'directions-car', color: '#4ECDC4', categoryId: 'transport' },
  { title: 'ظرف الفواتير والخدمات', allocatedAmount: 2000, icon: 'receipt-long', color: '#45B7D1', categoryId: 'bills' },
  { title: 'ظرف الترفيه والخروج', allocatedAmount: 1000, icon: 'movie', color: '#FF9800', categoryId: 'entertainment' },
  { title: 'ظرف الادخار للطوارئ', allocatedAmount: 2500, icon: 'savings', color: '#10B981', categoryId: 'investment' },
];

export async function getEnvelopes(walletId: string): Promise<Envelope[]> {
  try {
    const json = await AsyncStorage.getItem(`${ENVELOPES_KEY}_${walletId}`);
    if (!json) {
      // Auto-initialize default envelopes
      const initial: Envelope[] = DEFAULT_ENVELOPES.map((def, idx) => ({
        ...def,
        id: `env_${walletId}_${idx}_${Date.now()}`,
        walletId,
        spentAmount: 0,
        createdAt: new Date().toISOString(),
      }));
      await AsyncStorage.setItem(`${ENVELOPES_KEY}_${walletId}`, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(json);
  } catch (e) {
    console.error('Error reading envelopes:', e);
    return [];
  }
}

export async function saveEnvelope(
  envelope: Omit<Envelope, 'id' | 'spentAmount' | 'createdAt'>
): Promise<Envelope> {
  const list = await getEnvelopes(envelope.walletId);
  const newEnv: Envelope = {
    ...envelope,
    id: `env_${envelope.walletId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    spentAmount: 0,
    createdAt: new Date().toISOString(),
  };

  const updated = [...list, newEnv];
  await AsyncStorage.setItem(`${ENVELOPES_KEY}_${envelope.walletId}`, JSON.stringify(updated));
  return newEnv;
}

export async function updateEnvelope(envelope: Envelope): Promise<void> {
  const list = await getEnvelopes(envelope.walletId);
  const updated = list.map(e => (e.id === envelope.id ? envelope : e));
  await AsyncStorage.setItem(`${ENVELOPES_KEY}_${envelope.walletId}`, JSON.stringify(updated));
}

export async function deleteEnvelope(walletId: string, id: string): Promise<void> {
  const list = await getEnvelopes(walletId);
  const filtered = list.filter(e => e.id !== id);
  await AsyncStorage.setItem(`${ENVELOPES_KEY}_${walletId}`, JSON.stringify(filtered));
}

export function calculateEnvelopeSpentFromTransactions(
  envelopes: Envelope[],
  transactions: { walletId: string; category: string; amount: number; type: string }[]
): Envelope[] {
  return envelopes.map(env => {
    const categorySpent = transactions
      .filter(t => t.type === 'expense' && (t.category === env.categoryId || t.category === env.title))
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      ...env,
      spentAmount: categorySpent,
    };
  });
}
