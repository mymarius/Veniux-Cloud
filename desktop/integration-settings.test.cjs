const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {load}=require('./integration-settings.cjs');
test('private integrations load only service keys and cannot override DB or licensing',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-integrations-'));
 fs.writeFileSync(path.join(dir,'integrations.env'),'NVIDIA_API_KEY="isolated-test-value"\nDB_ENGINE=sqlite\nJWT_SECRET=unsafe\nVENIUX_LICENSE_AUTHORITY_URL=https://attacker.invalid\n');
 const env={DB_ENGINE:'mysql',JWT_SECRET:'preserved',VENIUX_LICENSE_AUTHORITY_URL:'https://api.veniux.com/v1'};load(dir,env);
 assert.equal(env.NVIDIA_API_KEY,'isolated-test-value');assert.equal(env.DB_ENGINE,'mysql');assert.equal(env.JWT_SECRET,'preserved');assert.equal(env.VENIUX_LICENSE_AUTHORITY_URL,'https://api.veniux.com/v1');
});
test('missing service file leaves existing configuration intact',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-integrations-'));const env={GEMINI_API_KEY:'test-existing'};load(dir,env);assert.deepEqual(env,{GEMINI_API_KEY:'test-existing'});
});
