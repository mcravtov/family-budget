"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRegistrationStatus = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = __importDefault(require("../models/db.js"));
const register = async (req, res) => {
    const { username, password } = req.body;
    try {
        const settings = await db_js_1.default.query("SELECT value FROM app_settings WHERE key = 'registration_enabled'");
        const registrationEnabled = settings.rows[0]?.value;
        const userCount = await db_js_1.default.query("SELECT COUNT(*) FROM users");
        const isFirstUser = parseInt(userCount.rows[0].count) === 0;
        if (!registrationEnabled && !isFirstUser) {
            return res.status(403).json({ error: 'Registration is disabled' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // All users in the same setup belong to family_id = 1 for now
        const result = await db_js_1.default.query('INSERT INTO users (username, password_hash, is_admin, family_id) VALUES ($1, $2, $3, 1) RETURNING id, username, is_admin, family_id', [username, hashedPassword, isFirstUser]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ error: 'User already exists or database error' });
    }
};
exports.register = register;
const login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db_js_1.default.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0)
            return res.status(401).json({ error: 'Invalid credentials' });
        const user = result.rows[0];
        const valid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!valid)
            return res.status(401).json({ error: 'Invalid credentials' });
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, is_admin: user.is_admin, family_id: user.family_id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username: user.username, is_admin: user.is_admin });
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
exports.login = login;
const getRegistrationStatus = async (req, res) => {
    try {
        const settings = await db_js_1.default.query("SELECT value FROM app_settings WHERE key = 'registration_enabled'");
        res.json({ enabled: settings.rows[0]?.value });
    }
    catch (error) {
        res.status(500).json({ error: 'Error' });
    }
};
exports.getRegistrationStatus = getRegistrationStatus;
