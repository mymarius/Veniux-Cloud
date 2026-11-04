import React, { useState, useEffect } from 'react';
import {
  Database,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Terminal,
  FileCheck,
  Lock,
  Server,
  Layers,
  ChevronRight,
  ExternalLink,
  Info,
  X
} from 'lucide-react';
import apiClient from '../../api/client';
import { useToast } from '../Toast';

export default function DatabaseMigrationModal({ isOpen, onClose }) {
  const [activeStep, setActiveStep] = useState(1);
  const [engineInfo, setEngineInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchEngineStatus();
    }
  }, [isOpen]);

  const fetchEngineStatus = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/settings/system-engine');
      setEngineInfo(res.data);
    } catch (err) {
      console.error('Failed to load system engine', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentEngine = engineInfo?.engine?.toLowerCase() === 'mysql' ? 'MySQL' : 'SQLite';

  const STEPS = [
    {
      id: 1,
      title: 'Ortam & Ön Koşul',
      subtitle: 'Hedef MySQL 8.4 ve sürücü analizi',
      icon: Server,
    },
    {
      id: 2,
      title: 'Güvenlik Yedeği',
      subtitle: 'Tutarlı snapshot ve dosya güvenliği',
      icon: ShieldCheck,
    },
    {
      id: 3,
      title: 'Şema & Veri Paritesi',
      subtitle: '84 tablo, 64-bit ID ve lot aktarımı',
      icon: Layers,
    },
    {
      id: 4,
      title: 'En Az İzinli Runtime',
      subtitle: 'Hesap ayrımı ve depo kapsamı',
      icon: Lock,
    },
    {
      id: 5,
      title: 'Devreye Alma (Cutover)',
      subtitle: 'Çift yazma engeli ve oturum sıfırlama',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-brand-500/10 text-brand-600 rounded-xl">
              <Database className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Veritabanı Geçişi (SQLite → MySQL)
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  currentEngine === 'MySQL'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                }`}>
                  Aktif Motor: {currentEngine}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Veniux kurumsal SQLite → MySQL 8.4 motor geçişi, şema bütünlüğü, çift yazma koruması ve geri yükleme kılavuzu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 overflow-x-auto">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = activeStep === s.id;
            const isCompleted = activeStep > s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 font-semibold'
                    : isCompleted
                    ? 'text-emerald-600 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : isCompleted
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.id}
                </div>
                <div className="text-left">
                  <div className="leading-tight">{s.title}</div>
                </div>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 ml-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeStep === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-brand-600" />
                  Mevcut Çalışma Ortamı ve Veritabanı Telemetrisi
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] text-slate-500 block">Çalışan Motor</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">{currentEngine}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] text-slate-500 block">Sürücü</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">{engineInfo?.dbDriver || 'mysql2 / sqlite3'}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] text-slate-500 block">Node.js Sürümü</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">{engineInfo?.nodeVersion || process.version}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[11px] text-slate-500 block">Veritabanı Boyutu</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">{engineInfo?.dbSize || 'Ölçülüyor'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  MySQL 8.4 Ön Koşul Gereksinimleri
                </h4>
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Binary Log Açık ve ROW Formatında:</strong>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Üretim MySQL sunucusunda <code>log_bin=ON</code> ve <code>binlog_format=ROW</code> yapılandırılmış olmalıdır.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white">Ayrı Hedef Veritabanı İlkesi:</strong>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Geçiş işlemi canlı veritabanında değil, DBA tarafından önceden oluşturulmuş boş bir hedefte (ör. <code>veniux_recovery_*</code>) yürütülür. Canlı DB asla yerinde ezilmez.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-200">
                      Geçiş Öncesi Zorunlu Güvenlik Yedeği
                    </h4>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Herhangi bir şema oluşturma veya veri aktarımı öncesinde mutlaka tutarlı bir nokta snapshot'ı ve yüklenen dosyaların yedeği alınmalıdır. Hata durumunda bu güvenlik yedeği referans alınır.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-brand-600" />
                  Yedekleme Kapsamı ve Bütünlük Doğrulaması
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5">
                  <li><strong>Veritabanı Dosyası / Snapshot:</strong> SQLite için WAL checkpoint ile tutarlı dosya kopyası; MySQL için tutarlı export snapshot'ı.</li>
                  <li><strong>Depo ve İlaç Görselleri:</strong> <code>medicine-images</code> depolama alanındaki tüm fiziki dosyaların SHA-256 bütünlüğü.</li>
                  <li><strong>Şifreleme:</strong> Yerel güvenli yedekler AES-256-GCM ile korunur; sırları arındırılmış taşınabilir yedek indirme seçeneği mevcuttur.</li>
                </ul>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-600" />
                  Şema Paritesi ve Derin Veri Doğrulaması
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  84 tablo, 897 sütun, 11 trigger ve ilişkisel bütünlük kuralları SQLite ile MySQL arasında tam pariteye sahiptir.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <strong className="text-slate-900 dark:text-white block mb-1">64-bit ID (BIGINT) Korunumu</strong>
                  <p className="text-slate-500 dark:text-slate-400">
                    <code>9007199254740995</code> gibi 2^53-1 üzerindeki 64-bit kimlikler JSON API ve veritabanında string olarak aktarılır; IEEE-754 kayan noktalı sayı kaybına uğramaz.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <strong className="text-slate-900 dark:text-white block mb-1">6 Basamaklı Hassas Lot Miktarları</strong>
                  <p className="text-slate-500 dark:text-slate-400">
                    <code>DECIMAL(24,6)</code> sayesinde parçalı lot bakiyeleri (ör. <code>120.500001</code>) kuruş ve gram hassasiyetinde tam eşitlikle aktarılır.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <strong className="text-slate-900 dark:text-white block mb-1">Tek Açık Vardiya Generated Index</strong>
                  <p className="text-slate-500 dark:text-slate-400">
                    MySQL'de partial index desteği yerine generated column + unique index kombinasyonu ile her kasada aynı anda yalnızca tek açık vardiya açılabilir.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <strong className="text-slate-900 dark:text-white block mb-1">Yarıda Kesilme Güvencesi</strong>
                  <p className="text-slate-500 dark:text-slate-400">
                    Aktarım ortasında hata oluşursa işlem rollback edilir; hedef <code>failed</code> olarak kilitlenir. <code>--clean-interrupted-target</code> ile temizlenmeden tekrar yazmaya izin verilmez.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto">
                <span className="text-slate-500"># SQLite'tan MySQL'e veri aktarım komutu:</span><br />
                <code>node --env-file=hedef.env scripts/sqlite_to_mysql.js --source ./storage/database.sqlite --confirm-empty-target</code>
              </div>
            </div>
          )}

          {activeStep === 4 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-brand-600" />
                  En Az İzinli Runtime Hesabı ve Kapsam Kısıtlaması
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Güvenlik gereği uygulamanın günlük çalışması (Runtime) ile DDL gerektiren Migration hesapları birbirinden kesin olarak ayrılmıştır.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-slate-900 dark:text-white block">Runtime Hesabı (Salt DML)</strong>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Yalnızca <code>SELECT, INSERT, UPDATE, DELETE</code> izinlerine sahiptir. Tablo silme, oluşturma veya trigger değiştirme yetkisi yoktur.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-slate-900 dark:text-white block">Migration / DBA Hesabı</strong>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Şema güncellemeleri ve tablo yapısı için gerekli DDL izinlerine sahiptir. Yalnızca yetkili geçiş komutlarıyla kullanılır.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 5 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-emerald-900 dark:text-emerald-200">
                      Devreye Alma (Cutover) & Çift Yazma Engeli
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      Yeni hedef onaylandıktan sonra sıfır veri kaybı güvencesiyle canlıya geçiş yapılır.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <strong className="text-slate-900 dark:text-white block">1. Çoklu Süreç Yazma Bariyeri (Multi-Process Mutex)</strong>
                  <p className="text-slate-500 dark:text-slate-400">
                    Bellek içi kilitler bağımsız işletim sistemi süreçlerini koruyamaz. Veniux, sistem genelindeki tüm yazmaları InnoDB satır kilidi (<code>veniux_write_mutex FOR UPDATE</code>) ile korur. Bakım sırasında ikinci bir sürecin hedefe yazması engellenir.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <strong className="text-slate-900 dark:text-white block">2. Eski Oturumların Geçersiz Kılınması</strong>
                  <p className="text-slate-500 dark:text-slate-400">
                    Geçiş anında <code>session_version</code> artırılarak eski veritabanı bağlantılarına ait tüm JWT oturumları anında 401 ile reddedilir.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <strong className="text-slate-900 dark:text-white block">3. Yeniden Başlatmada Kalıcılık (Persistence)</strong>
                  <p className="text-slate-500 dark:text-slate-400">
                    Uygulama yeniden başlatıldığında <code>install.env</code> dosyasına kaydedilen hedef kullanılır; motor geriye doğru SQLite'a düşmez.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
              disabled={activeStep === 1}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Geri
            </button>
            <button
              onClick={() => setActiveStep(prev => Math.min(STEPS.length, prev + 1))}
              disabled={activeStep === STEPS.length}
              className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl disabled:opacity-40 transition flex items-center gap-1.5"
            >
              <span>İleri</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
