import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExchangeRates, convertAmount } from './currencyApi';

const GOLD_CACHE_KEY = '@masarif_gold_prices';
const GOLD_CACHE_TIME_KEY = '@masarif_gold_prices_time';

export interface GoldPrices {
  gold24kUsdPerGram: number;
  gold21kUsdPerGram: number;
  silverUsdPerGram: number;
  lastUpdated: string;
  isLive: boolean;
}

// Fallback rates in USD per gram
export const FALLBACK_GOLD_PRICES: GoldPrices = {
  gold24kUsdPerGram: 88.5, // ~ $88.5 / gram 24K gold
  gold21kUsdPerGram: 77.4, // ~ $77.4 / gram 21K gold (87.5% purity)
  silverUsdPerGram: 1.05,  // ~ $1.05 / gram silver
  lastUpdated: new Date().toISOString(),
  isLive: false,
};

export async function getGoldAndSilverPrices(): Promise<GoldPrices> {
  try {
    // Check local cache
    const cachedTime = await AsyncStorage.getItem(GOLD_CACHE_TIME_KEY);
    const cachedData = await AsyncStorage.getItem(GOLD_CACHE_KEY);

    const sixHours = 6 * 60 * 60 * 1000;
    if (cachedTime && cachedData && Date.now() - parseInt(cachedTime, 10) < sixHours) {
      return JSON.parse(cachedData);
    }

    // Try fetching live price from open gold API
    const res = await fetch('https://api.metals.live/v1/spot');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].gold) {
        const goldOunceUsd = parseFloat(data[0].gold);
        const silverOunceUsd = parseFloat(data[0].silver || '31.0');

        // 1 troy ounce = 31.1034768 grams
        const gold24kUsd = goldOunceUsd / 31.1034768;
        const gold21kUsd = gold24kUsd * (21 / 24);
        const silverUsd = silverOunceUsd / 31.1034768;

        const livePrices: GoldPrices = {
          gold24kUsdPerGram: Math.round(gold24kUsd * 100) / 100,
          gold21kUsdPerGram: Math.round(gold21kUsd * 100) / 100,
          silverUsdPerGram: Math.round(silverUsd * 100) / 100,
          lastUpdated: new Date().toISOString(),
          isLive: true,
        };

        await AsyncStorage.setItem(GOLD_CACHE_KEY, JSON.stringify(livePrices));
        await AsyncStorage.setItem(GOLD_CACHE_TIME_KEY, Date.now().toString());

        return livePrices;
      }
    }

    // Secondary live endpoint attempt
    const secondaryRes = await fetch('https://data-asg.goldprice.org/dbdata/USD');
    if (secondaryRes.ok) {
      const secData = await secondaryRes.json();
      if (secData && secData.items && secData.items[0] && secData.items[0].xauPrice) {
        const goldOunceUsd = parseFloat(secData.items[0].xauPrice);
        const silverOunceUsd = parseFloat(secData.items[0].xagPrice || '31.0');

        const gold24kUsd = goldOunceUsd / 31.1034768;
        const gold21kUsd = gold24kUsd * (21 / 24);
        const silverUsd = silverOunceUsd / 31.1034768;

        const livePrices: GoldPrices = {
          gold24kUsdPerGram: Math.round(gold24kUsd * 100) / 100,
          gold21kUsdPerGram: Math.round(gold21kUsd * 100) / 100,
          silverUsdPerGram: Math.round(silverUsd * 100) / 100,
          lastUpdated: new Date().toISOString(),
          isLive: true,
        };

        await AsyncStorage.setItem(GOLD_CACHE_KEY, JSON.stringify(livePrices));
        await AsyncStorage.setItem(GOLD_CACHE_TIME_KEY, Date.now().toString());

        return livePrices;
      }
    }

    return FALLBACK_GOLD_PRICES;
  } catch (e) {
    console.warn('Failed to fetch live gold prices, using fallbacks:', e);
    const cachedData = await AsyncStorage.getItem(GOLD_CACHE_KEY);
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch (err) {}
    }
    return FALLBACK_GOLD_PRICES;
  }
}

/**
 * Calculates local price per gram of gold/silver in target currency
 */
export async function getLocalMetalPrices(targetCurrency: string) {
  const metalsUsd = await getGoldAndSilverPrices();
  const rates = await getExchangeRates();

  const gold24kLocal = convertAmount(metalsUsd.gold24kUsdPerGram, 'USD', targetCurrency, rates);
  const gold21kLocal = convertAmount(metalsUsd.gold21kUsdPerGram, 'USD', targetCurrency, rates);
  const silverLocal = convertAmount(metalsUsd.silverUsdPerGram, 'USD', targetCurrency, rates);

  return {
    gold24kLocal: Math.round(gold24kLocal * 10) / 10,
    gold21kLocal: Math.round(gold21kLocal * 10) / 10,
    silverLocal: Math.round(silverLocal * 10) / 10,
    isLive: metalsUsd.isLive,
    lastUpdated: metalsUsd.lastUpdated,
  };
}
