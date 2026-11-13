const trial = require('../src/services/trialSignup');

const env = { ...process.env };
beforeEach(() => {
  process.env.JWT_SECRET = 'x'.repeat(40);
  process.env.VENIUX_TRIAL_SERVICE_KEY = 'k'.repeat(40);
  process.env.VENIUX_LICENSE_AUTHORITY_URL = 'https://api.veniux.com/v1';
  trial._reset();
});
afterAll(() => { process.env = env; });

const fakeDb = (users = [], opened = 0) => ({ query: jest.fn(async sql => /FROM users/.test(sql) ? { rows: users } : { rows: [{ n: opened }] }) });
const okMail = () => jest.fn(async () => ({ success: true }));
const KEY = 'VNX-' + 'A'.repeat(48);

test('closed when service key or authority is missing', async () => {
  delete process.env.VENIUX_TRIAL_SERVICE_KEY;
  await expect(trial.request(fakeDb(), { email: 'a@b.com', company: 'Market', consent: true }, { sendEmail: okMail() })).rejects.toMatchObject({ code: 'DISABLED' });
});

test('request sends a 24 hour link in the fragment and stores nothing', async () => {
  const mail = okMail(), db = fakeDb();
  expect(await trial.request(db, { email: ' Ali@Ornek.com ', company: 'Ali  Market', consent: true }, { sendEmail: mail })).toEqual({ sent: true });
  const [to, , text] = mail.mock.calls[0];
  expect(to).toBe('ali@ornek.com');
  const token = text.match(/#t=([A-Za-z0-9_.-]+)/)[1];
  expect(trial.read(token)).toEqual({ email: 'ali@ornek.com', company: 'Ali Market' });
  expect(db.query.mock.calls.every(([sql]) => /^SELECT/.test(sql))).toBe(true);
});

test('honeypot, missing consent, disposable domain and bad company', async () => {
  const mail = okMail();
  expect(await trial.request(fakeDb(), { email: 'a@b.com', company: 'X Market', consent: true, website: 'spam' }, { sendEmail: mail })).toEqual({ sent: true });
  expect(mail).not.toHaveBeenCalled();
  await expect(trial.request(fakeDb(), { email: 'a@b.com', company: 'X Market' }, { sendEmail: mail })).rejects.toMatchObject({ code: 'NO_CONSENT' });
  await expect(trial.request(fakeDb(), { email: 'a@mailinator.com', company: 'X Market', consent: true }, { sendEmail: mail })).rejects.toMatchObject({ code: 'DISPOSABLE' });
  await expect(trial.request(fakeDb(), { email: 'a@b.com', company: '<b>', consent: true }, { sendEmail: mail })).rejects.toMatchObject({ code: 'BAD_COMPANY' });
});

test('registered email gets the same answer but no mail; repeat within 10 minutes is not resent', async () => {
  const mail = okMail();
  expect(await trial.request(fakeDb([{ id: 1 }]), { email: 'var@b.com', company: 'Var', consent: true }, { sendEmail: mail })).toEqual({ sent: true });
  await trial.request(fakeDb(), { email: 'yeni@b.com', company: 'Yeni', consent: true }, { sendEmail: mail });
  await trial.request(fakeDb(), { email: 'yeni@b.com', company: 'Yeni', consent: true }, { sendEmail: mail });
  expect(mail).toHaveBeenCalledTimes(1);
});

test('tampered and expired tokens are rejected', () => {
  const token = trial.sign({ email: 'a@b.com', company: 'Market' }, Date.now());
  expect(() => trial.read(token.slice(0, -2) + 'AA')).toThrow(/geçersiz/);
  expect(() => trial.read(token, Date.now() + 25 * 3600000)).toThrow(/süresi dolmuş/);
});

test('confirm issues central key then creates the account and returns secrets once', async () => {
  const token = trial.sign({ email: 'a@b.com', company: 'Market' });
  const central = { request: jest.fn(async () => ({ ok: true, license_key: KEY })) };
  const demoAccount = { create: jest.fn(async () => ({ email: 'a@b.com', password: 'Pw123456789abc', expiresAt: '2026-11-27T00:00:00.000Z' })) };
  const out = await trial.confirm(fakeDb(), token, { central, demoAccount });
  expect(central.request).toHaveBeenCalledWith('/trial', { service_key: 'k'.repeat(40), company: 'Market' });
  expect(demoAccount.create.mock.calls[0][1]).toEqual({ email: 'a@b.com', company: 'Market', days: 14 });
  expect(out).toMatchObject({ email: 'a@b.com', password: 'Pw123456789abc', license_key: KEY });
});

test('confirm is single use and respects quotas without spending a central key', async () => {
  const token = trial.sign({ email: 'a@b.com', company: 'Market' });
  const central = { request: jest.fn() }, demoAccount = { create: jest.fn() };
  await expect(trial.confirm(fakeDb([{ id: 9 }]), token, { central, demoAccount })).rejects.toMatchObject({ code: 'USED' });
  await expect(trial.confirm(fakeDb([], 20), token, { central, demoAccount })).rejects.toMatchObject({ code: 'DAILY_QUOTA' });
  expect(central.request).not.toHaveBeenCalled();
  central.request.mockResolvedValue({ ok: false, code: 'OPEN_QUOTA' });
  await expect(trial.confirm(fakeDb(), token, { central, demoAccount })).rejects.toMatchObject({ code: 'OPEN_QUOTA' });
  expect(demoAccount.create).not.toHaveBeenCalled();
});

test('authority outage creates nothing', async () => {
  const token = trial.sign({ email: 'a@b.com', company: 'Market' });
  const demoAccount = { create: jest.fn() };
  await expect(trial.confirm(fakeDb(), token, { central: { request: jest.fn(async () => { throw new Error('down'); }) }, demoAccount })).rejects.toMatchObject({ code: 'AUTHORITY' });
  expect(demoAccount.create).not.toHaveBeenCalled();
});
