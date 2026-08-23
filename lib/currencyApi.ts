import AsyncStorage from '@react-native-async-storage/async-storage';

const RATES_CACHE_KEY = '@masarif_exchange_rates_v2';
const RATES_CACHE_TIME_KEY = '@masarif_exchange_rates_time_v2';

// Live fallback rates relative to USD (1 USD = X Currency)
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EGP: 50.88,  // 1 USD = ~50.88 EGP
  SAR: 3.75,
  AED: 3.6725,
  KWD: 0.3055, // 1 KWD = ~3.27 USD
  QAR: 3.64,
  BHD: 0.376,
  OMR: 0.385,
  JOD: 0.709,
  EUR: 0.856,
  GBP: 0.745,
  TRY: 38.2,
  CAD: 1.38,
  CHF: 0.81,
  MAD: 9.85,
  DZD: 133.5,
  TND: 3.08,
};

export interface ExchangeRatesResponse {
  rates: Record<string, number>;
  time_last_update_utc?: string;
}

export interface RatesDetails {
  rates: Record<string, number>;
  isLive: boolean;
  lastUpdated: string;
}

export async function getExchangeRates(forceRefresh = false): Promise<Record<string, number>> {
  const details = await getExchangeRatesDetails(forceRefresh);
  return details.rates;
}

export async function getExchangeRatesDetails(forceRefresh = false): Promise<RatesDetails> {
  try {
    const cachedTime = await AsyncStorage.getItem(RATES_CACHE_TIME_KEY);
    const cachedRates = await AsyncStorage.getItem(RATES_CACHE_KEY);
    
    // 15-minute cache for freshness unless forceRefresh is true
    const fifteenMinutes = 15 * 60 * 1000;
    if (!forceRefresh && cachedTime && cachedRates && Date.now() - parseInt(cachedTime, 10) < fifteenMinutes) {
      return {
        rates: JSON.parse(cachedRates),
        isLive: true,
        lastUpdated: new Date(parseInt(cachedTime, 10)).toISOString(),
      };
    }
    
    // Endpoint 1: open.er-api.com (Reliable, free, no key needed, real-time rates)
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (response.ok) {
        const data: ExchangeRatesResponse = await response.json();
        if (data && data.rates) {
          const mergedRates: Record<string, number> = { ...FALLBACK_RATES };
          Object.keys(data.rates).forEach((currency) => {
            mergedRates[currency] = data.rates[currency];
          });
          
          const nowStr = new Date().toISOString();
          await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify(mergedRates));
          await AsyncStorage.setItem(RATES_CACHE_TIME_KEY, Date.now().toString());
          
          return {
            rates: mergedRates,
            isLive: true,
            lastUpdated: nowStr,
          };
        }
      }
    } catch (err1) {
      console.warn('Primary exchange rate endpoint failed, trying secondary:', err1);
    }

    // Endpoint 2: fawazahmed0 currency-api fallback
    try {
      const response2 = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (response2.ok) {
        const data2 = await response2.json();
        if (data2 && data2.usd) {
          const mergedRates: Record<string, number> = { ...FALLBACK_RATES };
          Object.keys(FALLBACK_RATES).forEach((currency) => {
            const lowerKey = currency.toLowerCase();
            if (data2.usd[lowerKey]) {
              mergedRates[currency] = data2.usd[lowerKey];
            }
          });

          const nowStr = new Date().toISOString();
          await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify(mergedRates));
          await AsyncStorage.setItem(RATES_CACHE_TIME_KEY, Date.now().toString());

          return {
            rates: mergedRates,
            isLive: true,
            lastUpdated: nowStr,
          };
        }
      }
    } catch (err2) {
      console.warn('Secondary exchange rate endpoint failed:', err2);
    }

    // If fetch failed but we have cache, use cache
    if (cachedRates) {
      return {
        rates: JSON.parse(cachedRates),
        isLive: false,
        lastUpdated: cachedTime ? new Date(parseInt(cachedTime, 10)).toISOString() : new Date().toISOString(),
      };
    }

    return {
      rates: FALLBACK_RATES,
      isLive: false,
      lastUpdated: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('Failed to fetch live currency rates, using fallback:', e);
    return {
      rates: FALLBACK_RATES,
      isLive: false,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount;
  
  const rateFrom = rates[from] || FALLBACK_RATES[from] || 1;
  const rateTo = rates[to] || FALLBACK_RATES[to] || 1;
  
  const amountInUSD = amount / rateFrom;
  return amountInUSD * rateTo;
}
