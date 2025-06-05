require("dotenv").config();
const { Pool } = require("pg");

// We recommend using a single DATABASE_URL (set via Render) rather than
// separate DB_HOST/DB_USER/DB_PASS variables. But both approaches can work.
// Here we’ll show the DATABASE_URL approach.

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },   // required for Render’s managed Postgres
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
  process.exit(-1);
});

module.exports = pool;