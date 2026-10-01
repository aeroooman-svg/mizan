import { Transaction, Wallet } from './storage';
import { Language, getCategoryName, getCurrencyName } from './i18n';
import { getCategoryById, formatCurrency } from './categories';

export interface MonthAnalytics {
  yearMonth: string; // e.g. "2026-03"
  year: number;
  month: number; // 0-11
  monthName: string; // e.g. "مارس 2026"
  income: number;
  expense: number;
  net: number;
  savingsRate: number; // percentage
  txCount: number;
  topCategory: {
    id: string;
    name: string;
    amount: number;
  } | null;
  momExpenseChange: number | null; // % change vs previous chronological month
}

export interface CategoryExpenseAnalytics {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  count: number;
  color: string;
}

export interface SmartInsightItem {
  icon: string;
  title: string;
  text: string;
  type: 'positive' | 'warning' | 'info' | 'tip';
}

export interface SmartFinancialDiagnosis {
  healthScore: number; // 0 - 100
  healthStatusText: string;
  healthColor: string;
  insights: SmartInsightItem[];
}

export interface FinancialReportData {
  walletName: string;
  currency: string;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number;
  totalTransactionsCount: number;
  incomeCount: number;
  expenseCount: number;
  avgMonthlyExpense: number;
  avgMonthlyIncome: number;
  highestSingleExpense: {
    amount: number;
    description: string;
    date: string;
    categoryName: string;
  } | null;
  months: MonthAnalytics[];
  categories: CategoryExpenseAnalytics[];
  diagnosis: SmartFinancialDiagnosis;
  sortedTransactions: Transaction[];
  startDateStr: string;
  endDateStr: string;
  walletsSummary?: {
    name: string;
    currency: string;
    color: string;
    count: number;
  }[];
}

export function getLocalizedMonthName(monthIndex: number, year: number, lang: Language): string {
  const arMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const enMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mlMonths = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മെയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
  const hiMonths = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];

  let mName = enMonths[monthIndex] || '';
  if (lang === 'ar') mName = arMonths[monthIndex];
  else if (lang === 'ml') mName = mlMonths[monthIndex] || enMonths[monthIndex];
  else if (lang === 'hi') mName = hiMonths[monthIndex] || enMonths[monthIndex];

  return `${mName} ${year}`;
}

export function computeFinancialReportData(
  allTransactions: Transaction[],
  targetWallet: Wallet,
  language: Language,
  wallets: Wallet[] = []
): FinancialReportData {
  const isAr = language === 'ar';
  const isMl = language === 'ml' || language === 'hi';

  // Filter transactions for target wallet if specific, else use all
  let filtered = allTransactions.filter(t => 
    !targetWallet.id || targetWallet.id === 'default' || 
    t.walletId === targetWallet.id || 
    (t.type === 'transfer' && t.toWalletId === targetWallet.id)
  );

  // Fallback to all transactions if none matched targetWallet specifically
  if (filtered.length === 0 && allTransactions.length > 0) {
    filtered = [...allTransactions];
  }

  // Sort descending by date
  const sortedTransactions = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculations for overall
  let totalIncome = 0;
  let totalExpense = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let highestSingleExpense: FinancialReportData['highestSingleExpense'] = null;

  const categoryExpenseTotals = new Map<string, { amount: number; count: number }>();

  // Monthly grouping
  const monthMap = new Map<string, {
    year: number;
    month: number;
    income: number;
    expense: number;
    txCount: number;
    categoryMap: Map<string, number>;
  }>();

  for (const t of sortedTransactions) {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;

    const y = d.getFullYear();
    const m = d.getMonth();
    const ymKey = `${y}-${String(m + 1).padStart(2, '0')}`;

    if (!monthMap.has(ymKey)) {
      monthMap.set(ymKey, {
        year: y,
        month: m,
        income: 0,
        expense: 0,
        txCount: 0,
        categoryMap: new Map(),
      });
    }

    const mData = monthMap.get(ymKey)!;
    mData.txCount++;

    if (t.type === 'income') {
      totalIncome += t.amount;
      incomeCount++;
      mData.income += t.amount;
    } else if (t.type === 'expense') {
      totalExpense += t.amount;
      expenseCount++;
      mData.expense += t.amount;

      // Category breakdown
      const curCat = categoryExpenseTotals.get(t.category) || { amount: 0, count: 0 };
      curCat.amount += t.amount;
      curCat.count += 1;
      categoryExpenseTotals.set(t.category, curCat);

      // Month category map
      const curMonthCatAmt = mData.categoryMap.get(t.category) || 0;
      mData.categoryMap.set(t.category, curMonthCatAmt + t.amount);

      // Check highest expense
      if (!highestSingleExpense || t.amount > highestSingleExpense.amount) {
        highestSingleExpense = {
          amount: t.amount,
          description: t.description || getCategoryName(t.category, language),
          date: t.date,
          categoryName: getCategoryName(t.category, language),
        };
      }
    } else if (t.type === 'transfer') {
      // Internal transfer handling
      if (t.toWalletId === targetWallet.id) {
        totalIncome += t.amount;
        incomeCount++;
        mData.income += t.amount;
      } else if (t.walletId === targetWallet.id) {
        totalExpense += t.amount;
        expenseCount++;
        mData.expense += t.amount;
      }
    }
  }

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : (totalExpense > 0 ? -100 : 0);

  // Process chronological months to calculate MoM expense changes
  const chronologicalKeys = Array.from(monthMap.keys()).sort();
  const monthsChronological: MonthAnalytics[] = [];

  for (let i = 0; i < chronologicalKeys.length; i++) {
    const key = chronologicalKeys[i];
    const data = monthMap.get(key)!;
    const net = data.income - data.expense;
    const sRate = data.income > 0 ? Math.round((net / data.income) * 100) : (data.expense > 0 ? -100 : 0);

    // Top category for this month
    let topCat: MonthAnalytics['topCategory'] = null;
    let maxCatAmt = 0;
    for (const [catId, amt] of data.categoryMap.entries()) {
      if (amt > maxCatAmt) {
        maxCatAmt = amt;
        topCat = {
          id: catId,
          name: getCategoryName(catId, language),
          amount: amt,
        };
      }
    }

    // MoM change vs previous month
    let momChange: number | null = null;
    if (i > 0) {
      const prevData = monthMap.get(chronologicalKeys[i - 1])!;
      if (prevData.expense > 0) {
        momChange = Math.round(((data.expense - prevData.expense) / prevData.expense) * 100);
      }
    }

    monthsChronological.push({
      yearMonth: key,
      year: data.year,
      month: data.month,
      monthName: getLocalizedMonthName(data.month, data.year, language),
      income: data.income,
      expense: data.expense,
      net,
      savingsRate: sRate,
      txCount: data.txCount,
      topCategory: topCat,
      momExpenseChange: momChange,
    });
  }

  // Reverse chronological for display (newest first)
  const months = [...monthsChronological].reverse();

  // Averages
  const activeMonthsCount = Math.max(1, months.length);
  const avgMonthlyExpense = Math.round((totalExpense / activeMonthsCount) * 100) / 100;
  const avgMonthlyIncome = Math.round((totalIncome / activeMonthsCount) * 100) / 100;

  // Categories breakdown sorted descending
  const categories: CategoryExpenseAnalytics[] = Array.from(categoryExpenseTotals.entries())
    .map(([catId, item]) => {
      const catObj = getCategoryById(catId);
      return {
        id: catId,
        name: getCategoryName(catId, language),
        amount: item.amount,
        percentage: totalExpense > 0 ? Math.round((item.amount / totalExpense) * 1000) / 10 : 0,
        count: item.count,
        color: catObj?.color || '#10B981',
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Smart Diagnosis & Financial Health Scoring (0 - 100)
  let healthScore = 50;

  if (totalIncome > 0) {
    if (savingsRate >= 30) healthScore += 35;
    else if (savingsRate >= 20) healthScore += 25;
    else if (savingsRate >= 10) healthScore += 15;
    else if (savingsRate >= 0) healthScore += 5;
    else if (savingsRate < -20) healthScore -= 30;
    else healthScore -= 15;
  } else if (totalExpense > 0) {
    healthScore -= 20;
  }

  if (netSavings > 0) healthScore += 10;
  if (sortedTransactions.length >= 8) healthScore += 5;

  healthScore = Math.max(15, Math.min(98, healthScore));

  let healthStatusText = isAr ? 'متوازن • أداء مالي مستقر' : isMl ? 'സ്ഥിരതയുള്ള സാമ്പത്തിക നില' : 'Balanced • Stable Financial Position';
  let healthColor = '#F59E0B';

  if (healthScore >= 80) {
    healthStatusText = isAr ? 'ممتاز • كفاءة ادخار وتدفق نقدي فائق' : isMl ? 'മികച്ച സാമ്പത്തിക ആരോഗ്യം' : 'Excellent • Exceptional Savings & Flow';
    healthColor = '#10B981';
  } else if (healthScore >= 65) {
    healthStatusText = isAr ? 'جيد جداً • نمو متزن وفائض إيجابي' : isMl ? 'വളരെ നല്ല സാമ്പത്തിക സ്ഥിതി' : 'Very Good • Steady Growth & Positive Surplus';
    healthColor = '#0D9488';
  } else if (healthScore < 50) {
    healthStatusText = isAr ? 'تنبيه • عجز نقدي يتطلب إعادة توازن الميزانية' : isMl ? 'ശ്രദ്ധിക്കുക: ചെലവ് വരുമാനത്തേക്കാൾ കൂടുതലാണ്' : 'Deficit Alert • Spending Exceeds Inflow';
    healthColor = '#EF4444';
  }

  // Generate Smart Actionable Insights
  const insights: SmartInsightItem[] = [];

  // Insight 1: Savings Performance
  if (savingsRate >= 20) {
    insights.push({
      icon: '🛡️',
      title: isAr ? 'كفاءة ادخار استراتيجية ممتازة' : isMl ? 'മികച്ച സമ്പാദ്യ നിരക്ക്' : 'Strategic Savings Excellence',
      text: isAr
        ? `تحقق معدل ادخار يبلغ ${savingsRate}%، وهو يتجاوز القاعدة المالية العالمية (50/30/20) الموصى بها، مما يعزز أمانك المالي وبناء الثروة.`
        : isMl
        ? `നിങ്ങളുടെ സമ്പാദ്യ നിരക്ക് ${savingsRate}% ആണ്. ഇത് ആഗോള മാനദണ്ഡത്തേക്കാൾ മികച്ചതാണ്.`
        : `Your savings rate is ${savingsRate}%, which comfortably exceeds the benchmark 50/30/20 financial rule, accelerating wealth accumulation.`,
      type: 'positive',
    });
  } else if (savingsRate > 0) {
    insights.push({
      icon: '📈',
      title: isAr ? 'فائض مالي إيجابي يحتاج لتعزيز' : isMl ? 'പോസിറ്റീവ് മിച്ചം' : 'Positive Surplus with Growth Potential',
      text: isAr
        ? `أنت تحقق فائضاً بنسبة ${savingsRate}%. لرفع معدل الادخار إلى النسبة الذهبية (20%)، يمكنك تقليص نفقات فئة (${categories[0]?.name || 'المصروفات العامة'}) بنسبة 10-15%.`
        : isMl
        ? `നിങ്ങൾക്ക് ${savingsRate}% മിച്ചമുണ്ട്. ചെലവ് കുറച്ചുകൊണ്ട് ഇത് 20% ആക്കി ഉയർത്താം.`
        : `You maintain a positive ${savingsRate}% surplus. Trimming 10-15% off your top spending category (${categories[0]?.name || 'discretionary items'}) can push you to the optimal 20% tier.`,
      type: 'info',
    });
  } else {
    insights.push({
      icon: '⚠️',
      title: isAr ? 'تنبيه التدفق النقدي والعجز' : isMl ? 'ചെലവ് നിയന്ത്രണ മുന്നറിയിപ്പ്' : 'Cashflow Deficit Warning',
      text: isAr
        ? `المصروفات تتجاوز إجمالي الإيرادات بفارق سالب. يوصى بوضع سقف ميزانية شهري صارم وتأجيل النفقات غير الضرورية حتى استعادة الفائض.`
        : isMl
        ? `ചെലവുകൾ വരുമാനത്തേക്കാൾ കൂടുതലാണ്. അടിയന്തിരമായി ബജറ്റ് പരിധി നിശ്ചയിക്കുക.`
        : `Total expenditures currently exceed your recorded income. Immediate budget caps on discretionary categories are highly advised.`,
      type: 'warning',
    });
  }

  // Insight 2: Spending Concentration
  if (categories.length > 0) {
    const top = categories[0];
    insights.push({
      icon: '🎯',
      title: isAr ? `تركز النفقات في فئة (${top.name})` : isMl ? `പ്രധാന ചെലവ്: ${top.name}` : `Major Outflow in (${top.name})`,
      text: isAr
        ? `تستحوذ فئة (${top.name}) على ${top.percentage}% من إجمالي نفقاتك بمبلغ ${formatCurrency(top.amount, language)} ${targetWallet.currency}. مراقبة هذه الفئة هي المفتاح الأكبر لزيادة مدخراتك.`
        : isMl
        ? `നിങ്ങളുടെ ആകെ ചെലവിന്റെ ${top.percentage}% (${top.name}) വിഭാഗത്തിലാണ്.`
        : `(${top.name}) represents ${top.percentage}% of all your recorded spending (${formatCurrency(top.amount, language)} ${targetWallet.currency}). Monitoring this category offers the highest savings leverage.`,
      type: 'info',
    });
  }

  // Insight 3: Best Monthly Performance
  if (months.length > 0) {
    const bestMonth = [...months].sort((a, b) => b.net - a.net)[0];
    if (bestMonth && bestMonth.net > 0) {
      insights.push({
        icon: '🏆',
        title: isAr ? `الشهر المالي الذهبي: ${bestMonth.monthName}` : isMl ? `ഏറ്റവും മികച്ച മാസം: ${bestMonth.monthName}` : `Peak Performance Month: ${bestMonth.monthName}`,
        text: isAr
          ? `حقق شهر (${bestMonth.monthName}) أعلى صافي وفر مالي بقيمة ${formatCurrency(bestMonth.net, language)} ${targetWallet.currency} بمعدل ادخار ${bestMonth.savingsRate}%. استنساخ هذا النمط يضمن نجاح أهدافك المالية.`
          : isMl
          ? `${bestMonth.monthName} മാസത്തിൽ ഏറ്റവും ഉയർന്ന മിച്ചം (${formatCurrency(bestMonth.net, language)} ${targetWallet.currency}) രേഖപ്പെടുത്തി.`
          : `(${bestMonth.monthName}) achieved the highest net surplus of ${formatCurrency(bestMonth.net, language)} ${targetWallet.currency} with a ${bestMonth.savingsRate}% savings rate. Replicating this behavior ensures your financial milestones.`,
        type: 'positive',
      });
    }
  }

  // Insight 4: Actionable Financial Rule Tip
  insights.push({
    icon: '💡',
    title: isAr ? 'توصية استراتيجية لبناء الأمان المالي' : isMl ? 'സാമ്പത്തിക നിർദ്ദേശം' : 'Strategic Financial Safety Recommendation',
    text: isAr
      ? `استهدف الاحتفاظ باحتياطي طوارئ يعادل 3 إلى 6 أشهر من متوسط نفقاتك الشهرية (حوالي ${formatCurrency(avgMonthlyExpense * 3, language)} إلى ${formatCurrency(avgMonthlyExpense * 6, language)} ${targetWallet.currency}).`
      : isMl
      ? `3 മുതൽ 6 മാസത്തെ ചെലവിനുള്ള തുക എമർജൻസി ഫണ്ടായി സൂക്ഷിക്കുക.`
      : `Target an emergency cushion covering 3 to 6 months of average expenses (approx ${formatCurrency(avgMonthlyExpense * 3, language)} to ${formatCurrency(avgMonthlyExpense * 6, language)} ${targetWallet.currency}) for full peace of mind.`,
    type: 'tip',
  });

  // Date span
  let startDateStr = '-';
  let endDateStr = '-';
  if (sortedTransactions.length > 0) {
    const newest = new Date(sortedTransactions[0].date);
    const oldest = new Date(sortedTransactions[sortedTransactions.length - 1].date);
    const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    const locale = isAr ? 'ar-EG' : 'en-US';
    endDateStr = newest.toLocaleDateString(locale, opts);
    startDateStr = oldest.toLocaleDateString(locale, opts);
  }

  // Wallets summary if available
  const walletsSummary = wallets && wallets.length > 0 ? wallets.map(w => {
    const wTxCount = allTransactions.filter(t => t.walletId === w.id || (t.type === 'transfer' && t.toWalletId === w.id)).length;
    return {
      name: w.name,
      currency: w.currency,
      color: w.color || '#10B981',
      count: wTxCount,
    };
  }) : undefined;

  return {
    walletName: targetWallet.name || (isAr ? 'المحفظة الرئيسية' : 'Primary Wallet'),
    currency: targetWallet.currency || 'KWD',
    totalIncome,
    totalExpense,
    netSavings,
    savingsRate,
    totalTransactionsCount: sortedTransactions.length,
    incomeCount,
    expenseCount,
    avgMonthlyExpense,
    avgMonthlyIncome,
    highestSingleExpense,
    months,
    categories,
    diagnosis: {
      healthScore,
      healthStatusText,
      healthColor,
      insights,
    },
    sortedTransactions,
    startDateStr,
    endDateStr,
    walletsSummary,
  };
}
