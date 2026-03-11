import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../models/db.js';
import { getRate } from '../services/currencyService.js';
import bcrypt from 'bcryptjs';

const logAction = async (userId: number | undefined, username: string | undefined, familyId: number | undefined, type: string, details: string) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, username, family_id, action_type, details) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, familyId || 1, type, details]
    );
  } catch (e) { console.error('Logging failed', e); }
};

// Categories
export const getCategories = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  try {
    const result = await pool.query('SELECT * FROM categories WHERE family_id = $1 OR user_id IS NULL ORDER BY name ASC', [familyId]);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
};

export const addCategory = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const username = req.user?.username;
  const familyId = req.user?.family_id || 1;
  const { name, type, budget_limit } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO categories (name, type, user_id, family_id, budget_limit) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, type, userId, familyId, budget_limit || 0]
    );
    await logAction(userId, username, familyId, 'ADD_CATEGORY', `Category: ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const username = req.user?.username;
  const familyId = req.user?.family_id || 1;
  const { id } = req.params;
  const { name, type, budget_limit } = req.body;
  try {
    await pool.query(
      'UPDATE categories SET name = $1, type = $2, budget_limit = $3 WHERE id = $4 AND (family_id = $5 OR user_id IS NULL)',
      [name, type, budget_limit || 0, id, familyId]
    );
    await logAction(userId, username, familyId, 'UPDATE_CATEGORY', `Updated: ${name}`);
    res.sendStatus(204);
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const username = req.user?.username;
  const familyId = req.user?.family_id || 1;
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM categories WHERE id = $1 AND (family_id = $2 OR user_id IS NULL)', [id, familyId]);
    await logAction(userId, username, familyId, 'DELETE_CATEGORY', `ID: ${id}`);
    res.sendStatus(204);
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
};

// Transactions
export const getTransactions = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { startDate, endDate } = req.query;
  try {
    let queryText = `
      SELECT t.*, c.name as category_name, u.username as owner_name
      FROM transactions t 
      LEFT JOIN categories c ON t.category_id = c.id 
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.family_id = $1`;
    const params: any[] = [familyId];
    if (startDate && endDate) { queryText += ` AND t.date BETWEEN $2 AND $3`; params.push(startDate, endDate); }
    queryText += ` ORDER BY t.date DESC`;
    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
};

export const addTransaction = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const username = req.user?.username;
  const familyId = req.user?.family_id || 1;
  const { category_id, amount, currency, description, type, date, is_recurring } = req.body;
  try {
    const rate = await getRate(currency);
    const amountMdl = parseFloat(amount) * rate;
    const result = await pool.query(
      `INSERT INTO transactions (user_id, family_id, category_id, amount, currency, amount_mdl, description, type, date, is_recurring) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [userId, familyId, category_id, amount, currency, amountMdl, description, type, date || new Date(), is_recurring || false]
    );
    await logAction(userId, username, familyId, 'ADD_TRANSACTION', `${amount} ${currency} (${type})`);
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
};

export const getSummary = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { startDate, endDate } = req.query;
  try {
    const params: any[] = [familyId];
    let dateFilter = "";
    if (startDate && endDate) { dateFilter = " AND t.date BETWEEN $2 AND $3"; params.push(startDate, endDate); }
    const summaryResult = await pool.query(
      `SELECT SUM(CASE WHEN type = 'income' THEN amount_mdl ELSE 0 END) as total_income,
              SUM(CASE WHEN type = 'expense' THEN amount_mdl ELSE 0 END) as total_expense
       FROM transactions WHERE family_id = $1 ${dateFilter.replace('t.','')}`, params);
    const categoryAnalysis = await pool.query(
      `SELECT c.id, c.name, c.budget_limit, COALESCE(SUM(t.amount_mdl), 0) as total
       FROM categories c LEFT JOIN transactions t ON t.category_id = c.id ${dateFilter}
       WHERE c.family_id = $1 AND c.type = 'expense'
       GROUP BY c.id, c.name, c.budget_limit ORDER BY total DESC`, params);
    res.json({ summary: summaryResult.rows[0], categories: categoryAnalysis.rows });
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
};

// Savings Goals
export const getGoals = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  try {
    const result = await pool.query('SELECT * FROM savings_goals WHERE family_id = $1', [familyId]);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const addGoal = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { name, target_amount, currency } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO savings_goals (family_id, name, target_amount, currency) VALUES ($1, $2, $3, $4) RETURNING *',
      [familyId, name, target_amount, currency || 'MDL']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const updateGoal = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { id } = req.params;
  const { current_amount } = req.body;
  try {
    await pool.query('UPDATE savings_goals SET current_amount = $1 WHERE id = $2 AND family_id = $3', [current_amount, id, familyId]);
    res.sendStatus(204);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const deleteGoal = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM savings_goals WHERE id = $1 AND family_id = $2', [id, familyId]);
    res.sendStatus(204);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

// Export CSV
export const exportCSV = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  try {
    const result = await pool.query(
      `SELECT t.date, t.amount, t.currency, t.amount_mdl, t.description, t.type, c.name as category, u.username
       FROM transactions t 
       JOIN categories c ON t.category_id = c.id 
       JOIN users u ON t.user_id = u.id
       WHERE t.family_id = $1 ORDER BY t.date DESC`, [familyId]);
    
    let csv = 'Date,Amount,Currency,Amount MDL,Description,Type,Category,User\n';
    result.rows.forEach(r => {
      csv += `${r.date.toISOString().split('T')[0]},${r.amount},${r.currency},${r.amount_mdl},"${r.description || ''}",${r.type},${r.category},${r.username}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=budget_export.csv');
    res.status(200).send(csv);
  } catch (error) { res.status(500).json({ error: 'Export failed' }); }
};

// Admin
export const getRates = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT currency, rate_to_mdl FROM exchange_rates');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  try {
    const result = await pool.query('SELECT * FROM audit_logs WHERE family_id = $1 ORDER BY created_at DESC LIMIT 50', [familyId]);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  try {
    const result = await pool.query('SELECT id, username, is_admin FROM users WHERE family_id = $1 ORDER BY id ASC', [familyId]);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { username, password, is_admin } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password_hash, is_admin, family_id) VALUES ($1, $2, $3, $4)', [username, hashedPassword, is_admin || false, familyId]);
    res.sendStatus(201);
  } catch (error) { res.status(500).json({ error: 'User already exists' }); }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1 AND family_id = $2', [id, familyId]);
    res.sendStatus(204);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const updateRegistrationSetting = async (req: AuthRequest, res: Response) => {
  const { enabled } = req.body;
  try {
    await pool.query("UPDATE app_settings SET value = $1 WHERE key = 'registration_enabled'", [enabled]);
    res.sendStatus(204);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};
