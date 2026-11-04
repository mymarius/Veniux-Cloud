import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptTerminalIdentity as accept} from './terminalIdentity.mjs';
import {isTerminalReauth} from './terminalReauth.mjs';
const cashier={id:1,tenant_id:8,role:'cashier'};
test('reauth failure exemption never applies to sale, license or ordinary login requests',()=>{
 assert.equal(isTerminalReauth({url:'/auth/terminal-verify',terminalReauth:true}),true);
 for(const config of [null,{url:'/auth/terminal-verify'},{url:'/auth/login',terminalReauth:true},{url:'/scanner/sale',terminalReauth:true},{url:'/license/status',terminalReauth:true}])assert.equal(isTerminalReauth(config),false);
});
test('terminal unlock cannot substitute another cashier or tenant',()=>{
 assert.equal(accept('unlock',cashier,cashier),true);
 assert.throws(()=>accept('unlock',cashier,{...cashier,id:2}));
 assert.throws(()=>accept('unlock',cashier,{...cashier,tenant_id:9}));
 assert.throws(()=>accept('unlock',cashier,null));
});
test('supervisor checkpoint accepts only same tenant manager and grants no user role',()=>{
 assert.equal(accept('approve',cashier,{id:2,tenant_id:8,role:'manager'}),true);
 assert.throws(()=>accept('approve',cashier,cashier));
 assert.throws(()=>accept('approve',cashier,{id:2,tenant_id:9,role:'admin'}));
 assert.equal(cashier.role,'cashier');
});
test('cashier change permits only sale roles in the same tenant',()=>{
 assert.equal(accept('switch',cashier,{...cashier,id:3}),true);
 assert.throws(()=>accept('switch',cashier,{...cashier,role:'viewer'}));
 assert.throws(()=>accept('unexpected',cashier,cashier));
});
