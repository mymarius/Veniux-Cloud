const pool = require('../config/database');
// Belgesiz stok düşüşlerini kayıp şüphesi olarak işaretler. Sebepler kesin tespit değil, incelenecek ipuçlarıdır.
const LOOKBACK_HOURS = 48, VELOCITY_DAYS = 30, MIN_UNITS = 2, VELOCITY_FACTOR = 3;
const stamp = date => date.toISOString().slice(0, 19).replace('T', ' ');
const local = value => new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z');
const istanbulHour = date => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' }).format(date));

function reasonsFor(row, { velocity, countShortages, sameDayDrops, date }) {
  const reasons = [];
  if (!String(row.note || '').trim()) reasons.push('işleme açıklama girilmemiş');
  const hour = istanbulHour(date);
  if (hour >= 22 || hour < 7) reasons.push('mesai dışı saatte yapılmış');
  if (velocity > 0) reasons.push(`günlük ortalama çıkışın ${Math.round(Math.abs(Number(row.change_amount)) / velocity)} katı`);
  else reasons.push('son 30 günde bu üründe başka çıkış yok');
  if (sameDayDrops > 1) reasons.push(`aynı gün ${sameDayDrops} elle düşüş var`);
  if (countShortages > 0) reasons.push('son 30 günde sayımda da eksik çıkmış');
  return reasons;
}

async function run(tenantId = null, now = new Date()) {
  return pool.transaction(async client => {
    const since = stamp(new Date(now.getTime() - LOOKBACK_HOURS * 3600000)), monthAgo = stamp(new Date(now.getTime() - VELOCITY_DAYS * 86400000));
    const rows = (await client.query(`SELECT m.*,p.name AS product_name,p.purchase_price FROM stock_movements m JOIN products p ON p.id=m.product_id AND p.tenant_id=m.tenant_id
      WHERE m.change_amount<0 AND m.created_at>=$1 AND m.movement_type IN ('adjustment','outbound') AND (m.source IS NULL OR m.source='manual')
      ${tenantId == null ? '' : 'AND m.tenant_id=$2'} ORDER BY m.id`, tenantId == null ? [since] : [since, tenantId])).rows;
    let created = 0;
    for (const row of rows) {
      const units = Math.abs(Number(row.change_amount));
      const prior = (await client.query(`SELECT COALESCE(SUM(CASE WHEN source='stocktake' THEN 0 ELSE ABS(change_amount) END),0) AS outbound,
        COALESCE(SUM(CASE WHEN source='stocktake' THEN 1 ELSE 0 END),0) AS shortages FROM stock_movements
        WHERE tenant_id=$1 AND product_id=$2 AND change_amount<0 AND created_at>=$3 AND id<>$4`, [row.tenant_id, row.product_id, monthAgo, row.id])).rows[0];
      const velocity = Number(prior.outbound) / VELOCITY_DAYS;
      if (units < Math.max(MIN_UNITS, velocity * VELOCITY_FACTOR)) continue;
      const prefix = `[loss:${row.id}]`;
      const seen = await client.query('SELECT id FROM alerts WHERE tenant_id=$1 AND alert_type=$2 AND message LIKE $3', [row.tenant_id, 'loss_suspicion', prefix + '%']);
      if (seen.rows.length) continue;
      const date = local(row.created_at);
      const sameDay = (await client.query(`SELECT COUNT(*) AS n FROM stock_movements WHERE tenant_id=$1 AND product_id=$2 AND change_amount<0 AND created_at>=$3 AND (source IS NULL OR source='manual')`, [row.tenant_id, row.product_id, stamp(new Date(date.getTime() - 86400000))])).rows[0];
      const reasons = reasonsFor(row, { velocity, countShortages: Number(prior.shortages), sameDayDrops: Number(sameDay.n), date });
      const value = units * Number(row.purchase_price || 0);
      const message = `${prefix} ${row.product_name}: belgesiz ${units} adet düşüş${value ? ` (yaklaşık ${value.toLocaleString('tr-TR')} TL)` : ''}. İncelenecek ipuçları: ${reasons.join('; ')}.`;
      await client.query("INSERT INTO alerts (tenant_id,product_id,warehouse_id,alert_type,severity,message,status) VALUES ($1,$2,$3,'loss_suspicion','warning',$4,'unread')", [row.tenant_id, row.product_id, row.warehouse_id, message]);
      created++;
    }
    return { created };
  });
}

let timer;
function startScheduler(intervalMs = 15 * 60000) {
  if (timer) return;
  const tick = () => run().catch(error => console.error('[Kayıp izleme] Çalışmadı:', error.message));
  tick();
  timer = setInterval(tick, intervalMs);
  timer.unref();
}
module.exports = { run, startScheduler };
