const arabicToWestern: Record<string, string> = {
  '\u0660': '0', // ٠
  '\u0661': '1', // ١
  '\u0662': '2', // ٢
  '\u0663': '3', // ٣
  '\u0664': '4', // ٤
  '\u0665': '5', // ٥
  '\u0666': '6', // ٦
  '\u0667': '7', // ٧
  '\u0668': '8', // ٨
  '\u0669': '9', // ٩
  // Persian / Urdu digits
  '\u06F0': '0',
  '\u06F1': '1',
  '\u06F2': '2',
  '\u06F3': '3',
  '\u06F4': '4',
  '\u06F5': '5',
  '\u06F6': '6',
  '\u06F7': '7',
  '\u06F8': '8',
  '\u06F9': '9',
};

/**
 * Converts Eastern Arabic and Persian digits to standard Western Arabic (0-9)
 */
export function normalizeArabicNumbers(input: string): string {
  if (!input) return '';
  return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => arabicToWestern[ch] || ch);
}

/**
 * Normalizes user typed amount strings, handling Arabic comma/decimal points
 */
export function normalizeAmountInput(input: string): string {
  if (!input) return '';
  let normalized = normalizeArabicNumbers(input);
  // Replace Arabic comma (،) or standard comma used as decimal
  normalized = normalized.replace(/,/g, '.');
  normalized = normalized.replace(/[^0-9.]/g, '');
  const parts = normalized.split('.');
  if (parts.length > 2) {
    normalized = parts[0] + '.' + parts.slice(1).join('');
  }
  return normalized;
}

/**
 * Formats numbers into clear locale-specific strings
 */
export function formatAmountWithLocale(amount: number, locale: string = 'ar-EG'): string {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toString();
  }
}
