const offsite = require('../src/services/offsiteBackup');

// AWS S3 belgesindeki "GET Object" imza örneği (Signature Version 4, Authorization başlığı).
test('imza AWS belgesindeki örnekle aynı', () => {
  const result = offsite.sign({
    method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', region: 'us-east-1',
    keyId: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', amzDate: '20130524T000000Z',
    headers: { range: 'bytes=0-9' },
  });
  expect(result.signature).toBe('f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  expect(result.authorization).toContain('SignedHeaders=host;range;x-amz-content-sha256;x-amz-date');
});

describe('yükleme', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; jest.restoreAllMocks(); });
  const env = () => Object.assign(process.env, { OFFSITE_S3_ENDPOINT: 'https://s3.eu-central-003.backblazeb2.com', OFFSITE_S3_REGION: 'eu-central-003', OFFSITE_S3_BUCKET: 'veniux-yedek', OFFSITE_S3_KEY_ID: 'kid', OFFSITE_S3_SECRET: 'gizli-anahtar' });

  test('ayar yoksa hiçbir şey göndermez', async () => {
    const spy = jest.spyOn(global, 'fetch');
    delete process.env.OFFSITE_S3_BUCKET;
    expect(await offsite.upload('a.vnxsecure', Buffer.from('x'))).toEqual({ status: 'none' });
    expect(spy).not.toHaveBeenCalled();
  });

  test('yükler, boyutu doğrular, gizli anahtarı göndermez', async () => {
    env();
    const calls = [];
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, headers: new Map([['content-length', '5']]) }; });
    expect((await offsite.upload('yedek-1.vnxsecure', Buffer.from('12345'))).status).toBe('ok');
    expect(calls.map(c => c.init.method)).toEqual(['PUT', 'HEAD']);
    expect(calls[0].url).toBe('https://s3.eu-central-003.backblazeb2.com/veniux-yedek/veniux/yedek-1.vnxsecure');
    expect(JSON.stringify(calls)).not.toContain('gizli-anahtar');
    expect(calls[0].init.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=kid\/\d{8}\/eu-central-003\/s3\/aws4_request/);
  });

  test('boyut tutmazsa veya hata olursa başarısız sayılır', async () => {
    env();
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, headers: new Map([['content-length', '4']]) });
    expect((await offsite.upload('a.vnxsecure', Buffer.from('12345'))).status).toBe('failed');
    global.fetch.mockRejectedValue(Error('ağ'));
    expect((await offsite.upload('a.vnxsecure', Buffer.from('1'))).status).toBe('failed');
  });

  test('HTTP adres reddedilir', () => {
    env(); process.env.OFFSITE_S3_ENDPOINT = 'http://s3.example.com';
    expect(() => offsite.config()).toThrow('HTTPS');
  });
});

test('ayarlar integrations.env dosyasından okunur', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-off-'));
  const saved = { ...process.env };
  try {
    for (const k of Object.keys(process.env)) if (k.startsWith('OFFSITE_')) delete process.env[k];
    process.env.VENIUX_DATA_DIR = dir;
    fs.writeFileSync(path.join(dir, 'integrations.env'), 'OFFSITE_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com\nOFFSITE_S3_REGION=eu-central-003\nOFFSITE_S3_BUCKET=yedek\nOFFSITE_S3_KEY_ID=kid\nOFFSITE_S3_SECRET=sec\nNVIDIA_API_KEY=baska\n');
    expect(offsite.config()).toMatchObject({ host: 's3.eu-central-003.backblazeb2.com', bucket: 'yedek', region: 'eu-central-003', prefix: 'veniux' });
  } finally { process.env = saved; fs.rmSync(dir, { recursive: true, force: true }); }
});
