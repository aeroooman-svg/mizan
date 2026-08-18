import { normalizeArabicNumbers } from './arabicNumbers';
import { Wallet } from './storage';
import { Category, expenseCategories, incomeCategories } from './categories';

export interface ParsedTransaction {
  amount: number | null;
  type: 'income' | 'expense' | 'transfer';
  category: string; // id
  description: string;
  walletId: string | null;
  toWalletId?: string | null;
}

// Map of single Arabic number words to values
const BASIC_ARABIC_NUMBERS: Record<string, number> = {
  'صفر': 0,
  'واحد': 1,
  'واحدة': 1,
  'واحده': 1,
  'اثنان': 2,
  'اثنين': 2,
  'اتنين': 2,
  'اثنتان': 2,
  'ثلاثة': 3,
  'ثلاث': 3,
  'تلاتة': 3,
  'تلات': 3,
  'اربعة': 4,
  'اربع': 4,
  'خمسة': 5,
  'خمس': 5,
  'ستة': 6,
  'ست': 6,
  'سبعة': 7,
  'سبع': 7,
  'ثمانية': 8,
  'ثمان': 8,
  'تمنية': 8,
  'تمن': 8,
  'تسعة': 9,
  'تسع': 9,
  'عشرة': 10,
  'عشر': 10,
  'احد عشر': 11,
  'احداعش': 11,
  'اثنا عشر': 12,
  'اثناعش': 12,
  'ثلاثة عشر': 13,
  'ثلطاش': 13,
  'اربعة عشر': 14,
  'اربعطاش': 14,
  'خمسة عشر': 15,
  'خمسطاش': 15,
  'ستة عشر': 16,
  'ستطاش': 16,
  'سبعة عشر': 17,
  'سبعطاش': 17,
  'ثمانية عشر': 18,
  'تمنطاش': 18,
  'تسعة عشر': 19,
  'تسعطاش': 19,
  'عشرين': 20,
  'عشرون': 20,
  'ثلاثين': 30,
  'ثلاثون': 30,
  'تلاتين': 30,
  'اربعين': 40,
  'اربعون': 40,
  'خمسين': 50,
  'خمسون': 50,
  'ستين': 60,
  'ستون': 60,
  'سبعين': 70,
  'سبعون': 70,
  'ثمانين': 80,
  'ثمانون': 80,
  'تمانين': 80,
  'تسعين': 90,
  'تسعون': 90,
  'مائة': 100,
  'مائه': 100,
  'مية': 100,
  'ميه': 100,
  'مئتان': 200,
  'مئتين': 200,
  'ميتين': 200,
  'ثلاثمائة': 300,
  'تلتمية': 300,
  'اربعمائة': 400,
  'اربعمية': 400,
  'خمسمائة': 500,
  'خمسمية': 500,
  'ستمائة': 600,
  'ستمية': 600,
  'سبعمائة': 700,
  'سبعمية': 700,
  'ثمانمائة': 800,
  'تمنمية': 800,
  'تسعمائة': 900,
  'تسعمية': 900,
  'الف': 1000,
  'ألف': 1000,
  'الفين': 2000,
  'ألفين': 2000,
  'الاف': 1000,
  'آلاف': 1000,
  'مليون': 1000000,
  'مليونين': 2000000,
  'ملايين': 1000000,
};

// Spoken fractions
const ARABIC_FRACTIONS: Record<string, number> = {
  'نصف': 0.5,
  'نص': 0.5,
  'ربع': 0.25,
  'اربع': 0.25,
  'ثلث': 0.333,
  'تلت': 0.333,
  'تلات ارباع': 0.75,
  'ثلاثة ارباع': 0.75,
};

// Spoken currency units (singular = 1, dual = 2)
const CURRENCY_UNIT_VALUES: Record<string, number> = {
  'دينار': 1,
  'دينارين': 2,
  'ديناران': 2,
  'جنيه': 1,
  'جنيهين': 2,
  'جنيهان': 2,
  'ريال': 1,
  'ريالين': 2,
  'ريالان': 2,
  'درهم': 1,
  'درهمين': 2,
  'درهمان': 2,
  'دولار': 1,
  'دولارين': 2,
  'دولاران': 2,
  'يورو': 1,
  'يوروين': 2,
};

// Normalized maps for resilient matching with cleanArabicText
const NORMALIZED_BASIC_NUMBERS: Record<string, number> = {};
for (const [k, v] of Object.entries(BASIC_ARABIC_NUMBERS)) {
  NORMALIZED_BASIC_NUMBERS[cleanArabicText(k)] = v;
  NORMALIZED_BASIC_NUMBERS[k] = v;
}

const NORMALIZED_FRACTIONS: Record<string, number> = {};
for (const [k, v] of Object.entries(ARABIC_FRACTIONS)) {
  NORMALIZED_FRACTIONS[cleanArabicText(k)] = v;
  NORMALIZED_FRACTIONS[k] = v;
}

const NORMALIZED_CURRENCIES: Record<string, number> = {};
for (const [k, v] of Object.entries(CURRENCY_UNIT_VALUES)) {
  NORMALIZED_CURRENCIES[cleanArabicText(k)] = v;
  NORMALIZED_CURRENCIES[k] = v;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    'اكل', 'شرب', 'طعام', 'شاي', 'قهوه', 'قهوة', 'مطبخ', 'سوبرماركت', 'خضار', 'فاكهه', 'فاكهة',
    'لحمه', 'لحمة', 'فراخ', 'دجاج', 'مطعم', 'غدا', 'عشا', 'فطار', 'دليفري', 'كافيه', 'مكندونالدز',
    'ماكدونالدز', 'كنتاكي', 'بيتزا', 'كريب', 'حلو', 'حلويات', 'شوكولاته', 'مياه', 'بقاله', 'بقالة',
    'food', 'restaurant', 'cafe', 'grocery', 'groceries', 'dinner', 'breakfast', 'lunch', 'eat', 'drink', 'pizza', 'starbucks',
    'mcdonalds', 'mcdonald', "mcdonald's", 'مترو ماركت', 'ماركت', 'market', 'سوبر ماركت', 'كارفور', 'carrefour',
    'شطه', 'شطة', 'مشاوي', 'شاورما', 'برجر', 'فلافل', 'طعمية', 'عصير', 'عصائر', 'حلواني', 'وجبة', 'وجبه'
  ],
  transport: [
    'مواصلات', 'تاكسي', 'اوبر', 'سويفل', 'مترو', 'بنزين', 'تذكره', 'تذكرة', 'اتوبيس', 'سفر', 'باص',
    'توصيله', 'توصيلة', 'كار', 'car', 'taxi', 'uber', 'gas', 'petrol', 'metro', 'bus', 'transport', 'flight', 'oil',
    'كريم', 'careem', 'ديدي', 'didi', 'انريف', 'indrive', 'قطار', 'طيران', 'مواقف'
  ],
  bills: [
    'فاتوره', 'فاتورة', 'فواتير', 'كهرباء', 'كهربا', 'مياه', 'ميه', 'غاز', 'غاز_منزلي', 'انترنت', 'نت', 'وي',
    'تليفون ارضي', 'تليفون أرضي', 'اشتراك', 'اشتراكات', 'شحن_نت', 'bills', 'bill', 'electricity', 'water', 'internet', 'net', 'wifi', 'subscription',
    'صيانة', 'بلدية', 'ايجار', 'قسط'
  ],
  shopping: [
    'تسوق', 'شوبينج', 'شوبنج', 'سوبر ماركت كبير', 'امازون', 'نون', 'مول', 'سوبرماركت_كبير', 'مشتريات',
    'اغراض', 'أغراض', 'سوبر ماركت', 'shopping', 'amazon', 'noon', 'mall', 'buy', 'purchase', 'اكسسوارات', 'الكترونيات'
  ],
  health: [
    'دوا', 'دواء', 'ادوية', 'أدوية', 'صيدليه', 'صيدلية', 'دكتور', 'طبيب', 'كشف', 'تحليل', 'تحاليل',
    'اشعه', 'أشعة', 'مستشفي', 'مستشفى', 'علاج', 'سنان', 'اسنان', 'أعصاب', 'health', 'medicine', 'pharmacy', 'doctor', 'hospital', 'clinic', 'dentist', 'ill',
    'نظارة', 'عيادة', 'فحص'
  ],
  education: [
    'تعليم', 'مدرسه', 'مدرسة', 'كليه', 'كلية', 'جامعه', 'جامعة', 'كتاب', 'كتب', 'حصه', 'حصة', 'درس', 'دروس',
    'كورس', 'كورسات', 'محاضره', 'محاضرة', 'امتحان', 'education', 'school', 'college', 'university', 'course', 'book', 'books', 'ملازم', 'قرطاسية'
  ],
  entertainment: [
    'ترفيه', 'خروجه', 'خروجة', 'سينما', 'رحلة', 'رحله', 'لعبة', 'العاب', 'ألعاب', 'سفرية', 'سفريه', 'مصيف',
    'بحر', 'بلايستيشن', 'نتفليكس', 'فسحة', 'فسحه', 'العاب_فيديو', 'entertainment', 'cinema', 'movie', 'game', 'netflix', 'fun', 'trip', 'ملاهي'
  ],
  rent: [
    'ايجار', 'إيجار', 'شقه', 'شقة', 'سكن', 'rent', 'flat'
  ],
  phone: [
    'موبايل', 'رصيد', 'شحن', 'اتصالات', 'فودافون', 'اورنج', 'وي رصيد', 'شحن_رصيد', 'شريحة', 'شريحه', 'phone', 'mobile', 'credit', 'vodafone', 'orange', 'recharge', 'زين', 'stc', 'zain', 'ooredoo', 'اوريدو'
  ],
  clothes: [
    'ملابس', 'لبس', 'هدوم', 'بدله', 'بدلة', 'قميص', 'بنطلون', 'فستان', 'جزمة', 'حذاء', 'clothes', 'tshirt', 'shoes', 'dress', 'jacket'
  ],
  salary: [
    'مرتب', 'راتب', 'شهري', 'المرتب', 'الراتب', 'سالياري', 'salary', 'wage', 'paycheck', 'معاش'
  ],
  freelance: [
    'عمل حر', 'فري لانس', 'فريلانس', 'مشروع جانبي', 'عميل', 'تصميم', 'برمجة', 'كتابة', 'freelance', 'client', 'gig'
  ],
  investment: [
    'استثمار', 'بورصة', 'اسهم', 'أسهم', 'ذهب', 'ربح استثماري', 'فوائد', 'ارباح', 'أرباح', 'investment', 'stock', 'crypto', 'gold', 'profit'
  ],
  gift: [
    'هديه', 'هدية', 'عيدية', 'عيديه', 'gift', 'present'
  ],
  bonus: [
    'مكافاه', 'مكافأة', 'بونص', 'ارباح سنوية', 'أرباح سنوية', 'bonus'
  ]
};

// Normalize text helper
export function cleanArabicText(text: string): string {
  let cleaned = text.toLowerCase();
  // Normalize arabic characters: ة -> ه, أ/إ/آ -> ا, ى -> ي
  cleaned = cleaned.replace(/[أإآ]/g, 'ا');
  cleaned = cleaned.replace(/ة/g, 'ه');
  cleaned = cleaned.replace(/ى/g, 'ي');
  cleaned = cleaned.replace(/[\u064B-\u065F]/g, ''); // Remove harakat / diacritics
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

export interface SmsPattern {
  name: string;
  regex: RegExp;
  handler: (match: RegExpExecArray) => {
    amount: number;
    type: 'income' | 'expense';
    description: string;
    walletKeywords: string[];
    categoryHint?: string;
  };
}

function cleanDescription(desc: string): string {
  let cleaned = desc.trim();
  cleaned = cleaned.replace(/\s+(?:في|بتاريخ|بتاريخ\s+\d+\/\d+|\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}|\d{2}\/\d{2}).*$/i, '');
  cleaned = cleaned.replace(/\s+at\s+\d{2}:\d{2}.*$/i, '');
  cleaned = cleaned.replace(/\s+on\s+\d{2}\/\d{2}.*$/i, '');
  cleaned = cleaned.replace(/\s+value\s+date.*$/i, '');
  return cleaned.trim();
}

export const SMS_PATTERNS: SmsPattern[] = [
  // 1. InstaPay Arabic Transfer Out
  {
    name: 'instapay_ar_transfer_out',
    regex: /تمت\s+عملية\s+تحويل\s+بنجاح\s+(?:من\s+حسابك\s+)?بقيمة\s+([\d,.]+)\s*(?:ج\.م|جم|EGP|د\.ك|KWD|USD|\$)\s+إلى\s+([^.\n]+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'expense',
      description: cleanDescription(`تحويل إلى ${match[2].trim()}`),
      walletKeywords: ['انستاباي', 'instapay', 'بنك', 'حساب']
    })
  },
  // 2. InstaPay Arabic Deposit In
  {
    name: 'instapay_ar_deposit_in',
    regex: /تم\s+استقبال\s+تحويل\s+بقيمة\s+([\d,.]+)\s*(?:ج\.م|جم|EGP|د\.ك|KWD|USD|\$)\s+(?:على\s+حسابك\s+)?(?:في\s+[^.\n]+)?\s+من\s+([^.\n]+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'income',
      description: cleanDescription(`تحويل من ${match[2].trim()}`),
      walletKeywords: ['انستاباي', 'instapay', 'بنك', 'حساب']
    })
  },
  // 3. InstaPay English Transfer Out
  {
    name: 'instapay_en_transfer_out',
    regex: /successful\s+transfer\s+of\s+(?:EGP|USD|KWD|SAR|AED|ج\.م|جم)\s*([\d,.]+)\s+(?:from\s+your\s+account\s+)?to\s+([^.\n]+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'expense',
      description: cleanDescription(`Transfer to ${match[2].trim()}`),
      walletKeywords: ['instapay', 'انستاباي', 'bank', 'account']
    })
  },
  // 4. InstaPay English Deposit In
  {
    name: 'instapay_en_deposit_in',
    regex: /successful\s+deposit\s+of\s+(?:EGP|USD|KWD|SAR|AED|ج\.م|جم)\s*([\d,.]+)\s+(?:to\s+your\s+account\s+)?from\s+([^.\n]+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'income',
      description: cleanDescription(`Deposit from ${match[2].trim()}`),
      walletKeywords: ['instapay', 'انستاباي', 'bank', 'account']
    })
  },
  // 5. CIB Arabic Purchase
  {
    name: 'cib_ar_purchase',
    regex: /تمت\s+عملية\s+شراء\s+بقيمة\s+([\d,.]+)\s*(?:ج\.م|جم|EGP)\s+من\s+بطاقتك\s+رقم\s+\d+\s+لدى\s+([^.\n]+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'expense',
      description: cleanDescription(match[2]),
      walletKeywords: ['cib', 'التجاري الدولي', 'كريديت', 'فيزا', 'visa']
    })
  },
  // 6. CIB English Purchase
  {
    name: 'cib_en_purchase',
    regex: /purchase\s+of\s+(?:EGP|USD|EUR)\s*([\d,.]+)\s+was\s+done\s+on\s+card\s+\d+\s+at\s+([^.\n]+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'expense',
      description: cleanDescription(match[2]),
      walletKeywords: ['cib', 'credit', 'visa', 'card']
    })
  },
  // 7. Banque Misr Arabic Purchase
  {
    name: 'misr_ar_purchase',
    regex: /عملية\s+شراء\s+بمبلغ\s+([\d,.]+)\s*(?:ج\.م|جم|EGP)\s+من\s+بطاقتك\s+رقم\s+.*?\s+لدى\s+([^.\n]+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'expense',
      description: cleanDescription(match[2]),
      walletKeywords: ['مصر', 'misr', 'بنك مصر']
    })
  },
  // 8. NBE Arabic Purchase (البنك الأهلي)
  {
    name: 'nbe_ar_purchase',
    regex: /خصم\s+مبلغ\s+([\d,.]+)\s*(?:جم|ج\.م|EGP)\s+من\s+بطاقتك\s+رقم\s+.*?\s+في\s+([^.\n]+?)(?:\s+بتاريخ|\.|$)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'expense',
      description: cleanDescription(match[2]),
      walletKeywords: ['الاهلي', 'nbe', 'ahli', 'national bank']
    })
  },
  // 9. NBE English Purchase
  {
    name: 'nbe_en_purchase',
    regex: /debit\s+transaction\s+of\s+(?:EGP|USD)\s*([\d,.]+)\s+on\s+card\s+.*?\s+at\s+([^.\n]+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'expense',
      description: cleanDescription(match[2]),
      walletKeywords: ['nbe', 'ahli', 'national bank', 'الاهلي']
    })
  },
  // 10. Vodafone Cash Transfer Out (Arabic)
  {
    name: 'vfcash_ar_transfer',
    regex: /تم\s+تحويل\s+([\d,.]+)\s*جنيه\s+لـ\s*(\d+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'expense',
      description: `تحويل فودافون كاش لـ ${match[2]}`,
      walletKeywords: ['فودافون', 'vodafone', 'كاش', 'cash']
    })
  },
  // 11. Vodafone Cash Receive (Arabic)
  {
    name: 'vfcash_ar_receive',
    regex: /تم\s+استقبال\s+([\d,.]+)\s*جنيه\s+من\s*(\d+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'income',
      description: `استقبال فودافون كاش من ${match[2]}`,
      walletKeywords: ['فودافون', 'vodafone', 'كاش', 'cash']
    })
  },
  // 12. Gulf / Kuwaiti / Saudi / UAE Bank Purchase
  {
    name: 'gulf_pos_purchase',
    regex: /(?:شراء|عملية\s+شراء|خصم|دفع|POS\s+Purchase|Purchase)\s*(?:بقيمة|بمبلغ|of)?\s*([A-Z]{3}|د\.ك|ر\.س|د\.إ|ج\.م)?\s*([\d,.]+)\s*([A-Z]{3}|د\.ك|ر\.س|د\.إ|ج\.م)?\s*(?:لدى|في|من|at)\s+([^.\n]+)/i,
    handler: (match) => {
      const amtStr = match[2];
      const merchant = match[4] || '';
      return {
        amount: parseFloat(amtStr.replace(/,/g, '')),
        type: 'expense',
        description: cleanDescription(merchant),
        walletKeywords: ['بنك', 'bank', 'knet', 'كي نت', 'فيزا', 'ماستركارد', 'بطاقة']
      };
    }
  }
];

export function matchCategoryFromText(
  text: string,
  type: 'income' | 'expense',
  customCategories: Category[] = []
): string {
  const cleaned = cleanArabicText(text);
  let category = type === 'income' ? 'other_income' : 'other_expense';
  let bestMatchScore = 0;

  const allCategories = [...expenseCategories, ...incomeCategories, ...customCategories];
  for (const cat of allCategories) {
    const keywords = CATEGORY_KEYWORDS[cat.id] || [];
    const names = [cat.name, cat.nameAr];
    const catWords = [...keywords, ...names].map(cleanArabicText);

    for (const keyword of catWords) {
      if (!keyword) continue;
      if (cleaned.includes(keyword)) {
        if (keyword.length > bestMatchScore) {
          category = cat.id;
          bestMatchScore = keyword.length;
        }
      }
    }
  }
  return category;
}

export function parseBankSMS(
  text: string,
  wallets: Wallet[],
  customCategories: Category[] = []
): ParsedTransaction | null {
  const normalized = normalizeArabicNumbers(text);
  const cleaned = cleanArabicText(normalized);

  for (const pattern of SMS_PATTERNS) {
    const match = pattern.regex.exec(normalized) || pattern.regex.exec(text);
    if (match) {
      const result = pattern.handler(match);
      
      // Select best wallet
      let walletId: string | null = null;
      if (wallets.length > 0) {
        let bestWalletScore = 0;
        
        for (const kw of result.walletKeywords) {
          const kwClean = cleanArabicText(kw);
          for (const wallet of wallets) {
            const walletNameClean = cleanArabicText(wallet.name);
            if (walletNameClean.includes(kwClean) || kwClean.includes(walletNameClean)) {
              const score = walletNameClean.length;
              if (score > bestWalletScore) {
                walletId = wallet.id;
                bestWalletScore = score;
              }
            }
          }
        }

        if (!walletId) {
          for (const wallet of wallets) {
            const walletNameClean = cleanArabicText(wallet.name);
            if (cleaned.includes(walletNameClean)) {
              if (walletNameClean.length > bestWalletScore) {
                walletId = wallet.id;
                bestWalletScore = walletNameClean.length;
              }
            }
          }
        }
      }

      const category = matchCategoryFromText(result.description, result.type, customCategories);

      return {
        amount: result.amount,
        type: result.type,
        category,
        description: result.description,
        walletId
      };
    }
  }

  return null;
}

/**
 * Parses spoken or written Arabic numbers and amounts.
 * Examples:
 * - "دينار و" -> 1.0
 * - "دينار ونص" -> 1.5
 * - "دينارين وربع" -> 2.25
 * - "دينارين" -> 2.0
 * - "٥٠٠ فلس" -> 0.500
 * - "٢٥٠ فلس" -> 0.250
 * - "خمسة وعشرين دينار" -> 25
 * - "مية وخمسين جنيه" -> 150
 * - "ألفين" -> 2000
 * - "1.500" -> 1.5
 */
export function extractArabicAmount(rawText: string): { amount: number | null; matchedPhrase: string } {
  const normalized = normalizeArabicNumbers(rawText);
  const cleaned = cleanArabicText(normalized);

  // 1. Check for specific fils subunit (e.g. "500 فلس", "250 فلس", "100 فلس")
  const filsMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*فلس/);
  if (filsMatch) {
    const filsVal = parseFloat(filsMatch[1]);
    return { amount: filsVal / 1000, matchedPhrase: filsMatch[0] };
  }

  // 2. Check for subunit "قرش" (e.g. "50 قرش")
  const qirshMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*قرش/);
  if (qirshMatch) {
    const qirshVal = parseFloat(qirshMatch[1]);
    return { amount: qirshVal / 100, matchedPhrase: qirshMatch[0] };
  }

  // 3. Check for standalone fractions with currency (e.g. "نص دينار", "نصف جنيه", "ربع ريال")
  const fractionBeforeCurrencyMatch = cleaned.match(/(نصف|نص|ربع|ثلث|تلت)\s*(دينار|جنيه|ريال|درهم|دولار|يورو)/);
  if (fractionBeforeCurrencyMatch) {
    const fracWord = fractionBeforeCurrencyMatch[1];
    const fracVal = NORMALIZED_FRACTIONS[fracWord] || 0.5;
    return { amount: fracVal, matchedPhrase: fractionBeforeCurrencyMatch[0] };
  }

  // 4. Check for currency + fraction combinations (e.g. "دينار ونص", "دينارين وربع", "جنيه ونص", "ريالين ونصف")
  const currencyAndFractionMatch = cleaned.match(/(دينارين|دينار|جنيهين|جنيه|ريالين|ريال|درهمين|درهم|دولارين|دولار|يوروين|يورو)\s*(?:و|\+)\s*(نصف|نص|ربع|ثلث|تلت)/);
  if (currencyAndFractionMatch) {
    const unitWord = currencyAndFractionMatch[1];
    const fracWord = currencyAndFractionMatch[2];
    const baseVal = NORMALIZED_CURRENCIES[unitWord] || 1;
    const fracVal = NORMALIZED_FRACTIONS[fracWord] || 0.5;
    return { amount: baseVal + fracVal, matchedPhrase: currencyAndFractionMatch[0] };
  }

  // 5. Check for digit + fraction (e.g. "5 ونص", "10 وربع", "3 ونصف")
  const digitAndFractionMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:و|\+)\s*(نصف|نص|ربع|ثلث|تلت)/);
  if (digitAndFractionMatch) {
    const baseVal = parseFloat(digitAndFractionMatch[1]);
    const fracWord = digitAndFractionMatch[2];
    const fracVal = NORMALIZED_FRACTIONS[fracWord] || 0.5;
    return { amount: baseVal + fracVal, matchedPhrase: digitAndFractionMatch[0] };
  }

  // 6. Check for number followed by currency or standard digit (e.g. "15.5", "100", "25 دينار", "45 جنيه")
  const digitMatch = normalized.match(/\b\d+(?:\.\d+)?\b/);
  if (digitMatch) {
    const parsedNum = parseFloat(digitMatch[0]);
    if (!isNaN(parsedNum) && parsedNum > 0) {
      return { amount: parsedNum, matchedPhrase: digitMatch[0] };
    }
  }

  // 7. Compound Arabic words processing (e.g., "خمسة وعشرين", "مية وخمسين", "الفين وثلاثمية", "ثلاثة الاف", "عشرة دنانير")
  const words = cleaned.split(/\s+/);
  let totalAmount = 0;
  let currentGroup = 0;
  let foundAnyWordNumber = false;
  let matchedWordList: string[] = [];

  for (let i = 0; i < words.length; i++) {
    let w = words[i].replace(/^و/, ''); // Strip leading 'و'
    if (NORMALIZED_BASIC_NUMBERS[w] !== undefined) {
      foundAnyWordNumber = true;
      matchedWordList.push(words[i]);
      const val = NORMALIZED_BASIC_NUMBERS[w];
      if (val >= 1000) {
        if (currentGroup === 0) currentGroup = 1;
        totalAmount += currentGroup * val;
        currentGroup = 0;
      } else {
        currentGroup += val;
      }
    } else if (NORMALIZED_FRACTIONS[w] !== undefined) {
      foundAnyWordNumber = true;
      matchedWordList.push(words[i]);
      currentGroup += NORMALIZED_FRACTIONS[w];
    }
  }

  totalAmount += currentGroup;

  if (foundAnyWordNumber && totalAmount > 0) {
    return { amount: totalAmount, matchedPhrase: matchedWordList.join(' ') };
  }

  // 8. Check for spoken currency unit words alone or with trailing 'و' (e.g. "دينار و", "دينارين", "جنيه", "ريالين", "دينار")
  const singleCurrencyMatch = cleaned.match(/(دينارين|دينار|جنيهين|جنيه|ريالين|ريال|درهمين|درهم|دولارين|دولار|يوروين|يورو)(?:\s+و)?/);
  if (singleCurrencyMatch) {
    const word = singleCurrencyMatch[1];
    if (NORMALIZED_CURRENCIES[word]) {
      return { amount: NORMALIZED_CURRENCIES[word], matchedPhrase: singleCurrencyMatch[0] };
    }
  }

  return { amount: null, matchedPhrase: '' };
}

export function parseTransactionText(
  text: string,
  wallets: Wallet[],
  customCategories: Category[] = []
): ParsedTransaction {
  // First attempt to parse as a banking SMS
  const smsParsed = parseBankSMS(text, wallets, customCategories);
  if (smsParsed) {
    return smsParsed;
  }

  const normalized = normalizeArabicNumbers(text);
  const cleaned = cleanArabicText(normalized);

  // 1. Extract Amount accurately
  const { amount, matchedPhrase } = extractArabicAmount(normalized);

  // 2. Extract Type (Expense vs Income vs Transfer)
  let type: 'income' | 'expense' | 'transfer' = 'expense';
  const transferIndicators = ['تحويل', 'حول', 'نقل', 'تحويلات', 'transfer', 'move', 'حولت', 'نقلت'];
  const incomeIndicators = [
    'قبضت', 'جالي', 'مرتب', 'راتب', 'دخل', 'ربح', 'مكسب', 'هديه', 'هدية', 'بونص', 'مكافاه', 'مكافأة',
    'salary', 'income', 'bonus', 'gift', 'freelance', 'received', 'earned', 'deposit', 'استلمت', 'ايداع'
  ];
  
  const cleanedTransfer = transferIndicators.map(cleanArabicText);
  if (cleanedTransfer.some(ind => cleaned.includes(ind))) {
    type = 'transfer';
  } else {
    const cleanedIncome = incomeIndicators.map(cleanArabicText);
    for (const ind of cleanedIncome) {
      if (cleaned.includes(ind)) {
        type = 'income';
        break;
      }
    }
  }

  // 3. Extract Category
  const category = type === 'transfer' ? 'transfer' : matchCategoryFromText(text, type, customCategories);

  // 4. Extract Wallet & Target Wallet
  let walletId: string | null = null;
  let toWalletId: string | null = null;

  function findWalletMatch(textClean: string, wallet: Wallet): { found: boolean; index: number; score: number } {
    const wNameClean = cleanArabicText(wallet.name);
    const exactIdx = textClean.indexOf(wNameClean);
    if (exactIdx !== -1) {
      return { found: true, index: exactIdx, score: wNameClean.length };
    }
    const tokens = wallet.name.split(/[\s\-()]+/).map(cleanArabicText).filter(t => t.length >= 3);
    let bestScore = 0;
    let bestIdx = -1;
    for (const tok of tokens) {
      const tokIdx = textClean.indexOf(tok);
      if (tokIdx !== -1 && tok.length > bestScore) {
        bestScore = tok.length;
        bestIdx = tokIdx;
      }
    }
    if (bestIdx !== -1) {
      return { found: true, index: bestIdx, score: bestScore };
    }
    return { found: false, index: -1, score: 0 };
  }

  if (wallets.length > 0) {
    if (type === 'transfer') {
      const matchedWallets: { wallet: Wallet; index: number }[] = [];
      for (const wallet of wallets) {
        const matchRes = findWalletMatch(cleaned, wallet);
        if (matchRes.found) {
          matchedWallets.push({ wallet, index: matchRes.index });
        }
      }
      matchedWallets.sort((a, b) => a.index - b.index);
      if (matchedWallets.length >= 2) {
        walletId = matchedWallets[0].wallet.id;
        toWalletId = matchedWallets[1].wallet.id;
      } else if (matchedWallets.length === 1) {
        walletId = matchedWallets[0].wallet.id;
      }
    } else {
      let bestWalletScore = 0;
      for (const wallet of wallets) {
        const matchRes = findWalletMatch(cleaned, wallet);
        if (matchRes.found && matchRes.score > bestWalletScore) {
          walletId = wallet.id;
          bestWalletScore = matchRes.score;
        }
      }
      if (!walletId) {
        if (cleaned.includes('كاش') || cleaned.includes('نقدي') || cleaned.includes('كش') || cleaned.includes('cash')) {
          const cashWallet = wallets.find(w => cleanArabicText(w.name).includes('كاش') || cleanArabicText(w.name).includes('cash') || cleanArabicText(w.name).includes('نقد'));
          if (cashWallet) walletId = cashWallet.id;
        } else if (cleaned.includes('بنك') || cleaned.includes('فيزا') || cleaned.includes('حساب') || cleaned.includes('bank') || cleaned.includes('card') || cleaned.includes('visa')) {
          const bankWallet = wallets.find(w => cleanArabicText(w.name).includes('بنك') || cleanArabicText(w.name).includes('bank') || cleanArabicText(w.name).includes('فيزا') || cleanArabicText(w.name).includes('بطاقة'));
          if (bankWallet) walletId = bankWallet.id;
        }
      }
    }
  }

  // 5. Clean and Extract Description
  let description = text.trim();
  
  // Remove matched amount digits / phrase
  if (amount !== null) {
    if (matchedPhrase) {
      description = description.replace(new RegExp(matchedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }
    description = description.replace(new RegExp(amount.toString(), 'g'), '');
  }

  // Remove common action keywords from description
  const noiseWords = [
    'مصاريف', 'مصروف', 'صرفت', 'دفعت', 'اشتريت', 'شراء', 'حق', 'حساب', 'دفع', 'سداد', 'فاتورة', 'فاتوره',
    'من الكاش', 'من كاش', 'من البنك', 'من المحفظة', 'كاش', 'cash', 'دينار', 'دينارين', 'دنانير', 'جنيه', 'جنيهين',
    'ريال', 'ريالين', 'درهم', 'درهمين', 'دولار', 'دولارين', 'د.ك', 'ج.م', 'ر.س', 'د.إ', 'EGP', 'KWD', 'SAR', 'USD',
    'فلس', 'قرش', 'و'
  ];

  let descWords = description.split(/\s+/).filter(w => {
    const cleanW = cleanArabicText(w);
    return !noiseWords.includes(cleanW) && cleanW.length > 0;
  });

  let cleanDesc = descWords.join(' ').trim();
  if (!cleanDesc) {
    // If stripped everything, fallback to original text
    cleanDesc = text.trim();
  }

  return {
    amount,
    type,
    category,
    description: cleanDesc,
    walletId,
    toWalletId: toWalletId || undefined
  };
}
