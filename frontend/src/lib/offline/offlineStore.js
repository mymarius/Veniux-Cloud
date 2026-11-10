// IndexedDB bağdaştırıcısı (yalnız tarayıcı). Mantık offlineQueue.mjs ve offlineCatalog.mjs içindedir; burası ince bir depolama katmanıdır.
// Veritabanı: veniux-offline · "sales" (kimlik anahtarı) ve "catalog" (ürün kimliği anahtarı).
const NAME = 'veniux-offline', VERSION = 1;
let opening = null;

function open() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Bu tarayıcıda çevrimdışı depolama yok.')); return; }
    const request = indexedDB.open(NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sales')) db.createObjectStore('sales', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('catalog')) db.createObjectStore('catalog', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(request.error || new Error('Çevrimdışı depo açılamadı.')); };
  });
  return opening;
}
const run = (storeName, mode, work) => open().then(db => new Promise((resolve, reject) => {
  const tx = db.transaction(storeName, mode), store = tx.objectStore(storeName);
  let result;
  Promise.resolve(work(store, tx)).then(value => { result = value; }).catch(reject);
  tx.oncomplete = () => resolve(result);
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('Çevrimdışı depo işlemi iptal edildi.'));
}));
const wrap = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });

// offlineQueue.mjs ile uyumlu: get / put / getAll / delete
export const salesStore = {
  get: id => run('sales', 'readonly', store => wrap(store.get(id))),
  put: record => run('sales', 'readwrite', store => wrap(store.put(record))),
  getAll: () => run('sales', 'readonly', store => wrap(store.getAll())),
  delete: id => run('sales', 'readwrite', store => wrap(store.delete(id))),
};
// Ürün listesi: tümü tek işlemde değiştirilir; indirme yarıda kalırsa eski liste bozulmaz (çağıran yalnız tamamlanınca çağırır).
export const catalogStore = {
  getAll: () => run('catalog', 'readonly', store => wrap(store.getAll())),
  replaceAll: items => run('catalog', 'readwrite', async store => { store.clear(); for (const item of items) store.put(item); }),
};
