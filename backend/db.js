const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  idleTimeoutMillis: 60000,   // 1 minute before idle clients are closed
  keepAlive: true             // send TCP keep-alives
});

pool.on("error", (err) => {
  console.error("Unexpected PG client error", err);
});

module.exports = pool;