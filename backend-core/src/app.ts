import express, { Application } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import examRoutes from './routes/exam.routes';
import facultyRoutes from './routes/faculty.routes';
import analyticsRoutes from './routes/analytics.routes';
import departmentRoutes from './routes/department.routes';
import { errorHandler } from './middlewares/error.middleware';

const app: Application = express();

// Global Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/exams', examRoutes);
app.use('/api/v1/faculty', facultyRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/departments', departmentRoutes);

// Global Error Handler Middleware
// Must be registered after all routes and other middlewares
app.use(errorHandler);

export default app;
