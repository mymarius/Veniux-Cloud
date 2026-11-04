const pool=require('../config/database');
const defaults={ security:{sessionTimeout:'24h',strictPassword:false}, notifications:{minStockAlert:true,expiryRadarAlert:true,expiryDays:90} };
const read=async (tenant,name,client=pool)=>{
 const row=(await client.query("SELECT payload FROM workspace_collections WHERE tenant_id=$1 AND scope='settings' AND name=$2",[tenant,name])).rows[0];
 return {...defaults[name],...(row?JSON.parse(row.payload):{})};
};
const save=async(tenant,name,data)=>pool.transaction(async client=>{
 const exists=(await client.query("SELECT revision FROM workspace_collections WHERE tenant_id=$1 AND scope='settings' AND name=$2",[tenant,name])).rows[0];
 if(exists) await client.query("UPDATE workspace_collections SET payload=$1,revision=revision+1 WHERE tenant_id=$2 AND scope='settings' AND name=$3",[JSON.stringify(data),tenant,name]);
 else await client.query("INSERT INTO workspace_collections(tenant_id,scope,name,payload,revision) VALUES ($1,'settings',$2,$3,1)",[tenant,name,JSON.stringify(data)]);
 return data;
});
const strong=password=>typeof password==='string' && password.length>=8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
module.exports={read,save,strong,defaults};
