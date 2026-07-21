import { expenseCategories, incomeCategories } from './categories';

export interface ParsedStatementTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  selected: boolean;
}

// Category keyword matching helper
function inferCategory(description: string, type: 'income' | 'expense'): string {
  const desc = description.toLowerCase();

  if (type === 'income') {
    if (desc.includes('salary') || desc.includes('مرتب') || desc.includes('راتب') || desc.includes('payroll')) {
      return 'salary';
    }
    if (desc.includes('freelance') || desc.includes('مستقل') || desc.includes('مشروع')) {
      return 'freelance';
    }
    if (desc.includes('dividend') || desc.includes('profit') || desc.includes('ارباح') || desc.includes('استثمار')) {
      return 'investment';
    }
    if (desc.includes('gift') || desc.includes('هدية') || desc.includes('منحة')) {
      return 'gift';
    }
    return 'other_income';
  } else {
    if (desc.includes('uber') || desc.includes('careem') || desc.includes('metro') || desc.includes('مواصلات') || desc.includes('بنزين') || desc.includes('غاز') || desc.includes('fuel')) {
      return 'transport';
    }
    if (desc.includes('supermarket') || desc.includes('carrefour') || desc.includes('hyper') || desc.includes('مطعم') || desc.includes('أكل') || desc.includes('طعام') || desc.includes('kfc') || desc.includes('mcdonald') || desc.includes('talabat')) {
      return 'food';
    }
    if (desc.includes('bill') || desc.includes('vodafone') || desc.includes('orange') || desc.includes('etisalat') || desc.includes('we') || desc.includes('كهرباء') || desc.includes('مياه') || desc.includes('فاتورة')) {
      return 'bills';
    }
    if (desc.includes('pharmacy') || desc.includes('hospital') || desc.includes('دواء') || desc.includes('صيدلية') || desc.includes('علاج') || desc.includes('doctor')) {
      return 'health';
    }
    if (desc.includes('school') || desc.includes('course') || desc.includes('جامعة') || desc.includes('مدرسة') || desc.includes('دراسة')) {
      return 'education';
    }
    if (desc.includes('cinema') || desc.includes('netlfix') || desc.includes('spotify') || desc.includes('سينما') || desc.includes('ترفيه')) {
      return 'entertainment';
    }
    if (desc.includes('rent') || desc.includes('إيجار') || desc.includes('ايجار')) {
      return 'rent';
    }
    if (desc.includes('clothes') || desc.includes('zara') || desc.includes('h&m') || desc.includes('ملابس')) {
      return 'clothes';
    }
    return 'other';
  }
}

/**
 * Parse CSV or plain text bank statements
 */
export function parseBankStatementText(rawText: string): ParsedStatementTransaction[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const transactions: ParsedStatementTransaction[] = [];

  let isCSV = false;
  let delimiter = ',';

  // Check first line for CSV format
  const firstLine = lines[0];
  if (firstLine.includes(';') || firstLine.includes(',') || firstLine.includes('\t')) {
    isCSV = true;
    if (firstLine.includes(';')) delimiter = ';';
    else if (firstLine.includes('\t')) delimiter = '\t';
  }

  // Helper date validator/formatter
  const formatDateStr = (rawDate: string): string => {
    const cleaned = rawDate.trim().replace(/['"]/g, '');
    const dateObj = new Date(cleaned);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  lines.forEach((line, index) => {
    // Skip header line if CSV
    if (isCSV && index === 0 && (line.toLowerCase().includes('date') || line.toLowerCase().includes('تاريخ') || line.toLowerCase().includes('amount') || line.toLowerCase().includes('مبلغ'))) {
      return;
    }

    if (isCSV) {
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 3) {
        // Try identifying date, description, amount
        let dateVal = parts[0];
        let descVal = parts[1];
        let amountValStr = parts[2];
        let typeVal: 'income' | 'expense' = 'expense';

        // Check if 4th column specifies credit/debit
        if (parts.length >= 4) {
          const typeStr = parts[3].toLowerCase();
          if (typeStr.includes('cr') || typeStr.includes('credit') || typeStr.includes('إيداع') || typeStr.includes('دخل')) {
            typeVal = 'income';
          }
        }

        let num = parseFloat(amountValStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(num)) return;

        if (num < 0) {
          num = Math.abs(num);
          typeVal = 'expense';
        }

        const categoryId = inferCategory(descVal, typeVal);

        transactions.push({
          id: `stmt_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 4)}`,
          date: formatDateStr(dateVal),
          description: descVal || 'Bank Transaction',
          amount: num,
          type: typeVal,
          categoryId,
          selected: true,
        });
      }
    } else {
      // Regex parsing for plain SMS/Text formatted bank lines
      // e.g. "2026-07-15 Purchase of EGP 350.00 at Carrefour"
      const amountMatch = line.match(/(?:EGP|USD|KWD|SAR|AED|\$|ج\.م|د\.ك)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
      if (amountMatch) {
        const num = parseFloat(amountMatch[1]);
        if (!isNaN(num) && num > 0) {
          let typeVal: 'income' | 'expense' = 'expense';
          if (line.includes('received') || line.includes('deposit') || line.includes('إيداع') || line.includes('إضافة') || line.includes('تحويل إليك')) {
            typeVal = 'income';
          }

          const descVal = line.replace(amountMatch[0], '').trim() || 'Bank Line';
          const categoryId = inferCategory(descVal, typeVal);

          transactions.push({
            id: `stmt_txt_${Date.now()}_${index}`,
            date: new Date().toISOString().split('T')[0],
            description: descVal,
            amount: num,
            type: typeVal,
            categoryId,
            selected: true,
          });
        }
      }
    }
  });

  return transactions;
}
