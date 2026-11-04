const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../stok_takip.json');

// Read existing data
let dbData = {
  users: [],
  suppliers: [],
  warehouses: [],
  products: [],
  stock_records: [],
  stock_movements: [],
  alerts: [],
  ai_summary_logs: []
};

if (fs.existsSync(dbPath)) {
  dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

// Hash password
bcrypt.hash('admin123', 10, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }

  // Add admin user
  const adminUser = {
    id: 1,
    email: 'admin@example.com',
    password_hash: hash,
    role: 'admin',
    created_at: new Date().toISOString()
  };

  // Check if admin already exists
  const existingAdmin = dbData.users.find(u => u.email === 'admin@example.com');
  if (existingAdmin) {
    existingAdmin.password_hash = hash;
    console.log('Updated admin password');
  } else {
    dbData.users.push(adminUser);
    console.log('Created admin user');
  }

  // Save data
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));
  console.log('Admin user created successfully');
  console.log('Email: admin@example.com');
  console.log('Password: admin123');
  console.log('Role: admin');
});
