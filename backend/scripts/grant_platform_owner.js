// Run locally after the requested owner has registered. Never creates or changes passwords.
// Kullanım: node scripts/grant_platform_owner.js [e-posta]
const db=require('../src/config/database');
async function main(){
 const email=String(process.argv[2]||'mymarius1@gmail.com').trim().toLowerCase();
 const user=(await db.query('SELECT id,tenant_id,status FROM users WHERE LOWER(email)=$1',[email])).rows[0];
 if(!user){console.log('OWNER_NOT_REGISTERED');return;}
 if(user.status!=='active')throw new Error('Owner account is not active.');
 await db.transaction(async client=>{
  if((await client.query('SELECT user_id FROM platform_admins WHERE user_id=$1',[user.id])).rows.length)return;
  await client.query('INSERT INTO platform_admins (user_id) VALUES ($1)',[user.id]);
  await client.query("UPDATE users SET role='admin',session_version=session_version+1 WHERE id=$1",[user.id]);
  await client.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)',[user.tenant_id,email,'platform_admin_granted','user',user.id,'Locally provisioned at owner request']);
 });
 console.log('PLATFORM_OWNER_GRANTED');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
