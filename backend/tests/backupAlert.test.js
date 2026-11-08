const fs = require('fs'), os = require('os'), path = require('path');
const { makeMySQLBackupService } = require('../src/services/mysqlBackupService');

let root, sent, configured, service;
const saved = { ...process.env };
const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value));
const hours = h => new Date(Date.now() - h * 3600000).toISOString();
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-alert-'));
  sent = []; configured = true;
  Object.assign(process.env, { VENIUX_DESKTOP_RESTORE: '1', VENIUX_DATA_DIR: root });
  const mailer = { isEmailConfigured: () => configured, sendEmail: async (to, subject, text) => { sent.push({ to, subject, text }); return { success: true }; } };
  service = makeMySQLBackupService({ root, filesRoot: path.join(root, 'none'), pool: { query: async () => ({ rows: [{ email: 'yonetici@example.com' }, { email: 'ortak@example.com' }] }) }, mailer });
  write('settings.json', { copyDir: root + '-x' });
});
afterEach(() => { process.env = { ...saved }; fs.rmSync(root, { recursive: true, force: true }); });

test('yedek alınamazsa yöneticilere e-posta gider, 24 saat aynı uyarı tekrarlanmaz', async () => {
  write('history.json', [{ id: 'b', status: 'failed', created_at: hours(1) }, { id: 'a', status: 'healthy', created_at: hours(2), copy: { status: 'ok' } }]);
  expect(await service.alertIfNeeded()).toMatchObject({ sent: 2 });
  expect(sent.map(m => m.to)).toEqual(['yonetici@example.com', 'ortak@example.com']);
  expect(sent[0].subject).toBe('Veniux yedekleme uyarısı');
  expect(sent[0].text).toContain('Son yedek alınamadı.');
  expect(sent[0].text.split('\n').length).toBeGreaterThan(3);
  expect(await service.alertIfNeeded()).toMatchObject({ reason: 'throttled' });
  expect(await service.alertIfNeeded(Date.now() + 25 * 3600000)).toMatchObject({ sent: 2 });
});

test('sorun değişince hemen yeni e-posta, düzelince susar', async () => {
  write('history.json', [{ id: 'b', status: 'failed', created_at: hours(1) }, { id: 'a', status: 'healthy', created_at: hours(2), copy: { status: 'ok' } }]);
  await service.alertIfNeeded();
  write('settings.json', { enabled: false, copyDir: root + '-x' });
  expect(await service.alertIfNeeded()).toMatchObject({ sent: 2 });
  write('settings.json', { copyDir: root + '-x' });
  write('history.json', [{ id: 'c', status: 'healthy', created_at: hours(1), copy: { status: 'ok' } }]);
  write('backup-verify.json', { status: 'ok', at: hours(1) });
  expect(await service.alertIfNeeded()).toMatchObject({ reason: 'healthy' });
  expect(sent).toHaveLength(4);
});

test('uyarı seviyesi (sarı) için e-posta gönderilmez; SMTP yoksa gönderilmez', async () => {
  write('history.json', [{ id: 'a', status: 'healthy', created_at: hours(1), copy: { status: 'failed' } }]);
  write('backup-verify.json', { status: 'ok', at: hours(1) });
  expect(await service.alertIfNeeded()).toMatchObject({ reason: 'healthy' });
  configured = false;
  write('history.json', [{ id: 'b', status: 'failed', created_at: hours(1) }]);
  expect(await service.alertIfNeeded()).toMatchObject({ reason: 'no_smtp' });
  expect(sent).toHaveLength(0);
});
