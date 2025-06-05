require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  // grab email & password from the command line:
  const [, , email, plainPassword] = process.argv;
  if (!email || !plainPassword) {
    console.error('Usage: node seedAdmin.js <email> <password>');
    process.exit(1);
  }

  // 1) connect to your DB


  const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  // 2) hash the plain-text password
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // 3) insert the new admin user
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES (?,      ?,     ?,             ?)`,
    [
      'Spark Admin',
      email,
      passwordHash,
      'admin'
    ]
  );

  console.log(`✅ Admin user (${email}) created.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});