const fs=require('fs'),os=require('os'),path=require('path');
const {makeMySQLBackupService}=require('../../src/services/mysqlBackupService');
const db=require('../../src/config/database');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-auto-backup-'));
let owner;
beforeAll(async()=>{await db.ready;owner=await require('../factories').createTenant();await db.query('INSERT INTO platform_admins(user_id) VALUES($1)',[owner.userId]);});
afterAll(async()=>{await db.query('DELETE FROM platform_admins WHERE user_id=$1',[owner.userId]);fs.rmSync(root,{recursive:true,force:true});await db.close?.();});
test('sunucu yedeği ayar yapılmadan otomatik alınır ve aralık dolmadan tekrarlanmaz',async()=>{
 const service=makeMySQLBackupService({root,filesRoot:path.join(root,'images')});
 const now=Date.now();
 await service.tick(now);await service.tick(now+60000);
 expect(service.summary().history.filter(r=>r.kind==='automatic'&&r.status==='healthy')).toHaveLength(1);
 await service.tick(now+25*3600000);
 expect(service.summary().history.filter(r=>r.kind==='automatic').length).toBe(2);
});
test('zamanlayıcı merkezi lisans açıkken de başlatılır',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../src/index.js'),'utf8');
 expect(source).toMatch(/^\s*require\('\.\/services\/backupService'\)\.startScheduler\(\);/m);
});
