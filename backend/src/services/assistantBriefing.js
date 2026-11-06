const db=require('../config/database');

// Read-only owner briefing. It reports recorded facts and never changes business data.
const count=(n,word)=>`${Number(n).toLocaleString('tr-TR')} ${word}`;

function parseSince(value){
 if(typeof value!=='string'||!value)return null;
 const date=new Date(value);
 if(Number.isNaN(date.getTime())||date.getTime()>Date.now())return null;
 return date;
}
// Timestamps are stored as UTC 'YYYY-MM-DD HH:MM:SS'.
const stored=date=>date.toISOString().slice(0,19).replace('T',' ');

function displayName(user){
 const name=String(user?.full_name||'').trim();
 return name&&!name.includes('@')?name:'';
}

function compose({name,since,movements,run,critical,alerts,low,drafts=0}){
 const lines=[];
 if(since)lines.push(movements?`Son girişinizden beri ${count(movements,'stok hareketi')} kaydedildi.`:'Son girişinizden beri stok hareketi kaydedilmedi.');
 if(run)lines.push(run.status==='completed'?`Otomatik kontrol tamamlandı.${run.summary?' '+String(run.summary).slice(0,300):''}`:run.status==='running'?'Otomatik kontrol şu anda çalışıyor.':'Son otomatik kontrol tamamlanamadı. Asistan otomasyonu sayfasına bakın.');
 if(alerts)lines.push(critical?`${count(alerts,'açık uyarı')} var, ${Number(critical).toLocaleString('tr-TR')} tanesi kritik.`:`${count(alerts,'açık uyarı')} var.`);
 if(low.total)lines.push(`${count(low.total,'ürün')} minimum seviyede veya altında: ${low.names.join(', ')}${low.total>low.names.length?' ve diğerleri':''}.`);
 if(drafts)lines.push(`${count(drafts,'sipariş taslağı')} onayınızı bekliyor.`);
 if(!lines.length||(!alerts&&!low.total&&!movements&&!run&&!drafts))lines.push('Dikkat etmeniz gereken yeni bir şey görünmüyor.');
 const greeting=`Hoş geldiniz${name?' '+name:''} efendim.`;
 return {greeting,lines,speech:[greeting,...lines].join(' ')};
}

async function briefing(user,sinceValue){
 const tenant=user.tenantId,since=parseSince(sinceValue);
 const profile=(await db.query('SELECT full_name FROM users WHERE id=$1 AND tenant_id=$2',[user.userId,tenant])).rows[0];
 const movements=since?Number((await db.query('SELECT COUNT(*) count FROM stock_movements WHERE tenant_id=$1 AND created_at>$2',[tenant,stored(since)])).rows[0].count):0;
 const run=since?(await db.query('SELECT status,summary,started_at FROM assistant_runs WHERE tenant_id=$1 AND started_at>$2 ORDER BY id DESC LIMIT 1',[tenant,since.toISOString()])).rows[0]||null:null;
 const alertRow=(await db.query("SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN severity IN ('critical','danger') THEN 1 ELSE 0 END),0) critical FROM alerts WHERE tenant_id=$1 AND status IN ('unread','active')",[tenant])).rows[0];
 const lowRows=(await db.query(`SELECT p.name FROM products p LEFT JOIN stock_records s ON s.product_id=p.id AND s.tenant_id=p.tenant_id
  WHERE p.tenant_id=$1 GROUP BY p.id,p.name,p.min_stock_level HAVING COALESCE(SUM(s.quantity),0)<=p.min_stock_level ORDER BY COALESCE(SUM(s.quantity),0) ASC,p.id ASC`,[tenant])).rows;
 const drafts=Number((await db.query("SELECT COUNT(*) count FROM purchase_orders WHERE tenant_id=$1 AND status='draft'",[tenant])).rows[0].count);
 const facts={movements,run,alerts:Number(alertRow.total),critical:Number(alertRow.critical),low:{total:lowRows.length,names:lowRows.slice(0,3).map(r=>r.name)},drafts};
 return {...compose({name:displayName(profile),since,...facts}),facts:{movements,alerts:facts.alerts,critical:facts.critical,low_stock:facts.low.total,draft_orders:drafts},since:since?since.toISOString():null};
}

module.exports={briefing,compose,parseSince,displayName};
