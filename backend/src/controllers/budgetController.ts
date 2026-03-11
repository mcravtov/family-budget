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
    const result = await pool.query(
      'SELECT * FROM categories WHERE family_id = $1 OR user_id IS NULL ORDER BY name ASC', 
      [familyId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
};

export const addCategory = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const username = req.user?.username;
  const familyId = req.user?.family_id || 1;
  const { name, type } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO categories (name, type, user_id, family_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, type, userId, familyId]
    );
    await logAction(userId, username, familyId, 'ADD_CATEGORY', `Category: ${name} (${type})`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const username = req.user?.username;
  const familyId = req.user?.family_id || 1;
  const isAdmin = req.user?.is_admin;
  const { id } = req.params;
  const { name, type } = req.body;
  try {
    let oldCat;
    if (isAdmin) {
      oldCat = await pool.query('SELECT name, type FROM categories WHERE id = $1 AND family_id = $2', [id, familyId]);
    } else {
      oldCat = await pool.query('SELECT name, type FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
    }

    if (oldCat.rows.length === 0) return res.status(404).json({ error: 'Access denied' });

    const result = await pool.query(
      'UPDATE categories SET name = $1, type = $2 WHERE id = $3 RETURNING *',
      [name, type, id]
    );
    
    await logAction(userId, username, familyId, 'UPDATE_CATEGORY', 
      `Changed category "${oldCat.rows[0].name}" to "${name}" (${type})`);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const username = req.user?.username;
  const familyId = req.user?.family_id || 1;
  const isAdmin = req.user?.is_admin;
  const { id } = req.params;
  try {
    let check;
    if (isAdmin) {
      check = await pool.query('SELECT name FROM categories WHERE id = $1 AND family_id = $2', [id, familyId]);
    } else {
      check = await pool.query('SELECT name FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
    }

    if (check.rows.length === 0) return res.status(404).json({ error: 'Access denied' });

    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    await logAction(userId, username, familyId, 'DELETE_CATEGORY', `Category: ${check.rows[0].name}`);
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
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

    if (startDate && endDate) {
      queryText += ` AND t.date BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    queryText += ` ORDER BY t.date DESC`;
    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
};

export const addTransaction = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const username = req.user?.username;
  const familyId = req.user?.family_id || 1;
  const { category_id, amount, currency, description, type, date } = req.body;
  
  try {
    const rate = await getRate(currency);
    const amountMdl = parseFloat(amount) * rate;

    const result = await pool.query(
      `INSERT INTO transactions (user_id, family_id, category_id, amount, currency, amount_mdl, description, type, date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, familyId, category_id, amount, currency, amountMdl, description, type, date || new Date()]
    );
    
    const cat = await pool.query('SELECT name FROM categories WHERE id = $1', [category_id]);
    await logAction(userId, username, familyId, 'ADD_TRANSACTION', 
      `${type === 'income' ? 'Income' : 'Expense'}: ${amount} ${currency} (${cat.rows[0]?.name})`);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
};

export const getSummary = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { startDate, endDate } = req.query;
  try {
    let whereClause = `WHERE family_id = $1`;
    const params: any[] = [familyId];

    if (startDate && endDate) {
      whereClause += ` AND date BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    const result = await pool.query(
      `SELECT 
        SUM(CASE WHEN type = 'income' THEN amount_mdl ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount_mdl ELSE 0 END) as total_expense
       FROM transactions 
       ${whereClause}`,
      params
    );
    
    const categoryAnalysis = await pool.query(
      `SELECT c.name, SUM(t.amount_mdl) as total
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.family_id = $1 AND t.type = 'expense'
       ${startDate && endDate ? ' AND t.date BETWEEN $2 AND $3' : ''}
       GROUP BY c.name`,
      params
    );

    res.json({
      summary: result.rows[0],
      categories: categoryAnalysis.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
};

// Logs and Admin Actions
export const getRates = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT currency, rate_to_mdl FROM exchange_rates');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  try {
    const result = await pool.query('SELECT * FROM audit_logs WHERE family_id = $1 ORDER BY created_at DESC LIMIT 50', [familyId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  try {
    const result = await pool.query('SELECT id, username, is_admin FROM users WHERE family_id = $1 ORDER BY id ASC', [familyId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { username, password, is_admin } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, is_admin, family_id) VALUES ($1, $2, $3, $4) RETURNING id, username, is_admin',
      [username, hashedPassword, is_admin || false, familyId]
    );
    await logAction(req.user?.id, req.user?.username, familyId, 'ADMIN_CREATE_USER', `Created user: ${username}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'User already exists or database error' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { id } = req.params;
  try {
    const userToDelete = await pool.query('SELECT username FROM users WHERE id = $1 AND family_id = $2', [id, familyId]);
    if (userToDelete.rows.length === 0) return res.status(404).json({ error: 'User not found in your family' });

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await logAction(req.user?.id, req.user?.username, familyId, 'DELETE_USER', `Deleted user: ${userToDelete.rows[0].username}`);
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
};

export const updateRegistrationSetting = async (req: AuthRequest, res: Response) => {
  const familyId = req.user?.family_id || 1;
  const { enabled } = req.body;
  try {
    await pool.query("UPDATE app_settings SET value = $1 WHERE key = 'registration_enabled'", [enabled]);
    await logAction(req.user?.id, req.user?.username, familyId, 'CONFIG_CHANGE', `Registration ${enabled ? 'enabled' : 'disabled'}`);
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
};
