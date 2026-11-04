process.env.JWT_SECRET = 'isolated-reset-test-secret-at-least-32-bytes'; // 2FA anahtarı bundan türetilir
process.env.RECOVERY_RATE_LIMIT_MAX = '1000'; // hız sınırı ayrı denenir; burada akışlar sınanır
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const mfa = require('../src/services/mfaService');
const { makeBackupService } = require('../src/services/backupService');
const { createTenant, createUser } = require('./factories');

// Küçük bir SMTP sunucusu: e-postanın gerçekten SMTP protokolüyle gittiğini doğrular (dış sağlayıcı değildir).
const startSmtp = () => new Promise(resolve => {
  const messages = [];
  const waiting = [];
  const server = net.createServer(socket => {
    let inData = false, buffer = '';
    socket.write('220 test ESMTP\r\n');
    socket.on('error', () => {});
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let index;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            socket.write('250 OK\r\n');
            const mail = messages.current.join('\n');
            messages.push(mail);
            (waiting.shift() || (() => {}))(mail);
          } else messages.current.push(line);
        } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250-test\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (/^AUTH/i.test(line)) socket.write('235 OK\r\n');
        else if (/^DATA/i.test(line)) { inData = true; messages.current = []; socket.write('354 go\r\n'); }
        else if (/^QUIT/i.test(line)) { socket.write('221 bye\r\n'); socket.end(); }
        else socket.write('250 OK\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1', () => resolve({
    port: server.address().port, messages,
    next: () => new Promise(r => waiting.push(r)),
    close: () => new Promise(r => server.close(r))
  }));
});

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'APP_BASE_URL'];
const forgot = email => request(app).post('/api/auth/forgot-password').send({ email });
const reset = (token, password) => request(app).post('/api/auth/reset-password').send({ token, password });
const login = (email, password, extra = {}) => request(app).post('/api/auth/login').send({ email, password, ...extra });
const tokenFrom = mail => {
  const decoded = mail.replace(/=\n/g, '').replace(/=3D/g, '=');
  return decoded.match(/token=([0-9a-f]{64})/)[1];
};

let smtp, owner;
beforeAll(async () => {
  smtp = await startSmtp();
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'mailer', SMTP_PASS: 'secret', SMTP_FROM: 'no-reply@veniux.test', APP_BASE_URL: 'https://app.veniux.test' });
  owner = await createTenant();
});
afterAll(async () => {
  for (const key of SMTP_KEYS) delete process.env[key];
  await smtp.close();
});

test('without SMTP the request fails openly for every address and creates no token', async () => {
  const saved = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  try {
    const count = async () => (await db.query('SELECT COUNT(*) AS n FROM password_reset_tokens')).rows[0].n;
    const before = await count();
    const known = await forgot(owner.email);
    const unknown = await forgot('nobody@nowhere.test');
    expect(known.status).toBe(503);
    expect(known.body.error).toContain('yapılandırılmamış');
    expect(unknown.status).toBe(503);
    expect(unknown.body).toEqual(known.body);
    expect(await count()).toBe(before);
  } finally { process.env.SMTP_HOST = saved; }
});

test('production refuses to mail a link without a public address', async () => {
  const saved = { url: process.env.APP_BASE_URL, env: process.env.NODE_ENV };
  delete process.env.APP_BASE_URL;
  process.env.NODE_ENV = 'production';
  try {
    expect((await forgot(owner.email)).status).toBe(503);
  } finally { process.env.APP_BASE_URL = saved.url; process.env.NODE_ENV = saved.env; }
});

test('unknown address gets the same answer and no e-mail', async () => {
  const before = smtp.messages.length;
  const unknown = await forgot('nobody@nowhere.test');
  expect(unknown.status).toBe(200);
  expect(unknown.body.message).toContain('kayıtlıysa');
  await new Promise(r => setTimeout(r, 100));
  expect(smtp.messages.length).toBe(before);
});

test('mail goes over SMTP; token is single use, stored only as a hash, and revokes open sessions', async () => {
  const pending = smtp.next();
  expect((await forgot(owner.email.toUpperCase())).status).toBe(200);
  const mail = await pending;
  expect(mail).toContain('veniux.test');
  const token = tokenFrom(mail);
  expect((await db.query('SELECT 1 FROM password_reset_tokens WHERE token_hash = $1', [token])).rows.length).toBe(0);

  expect((await reset(token, 'short')).status).toBe(400);
  expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${owner.token}`)).status).toBe(200);
  expect((await reset(token, 'NewPassw0rd!x')).status).toBe(200);
  expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${owner.token}`)).status).toBe(401);
  expect((await reset(token, 'Another0ne!xx')).status).toBe(400);
  expect((await login(owner.email, 'password123')).status).toBe(401);
  const fresh = await login(owner.email, 'NewPassw0rd!x');
  expect(fresh.status).toBe(200);
  owner.token = fresh.body.token;
});

test('expired token and an older token after a newer request are refused', async () => {
  let pending = smtp.next();
  await forgot(owner.email);
  const first = tokenFrom(await pending);
  pending = smtp.next();
  await forgot(owner.email);
  const second = tokenFrom(await pending);
  expect((await reset(first, 'NewPassw0rd!y')).status).toBe(400);
  await db.query("UPDATE password_reset_tokens SET expires_at = '2000-01-01 00:00:00'");
  expect((await reset(second, 'NewPassw0rd!y')).status).toBe(400);
  expect((await login(owner.email, 'NewPassw0rd!x')).status).toBe(200);
});

test('a reset token of one tenant changes only that user', async () => {
  const other = await createTenant();
  const before = (await db.query('SELECT password_hash, session_version FROM users WHERE id = $1', [other.userId])).rows[0];
  const pending = smtp.next();
  await forgot(owner.email);
  expect((await reset(tokenFrom(await pending), 'NewPassw0rd!z')).status).toBe(200);
  expect((await db.query('SELECT password_hash, session_version FROM users WHERE id = $1', [other.userId])).rows[0]).toEqual(before);
});

test('reset does not switch off two factor authentication', async () => {
  const user = await createUser(owner.tenantId, 'manager');
  const first = await login(user.email, 'password123');
  const token = first.body.token;
  const auth = { Authorization: `Bearer ${token}` };
  const setup = await request(app).post('/api/auth/mfa/setup').set(auth).send({ password: 'password123' });
  expect(setup.status).toBe(200);
  const code = mfa.totp(setup.body.secret, Math.floor(Date.now() / 30000));
  expect((await request(app).post('/api/auth/mfa/confirm').set(auth).send({ password: 'password123', code })).status).toBe(200);
  const pending = smtp.next();
  await forgot(user.email);
  expect((await reset(tokenFrom(await pending), 'NewPassw0rd!m')).status).toBe(200);
  const after = await login(user.email, 'NewPassw0rd!m');
  expect(after.body.mfa_required).toBe(true);
  expect(after.body.token).toBeUndefined();

});

test('portable backup still works with several pending tokens and carries none of them', async () => {
  const other = await createTenant();
  for (const email of [owner.email, other.email]) {
    const pending = smtp.next();
    await forgot(email);
    await pending;
  }
  expect(Number((await db.query('SELECT COUNT(*) AS n FROM password_reset_tokens WHERE used_at IS NULL')).rows[0].n)).toBeGreaterThanOrEqual(2);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-reset-backup-'));
  try {
    fs.mkdirSync(path.join(root, 'images'));
    const service = makeBackupService({ root: path.join(root, 'backups'), filesRoot: path.join(root, 'images') });
    const user = { userId: owner.userId, tenantId: owner.tenantId, email: owner.email, role: 'admin', isPlatformAdmin: true };
    const row = await service.create(user);
    const payload = service.unpack(await service.exportBackup(user, row.id));
    const file = path.join(root, 'portable.db');
    fs.writeFileSync(file, Buffer.from(payload.database, 'base64'));
    const Database = require('better-sqlite3');
    const copy = new Database(file, { readonly: true });
    try {
      const hashes = copy.prepare('SELECT DISTINCT token_hash FROM password_reset_tokens').all().map(r => r.token_hash);
      expect(hashes).toEqual(['[REDACTED]']);
    } finally { copy.close(); }
  } finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
