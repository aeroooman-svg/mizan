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

// Map of words to Arabic numbers text
const ARABIC_WORD_NUMBERS: Record<string, number> = {
  'واحد': 1,
  'اثنان': 2,
  'اثنين': 2,
  'ثلاثة': 3,
  'ثلاث': 3,
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
  'تسعة': 9,
  'تسع': 9,
  'عشرة': 10,
  'عشر': 10,
  'عشرين': 20,
  'ثلاثين': 30,
  'اربعين': 40,
  'خمسين': 50,
  'ستين': 60,
  'سبعين': 70,
  'ثمانين': 80,
  'تسعين': 90,
  'مائة': 100,
  'ميه': 100,
  'مئتين': 200,
  'ميتين': 200,
  'الف': 1000,
  'الاف': 1000,
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    'اكل', 'شرب', 'طعام', 'شاي', 'قهوه', 'قهوة', 'مطبخ', 'سوبرماركت', 'خضار', 'فاكهه', 'فاكهة',
    'لحمه', 'لحمة', 'فراخ', 'دجاج', 'مطعم', 'غدا', 'عشا', 'فطار', 'دليفري', 'كافيه', 'مكندونالدز',
    'ماكدونالدز', 'كنتاكي', 'بيتزا', 'كريب', 'حلو', 'حلويات', 'شوكولاته', 'مياه', 'بقاله', 'بقالة',
    'food', 'restaurant', 'cafe', 'grocery', 'groceries', 'dinner', 'breakfast', 'lunch', 'eat', 'drink', 'pizza', 'starbucks',
    'mcdonalds', 'mcdonald', "mcdonald's", 'مترو ماركت', 'ماركت', 'market', 'سوبر ماركت', 'كارفور', 'carrefour'
  ],
  transport: [
    'مواصلات', 'تاكسي', 'اوبر', 'سويفل', 'مترو', 'بنزين', 'تذكره', 'تذكرة', 'اتوبيس', 'سفر', 'باص',
    'توصيله', 'توصيلة', 'كار', 'car', 'taxi', 'uber', 'gas', 'petrol', 'metro', 'bus', 'transport', 'flight', 'oil'
  ],
  bills: [
    'فاتوره', 'فاتورة', 'فواتير', 'كهرباء', 'كهربا', 'مياه', 'ميه', 'غاز', 'غاز_منزلي', 'انترنت', 'نت', 'وي',
    'تليفون ارضي', 'تليفون أرضي', 'اشتراك', 'اشتراكات', 'شحن_نت', 'bills', 'bill', 'electricity', 'water', 'internet', 'net', 'wifi', 'subscription'
  ],
  shopping: [
    'تسوق', 'شوبينج', 'شوبنج', 'سوبر ماركت كبير', 'امازون', 'نون', 'مول', 'سوبرماركت_كبير', 'مشتريات',
    'اغراض', 'أغراض', 'سوبر ماركت', 'shopping', 'amazon', 'noon', 'mall', 'buy', 'purchase'
  ],
  health: [
    'دوا', 'دواء', 'ادوية', 'أدوية', 'صيدليه', 'صيدلية', 'دكتور', 'طبيب', 'كشف', 'تحليل', 'تحاليل',
    'اشعه', 'أشعة', 'مستشفي', 'مستشفى', 'علاج', 'سنان', 'اسنان', 'أعصاب', 'health', 'medicine', 'pharmacy', 'doctor', 'hospital', 'clinic', 'dentist', 'ill'
  ],
  education: [
    'تعليم', 'مدرسه', 'مدرسة', 'كليه', 'كلية', 'جامعه', 'جامعة', 'كتاب', 'كتب', 'حصه', 'حصة', 'درس', 'دروس',
    'كورس', 'كورسات', 'محاضره', 'محاضرة', 'امتحان', 'education', 'school', 'college', 'university', 'course', 'book', 'books'
  ],
  entertainment: [
    'ترفيه', 'خروجه', 'خروجة', 'سينما', 'رحلة', 'رحله', 'لعبة', 'العاب', 'ألعاب', 'سفرية', 'سفريه', 'مصيف',
    'بحر', 'بلايستيشن', 'نتفليكس', 'فسحة', 'فسحه', 'العاب_فيديو', 'entertainment', 'cinema', 'movie', 'game', 'netflix', 'fun', 'trip'
  ],
  rent: [
    'ايجار', 'إيجار', 'شقه', 'شقة', 'سكن', 'rent', 'flat'
  ],
  phone: [
    'موبايل', 'رصيد', 'شحن', 'اتصالات', 'فودافون', 'اورنج', 'وي رصيد', 'شحن_رصيد', 'شريحة', 'شريحه', 'phone', 'mobile', 'credit', 'vodafone', 'orange', 'recharge'
  ],
  clothes: [
    'ملابس', 'لبس', 'هدوم', 'بدله', 'بدلة', 'قميص', 'بنطلون', 'فستان', 'جزمة', 'حذاء', 'clothes', 'tshirt', 'shoes', 'dress', 'jacket'
  ],
  salary: [
    'مرتب', 'راتب', 'شهري', 'المرتب', 'الراتب', 'سالياري', 'salary', 'wage', 'paycheck'
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
function cleanText(text: string): string {
  let cleaned = text.toLowerCase();
  // Normalize arabic chars: ة -> ه, إ/أ/آ -> ا, ى -> ي
  cleaned = cleaned.replace(/[أإآ]/g, 'ا');
  cleaned = cleaned.replace(/ة/g, 'ه');
  cleaned = cleaned.replace(/ى/g, 'ي');
  cleaned = cleaned.replace(/[\u064B-\u065F]/g, ''); // Remove harakat
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
  // Remove trailing date/time patterns: "في 17-07-2026", "بتاريخ...", "at 12:00", etc.
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
  // 12. Vodafone Cash Transfer Out (English)
  {
    name: 'vfcash_en_transfer',
    regex: /EGP\s*([\d,.]+)\s+has\s+been\s+transferred\s+to\s+(\d+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'expense',
      description: `Vodafone Cash transfer to ${match[2]}`,
      walletKeywords: ['vodafone', 'فودافون', 'cash', 'كاش']
    })
  },
  // 13. Vodafone Cash Receive (English)
  {
    name: 'vfcash_en_receive',
    regex: /you\s+have\s+received\s+EGP\s*([\d,.]+)\s+from\s+(\d+)/i,
    handler: (match) => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      type: 'income',
      description: `Vodafone Cash receive from ${match[2]}`,
      walletKeywords: ['vodafone', 'فودافون', 'cash', 'كاش']
    })
  }
];

export function matchCategoryFromText(
  text: string,
  type: 'income' | 'expense',
  customCategories: Category[] = []
): string {
  const cleaned = cleanText(text);
  let category = type === 'income' ? 'other_income' : 'other_expense';
  let bestMatchScore = 0;

  const allCategories = [...expenseCategories, ...incomeCategories, ...customCategories];
  for (const cat of allCategories) {
    const keywords = CATEGORY_KEYWORDS[cat.id] || [];
    const names = [cat.name, cat.nameAr];
    const catWords = [...keywords, ...names].map(cleanText);

    for (const keyword of catWords) {
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
  const cleaned = cleanText(normalized);

  for (const pattern of SMS_PATTERNS) {
    const match = pattern.regex.exec(normalized) || pattern.regex.exec(text);
    if (match) {
      const result = pattern.handler(match);
      
      // Select best wallet
      let walletId: string | null = null;
      if (wallets.length > 0) {
        let bestWalletScore = 0;
        
        // 1. Try to match by the wallet keywords from the matched SMS template
        for (const kw of result.walletKeywords) {
          const kwClean = cleanText(kw);
          for (const wallet of wallets) {
            const walletNameClean = cleanText(wallet.name);
            if (walletNameClean.includes(kwClean) || kwClean.includes(walletNameClean)) {
              const score = walletNameClean.length;
              if (score > bestWalletScore) {
                walletId = wallet.id;
                bestWalletScore = score;
              }
            }
          }
        }

        // 2. If not matched, try general bank/cash name matching in the SMS text
        if (!walletId) {
          for (const wallet of wallets) {
            const walletNameClean = cleanText(wallet.name);
            if (cleaned.includes(walletNameClean)) {
              if (walletNameClean.length > bestWalletScore) {
                walletId = wallet.id;
                bestWalletScore = walletNameClean.length;
              }
            }
          }
        }
      }

      // Infer category from description (merchant / person name)
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
  const cleaned = cleanText(normalized);

  // 1. Extract Amount
  let amount: number | null = null;
  const numRegex = /\d+(?:\.\d+)?/g;
  const matches = normalized.match(numRegex);
  if (matches && matches.length > 0) {
    amount = parseFloat(matches[0]);
  } else {
    const words = cleaned.split(/\s+/);
    let totalFromWords = 0;
    let foundWordNum = false;
    for (const word of words) {
      if (ARABIC_WORD_NUMBERS[word] !== undefined) {
        totalFromWords += ARABIC_WORD_NUMBERS[word];
        foundWordNum = true;
      }
    }
    if (foundWordNum && totalFromWords > 0) {
      amount = totalFromWords;
    }
  }

  // 2. Extract Type
  let type: 'income' | 'expense' | 'transfer' = 'expense';
  const transferIndicators = ['تحويل', 'حول', 'نقل', 'تحويلات', 'transfer', 'move'];
  const incomeIndicators = [
    'قبضت', 'جالي', 'مرتب', 'راتب', 'دخل', 'ربح', 'مكسب', 'هديه', 'هدية', 'بونص', 'مكافاه', 'مكافأة',
    'salary', 'income', 'bonus', 'gift', 'freelance', 'received', 'earned', 'deposit'
  ];
  
  const cleanedTransfer = transferIndicators.map(cleanText);
  if (cleanedTransfer.some(ind => cleaned.includes(ind))) {
    type = 'transfer';
  } else {
    const cleanedIncome = incomeIndicators.map(cleanText);
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

  if (wallets.length > 0) {
    if (type === 'transfer') {
      // Find source wallet (e.g., "من بنك مصر") and target wallet (e.g., "الي الكاش")
      const matchedWallets: { wallet: Wallet; index: number }[] = [];
      for (const wallet of wallets) {
        const walletNameClean = cleanText(wallet.name);
        const idx = cleaned.indexOf(walletNameClean);
        if (idx !== -1) {
          matchedWallets.push({ wallet, index: idx });
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
        const walletNameClean = cleanText(wallet.name);
        if (cleaned.includes(walletNameClean)) {
          if (walletNameClean.length > bestWalletScore) {
            walletId = wallet.id;
            bestWalletScore = walletNameClean.length;
          }
        }
      }
      if (!walletId) {
        if (cleaned.includes('كاش') || cleaned.includes('نقدي') || cleaned.includes('كش') || cleaned.includes('cash')) {
          const cashWallet = wallets.find(w => cleanText(w.name).includes('كاش') || cleanText(w.name).includes('cash') || cleanText(w.name).includes('نقد'));
          if (cashWallet) walletId = cashWallet.id;
        } else if (cleaned.includes('بنك') || cleaned.includes('فيزا') || cleaned.includes('حساب') || cleaned.includes('bank') || cleaned.includes('card') || cleaned.includes('visa')) {
          const bankWallet = wallets.find(w => cleanText(w.name).includes('بنك') || cleanText(w.name).includes('bank') || cleanText(w.name).includes('فيزا') || cleanText(w.name).includes('بطاقة'));
          if (bankWallet) walletId = bankWallet.id;
        }
      }
    }
  }

  // 5. Extract Description
  let description = text.trim();
  if (amount !== null) {
    description = description.replace(new RegExp(amount.toString(), 'g'), '').trim();
    description = description.replace(/\s+/g, ' ');
  }

  return {
    amount,
    type,
    category,
    description: description || text.trim(),
    walletId,
    toWalletId: toWalletId || undefined
  };
}
