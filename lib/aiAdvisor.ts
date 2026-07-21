import { Transaction, Wallet } from './storage';

export interface Recommendation {
  id: string;
  type: 'saving' | 'warning' | 'tip' | 'investment';
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  impactScore: number; // 1-10 scale
}

export function generateFinancialRecommendations(
  transactions: Transaction[],
  wallet: Wallet | null,
  healthScore: number
): Recommendation[] {
  if (!wallet) return [];

  const recommendations: Recommendation[] = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Filter current month transactions
  const monthlyTxns = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const income = monthlyTxns.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = monthlyTxns.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netSavings = income - expense;

  // 1. General Budget Health Tips
  if (healthScore > 80) {
    recommendations.push({
      id: 'hs_good',
      type: 'tip',
      titleAr: 'صحتك المالية ممتازة! 🌟',
      titleEn: 'Great Financial Health! 🌟',
      messageAr: 'درجة صحتك المالية ممتازة! هذا وقت رائع لبدء استثمار جزء من مدخراتك في الذهب أو الصناديق الاستثمارية لزيادة ثروتك.',
      messageEn: 'Your financial health score is excellent! This is a great time to start investing a portion of your savings in gold or mutual funds to build wealth.',
      impactScore: 8,
    });
  } else if (healthScore < 50) {
    recommendations.push({
      id: 'hs_bad',
      type: 'warning',
      titleAr: 'تنبيه: ميزانيتك بحاجة لإعادة ضبط ⚠️',
      titleEn: 'Warning: Budget Adjustment Needed ⚠️',
      messageAr: 'نلاحظ زيادة في المصاريف مقارنة بالدخل. ننصحك بتفعيل خيار الادخار التلقائي وتقليل النفقات غير الضرورية فوراً.',
      messageEn: 'We noticed expenses are exceeding your income. We recommend enabling auto-savings rules and trimming non-essential spending immediately.',
      impactScore: 10,
    });
  }

  // 2. Savings Ratio analysis
  if (income > 0) {
    const savingsRatio = netSavings / income;
    if (savingsRatio < 0.1) {
      recommendations.push({
        id: 'save_low',
        type: 'warning',
        titleAr: 'نسبة الادخار منخفضة جداً 📉',
        titleEn: 'Very Low Savings Rate 📉',
        messageAr: 'تدخر أقل من 10% من دخلك هذا الشهر. القاعدة الذهبية تنصح بادخار 20% على الأقل. جرب وضع حد ميزانية شهري أقصى.',
        messageEn: 'You are saving less than 10% of your income. The golden rule is to save at least 20%. Try setting a monthly expense budget limit.',
        impactScore: 9,
      });
    } else if (savingsRatio >= 0.2) {
      recommendations.push({
        id: 'save_high',
        type: 'saving',
        titleAr: 'بطل الادخار! 💰',
        titleEn: 'Savings Champion! 💰',
        messageAr: `رائع! لقد نجحت في ادخار ${(savingsRatio * 100).toFixed(0)}% من دخلك هذا الشهر. حافظ على هذا الأداء الممتاز لبناء صندوق طوارئ قوي.`,
        messageEn: `Splendid! You have saved ${(savingsRatio * 100).toFixed(0)}% of your income this month. Keep up this great performance to build a solid emergency fund.`,
        impactScore: 8,
      });
    }
  }

  // 3. Category analysis (Food/Restaurants vs Grocery)
  const foodExpense = monthlyTxns
    .filter(t => t.type === 'expense' && t.category === 'food')
    .reduce((sum, t) => sum + t.amount, 0);

  if (expense > 0 && foodExpense / expense > 0.35) {
    recommendations.push({
      id: 'food_heavy',
      type: 'warning',
      titleAr: 'مصاريف الطعام والمطاعم مرتفعة 🍔',
      titleEn: 'High Food & Dining Spending 🍔',
      messageAr: 'تشكل مصاريف الطعام والمطاعم أكثر من 35% من إجمالي إنفاقك. إعداد الطعام في المنزل قد يوفر لك مبلغاً كبيراً هذا الشهر.',
      messageEn: 'Dining out and food deliveries account for over 35% of your expenses. Preparing meals at home could save you a significant amount.',
      impactScore: 7,
    });
  }

  // 4. Islamic Finance Zakat indicator
  if (netSavings > 50000) {
    recommendations.push({
      id: 'zakat_tip',
      type: 'investment',
      titleAr: 'تذكير بزكاة المال 🕌',
      titleEn: 'Zakat Reminder 🕌',
      messageAr: 'مدخراتك وصلت للنصاب الشرعي للزكاة. ننصحك بزيارة حاسبة الزكاة لحساب القيمة المستحقة وتطهير مالك.',
      messageEn: 'Your accumulated savings have met the minimum Zakat threshold. We suggest using the Zakat Calculator to view your obligation.',
      impactScore: 9,
    });
  }

  // 5. Emergency Fund Advisor
  const emergencyThreshold = expense * 3;
  if (emergencyThreshold > 0 && netSavings < emergencyThreshold) {
    recommendations.push({
      id: 'emergency_fund',
      type: 'tip',
      titleAr: 'بناء صندوق الطوارئ 🛡️',
      titleEn: 'Build Emergency Fund 🛡️',
      messageAr: `صندوق الطوارئ المثالي يجب أن يغطي مصاريفك لـ 3 أشهر على الأقل (${emergencyThreshold.toFixed(0)} ${wallet.currency}). ننصحك بالبدء في اقتطاع جزء شهري مخصص للطوارئ.`,
      messageEn: `An ideal emergency fund should cover at least 3 months of expenses (${emergencyThreshold.toFixed(0)} ${wallet.currency}). We advise allocating a fixed sum monthly.`,
      impactScore: 8,
    });
  }

  return recommendations.sort((a, b) => b.impactScore - a.impactScore);
}

export const MOCK_AI_CHATS = [
  {
    role: 'assistant',
    messageAr: 'أهلاً بك! أنا مستشارك المالي الذكي. كيف يمكنني مساعدتك في تخطيط أمورك المالية اليوم؟',
    messageEn: 'Hello! I am your AI Financial Advisor. How can I assist you with your financial planning today?',
  }
];
