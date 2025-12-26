"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "..", ".env") });
const email_1 = __importDefault(require("./email"));
const app = (0, express_1.default)();
const whitelist = ['https://jezzlucena.com', 'https://www.jezzlucena.com', 'https://jezzlucena.xyz', 'https://www.jezzlucena.xyz', 'http://localhost:8080'];
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || whitelist.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};
app.use((0, cors_1.default)(corsOptions));
app.use(body_parser_1.default.json());
app.post('/contact', email_1.default.sendEmail);
app.listen(process.env.BACKEND_PORT || 5050);
//# sourceMappingURL=app.js.map