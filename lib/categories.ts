export interface Category {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  iconFamily: 'Ionicons' | 'MaterialIcons' | 'MaterialCommunityIcons' | 'Feather' | 'FontAwesome';
  color: string;
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
  { id: 'other_expense', name: 'Other', nameAr: 'أخرى', icon: 'more-horiz', iconFamily: 'MaterialIcons', color: '#78909C' },
];

export const incomeCategories: Category[] = [
  { id: 'salary', name: 'Salary', nameAr: 'مرتب', icon: 'account-balance-wallet', iconFamily: 'MaterialIcons', color: '#0D7C66' },
  { id: 'freelance', name: 'Freelance', nameAr: 'عمل حر', icon: 'laptop-mac', iconFamily: 'MaterialIcons', color: '#2196F3' },
  { id: 'investment', name: 'Investment', nameAr: 'استثمار', icon: 'trending-up', iconFamily: 'MaterialIcons', color: '#4CAF50' },
  { id: 'gift', name: 'Gift', nameAr: 'هدية', icon: 'card-giftcard', iconFamily: 'MaterialIcons', color: '#E91E63' },
  { id: 'bonus', name: 'Bonus', nameAr: 'مكافأة', icon: 'stars', iconFamily: 'MaterialIcons', color: '#FF9800' },
  { id: 'other_income', name: 'Other', nameAr: 'أخرى', icon: 'more-horiz', iconFamily: 'MaterialIcons', color: '#78909C' },
];

export function getCategoryById(id: string): Category | undefined {
  return [...expenseCategories, ...incomeCategories].find(c => c.id === id);
}

export function formatCurrency(amount: number | null | undefined): string {
  try {
    const val = Number(amount);
    if (isNaN(val) || val === null || val === undefined) {
      return '٠٫٠٠';
    }
    return val.toLocaleString('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return '٠٫٠٠';
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
];

export const WALLET_COLORS = [
  '#0D7C66', '#2196F3', '#FF6B6B', '#FF9800', '#7C4DFF',
  '#E91E63', '#4ECDC4', '#8D6E63', '#4CAF50', '#45B7D1',
];
