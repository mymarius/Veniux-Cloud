if(process.env.NODE_ENV!=='test'||process.env.VENIUX_HARDWARE_LAB!=='1')throw Error('Network guard is lab-only');
function allow(value){const host=value instanceof URL?value.hostname:typeof value==='string'?new URL(value).hostname:value.hostname||value.host||'localhost';if(!['localhost','127.0.0.1','::1','[::1]'].includes(host))throw Error('Hardware lab blocks external network');}
for(const module of ['node:http','node:https']){const api=require(module);for(const method of ['request','get']){const original=api[method];api[method]=function(input,...args){allow(input);return original.call(this,input,...args);};}}
const original=global.fetch;global.fetch=async function(input,...args){allow(typeof input==='object'&&!(input instanceof URL)?input.url:input);return original(input,...args);};
