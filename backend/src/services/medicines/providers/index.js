// Sağlayıcı kaydı. Yeni kaynak eklemek için BaseMedicineProvider'dan türeyen
// sınıfı buraya eklemek yeterlidir; servis ve arayüz otomatik olarak listeler.
const TitckListProvider = require('./TitckListProvider');
const ManualProvider = require('./ManualProvider');

const PROVIDERS = [TitckListProvider, ManualProvider];

const getProviderClass = key => PROVIDERS.find(P => P.key === key) || null;
const createProvider = (key, options) => {
  const Provider = getProviderClass(key);
  if (!Provider) throw Object.assign(new Error('Bilinmeyen veri sağlayıcısı.'), { status: 400 });
  return new Provider(options);
};

module.exports = { PROVIDERS, getProviderClass, createProvider };
