"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mail_1 = __importDefault(require("@sendgrid/mail"));
mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
function sendEmail(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const msg = {
            to: process.env.SENDGRID_SENDER_IDENTITY_EMAIL,
            from: process.env.SENDGRID_SENDER_IDENTITY_EMAIL, // Use your verified sender
            subject: 'Contact from jezzlucena.com',
            text: `Hello!

You received an entry on the contact form at jezzlucena.com, or one of the apps.

Source: ${req.body.source}

First Name: ${req.body.firstName}
Last Name: ${req.body.lastName}

Email: ${req.body.email}
Phone: ${req.body.phone}

Subject: ${req.body.subject}
Message: ${req.body.message}

Kind regards,
Jezz Lucena`,
        };
        try {
            yield mail_1.default.send(msg);
            res.status(200).json(true);
            console.log(`Email sent successfully from ${req.body.email}.`);
        }
        catch (error) {
            console.error('Error sending email:', error);
            if (error.response) {
                console.error(error.response.body);
            }
            res.status(500).json(false);
        }
    });
}
exports.default = {
    sendEmail
};
//# sourceMappingURL=email.js.map