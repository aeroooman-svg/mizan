import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Tag {
  id: string;
  nameAr: string;
  nameEn: string;
  color: string;
  icon: string;
  isSystem?: boolean;
}

export const PRESET_TAGS: Tag[] = [
  { id: 'travel', nameAr: 'سفر ✈️', nameEn: 'Travel', color: '#00E5FF', icon: 'flight', isSystem: true },
  { id: 'ramadan', nameAr: 'رمضان 🌙', nameEn: 'Ramadan', color: '#F59E0B', icon: 'nights-stay', isSystem: true },
  { id: 'groceries_market', nameAr: 'تسوق وتموين 🛍️', nameEn: 'Shopping', color: '#10B981', icon: 'shopping-bag', isSystem: true },
  { id: 'maintenance', nameAr: 'صيانة وتصليح 🔧', nameEn: 'Maintenance', color: '#EF4444', icon: 'build', isSystem: true },
  { id: 'car', nameAr: 'سيارة وبنزين 🚗', nameEn: 'Car', color: '#8B5CF6', icon: 'directions-car', isSystem: true },
  { id: 'family', nameAr: 'عائلي 👨‍👩‍👧', nameEn: 'Family', color: '#EC4899', icon: 'family-restroom', isSystem: true },
  { id: 'dining_out', nameAr: 'مطاعم وكافيهات ☕', nameEn: 'Dining Out', color: '#F97316', icon: 'restaurant', isSystem: true },
  { id: 'projects', nameAr: 'مشاريع وعمل 💼', nameEn: 'Projects', color: '#3B82F6', icon: 'work', isSystem: true },
  { id: 'wedding', nameAr: 'مناسبات وزواج 💍', nameEn: 'Occasions', color: '#E11D48', icon: 'favorite', isSystem: true },
  { id: 'gifts', nameAr: 'هدايا وتبرعات 🎁', nameEn: 'Gifts', color: '#06B6D4', icon: 'card-giftcard', isSystem: true },
  { id: 'health', nameAr: 'علاج وصيدلية 💊', nameEn: 'Health', color: '#14B8A6', icon: 'medical-services', isSystem: true },
  { id: 'education', nameAr: 'دراسة ودورات 📚', nameEn: 'Education', color: '#6366F1', icon: 'school', isSystem: true },
];

const TAGS_STORAGE_KEY = '@mizan_custom_tags';

export async function getAllTags(): Promise<Tag[]> {
  try {
    const raw = await AsyncStorage.getItem(TAGS_STORAGE_KEY);
    if (!raw) return PRESET_TAGS;
    const customList: Tag[] = JSON.parse(raw);
    
    // Combine presets with user-defined tags
    const customIds = new Set(customList.map(t => t.id));
    const mergedPresets = PRESET_TAGS.filter(p => !customIds.has(p.id));
    return [...mergedPresets, ...customList];
  } catch (error) {
    console.error('Error reading tags:', error);
    return PRESET_TAGS;
  }
}

export async function saveCustomTag(tag: Omit<Tag, 'id'> & { id?: string }): Promise<Tag> {
  try {
    const raw = await AsyncStorage.getItem(TAGS_STORAGE_KEY);
    const customList: Tag[] = raw ? JSON.parse(raw) : [];
    
    const newTag: Tag = {
      ...tag,
      id: tag.id || `tag_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      isSystem: false,
    };

    const existingIndex = customList.findIndex(t => t.id === newTag.id);
    if (existingIndex >= 0) {
      customList[existingIndex] = newTag;
    } else {
      customList.push(newTag);
    }

    await AsyncStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(customList));
    return newTag;
  } catch (error) {
    console.error('Error saving tag:', error);
    throw error;
  }
}

export async function deleteCustomTag(tagId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TAGS_STORAGE_KEY);
    if (!raw) return;
    const customList: Tag[] = JSON.parse(raw);
    const updated = customList.filter(t => t.id !== tagId);
    await AsyncStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error deleting tag:', error);
  }
}

export function parseTransactionTags(tagsString?: string): string[] {
  if (!tagsString) return [];
  return tagsString
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}

export function formatTagsToString(tagsArray: string[]): string {
  return tagsArray.map(t => t.trim()).filter(Boolean).join(',');
}
