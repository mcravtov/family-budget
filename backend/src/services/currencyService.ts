import axios from 'axios';
import pool from '../models/db.js';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'RON'];
const BASE_CURRENCY = 'MDL';

export const updateExchangeRates = async () => {
  try {
    // For production, use a real API like: 
    // const response = await axios.get(`https://v6.exchangerate-api.com/v6/${process.env.CURRENCY_API_KEY}/latest/${BASE_CURRENCY}`);
    // const rates = response.data.conversion_rates;

    // Example with public API (free)
    const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${BASE_CURRENCY}`);
    const rates = response.data.rates;

    for (const currency of SUPPORTED_CURRENCIES) {
      if (rates[currency]) {
        // Rate is 1 MDL = X USD, so 1 USD = 1/X MDL
        const rateToMdl = 1 / rates[currency];
        await pool.query(
          `INSERT INTO exchange_rates (currency, rate_to_mdl, last_updated) 
           VALUES ($1, $2, NOW()) 
           ON CONFLICT (currency) DO UPDATE SET rate_to_mdl = $2, last_updated = NOW()`,
          [currency, rateToMdl]
        );
      }
    }
    console.log('Exchange rates updated');
  } catch (error) {
    console.error('Error updating exchange rates', error);
  }
};

export const getRate = async (currency: string) => {
  if (currency === BASE_CURRENCY) return 1;
  const res = await pool.query('SELECT rate_to_mdl FROM exchange_rates WHERE currency = $1', [currency]);
  if (res.rows.length > 0) return parseFloat(res.rows[0].rate_to_mdl);
  
  // Hardcoded fallback if API fails
  const fallbacks: { [key: string]: number } = { 'USD': 18.0, 'EUR': 19.5, 'RON': 3.9 };
  return fallbacks[currency] || 1;
};
