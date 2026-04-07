import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
  process.exit(-1);
});

export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✓ PostgreSQL connected successfully');
    client.release();
    return true;
  } catch (err) {
    console.error('✗ PostgreSQL connection failed:', err);
    return false;
  }
}

export async function query(sql: string, params?: any[]) {
  return pool.query(sql, params);
}
