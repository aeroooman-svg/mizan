import AsyncStorage from '@react-native-async-storage/async-storage';

const RATES_CACHE_KEY = '@masarif_exchange_rates';
const RATES_CACHE_TIME_KEY = '@masarif_exchange_rates_time';

// Approx fallback rates relative to USD
// e.g. 1 USD = X EGP
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EGP: 50.0,  // 1 USD = 50 EGP
  KWD: 0.31,  // 1 USD = 0.31 KWD (so 1 KWD = 3.25 USD)
  SAR: 3.75,
  AED: 3.67,
  EUR: 0.92,
  GBP: 0.79,
  QAR: 3.64,
  BHD: 0.38,
  OMR: 0.39,
};

export interface ExchangeRatesResponse {
  rates: Record<string, number>;
  time_last_update_utc?: string;
}

export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    // Check cache first
    const cachedTime = await AsyncStorage.getItem(RATES_CACHE_TIME_KEY);
    const cachedRates = await AsyncStorage.getItem(RATES_CACHE_KEY);
    
    const oneDay = 24 * 60 * 60 * 1000;
    if (cachedTime && cachedRates && Date.now() - parseInt(cachedTime, 10) < oneDay) {
      return JSON.parse(cachedRates);
    }
    
    // Fetch live rates (using open.er-api.com)
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('API request failed');
    
    const data: ExchangeRatesResponse = await response.json();
    if (data && data.rates) {
      // Filter only currencies we support
      const filteredRates: Record<string, number> = {};
      Object.keys(FALLBACK_RATES).forEach((currency) => {
        if (data.rates[currency]) {
          filteredRates[currency] = data.rates[currency];
        } else {
          filteredRates[currency] = FALLBACK_RATES[currency];
        }
      });
      
      // Save cache
      await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify(filteredRates));
      await AsyncStorage.setItem(RATES_CACHE_TIME_KEY, Date.now().toString());
      
      return filteredRates;
    }
    
    return FALLBACK_RATES;
  } catch (e) {
    console.warn('Failed to fetch live currency rates, using fallback:', e);
    // If cache exists (even if stale), use it before falling back to hardcoded
    const cachedRates = await AsyncStorage.getItem(RATES_CACHE_KEY);
    if (cachedRates) {
      try {
        return JSON.parse(cachedRates);
      } catch (err) {}
    }
    return FALLBACK_RATES;
  }
}

export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount;
  
  // Rates are relative to USD
  // 1 USD = rates[from] -> so amount in USD = amount / rates[from]
  // amount in target currency = USD_amount * rates[to]
  const rateFrom = rates[from] || FALLBACK_RATES[from] || 1;
  const rateTo = rates[to] || FALLBACK_RATES[to] || 1;
  
  const amountInUSD = amount / rateFrom;
  return amountInUSD * rateTo;
}
