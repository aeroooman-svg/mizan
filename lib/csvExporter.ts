import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { Transaction, Wallet } from './storage';
import { Language, getCategoryName } from './i18n';
import { computeFinancialReportData } from './financialReportAnalytics';

export async function exportTransactionsToCSV(
  transactions: Transaction[],
  wallet: Wallet,
  language: Language,
  wallets: Wallet[] = []
): Promise<void> {
  const isAr = language === 'ar';
  const isMl = language === 'ml' || language === 'hi';

  const data = computeFinancialReportData(transactions, wallet, language, wallets);
  const currencySymbol = data.currency;

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvLines: string[] = [];

  // ==========================================
  // SECTION 1: EXECUTIVE FINANCIAL OVERVIEW
  // ==========================================
  csvLines.push(escapeCsv(isAr ? '=== تقرير الوضع المالي الشامل والتحليل الذكي (تطبيق ميزان MIZAN) ===' : '=== MIZAN COMPREHENSIVE FINANCIAL INTELLIGENCE REPORT ==='));
  csvLines.push(`${escapeCsv(isAr ? 'تاريخ استخراج التقرير' : 'Export Date')},${escapeCsv(new Date().toISOString().split('T')[0])}`);
  csvLines.push(`${escapeCsv(isAr ? 'المحفظة / الحساب' : 'Wallet / Account')},${escapeCsv(data.walletName)}`);
  csvLines.push(`${escapeCsv(isAr ? 'العملة الأساسية' : 'Base Currency')},${escapeCsv(currencySymbol)}`);
  csvLines.push(`${escapeCsv(isAr ? 'الفترة الزمنية المغطاة' : 'Reporting Period')},${escapeCsv(`${data.startDateStr} - ${data.endDateStr}`)}`);
  csvLines.push(`${escapeCsv(isAr ? 'إجمالي الدخل الكلي' : 'Total Inflow')},${data.totalIncome}`);
  csvLines.push(`${escapeCsv(isAr ? 'إجمالي المصروفات الكلية' : 'Total Outflow')},${data.totalExpense}`);
  csvLines.push(`${escapeCsv(isAr ? 'صافي الفائض / الوفر المالي' : 'Net Surplus / Balance')},${data.netSavings}`);
  csvLines.push(`${escapeCsv(isAr ? 'معدل الادخار التراكمي %' : 'Overall Savings Rate %')},${escapeCsv(`${data.savingsRate}%`)}`);
  csvLines.push(`${escapeCsv(isAr ? 'مؤشر الصحة والعافية المالية' : 'Financial Health Score')},${escapeCsv(`${data.diagnosis.healthScore}/100 (${data.diagnosis.healthStatusText})`)}`);
  csvLines.push(`${escapeCsv(isAr ? 'إجمالي عدد المعاملات' : 'Total Transactions Count')},${data.totalTransactionsCount}`);
  csvLines.push(`${escapeCsv(isAr ? 'متوسط المصروف الشهري' : 'Avg Monthly Outflow')},${data.avgMonthlyExpense}`);
  csvLines.push(`${escapeCsv(isAr ? 'متوسط الدخل الشهري' : 'Avg Monthly Inflow')},${data.avgMonthlyIncome}`);
  csvLines.push('');

  // ==========================================
  // SECTION 2: MONTH-BY-MONTH FINANCIAL BREAKDOWN
  // ==========================================
  csvLines.push(escapeCsv(isAr ? '=== التحليل المالي التفصيلي للشهور ===' : '=== MONTH-BY-MONTH FINANCIAL PERFORMANCE ==='));
  const monthHeaders = isAr
    ? ['الشهر', 'الدخل الوارد (+)', 'المصروفات (-)', 'صافي الفائض / العجز', 'معدل الادخار %', 'أعلى فئة إنفاقاً', 'مبلغ أعلى فئة', 'مقارنة بالشهر السابق %', 'عدد العمليات']
    : isMl
    ? ['മാസം', 'വരുമാനം', 'ചെലവ്', 'മിച്ചം', 'സമ്പാദ്യ നിരക്ക് %', 'പ്രധാന ചെലവ്', 'തുക', 'മാറ്റം %', 'ഇടപാടുകൾ']
    : ['Month', 'Inflow (+)', 'Outflow (-)', 'Net Balance', 'Savings Rate %', 'Top Spending Category', 'Top Category Amount', 'MoM Trend %', 'Transactions Count'];

  csvLines.push(monthHeaders.map(escapeCsv).join(','));

  for (const m of data.months) {
    const topCatName = m.topCategory ? m.topCategory.name : '-';
    const topCatAmt = m.topCategory ? m.topCategory.amount : 0;
    const momStr = m.momExpenseChange !== null ? `${m.momExpenseChange > 0 ? '+' : ''}${m.momExpenseChange}%` : '-';

    csvLines.push([
      escapeCsv(m.monthName),
      m.income,
      m.expense,
      m.net,
      escapeCsv(`${m.savingsRate}%`),
      escapeCsv(topCatName),
      topCatAmt,
      escapeCsv(momStr),
      m.txCount,
    ].join(','));
  }

  // Monthly totals row
  csvLines.push([
    escapeCsv(isAr ? 'الإجمالي التراكمي' : 'Total Cumulative'),
    data.totalIncome,
    data.totalExpense,
    data.netSavings,
    escapeCsv(`${data.savingsRate}%`),
    '""',
    '""',
    '""',
    data.totalTransactionsCount,
  ].join(','));
  csvLines.push('');

  // ==========================================
  // SECTION 3: CATEGORY SPENDING BREAKDOWN
  // ==========================================
  csvLines.push(escapeCsv(isAr ? '=== توزيع النفقات حسب الفئات ===' : '=== CATEGORY SPENDING BREAKDOWN ==='));
  const catHeaders = isAr
    ? ['الترتيب', 'الفئة', 'إجمالي المبلغ المنفق', 'العملة', 'النسبة المئوية % من النفقات', 'عدد المعاملات']
    : isMl
    ? ['റാങ്ക്', 'വിഭാഗം', 'ആകെ തുക', 'കറൻസി', 'ശതമാനം %', 'ഇടപാടുകൾ']
    : ['Rank', 'Category', 'Total Spent', 'Currency', 'Share %', 'Transactions Count'];

  csvLines.push(catHeaders.map(escapeCsv).join(','));

  data.categories.forEach((cat, idx) => {
    csvLines.push([
      idx + 1,
      escapeCsv(cat.name),
      cat.amount,
      escapeCsv(currencySymbol),
      escapeCsv(`${cat.percentage}%`),
      cat.count,
    ].join(','));
  });
  csvLines.push('');

  // ==========================================
  // SECTION 4: FULL DETAILED TRANSACTION REGISTER
  // ==========================================
  csvLines.push(escapeCsv(isAr ? '=== سجل المعاملات المالي المفصل ===' : '=== COMPREHENSIVE TRANSACTION REGISTER ==='));
  const txHeaders = isAr
    ? ['المعرف', 'التاريخ', 'الوقت', 'نوع المعاملة', 'الفئة', 'الوصف والبيان', 'المبلغ', 'العملة', 'طريقة الدفع', 'الملاحظات']
    : isMl
    ? ['ഐഡി', 'തീയതി', 'സമയം', 'തരം', 'വിഭാഗം', 'വിവരണം', 'തുക', 'കറൻസി', 'രീതി', 'കുറിപ്പുകൾ']
    : ['Transaction ID', 'Date', 'Time', 'Type', 'Category', 'Description / Payee', 'Amount', 'Currency', 'Payment Method', 'Notes'];

  csvLines.push(txHeaders.map(escapeCsv).join(','));

  for (const t of data.sortedTransactions) {
    const d = new Date(t.date);
    const dateFormatted = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : t.date;
    const timeFormatted = !isNaN(d.getTime()) ? d.toLocaleTimeString('en-US', { hour12: false }) : '';
    
    const typeStr = t.type === 'income'
      ? (isAr ? 'دخل' : isMl ? 'വരുമാനം' : 'Income')
      : t.type === 'expense'
      ? (isAr ? 'مصروف' : isMl ? 'ചെലവ്' : 'Expense')
      : (isAr ? 'تحويل' : isMl ? 'കൈമാറ്റം' : 'Transfer');

    const catName = getCategoryName(t.category, language);
    const methodStr = t.paymentMethod === 'cash' ? (isAr ? 'نقدي' : 'Cash') : (isAr ? 'بطاقة/بنك' : 'Card/Bank');

    csvLines.push([
      escapeCsv(t.id),
      escapeCsv(dateFormatted),
      escapeCsv(timeFormatted),
      escapeCsv(typeStr),
      escapeCsv(catName),
      escapeCsv(t.description || ''),
      t.amount,
      escapeCsv(currencySymbol),
      escapeCsv(methodStr),
      escapeCsv(t.note || ''),
    ].join(','));
  }

  // Prepend UTF-8 BOM (\uFEFF) for guaranteed correct Arabic rendering in Microsoft Excel & Apple Numbers
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const safeDate = new Date().toISOString().split('T')[0];
  const fileName = `mizan_financial_report_${data.walletName.replace(/\s+/g, '_')}_${safeDate}.csv`;

  // Web Browser Download
  if (Platform.OS === 'web') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Native Mobile (iOS & Android)
  try {
    const file = new File(Paths.cache, fileName);
    file.write(csvContent);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: isAr ? 'تصدير التقرير المالي الشامل (CSV)' : 'Export Financial Intelligence Report (CSV)',
        UTI: 'public.comma-separated-values-text',
      });
    }
  } catch (error) {
    console.error('CSV export error:', error);
    throw error;
  }
}
