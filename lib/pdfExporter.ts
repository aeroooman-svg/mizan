import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Transaction, Wallet } from './storage';
import { Language, getCategoryName, getCurrencyName } from './i18n';
import { formatCurrency } from './categories';

export async function exportTransactionsToPDF(
  transactions: Transaction[],
  wallet: Wallet,
  language: Language
): Promise<void> {
  if (Platform.OS === 'web') {
    alert(language === 'ar' ? 'تصدير PDF غير مدعوم على الويب' : language === 'hi' ? 'वेब पर पीडीएफ निर्यात समर्थित नहीं है' : 'PDF export is not supported on Web');
    return;
  }

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const currencySymbol = wallet.currency;

  const titleText = language === 'ar' ? `كشف حساب - ${wallet.name}` : language === 'hi' ? `खाता विवरण - ${wallet.name}` : `Statement - ${wallet.name}`;
  const totalIncomeLabel = language === 'ar' ? 'إجمالي الدخل' : language === 'hi' ? 'कुल आय' : 'Total Income';
  const totalExpenseLabel = language === 'ar' ? 'إجمالي المصاريف' : language === 'hi' ? 'कुल व्यय' : 'Total Expenses';
  const balanceLabel = language === 'ar' ? 'صافي الرصيد' : language === 'hi' ? 'शुद्ध शेष' : 'Net Balance';
  const dateLabel = language === 'ar' ? 'التاريخ' : language === 'hi' ? 'तारीख' : 'Date';
  const descriptionLabel = language === 'ar' ? 'الوصف' : language === 'hi' ? 'विवरण' : 'Description';
  const categoryLabel = language === 'ar' ? 'الفئة' : language === 'hi' ? 'श्रेणी' : 'Category';
  const amountLabel = language === 'ar' ? 'المبلغ' : language === 'hi' ? 'राशि' : 'Amount';
  const typeLabel = language === 'ar' ? 'النوع' : language === 'hi' ? 'प्रकार' : 'Type';
  const incomeText = language === 'ar' ? 'دخل' : language === 'hi' ? 'आय' : 'Income';
  const expenseText = language === 'ar' ? 'مصروف' : language === 'hi' ? 'व्यय' : 'Expense';
  
  // Format transactions rows
  const rowsHtml = transactions
    .map((t) => {
      const typeStr = t.type === 'income' ? incomeText : expenseText;
      const typeColor = t.type === 'income' ? '#10B981' : '#EF4444';
      const categoryName = getCategoryName(t.category, language);
      const formattedDate = new Date(t.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      return `
        <tr>
          <td>${formattedDate}</td>
          <td>${t.description || '-'}</td>
          <td>${categoryName}</td>
          <td style="color: ${typeColor}; font-weight: bold;">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, language)}</td>
          <td style="color: ${typeColor};">${typeStr}</td>
        </tr>
      `;
    })
    .join('');

  // Arabic or English styling
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const fontFamily = 'Cairo, sans-serif';

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="${dir}">
    <head>
      <meta charset="utf-8">
      <title>${titleText}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        body {
          font-family: ${fontFamily};
          margin: 40px;
          color: #1F2937;
          background-color: #FFFFFF;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #E5E7EB;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          font-size: 24px;
          margin: 0;
          color: #0F172A;
        }
        .meta {
          font-size: 14px;
          color: #6B7280;
        }
        .summary-cards {
          display: flex;
          gap: 20px;
          margin-bottom: 40px;
        }
        .card {
          flex: 1;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }
        .card.income { border-top: 4px solid #10B981; }
        .card.expense { border-top: 4px solid #EF4444; }
        .card.balance { border-top: 4px solid #3B82F6; }
        .card-title {
          font-size: 14px;
          color: #4B5563;
          margin-bottom: 8px;
        }
        .card-value {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #E5E7EB;
          padding: 12px 16px;
          text-align: ${language === 'ar' ? 'right' : 'left'};
          font-size: 14px;
        }
        th {
          background-color: #F9FAFB;
          color: #374151;
          font-weight: 600;
        }
        tr:nth-child(even) {
          background-color: #F9FAFB;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${titleText}</h1>
          <p class="meta">${language === 'ar' ? 'عملة المحفظة' : 'Wallet Currency'}: ${getCurrencyName(currencySymbol, language)}</p>
        </div>
        <div style="text-align: ${language === 'ar' ? 'left' : 'right'};">
          <p class="meta">${language === 'ar' ? 'تاريخ التصدير' : 'Exported At'}: ${new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</p>
        </div>
      </div>

      <div class="summary-cards">
        <div class="card income">
          <div class="card-title">${totalIncomeLabel}</div>
          <div class="card-value">+${formatCurrency(totalIncome, language)} ${currencySymbol}</div>
        </div>
        <div class="card expense">
          <div class="card-title">${totalExpenseLabel}</div>
          <div class="card-value">-${formatCurrency(totalExpense, language)} ${currencySymbol}</div>
        </div>
        <div class="card balance">
          <div class="card-title">${balanceLabel}</div>
          <div class="card-value" style="color: ${balance >= 0 ? '#10B981' : '#EF4444'}">${balance >= 0 ? '+' : ''}${formatCurrency(balance, language)} ${currencySymbol}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>${dateLabel}</th>
            <th>${descriptionLabel}</th>
            <th>${categoryLabel}</th>
            <th>${amountLabel}</th>
            <th>${typeLabel}</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: titleText });
  } catch (error) {
    console.error('PDF export error:', error);
    throw error;
  }
}
