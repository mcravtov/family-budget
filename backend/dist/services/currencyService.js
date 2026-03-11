"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRate = exports.updateExchangeRates = void 0;
const axios_1 = __importDefault(require("axios"));
const db_js_1 = __importDefault(require("../models/db.js"));
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'RON'];
const BASE_CURRENCY = 'MDL';
const updateExchangeRates = async () => {
    try {
        // For production, use a real API like: 
        // const response = await axios.get(`https://v6.exchangerate-api.com/v6/${process.env.CURRENCY_API_KEY}/latest/${BASE_CURRENCY}`);
        // const rates = response.data.conversion_rates;
        // Example with public API (free)
        const response = await axios_1.default.get(`https://api.exchangerate-api.com/v4/latest/${BASE_CURRENCY}`);
        const rates = response.data.rates;
        for (const currency of SUPPORTED_CURRENCIES) {
            if (rates[currency]) {
                // Rate is 1 MDL = X USD, so 1 USD = 1/X MDL
                const rateToMdl = 1 / rates[currency];
                await db_js_1.default.query(`INSERT INTO exchange_rates (currency, rate_to_mdl, last_updated) 
           VALUES ($1, $2, NOW()) 
           ON CONFLICT (currency) DO UPDATE SET rate_to_mdl = $2, last_updated = NOW()`, [currency, rateToMdl]);
            }
        }
        console.log('Exchange rates updated');
    }
    catch (error) {
        console.error('Error updating exchange rates', error);
    }
};
exports.updateExchangeRates = updateExchangeRates;
const getRate = async (currency) => {
    if (currency === BASE_CURRENCY)
        return 1;
    const res = await db_js_1.default.query('SELECT rate_to_mdl FROM exchange_rates WHERE currency = $1', [currency]);
    if (res.rows.length > 0)
        return parseFloat(res.rows[0].rate_to_mdl);
    // Hardcoded fallback if API fails
    const fallbacks = { 'USD': 18.0, 'EUR': 19.5, 'RON': 3.9 };
    return fallbacks[currency] || 1;
};
exports.getRate = getRate;
