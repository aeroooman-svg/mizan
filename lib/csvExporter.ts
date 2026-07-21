import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import { Transaction, Wallet } from './storage';
import { getCategoryName } from './i18n';

export async function exportTransactionsToCSV(
  transactions: Transaction[],
  wallet: Wallet,
  language: 'ar' | 'en'
): Promise<void> {
  const isAr = language === 'ar';
  
  // CSV Headers
  const headers = isAr
    ? ['المعرف', 'التاريخ', 'النوع', 'الفئة', 'المبلغ', 'العملة', 'الوصف', 'ملاحظات']
    : ['ID', 'Date', 'Type', 'Category', 'Amount', 'Currency', 'Description', 'Notes'];

  // CSV Rows
  const rows = transactions.map((t) => {
    const formattedDate = new Date(t.date).toISOString().split('T')[0];
    const typeStr = t.type === 'income' ? (isAr ? 'دخل' : 'Income') : t.type === 'expense' ? (isAr ? 'مصروف' : 'Expense') : (isAr ? 'تحويل' : 'Transfer');
    const categoryName = getCategoryName(t.category, language);
    const desc = (t.description || '').replace(/"/g, '""');
    const note = (t.note || '').replace(/"/g, '""');

    return [
      `"${t.id}"`,
      `"${formattedDate}"`,
      `"${typeStr}"`,
      `"${categoryName}"`,
      `"${t.amount}"`,
      `"${wallet.currency}"`,
      `"${desc}"`,
      `"${note}"`,
    ].join(',');
  });

  // Combine headers and rows with UTF-8 BOM (\uFEFF) for Excel compatibility
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');

  if (Platform.OS === 'web') {
    // Web download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mizan_${wallet.name}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  try {
    // For Native Apps: Generate HTML file or use Print / Sharing
    const fileUri = await Print.printToFileAsync({
      html: `<pre>${csvContent}</pre>`,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri.uri, {
        mimeType: 'text/csv',
        dialogTitle: isAr ? 'تصدير كشف الحساب (CSV)' : 'Export Statement (CSV)',
        UTI: 'public.comma-separated-values-text',
      });
    }
  } catch (error) {
    console.error('Error exporting CSV:', error);
  }
}
