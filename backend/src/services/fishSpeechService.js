const { cleanText } = require('./nvidiaSpeechService');
const cache = new Map(), pending = new Map();
const voices=Object.freeze({turkish:'8dabf88064ee49da813a52fc1863154e',dialogue:'bfceed978dd4428c85dec9822b935ede',clear:'711dfd5500734888b8ac5952b58964d6'});
async function synthesize(raw,profile) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2000) throw Object.assign(new Error('Ses için 1–2000 karakter arasında metin gerekli.'), { status: 400 });
  // Keep the displayed brand unchanged; spell its final x as ks only for Turkish speech.
  const text = cleanText(raw).replace(/\bveniux\b/gi, 'Veniuks').replace(/\[[^\]]*\]/g, '').replace(/^\s*(?:[-•]|\d+[.)])\s+/gm, '').replace(/\s*\n+\s*/g, '. ').replace(/([.!?])\s*[.!?]+/g, '$1').replace(/\s+/g, ' ').trim();
  if (!text) throw Object.assign(new Error('Okunacak metin bulunamadı.'), { status: 400 });
  if (!process.env.FISH_API_KEY) throw Object.assign(new Error('Ses hizmeti yapılandırılmamış.'), { status: 503 });
  const model = process.env.FISH_TTS_MODEL || 's2.1-pro-free';
  if(profile!==undefined&&!Object.hasOwn(voices,profile))throw Object.assign(new Error('Geçersiz ses seçimi.'),{status:400});
  // Only allow the configured reference voices, including the user's selected voice.
  const voice = profile?voices[profile]:(process.env.FISH_VOICE_ID || voices.turkish);
  const key = JSON.stringify([model, voice, text]);
  if (cache.has(key)) return cache.get(key);
  if (pending.has(key)) return pending.get(key);
  if (pending.size >= 3) throw Object.assign(new Error('Ses danışmanı meşgul. Biraz sonra tekrar deneyin.'), { status: 429 });
  const task = (async () => {
    let response;
    try {
      response = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.FISH_API_KEY}`, 'Content-Type': 'application/json', model },
        body: JSON.stringify({ text, reference_id: voice,
          format: 'wav', sample_rate: 44100, temperature: 0.5, top_p: 0.7,
          latency: 'normal', chunk_length: 300, condition_on_previous_chunks: true,
          normalize: false, repetition_penalty: 1.2,
          prosody: { speed: 1, volume: 0 } }),
        signal: AbortSignal.timeout(45000)
      });
    } catch {
      throw Object.assign(new Error('Kadın ses hizmetine bağlanılamadı. Lütfen tekrar deneyin.'), { status: 503 });
    }
    if (!response.ok) {
      const message = response.status === 402 ? 'Fish Audio API bakiyesi yetersiz.'
        : response.status === 401 || response.status === 403 ? 'Fish Audio ses erişimi reddedildi.'
        : response.status === 429 ? 'Ses istek sınırına ulaşıldı. Biraz sonra deneyin.' : 'Kadın ses hizmeti yanıt veremedi.';
      throw Object.assign(new Error(message), { status: 503 });
    }
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 44 || audio.subarray(0, 4).toString() !== 'RIFF' || audio.subarray(8, 12).toString() !== 'WAVE') {
      throw Object.assign(new Error('Ses hizmetinden geçerli ses alınamadı.'), { status: 502 });
    }
    if (cache.size >= 12) cache.delete(cache.keys().next().value);
    cache.set(key, audio);
    return audio;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
module.exports = { synthesize };
