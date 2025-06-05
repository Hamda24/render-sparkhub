require('dotenv').config();
const pool = require("../db");
const bcrypt = require('bcryptjs');

async function main() {
  // grab email & password from the command line:
  const [, , email, plainPassword] = process.argv;
  if (!email || !plainPassword) {
    console.error('Usage: node seedAdmin.js <email> <password>');
    process.exit(1);
  }

  // 2) hash the plain-text password
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // 3) insert the new admin user
  const sql = `
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
  `;
  const params = [
    'Spark Admin',
    email,
    passwordHash,
    'admin'
  ];
  await pool.query(sql, params);

  console.log(`✅ Admin user (${email}) created.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});