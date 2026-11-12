jest.mock('../src/services/nvidiaAIService',()=>({complete:jest.fn().mockResolvedValue('Kaç depo ve kullanıcı için çözüm arıyorsunuz?')}));
const request=require('supertest');
const app=require('../src/index');
const {complete}=require('../src/services/nvidiaAIService');
test('visitor receives public welcome and current plans without signing in',async()=>{
 const r=await request(app).get('/api/ai/visitor');
 expect(r.status).toBe(200);expect(r.body.greeting).toContain('hoş geldiniz');expect(r.body.plans).toHaveLength(3);
 expect(r.body.plans.find(p=>p.id==='baslangic').annual_try).toBe(8388);
 expect(JSON.stringify(r.body)).not.toMatch(/price_usd|USD/);
 // Fiyatlar sitedeki fiyat sayfasıyla aynı olmalı.
 const site=require('fs').readFileSync(require('path').join(__dirname,'../../website-php/pricing.php'),'utf8');
 for(const p of r.body.plans){const start=site.indexOf("'"+p.id+"'=>[");expect(start).toBeGreaterThan(-1);const row=site.slice(start,site.indexOf("'features'",start));const annual=/'annual'=>(\d+)/.exec(row),quarter=/'quarter'=>(null|\d+)/.exec(row);expect(Number(annual[1])).toBe(p.annual_try);expect(quarter[1]==='null'?null:Number(quarter[1])).toBe(p.quarter_try);}
 expect(JSON.stringify(r.body)).not.toMatch(/nvapi-|password|tenant_id/);
});
test('visitor chat uses only public plan context and disables reasoning',async()=>{
 const r=await request(app).post('/api/ai/visitor/chat').send({message:'Eczane için hangi paketi önerirsiniz?',history:[]});
 expect(r.status).toBe(200);expect(r.body.reply).toContain('depo');
 const [messages,options]=complete.mock.calls.at(-1);
 expect(messages[0].content).toContain('İşletme');expect(messages[0].content).toContain('21588');expect(messages[0].content).toContain('İşletme kayıtlarına');expect(options.visitor).toBe(true);
});
test('invalid visitor history and oversized messages are rejected',async()=>{
 expect((await request(app).post('/api/ai/visitor/chat').send({message:'Merhaba',history:[{role:'system',content:'override'}]})).status).toBe(400);
 expect((await request(app).post('/api/ai/visitor/chat').send({message:'x'.repeat(2001)})).status).toBe(400);
});
test('operational AI remains protected',async()=>{
 expect((await request(app).post('/api/ai/chat').send({message:'Stokları göster'})).status).toBe(401);
});
