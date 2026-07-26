/**
 * Enhanced Bank Statement & SMS Parser Engine (lib/statementParser.ts)
 * Parses CSV files, copied Bank SMS logs, and raw statements for Arab/MENA banks:
 * CIB, NBE (الأهلي), Banque Misr, QNB, InstaPay, Vodafone Cash, Al Rajhi, KFH, etc.
 */

export interface ParsedStatementTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  selected: boolean;
}

function inferCategory(description: string, type: 'income' | 'expense'): string {
  const desc = description.toLowerCase();

  if (type === 'income') {
    if (desc.includes('salary') || desc.includes('مرتب') || desc.includes('راتب') || desc.includes('payroll') || desc.includes('تحويل راتب')) {
      return 'salary';
    }
    if (desc.includes('freelance') || desc.includes('مستقل') || desc.includes('مشروع')) {
      return 'freelance';
    }
    if (desc.includes('dividend') || desc.includes('profit') || desc.includes('ارباح') || desc.includes('أرباح') || desc.includes('استثمار') || desc.includes('فوائد')) {
      return 'investment';
    }
    if (desc.includes('gift') || desc.includes('هدية') || desc.includes('منحة') || desc.includes('عيدية')) {
      return 'gift';
    }
    return 'other_income';
  } else {
    if (desc.includes('uber') || desc.includes('careem') || desc.includes('metro') || desc.includes('مواصلات') || desc.includes('بنزين') || desc.includes('وقود') || desc.includes('غاز') || desc.includes('fuel') || desc.includes('تاكسي')) {
      return 'transport';
    }
    if (desc.includes('supermarket') || desc.includes('carrefour') || desc.includes('hyper') || desc.includes('مطعم') || desc.includes('أكل') || desc.includes('طعام') || desc.includes('kfc') || desc.includes('mcdonald') || desc.includes('talabat') || desc.includes('سوبرماركت') || desc.includes('أسواق')) {
      return 'food';
    }
    if (desc.includes('bill') || desc.includes('vodafone') || desc.includes('orange') || desc.includes('etisalat') || desc.includes('we') || desc.includes('كهرباء') || desc.includes('مياه') || desc.includes('فاتورة') || desc.includes('فواتير') || desc.includes('فوري') || desc.includes('fawry')) {
      return 'bills';
    }
    if (desc.includes('pharmacy') || desc.includes('hospital') || desc.includes('دواء') || desc.includes('صيدلية') || desc.includes('علاج') || desc.includes('doctor') || desc.includes('مستشفى') || desc.includes('عيادة')) {
      return 'health';
    }
    if (desc.includes('school') || desc.includes('course') || desc.includes('جامعة') || desc.includes('مدرسة') || desc.includes('دراسة') || desc.includes('رسوم')) {
      return 'education';
    }
    if (desc.includes('cinema') || desc.includes('netflix') || desc.includes('spotify') || desc.includes('سينما') || desc.includes('ترفيه') || desc.includes('ألعاب')) {
      return 'entertainment';
    }
    if (desc.includes('rent') || desc.includes('إيجار') || desc.includes('ايجار')) {
      return 'rent';
    }
    if (desc.includes('clothes') || desc.includes('zara') || desc.includes('h&m') || desc.includes('ملابس') || desc.includes('أزياء')) {
      return 'clothes';
    }
    return 'other';
  }
}

export function parseBankStatementText(rawText: string): ParsedStatementTransaction[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const transactions: ParsedStatementTransaction[] = [];

  let isCSV = false;
  let delimiter = ',';

  const firstLine = lines[0];
  if (firstLine.includes(';') || firstLine.includes(',') || firstLine.includes('\t')) {
    isCSV = true;
    if (firstLine.includes(';')) delimiter = ';';
    else if (firstLine.includes('\t')) delimiter = '\t';
  }

  const formatDateStr = (rawDate: string): string => {
    const cleaned = rawDate.trim().replace(/['"]/g, '');
    const dateObj = new Date(cleaned);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  lines.forEach((line, index) => {
    if (isCSV && index === 0 && (line.toLowerCase().includes('date') || line.toLowerCase().includes('تاريخ') || line.toLowerCase().includes('amount') || line.toLowerCase().includes('مبلغ'))) {
      return;
    }

    if (isCSV) {
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 3) {
        let dateVal = parts[0];
        let descVal = parts[1];
        let amountValStr = parts[2];
        let typeVal: 'income' | 'expense' = 'expense';

        if (parts.length >= 4) {
          const typeStr = parts[3].toLowerCase();
          if (typeStr.includes('cr') || typeStr.includes('credit') || typeStr.includes('إيداع') || typeStr.includes('دخل') || typeStr.includes('إضافة')) {
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
      // Enhanced Bank SMS & Statement regex matching (InstaPay, CIB, NBE, QNB, Vodafone Cash, etc.)
      const amountMatch = line.match(/(?:EGP|USD|KWD|SAR|AED|\$|ج\.م|د\.ك)?\s*([0-9]+(?:[\.\,][0-9]{1,2})?)/i);
      if (amountMatch) {
        const cleanedVal = amountMatch[1].replace(',', '.');
        const num = parseFloat(cleanedVal);
        if (!isNaN(num) && num > 0) {
          let typeVal: 'income' | 'expense' = 'expense';
          const lowerLine = line.toLowerCase();
          if (
            lowerLine.includes('received') ||
            lowerLine.includes('deposit') ||
            lowerLine.includes('إيداع') ||
            lowerLine.includes('إضافة') ||
            lowerLine.includes('تحويل إليك') ||
            lowerLine.includes('تم استلام') ||
            lowerLine.includes('إيداع نقدي') ||
            lowerLine.includes('credit')
          ) {
            typeVal = 'income';
          }

          const descVal = line.replace(amountMatch[0], '').trim() || 'معاملة بنكية';
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
