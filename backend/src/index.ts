import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import initDb from './models/initDb.js';
import authRoutes from './routes/authRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import { updateExchangeRates } from './services/currencyService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Start server after DB init
const startServer = async () => {
  try {
    await initDb();
    
    // Update exchange rates on start
    updateExchangeRates();
    // Update rates every 12 hours
    setInterval(updateExchangeRates, 1000 * 60 * 60 * 12);

    app.use('/api/auth', authRoutes);
    app.use('/api/budget', budgetRoutes);

    app.get('/', (req, res) => {
      res.send('Family Budget API is running');
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
