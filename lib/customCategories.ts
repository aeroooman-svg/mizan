import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category } from './categories';

export interface CustomCategory extends Category {
  isCustom: boolean;
  type: 'expense' | 'income';
}

const CUSTOM_CATEGORIES_KEY = '@masarif_custom_categories';

export async function getCustomCategories(): Promise<CustomCategory[]> {
  try {
    const data = await AsyncStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export async function saveCustomCategory(category: CustomCategory): Promise<void> {
  const existing = await getCustomCategories();
  existing.push(category);
  await AsyncStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(existing));
}

export async function deleteCustomCategory(id: string): Promise<void> {
  const existing = await getCustomCategories();
  const filtered = existing.filter(c => c.id !== id);
  await AsyncStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(filtered));
}
