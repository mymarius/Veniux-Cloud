const bcrypt = require('bcrypt');
const pool = require('./src/config/database');

async function createAdmin() {
  try {
    const email = 'mymarius@veniux.com';
    const password = 'admin';
    const hash = await bcrypt.hash(password, 10);
    
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('User already exists, updating password and role...');
      await pool.query('UPDATE users SET password_hash = $1, role = $2 WHERE email = $3', [hash, 'admin', email]);
    } else {
      await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', 
        [email, hash, 'admin']
      );
    }
    console.log('Admin account mymarius@veniux.com created/updated successfully! Password: admin');
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
}

createAdmin();
