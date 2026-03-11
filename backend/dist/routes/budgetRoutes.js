"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_js_1 = require("../middleware/auth.js");
const budgetController_js_1 = require("../controllers/budgetController.js");
const router = express_1.default.Router();
router.use(auth_js_1.authenticateToken);
router.get('/categories', budgetController_js_1.getCategories);
router.post('/categories', budgetController_js_1.addCategory);
router.put('/categories/:id', budgetController_js_1.updateCategory);
router.delete('/categories/:id', budgetController_js_1.deleteCategory);
router.get('/transactions', budgetController_js_1.getTransactions);
router.post('/transactions', budgetController_js_1.addTransaction);
router.get('/summary', budgetController_js_1.getSummary);
router.get('/rates', budgetController_js_1.getRates);
// Admin only routes
router.get('/admin/logs', auth_js_1.isAdmin, budgetController_js_1.getAuditLogs);
router.get('/admin/users', auth_js_1.isAdmin, budgetController_js_1.getUsers);
router.post('/admin/users', auth_js_1.isAdmin, budgetController_js_1.createUser);
router.delete('/admin/users/:id', auth_js_1.isAdmin, budgetController_js_1.deleteUser);
router.post('/admin/registration', auth_js_1.isAdmin, budgetController_js_1.updateRegistrationSetting);
exports.default = router;
