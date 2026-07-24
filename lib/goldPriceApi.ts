import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExchangeRates, convertAmount } from './currencyApi';

const GOLD_CACHE_KEY = '@masarif_gold_prices';
const GOLD_CACHE_TIME_KEY = '@masarif_gold_prices_time';

export interface GoldPrices {
  gold24kUsdPerGram: number;
  gold21kUsdPerGram: number;
  gold18kUsdPerGram: number;
  silverUsdPerGram: number;
  lastUpdated: string;
  isLive: boolean;
}

// Modern market fallback rates in USD per gram (~$4050/oz Gold, ~$58/oz Silver)
export const FALLBACK_GOLD_PRICES: GoldPrices = {
  gold24kUsdPerGram: 130.3, // ~ $130.3 / gram 24K gold
  gold21kUsdPerGram: 114.0, // ~ $114.0 / gram 21K gold
  gold18kUsdPerGram: 97.7,  // ~ $97.7 / gram 18K gold
  silverUsdPerGram: 1.87,   // ~ $1.87 / gram silver
  lastUpdated: new Date().toISOString(),
  isLive: false,
};

export async function getGoldAndSilverPrices(forceRefresh = false): Promise<GoldPrices> {
  try {
    const cachedTime = await AsyncStorage.getItem(GOLD_CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(GOLD_CACHE_KEY);

    // 1-hour cache by default for precious metals
    const oneHour = 1 * 60 * 60 * 1000;
    if (!forceRefresh && cachedTime && cachedData && Date.now() - parseInt(cachedTime, 10) < oneHour) {
      return JSON.parse(cachedData);
    }

    // Endpoint 1: api.gold-api.com (Real-time spot Gold & Silver)
    try {
      const [goldRes, silverRes] = await Promise.all([
        fetch('https://api.gold-api.com/price/XAU'),
        fetch('https://api.gold-api.com/price/XAG')
      ]);

      if (goldRes.ok) {
        const goldData = await goldRes.json();
        const goldOunceUsd = parseFloat(goldData.price);

        let silverOunceUsd = 58.2;
        if (silverRes.ok) {
          const silverData = await silverRes.json();
          if (silverData.price) silverOunceUsd = parseFloat(silverData.price);
        }

        if (goldOunceUsd > 0) {
          const gold24kUsd = goldOunceUsd / 31.1034768;
          const gold21kUsd = gold24kUsd * (21 / 24);
          const gold18kUsd = gold24kUsd * (18 / 24);
          const silverUsd = silverOunceUsd / 31.1034768;

          const livePrices: GoldPrices = {
            gold24kUsdPerGram: Math.round(gold24kUsd * 100) / 100,
            gold21kUsdPerGram: Math.round(gold21kUsd * 100) / 100,
            gold18kUsdPerGram: Math.round(gold18kUsd * 100) / 100,
            silverUsdPerGram: Math.round(silverUsd * 100) / 100,
            lastUpdated: new Date().toISOString(),
            isLive: true,
          };

          await AsyncStorage.setItem(GOLD_CACHE_KEY, JSON.stringify(livePrices));
          await AsyncStorage.setItem(GOLD_CACHE_TIME_KEY, Date.now().toString());

          return livePrices;
        }
      }
    } catch (e1) {
      console.warn('Primary gold API endpoint failed, trying secondary:', e1);
    }

    // Endpoint 2: jsdelivr currency-api (contains xau/xag rates)
    try {
      const res2 = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.usd && data2.usd.xau) {
          // 1 USD = xau troy ounces => 1 troy ounce = 1 / xau
          const goldOunceUsd = 1 / parseFloat(data2.usd.xau);
          const silverOunceUsd = data2.usd.xag ? (1 / parseFloat(data2.usd.xag)) : 58.2;

          const gold24kUsd = goldOunceUsd / 31.1034768;
          const gold21kUsd = gold24kUsd * (21 / 24);
          const gold18kUsd = gold24kUsd * (18 / 24);
          const silverUsd = silverOunceUsd / 31.1034768;

          const livePrices: GoldPrices = {
            gold24kUsdPerGram: Math.round(gold24kUsd * 100) / 100,
            gold21kUsdPerGram: Math.round(gold21kUsd * 100) / 100,
            gold18kUsdPerGram: Math.round(gold18kUsd * 100) / 100,
            silverUsdPerGram: Math.round(silverUsd * 100) / 100,
            lastUpdated: new Date().toISOString(),
            isLive: true,
          };

          await AsyncStorage.setItem(GOLD_CACHE_KEY, JSON.stringify(livePrices));
          await AsyncStorage.setItem(GOLD_CACHE_TIME_KEY, Date.now().toString());

          return livePrices;
        }
      }
    } catch (e2) {
      console.warn('Secondary gold API failed:', e2);
    }

    // Return cached if available
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      return { ...parsed, isLive: false };
    }

    return FALLBACK_GOLD_PRICES;
  } catch (e) {
    console.warn('Failed to fetch live gold prices, using fallbacks:', e);
    return FALLBACK_GOLD_PRICES;
  }
}

/**
 * Calculates local price per gram of gold/silver in target currency
 */
export async function getLocalMetalPrices(targetCurrency: string, forceRefresh = false) {
  const metalsUsd = await getGoldAndSilverPrices(forceRefresh);
  const rates = await getExchangeRates(forceRefresh);

  const gold24kLocal = convertAmount(metalsUsd.gold24kUsdPerGram, 'USD', targetCurrency, rates);
  const gold21kLocal = convertAmount(metalsUsd.gold21kUsdPerGram, 'USD', targetCurrency, rates);
  const gold18kLocal = convertAmount(metalsUsd.gold18kUsdPerGram, 'USD', targetCurrency, rates);
  const silverLocal = convertAmount(metalsUsd.silverUsdPerGram, 'USD', targetCurrency, rates);

  return {
    gold24kLocal: Math.round(gold24kLocal * 10) / 10,
    gold21kLocal: Math.round(gold21kLocal * 10) / 10,
    gold18kLocal: Math.round(gold18kLocal * 10) / 10,
    silverLocal: Math.round(silverLocal * 10) / 10,
    isLive: metalsUsd.isLive,
    lastUpdated: metalsUsd.lastUpdated,
    rates,
  };
}
