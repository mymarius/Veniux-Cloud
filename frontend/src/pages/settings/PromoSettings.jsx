import { useState } from 'react';
import api from '../../api/client';

const today = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
const KIND = { buy_x_pay_y: 'X al Y öde', percent: 'Yüzde indirim' };

// Kasa kampanyaları ve sadakat kartları (yönetici ve müdür).
export default function PromoSettings() {
  const [campaigns, setCampaigns] = useState(null), [cards, setCards] = useState(null), [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', kind: 'buy_x_pay_y', barcode: '', buy_qty: 3, pay_qty: 2, percent: 10, starts_on: today(), ends_on: today(), requires_approval: false });
  const [card, setCard] = useState({ card_no: '', name: '', phone: '' });
  const set = k => e => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const fail = e => setMessage(e.response?.data?.error || 'İşlem tamamlanamadı.');
  const load = async () => { try { const [a, b] = await Promise.all([api.get('/scanner/pro/campaigns'), api.get('/scanner/pro/loyalty/cards')]); setCampaigns(a.data); setCards(b.data); setMessage(''); } catch (e) { fail(e); } };
  const save = async e => {
    e.preventDefault();
    const body = { name: form.name, kind: form.kind, starts_on: form.starts_on, ends_on: form.ends_on, requires_approval: form.requires_approval, ...(form.barcode.trim() ? { barcode: form.barcode.trim() } : {}), ...(form.kind === 'buy_x_pay_y' ? { buy_qty: Number(form.buy_qty), pay_qty: Number(form.pay_qty) } : { percent: Number(form.percent) }) };
    try { await api.post('/scanner/pro/campaigns', body, { headers: { 'Idempotency-Key': crypto.randomUUID() } }); setForm(old => ({ ...old, name: '', barcode: '' })); setMessage('Kampanya kaydedildi.'); await load(); } catch (e) { fail(e); }
  };
  const toggle = async c => { try { await api.put(`/scanner/pro/campaigns/${c.id}/active`, { active: !Number(c.active) }); await load(); } catch (e) { fail(e); } };
  const addCard = async e => { e.preventDefault(); try { await api.post('/scanner/pro/loyalty/cards', card, { headers: { 'Idempotency-Key': crypto.randomUUID() } }); setCard({ card_no: '', name: '', phone: '' }); setMessage('Kart oluşturuldu.'); await load(); } catch (e) { fail(e); } };
  return <section className="veniux-card p-4 mt-4 space-y-3">
    <h2 className="font-semibold">Kampanyalar ve sadakat</h2>
    <p className="text-sm">Kampanya kasada otomatik uygulanır; her ürüne en çok indirim veren tek kampanya geçer. "Onay gerekir" işaretli kampanya yalnız yönetici, müdür veya indirim yetkisi verilmiş kasiyerin satışında uygulanır. Sadakat: her 10 TL alışverişe 1 puan, 1 puan 10 kuruş indirim; iadede kazanılan puan geri alınır.</p>
    <button type="button" className="btn-secondary" onClick={load}>Yükle</button>
    {message && <p role="status" className="text-sm">{message}</p>}
    {campaigns && <>
      <form className="grid sm:grid-cols-3 gap-2" onSubmit={save}>
        <label className="text-sm">Ad<input className="block w-full" value={form.name} onChange={set('name')} required /></label>
        <label className="text-sm">Tür<select className="block w-full" value={form.kind} onChange={set('kind')}><option value="buy_x_pay_y">X al Y öde</option><option value="percent">Yüzde indirim</option></select></label>
        <label className="text-sm">Ürün barkodu{form.kind === 'percent' ? ' (boş: tüm ürünler)' : ''}<input className="block w-full" value={form.barcode} onChange={set('barcode')} inputMode="numeric" /></label>
        {form.kind === 'buy_x_pay_y' ? <><label className="text-sm">Alınan adet<input className="block w-full" type="number" min="2" value={form.buy_qty} onChange={set('buy_qty')} /></label><label className="text-sm">Ödenen adet<input className="block w-full" type="number" min="1" value={form.pay_qty} onChange={set('pay_qty')} /></label></>
          : <label className="text-sm">İndirim %<input className="block w-full" type="number" min="1" max="90" value={form.percent} onChange={set('percent')} /></label>}
        <label className="text-sm">Başlangıç<input className="block w-full" type="date" value={form.starts_on} onChange={set('starts_on')} /></label>
        <label className="text-sm">Bitiş<input className="block w-full" type="date" value={form.ends_on} onChange={set('ends_on')} /></label>
        <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={form.requires_approval} onChange={set('requires_approval')} />Onay gerekir</label>
        <button className="btn-primary">Kampanya ekle</button>
      </form>
      <table className="w-full text-sm"><thead><tr><th className="text-left">Kampanya</th><th className="text-left">Kural</th><th className="text-left">Tarih</th><th /></tr></thead><tbody>{campaigns.map(c => <tr key={c.id}><td>{c.name}{Number(c.requires_approval) ? ' · onaylı' : ''}</td><td>{KIND[c.kind]} · {c.kind === 'percent' ? `%${c.percent}` : `${c.buy_qty} al ${c.pay_qty} öde`} · {c.product_name || 'tüm ürünler'}</td><td>{c.starts_on} – {c.ends_on}</td><td><button type="button" className="btn-soft" onClick={() => toggle(c)}>{Number(c.active) ? 'Durdur' : 'Başlat'}</button></td></tr>)}</tbody></table>
    </>}
    {cards && <>
      <h3 className="font-semibold">Sadakat kartları</h3>
      <form className="flex flex-wrap gap-2 items-end" onSubmit={addCard}>
        <label className="text-sm">Kart no<input className="block w-full" value={card.card_no} onChange={e => setCard({ ...card, card_no: e.target.value })} required /></label>
        <label className="text-sm">Müşteri adı<input className="block w-full" value={card.name} onChange={e => setCard({ ...card, name: e.target.value })} required /></label>
        <label className="text-sm">Telefon (isteğe bağlı)<input className="block w-full" value={card.phone} onChange={e => setCard({ ...card, phone: e.target.value })} /></label>
        <button className="btn-primary">Kart oluştur</button>
      </form>
      <table className="w-full text-sm"><thead><tr><th className="text-left">Kart</th><th className="text-left">Müşteri</th><th className="text-right">Puan</th></tr></thead><tbody>{cards.map(c => <tr key={c.id}><td>{c.card_no}</td><td>{c.name}</td><td className="text-right">{c.points}</td></tr>)}</tbody></table>
    </>}
  </section>;
}
