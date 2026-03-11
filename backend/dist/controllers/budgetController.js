"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRegistrationSetting = exports.deleteUser = exports.createUser = exports.getUsers = exports.getAuditLogs = exports.getRates = exports.getSummary = exports.addTransaction = exports.getTransactions = exports.deleteCategory = exports.updateCategory = exports.addCategory = exports.getCategories = void 0;
const db_js_1 = __importDefault(require("../models/db.js"));
const currencyService_js_1 = require("../services/currencyService.js");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logAction = async (userId, username, familyId, type, details) => {
    try {
        await db_js_1.default.query('INSERT INTO audit_logs (user_id, username, family_id, action_type, details) VALUES ($1, $2, $3, $4, $5)', [userId, username, familyId || 1, type, details]);
    }
    catch (e) {
        console.error('Logging failed', e);
    }
};
// Categories
const getCategories = async (req, res) => {
    const familyId = req.user?.family_id || 1;
    try {
        const result = await db_js_1.default.query('SELECT * FROM categories WHERE family_id = $1 OR user_id IS NULL ORDER BY name ASC', [familyId]);
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};
exports.getCategories = getCategories;
const addCategory = async (req, res) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    const familyId = req.user?.family_id || 1;
    const { name, type } = req.body;
    try {
        const result = await db_js_1.default.query('INSERT INTO categories (name, type, user_id, family_id) VALUES ($1, $2, $3, $4) RETURNING *', [name, type, userId, familyId]);
        await logAction(userId, username, familyId, 'ADD_CATEGORY', `Category: ${name} (${type})`);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};
exports.addCategory = addCategory;
const updateCategory = async (req, res) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    const familyId = req.user?.family_id || 1;
    const isAdmin = req.user?.is_admin;
    const { id } = req.params;
    const { name, type } = req.body;
    try {
        let oldCat;
        if (isAdmin) {
            oldCat = await db_js_1.default.query('SELECT name, type FROM categories WHERE id = $1 AND family_id = $2', [id, familyId]);
        }
        else {
            oldCat = await db_js_1.default.query('SELECT name, type FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
        }
        if (oldCat.rows.length === 0)
            return res.status(404).json({ error: 'Access denied' });
        const result = await db_js_1.default.query('UPDATE categories SET name = $1, type = $2 WHERE id = $3 RETURNING *', [name, type, id]);
        await logAction(userId, username, familyId, 'UPDATE_CATEGORY', `Changed category "${oldCat.rows[0].name}" to "${name}" (${type})`);
        res.json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    const familyId = req.user?.family_id || 1;
    const isAdmin = req.user?.is_admin;
    const { id } = req.params;
    try {
        let check;
        if (isAdmin) {
            check = await db_js_1.default.query('SELECT name FROM categories WHERE id = $1 AND family_id = $2', [id, familyId]);
        }
        else {
            check = await db_js_1.default.query('SELECT name FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
        }
        if (check.rows.length === 0)
            return res.status(404).json({ error: 'Access denied' });
        await db_js_1.default.query('DELETE FROM categories WHERE id = $1', [id]);
        await logAction(userId, username, familyId, 'DELETE_CATEGORY', `Category: ${check.rows[0].name}`);
        res.sendStatus(204);
    }
    catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};
exports.deleteCategory = deleteCategory;
// Transactions
const getTransactions = async (req, res) => {
    const familyId = req.user?.family_id || 1;
    const { startDate, endDate } = req.query;
    try {
        let queryText = `
      SELECT t.*, c.name as category_name, u.username as owner_name
      FROM transactions t 
      LEFT JOIN categories c ON t.category_id = c.id 
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.family_id = $1`;
        const params = [familyId];
        if (startDate && endDate) {
            queryText += ` AND t.date BETWEEN $2 AND $3`;
            params.push(startDate, endDate);
        }
        queryText += ` ORDER BY t.date DESC`;
        const result = await db_js_1.default.query(queryText, params);
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};
exports.getTransactions = getTransactions;
const addTransaction = async (req, res) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    const familyId = req.user?.family_id || 1;
    const { category_id, amount, currency, description, type, date } = req.body;
    try {
        const rate = await (0, currencyService_js_1.getRate)(currency);
        const amountMdl = parseFloat(amount) * rate;
        const result = await db_js_1.default.query(`INSERT INTO transactions (user_id, family_id, category_id, amount, currency, amount_mdl, description, type, date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [userId, familyId, category_id, amount, currency, amountMdl, description, type, date || new Date()]);
        const cat = await db_js_1.default.query('SELECT name FROM categories WHERE id = $1', [category_id]);
        await logAction(userId, username, familyId, 'ADD_TRANSACTION', `${type === 'income' ? 'Income' : 'Expense'}: ${amount} ${currency} (${cat.rows[0]?.name})`);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
};
exports.addTransaction = addTransaction;
const getSummary = async (req, res) => {
    const familyId = req.user?.family_id || 1;
    const { startDate, endDate } = req.query;
    try {
        let whereClause = `WHERE family_id = $1`;
        const params = [familyId];
        if (startDate && endDate) {
            whereClause += ` AND date BETWEEN $2 AND $3`;
            params.push(startDate, endDate);
        }
        const result = await db_js_1.default.query(`SELECT 
        SUM(CASE WHEN type = 'income' THEN amount_mdl ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount_mdl ELSE 0 END) as total_expense
       FROM transactions 
       ${whereClause}`, params);
        const categoryAnalysis = await db_js_1.default.query(`SELECT c.name, SUM(t.amount_mdl) as total
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.family_id = $1 AND t.type = 'expense'
       ${startDate && endDate ? ' AND t.date BETWEEN $2 AND $3' : ''}
       GROUP BY c.name`, params);
        res.json({
            summary: result.rows[0],
            categories: categoryAnalysis.rows
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};
exports.getSummary = getSummary;
// Logs and Admin Actions
const getRates = async (req, res) => {
    try {
        const result = await db_js_1.default.query('SELECT currency, rate_to_mdl FROM exchange_rates');
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ error: 'Error' });
    }
};
exports.getRates = getRates;
const getAuditLogs = async (req, res) => {
    const familyId = req.user?.family_id || 1;
    try {
        const result = await db_js_1.default.query('SELECT * FROM audit_logs WHERE family_id = $1 ORDER BY created_at DESC LIMIT 50', [familyId]);
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ error: 'Error' });
    }
};
exports.getAuditLogs = getAuditLogs;
const getUsers = async (req, res) => {
    const familyId = req.user?.family_id || 1;
    try {
        const result = await db_js_1.default.query('SELECT id, username, is_admin FROM users WHERE family_id = $1 ORDER BY id ASC', [familyId]);
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ error: 'Error' });
    }
};
exports.getUsers = getUsers;
const createUser = async (req, res) => {
    const familyId = req.user?.family_id || 1;
    const { username, password, is_admin } = req.body;
    try {
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const result = await db_js_1.default.query('INSERT INTO users (username, password_hash, is_admin, family_id) VALUES ($1, $2, $3, $4) RETURNING id, username, is_admin', [username, hashedPassword, is_admin || false, familyId]);
        await logAction(req.user?.id, req.user?.username, familyId, 'ADMIN_CREATE_USER', `Created user: ${username}`);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ error: 'User already exists or database error' });
    }
};
exports.createUser = createUser;
const deleteUser = async (req, res) => {
    const familyId = req.user?.family_id || 1;
    const { id } = req.params;
    try {
        const userToDelete = await db_js_1.default.query('SELECT username FROM users WHERE id = $1 AND family_id = $2', [id, familyId]);
        if (userToDelete.rows.length === 0)
            return res.status(404).json({ error: 'User not found in your family' });
        await db_js_1.default.query('DELETE FROM users WHERE id = $1', [id]);
        await logAction(req.user?.id, req.user?.username, familyId, 'DELETE_USER', `Deleted user: ${userToDelete.rows[0].username}`);
        res.sendStatus(204);
    }
    catch (error) {
        res.status(500).json({ error: 'Error' });
    }
};
exports.deleteUser = deleteUser;
const updateRegistrationSetting = async (req, res) => {
    const familyId = req.user?.family_id || 1;
    const { enabled } = req.body;
    try {
        await db_js_1.default.query("UPDATE app_settings SET value = $1 WHERE key = 'registration_enabled'", [enabled]);
        await logAction(req.user?.id, req.user?.username, familyId, 'CONFIG_CHANGE', `Registration ${enabled ? 'enabled' : 'disabled'}`);
        res.sendStatus(204);
    }
    catch (error) {
        res.status(500).json({ error: 'Error' });
    }
};
exports.updateRegistrationSetting = updateRegistrationSetting;
