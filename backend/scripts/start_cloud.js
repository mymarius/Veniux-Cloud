// Node.js 24+ launcher behind an HTTPS reverse proxy. Environment file stays private.
const path=require('path'),crypto=require('crypto');
const file=process.env.VENIUX_CLOUD_ENV;
if(!file||!path.isAbsolute(file))throw Error('VENIUX_CLOUD_ENV must name an absolute private environment file.');
process.loadEnvFile(file);
if(process.env.NODE_ENV!=='production'||process.env.DB_ENGINE!=='mysql'||process.env.HOST!=='127.0.0.1'||process.env.VENIUX_WEB_ACCESS!=='1')throw Error('Explicit production/MySQL/loopback/web settings required.');
const publicURL=new URL(process.env.VENIUX_PUBLIC_URL||'');
if(publicURL.protocol!=='https:'||publicURL.username||publicURL.password||publicURL.pathname!=='/'||publicURL.search)throw Error('HTTPS public origin required.');
process.env.CORS_ORIGIN=publicURL.origin+',null';
if(!process.env.VENIUX_LICENSE_AUTHORITY_URL||new URL(process.env.VENIUX_LICENSE_AUTHORITY_URL).protocol!=='https:')throw Error('Central HTTPS license authority required.');
if(!process.env.VENIUX_LICENSE_AUTHORITY_PUBLIC_KEY||!require('fs').existsSync(process.env.VENIUX_LICENSE_AUTHORITY_PUBLIC_KEY)||!require('../src/services/centralLicense').enabled())throw Error('Pinned central authority public key required.');
require('../src/services/runtimeControl').configure(crypto.randomBytes(32).toString('base64url'));
require('../src/index');


