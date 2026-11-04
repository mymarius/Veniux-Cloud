const Database = require('better-sqlite3');
const path = require('path');
const { initMySQL, executeMySQLQuery, getMySQLPool } = require('./mysqlAdapter');
const Migrator = require('../database/migrator');
const isTest = process.env.NODE_ENV === 'test';
require('./runtimeConfig').validate();
// A dedicated integration run can isolate its data without changing production configuration.
const databasePath = require('./runtimeConfig').paths().database;
const requested = isTest && process.env.VENIUX_MYSQL_TEST !== '1' ? 'sqlite' : (process.env.DB_ENGINE || 'sqlite');
if(!['sqlite','mysql','auto'].includes(requested))throw Error('DB_ENGINE sqlite veya mysql olmalı.');
// Legacy auto remains deterministic SQLite; it never probes another database.
let engine = requested==='mysql'?'mysql':'sqlite';
const db = engine==='sqlite'?new Database(databasePath, { timeout: 5000 }):null;
if(db){db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');}
const ready = (async () => {
  if(engine==='mysql'){await initMySQL();return;}
  const migrator=new Migrator(db);
  if(process.env.NODE_ENV==='production'){
    require('../services/deploymentService').check(require('./runtimeConfig').paths().data);
    const state=migrator.status();
    if(state.status!=='current')throw Object.assign(Error('Migration hazırlığı gerekli. Güncelleme komutunu çalıştırın; uygulama açılmadı.'),{code:'MIGRATION_REQUIRED'});
  }else{
    if(!isTest&&migrator.status().status!=='current'&&db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get())await require('../services/deploymentSnapshot').create(db,require('./runtimeConfig').paths(),{reason:'development-migration'});
    await migrator.migrate();
  }
  require('../services/scopeQueryContext').initialize(db);
})();
// Every caller awaits startup; the selected engine never changes mid-request.
ready.catch(() => {});
let queue = Promise.resolve();
let maintenance = false, maintenanceFault = false, maintenanceEpoch = 0;
const assertAvailable = (epoch = maintenanceEpoch) => {
  if (maintenance || maintenanceFault || epoch !== maintenanceEpoch) throw Object.assign(new Error('Geri yükleme/bakım sürüyor. İşlemi daha sonra tekrar deneyin.'), {status:503});
};
const acquire = async () => {
  const previous = queue;
  let unlock;
  queue = new Promise(resolve => { unlock = resolve; });
  await previous;
  return unlock;
};
const sqliteQuery = (sql, params = []) => {
  sql = require('../services/scopeQueryContext').apply(sql);
  const ordered = [];
  const text = sql.replace(/\$(\d+)/g, (_, n) => { ordered.push(params[Number(n) - 1]); return '?'; });
  const statement = db.prepare(text);
  if (statement.reader) {
    const rows = statement.all(ordered);
    return { rows, rowCount: rows.length };
  }
  const result = statement.run(ordered);
  return { rows: [], rowCount: result.changes, lastInsertRowid: result.lastInsertRowid };
};
const query = async (sql, params) => {
  await ready;
  if (engine === 'mysql') {
    assertAvailable();
    if(/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql))return transaction(tx=>tx.query(sql,params));
    return executeMySQLQuery(sql, params);
  }
  if(/^\s*INSERT\s+INTO\s+(users|warehouses|retail_registers|warehouse_devices)\s*\(/i.test(sql))return transaction(tx=>tx.query(sql,params));
  const epoch = maintenanceEpoch; assertAvailable(epoch);
  const unlock = await acquire();
  try { assertAvailable(epoch); return sqliteQuery(sql, params); } finally { unlock(); }
};
const connect = async () => {
  await ready;
  if (engine === 'mysql') {
    assertAvailable();
    const epoch=maintenanceEpoch;
    const connection = await getMySQLPool().getConnection();
    let active=false,released=false;
    return { async query(sql,params){
      const command=sql.trim().replace(/;$/,'').toUpperCase();
      if(command==='ROLLBACK'){await connection.rollback();active=false;return {rows:[],rowCount:0};}
      assertAvailable(epoch);
      if(['BEGIN','BEGIN IMMEDIATE','START TRANSACTION'].includes(command)){
        await connection.beginTransaction();active=true;
        // Match SQLite's serialized writes. Separate connections serialize on
        // one durable row; every writer acquires this before any stock read.
        const [mutexRows]=await connection.query('SELECT id, is_active, fence_version FROM veniux_write_mutex WHERE id=1 FOR UPDATE');
        if(mutexRows[0] && mutexRows[0].is_active === 0){
          await connection.rollback();active=false;
          throw Object.assign(new Error('Bu veritabanı hedefi devre dışı bırakılmıştır (cutover tamamlandı). Yazma işlemi engellendi.'), {status:503,code:'TARGET_FENCED'});
        }
        return {rows:[],rowCount:0};
      }
      if(command==='COMMIT'){await connection.commit();active=false;return {rows:[],rowCount:0};}
      if(!active&&/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql))return query(sql,params);
      if(active)await require('../services/productPackages').guardInsert(sql,params,this);
      return executeMySQLQuery(sql,params,connection);
    },release(){if(released)return;released=true;if(active)connection.rollback().then(()=>connection.release(),()=>connection.destroy());else connection.release();} };
  }
  let unlock = null;
  return {
    async query(sql, params) {
      const command = sql.trim().toUpperCase();
      if (command === 'BEGIN' || command === 'BEGIN IMMEDIATE') {
        if (unlock) throw new Error('Transaction already started');
        const epoch = maintenanceEpoch; assertAvailable(epoch);
        unlock = await acquire();
        try { assertAvailable(epoch); return sqliteQuery('BEGIN IMMEDIATE'); } catch (error) { unlock(); unlock = null; throw error; }
      }
      if (command === 'COMMIT' || command === 'ROLLBACK') {
        if (!unlock) return { rows: [], rowCount: 0 };
        try { return sqliteQuery(command); } finally { unlock(); unlock = null; }
      }
      if(unlock)await require('../services/productPackages').guardInsert(sql,params,this);
      return unlock ? sqliteQuery(sql, params) : query(sql, params);
    },
    release() {
      if (unlock) {
        try { if (db.inTransaction) db.exec('ROLLBACK'); } finally { unlock(); unlock = null; }
      }
    }
  };
};
const transaction = async (work) => {
  const client = await connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
const exclusiveMaintenance = async work => {
  await ready;
  if (maintenance) throw Object.assign(new Error('Başka bir bakım işlemi sürüyor.'), {status:409});
  maintenance = true; maintenanceEpoch++;
  if(engine==='mysql'){
    let connection;
    try{
      connection=await getMySQLPool().getConnection();
      await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await connection.beginTransaction();
      const [mRows]=await connection.query('SELECT id, is_active, fence_version FROM veniux_write_mutex WHERE id=1 FOR UPDATE');
      if(mRows[0] && mRows[0].is_active === 0) throw Object.assign(new Error('Bu veritabanı hedefi devre dışı bırakılmıştır (cutover tamamlandı).'),{status:503,code:'TARGET_FENCED'});
      const result=await work(connection);
      await connection.commit();
      return result;
    }
    catch(e){await connection?.rollback().catch(()=>{});throw e;}
    finally{connection?.release();maintenance=false;}
  }
  const unlock = await acquire();
  try { return await work(db); } finally { unlock(); maintenance = false; }
};
const fenceTarget = async (conn) => {
  if (engine !== 'mysql') return;
  const c = conn || await getMySQLPool().getConnection();
  try {
    await c.query('UPDATE veniux_write_mutex SET is_active=0, fence_version=fence_version+1 WHERE id=1');
  } finally {
    if (!conn) c.release();
  }
};
const unfenceTarget = async (conn) => {
  if (engine !== 'mysql') return;
  const c = conn || await getMySQLPool().getConnection();
  try {
    await c.query('UPDATE veniux_write_mutex SET is_active=1 WHERE id=1');
  } finally {
    if (!conn) c.release();
  }
};
const isTargetActive = async () => {
  await ready;
  if (engine !== 'mysql') return true;
  try {
    const [rows] = await getMySQLPool().query('SELECT is_active FROM veniux_write_mutex WHERE id=1');
    return rows.length > 0 && Boolean(rows[0].is_active);
  } catch {
    return false;
  }
};
const getTargetFenceInfo = async () => {
  await ready;
  if (engine !== 'mysql') return { is_active: 1, fence_version: 1 };
  try {
    const [rows] = await getMySQLPool().query('SELECT is_active, fence_version FROM veniux_write_mutex WHERE id=1');
    return rows[0] || { is_active: 1, fence_version: 1 };
  } catch {
    return { is_active: 1, fence_version: 1 };
  }
};
module.exports = { ready, query, connect, transaction, exclusiveMaintenance, fenceTarget, unfenceTarget, isTargetActive, getTargetFenceInfo, async close(){await ready;if(engine==='mysql')await getMySQLPool().end();else db.close();}, markMaintenanceFault:()=>{maintenanceFault=true;}, isMaintenance:()=>maintenance||maintenanceFault, getDb: () => db, getEngine: () => engine,async migrationStatus(){await ready;return engine==='sqlite'?new Migrator(db).status():new (require('../database/mysqlMigrator').MySQLMigrator)(getMySQLPool()).status();} };

