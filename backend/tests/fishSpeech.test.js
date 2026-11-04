jest.mock('../src/services/nvidiaSpeechService', () => ({ cleanText: text => text.trim() }));
const originalFetch = global.fetch;
const originalKey = process.env.FISH_API_KEY;
beforeEach(() => { jest.resetModules(); process.env.FISH_API_KEY = 'test-only'; });
afterEach(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.FISH_API_KEY; else process.env.FISH_API_KEY = originalKey; });
test('uses fixed female voice and returns playable WAV, caching repeated requests', async () => {
  const audio = Buffer.alloc(44); audio.write('RIFF'); audio.write('WAVE', 8);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => audio });
  const { synthesize } = require('../src/services/fishSpeechService');
  expect(await synthesize('Merhaba.')).toEqual(audio);
  await synthesize('Merhaba.');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const request = global.fetch.mock.calls[0][1];
  expect(request.headers.model).toBe('s2.1-pro-free');
  expect(JSON.parse(request.body).reference_id).toBe('8dabf88064ee49da813a52fc1863154e');
});
test('rejects invalid audio and masks provider errors', async () => {
  const { synthesize } = require('../src/services/fishSpeechService');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from('invalid') });
  await expect(synthesize('Merhaba.')).rejects.toMatchObject({ status: 502 });
  global.fetch.mockResolvedValue({ ok: false, status: 402 });
  await expect(synthesize('Merhaba.')).rejects.toMatchObject({ status: 503, message: 'Fish Audio API bakiyesi yetersiz.' });
});

test('voice choices are fixed, keep separate cache entries and reject arbitrary voices',async()=>{
 const audio=Buffer.alloc(44);audio.write('RIFF');audio.write('WAVE',8);
 global.fetch=jest.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>audio});
 const {synthesize}=require('../src/services/fishSpeechService');
 await synthesize('Merhaba.','dialogue');await synthesize('Merhaba.','clear');
 expect(global.fetch).toHaveBeenCalledTimes(2);
 expect(JSON.parse(global.fetch.mock.calls[1][1].body).reference_id).toBe('711dfd5500734888b8ac5952b58964d6');
 await expect(synthesize('Merhaba.','arbitrary-voice')).rejects.toMatchObject({status:400});
 expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('pronounces brand x as ks without changing other words or allowing style injection', async () => {
  const audio = Buffer.alloc(44); audio.write('RIFF'); audio.write('WAVE', 8);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => audio });
  const { synthesize } = require('../src/services/fishSpeechService');
  await synthesize('VENIUX’e hoş geldiniz. [shouting] Veniux size yardımcı olur.');
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.text).toBe('Veniuks’e hoş geldiniz. Veniuks size yardımcı olur.');
  expect(body.prosody.speed).toBe(1);
  expect(body.condition_on_previous_chunks).toBe(true);
});
