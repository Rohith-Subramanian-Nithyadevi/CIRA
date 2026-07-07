import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth.routes';
import examRoutes from './routes/exam.routes';
import facultyRoutes from './routes/faculty.routes';
import analyticsRoutes from './routes/analytics.routes';
import departmentRoutes from './routes/department.routes';
import adminRoutes from './routes/admin.routes';
import quizRoutes from './routes/quiz.routes';
import studentExamRoutes from './routes/student-exam.routes';
import { errorHandler } from './middlewares/error.middleware';

const app: Application = express();

// Global Middlewares
app.use(cors());
app.use(express.json());

// Serve static files from 'public' directory (which will contain the built frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/exams', examRoutes);
app.use('/api/v1/faculty/quiz', quizRoutes);
app.use('/api/v1/faculty', facultyRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/student/exam', studentExamRoutes);

// SPA Catch-all Route: serve index.html for non-API requests
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/')) {
    return next(); // Let API 404s fall through to the error handler
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler Middleware
// Must be registered after all routes and other middlewares
app.use(errorHandler);

export default app;
