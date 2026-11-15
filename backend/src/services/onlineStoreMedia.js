// Ürün görselleri: dosya yolu üretimi (yükleme ve işleme sonraki adımda eklenir).
const path = require('path');
const runtimeConfig = require('../config/runtimeConfig');
const root = () => path.join(runtimeConfig.paths().data, 'online-media');
// Yalnız veritabanındaki kayıttan (tenant_id + file_key) gelen değerlerle yol kurulur; kullanıcı girdisi dosya adına girmez.
const pathOf = row => (row && Number.isSafeInteger(Number(row.tenant_id)) && /^[A-Za-z0-9_-]{16,64}$/.test(String(row.file_key)) ? path.join(root(), String(Number(row.tenant_id)), row.file_key + '.webp') : null);
module.exports = { pathOf, root };
