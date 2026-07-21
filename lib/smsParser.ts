import { normalizeArabicNumbers } from './arabicNumbers';
import { expenseCategories, incomeCategories } from './categories';

export interface ParsedBankSMS {
  bankName: string;
  amount: number | null;
  currency: string;
  type: 'expense' | 'income';
  merchant: string;
  category: string; // Category ID
  cardNumber?: string;
  date?: string;
  rawText: string;
  confidenceScore: number; // 0 to 1
}

// Known Merchants map to categories
const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  // Supermarkets & Food
  carrefour: 'food',
  كارفور: 'food',
  panda: 'food',
  بندة: 'food',
  spinneys: 'food',
  سبينيس: 'food',
  lulu: 'food',
  لولو: 'food',
  metro: 'food',
  مترو: 'food',
  kazyon: 'food',
  كازيون: 'food',
  seoudi: 'food',
  سعودي: 'food',
  bimilano: 'food',
  starbucks: 'food',
  ستاربكس: 'food',
  costa: 'food',
  كاستا: 'food',
  mcdonalds: 'food',
  "mcdonald's": 'food',
  ماكدونالدز: 'food',
  kfc: 'food',
  كنتاكي: 'food',
  pizza: 'food',
  بيتزا: 'food',
  burger: 'food',
  برجر: 'food',

  // Transport & Gas
  shell: 'transport',
  شيل: 'transport',
  chillout: 'transport',
  تشيل_أوت: 'transport',
  chill_out: 'transport',
  taqa: 'transport',
  طاقة: 'transport',
  total: 'transport',
  توتال: 'transport',
  mobil: 'transport',
  موبيل: 'transport',
  uber: 'transport',
  أوبر: 'transport',
  اوبر: 'transport',
  careem: 'transport',
  كريم: 'transport',
  swvl: 'transport',
  سويفل: 'transport',
  indrive: 'transport',
  إندرايف: 'transport',

  // Bills & Telecom
  fawry: 'bills',
  فوري: 'bills',
  vodafone: 'phone',
  فودافون: 'phone',
  orange: 'phone',
  أورنج: 'phone',
  اورنج: 'phone',
  etisalat: 'phone',
  اتصالات: 'phone',
  we: 'bills',
  وي: 'bills',
  electricity: 'bills',
  كهرباء: 'bills',
  water: 'bills',
  مياه: 'bills',
  gas: 'bills',
  غاز: 'bills',

  // Shopping & Tech
  amazon: 'shopping',
  أمازون: 'shopping',
  امازون: 'shopping',
  noon: 'shopping',
  نون: 'shopping',
  btech: 'shopping',
  "b.tech": 'shopping',
  بي_تك: 'shopping',
  zara: 'clothes',
  زارا: 'clothes',
  hm: 'clothes',
  "h&m": 'clothes',
  'أتش اند ام': 'clothes',
  jumia: 'shopping',
  جوميا: 'shopping',

  // Health
  elezaby: 'health',
  العزبي: 'health',
  seif: 'health',
  سيف: 'health',
  delmar: 'health',
  دلمار: 'health',
  roshdy: 'health',
  رشدي: 'health',
  pharmacy: 'health',
  صيدلية: 'health',

  // Entertainment
  netflix: 'entertainment',
  نتفليكس: 'entertainment',
  spotify: 'entertainment',
  سبوتيفاي: 'entertainment',
  anghami: 'entertainment',
  أنغامي: 'entertainment',
  vox: 'entertainment',
  فوكس: 'entertainment',
  cinema: 'entertainment',
  سينما: 'entertainment',
};

// Known Bank Identification Patterns
const BANK_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'CIB', regex: /CIB|البنك التجاري الدولي/i },
  { name: 'البنك الأهلي المصري', regex: /NBE|البنك الأهلي المصري|Ahli/i },
  { name: 'بنك مصر', regex: /Banque Misr|بنك مصر/i },
  { name: 'QNB', regex: /QNB|كيو إن بي/i },
  { name: 'InstaPay', regex: /InstaPay|انستاباي|انستا باي/i },
  { name: 'فوري', regex: /Fawry|فوري/i },
  { name: 'فودافون كاش', regex: /Vodafone Cash|فودافون كاش/i },
  { name: 'مصرف الراجحي', regex: /Al Rajhi|الراجحي/i },
  { name: 'SNB البنك الأهلي', regex: /SNB|الأهلي السعودي/i },
  { name: 'بنك الإسكندرية', regex: /AlexBank|بنك الاسكندرية|بنك الإسكندرية/i },
  { name: 'Emirates NBD', regex: /Emirates NBD|الإمارات دبي الوطني/i },
  { name: 'بنك القاهرة', regex: /Banque du Caire|بنك القاهرة/i },
  { name: 'HSBC', regex: /HSBC/i },
];

/**
 * Main Bank SMS Parser Function
 */
export function parseBankSMS(text: string): ParsedBankSMS | null {
  if (!text || text.trim().length < 5) return null;

  const normalizedText = normalizeArabicNumbers(text);
  const lowerText = normalizedText.toLowerCase();

  // 1. Identify Bank
  let detectedBank = 'بنك / محفظة';
  for (const b of BANK_PATTERNS) {
    if (b.regex.test(normalizedText)) {
      detectedBank = b.name;
      break;
    }
  }

  // 2. Identify Transaction Type (Expense vs Income)
  const isIncomeKeywords = [
    'إيداع', 'تحويل إليك', 'تم استقبال', 'استلام', 'وارد', 'credit', 'credited', 'received', 'deposit', 'refund', 'مرتجع', 'اضافة', 'إضافة'
  ];
  const isIncome = isIncomeKeywords.some(kw => lowerText.includes(kw));
  const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

  // 3. Extract Amount & Currency
  let amount: number | null = null;
  let currency = 'EGP';

  // Currency detection
  if (/kwd|د\.ك|دينار/i.test(normalizedText)) currency = 'KWD';
  else if (/sar|ر\.س|ريال/i.test(normalizedText)) currency = 'SAR';
  else if (/usd|\$|دولار/i.test(normalizedText)) currency = 'USD';
  else if (/aed|د\.إ|درهم/i.test(normalizedText)) currency = 'AED';
  else if (/eur|€|يورو/i.test(normalizedText)) currency = 'EUR';
  else currency = 'EGP';

  // Amount extraction regexes
  const amountRegexes = [
    // EGP 150.50 or 150.50 EGP or 150.50ج.م
    /(?:EGP|KWD|SAR|USD|AED|EUR|ج\.م|ر\.س|د\.ك|جنيه|ريال|دينار|\$)\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s*(?:EGP|KWD|SAR|USD|AED|EUR|ج\.م|ر\.س|د\.ك|جنيه|ريال|دينار|\$)/i,
    /(?:مبلغ|بقيمة|بمبلغ|amount|sum)\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s*(?:LE|L\.E|SR)/i,
  ];

  for (const regex of amountRegexes) {
    const match = normalizedText.match(regex);
    if (match) {
      const valStr = (match[1] || match[2]).replace(/,/g, '');
      const parsed = parseFloat(valStr);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }

  // Fallback standalone number if amount pattern failed
  if (amount === null) {
    const fallbackMatch = normalizedText.match(/(\d+\.?\d*)/);
    if (fallbackMatch) {
      const parsed = parseFloat(fallbackMatch[0]);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
      }
    }
  }

  // 4. Extract Merchant Name
  let merchant = '';
  const merchantRegexes = [
    /لدى\s+([^\n\r,.]+)/i,
    /at\s+([^\n\r,.]+?)(?=\s+(?:on|date|card|available|ref|balance|val|LE|EGP|\.|$))/i,
    /from\s+([^\n\r,.]+?)(?=\s+(?:on|date|card|available|ref|balance|\.|$))/i,
    /إلى\s+([^\n\r,.]+)/i,
    /لـ\s+([^\n\r,.]+)/i,
    /to\s+([^\n\r,.]+?)(?=\s+(?:on|date|card|\.|$))/i,
  ];

  for (const regex of merchantRegexes) {
    const match = normalizedText.match(regex);
    if (match && match[1]) {
      merchant = match[1].trim();
      // Clean up common filler words
      merchant = merchant.replace(/^(the|a|an|محل|متجر|فرع)\s+/i, '');
      break;
    }
  }

  if (!merchant) {
    merchant = detectedBank !== 'بنك / محفظة' ? detectedBank : (type === 'expense' ? 'مشتريات' : 'إيداع/تحويل');
  }

  // 5. Match Category based on Merchant or Text
  let category = type === 'expense' ? 'other' : 'other';
  const cleanMerchantLower = merchant.toLowerCase();

  // Search merchant map first
  for (const [key, catId] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (cleanMerchantLower.includes(key) || lowerText.includes(key)) {
      category = catId;
      break;
    }
  }

  // Search category name keywords if no match
  if (category === 'other') {
    if (type === 'expense') {
      for (const cat of expenseCategories) {
        if (cat.keywords && cat.keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
          category = cat.id;
          break;
        }
      }
    } else {
      for (const cat of incomeCategories) {
        if (cat.keywords && cat.keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
          category = cat.id;
          break;
        }
      }
    }
  }

  // 6. Extract Card Number (Last 4 digits)
  let cardNumber: string | undefined = undefined;
  const cardMatch = normalizedText.match(/(?:card|كارت|بطاقة|account|حساب)\s*(?:\*\*\*|X+|x+|\*+)?(\d{4})/i) ||
                    normalizedText.match(/\*{3,}(\d{4})/);
  if (cardMatch) {
    cardNumber = cardMatch[1];
  }

  // Confidence Score Calculation
  let confidenceScore = 0.5;
  if (amount !== null) confidenceScore += 0.3;
  if (detectedBank !== 'بنك / محفظة') confidenceScore += 0.1;
  if (category !== 'other') confidenceScore += 0.1;

  return {
    bankName: detectedBank,
    amount,
    currency,
    type,
    merchant,
    category,
    cardNumber,
    rawText: text,
    confidenceScore: Math.min(confidenceScore, 1.0),
  };
}
