import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AutoRule {
  id: string;
  name: string;
  isActive: boolean;
  keyword: string; // Comma-separated or single word to match in description
  type?: 'expense' | 'income' | 'all';
  minAmount?: number;
  maxAmount?: number;
  assignCategory?: string; // category ID
  assignTags?: string[]; // tag IDs
  appendNote?: string;
  createdAt: string;
  isSystem?: boolean;
}

export const PRESET_AUTO_RULES: AutoRule[] = [
  {
    id: 'rule_uber',
    name: 'أوبر ومواصلات',
    isActive: true,
    keyword: 'uber,careem,كريم,اوبر,تاكسي,taxi,بوليت,bolt',
    type: 'expense',
    assignCategory: 'transport',
    assignTags: ['car'],
    createdAt: new Date().toISOString(),
    isSystem: true,
  },
  {
    id: 'rule_coffee',
    name: 'كافيهات ومشروبات',
    isActive: true,
    keyword: 'starbucks,بارنز,كافيه,قهوة,coffee,dunkin,caribou,café',
    type: 'expense',
    assignCategory: 'cafe',
    assignTags: ['dining_out'],
    createdAt: new Date().toISOString(),
    isSystem: true,
  },
  {
    id: 'rule_groceries',
    name: 'سوبرماركت وتموين',
    isActive: true,
    keyword: 'بنده,كارفور,carrefour,لولو,lulu,تموينات,بقالة,عثيم,دانوب,المزرعة',
    type: 'expense',
    assignCategory: 'groceries',
    assignTags: ['groceries_market'],
    createdAt: new Date().toISOString(),
    isSystem: true,
  },
  {
    id: 'rule_fuel',
    name: 'بنزين ومحروقات',
    isActive: true,
    keyword: 'بنزين,وقود,petrol,gas,دريس,ساسكو,شل,أدنوك',
    type: 'expense',
    assignCategory: 'car',
    assignTags: ['car', 'maintenance'],
    createdAt: new Date().toISOString(),
    isSystem: true,
  },
  {
    id: 'rule_telecom',
    name: 'فواتير اتصالات وإنترنت',
    isActive: true,
    keyword: 'stc,موبايلي,mobily,زين,zain,we,vodafone,orange,فودافون,اورنج,اتصالات',
    type: 'expense',
    assignCategory: 'bills',
    assignTags: ['family'],
    createdAt: new Date().toISOString(),
    isSystem: true,
  },
  {
    id: 'rule_pharmacy',
    name: 'صيدلية وعلاج',
    isActive: true,
    keyword: 'صيدلية,نهدي,الدواء,pharmacy,علاج,مستشفى,دواء,عيادة,hospital',
    type: 'expense',
    assignCategory: 'health',
    assignTags: ['health'],
    createdAt: new Date().toISOString(),
    isSystem: true,
  },
  {
    id: 'rule_restaurants',
    name: 'مطاعم ووجبات',
    isActive: true,
    keyword: 'مطعم,ماك,mcdonalds,kfc,كنتاكي,shawarma,شاورما,برجر,burger,pizza,بيتزا,هنقرستيشن,jahez,جاهز',
    type: 'expense',
    assignCategory: 'restaurant',
    assignTags: ['dining_out'],
    createdAt: new Date().toISOString(),
    isSystem: true,
  }
];

const AUTO_RULES_STORAGE_KEY = '@mizan_auto_rules';

export async function getAutoRules(): Promise<AutoRule[]> {
  try {
    const raw = await AsyncStorage.getItem(AUTO_RULES_STORAGE_KEY);
    if (!raw) return PRESET_AUTO_RULES;
    const list: AutoRule[] = JSON.parse(raw);
    const userRuleIds = new Set(list.map(r => r.id));
    const mergedPresets = PRESET_AUTO_RULES.filter(p => !userRuleIds.has(p.id));
    return [...mergedPresets, ...list];
  } catch (e) {
    console.error('Error fetching auto rules:', e);
    return PRESET_AUTO_RULES;
  }
}

export async function saveAutoRule(rule: Omit<AutoRule, 'id' | 'createdAt'> & { id?: string }): Promise<AutoRule> {
  try {
    const rules = await getAutoRules();
    const newRule: AutoRule = {
      ...rule,
      id: rule.id || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };

    const existingIndex = rules.findIndex(r => r.id === newRule.id);
    if (existingIndex >= 0) {
      rules[existingIndex] = newRule;
    } else {
      rules.unshift(newRule);
    }

    await AsyncStorage.setItem(AUTO_RULES_STORAGE_KEY, JSON.stringify(rules));
    return newRule;
  } catch (e) {
    console.error('Error saving auto rule:', e);
    throw e;
  }
}

export async function deleteAutoRule(id: string): Promise<void> {
  try {
    const rules = await getAutoRules();
    const filtered = rules.filter(r => r.id !== id);
    await AsyncStorage.setItem(AUTO_RULES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting auto rule:', e);
  }
}

export async function toggleAutoRule(id: string, isActive: boolean): Promise<void> {
  try {
    const rules = await getAutoRules();
    const rule = rules.find(r => r.id === id);
    if (rule) {
      rule.isActive = isActive;
      await AsyncStorage.setItem(AUTO_RULES_STORAGE_KEY, JSON.stringify(rules));
    }
  } catch (e) {
    console.error('Error toggling auto rule:', e);
  }
}

export interface RuleMatchResult {
  matchedRule: AutoRule;
  category?: string;
  tags?: string[];
  note?: string;
}

export function matchTransactionAgainstRules(
  description: string,
  amount: number,
  type: 'expense' | 'income' | 'transfer',
  rules: AutoRule[]
): RuleMatchResult | null {
  if (!description || !description.trim()) return null;
  const descLower = description.trim().toLowerCase();

  for (const rule of rules) {
    if (!rule.isActive) continue;

    // Check type matching
    if (rule.type && rule.type !== 'all' && rule.type !== type) {
      continue;
    }

    // Check amount bounds
    if (rule.minAmount !== undefined && amount < rule.minAmount) {
      continue;
    }
    if (rule.maxAmount !== undefined && amount > rule.maxAmount) {
      continue;
    }

    // Check keyword matching (can be comma-separated)
    const keywords = rule.keyword.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const isMatched = keywords.some(k => descLower.includes(k));

    if (isMatched) {
      return {
        matchedRule: rule,
        category: rule.assignCategory,
        tags: rule.assignTags,
        note: rule.appendNote,
      };
    }
  }

  return null;
}
