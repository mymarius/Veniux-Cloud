const express=require('express'),request=require('supertest');
const {createFirewall,safeJson}=require('../src/middlewares/requestFirewall');
function app(options){const app=express();app.use(createFirewall(options));app.use(express.json());app.use(safeJson);app.all('/{*path}',(req,res)=>res.json({ok:true}));return app;}
test('secret probes, malformed paths and encoded traversal are blocked without inspecting business text',async()=>{
 const server=app();for(const path of ['/.env','/.git/config','/%252e%252e/private','/products/%00','/bad%GG'])expect((await request(server).get(path)).status).toBe(403);
 expect((await request(server).post('/api/products').send({name:"O'Reilly SELECT stock",notes:'<script> is a written example'})).status).toBe(200);
 expect((await request(server).get('/.well-known/security.txt')).status).toBe(200);
});
test('forwarding headers cannot bypass quota; quota expires',async()=>{
 let time=1000;const server=app({limit:2,burst:2,clock:()=>time});
 expect((await request(server).get('/health')).status).toBe(200);
 expect((await request(server).get('/health').set('X-Forwarded-For','1.1.1.1')).status).toBe(200);
 const r=await request(server).get('/health').set('X-Forwarded-For','2.2.2.2');expect(r.status).toBe(429);expect(r.headers['retry-after']).toBe('60');time=61000;expect((await request(server).get('/health')).status).toBe(200);
});
test('JSON pollution keys rejected; authorized upload sizes stay compatible',async()=>{
 const server=app();expect((await request(server).post('/api/products').set('Content-Type','application/json').send('{"__proto__":{"admin":true}}')).status).toBe(400);
 expect((await request(server).post('/api/products').send({fields:{constructor:{prototype:{admin:true}}}})).status).toBe(400);
 const res={status:jest.fn().mockReturnThis(),json:jest.fn(),set:jest.fn()};const next=jest.fn();
 const guard=createFirewall();guard({originalUrl:'/api/backups/validate-upload',method:'POST',socket:{remoteAddress:'127.0.0.1'},get:()=>String(100*1048576)},res,next);expect(next).toHaveBeenCalled();
 guard({originalUrl:'/api/products',method:'POST',socket:{remoteAddress:'127.0.0.1'},get:()=>String(11*1048576)},res,next);expect(res.status).toHaveBeenCalledWith(413);
});
