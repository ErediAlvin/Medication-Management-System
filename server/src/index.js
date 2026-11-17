import app from './app.js';
import { getPool, closeDb } from './db/db.js';
import { initializeSchema } from './db/schema.js';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // Ensure local MySQL database connection and schema are ready
    getPool();
    await initializeSchema();
    
    const server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🏥 Medication Management System API Server running`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🩺 Health: http://localhost:${PORT}/api/health`);
      console.log(`🐬 Database: Local MySQL Server (${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME})`);
      console.log(`🔒 RBAC & Local DB connection active (No file storage)`);
      console.log(`=======================================================`);
    });

    const shutdown = async () => {
      console.log('\n[Server] Shutting down gracefully...');
      server.close(async () => {
        await closeDb();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[Fatal Error] Failed to initialize server:', error);
    process.exit(1);
  }
}

bootstrap();
