import AsyncStorage from '@react-native-async-storage/async-storage';

const RATES_CACHE_KEY = '@masarif_exchange_rates';
const RATES_CACHE_TIME_KEY = '@masarif_exchange_rates_time';

// Live fallback rates relative to USD (1 USD = X Currency)
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EGP: 51.3,   // 1 USD = ~51.3 EGP
  KWD: 0.31,   // 1 USD = ~0.31 KWD (1 KWD = ~3.23 USD)
  SAR: 3.75,
  AED: 3.67,
  EUR: 0.88,
  GBP: 0.75,
  QAR: 3.64,
  BHD: 0.376,
  OMR: 0.385,
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
    
    // 2-hour cache by default unless forceRefresh is requested
    const twoHours = 2 * 60 * 60 * 1000;
    if (!forceRefresh && cachedTime && cachedRates && Date.now() - parseInt(cachedTime, 10) < twoHours) {
      return {
        rates: JSON.parse(cachedRates),
        isLive: true,
        lastUpdated: new Date(parseInt(cachedTime, 10)).toISOString(),
      };
    }
    
    // Endpoint 1: open.er-api.com
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (response.ok) {
        const data: ExchangeRatesResponse = await response.json();
        if (data && data.rates) {
          const filteredRates: Record<string, number> = {};
          Object.keys(FALLBACK_RATES).forEach((currency) => {
            if (data.rates[currency]) {
              filteredRates[currency] = data.rates[currency];
            } else {
              filteredRates[currency] = FALLBACK_RATES[currency];
            }
          });
          
          const nowStr = new Date().toISOString();
          await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify(filteredRates));
          await AsyncStorage.setItem(RATES_CACHE_TIME_KEY, Date.now().toString());
          
          return {
            rates: filteredRates,
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
      const response2 = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      if (response2.ok) {
        const data2 = await response2.json();
        if (data2 && data2.usd) {
          const filteredRates: Record<string, number> = {};
          Object.keys(FALLBACK_RATES).forEach((currency) => {
            const lowerKey = currency.toLowerCase();
            if (data2.usd[lowerKey]) {
              filteredRates[currency] = data2.usd[lowerKey];
            } else {
              filteredRates[currency] = FALLBACK_RATES[currency];
            }
          });

          const nowStr = new Date().toISOString();
          await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify(filteredRates));
          await AsyncStorage.setItem(RATES_CACHE_TIME_KEY, Date.now().toString());

          return {
            rates: filteredRates,
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
