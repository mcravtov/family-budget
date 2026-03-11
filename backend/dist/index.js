"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const initDb_js_1 = __importDefault(require("./models/initDb.js"));
const authRoutes_js_1 = __importDefault(require("./routes/authRoutes.js"));
const budgetRoutes_js_1 = __importDefault(require("./routes/budgetRoutes.js"));
const currencyService_js_1 = require("./services/currencyService.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Start server after DB init
const startServer = async () => {
    try {
        await (0, initDb_js_1.default)();
        // Update exchange rates on start
        (0, currencyService_js_1.updateExchangeRates)();
        // Update rates every 12 hours
        setInterval(currencyService_js_1.updateExchangeRates, 1000 * 60 * 60 * 12);
        app.use('/api/auth', authRoutes_js_1.default);
        app.use('/api/budget', budgetRoutes_js_1.default);
        app.get('/', (req, res) => {
            res.send('Family Budget API is running');
        });
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
