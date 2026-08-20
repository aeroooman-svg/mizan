import { globalAppLanguage } from './LanguageContext';

export interface Category {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  iconFamily: 'Ionicons' | 'MaterialIcons' | 'MaterialCommunityIcons' | 'Feather' | 'FontAwesome';
  color: string;
  keywords?: string[];
}

export const expenseCategories: Category[] = [
  { id: 'food', name: 'Food', nameAr: 'طعام', icon: 'restaurant', iconFamily: 'MaterialIcons', color: '#FF6B6B' },
  { id: 'transport', name: 'Transport', nameAr: 'مواصلات', icon: 'directions-car', iconFamily: 'MaterialIcons', color: '#4ECDC4' },
  { id: 'bills', name: 'Bills', nameAr: 'فواتير', icon: 'receipt-long', iconFamily: 'MaterialIcons', color: '#45B7D1' },
  { id: 'shopping', name: 'Shopping', nameAr: 'تسوق', icon: 'shopping-bag', iconFamily: 'MaterialIcons', color: '#96CEB4' },
  { id: 'health', name: 'Health', nameAr: 'صحة', icon: 'medical-services', iconFamily: 'MaterialIcons', color: '#FF8A80' },
  { id: 'education', name: 'Education', nameAr: 'تعليم', icon: 'school', iconFamily: 'MaterialIcons', color: '#7C4DFF' },
  { id: 'entertainment', name: 'Entertainment', nameAr: 'ترفيه', icon: 'movie', iconFamily: 'MaterialIcons', color: '#FF9800' },
  { id: 'rent', name: 'Rent', nameAr: 'إيجار', icon: 'home', iconFamily: 'MaterialIcons', color: '#8D6E63' },
  { id: 'phone', name: 'Phone', nameAr: 'هاتف', icon: 'phone-android', iconFamily: 'MaterialIcons', color: '#26A69A' },
  { id: 'clothes', name: 'Clothes', nameAr: 'ملابس', icon: 'checkroom', iconFamily: 'MaterialIcons', color: '#EC407A' },
  { id: 'jameya_savings', name: 'Jameya Savings', nameAr: 'ادخار جمعية', icon: 'account-balance', iconFamily: 'MaterialIcons', color: '#0D7C66' },
  { id: 'debt_loan', name: 'Debts & Loans', nameAr: 'ديون وسلف', icon: 'swap-horizontal-circle', iconFamily: 'MaterialIcons', color: '#6366F1' },
  { id: 'other_expense', name: 'Other', nameAr: 'أخرى', icon: 'more-horiz', iconFamily: 'MaterialIcons', color: '#78909C' },
];

export const incomeCategories: Category[] = [
  { id: 'salary', name: 'Salary', nameAr: 'مرتب', icon: 'account-balance-wallet', iconFamily: 'MaterialIcons', color: '#0D7C66' },
  { id: 'freelance', name: 'Freelance', nameAr: 'عمل حر', icon: 'laptop-mac', iconFamily: 'MaterialIcons', color: '#2196F3' },
  { id: 'investment', name: 'Investment', nameAr: 'استثمار', icon: 'trending-up', iconFamily: 'MaterialIcons', color: '#4CAF50' },
  { id: 'gift', name: 'Gift', nameAr: 'هدية', icon: 'card-giftcard', iconFamily: 'MaterialIcons', color: '#E91E63' },
  { id: 'bonus', name: 'Bonus', nameAr: 'مكافأة', icon: 'stars', iconFamily: 'MaterialIcons', color: '#FF9800' },
  { id: 'debt_loan', name: 'Debts & Loans', nameAr: 'ديون وسلف', icon: 'swap-horizontal-circle', iconFamily: 'MaterialIcons', color: '#6366F1' },
  { id: 'other_income', name: 'Other', nameAr: 'أخرى', icon: 'more-horiz', iconFamily: 'MaterialIcons', color: '#78909C' },
];

let customCategoriesInMemory: Category[] = [];

export function setCustomCategoriesInMemory(categories: Category[]) {
  customCategoriesInMemory = categories;
}

export function getCategoryById(id: string): Category | undefined {
  return [...expenseCategories, ...incomeCategories, ...customCategoriesInMemory].find(c => c.id === id);
}

const THREE_DECIMAL_CURRENCIES = ['KWD', 'BHD', 'OMR', 'JOD', 'IQD', 'TND', 'LYD'];

export function getCurrencyDecimals(currencyCode?: string | null): number {
  if (!currencyCode) return 2;
  const upper = currencyCode.toUpperCase().trim();
  return THREE_DECIMAL_CURRENCIES.includes(upper) ? 3 : 2;
}

export function formatCurrency(
  amount: number | null | undefined,
  lang?: 'ar' | 'en',
  maxDecimalsOrCurrency?: number | string
): string {
  try {
    const val = Number(amount);
    const activeLang = lang || globalAppLanguage;
    const isEn = activeLang === 'en';
    if (isNaN(val) || val === null || val === undefined) {
      return isEn ? '0.00' : '٠٫٠٠';
    }

    let decimals = 2;
    if (typeof maxDecimalsOrCurrency === 'string') {
      decimals = getCurrencyDecimals(maxDecimalsOrCurrency);
    } else if (typeof maxDecimalsOrCurrency === 'number') {
      decimals = maxDecimalsOrCurrency;
    } else {
      // If amount naturally has a 3rd decimal digit, preserve 3 decimals
      const str = val.toString();
      if (str.includes('.')) {
        const decCount = str.split('.')[1].length;
        if (decCount >= 3) {
          decimals = 3;
        }
      }
    }

    decimals = Math.min(3, Math.max(2, decimals));
    const factor = Math.pow(10, decimals);
    const roundedVal = Math.round((val + Number.EPSILON) * factor) / factor;

    if (isEn) {
      const formatted = roundedVal.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return formatted.replace(/[\u0660-\u0669]/g, ch =>
        String.fromCharCode(ch.charCodeAt(0) - 0x0660 + 0x0030)
      );
    }
    return roundedVal.toLocaleString('ar-EG', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } catch {
    const activeLang = lang || globalAppLanguage;
    const isEn = activeLang === 'en';
    return isEn ? '0.00' : '٠٫٠٠';
  }
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export const WALLET_ICONS = [
  { icon: 'account-balance-wallet', label: 'محفظة' },
  { icon: 'account-balance', label: 'بنك' },
  { icon: 'savings', label: 'ادخار' },
  { icon: 'credit-card', label: 'بطاقة' },
  { icon: 'attach-money', label: 'نقد' },
  { icon: 'business-center', label: 'عمل' },
  { icon: 'favorite', label: 'شخصي' },
  { icon: 'card-giftcard', label: 'هدية' },
  { icon: 'shopping-bag', label: 'تسوق' },
  { icon: 'local-cafe', label: 'قهوة' },
  { icon: 'fitness-center', label: 'رياضة' },
  { icon: 'flight', label: 'سفر' },
];

export const WALLET_COLORS = [
  '#F472B6', // Light Pink / بينك فاتح
  '#EC4899', // Vivid Pink / بينك زاهي
  '#FB7185', // Soft Rose / روز هادئ
  '#FF80AB', // Pastel Pink / بينك باستيل
  '#E879F9', // Orchid Pink / أوركيد
  '#0D7C66', // Emerald / أخضر زمردي
  '#2196F3', // Sky Blue / أزرق
  '#7C4DFF', // Purple / بنفسجي
  '#C084FC', // Lavender / لافندر
  '#FF6B6B', // Coral / مرجاني
  '#FF9800', // Amber / برتقالي
  '#F59E0B', // Gold / ذهبي
  '#10B981', // Mint / نعناعي
  '#45B7D1', // Turquoise / تركواز
  '#8D6E63', // Cocoa / بني
  '#64748B', // Slate / رمادي
];

export const EXPANDED_ICON_LIBRARY = [
  'restaurant', 'fastfood', 'local-cafe', 'local-bar', 'cake', 'local-pizza',
  'directions-car', 'directions-bus', 'flight', 'local-taxi', 'commute', 'local-gas-station',
  'home', 'receipt-long', 'lightbulb', 'water-drop', 'wifi', 'phone-android', 'tv',
  'shopping-bag', 'shopping-cart', 'checkroom', 'card-giftcard', 'storefront', 'spa',
  'medical-services', 'fitness-center', 'local-pharmacy', 'child-care',
  'school', 'work', 'laptop-mac', 'menu-book', 'build',
  'movie', 'sports-esports', 'sports-soccer', 'music-note', 'headset',
  'account-balance', 'account-balance-wallet', 'savings', 'credit-card', 'attach-money', 'trending-up', 'stars',
  'pets', 'family-restroom', 'favorite'
];
