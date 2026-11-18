const express=require('express'),request=require('supertest');
const {createFirewall,safeJson}=require('../src/middlewares/requestFirewall');
function app(options){const app=express();app.use(createFirewall(options));app.use(express.json());app.use(safeJson);app.all('/{*path}',(req,res)=>res.json({ok:true}));return app;}
test('secret probes, malformed paths and encoded traversal are blocked without inspecting business text',async()=>{
 const server=app();for(const path of ['/.env','/.git/config','/%252e%252e/private','/products/%00','/bad%GG'])expect((await request(server).get(path)).status).toBe(403);
 expect((await request(server).post('/api/products').send({name:"O'Reilly SELECT stock",notes:'<script> is a written example'})).status).toBe(200);
 expect((await request(server).get('/.well-known/security.txt')).status).toBe(200);
});
test('quota applies per client and expires',async()=>{
 let time=1000;const server=app({limit:2,burst:2,clock:()=>time});
 expect((await request(server).get('/health')).status).toBe(200);
 expect((await request(server).get('/health')).status).toBe(200);
 const r=await request(server).get('/health');expect(r.status).toBe(429);expect(r.headers['retry-after']).toBe('60');time=61000;expect((await request(server).get('/health')).status).toBe(200);
});
test('JSON pollution keys rejected; authorized upload sizes stay compatible',async()=>{
 const server=app();expect((await request(server).post('/api/products').set('Content-Type','application/json').send('{"__proto__":{"admin":true}}')).status).toBe(400);
 expect((await request(server).post('/api/products').send({fields:{constructor:{prototype:{admin:true}}}})).status).toBe(400);
 const res={status:jest.fn().mockReturnThis(),json:jest.fn(),set:jest.fn()};const next=jest.fn();
 const guard=createFirewall();guard({originalUrl:'/api/backups/validate-upload',method:'POST',socket:{remoteAddress:'127.0.0.1'},get:()=>String(100*1048576)},res,next);expect(next).toHaveBeenCalled();
 guard({originalUrl:'/api/products',method:'POST',socket:{remoteAddress:'127.0.0.1'},get:()=>String(11*1048576)},res,next);expect(res.status).toHaveBeenCalledWith(413);
});

test('vekil arkasında her istemcinin kotası ayrıdır; başlığı değiştirerek kota aşılamaz',async()=>{
 const run=(remote,forwarded,clock)=>{const guard=createFirewall({limit:2,burst:100,clock});const out=[];for(const xff of forwarded){const res={status:jest.fn().mockReturnThis(),json:jest.fn(),set:jest.fn()};const next=jest.fn();guard({originalUrl:'/health',method:'GET',socket:{remoteAddress:remote},headers:xff?{'x-forwarded-for':xff}:{},get:()=>undefined},res,next);out.push(next.mock.calls.length?200:res.status.mock.calls[0][0]);}return out;};
 // yerel vekil: iki farklı gerçek istemci birbirinin kotasını yemez
 const guard=createFirewall({limit:2,burst:100,clock:()=>1000});const call=xff=>{const res={status:jest.fn().mockReturnThis(),json:jest.fn(),set:jest.fn()};const next=jest.fn();guard({originalUrl:'/health',method:'GET',socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':xff},get:()=>undefined},res,next);return next.mock.calls.length?200:res.status.mock.calls[0][0];};
 expect([call('203.0.113.1'),call('203.0.113.1'),call('203.0.113.1')]).toEqual([200,200,429]);
 expect([call('203.0.113.2'),call('203.0.113.2')]).toEqual([200,200]);
 // istemci soldaki girdiyi uydursa da en sağdaki (vekilin eklediği) girdi sayılır
 expect([call('9.9.9.1, 203.0.113.3'),call('9.9.9.2, 203.0.113.3'),call('9.9.9.3, 203.0.113.3')]).toEqual([200,200,429]);
 // doğrudan bağlantıda başlığa güvenilmez
 expect(run('198.51.100.9',['1.1.1.1','2.2.2.2','3.3.3.3'],()=>1000)).toEqual([200,200,429]);
});
