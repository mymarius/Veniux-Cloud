process.env.NODE_ENV = 'test';
const app = require('../src/index');
const db = require('../src/config/database');
const {createTenant} = require('../tests/factories');
(async()=>{
 await db.ready;
 const tenant=await createTenant();
 console.log('Audit UI login:',tenant.email,'password123');
 app.listen(3199,'127.0.0.1',()=>console.log('Audit UI API: http://127.0.0.1:3199'));
})();
