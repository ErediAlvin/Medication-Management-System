import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let poolInstance = null;

function sanitizeParams(params = []) {
  return params.map(p => (p === undefined ? null : p));
}

export function getPool() {
  if (!poolInstance) {
    const host = process.env.DB_HOST || '127.0.0.1';
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'medication_management_db';

    poolInstance = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });

    console.log(`[Database] Connected to local MySQL server at ${host}:${port}/${database}`);
  }
  return poolInstance;
}

export async function query(sql, params = []) {
  const pool = getPool();
  const [rows] = await pool.query(sql, sanitizeParams(params));
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function execute(sql, params = []) {
  const pool = getPool();
  const [result] = await pool.execute(sql, sanitizeParams(params));
  return result;
}

export async function closeDb() {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    console.log('[Database] MySQL connection pool closed.');
  }
}

export default {
  getPool,
  query,
  queryOne,
  execute,
  closeDb
};
