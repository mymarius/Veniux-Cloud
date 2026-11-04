const request=require('supertest'),app=require('../../src/index'),db=require('../../src/config/database');
const tables=['products','stock_records','stock_movements','inventory_lots','medicine_batches','medicines','wms_inbound_receipts','workspace_collections'];
const snapshot=async()=>JSON.stringify(await Promise.all(tables.map(async t=>[t,(await db.query('SELECT * FROM '+t)).rows])));
module.exports=async function assertRetired(paths){
 const before=await snapshot();
 for(const path of paths){
  expect(path).toMatch(/^\/api\/(pharmacy|eczane-depo|medicines|admin\/medicines)(?:\/|$)/);
  for(const method of ['get','post','put','patch','delete']){
   const r=await request(app)[method](path).send(method==='get'?undefined:{quantity:999,action:'inbound',name:'<script>retired</script>'});
   expect(r.status).toBe(410);expect(r.body).toEqual({code:'MODULE_REMOVED',error:'Bu modül artık sunulmuyor.'});
   expect(r.headers['content-type']).toMatch(/application\/json/);
   expect(r.body).not.toHaveProperty('batch');expect(r.body).not.toHaveProperty('scannedDirectories');
  }
 }
 expect(await snapshot()).toBe(before);
};
