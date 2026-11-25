process.env.AUTH_RATE_LIMIT_MAX = '1000';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const request = require('supertest');

// Gerçek site kodu (PHP) yerel sunucuda çalışır, bulut kodu (Node) ona gerçek HTTP ile bağlanır: imza, JSON ve başlıklar iki taraf arasında birebir doğrulanır.
const PHP = process.env.PHP_BIN || ['C:/xampp/php/php.exe', 'php'].find(bin => { try { return spawnSync(bin, ['-v']).status === 0; } catch { return false; } });
const run = PHP ? describe : describe.skip;
const SECRET = 'w'.repeat(40), SITE_ROOT = path.resolve(__dirname, '../../website-php');
let server, dir, port, app, db;

const accountsFor = entries => Object.fromEntries(entries.map(([email, password, verified, company]) => [
  crypto.createHash('sha256').update(email).digest('hex'),
  { id: crypto.randomBytes(8).toString('hex'), email, company, plan: 'isletme', license_key: 'VNX-TEST', password_hash: bcrypt.hashSync(password, 10).replace(/^\$2b\$/, '$2y$'), created_at: new Date().toISOString(), verified },
]));

beforeAll(async () => {
  if (!PHP) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vx-site-'));
  fs.mkdirSync(path.join(dir, 'website-accounts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'website-accounts', 'accounts.json'), JSON.stringify(accountsFor([
    ['canli@example.test', 'site-parolasi-12345', true, 'Canlı Market'],
    ['onaysiz@example.test', 'site-parolasi-12345', false, 'Onaysız Market'],
  ])));
  port = 18000 + Math.floor(Math.random() * 1000);
  server = spawn(PHP, ['-S', `127.0.0.1:${port}`, 'router.php'], { cwd: SITE_ROOT, env: { ...process.env, VENIUX_SITE_DATA_DIR: dir, VENIUX_SITE_ENV: 'development', VENIUX_SITE_BRIDGE_SECRET: SECRET }, stdio: 'ignore' });
  for (let i = 0; i < 50; i += 1) { try { await fetch(`http://127.0.0.1:${port}/api/hesap-dogrula`); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
  process.env.VENIUX_SITE_BRIDGE_SECRET = SECRET;
  process.env.VENIUX_SITE_BRIDGE_URL = `http://127.0.0.1:${port}`;
  app = require('../src/index');
  db = require('../src/config/database');
}, 30000);
afterAll(() => { if (server) server.kill(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); delete process.env.VENIUX_SITE_BRIDGE_SECRET; delete process.env.VENIUX_SITE_BRIDGE_URL; });

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

run('site (PHP) ve bulut (Node) arasında gerçek HTTP ile giriş birleştirme', () => {
  test('site hesabıyla ilk giriş bulut hesabını açar; sonraki giriş siteye sormadan çalışır', async () => {
    const first = await login('canli@example.test', 'site-parolasi-12345');
    expect([200, 423]).toContain(first.status);
    const row = (await db.query('SELECT u.role,t.company_name FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE LOWER(u.email)=$1', ['canli@example.test'])).rows[0];
    expect(row).toMatchObject({ role: 'admin', company_name: 'Canlı Market' });
  });

  test('yanlış parola, e-postası doğrulanmamış hesap ve olmayan hesap reddedilir; bulutta kayıt oluşmaz', async () => {
    const wrong = await login('canli2@example.test', 'baska-parola-12345');
    expect(wrong.status).toBe(401);
    const unverified = await login('onaysiz@example.test', 'site-parolasi-12345');
    expect(unverified.status).toBe(403);
    expect(unverified.body.code).toBe('SITE_EMAIL_UNVERIFIED');
    const wrongPassword = await login('onaysiz@example.test', 'yanlis-parola-12345');
    expect(wrongPassword.status).toBe(401);
    const rows = (await db.query("SELECT id FROM users WHERE LOWER(email) IN ('onaysiz@example.test','canli2@example.test')")).rows;
    expect(rows).toHaveLength(0);
  });

  test('site kapalıyken bulutta açılmış hesap yine girer; hesabı olmayan siteye ulaşılamazsa reddedilir', async () => {
    server.kill(); await new Promise(resolve => setTimeout(resolve, 300));
    const existing = await login('canli@example.test', 'site-parolasi-12345');
    expect([200, 423]).toContain(existing.status);
    expect((await login('yeni@example.test', 'site-parolasi-12345')).status).toBe(401);
  });
});
