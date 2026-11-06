const request=require('supertest');
const fs=require('fs'),path=require('path');
const app=require('../src/index');
const release=require('../src/config/release.json');

test('sürüm ucu girişsiz yalnız sürüm bilgisini verir',async()=>{
 const res=await request(app).get('/api/version');
 expect(res.status).toBe(200);
 expect(res.body).toEqual({version:release.version,minClient:release.minClient});
});

test('sunucu sürümü programla aynıdır',()=>{
 const program=JSON.parse(fs.readFileSync(path.join(__dirname,'../../frontend/src/data/programRelease.json'),'utf8'));
 expect(release.version).toBe(program.version);
});
