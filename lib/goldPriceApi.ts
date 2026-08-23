import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExchangeRates, convertAmount } from './currencyApi';

const GOLD_CACHE_KEY = '@masarif_gold_prices_v2';
const GOLD_CACHE_TIME_KEY = '@masarif_gold_prices_time_v2';

export interface GoldPrices {
  gold24kUsdPerGram: number;
  gold22kUsdPerGram: number;
  gold21kUsdPerGram: number;
  gold18kUsdPerGram: number;
  silverUsdPerGram: number;
  silver925UsdPerGram: number;
  goldOunceUsd: number;
  silverOunceUsd: number;
  lastUpdated: string;
  isLive: boolean;
}

// Grams per Troy Ounce
const GRAMS_PER_TROY_OUNCE = 31.1034768;

// Modern market fallback rates in USD per gram (~$4600/oz Gold, ~$69/oz Silver)
export const FALLBACK_GOLD_PRICES: GoldPrices = {
  gold24kUsdPerGram: 148.0, // ~ $148.0 / gram 24K gold
  gold22kUsdPerGram: 135.6, // ~ $135.6 / gram 22K gold
  gold21kUsdPerGram: 129.5, // ~ $129.5 / gram 21K gold
  gold18kUsdPerGram: 111.0, // ~ $111.0 / gram 18K gold
  silverUsdPerGram: 2.22,   // ~ $2.22 / gram 999 silver
  silver925UsdPerGram: 2.05,// ~ $2.05 / gram 925 silver
  goldOunceUsd: 4604.4,
  silverOunceUsd: 69.1,
  lastUpdated: new Date().toISOString(),
  isLive: false,
};

export async function getGoldAndSilverPrices(forceRefresh = false): Promise<GoldPrices> {
  try {
    const cachedTime = await AsyncStorage.getItem(GOLD_CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(GOLD_CACHE_KEY);

    // 15-minute cache for metals
    const fifteenMinutes = 15 * 60 * 1000;
    if (!forceRefresh && cachedTime && cachedData && Date.now() - parseInt(cachedTime, 10) < fifteenMinutes) {
      return JSON.parse(cachedData);
    }

    // Endpoint 1: api.gold-api.com (Real-time spot Gold & Silver)
    try {
      const [goldRes, silverRes] = await Promise.all([
        fetch('https://api.gold-api.com/price/XAU', { headers: { 'Cache-Control': 'no-cache' } }),
        fetch('https://api.gold-api.com/price/XAG', { headers: { 'Cache-Control': 'no-cache' } })
      ]);

      if (goldRes.ok) {
        const goldData = await goldRes.json();
        const goldOunceUsd = parseFloat(goldData.price);

        let silverOunceUsd = 69.1;
        if (silverRes.ok) {
          const silverData = await silverRes.json();
          if (silverData.price) silverOunceUsd = parseFloat(silverData.price);
        }

        if (goldOunceUsd > 0) {
          const gold24kUsd = goldOunceUsd / GRAMS_PER_TROY_OUNCE;
          const gold22kUsd = gold24kUsd * (22 / 24);
          const gold21kUsd = gold24kUsd * (21 / 24);
          const gold18kUsd = gold24kUsd * (18 / 24);
          const silverUsd = silverOunceUsd / GRAMS_PER_TROY_OUNCE;
          const silver925Usd = silverUsd * 0.925;

          const livePrices: GoldPrices = {
            gold24kUsdPerGram: Math.round(gold24kUsd * 100) / 100,
            gold22kUsdPerGram: Math.round(gold22kUsd * 100) / 100,
            gold21kUsdPerGram: Math.round(gold21kUsd * 100) / 100,
            gold18kUsdPerGram: Math.round(gold18kUsd * 100) / 100,
            silverUsdPerGram: Math.round(silverUsd * 100) / 100,
            silver925UsdPerGram: Math.round(silver925Usd * 100) / 100,
            goldOunceUsd: Math.round(goldOunceUsd * 100) / 100,
            silverOunceUsd: Math.round(silverOunceUsd * 100) / 100,
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
      const res2 = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.usd && data2.usd.xau) {
          const goldOunceUsd = 1 / parseFloat(data2.usd.xau);
          const silverOunceUsd = data2.usd.xag ? (1 / parseFloat(data2.usd.xag)) : 69.1;

          const gold24kUsd = goldOunceUsd / GRAMS_PER_TROY_OUNCE;
          const gold22kUsd = gold24kUsd * (22 / 24);
          const gold21kUsd = gold24kUsd * (21 / 24);
          const gold18kUsd = gold24kUsd * (18 / 24);
          const silverUsd = silverOunceUsd / GRAMS_PER_TROY_OUNCE;
          const silver925Usd = silverUsd * 0.925;

          const livePrices: GoldPrices = {
            gold24kUsdPerGram: Math.round(gold24kUsd * 100) / 100,
            gold22kUsdPerGram: Math.round(gold22kUsd * 100) / 100,
            gold21kUsdPerGram: Math.round(gold21kUsd * 100) / 100,
            gold18kUsdPerGram: Math.round(gold18kUsd * 100) / 100,
            silverUsdPerGram: Math.round(silverUsd * 100) / 100,
            silver925UsdPerGram: Math.round(silver925Usd * 100) / 100,
            goldOunceUsd: Math.round(goldOunceUsd * 100) / 100,
            silverOunceUsd: Math.round(silverOunceUsd * 100) / 100,
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
  const gold22kLocal = convertAmount(metalsUsd.gold22kUsdPerGram, 'USD', targetCurrency, rates);
  const gold21kLocal = convertAmount(metalsUsd.gold21kUsdPerGram, 'USD', targetCurrency, rates);
  const gold18kLocal = convertAmount(metalsUsd.gold18kUsdPerGram, 'USD', targetCurrency, rates);
  const silverLocal = convertAmount(metalsUsd.silverUsdPerGram, 'USD', targetCurrency, rates);
  const silver925Local = convertAmount(metalsUsd.silver925UsdPerGram, 'USD', targetCurrency, rates);

  const goldNisabLocal = gold24kLocal * 85; // 85g 24K gold
  const silverNisabLocal = silverLocal * 595; // 595g silver

  return {
    gold24kLocal: Math.round(gold24kLocal * 100) / 100,
    gold22kLocal: Math.round(gold22kLocal * 100) / 100,
    gold21kLocal: Math.round(gold21kLocal * 100) / 100,
    gold18kLocal: Math.round(gold18kLocal * 100) / 100,
    silverLocal: Math.round(silverLocal * 100) / 100,
    silver925Local: Math.round(silver925Local * 100) / 100,
    goldNisabLocal: Math.round(goldNisabLocal),
    silverNisabLocal: Math.round(silverNisabLocal),
    goldOunceUsd: metalsUsd.goldOunceUsd,
    silverOunceUsd: metalsUsd.silverOunceUsd,
    isLive: metalsUsd.isLive,
    lastUpdated: metalsUsd.lastUpdated,
    rates,
  };
}
