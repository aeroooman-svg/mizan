/**
 * Gemini Free API & Smart Advisor Engine (lib/geminiAdvisor.ts)
 * 
 * Interacts with Google Gemini REST API (using free tier) or falls back to
 * context-aware local smart financial recommendations.
 */

import { Transaction, Wallet } from './storage';
import { getCategoryName } from './i18n';
import { getSmartResponse } from './smartAdvisor';

export interface GeminiAdviceResponse {
  answer: string;
  source: 'gemini' | 'local_smart_engine';
}

export async function askGeminiFinancialAdvisor(
  prompt: string,
  context: {
    transactions: Transaction[];
    selectedWallet: Wallet | null;
    totalIncome: number;
    totalExpense: number;
    balance: number;
    currencySymbol: string;
    language: 'ar' | 'en';
  },
  apiKey?: string
): Promise<GeminiAdviceResponse> {
  const isAr = context.language === 'ar';

  // If no custom API key provided, attempt calling the free public endpoint or fallback to localized Smart Engine
  if (!apiKey) {
    const localAdvice = getSmartResponse(prompt, {
      transactions: context.transactions,
      wallets: context.selectedWallet ? [context.selectedWallet] : [],
      selectedWallet: context.selectedWallet,
      budgets: {},
      totalIncome: context.totalIncome,
      totalExpense: context.totalExpense,
      balance: context.balance,
      currencySymbol: context.currencySymbol,
      language: context.language,
    });

    return {
      answer: localAdvice,
      source: 'local_smart_engine',
    };
  }

  try {
    const walletName = context.selectedWallet?.name || (isAr ? 'المحفظة' : 'Wallet');
    const systemPrompt = `You are MIZAN AI, a top financial advisor for personal finance. 
User Language: ${context.language}.
Financial Summary for ${walletName}:
- Income: ${context.totalIncome} ${context.currencySymbol}
- Expense: ${context.totalExpense} ${context.currencySymbol}
- Balance: ${context.balance} ${context.currencySymbol}
- Recent Transactions Count: ${context.transactions.length}

User Question: ${prompt}

Provide a concise, practical, and highly empathetic response in ${context.language === 'ar' ? 'Arabic' : 'English'}. Include bullet points if useful.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API returned status ${res.status}`);
    }

    const data = await res.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (replyText) {
      return {
        answer: replyText.trim(),
        source: 'gemini',
      };
    }

    throw new Error('Empty response from Gemini API');
  } catch (err) {
    console.warn('Gemini API notice, falling back to Local Smart Engine:', err);
    const fallback = getSmartResponse(prompt, {
      transactions: context.transactions,
      wallets: context.selectedWallet ? [context.selectedWallet] : [],
      selectedWallet: context.selectedWallet,
      budgets: {},
      totalIncome: context.totalIncome,
      totalExpense: context.totalExpense,
      balance: context.balance,
      currencySymbol: context.currencySymbol,
      language: context.language,
    });

    return {
      answer: fallback,
      source: 'local_smart_engine',
    };
  }
}
