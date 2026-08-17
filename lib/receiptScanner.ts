import { normalizeArabicNumbers } from './arabicNumbers';
import { parseBankSMS, ParsedBankSMS } from './smsParser';

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface ScannedReceipt {
  merchantName: string;
  totalAmount: number | null;
  category: string;
  date: string;
  items: ReceiptItem[];
  rawText?: string;
  taxAmount?: number;
  paymentMethod?: string;
  confidenceScore: number;
}

/**
 * Intelligent Receipt Text OCR Parser
 * Parses OCR extracted text lines from grocery, restaurant, fuel, or retail store receipts.
 */
export function parseReceiptText(text: string): ScannedReceipt {
  if (!text || text.trim().length === 0) {
    return {
      merchantName: 'فاتورة جديدة',
      totalAmount: null,
      category: 'shopping',
      date: new Date().toISOString(),
      items: [],
      confidenceScore: 0.2,
    };
  }

  const normalized = normalizeArabicNumbers(text);
  const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Merchant Detection (Usually lines 1-3)
  let merchantName = 'مشتريات فاتورة';
  if (lines.length > 0) {
    // Pick first non-numeric, non-symbol line as merchant
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      const line = lines[i];
      if (!/^[\d\s.,\/#:\-]+$/.test(line) && line.length > 2) {
        merchantName = line.replace(/(welcome|مرحبا|فرع|branch|tax|vat|س.ت)/gi, '').trim();
        break;
      }
    }
  }

  // 2. Total Amount Extraction
  let totalAmount: number | null = null;
  const totalKeywords = [
    'المجموع الإجمالي', 'إجمالي الفاتورة', 'المجموع الكلي', 'الإجمالي', 'اجمالي',
    'المجموع', 'الصافي', 'المطلوب دفعها', 'total', 'grand total', 'net total', 'amount due', 'cash paid', 'visa'
  ];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (totalKeywords.some(kw => lower.includes(kw))) {
      // Find highest or rightmost price in this line or nearby
      const match = line.match(/([\d,]+\.\d{1,2}|\d{2,})/);
      if (match) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0) {
          totalAmount = val;
          break;
        }
      }
    }
  }

  // Fallback: search for largest price found in the bottom lines of the receipt
  if (!totalAmount) {
    let maxPrice = 0;
    for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) {
      const prices = lines[i].match(/\b\d+(\.\d{1,2})?\b/g);
      if (prices) {
        for (const p of prices) {
          const num = parseFloat(p);
          if (num > maxPrice && num < 100000) {
            maxPrice = num;
          }
        }
      }
    }
    if (maxPrice > 0) {
      totalAmount = maxPrice;
    }
  }

  // 3. Category Auto-Detection based on merchant & text keywords
  let category = 'shopping';
  const lowerAll = normalized.toLowerCase();

  if (/سوبر ماركت|ماركت|بقالة|كارفور|مترو|خضار|لحوم|طعام|دجاج|أغذية|carrefour|hyper|grocery|market|spinneys|lulu|food|restaurant|مطعم|كافيه|cafe/i.test(lowerAll)) {
    category = 'food';
  } else if (/بنزين|شيل|توتال|وقود|طاقة|غاز|petrol|shell|total|gas|station/i.test(lowerAll)) {
    category = 'transport';
  } else if (/صيدلية|علاج|دواء|مستشفى|طبيب|pharmacy|medicine|health|dr/i.test(lowerAll)) {
    category = 'health';
  } else if (/ملابس|زارا|shirt|zara|h&m|clothes|shoes|حذاء/i.test(lowerAll)) {
    category = 'clothes';
  } else if (/كهرباء|مياه|فاتورة|فوري|فودافون|أورنج|اتصالات|internet|wifi|bill/i.test(lowerAll)) {
    category = 'bills';
  }

  // 4. Tax / VAT detection
  let taxAmount: number | undefined = undefined;
  const taxMatch = normalized.match(/(?:ضريبة|الضريبة|vat|tax)\s*:?\s*([\d,]+\.?\d*)/i);
  if (taxMatch) {
    const parsedTax = parseFloat(taxMatch[1].replace(/,/g, ''));
    if (!isNaN(parsedTax)) taxAmount = parsedTax;
  }

  // 5. Items Extraction (simple line heuristic)
  const items: ReceiptItem[] = [];
  for (const line of lines) {
    const itemMatch = line.match(/^([^\d]+)\s+([\d,]+\.\d{1,2})$/);
    if (itemMatch) {
      items.push({
        name: itemMatch[1].trim(),
        price: parseFloat(itemMatch[2].replace(/,/g, '')),
      });
    }
  }

  return {
    merchantName,
    totalAmount,
    category,
    date: new Date().toISOString(),
    items,
    taxAmount,
    rawText: text,
    confidenceScore: totalAmount !== null ? 0.9 : 0.6,
  };
}

export const SAMPLE_RECEIPTS: ScannedReceipt[] = [
  {
    merchantName: 'سوبرماركت كارفور Carrefour',
    totalAmount: 345.50,
    category: 'food',
    date: new Date().toISOString(),
    items: [
      { name: 'حليب كامل الدسم', price: 45.00 },
      { name: 'جبنة شيدر 500جم', price: 120.50 },
      { name: 'خبز طازج', price: 30.00 },
      { name: 'عصير فواكه طبيعي', price: 150.00 }
    ],
    taxAmount: 42.00,
    paymentMethod: 'فيزا (Visa)',
    confidenceScore: 0.95,
  },
  {
    merchantName: 'محطة طاقة للوقود Taqa Gas',
    totalAmount: 250.00,
    category: 'transport',
    date: new Date().toISOString(),
    items: [
      { name: 'بنزين 95 (22 ليتر)', price: 250.00 }
    ],
    taxAmount: 30.00,
    paymentMethod: 'نقداً (Cash)',
    confidenceScore: 0.98,
  },
  {
    merchantName: 'صيدلية العزبي El Ezaby',
    totalAmount: 185.75,
    category: 'health',
    date: new Date().toISOString(),
    items: [
      { name: 'فيتامين C طوارئ', price: 85.00 },
      { name: 'مسكن ألم ومضاد التهاب', price: 100.75 }
    ],
    taxAmount: 22.00,
    paymentMethod: 'مستشار صحة (MasterCard)',
    confidenceScore: 0.92,
  },
  {
    merchantName: 'مطعم ومقهى ستاربكس Starbucks',
    totalAmount: 140.00,
    category: 'food',
    date: new Date().toISOString(),
    items: [
      { name: 'لاتيه كراميل كبير', price: 90.00 },
      { name: 'كيكة الشوكولاتة', price: 50.00 }
    ],
    taxAmount: 17.00,
    paymentMethod: 'Apple Pay',
    confidenceScore: 0.96,
  }
];

/**
 * Simulates AI OCR image scanning with smart heuristics & sample templates for demo/testing
 */
export async function scanReceiptImage(imageUri: string): Promise<ScannedReceipt> {
  // Simulate network/OCR latency
  await new Promise(res => setTimeout(res, 900));

  // Pick deterministic or realistic match based on image path hash or random fallback
  const idx = Math.abs(imageUri.length) % SAMPLE_RECEIPTS.length;
  return { ...SAMPLE_RECEIPTS[idx], date: new Date().toISOString() };
}
