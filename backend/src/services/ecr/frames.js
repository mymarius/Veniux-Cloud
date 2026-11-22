// Ortak çerçeveleme: STX <veri> ETX LRC (seri ve TCP yazarkasa protokollerinde en yaygın zarf biçimi).
// Bu yalnız bir ZARFTIR; hiçbir markanın komut kümesi değildir. Marka protokolü (komutlar, alan düzeni) belgeden yazılır.
const STX = 0x02, ETX = 0x03, ACK = 0x06, NAK = 0x15;

// LRC: STX hariç, ETX dahil tüm baytların XOR'u (bu çerçevede varsayılan; marka belgesi farklıysa codec seçeneği değiştirilir).
function lrc(bytes) { let x = 0; for (const b of bytes) x ^= b; return x; }

function encode(payload) {
  const body = Buffer.concat([Buffer.from(payload), Buffer.from([ETX])]);
  return Buffer.concat([Buffer.from([STX]), body, Buffer.from([lrc(body)])]);
}

// Tampondan ilk tam çerçeveyi ya da tek baytlık ACK/NAK'ı ayıklar.
// Dönen: { kind:'ack'|'nak'|'frame'|'invalid', payload?, consumed } ya da henüz tamamlanmadıysa null.
function extract(buf) {
  if (!buf.length) return null;
  const first = buf[0];
  if (first === ACK) return { kind: 'ack', consumed: 1 };
  if (first === NAK) return { kind: 'nak', consumed: 1 };
  if (first !== STX) {
    // Başı bozuk gürültüyü at: bir sonraki STX/ACK/NAK'a kadar.
    const next = buf.findIndex((b, i) => i > 0 && (b === STX || b === ACK || b === NAK));
    return next === -1 ? { kind: 'invalid', consumed: buf.length } : { kind: 'invalid', consumed: next };
  }
  const end = buf.indexOf(ETX, 1);
  if (end === -1 || buf.length < end + 2) return null;
  const body = buf.subarray(1, end + 1);
  const ok = lrc(body) === buf[end + 1];
  return ok ? { kind: 'frame', payload: Buffer.from(buf.subarray(1, end)), consumed: end + 2 } : { kind: 'invalid', consumed: end + 2 };
}

module.exports = { STX, ETX, ACK, NAK, lrc, encode, extract };
