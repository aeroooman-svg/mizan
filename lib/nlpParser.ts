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

// Map of single Arabic number words to values across dialects
const BASIC_ARABIC_NUMBERS: Record<string, number> = {
  'صفر': 0,
  'واحد': 1,
  'واحدة': 1,
  'واحده': 1,
  'فرد': 1,
  'اثنان': 2,
  'اثنين': 2,
  'اتنين': 2,
  'اثنتان': 2,
  'زوج': 2,
  'ثلاثة': 3,
  'ثلاث': 3,
  'تلاتة': 3,
  'تلات': 3,
  'تلاته': 3,
  'تلاتين': 30,
  'اربعة': 4,
  'اربع': 4,
  'أربعة': 4,
  'أربع': 4,
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
  'تمانية': 8,
  'تسعة': 9,
  'تسع': 9,
  'عشرة': 10,
  'عشر': 10,
  'احد عشر': 11,
  'احداعش': 11,
  'داعش': 11,
  'اثنا عشر': 12,
  'اثناعش': 12,
  'طناش': 12,
  'ثلاثة عشر': 13,
  'ثلطاش': 13,
  'تلاتاشر': 13,
  'تلاتطاش': 13,
  'اربعة عشر': 14,
  'اربعطاش': 14,
  'اربعتاشر': 14,
  'خمسة عشر': 15,
  'خمسطاش': 15,
  'خمستاشر': 15,
  'ستة عشر': 16,
  'ستطاش': 16,
  'ستاشر': 16,
  'سبعة عشر': 17,
  'سبعطاش': 17,
  'سبعتاشر': 17,
  'ثمانية عشر': 18,
  'تمنطاش': 18,
  'تمنتاشر': 18,
  'تسعة عشر': 19,
  'تسعطاش': 19,
  'تسعتاشر': 19,
  'عشرين': 20,
  'عشرون': 20,
  'ثلاثين': 30,
  'ثلاثون': 30,
  'اربعين': 40,
  'اربعون': 40,
  'أربعين': 40,
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
  'مئة': 100,
  'مئتان': 200,
  'مئتين': 200,
  'ميتين': 200,
  'ماتين': 200,
  'ثلاثمائة': 300,
  'تلتمية': 300,
  'تلت مية': 300,
  'اربعمائة': 400,
  'اربعمية': 400,
  'اربع مية': 400,
  'خمسمائة': 500,
  'خمسمية': 500,
  'خمس مية': 500,
  'ستمائة': 600,
  'ستمية': 600,
  'ست مية': 600,
  'سبعمائة': 700,
  'سبعمية': 700,
  'سبع مية': 700,
  'ثمانمائة': 800,
  'تمنمية': 800,
  'تمن مية': 800,
  'تسعمائة': 900,
  'تسعمية': 900,
  'تسع مية': 900,
  'الف': 1000,
  'ألف': 1000,
  'الفين': 2000,
  'ألفين': 2000,
  'الاف': 1000,
  'آلاف': 1000,
  'باكو': 1000, // Egyptian slang for 1000 EGP
  'باكوان': 2000,
  'باكوين': 2000,
  'ارنب': 1000000, // Egyptian slang for 1M EGP
  'مليون': 1000000,
  'مليونين': 2000000,
  'ملايين': 1000000,
  'مليار': 1000000000,
};

// Spoken fractions & multipliers
const ARABIC_FRACTIONS: Record<string, number> = {
  'نصف': 0.5,
  'نص': 0.5,
  'ربع': 0.25,
  'أربع': 0.25,
  'اربع': 0.25,
  'ثلث': 0.333,
  'تلت': 0.333,
  'تلات ارباع': 0.75,
  'ثلاثة ارباع': 0.75,
};

// Spoken currency units
const CURRENCY_UNIT_VALUES: Record<string, number> = {
  'دينار': 1,
  'دينارين': 2,
  'ديناران': 2,
  'دنانير': 1,
  'جنيه': 1,
  'جنيهين': 2,
  'جنيهان': 2,
  'جنيهات': 1,
  'ريال': 1,
  'ريالين': 2,
  'ريالان': 2,
  'ريالات': 1,
  'درهم': 1,
  'درهمين': 2,
  'درهمان': 2,
  'دراهم': 1,
  'دولار': 1,
  'دولارين': 2,
  'دولاران': 2,
  'دولارات': 1,
  'يورو': 1,
  'يوروين': 2,
  'يوروهات': 1,
  'ليرة': 1,
  'ليرتين': 2,
  'ليرات': 1,
  'شيكل': 1,
  'شيكلين': 2,
  'شواكل': 1,
  'فرنك': 1,
  'فرنكات': 1,
};

export function cleanArabicText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel/diacritics
    .replace(/[أإآ]/g, 'ا') // Normalize Alef
    .replace(/ة/g, 'ه') // Normalize Ta Marbouta
    .replace(/ى/g, 'ي') // Normalize Ya
    .replace(/[^\w\s\u0600-\u06FF]/gi, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalized maps
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

// Comprehensive Category Keywords covering Egyptian, Gulf, Levantine, Maghrebi, Fusha & Franco
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    // Egyptian
    'اكل', 'شرب', 'طعام', 'شاي', 'قهوه', 'قهوة', 'مطبخ', 'سوبرماركت', 'خضار', 'فاكهه', 'فاكهة',
    'لحمه', 'لحمة', 'فراخ', 'دجاج', 'مطعم', 'غدا', 'غداء', 'عشا', 'عشاء', 'فطار', 'فطور', 'سحور',
    'دليفري', 'كافيه', 'ماكدونالدز', 'كنتاكي', 'بيتزا', 'كريب', 'حلو', 'حلويات', 'شوكولاته', 'مياه',
    'بقاله', 'بقالة', 'كشري', 'فول', 'طعمية', 'طعميه', 'عيش', 'لبن', 'جبنة', 'جبنه', 'طلبات', 'talabat',
    'نسكافيه', 'اندومي', 'مخبز', 'حلواني', 'تيك اواي', 'وجبات', 'سناك', 'اكل بيتي', 'كوفي',
    // Gulf / Saudi / Emirati / Kuwaiti
    'شاورما', 'برجر', 'مندي', 'كبسه', 'كبسة', 'مظبي', 'حاشي', 'تموينات', 'بقالة_الحارة', 'عصائر',
    'كشته', 'ذبايح', 'ذبيحة', 'قهوة_مختصة', 'درايف_ثرو', 'هنقرستيشن', 'hungerstation', 'جاهز', 'jahez',
    'كاريدج', 'مرسول', 'مخبوزات', 'تميس', 'فول_وتميس', 'حليب', 'زبادي', 'توصيل_اكل', 'بوفيه',
    // Levantine (Syrian, Lebanese, Jordanian, Palestinian)
    'ترويقة', 'ترويقه', 'منقوشة', 'مناقيش', 'شيش_طاووق', 'مشاوي', 'فلافل', 'حمص', 'فتة', 'سيران', 'سناك',
    // Maghrebi (Moroccan, Algerian, Tunisian)
    'كسكسي', 'طاجين', 'اتاي', 'قهوة_كحلة', 'كوزينة', 'حليب_وخبز', 'حوت', 'بسطيلة', 'مارشي',
    // English & Franco
    'food', 'restaurant', 'cafe', 'coffee', 'grocery', 'groceries', 'dinner', 'breakfast', 'lunch',
    'eat', 'drink', 'pizza', 'starbucks', 'mcdonalds', 'kfc', 'burger', 'snack', 'bakery', 'market',
    'supermarket', 'carrefour', 'lulu', 'panda', 'danube', 'othaim', 'hypermarket', 'akil', 'mat3am'
  ],
  transport: [
    // Egyptian
    'مواصلات', 'تاكسي', 'اوبر', 'uber', 'سويفل', 'مترو', 'بنزين', 'تذكره', 'تذكرة', 'اتوبيس', 'سفر',
    'باص', 'توصيله', 'كار', 'كريم', 'careem', 'ديدي', 'didi', 'اندرايف', 'indrive', 'قطار', 'طيران',
    'ميكروباص', 'مشوار', 'كارته', 'كارتة', 'تغيير_زيت', 'صيانة_سيارة', 'كاوتش',
    // Gulf
    'عبيت_بنزين', 'بترول', 'محطة_الدريس', 'ساسكو', 'ادنوك', 'اينوك', 'وقود', 'سالك', 'salik', 'درب',
    'مواقف', 'موقف', 'غسيل_سيارة', 'تأجير_سيارات', 'سياكل', 'سكوتر', 'قطار_الحرمين', 'مترو_الرياض',
    // Levantine & Maghrebi
    'سرفيس', 'شوفير', 'اجرة_طريق', 'ترانسبور', 'طاكسي', 'كار_سياحي', 'بيياج', 'تول',
    // English & Franco
    'transport', 'taxi', 'gas', 'petrol', 'fuel', 'metro', 'bus', 'flight', 'airline', 'parking', 'careem', 'benzine'
  ],
  bills: [
    // Egyptian & Arabic
    'فاتوره', 'فاتورة', 'فواتير', 'كهرباء', 'كهربا', 'مياه', 'ميه', 'غاز', 'انترنت', 'نت', 'وي',
    'تليفون ارضي', 'اشتراك', 'اشتراكات', 'شحن_نت', 'راوتر', 'صيانة', 'مرفقات', 'بلدية', 'فاتورة_الكهرباء',
    // Gulf
    'سداد', 'sadad', 'فواتير_سداد', 'كهرباء_السعودية', 'مياه_الوطنية', 'ايجار', 'إيجار', 'ايجار_البيت',
    'قسط', 'اقساط', 'رسوم_خدمات', 'بلدية_دبي', 'ديوا', 'dewa', 'كهرماء', 'مواقف_بلدية',
    // Levantine & Maghrebi
    'اشتراك_المولد', 'اشتراك_موتور', 'ماء_وكهرباء', 'سونلغاز', 'ليدك', 'فاتورة_الماء', 'فاتورة_الضو',
    // English & Franco
    'bill', 'bills', 'electricity', 'water', 'internet', 'net', 'wifi', 'subscription', 'rent', 'installment', 'sadad'
  ],
  shopping: [
    // General & Arab
    'تسوق', 'شوبينج', 'شوبنج', 'سوبر ماركت كبير', 'امازون', 'amazon', 'نون', 'noon', 'مول', 'مشتريات',
    'اغراض', 'أغراض', 'مقاضي', 'سوق', 'طلبات_البيت', 'اكسسوارات', 'الكترونيات', 'جوميا', 'نمشي', 'namshi',
    'شي_ان', 'shein', 'ترينديول', 'trendyol', 'ايكيا', 'ikea', 'اكسترا', 'extra', 'جرير', 'jarir',
    // Dialects
    'تقضيت', 'مقاضي_البيت', 'حوايج', 'صوالح', 'قضيان', 'شروة', 'شروات', 'بسطة',
    // English
    'shopping', 'mall', 'buy', 'purchase', 'store', 'electronics', 'furniture', 'clothes', 'fashion'
  ],
  health: [
    'دوا', 'دواء', 'ادوية', 'أدوية', 'صيدليه', 'صيدلية', 'دكتور', 'طبيب', 'كشف', 'تحليل', 'تحاليل',
    'اشعه', 'أشعة', 'مستشفي', 'مستشفى', 'علاج', 'سنان', 'اسنان', 'أعصاب', 'روشتة', 'نظارة', 'عيادة',
    'فحص', 'طوارئ', 'تأمين_صحي', 'بوبا', 'النهدي', 'صيدلية_النهدي', 'الدواء', 'العزبي', '19011', 'صيدلية_سيف',
    'health', 'medicine', 'pharmacy', 'doctor', 'hospital', 'clinic', 'dentist', 'ill', 'glasses', 'medication'
  ],
  education: [
    'تعليم', 'مدرسه', 'مدرسة', 'كليه', 'كلية', 'جامعه', 'جامعة', 'كتاب', 'كتب', 'حصه', 'حصة', 'درس',
    'دروس', 'كورس', 'كورسات', 'محاضره', 'محاضرة', 'امتحان', 'ملازم', 'قرطاسية', 'مكتبة', 'اقلام',
    'دفاتر', 'رسوم_جامعية', 'مصاريف_المدرسة', 'يوديمي', 'udemy', 'coursera', 'دورات', 'دورة_تدريبية',
    'education', 'school', 'college', 'university', 'course', 'book', 'books', 'tuition', 'study'
  ],
  entertainment: [
    'ترفيه', 'خروجه', 'خروجة', 'سينما', 'cinema', 'فوكس', 'vox', 'موفيز', 'muvi', 'رحلة', 'رحله',
    'لعبة', 'العاب', 'ألعاب', 'سفرية', 'مصيف', 'بحر', 'شاليه', 'شاليهات', 'استراحة', 'مزرعة', 'بوليفارد',
    'بلايستيشن', 'playstation', 'نتفليكس', 'netflix', 'شاهد', 'shahid', 'فسحة', 'ملاهي', 'بولينج',
    'entertainment', 'movie', 'game', 'gaming', 'fun', 'trip', 'travel', 'vacation', 'resort', 'steam'
  ],
  rent: [
    'ايجار', 'إيجار', 'اجار', 'أجار', 'شقة', 'شقه', 'سكن', 'عمارة', 'عمارة_سكنية', 'ايجار_شقة',
    'إيجار_البيت', 'كريت', 'كراء', 'ايجار_شهري', 'rent', 'housing', 'apartment', 'flat'
  ],
  phone: [
    'رصيد', 'شحن_رصيد', 'باقه', 'باقة', 'مكالمات', 'فودافون', 'vodafone', 'اورانج', 'orange',
    'اتصالات', 'etisalat', 'stc', 'اس_تي_سي', 'موبايلي', 'mobily', 'زين', 'zain', 'اوريدو', 'ooredoo',
    'du', 'دو', 'اتصالات_الامارات', 'جازي', 'djezzy', 'موبيليس', 'اتصالات_المغرب', 'انوي', 'inwi',
    'phone', 'recharge', 'telecom', 'mobile', 'topup'
  ],
  clothes: [
    'هدوم', 'ملابس', 'لبس', 'قميص', 'بنطلون', 'فستان', 'عباية', 'عبايه', 'ثوب', 'شماغ', 'طرحة',
    'حذاء', 'شوز', 'كوتشي', 'شنطة', 'زارا', 'zara', 'h&m', 'اتش_اند_ام', 'مانجو', 'mango',
    'حوايج', 'كسوة', 'clothes', 'shoes', 'fashion', 'dress', 'jacket', 'outfit'
  ],
  charity: [
    'صدقة', 'صدقه', 'زكاة', 'زكاه', 'تبرع', 'تبرعات', 'احسان', 'إحسان', 'رسالة', 'مصر_الخير',
    'بيت_الزكاة', 'اطعام', 'فقراء', 'ايتام', 'أيتام', 'عيدية', 'عيديه', 'charity', 'zakat', 'donation'
  ],
};

const INCOME_CATEGORY_KEYWORDS: Record<string, string[]> = {
  salary: [
    'مرتب', 'راتب', 'معاش', 'الراتب', 'نزول_الراتب', 'نزل_الراتب', 'قبضت_المرتب', 'صالير', 'salaire',
    'salary', 'paycheck', 'wage', 'monthly_income', 'قبضت_معاشي'
  ],
  freelance: [
    'فريلانس', 'شغل_حر', 'برمجة', 'تصميم', 'مشروع_جانبي', 'استشارة', 'اتعاب', 'أتعاب', 'عمولة', 'عموله',
    'freelance', 'project', 'client', 'gig', 'upwork', 'fiverr', 'mostaql', 'مستقل'
  ],
  investment: [
    'استثمار', 'ارباح', 'أرباح', 'توزيعات', 'اسهم', 'أسهم', 'ذهب', 'عقارات', 'فوائد', 'عائد',
    'ربح', 'مكسب', 'تجارة', 'dividends', 'investment', 'stocks', 'crypto', 'profit', 'trading'
  ],
  gift: [
    'هدية', 'هديه', 'عيدية', 'عيديه', 'مكافأة', 'مكافاه', 'بونص', 'منحة', 'عطية', 'نقطة',
    'gift', 'bonus', 'reward', 'present'
  ],
  other_income: [
    'دخل_اخر', 'ايراد', 'إيراد', 'فلوس_راجعة', 'استرجاع', 'سلفة_مستردة', 'مبيعات', 'refund', 'other_income'
  ]
};

// Bank SMS Regex Patterns covering Arab Banks
interface BankSMSPattern {
  name: string;
  pattern: RegExp;
  amountGroup: number;
  type: 'expense' | 'income';
  categoryDefault: string;
}

const BANK_PATTERNS: BankSMSPattern[] = [
  // Al Rajhi / Saudi Banks
  {
    name: 'Al Rajhi Purchase',
    pattern: /(?:شراء|خصم|عملية شراء|شراء عبر الإنترنت|بطاقة مدى).*?مبلغ\s*(?:SAR|ر\.س)?\s*([0-9.,]+)/i,
    amountGroup: 1,
    type: 'expense',
    categoryDefault: 'shopping'
  },
  {
    name: 'Al Rajhi Salary/Deposit',
    pattern: /(?:إيداع|راتب|حوالة واردة).*?مبلغ\s*(?:SAR|ر\.س)?\s*([0-9.,]+)/i,
    amountGroup: 1,
    type: 'income',
    categoryDefault: 'salary'
  },
  // NBE / CIB / Banque Misr (Egypt)
  {
    name: 'Egypt Bank Purchase',
    pattern: /(?:purchase of|خصم مبلغ|عملية شراء بمبلغ|تم خصم)\s*(?:EGP|ج\.م)?\s*([0-9.,]+)/i,
    amountGroup: 1,
    type: 'expense',
    categoryDefault: 'shopping'
  },
  {
    name: 'Vodafone Cash / InstaPay',
    pattern: /(?:تم تحويل مبلغ|تم خصم|تم دفع فاتورة)\s*([0-9.,]+)\s*(?:جنيه|ج\.م|EGP)/i,
    amountGroup: 1,
    type: 'expense',
    categoryDefault: 'bills'
  },
  // Kuwait Banks (NBK / Boubyan)
  {
    name: 'Kuwait POS/Debit',
    pattern: /(?:POS Purchase|Debit|خصم|شراء).*?(?:KD|KWD|د\.ك)\s*([0-9.,]+)/i,
    amountGroup: 1,
    type: 'expense',
    categoryDefault: 'shopping'
  },
  // UAE Banks (Emirates NBD, ADCB)
  {
    name: 'UAE Bank Debit',
    pattern: /(?:debited with|purchase on card).*?(?:AED|د\.إ)\s*([0-9.,]+)/i,
    amountGroup: 1,
    type: 'expense',
    categoryDefault: 'shopping'
  }
];

function parseBankSMS(text: string, wallets: Wallet[], customCategories: Category[]): ParsedTransaction | null {
  for (const bp of BANK_PATTERNS) {
    const match = text.match(bp.pattern);
    if (match && match[bp.amountGroup]) {
      const rawAmt = match[bp.amountGroup].replace(/,/g, '');
      const parsedAmt = parseFloat(rawAmt);
      if (!isNaN(parsedAmt) && parsedAmt > 0) {
        return {
          amount: parsedAmt,
          type: bp.type,
          category: matchCategoryFromText(text, bp.type, customCategories) || bp.categoryDefault,
          description: text.substring(0, 60).trim(),
          walletId: wallets[0]?.id || null,
        };
      }
    }
  }
  return null;
}

export function matchCategoryFromText(text: string, type: 'income' | 'expense' | 'transfer', customCategories: Category[] = []): string {
  const clean = cleanArabicText(text);
  const words = clean.split(/\s+/);

  // Check custom categories first
  for (const cat of customCategories) {
    const cleanCatName = cleanArabicText(cat.name);
    const cleanCatNameAr = cat.nameAr ? cleanArabicText(cat.nameAr) : '';
    if (clean.includes(cleanCatName) || (cleanCatNameAr && clean.includes(cleanCatNameAr))) {
      return cat.id;
    }
  }

  const keywordMap = type === 'income' ? INCOME_CATEGORY_KEYWORDS : CATEGORY_KEYWORDS;

  let bestMatchCategory = type === 'income' ? 'other_income' : 'other';
  let maxMatchedScore = 0;

  for (const [catId, keywords] of Object.entries(keywordMap)) {
    let score = 0;
    for (const kw of keywords) {
      const cleanKw = cleanArabicText(kw);
      if (cleanKw.length === 0) continue;

      if (clean === cleanKw) {
        score += 10;
      } else if (clean.includes(cleanKw)) {
        score += cleanKw.length >= 4 ? 4 : 2;
      }
      for (const w of words) {
        if (w === cleanKw) {
          score += 3;
        }
      }
    }

    if (score > maxMatchedScore) {
      maxMatchedScore = score;
      bestMatchCategory = catId;
    }
  }

  return bestMatchCategory;
}

/**
 * Extracts numeric or spoken amount from any Arabic dialect string
 */
export function extractArabicAmount(text: string): { amount: number | null; matchedPhrase: string | null } {
  const normalized = normalizeArabicNumbers(text);

  // 1. Direct regex for numbers (e.g., 150, 150.50, 150ج, 150 ريال)
  const numericPattern = /(?:بـ?|ب|بقيمة|بمبلغ|حق|حساب|سعر|بـ)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:جنيه|جنيهات|ج\.م|ريال|ريالات|ر\.س|دينار|دنانير|د\.ك|درهم|دراهم|د\.إ|دولار|دولارات|يورو|ليرة|شيكل|قرش|فلس|egp|sar|kwd|aed|usd|eur)?/i;
  const numMatch = normalized.match(numericPattern);
  if (numMatch && numMatch[1]) {
    const val = parseFloat(numMatch[1]);
    if (!isNaN(val) && val > 0) {
      return { amount: val, matchedPhrase: numMatch[0] };
    }
  }

  // 2. Dialect spoken composite amounts (e.g. ألفين وخمسمية، تلتمية وخمسين، ميتين، باكوين)
  const cleaned = cleanArabicText(normalized);
  const words = cleaned.split(/\s+/);

  let totalSpokenAmount = 0;
  let currentSegment = 0;
  let hasFoundNumber = false;
  let matchedTokens: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const numVal = NORMALIZED_BASIC_NUMBERS[w];
    const fracVal = NORMALIZED_FRACTIONS[w];
    const currVal = NORMALIZED_CURRENCIES[w];

    if (numVal !== undefined) {
      hasFoundNumber = true;
      matchedTokens.push(w);
      if (numVal >= 1000) {
        if (currentSegment === 0) currentSegment = 1;
        totalSpokenAmount += currentSegment * numVal;
        currentSegment = 0;
      } else if (numVal >= 100) {
        currentSegment += numVal;
      } else {
        currentSegment += numVal;
      }
    } else if (fracVal !== undefined) {
      hasFoundNumber = true;
      matchedTokens.push(w);
      currentSegment += fracVal;
    } else if (currVal !== undefined && (w.endsWith('ين') || w.endsWith('ان'))) {
      // Dual currencies like دينارين، جنيهين
      hasFoundNumber = true;
      matchedTokens.push(w);
      totalSpokenAmount += currVal;
    }
  }

  totalSpokenAmount += currentSegment;

  if (hasFoundNumber && totalSpokenAmount > 0) {
    return { amount: totalSpokenAmount, matchedPhrase: matchedTokens.join(' ') };
  }

  return { amount: null, matchedPhrase: null };
}

/**
 * Universal Arabic NLP Parser - Parses natural speech & text into structured transaction data
 */
export function parseTransactionText(
  text: string,
  wallets: Wallet[],
  customCategories: Category[] = []
): ParsedTransaction {
  if (!text || !text.trim()) {
    return {
      amount: null,
      type: 'expense',
      category: 'other',
      description: '',
      walletId: wallets[0]?.id || null,
    };
  }

  // 1. Try Banking SMS Parsing
  const smsParsed = parseBankSMS(text, wallets, customCategories);
  if (smsParsed) {
    return smsParsed;
  }

  const normalized = normalizeArabicNumbers(text);
  const cleaned = cleanArabicText(normalized);

  // 2. Extract Amount
  const { amount, matchedPhrase } = extractArabicAmount(normalized);

  // 3. Determine Type (Income, Expense, Transfer) across Arabic Dialects & Franco
  let type: 'income' | 'expense' | 'transfer' = 'expense';

  const transferKeywords = [
    'تحويل', 'حول', 'حولت', 'نقلت', 'حولي', 'اتحول', 'ارسال', 'ارسلت', 'transfer', 'move', '7awelt', 'send'
  ];

  const incomeKeywords = [
    // Egyptian
    'قبضت', 'قبض', 'جالي', 'مرتب', 'معاش', 'دخل', 'مكسب', 'ربح', 'بونص', 'مكافاه', 'مكافأة',
    'هديه', 'هدية', 'الجمعية', 'استلفت', 'سلفة', 'ايراد', 'مبيعات',
    // Gulf & Saudi
    'نزل_الراتب', 'نزل الراتب', 'راتبي', 'استلمت', 'حوالة واردة', 'ايداع', 'إيداع', 'كاش باك', 'عيدية',
    // Levantine & Maghrebi
    'قبضت_المعاش', 'صالير', 'دخل_اضافي', 'ارباح',
    // English & Franco
    'salary', 'income', 'bonus', 'gift', 'earned', 'freelance', 'deposit', 'received', 'salart'
  ];

  if (transferKeywords.some(k => cleaned.includes(cleanArabicText(k)))) {
    type = 'transfer';
  } else if (incomeKeywords.some(k => cleaned.includes(cleanArabicText(k)))) {
    type = 'income';
  }

  // 4. Extract Category
  const category = type === 'transfer' ? 'transfer' : matchCategoryFromText(text, type, customCategories);

  // 5. Match Wallet / Account
  let walletId: string | null = null;
  let toWalletId: string | null = null;

  if (wallets && wallets.length > 0) {
    for (const w of wallets) {
      const cleanWName = cleanArabicText(w.name);
      if (cleaned.includes(cleanWName)) {
        if (!walletId) {
          walletId = w.id;
        } else if (type === 'transfer' && !toWalletId && walletId !== w.id) {
          toWalletId = w.id;
        }
      }
    }

    // Default heuristics if specific wallet name not mentioned
    if (!walletId) {
      if (cleaned.includes('كاش') || cleaned.includes('نقد') || cleaned.includes('cash') || cleaned.includes('فلوس')) {
        const cashW = wallets.find(w => cleanArabicText(w.name).includes('كاش') || cleanArabicText(w.name).includes('نقد') || cleanArabicText(w.name).includes('cash'));
        if (cashW) walletId = cashW.id;
      } else if (cleaned.includes('بنك') || cleaned.includes('فيزا') || cleaned.includes('بطاقة') || cleaned.includes('راجحي') || cleaned.includes('مدى') || cleaned.includes('bank') || cleaned.includes('card')) {
        const bankW = wallets.find(w => cleanArabicText(w.name).includes('بنك') || cleanArabicText(w.name).includes('فيزا') || cleanArabicText(w.name).includes('بطاقة') || cleanArabicText(w.name).includes('bank'));
        if (bankW) walletId = bankW.id;
      }

      // Default to first active wallet
      if (!walletId && wallets[0]) {
        walletId = wallets[0].id;
      }
    }
  }

  // 6. Clean Description
  let description = text.trim();
  if (matchedPhrase) {
    description = description.replace(new RegExp(matchedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '');
  }
  if (amount !== null) {
    description = description.replace(new RegExp(amount.toString(), 'g'), '');
  }

  const noiseKeywords = [
    'صرفت', 'دفعت', 'شريت', 'اشتريت', 'جبت', 'تقضيت', 'حاسبت', 'سددت', 'خلصت', 'كريت', 'حول', 'حولت',
    'جنيه', 'جنيهات', 'ريال', 'ريالات', 'دينار', 'دنانير', 'درهم', 'دراهم', 'دولار', 'دولارات', 'يورو',
    'كاش', 'cash', 'من', 'في', 'على', 'بـ', 'ب', 'حق', 'حساب', 'سعر', 'قيمة', 'مصاريف', 'مصروف'
  ];

  const descWords = description.split(/\s+/).filter(w => {
    const cleanW = cleanArabicText(w);
    return !noiseKeywords.includes(cleanW) && cleanW.length > 0;
  });

  let cleanDesc = descWords.join(' ').trim();
  if (!cleanDesc) {
    cleanDesc = text.trim();
  }

  return {
    amount,
    type,
    category,
    description: cleanDesc,
    walletId,
    toWalletId: toWalletId || undefined,
  };
}
