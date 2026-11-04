const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories');

let owner;
const auth = () => ({ Authorization: 'Bearer ' + owner.token });
// 1x1 PNG
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

beforeAll(async () => { owner = await createTenant(); });

test('upload, read back and remove a profile photo', async () => {
  const put = await request(app).put('/api/settings/account/avatar').set(auth()).send({ image: tinyPng });
  expect(put.status).toBe(200);
  expect((await request(app).get('/api/settings/account').set(auth())).body.avatarUrl).toBe(tinyPng);
  expect((await request(app).get('/api/auth/me').set(auth())).body.avatar_url).toBe(tinyPng);
  const del = await request(app).delete('/api/settings/account/avatar').set(auth());
  expect(del.status).toBe(200);
  expect((await request(app).get('/api/settings/account').set(auth())).body.avatarUrl).toBeNull();
});

test.each([
  ['non-image data URL', 'data:text/html;base64,PHNjcmlwdD4='],
  ['SVG (can carry scripts)', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
  ['plain URL', 'https://example.com/a.png'],
  ['missing value', undefined]
])('rejects %s', async (_label, image) => {
  const r = await request(app).put('/api/settings/account/avatar').set(auth()).send({ image });
  expect(r.status).toBe(400);
});

test('rejects oversized photos', async () => {
  const r = await request(app).put('/api/settings/account/avatar').set(auth()).send({ image: 'data:image/png;base64,' + 'A'.repeat(400 * 1024) });
  expect(r.status).toBe(413);
});

test('requires authentication', async () => {
  expect((await request(app).put('/api/settings/account/avatar').send({ image: tinyPng })).status).toBe(401);
});
