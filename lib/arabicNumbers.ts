const arabicToWestern: Record<string, string> = {
  '\u0660': '0',
  '\u0661': '1',
  '\u0662': '2',
  '\u0663': '3',
  '\u0664': '4',
  '\u0665': '5',
  '\u0666': '6',
  '\u0667': '7',
  '\u0668': '8',
  '\u0669': '9',
};

export function normalizeArabicNumbers(input: string): string {
  return input.replace(/[\u0660-\u0669]/g, (ch) => arabicToWestern[ch] || ch);
}

export function normalizeAmountInput(input: string): string {
  let normalized = normalizeArabicNumbers(input);
  normalized = normalized.replace(/[^0-9.]/g, '');
  const parts = normalized.split('.');
  if (parts.length > 2) {
    normalized = parts[0] + '.' + parts.slice(1).join('');
  }
  return normalized;
}
