import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth.routes';
import examRoutes from './routes/exam.routes';
import facultyRoutes from './routes/faculty.routes';
import analyticsRoutes from './routes/analytics.routes';
import departmentRoutes from './routes/department.routes';
import adminRoutes from './routes/admin.routes';
import batchRoutes from './routes/batch.routes';
import quizRoutes from './routes/quiz.routes';
import studentExamRoutes from './routes/student-exam.routes';
import studentDashboardRoutes from './routes/student-dashboard.routes';
import studentFeaturesRoutes from './routes/student.routes';
import facultyDashboardRoutes from './routes/faculty-dashboard.routes';
import facultyReportsRoutes from './routes/faculty-reports.routes';
import assignmentRoutes from './routes/assignment.routes';
import studentImprovementRoutes from './routes/student-improvement.routes';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/error.middleware';

const app: Application = express();

// Global Middlewares
app.use(cors());
app.use(express.json());

// Rate Limiting (CIRA-019)
// 1. General API rate limiter (protects server from rapid uncontrolled flooding)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// 2. Strict Authentication rate limiter (protects against credential stuffing & OTP brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 auth attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login or verification attempts, please try again after 15 minutes.' }
});

app.use('/api/', generalLimiter);

// Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/exams', examRoutes);
app.use('/api/v1/faculty/quiz', quizRoutes);
app.use('/api/v1/faculty/reports', facultyReportsRoutes);
app.use('/api/v1/faculty/dashboard', facultyDashboardRoutes);
app.use('/api/v1/faculty', facultyRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/batches', batchRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/student/exam', studentExamRoutes);
app.use('/api/v1/student', studentDashboardRoutes);
app.use('/api/v1/student-features', studentFeaturesRoutes);
app.use('/api/v1/student/improvement', studentImprovementRoutes);

// Health check route for the root
app.get('/', (req, res) => {
  res.status(200).json({ status: 'API is running', timestamp: new Date() });
});

// Catch-all for API 404s
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'API Route Not Found' });
});

// Global Error Handler Middleware
// Must be registered after all routes and other middlewares
app.use(errorHandler);

export default app;
