jest.mock('../src/services/nvidiaSpeechService', () => ({
  cleanText: text => text.replace(/\*/g, '').trim(),
  wav: pcm => Buffer.concat([Buffer.from('RIFF'), pcm])
}));
const originalFetch = global.fetch;
const originalKey = process.env.GEMINI_API_KEY;
beforeEach(() => { jest.resetModules(); process.env.GEMINI_API_KEY = 'test-only'; });
afterEach(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; });
test('sends professional Turkish style and soft Achernar voice, returns audio and caches repeated requests', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ steps: [{type:'model_output',content:[{type:'audio',data:Buffer.from('audio').toString('base64')}]}] }) });
  const { synthesize } = require('../src/services/googleSpeechService');
  const result = await synthesize('Merhaba.');
  await synthesize('Merhaba.');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [url, request] = global.fetch.mock.calls[0];
  expect(url).not.toContain('test-only');
  const body = JSON.parse(request.body);
  expect(body.generation_config.speech_config[0].voice).toBe('Achernar');
  expect(body.input[0].content[0].annotations[0].style).toContain('profesyonel bir kadın');
  expect(result.subarray(0, 4).toString()).toBe('RIFF');
});
test('provider failures do not expose credentials or provider response', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
  await expect(require('../src/services/googleSpeechService').synthesize('Merhaba.')).rejects.toMatchObject({ status: 503 });
});
test('rejects empty and oversized text before sending a request', async () => {
  global.fetch = jest.fn();
  const { synthesize } = require('../src/services/googleSpeechService');
  await expect(synthesize('')).rejects.toMatchObject({ status: 400 });
  await expect(synthesize('x'.repeat(2001))).rejects.toMatchObject({ status: 400 });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('retries a transient connection failure before returning audio',async()=>{
 global.fetch=jest.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValue({ok:true,json:async()=>({steps:[{type:'model_output',content:[{type:'audio',data:Buffer.from('audio').toString('base64')}]}]})});
 await require('../src/services/googleSpeechService').synthesize('Tekrar deneyelim.');
 expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('recovers from temporary provider failure without changing the voice',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce({ok:false,status:503}).mockResolvedValue({ok:true,json:async()=>({steps:[{type:'model_output',content:[{type:'audio',data:Buffer.from('audio').toString('base64')}]}]})});
 await require('../src/services/googleSpeechService').synthesize('Geçici hata.');
 expect(global.fetch).toHaveBeenCalledTimes(2);
 for(const [,request] of global.fetch.mock.calls)expect(JSON.parse(request.body).generation_config.speech_config[0].voice).toBe('Achernar');
});

test('kullanılamayan model yerine aynı sesle sonraki Gemini modeli denenir',async()=>{
 process.env.GEMINI_API_KEY='test-key';
 global.fetch=jest.fn().mockResolvedValueOnce({ok:false,status:404}).mockResolvedValue({ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{data:Buffer.from('audio').toString('base64')}}]}}]})});
 const {synthesize}=require('../src/services/googleSpeechService');
 expect(Buffer.isBuffer(await synthesize('Model yedeği denemesi','soft'))).toBe(true);
 expect(global.fetch).toHaveBeenCalledTimes(2);
 expect(global.fetch.mock.calls[1][0]).toContain('gemini-3.1-flash-tts-preview');
 expect(global.fetch.mock.calls[1][1].body).toContain('Achernar');
});
test('reddedilen anahtar başka modelde boşuna denenmez',async()=>{
 process.env.GEMINI_API_KEY='test-key';
 global.fetch=jest.fn().mockResolvedValue({ok:false,status:403});
 const {synthesize}=require('../src/services/googleSpeechService');
 await expect(synthesize('Anahtar reddi denemesi','soft')).rejects.toThrow('erişimi reddedildi');
 expect(global.fetch).toHaveBeenCalledTimes(1);
});
