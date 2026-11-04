const {AsyncLocalStorage}=require('async_hooks');
const storage=new AsyncLocalStorage();
let schema=[];
let mysqlDatabase=null;
function initializeMySQL(database,manifest) {
 if(!/^[A-Za-z0-9_]+$/.test(database))throw Error('Geçersiz MySQL veritabanı adı.');
 mysqlDatabase=database;schema=manifest.tables.map(t=>({name:t.name,columns:new Set(t.columns.map(c=>c.name)),unique:[{columns:t.primary},...t.unique]}));
}
function initialize(raw) {
 schema=raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(({name})=>({name,columns:new Set(raw.prepare('PRAGMA table_info('+name+')').all().map(c=>c.name))}));
}
// Lexical tokens preserve quoted text/comments. CTEs shadow only table reads;
// no query aliases or join semantics are rewritten.
function tokens(sql) {
 const result=[];const re=/'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z_0-9]*|[()]|\S/g;
 let m,depth=0;while((m=re.exec(sql))){const text=m[0];if(text==='(')depth++;if(text===')')depth--;if(text[0]==="'"||text.startsWith('--')||text.startsWith('/*'))continue;result.push({word:text.replace(/^["`\[]|["`\]]$/g,'').toLowerCase(),start:m.index,end:re.lastIndex,depth});}return result;
}
const parents={pos_sales:['retail_sales','id','sale_id'],pos_sale_items:['pos_sales','sale_id','id'],purchase_order_items:['purchase_orders','order_id','id'],wms_inbound_items:['wms_inbound_receipts','receipt_id','id'],wms_pick_tasks:['wms_pick_waves','wave_id','id'],retail_cash_movements:['retail_shifts','shift_id','id'],retail_reversals:['retail_sales','sale_id','sale_id'],stock_count_items:['stock_counts','count_id','id'],supplier_return_items:['supplier_return_documents','return_id','id']};
function predicate(table,alias,scope,visited=new Set()) {
 const entry=schema.find(t=>t.name===table);if(!entry)return null;
 const cols=entry.columns;let conditions=[];
 const warehouseTable=table==='warehouses';
 const warehouseColumns=['warehouse_id','target_warehouse_id','source_warehouse_id','from_warehouse_id','to_warehouse_id'].filter(c=>cols.has(c));
 const physical=warehouseTable||warehouseColumns.length||cols.has('location_id')||parents[table]||['inventory_lots','inventory_serial_numbers','product_bin_records','inventory_reservations','handling_units','supplier_return_documents'].includes(table);
 if(!physical)return null;
 if(cols.has('tenant_id'))conditions.push(`${alias}.tenant_id=${Number(scope.tenantId)}`);
 const ids=scope.warehouse_ids.map(Number).join(',')||'NULL';
 if(scope.mode!=='company') {
  if(warehouseTable)conditions.push(`${alias}.id IN (${ids})`);
  else if(table==='supplier_return_documents')conditions.push(`EXISTS(SELECT 1 FROM main.supplier_return_items access_return WHERE access_return.return_id=${alias}.id AND access_return.tenant_id=${Number(scope.tenantId)}) AND NOT EXISTS(SELECT 1 FROM main.supplier_return_items access_return JOIN main.wms_inbound_items access_item ON access_item.id=access_return.receipt_item_id AND access_item.tenant_id=access_return.tenant_id JOIN main.wms_inbound_receipts access_receipt ON access_receipt.id=access_item.receipt_id AND access_receipt.tenant_id=access_item.tenant_id WHERE access_return.return_id=${alias}.id AND (access_receipt.tenant_id<>${Number(scope.tenantId)} OR access_receipt.warehouse_id NOT IN (${ids})))`);
  else if(warehouseColumns.length)conditions.push(`${alias}.${warehouseColumns[0]} IN (${ids})`);
  else if(parents[table]&&!visited.has(table)){
   const [parent,column,key]=parents[table],seen=new Set([...visited,table]);
   conditions.push(`EXISTS(SELECT 1 FROM main.${parent} access_parent WHERE access_parent.${key}=${alias}.${column} AND ${predicate(parent,'access_parent',scope,seen)||'0'})`);
  }else if(table==='inventory_lots')conditions.push(`(EXISTS(SELECT 1 FROM main.product_bin_records access_bin JOIN main.warehouse_locations access_loc ON access_loc.id=access_bin.location_id AND access_loc.tenant_id=access_bin.tenant_id WHERE access_bin.lot_id=${alias}.id AND access_bin.tenant_id=${Number(scope.tenantId)} AND access_loc.warehouse_id IN (${ids})) OR EXISTS(SELECT 1 FROM main.inventory_transactions access_tx WHERE access_tx.lot_id=${alias}.id AND access_tx.tenant_id=${Number(scope.tenantId)} AND access_tx.warehouse_id IN (${ids})) OR EXISTS(SELECT 1 FROM main.wms_inbound_items access_item JOIN main.wms_inbound_receipts access_receipt ON access_receipt.id=access_item.receipt_id AND access_receipt.tenant_id=access_item.tenant_id WHERE (access_item.lot_id=${alias}.id OR (access_item.product_id=${alias}.product_id AND access_item.lot_number=${alias}.lot_number)) AND access_item.tenant_id=${Number(scope.tenantId)} AND access_receipt.warehouse_id IN (${ids})))`);
  else if(cols.has('location_id'))conditions.push(`EXISTS(SELECT 1 FROM main.warehouse_locations access_loc WHERE access_loc.id=${alias}.location_id AND access_loc.tenant_id=${Number(scope.tenantId)} AND access_loc.warehouse_id IN (${ids}))`);
  else conditions.push('0'); // Unmapped physical relationship is closed, never company-wide.
  for(const column of ['target_warehouse_id','source_warehouse_id','from_warehouse_id','to_warehouse_id'])if(cols.has(column))conditions.push(`(${alias}.${column} IS NULL OR ${alias}.${column} IN (${ids}))`);
 }
 return conditions.join(' AND ')||'1';
}
function apply(sql,dialect='sqlite') {
 const scope=storage.getStore();if(!scope)return sql;
 if(!Number.isSafeInteger(Number(scope.tenantId))||Number(scope.tenantId)<1||!['company','restricted'].includes(scope.mode)||!Array.isArray(scope.warehouse_ids)||scope.warehouse_ids.some(id=>!Number.isSafeInteger(Number(id))||Number(id)<1)||!schema.length)throw Object.assign(Error('Erişim kapsamı doğrulanamadı.'),{status:403});
 if(dialect==='mysql')return applyMySQL(sql,scope);
 const list=tokens(sql),first=list[0]?.word;
 if(first==='with'&&list.some(t=>t.depth===0&&['update','delete','insert'].includes(t.word)))throw Object.assign(Error('Bu yazma sorgusu için kapsam kontrolü tanımlanmamış.'),{status:403});
 if(!['select','with','update','delete','insert'].includes(first))return sql;
 if(list.some((t,i)=>t.word==='main'&&list[i+1]?.word==='.'))throw Object.assign(Error('Doğrudan fiziksel tablo erişimi kapsamlı istekte kapalı.'),{status:403});
 const used=new Set(list.map(t=>t.word));
 const ctes=schema.filter(t=>used.has(t.name)).map(t=>{const p=predicate(t.name,'access_row',scope);return p?`${t.name} AS (SELECT * FROM main.${t.name} access_row WHERE ${p})`:null;}).filter(Boolean);
 // Write targets must themselves satisfy the same scope. Wrap the existing
 // WHERE to preserve OR precedence and keep RETURNING outside the predicate.
 if(first==='update'||first==='delete'){
  const tableToken=list[first==='update'?1:2],table=tableToken?.word;
  let alias=table;if(list[first==='update'?2:3]?.word==='as')alias=list[first==='update'?3:4].word;
  const p=predicate(table,alias,scope);
  if(p){const where=list.find(t=>t.depth===0&&t.word==='where'),tail=list.find(t=>t.depth===0&&['returning','order','limit'].includes(t.word));const end=tail?.start??sql.replace(/;\s*$/,'').length;
   sql=where?sql.slice(0,where.end)+' ('+sql.slice(where.end,end)+') AND ('+p+') '+sql.slice(end):sql.slice(0,end)+' WHERE '+p+' '+sql.slice(end);
  }
 }
 if(!ctes.length)return sql;
 if(first==='with') {const recursive=list[1]?.word==='recursive',end=recursive?list[1].end:list[0].end;return sql.slice(0,end)+' '+ctes.join(',')+','+sql.slice(end);}
 return 'WITH '+ctes.join(',')+' '+sql;
}
function applyMySQL(sql,scope){
 if(!mysqlDatabase)throw Object.assign(Error('MySQL erişim şeması doğrulanamadı.'),{status:403});
 const list=tokens(sql),first=list[0]?.word,physical='`'+mysqlDatabase+'`.';
 if(list.some((t,i)=>['from','join','update','into'].includes(list[i-1]?.word)&&list[i+1]?.word==='.'))throw Object.assign(Error('Nitelikli fiziksel tablo erişimi kapalı.'),{status:403});
 if(list.some((t,i)=>['main',mysqlDatabase.toLowerCase(),'information_schema'].includes(t.word)&&list[i+1]?.word==='.'))throw Object.assign(Error('Doğrudan fiziksel tablo erişimi kapsamlı istekte kapalı.'),{status:403});
 if(!['select','with','insert','update','delete'].includes(first))throw Object.assign(Error('Bu MySQL sorgusu için erişim kapsamı tanımlanmamış.'),{status:403});
 if(first==='with'&&list.some(t=>t.depth===0&&['insert','update','delete'].includes(t.word)))throw Object.assign(Error('Kapsamlı CTE yazması desteklenmiyor.'),{status:403});
 const pred=(table,alias)=>{
  const entry=schema.find(t=>t.name===table);if(!entry)throw Object.assign(Error('Tablo erişim kapsamı tanımlanmamış.'),{status:403});
  return (predicate(table,alias,scope)||(entry.columns.has('tenant_id')?`${alias}.tenant_id=${Number(scope.tenantId)}`:null))?.replaceAll('main.',physical);
 };
 const replacements=[];
 const targetIndex=first==='update'?1:first==='delete'?2:first==='insert'?(list[1]?.word==='into'?2:3):-1;
 for(let i=0;i<list.length;i++){
  const t=list[i];if(!schema.some(s=>s.name===t.word)||i===targetIndex)continue;
  if(!['from','join',','].includes(list[i-1]?.word))continue;
  const p=pred(t.word,'access_row');if(!p)continue;
  const next=list[i+1],hasAlias=next&&(next.word==='as'||/^[a-z_]\w*$/.test(next.word)&&!['where','join','left','right','inner','outer','cross','on','group','order','limit','union','having','for','set'].includes(next.word));
  replacements.push({start:t.start,end:t.end,text:`(SELECT * FROM ${physical}\`${t.word}\` access_row WHERE ${p})${hasAlias?'':' AS `'+t.word+'`'}`});
 }
 if(first==='update'||first==='delete'){
  const target=list[targetIndex],alias=list[targetIndex+1]?.word==='as'?list[targetIndex+2].word:target.word,p=pred(target.word,alias);
  if(p){const where=list.find(t=>t.depth===0&&t.word==='where'),tail=list.find(t=>t.depth===0&&['returning','order','limit'].includes(t.word)),end=tail?.start??sql.replace(/;\s*$/,'').length;
   replacements.push({start:end,end,text:(where?') AND (':' WHERE (')+p+') '});if(where)replacements.push({start:where.end,end:where.end,text:' ('});}
 }
 for(const r of replacements.sort((a,b)=>b.start-a.start))sql=sql.slice(0,r.start)+r.text+sql.slice(r.end);
 return sql;
}
async function validateMySQLWrite(sql,params,connection,translate){
 const scope=storage.getStore();if(!scope)return;
 const list=tokens(sql),first=list[0]?.word;if(!['insert','update'].includes(first))return;
 const table=list[first==='update'?1:list[1]?.word==='into'?2:3]?.word,entry=schema.find(t=>t.name===table);
 if(!entry)throw Object.assign(Error('Yazma erişim kapsamı tanımlanmamış.'),{status:403});
 if(!entry.columns.has('tenant_id'))throw Object.assign(Error('Ortak tabloya kapsamlı operasyondan yazılamaz.'),{status:403});
 const denied=()=>{throw Object.assign(Error('Yazılan kayıt firma veya depo kapsamınız dışında.'),{status:403});};
 const groups=[];
 if(first==='insert'){
  const open=list.find(t=>t.word==='('),close=list.find(t=>t.word===')'&&t.depth===0),values=list.find(t=>t.word==='values'&&t.depth===0);
  // Explicit column/value writes only. INSERT SELECT is rejected until mapped.
  if(!open||!close||!values)denied();
  const columns=sql.slice(open.end,close.start).split(',').map(v=>v.trim().replace(/[`"\[\]]/g,''));
  for(let i=list.indexOf(values)+1;i<list.length;i++){if(list[i].depth===0&&['on','returning'].includes(list[i].word))break;if(list[i].word==='('&&list[i].depth===1){const start=list[i].end;let j=i+1;for(;j<list.length&&!(list[j].word===')'&&list[j].depth===0);j++);if(j===list.length)denied();const cuts=list.slice(i+1,j).filter(t=>t.word===','&&t.depth===1);const expressions=[];let from=start;for(const cut of cuts){expressions.push(sql.slice(from,cut.start));from=cut.end;}expressions.push(sql.slice(from,list[j].start));if(columns.length!==expressions.length)denied();groups.push(columns.map((name,k)=>[name,expressions[k]]));i=j;}}
 }else{
  const set=list.find(t=>t.word==='set'&&t.depth===0),end=list.find(t=>['where','returning','order','limit'].includes(t.word)&&t.depth===0)?.start??sql.length;if(!set)denied();
  const pieces=[],cuts=list.filter(t=>t.start>set.end&&t.start<end&&t.depth===0&&t.word===',');let from=set.end;for(const cut of cuts){pieces.push(sql.slice(from,cut.start));from=cut.end;}pieces.push(sql.slice(from,end));
  const assignments=pieces.map(v=>v.match(/^\s*(?:\w+\.)?[`"]?(\w+)[`"]?\s*=([\s\S]*)$/)).filter(Boolean).map(m=>[m[1],m[2]]);
  groups.push(assignments);
 }
 const references={warehouse_id:'warehouses',target_warehouse_id:'warehouses',source_warehouse_id:'warehouses',from_warehouse_id:'warehouses',to_warehouse_id:'warehouses',location_id:'warehouse_locations',source_location_id:'warehouse_locations',target_location_id:'warehouse_locations',actual_location_id:'warehouse_locations',register_id:'retail_registers',shift_id:'retail_shifts',receipt_id:'wms_inbound_receipts',order_id:'purchase_orders',purchase_order_id:'purchase_orders',count_id:'stock_counts',wave_id:'wms_pick_waves',lot_id:'inventory_lots',handling_unit_id:'handling_units',product_id:'products',supplier_id:'suppliers',user_id:'users',created_by:'users',approved_by:'users',closed_by:'users'};
 for(const group of groups){
  const relevant=group.filter(([name])=>name==='tenant_id'||references[name]);
  if(first==='insert'&&entry.columns.has('tenant_id')&&!relevant.some(([name])=>name==='tenant_id'))denied();
  for(const [name,expr] of relevant){
   // References must be supplied as literals/parameters, never copied from an
   // unverified physical row or altered with an arbitrary expression.
   if(!/^\s*(\$\d+|NULL|\d+|'(?:''|[^'])*')\s*$/i.test(expr))denied();
   const {query,params:ordered}=translate('SELECT '+expr+' AS value',params);const [rows]=await connection.query(query,ordered);const value=rows[0].value;
   if(name==='tenant_id'){if(Number(value)!==Number(scope.tenantId))denied();continue;}
   if(value===null){if(name==='warehouse_id'&&scope.mode==='restricted')denied();continue;}const statement=apply('SELECT id FROM '+references[name]+' WHERE id=$1','mysql'),bound=translate(statement,[value]);const [allowed]=await connection.query(bound.query,bound.params);if(!allowed.length)denied();
  }
  if(first==='insert'&&/\bON\s+(CONFLICT|DUPLICATE)\b/i.test(sql))for(const key of entry.unique||[]){
   if(!key.columns.length||key.columns.includes('tenant_id')||key.columns.some(k=>!group.some(([name])=>name===k)))continue;
   const keyValues=[];for(const column of key.columns){const expr=group.find(([name])=>name===column)[1];if(!/^\s*(\$\d+|NULL|\d+|'(?:''|[^'])*')\s*$/i.test(expr))denied();const select=translate('SELECT '+expr+' AS value',params);const [rows]=await connection.query(select.query,select.params);keyValues.push(rows[0].value);}
   if(keyValues.some(v=>v===null))continue;
   const where=key.columns.map((name,i)=>'`'+name+'`=$'+(i+1)).join(' AND '),physical=translate('SELECT tenant_id FROM `'+table+'` WHERE '+where,keyValues),[found]=await connection.query(physical.query,physical.params);
   if(found.length){const guarded=translate(apply('SELECT tenant_id FROM '+table+' WHERE '+where,'mysql'),keyValues),[allowed]=await connection.query(guarded.query,guarded.params);if(allowed.length!==found.length)denied();}
  }
 }
}
module.exports={initialize,initializeMySQL,apply,validateMySQLWrite,run:(scope,work)=>storage.run(scope,work),current:()=>storage.getStore(),predicate,tokens};
