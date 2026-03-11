import pool from './db.js';

const initDb = async () => {
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      family_id INTEGER DEFAULT 1
    );
  `;

  const appSettingsTable = `
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(50) PRIMARY KEY,
      value BOOLEAN DEFAULT TRUE
    );
  `;

  const auditLogsTable = `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      family_id INTEGER DEFAULT 1,
      username VARCHAR(100),
      action_type VARCHAR(50),
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const categoriesTable = `
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(20) NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      family_id INTEGER DEFAULT 1
    );
  `;

  const transactionsTable = `
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      family_id INTEGER DEFAULT 1,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      amount DECIMAL NOT NULL,
      currency VARCHAR(10) NOT NULL,
      amount_mdl DECIMAL NOT NULL,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      description TEXT,
      type VARCHAR(20) NOT NULL
    );
  `;

  const exchangeRatesTable = `
    CREATE TABLE IF NOT EXISTS exchange_rates (
      currency VARCHAR(10) PRIMARY KEY,
      rate_to_mdl DECIMAL NOT NULL,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  let retries = 5;
  while (retries > 0) {
    try {
      await pool.query(usersTable);
      
      // Migrations
      const columns = [
        { table: 'users', col: 'is_admin', type: 'BOOLEAN DEFAULT FALSE' },
        { table: 'users', col: 'family_id', type: 'INTEGER DEFAULT 1' },
        { table: 'transactions', col: 'family_id', type: 'INTEGER DEFAULT 1' },
        { table: 'categories', col: 'family_id', type: 'INTEGER DEFAULT 1' },
        { table: 'audit_logs', col: 'family_id', type: 'INTEGER DEFAULT 1' }
      ];

      for (const m of columns) {
        const check = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='${m.table}' AND column_name='${m.col}'`);
        if (check.rows.length === 0) {
          await pool.query(`ALTER TABLE ${m.table} ADD COLUMN ${m.col} ${m.type}`);
          console.log(`Migration: Added ${m.col} to ${m.table}`);
        }
      }

      await pool.query(appSettingsTable);
      await pool.query(auditLogsTable);
      await pool.query(categoriesTable);
      await pool.query(transactionsTable);
      await pool.query(exchangeRatesTable);
      
      const adminCheck = await pool.query("SELECT COUNT(*) FROM users WHERE is_admin = TRUE");
      if (parseInt(adminCheck.rows[0].count) === 0) {
        const firstUser = await pool.query("SELECT id FROM users ORDER BY id ASC LIMIT 1");
        if (firstUser.rows.length > 0) {
          await pool.query("UPDATE users SET is_admin = TRUE WHERE id = $1", [firstUser.rows[0].id]);
        }
      }

      await pool.query("INSERT INTO app_settings (key, value) VALUES ('registration_enabled', TRUE) ON CONFLICT DO NOTHING");
      
      const catCheck = await pool.query('SELECT COUNT(*) FROM categories');
      if (parseInt(catCheck.rows[0].count) === 0) {
        await pool.query(`INSERT INTO categories (name, type, user_id, family_id) VALUES 
          ('Продукты', 'expense', NULL, 1), ('Аренда', 'expense', NULL, 1), 
          ('Транспорт', 'expense', NULL, 1), ('Зарплата', 'income', NULL, 1), ('Подарок', 'income', NULL, 1)`);
      }
      
      console.log('Database initialized for Family Mode');
      break;
    } catch (err) {
      console.error(`DB Retry ${retries}`, err);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

export default initDb;
