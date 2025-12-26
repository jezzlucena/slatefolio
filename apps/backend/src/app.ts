import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import connectDB from './db';
import emailController from './email';
import authController from './controllers/auth';
import projectsController from './controllers/projects';
import testimonialsController from './controllers/testimonials';
import profileController from './controllers/profile';
import uploadController from './controllers/upload';
import { requireAuth } from './middleware/auth';

const app = express();

const whitelist = [
  'https://jezzlucena.com',
  'https://www.jezzlucena.com',
  'https://jezzlucena.xyz',
  'https://www.jezzlucena.xyz',
  'http://localhost:8080',
  'http://localhost',
  'http://localhost:3000',
];

const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(cookieParser());

// File serving endpoint (public, serves files with original filename)
app.get('/files/:id', uploadController.serveFile);

// Contact form endpoint
app.post('/contact', emailController.sendEmail);

// Auth endpoints
app.get('/auth/status', authController.getStatus);
app.post('/auth/register', authController.register);
app.post('/auth/login', authController.login);
app.post('/auth/logout', authController.logout);

// Passkey endpoints
app.post('/auth/passkey/register-options', authController.passkeyRegisterOptions);
app.post('/auth/passkey/register', authController.passkeyRegister);
app.post('/auth/passkey/login-options', authController.passkeyLoginOptions);
app.post('/auth/passkey/login', authController.passkeyLogin);

// Projects endpoints (public)
app.get('/projects', projectsController.getAllProjects);
app.get('/projects/:key', projectsController.getProjectByKey);

// Admin Projects endpoints (protected)
app.post('/admin/projects', requireAuth, projectsController.createProject);
app.put('/admin/projects/:key', requireAuth, projectsController.updateProject);
app.delete('/admin/projects/:key', requireAuth, projectsController.deleteProject);

// Testimonials endpoints (public)
app.get('/testimonials', testimonialsController.getAllTestimonials);
app.get('/testimonials/:key', testimonialsController.getTestimonialByKey);

// Admin Testimonials endpoints (protected)
app.post('/admin/testimonials', requireAuth, testimonialsController.createTestimonial);
app.put('/admin/testimonials/:key', requireAuth, testimonialsController.updateTestimonial);
app.delete('/admin/testimonials/:key', requireAuth, testimonialsController.deleteTestimonial);

// Profile endpoint (public)
app.get('/profile', profileController.getProfile);

// Admin Profile endpoints (protected)
app.put('/admin/profile', requireAuth, profileController.upsertProfile);
app.get('/admin/profile/keyword-suggestions', requireAuth, profileController.getKeywordSuggestions);

// Admin Upload endpoints (protected)
app.post('/admin/upload', requireAuth, uploadController.upload.single('file'), uploadController.uploadFile);
app.delete('/admin/upload', requireAuth, uploadController.deleteFile);

// Connect to database and start server
const startServer = async () => {
  await connectDB();
  
  const port = process.env.BACKEND_PORT || 5050;
  app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
  });
};

startServer();
