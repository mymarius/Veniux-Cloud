import React, { useState } from 'react';
import {
  Bell, CheckCircle2, Coins, PlayCircle, Settings2, Sparkles, UserCheck, Zap
} from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { Dropdown } from '../../ui';
import { Panel, PanelHead, Stat, Chip } from './Parts';

const STAGE_DEFS = [
  { id: 'qualification', label: 'Niteleme', hint: 'İlk temas kurulmuş, ihtiyaç doğrulanıyor' },
  { id: 'proposal', label: 'Teklif', hint: 'Fiyat ve kapsam paylaşıldı' },
  { id: 'negotiation', label: 'Pazarlık', hint: 'Sözleşme ve koşullar görüşülüyor' },
  { id: 'won', label: 'Kazanıldı', hint: 'Sözleşme imzalandı' },
  { id: 'lost', label: 'Kaybedildi', hint: 'Fırsat kapandı' }
];

function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled
      title="Bu önizleme bir işlem başlatmaz."
      className="flex shrink-0 items-center"
    >
      <span
        className="relative h-[22px] w-[38px] rounded-full transition-colors duration-200"
        style={{ background: on ? '#426b9c' : '#E5E7EB' }}
      >
        <span
          className="absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: on ? 'translateX(16px)' : 'none' }}
        />
      </span>
    </button>
  );
}

export default function CrmAutomations() {
  const { automations, toggleAutomation } = useCRM();

  // Ayarlar örnek veride tutulmaz; oturum boyunca yerel durumda yaşar.
  const [settings, setSettings] = useState({
    currency: 'TRY',
    autoAssign: 'round_robin',
    defaultOwner: '',
    notifyDealWon: true,
    notifyTaskDue: true,
    notifyLeadAssigned: false,
    weeklyDigest: true
  });
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const enabled = automations.filter((a) => a.enabled);
  const totalRuns = automations.reduce((s, a) => s + (a.runsCount || 0), 0);

  return (
    <fieldset disabled className="space-y-5"><p role="status" className="text-sm text-gray-500">CRM otomasyonları önizlemedir. Kurallar, otomatik atama ve bu bildirim seçenekleri henüz çalıştırılmaz. Asistan otomasyonu Sistem Ayarları ekranında ayrı olarak yönetilir.</p>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Etkin işaretli tanım" value={enabled.length} detail={`${automations.length} tanımlı`} icon={Zap} tone={enabled.length ? 'green' : 'slate'} />
        <Stat label="Kaydedilmiş sayaç" value={totalRuns.toLocaleString('tr-TR')} detail="çalıştırma kanıtı değildir" icon={PlayCircle} />
        <Stat label="Tanımlı adımlar" value={automations.reduce((s, a) => s + (a.actionsCount || 0), 0)} detail="adım" icon={Sparkles} tone="amber" />
        <Stat label="Önizleme seçenekleri" value={Object.entries(settings).filter(([k, v]) => k.startsWith('notify') && v).length} detail="açık" icon={Bell} tone="slate" />
      </div>

      <Panel>
        <PanelHead icon={Zap} title="Otomasyon kuralları" subtitle="Kayıtlı kural tanımları; çalıştırma servisi bağlı değil" />
        <div className="divide-y divide-gray-100">
          {automations.map((a) => (
            <div key={a.id} className="p-5">
              <div className="flex flex-wrap items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.enabled ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-400'}`}>
                  <Zap className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-gray-900">{a.name}</p>
                  <p className="mt-1 text-[11.5px] text-gray-500">
                    Tetikleyici: <b className="font-semibold text-gray-700">{a.trigger}</b>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip tone={a.enabled ? 'green' : 'slate'}>{a.enabled ? 'Etkin işaretli tanım' : 'Devre dışı tanım'}</Chip>
                    <Chip tone="slate">{a.actionsCount} adım</Chip>
                    <Chip tone="slate">{a.runsCount} çalışma</Chip>
                    <Chip tone="slate">Son: {a.lastRun}</Chip>
                  </div>
                </div>
                <Toggle on={a.enabled} onChange={() => toggleAutomation(a.id)} label={`${a.name} kuralını aç/kapat`} />
              </div>

              <ol className="mt-4 space-y-2.5 border-l-2 border-gray-100 pl-4">
                {(a.steps || []).map((s) => (
                  <li key={s.id} className="relative">
                    <span
                      className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full"
                      style={{ background: s.type === 'trigger' ? '#426b9c' : '#D6D3D1' }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {s.type === 'trigger' ? 'Tetikleyici' : 'İşlem'}
                    </span>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-gray-700">{s.label}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHead icon={Settings2} title="CRM ayarları" subtitle="Önizleme; uygulanmaz" />
          <div className="space-y-4 p-5">
            <label className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <Coins className="h-4 w-4" />
              </span>
              <span className="flex-1 text-[12.5px] font-bold text-gray-800">Para birimi</span>
              <Dropdown
                value={settings.currency}
                onChange={(e) => set('currency', e.target.value)}
                className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-300"
              >
                <option value="TRY">₺ Türk Lirası</option>
                <option value="USD">$ ABD Doları</option>
                <option value="EUR">€ Euro</option>
              </Dropdown>
            </label>

            <label className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <UserCheck className="h-4 w-4" />
              </span>
              <span className="flex-1 text-[12.5px] font-bold text-gray-800">Otomatik atama</span>
              <Dropdown
                value={settings.autoAssign}
                onChange={(e) => set('autoAssign', e.target.value)}
                className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-300"
              >
                <option value="round_robin">Sırayla dağıt</option>
                <option value="least_load">En az yüklü temsilci</option>
                <option value="fixed">Sabit sorumlu</option>
              </Dropdown>
            </label>

            {settings.autoAssign === 'fixed' && (
              <label className="flex items-center gap-3 pl-11">
                <span className="flex-1 text-[12px] font-semibold text-gray-600">Sabit sorumlu</span>
                <Dropdown
                  value={settings.defaultOwner}
                  onChange={(e) => set('defaultOwner', e.target.value)}
                  className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-300"
                >
                  <option value="Ahmet Yılmaz">Ahmet Yılmaz</option>
                  <option value="Elif Kaya">Elif Kaya</option>
                  <option value="Can Demir">Can Demir</option>
                </Dropdown>
              </label>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHead icon={Bell} title="Bildirim tercihleri" subtitle="Hangi olaylarda uyarı alınsın" />
          <div className="divide-y divide-gray-100">
            {[
              { k: 'notifyDealWon', t: 'Fırsat kazanıldığında', h: 'Sözleşme imzalanan her fırsat için' },
              { k: 'notifyTaskDue', t: 'Görev termini yaklaştığında', h: 'Termin gününde sabah hatırlatma' },
              { k: 'notifyLeadAssigned', t: 'Yeni aday atandığında', h: 'Portföyünüze aday düştüğünde' },
              { k: 'weeklyDigest', t: 'Haftalık özet', h: 'Pazartesi sabahı pipeline özeti' }
            ].map((row) => (
              <div key={row.k} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-gray-800">{row.t}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">{row.h}</p>
                </div>
                <Toggle on={settings[row.k]} onChange={() => set(row.k, !settings[row.k])} label={row.t} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHead icon={CheckCircle2} title="Pipeline aşamaları" subtitle="Fırsatların izlediği sıra" />
        <div className="flex flex-wrap gap-3 p-5">
          {STAGE_DEFS.map((s, i) => (
            <div key={s.id} className="flex min-w-[190px] flex-1 items-start gap-2.5 rounded-lg border border-gray-100 bg-gray-50/70 p-3.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold tabular-nums text-gray-500 shadow-2xs">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold text-gray-900">{s.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{s.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </fieldset>
  );
}
