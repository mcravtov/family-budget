import express from 'express';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import { 
  getCategories, addCategory, updateCategory, deleteCategory,
  getTransactions, addTransaction, 
  getSummary, getRates, getAuditLogs, getUsers, createUser, deleteUser, 
  updateRegistrationSetting, getGoals, addGoal, updateGoal, deleteGoal, exportCSV
} from '../controllers/budgetController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/categories', getCategories);
router.post('/categories', addCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

router.get('/transactions', getTransactions);
router.post('/transactions', addTransaction);

router.get('/summary', getSummary);
router.get('/rates', getRates);

// Savings Goals
router.get('/goals', getGoals);
router.post('/goals', addGoal);
router.put('/goals/:id', updateGoal);
router.delete('/goals/:id', deleteGoal);

// Export
router.get('/export', exportCSV);

// Admin only routes
router.get('/admin/logs', isAdmin, getAuditLogs);
router.get('/admin/users', isAdmin, getUsers);
router.post('/admin/users', isAdmin, createUser);
router.delete('/admin/users/:id', isAdmin, deleteUser);
router.post('/admin/registration', isAdmin, updateRegistrationSetting);

export default router;
