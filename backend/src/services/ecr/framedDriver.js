// "Kayıtlı çerçeve" sürücü iskeleti. Gerçek bir marka sürücüsü bu iskeleti BELGEDEN yazılmış bir `protocol` nesnesiyle doldurur:
//
//   protocol = {
//     name: 'marka-model',
//     encodeSale(sale, ctx) -> Buffer            // mali satış komutu yükü (zarf dışı)
//     decodeSaleResponse(payload, ctx) -> { ok:true, fiscal_receipt_no, z_no } | { ok:false, code, message, paper? }
//     encodeStatusQuery?(ctx) -> Buffer          // varsa: belirsiz kalan satışı cihazdan sorgulamak için
//     decodeStatusResponse?(payload, ctx) -> { found:boolean, fiscal_receipt_no?, z_no? }
//   }
//
// Sürücü: bağlan → çerçeveyi gönder → ACK bekle (NAK'ta sınırlı tekrar) → yanıt çerçevesi → ACK gönder → bağlantıyı kapat.
// Hiçbir marka için hazır protokol içermez; gerçek cihazla doğrulanana kadar sürücü "doğrulanmamış"tır (bkz. ecrService.driverStatus).
const frames = require('./frames');
const { EcrError } = require('./errors');

function createFramedDriver(protocol, { transportFactory, ackTimeoutMs = 3000, responseTimeoutMs = 15000, nakRetries = 2 } = {}) {
  if (typeof protocol?.encodeSale !== 'function' || typeof protocol?.decodeSaleResponse !== 'function') throw new Error('Protokol encodeSale ve decodeSaleResponse içermeli.');
  if (typeof transportFactory !== 'function') throw new Error('transportFactory gerekli.');

  async function exchange(transport, payload, ctx) {
    const frame = frames.encode(payload);
    let sentOnce = false;
    for (let attempt = 0; attempt <= nakRetries; attempt++) {
      await transport.write(frame);
      sentOnce = true;
      let ack;
      try { ack = await transport.read(buf => frames.extract(buf), ackTimeoutMs); }
      catch (e) { if (e instanceof EcrError && e.code === 'TIMEOUT') throw new EcrError('TIMEOUT', 'Cihaz komutu onaylamadı (ACK gelmedi).', { uncertain: sentOnce }); throw e; }
      if (ack.kind === 'ack') break;
      if (ack.kind === 'nak') { if (attempt === nakRetries) throw new EcrError('PROTOCOL', 'Cihaz komutu tekrar tekrar reddetti (NAK).', { uncertain: false, retryable: true }); continue; }
      throw new EcrError('PROTOCOL', 'ACK yerine beklenmeyen çerçeve geldi.', { uncertain: true });
    }
    const response = await transport.read(buf => frames.extract(buf), responseTimeoutMs);
    if (response.kind !== 'frame') throw new EcrError('PROTOCOL', 'Yanıt çerçevesi beklenirken ' + response.kind + ' geldi.', { uncertain: true });
    await transport.write(Buffer.from([frames.ACK]));
    return response.payload;
  }

  async function withTransport(device, fn) {
    const transport = transportFactory(device);
    await transport.connect(); // EcrError OFFLINE (uncertain:false) fırlatır
    try { return await fn(transport); } finally { await transport.close().catch(() => {}); }
  }

  return {
    framed: true,
    protocol: protocol.name || 'adsiz',
    async openSale(device, sale, ctx = {}) {
      return withTransport(device, async transport => {
        const payload = await exchange(transport, protocol.encodeSale(sale, ctx), ctx);
        const result = protocol.decodeSaleResponse(payload, ctx);
        if (!result.ok) throw new EcrError('REJECTED', result.message || 'Cihaz işlemi reddetti.', { retryable: result.retryable !== false, uncertain: false });
        return { fiscal_receipt_no: result.fiscal_receipt_no, z_no: result.z_no };
      });
    },
    // Belirsiz kalan satış için: cihaz bu satışı yazmış mı? Protokol desteklemiyorsa tanımlı değildir (operatör elle kontrol eder).
    ...(typeof protocol.encodeStatusQuery === 'function' && typeof protocol.decodeStatusResponse === 'function' ? {
      async findSale(device, sale, ctx = {}) {
        return withTransport(device, async transport => {
          const found = protocol.decodeStatusResponse(await exchange(transport, protocol.encodeStatusQuery(ctx), ctx), ctx);
          return found.found ? { fiscal_receipt_no: found.fiscal_receipt_no, z_no: found.z_no } : null;
        });
      }
    } : {})
  };
}

module.exports = { createFramedDriver };
