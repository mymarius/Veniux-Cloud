const fs=require('fs'),path=require('path');
jest.mock('../src/config/database',()=>({getEngine:()=>'sqlite',query:jest.fn(async()=>({rows:[]}))}));
jest.mock('../src/services/accessScopeService',()=>({read:jest.fn(async()=>({mode:'restricted',warehouse_ids:[]}))}));
const accessScope=require('../src/middlewares/accessScope');
const gateway=require('../src/services/mobileGateway');
const read=f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8');
const run=url=>new Promise(resolve=>accessScope({originalUrl:url,method:'GET',query:{},body:{},user:{userId:1,tenantId:1}},{},resolve));
describe('security boundaries',()=>{
 test.each(['/api/alerts?x=1','/api/warehouses?x=1','/API/stock/records','/Api/Alerts','/API/SETTINGS/COMPANY','/api/audit-logs?x=1'])('scope is not skipped for %s',async url=>{
  expect((await run(url))?.status).toBe(403);
 });
 test('token compare never throws on multi-byte input of equal string length',()=>{
  const token='a'.repeat(64);
  expect(gateway.safeEqual('a'.repeat(63)+'\u00e9',token)).toBe(false);
  expect(gateway.safeEqual(token,token)).toBe(true);
 });
 test('sources keep the fixed guards',()=>{
  expect(read('routes/alertRoutes.js')).toMatch(/router\.put\('\/:id', requireRole\('admin', 'manager'\)/);
  const settings=read('routes/settingsRoutes.js');
  for(const route of ["router.put('/users/:id', requireRole('admin'), companyAdmin","router.delete('/users/:id', requireRole('admin'), companyAdmin","'/users/:id/mfa-reset',requireRole('admin'),(...a)=>companyAdmin(...a)"])expect(settings).toContain(route);
  expect(read('controllers/productController.js')).not.toMatch(/ON p\.supplier_id = s\.id\s*\r?\n/);
  expect(read('controllers/stockCountController.js')).toContain("SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2");
 });
});
