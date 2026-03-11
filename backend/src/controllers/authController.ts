import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../models/db.js';

export const register = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const settings = await pool.query("SELECT value FROM app_settings WHERE key = 'registration_enabled'");
    const registrationEnabled = settings.rows[0]?.value;

    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    const isFirstUser = parseInt(userCount.rows[0].count) === 0;

    if (!registrationEnabled && !isFirstUser) {
      return res.status(403).json({ error: 'Registration is disabled' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // All users in the same setup belong to family_id = 1 for now
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, is_admin, family_id) VALUES ($1, $2, $3, 1) RETURNING id, username, is_admin, family_id',
      [username, hashedPassword, isFirstUser]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'User already exists or database error' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin, family_id: user.family_id },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );
    res.json({ token, username: user.username, is_admin: user.is_admin });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const getRegistrationStatus = async (req: Request, res: Response) => {
  try {
    const settings = await pool.query("SELECT value FROM app_settings WHERE key = 'registration_enabled'");
    res.json({ enabled: settings.rows[0]?.value });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
};
