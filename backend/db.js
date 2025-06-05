require('dotenv').config();

const { Pool } = require('pg');

// Use only DATABASE_URL in production—do not fall back to localhost.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
  process.exit(-1);
});

module.exports = pool;