const express = require('express');
const pool = require('../config/database');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const router = express.Router();
const collections = {
  crm: ['companies','contacts','leads','deals','tasks','activities','automations','notifications'],
  hr: ['employees','schedule','attendance','leaveRequests','balances','goals','reviews']
};
const empty = scope => Object.fromEntries(collections[scope].map(key => [key, []]));
router.use(authMiddleware);
router.use('/:scope', (req,res,next) => {
  if (!collections[req.params.scope]) return res.status(404).json({error:'Çalışma alanı bulunamadı.'});
  if (req.params.scope === 'hr') return requireRole('admin','manager')(req,res,next);
  next();
});
router.get('/:scope', async (req,res,next) => {
  try {
    const row = (await pool.query('SELECT payload,revision FROM workspace_collections WHERE tenant_id=$1 AND scope=$2 AND name=$3',[req.user.tenantId,req.params.scope,'workspace'])).rows[0];
    res.json({ data:row ? JSON.parse(row.payload) : empty(req.params.scope), revision:row?.revision || 0 });
  } catch(error) { next(error); }
});
router.put('/:scope', requireRole('admin','manager'), async (req,res,next) => {
  try {
    const { data, revision }=req.body;
    const scope=req.params.scope;
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Number.isSafeInteger(revision) || revision < 0 || Object.keys(data).some(key=>!collections[scope].includes(key))) return res.status(400).json({error:'Geçersiz çalışma alanı verisi.'});
    for (const key of collections[scope]) {
      if (!Array.isArray(data[key]) || data[key].length>10000 || data[key].some(row=>!row || typeof row!=='object' || Array.isArray(row))) return res.status(400).json({error:`Geçersiz koleksiyon: ${key}`});
      const ids=data[key].map(row=>row.id).filter(id=>id!==undefined);
      if (new Set(ids).size!==ids.length) return res.status(400).json({error:'Aynı kayıt birden fazla kez gönderildi.'});
    }
    if (scope==='crm') {
      for (const [key,field] of [['companies','name'],['contacts','fullName'],['leads','name'],['deals','title'],['tasks','title']]) {
        if(data[key].some(row=>!String(row[field]||'').trim())) return res.status(400).json({error:`Zorunlu alan eksik: ${key}/${field}`});
      }
    }
    if (scope==='hr') {
      if(data.employees.some(row=>!String(row.fullName||'').trim())) return res.status(400).json({error:'Personel adı zorunludur.'});
      const employees=new Set(data.employees.map(row=>row.id));
      if(data.leaveRequests.some(row=>!employees.has(row.employeeId) || !Number.isFinite(row.days) || row.days<=0 || row.endDate<row.startDate)) return res.status(400).json({error:'İzin tarihleri veya personel geçersiz.'});
    }
    const payload=JSON.stringify(data);
    if(Buffer.byteLength(payload)>2*1024*1024) return res.status(413).json({error:'Çalışma alanı boyut sınırı aşıldı.'});
    const result=await pool.transaction(async client=>{
      const tenant=req.user.tenantId;
      const current=(await client.query('SELECT revision FROM workspace_collections WHERE tenant_id=$1 AND scope=$2 AND name=$3',[tenant,scope,'workspace'])).rows[0];
      if((current?.revision||0)!==revision) throw Object.assign(new Error('Kayıtlar başka bir kullanıcı tarafından değiştirildi. Güncel verileri yükleyip yeniden deneyin.'),{status:409});
      if(current) {
        const updated=await client.query('UPDATE workspace_collections SET payload=$1,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND scope=$3 AND name=$4 AND revision=$5',[payload,tenant,scope,'workspace',revision]);
        if(!updated.rowCount) throw Object.assign(new Error('Kayıt sürümü değişti. Yeniden yükleyin.'),{status:409});
      } else await client.query('INSERT INTO workspace_collections (tenant_id,scope,name,payload,revision) VALUES ($1,$2,$3,$4,1)',[tenant,scope,'workspace',payload]);
      return {revision:revision+1};
    });
    res.json(result);
  }catch(error){next(error);}
});
module.exports=router;
