import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import wardRoutes from './routes/wardRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import medicationRoutes from './routes/medicationRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import administrationRoutes from './routes/administrationRoutes.js';
import { queryOne } from './db/db.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Request logger for visibility
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const result = await queryOne('SELECT 1 as healthy');
    res.json({
      success: true,
      service: 'Medication Management System API',
      status: 'UP',
      database: result?.healthy === 1 ? 'CONNECTED (Local MySQL Server)' : 'UNKNOWN',
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      databaseName: process.env.DB_NAME || 'medication_management_db',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      service: 'Medication Management System API',
      status: 'DEGRADED',
      database: 'DISCONNECTED',
      error: error.message
    });
  }
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wards', wardRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/administration', administrationRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error occurred.'
  });
});

export default app;
