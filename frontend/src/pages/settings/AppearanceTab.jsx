import React from 'react';
import { Check, Laptop, Moon, Palette, Play, RotateCcw, Rows3, Sun, Volume2, Type, Square, Gauge } from 'lucide-react';
import { Panel } from '../../components/dashboard/AnalyticsKit';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import { ACCENTS, DEFAULTS } from '../../lib/appearance';
import { playBeep } from '../../utils/sound';
import './AppearanceTab.css';

const MODES = [
  { id: 'light', label: 'Açık', hint: 'Beyaz zemin, gün ışığında okunaklı', icon: Sun },
  { id: 'dark', label: 'Koyu', hint: 'Düşük ışıklı depo ve gece vardiyası', icon: Moon },
  { id: 'system', label: 'Sistem', hint: 'Bilgisayarın ayarını takip eder', icon: Laptop }
];

const DENSITIES = [
  { id: 'comfortable', label: 'Rahat', hint: 'Geniş satır aralığı ve okunaklı yazı boyutu.' },
  { id: 'compact', label: 'Kompakt', hint: 'Daha küçük yazı ve dar satırlar; ekrana daha çok kayıt sığar.' }
];

// Every choice applies immediately and is remembered on this device.
export default function AppearanceTab() {
  const { prefs, update, theme } = useTheme();
  const { showToast } = useToast();
  const isDefault = Object.keys(DEFAULTS).every(k => prefs[k] === DEFAULTS[k]);

  const reset = () => {
    update(DEFAULTS);
    showToast('Görünüm varsayılan ayarlara döndü.', 'success');
  };

  return (
    <div className="appearance-page">
      <header className="ax-head" style={{ marginBottom: 18 }}>
        <div>
          <span className="ax-eyebrow"><i />Ayarlar · kişisel</span>
          <h1>Görünüm</h1>
          <p>Ekran modu, yazı tipi, boyut, renk, kart biçimi ve hareket tercihleri. Seçimleriniz anında uygulanır ve bu cihazda hatırlanır.</p>
        </div>
        <div className="ax-actions">
          <button className="ax-btn" onClick={reset} disabled={isDefault}><RotateCcw size={15} /> Varsayılana dön</button>
        </div>
      </header>

      <div className="appearance-grid">
        <Panel icon={Sun} title="Ekran modu" subtitle={prefs.mode === 'system' ? `Şu an sistem ayarı: ${theme === 'dark' ? 'koyu' : 'açık'}` : 'Uygulamanın genel renk düzeni'}>
          <div className="appearance-options" role="radiogroup" aria-label="Ekran modu">
            {MODES.map(({ id, label, hint, icon: Icon }) => (
              <button key={id} role="radio" aria-checked={prefs.mode === id} className="appearance-option" onClick={() => update({ mode: id })}>
                <span className={`appearance-preview appearance-preview-${id}`} aria-hidden="true"><i /><b /><b /></span>
                <span className="appearance-option-label"><Icon size={15} /> {label}</span>
                <small>{hint}</small>
                {prefs.mode === id && <Check size={15} className="appearance-check" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </Panel>

        <Panel icon={Palette} title="Vurgu rengi" subtitle="Butonlar, seçili öğeler ve bağlantılar">
          <div className="appearance-swatches" role="radiogroup" aria-label="Vurgu rengi">
            {ACCENTS.map(accent => (
              <button key={accent.id} role="radio" aria-checked={prefs.accent === accent.id} className="appearance-swatch" onClick={() => update({ accent: accent.id })}>
                <span className="appearance-dot" style={{ background: accent.hex }} aria-hidden="true">{prefs.accent === accent.id && <Check size={14} />}</span>
                <span><b>{accent.name}</b><small>{accent.hex}</small></span>
              </button>
            ))}
          </div>
          <div className="appearance-sample" aria-hidden="true">
            <span className="btn-primary appearance-sample-btn">Birincil buton</span>
            <span className="btn-soft">İkincil işlem</span>
            <span className="appearance-sample-link">Bağlantı</span>
          </div>
        </Panel>

        <Panel icon={Rows3} title="Yoğunluk" subtitle="Tablo satırları ve yazı boyutu">
          <div className="appearance-density" role="radiogroup" aria-label="Yoğunluk">
            {DENSITIES.map(({ id, label, hint }) => (
              <button key={id} role="radio" aria-checked={prefs.density === id} className="appearance-option appearance-option-row" onClick={() => update({ density: id })}>
                <span className="appearance-radio" aria-hidden="true" />
                <span><b>{label}</b><small>{hint}</small></span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel icon={Type} title="Yazı ve okunabilirlik" subtitle="Tüm ekranlarda ortak yazı tipi">
          <p className="text-sm"><strong>Veniux Manrope</strong> · Bilgisayar ve telefonda aynı yazı tipi kullanılır. Yazı dosyası programın içindedir; internet gerekmez.</p>
          <p className="text-xs text-gray-500 mt-4 mb-2">İçerik yazı boyutu</p><div className="appearance-size-options" role="radiogroup" aria-label="Yazı boyutu">{[['small','Küçük'],['standard','Standart'],['large','Büyük']].map(([id,label])=><button key={id} role="radio" aria-checked={prefs.textSize===id} className="appearance-option" onClick={()=>update({textSize:id})}><b>{label}</b></button>)}</div>
        </Panel>
        <Panel icon={Square} title="Kart biçimi" subtitle="Paneller ve bilgi kartlarının köşe görünümü">
          <div className="appearance-size-options" role="radiogroup" aria-label="Kart köşeleri">{[['sharp','Keskin',8],['balanced','Dengeli',14],['soft','Yumuşak',22]].map(([id,label,radius])=><button key={id} role="radio" aria-checked={prefs.corners===id} className="appearance-option" onClick={()=>update({corners:id})}><span className="appearance-corner-preview" style={{borderRadius:radius}} aria-hidden="true"/><b>{label}</b></button>)}</div>
        </Panel>
        <Panel icon={Gauge} title="Hareket ve performans" subtitle="Dekoratif geçişleri kişiselleştirin">
          <div className="appearance-density" role="radiogroup" aria-label="Arayüz hareketleri">{[['subtle','Hafif geçişler','Kısa sayfa ve düğme geçişleri.'],['off','Hareketleri kapat','Dekoratif animasyonlar ve tıklama efektleri kapalı.']].map(([id,label,hint])=><button key={id} role="radio" aria-checked={prefs.motion===id} className="appearance-option appearance-option-row" onClick={()=>update({motion:id})}><span className="appearance-radio"/><span><b>{label}</b><small>{hint}</small></span></button>)}</div><p className="text-xs text-gray-500 mt-3">İşletim sisteminin azaltılmış hareket tercihi de korunur. Bu ayar veri yenilemeyi ve güvenlik kontrollerini kapatmaz.</p>
        </Panel>
        <Panel icon={Volume2} title="Tarama sesleri" subtitle="Barkod, kasa ve el terminali">
          <div className="appearance-sound">
            <div>
              <b>Bip ve hata sesleri</b>
              <small>Başarılı okutmada kısa bip, hatalı barkodda uyarı sesi çalar.</small>
            </div>
            <button role="switch" aria-checked={prefs.sound} aria-label="Tarama sesleri" className="appearance-switch" onClick={() => update({ sound: !prefs.sound })}><span /></button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button className="btn-soft" data-size="sm" onClick={() => playBeep('success')} disabled={!prefs.sound}><Play size={13} /> Başarılı sesi dinle</button>
            <button className="btn-soft" data-size="sm" onClick={() => playBeep('error')} disabled={!prefs.sound}><Play size={13} /> Hata sesini dinle</button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
