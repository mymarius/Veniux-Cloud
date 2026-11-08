const fs = require('fs'), os = require('os'), path = require('path');
const { makeMySQLBackupService } = require('../src/services/mysqlBackupService');

let root, copy, service;
const hours = h => new Date(Date.now() - h * 3600000).toISOString();
const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value));
const admin = { isPlatformAdmin: true, email: 'p@example.com' };

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-backup-'));
  copy = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-copy-'));
  service = makeMySQLBackupService({ root, filesRoot: path.join(root, 'none'), pool: {} });
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(copy, { recursive: true, force: true }); });

test('sağlam yedek ve ikinci kopya varsa durum iyi', () => {
  write('settings.json', { copyDir: copy });
  write('history.json', [{ id: 'a', status: 'healthy', created_at: hours(2), copy: { status: 'ok' } }]);
  expect(service.health()).toMatchObject({ level: 'ok', messages: [] });
});

test('son yedek alınamadıysa veya 48 saattir yedek yoksa hata', () => {
  write('settings.json', { copyDir: copy });
  write('history.json', [{ id: 'b', status: 'failed', created_at: hours(1) }, { id: 'a', status: 'healthy', created_at: hours(3), copy: { status: 'ok' } }]);
  expect(service.health().level).toBe('error');
  write('history.json', [{ id: 'a', status: 'healthy', created_at: hours(49), copy: { status: 'ok' } }]);
  expect(service.health().messages.join()).toContain('48 saattir');
  write('history.json', []);
  expect(service.health().messages.join()).toContain('Henüz sağlam');
});

test('ikinci konum yoksa veya kopya başarısızsa uyarı', () => {
  write('history.json', [{ id: 'a', status: 'healthy', created_at: hours(1), copy: { status: 'none' } }]);
  expect(service.health()).toMatchObject({ level: 'warning' });
  write('settings.json', { copyDir: copy });
  write('history.json', [{ id: 'a', status: 'healthy', created_at: hours(1), copy: { status: 'failed' } }]);
  expect(service.health().messages.join()).toContain('kopyalanamadı');
});

test('otomatik yedek kapalıysa hata', () => {
  write('settings.json', { enabled: false, copyDir: copy });
  write('history.json', [{ id: 'a', status: 'healthy', created_at: hours(1), copy: { status: 'ok' } }]);
  expect(service.health().level).toBe('error');
});

test('ikinci konum tam yol olmalı ve ana klasörün içinde olamaz', async () => {
  const base = { enabled: true, intervalHours: 24, retentionDays: 30, maxCount: 10 };
  await expect(service.configure(admin, { ...base, copyDir: 'yedek' })).rejects.toMatchObject({ status: 400 });
  await expect(service.configure(admin, { ...base, copyDir: path.join(root, 'ic') })).rejects.toMatchObject({ status: 400 });
  expect((await service.configure(admin, { ...base, copyDir: copy })).copyDir).toBe(copy);
  expect((await service.configure(admin, base)).copyDir).toBe('');
});

test('kurtarma kodu yalnız platform yöneticisine ve anahtarı geri verir', () => {
  expect(() => service.recoveryCode({ role: 'admin' })).toThrow();
  const { code } = service.recoveryCode(admin);
  expect(code).toMatch(/^([0-9A-F]{8}-){7}[0-9A-F]{8}$/);
  expect(Buffer.from(code.replaceAll('-', ''), 'hex')).toEqual(fs.readFileSync(path.join(root, 'local-key.bin')));
});

test('kopya yanlış kurtarma koduyla açılmaz', async () => {
  const blob = Buffer.concat([require('crypto').randomBytes(12), Buffer.alloc(40), require('crypto').randomBytes(16)]);
  await expect(service.prepareCopy(admin, blob, 'ABC')).rejects.toMatchObject({ status: 400 });
  await expect(service.prepareCopy(admin, blob, 'A'.repeat(64))).rejects.toThrow('eşleşmiyor');
  await expect(service.prepareCopy({ role: 'admin' }, blob, 'A'.repeat(64))).rejects.toMatchObject({ status: 403 });
});

test('haftalık doğrulama sonucu sağlığa yansır', () => {
  const saved = { ...process.env };
  Object.assign(process.env, { VENIUX_DESKTOP_RESTORE: '1', VENIUX_DATA_DIR: root });
  try {
    write('settings.json', { copyDir: copy });
    write('history.json', [{ id: 'a', status: 'healthy', created_at: hours(1), copy: { status: 'ok' } }]);
    expect(service.health().messages.join()).toContain('14 günde denenmedi');
    write('backup-verify.json', { status: 'ok', at: hours(24) });
    expect(service.health()).toMatchObject({ level: 'ok' });
    write('backup-verify.json', { status: 'ok', at: hours(15 * 24) });
    expect(service.health().level).toBe('warning');
    write('backup-verify.json', { status: 'failed', at: hours(1) });
    expect(service.health().level).toBe('error');
  } finally { process.env = saved; }
});
