// Tüm ilaç veri sağlayıcılarının uyması gereken sözleşme.
//
// Ana servis (medicineSyncService) sağlayıcının nereden ve nasıl veri
// çektiğini bilmez; yalnızca fetchBatches() ile standart kayıt dizileri alır.
// Yeni bir kaynak eklemek için bu sınıftan türetip providers/index.js'e
// kaydetmek yeterlidir.
//
// Standart kayıt biçimi:
// {
//   barcode: '8699...', name: 'PAROL 500 MG 20 TABLET', activeIngredient: 'Parasetamol',
//   dosage, pharmaceuticalForm, packageSize, manufacturer, company,
//   prescriptionType, atcCode, marketStatus: 'active'|'suspended'|'passive',
//   price, currency, image, imageVerified, kubUrl, ktUrl, sourceUrl
// }

class ProviderUnavailableError extends Error {
  constructor(message) { super(message); this.name = 'ProviderUnavailableError'; }
}

class BaseMedicineProvider {
  static key = 'base';
  static label = 'Temel sağlayıcı';
  static description = '';

  constructor(options = {}) { this.options = options; }

  get key() { return this.constructor.key; }
  get label() { return this.constructor.label; }

  // true ise kaynak tüm piyasayı listeler; listede olmayan ürünler pasife alınabilir.
  get fullCatalog() { return false; }

  // Kaynağın gönderdiği görseller barkodla birebir eşleşiyorsa true.
  get imagesBarcodeMatched() { return false; }

  // Kaynağın kullanılabilir olup olmadığı ve kısa durum açıklaması.
  async status() { return { available: false, message: 'Uygulanmadı.' }; }

  // Senkronizasyon bittiğinde (başarılı ya da değil) çağrılır; geçici dosyaları temizler.
  async cleanup() {}

  // eslint-disable-next-line require-yield
  async *fetchBatches(_chunkSize) { throw new ProviderUnavailableError('fetchBatches uygulanmadı.'); }
}

module.exports = { BaseMedicineProvider, ProviderUnavailableError };
