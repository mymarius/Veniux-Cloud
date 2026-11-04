const app = require('./src/index');
const request = require('supertest');
const { createTenant } = require('./tests/factories/index');

(async () => {
    try {
        const tenant = await createTenant();
        const res = await request(app).get('/api/stock/records').set('Authorization', 'Bearer ' + tenant.token);
        console.log(res.body);
    } catch(e) {
        console.log(e);
    }
    process.exit(0);
})();
