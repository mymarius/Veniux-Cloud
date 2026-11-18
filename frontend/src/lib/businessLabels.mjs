// Ayarlar: rol adları ve sektör seçenekleri. Saf mantık; arayüzden bağımsız test edilir.
export const ROLE_LABELS = {
  admin: 'Yönetici',
  manager: 'Müdür',
  warehouse_lead: 'Depo sorumlusu',
  cashier: 'Kasiyer',
  operator: 'Depo operatörü',
  pharmacist: 'Kayıt görevlisi', // iç değer eskiden kalma; ekranda genel bir ad gösterilir
  viewer: 'İzleyici'
};
export const roleLabel = role => ROLE_LABELS[String(role || '').toLowerCase()] || (role ? String(role) : '—');

export const SECTORS = ['Market / Bakkal', 'Kırtasiye', 'Hırdavat', 'Züccaciye', 'Kafe', 'Pide ve restoran', 'Toptan / Depo', 'Diğer'];

// Kayıtlı sektör listede yoksa (eski kayıt ya da elle yazılmış) kaybolmasın diye seçeneklere eklenir.
export function sectorOptions(current) {
  const value = String(current || '').trim();
  const list = value && !SECTORS.includes(value) ? [value, ...SECTORS] : SECTORS;
  return [{ value: '', label: 'Seçin' }, ...list.map(name => ({ value: name, label: name }))];
}
