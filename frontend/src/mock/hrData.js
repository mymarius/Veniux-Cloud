/**
 * Personel Yönetim Veri Seti (örnek veri).
 *
 * CRM tarafıyla aynı mantık: veriler tarayıcıda tutulur, sayfa yenilenince
 * başlangıç durumuna döner. Kalıcı hâle getirmek istendiğinde bu dosyanın
 * yerini backend uçları alır; bileşenler aynı şekilde çalışmaya devam eder.
 */

export const DEPARTMENTS = [
  { id: 'dep-depo', name: 'Depo Operasyonları', color: '#0F172A' },
  { id: 'dep-satis', name: 'Satış & CRM', color: '#0F172A' },
  { id: 'dep-lojistik', name: 'Lojistik & Sevkiyat', color: '#0F172A' },
  { id: 'dep-muhasebe', name: 'Muhasebe & Finans', color: '#0F172A' },
  { id: 'dep-bt', name: 'Bilgi Teknolojileri', color: '#0F172A' }
];

export const SHIFT_TYPES = [
  { id: 'gunduz', name: 'Gündüz', start: '08:00', end: '16:00', color: '#334155' },
  { id: 'aksam', name: 'Akşam', start: '16:00', end: '24:00', color: '#334155' },
  { id: 'gece', name: 'Gece', start: '00:00', end: '08:00', color: '#0F172A' },
  { id: 'izinli', name: 'İzinli', start: '—', end: '—', color: '#94A3B8' }
];

export const LEAVE_TYPES = [
  { id: 'yillik', name: 'Yıllık İzin' },
  { id: 'mazeret', name: 'Mazeret İzni' },
  { id: 'rapor', name: 'İstirahat Raporu' },
  { id: 'ucretsiz', name: 'Ücretsiz İzin' },
  { id: 'dogum', name: 'Doğum / Babalık İzni' }
];

export const WEEK_DAYS = [
  { label: 'Pzt', date: '07 Eyl' },
  { label: 'Sal', date: '08 Eyl' },
  { label: 'Çar', date: '09 Eyl' },
  { label: 'Per', date: '10 Eyl' },
  { label: 'Cum', date: '11 Eyl' },
  { label: 'Cmt', date: '12 Eyl' },
  { label: 'Paz', date: '13 Eyl' }
];

export const INITIAL_EMPLOYEES = [];
export const INITIAL_SCHEDULE = [];
export const INITIAL_ATTENDANCE = [];
export const ATTENDANCE_TREND = [];
export const INITIAL_LEAVE_BALANCES = [];
export const INITIAL_LEAVE_REQUESTS = [];
export const INITIAL_GOALS = [];
export const INITIAL_REVIEWS = [];
