// ÖKC sürücü hataları. `uncertain`: istek cihaza gitmiş olabilir ama sonucu bilmiyoruz (mali fiş yazılmış olabilir);
// bu durumda otomatik yeniden deneme YAPILMAZ, çift mali fiş riski vardır.
class EcrError extends Error {
  constructor(code, message, { retryable = true, uncertain = false, cause } = {}) {
    super(message);
    this.name = 'EcrError';
    this.code = code;
    this.retryable = retryable;
    this.uncertain = uncertain;
    if (cause) this.cause = cause;
  }
}

const CODES = {
  OFFLINE: 'Cihaza bağlanılamadı',          // bağlantı kurulamadı; hiçbir şey gönderilmedi (güvenle yeniden denenir)
  TIMEOUT: 'Cihaz zamanında yanıt vermedi',  // gönderildikten sonra ise belirsiz
  REJECTED: 'Cihaz işlemi reddetti',         // cihaz açıkça hata kodu döndü (kâğıt, mali bellek, vb.)
  PROTOCOL: 'Cihaz beklenmeyen yanıt verdi', // çerçeve bozuk / LRC tutmuyor
  NOT_INSTALLED: 'Sürücü kurulu değil',
  UNSUPPORTED: 'Bu bağlantı türü desteklenmiyor'
};

module.exports = { EcrError, CODES };
