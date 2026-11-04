const mysql = require('mysql2/promise');


/**
 * Enterprise MySQL Adapter for Veniux
 * Connects to an explicitly migrated MySQL schema and translates supported queries.
 */

let mysqlPool = null;
let isConnected = false;

const getMySQLConfig = () => {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'veniux_stock',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    charset: 'utf8mb4',

    // DECIMAL değerlerini sürücüde Number'a çevirip hassasiyet kaybetmeyin.
    decimalNumbers: false,
    supportBigNumbers: true,
    bigNumberStrings: false,
    timezone: 'Z',

    // DATE/DATETIME varsayılan olarak JS Date'e çevrilir ve JSON'a UTC olarak
    // yazılırken yerel saat farkı kadar kayar: '2026-12-02' → '2026-12-01T21:00Z'.
    // SKT takibinde bir gün kayması demek. Metin olarak döndürmek hem kaymayı
    // önler hem de SQLite motorunun davranışıyla birebir aynı olur.
    dateStrings: true
  };
};

const initMySQL = async () => {
  // Integration tests use SQLite exclusively and must never touch a local MySQL database.
  if (process.env.NODE_ENV === 'test' && process.env.VENIUX_MYSQL_TEST !== '1') return false;
  const config = getMySQLConfig();
  
  try {
    // Database provisioning belongs to the DBA, never application startup.
    if(!config.user||!config.database)throw Error('DB_USER ve DB_NAME gerekli.');

    // 2. Create Connection Pool
    mysqlPool = mysql.createPool(config);
    mysqlPool.on('connection',connection=>connection.query("SET SESSION sql_mode=CONCAT(@@sql_mode,',PIPES_AS_CONCAT'),time_zone='+00:00'"));

    // Test connection
    const testConn = await mysqlPool.getConnection();
    testConn.release();
    console.log('MySQL bağlantısı kuruldu.');

    // Refuse operations until explicit migrations and live structure match.
    const state=await new (require('../database/mysqlMigrator').MySQLMigrator)(mysqlPool).status();
    if(state.status!=='current')throw Error('MySQL migration gerekli.');
    require('../services/scopeQueryContext').initializeMySQL(config.database,require('../database/mysqlMigrator').manifest);
    isConnected = true;

    return true;
  } catch (err) {
    await mysqlPool?.end().catch(()=>{});mysqlPool=null;
    isConnected = false;
    throw Object.assign(Error('MySQL bağlantısı veya şema hazırlığı başarısız. Veritabanı ayarlarını ve migration durumunu kontrol edin.'),{code:'DATABASE_UNAVAILABLE',status:503});
  }
};

/**
 * Translate SQL from Postgres/SQLite dialect to MySQL
 */
const translateToMySQL = (sql, params = []) => {
  let query = sql;
  query=query.replace(/^\s*BEGIN IMMEDIATE\s*;?$/i,'START TRANSACTION');
  query=query.replace(/hex\(randomblob\((\d+)\)\)/gi,'HEX(RANDOM_BYTES($1))');
  query=query.replace(/\b(datetime|date)\(\s*'now'\s*(?:,\s*'([+-]?\d+)\s+(day|month|year|hour|minute)s?')?\s*\)/gi,(_m,kind,amount,unit)=>amount?`DATE_ADD(${kind.toLowerCase()==='date'?'CURRENT_DATE()':'CURRENT_TIMESTAMP'}, INTERVAL ${Number(amount)} ${unit.toUpperCase()})`:kind.toLowerCase()==='date'?'CURRENT_DATE()':'CURRENT_TIMESTAMP');
  query=query.replace(/\bAS INTEGER\b/gi,'AS SIGNED').replace(/\bCOLLATE NOCASE\b/gi,'COLLATE utf8mb4_unicode_ci');
  // SQLite's scalar MIN/MAX differ from aggregate MIN/MAX in MySQL.
  query=query.replace(/\b(MAX|MIN)\(([^()]*,[^()]*)\)/gi,(_,fn,args)=>(fn.toUpperCase()==='MAX'?'GREATEST':'LEAST')+'('+args+')');

  // 1. $1, $2 … yer tutucularını '?' ile değiştir.
  //
  // Parametreler her GEÇİŞ için yeniden sıralanmalıdır: MySQL'in '?' yer
  // tutucuları konumsaldır, Postgres'in $N'i ise numaralıdır. Aynı numara
  // birden çok kez geçtiğinde ('… UPPER(hu_code) = UPPER($1) OR sscc_code = $1')
  // iki '?' oluşur ama dizide tek değer kalırsa sorgu bağlanamaz ve
  // ER_PARSE_ERROR alınır. Değeri her geçişte tekrar ederek diziyi genişletiyoruz.
  const ordered = [];
  let sawPlaceholder = false;
  query = query.replace(/\$(\d+)/g, (_m, num) => {
    sawPlaceholder = true;
    ordered.push(params[parseInt(num, 10) - 1]);
    return '?';
  });
  if (sawPlaceholder) params = ordered;

  // 2. Replace SQLite / Postgres functions
  query = query.replace(/date\('now'\)/gi, 'CURRENT_DATE()');
  query = query.replace(/date\('now',\s*'\+30 days'\)/gi, 'DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)');
  query = query.replace(/date\('now',\s*'\+90 days'\)/gi, 'DATE_ADD(CURRENT_DATE(), INTERVAL 90 DAY)');
  query = query.replace(/date\('now',\s*'\+180 days'\)/gi, 'DATE_ADD(CURRENT_DATE(), INTERVAL 180 DAY)');
  query = query.replace(/date\(sm\.created_at\)/gi, 'DATE(sm.created_at)');

  // julianday(a) - julianday(b) → iki tarih arasındaki gün farkı.
  // SQLite'ta Jülyen gün sayısı çıkarılır; MySQL karşılığı DATEDIFF.
  // (SKT erken uyarı sorgusu bunu kullanıyor.)
  query = query.replace(
    /julianday\(\s*([^()]+?)\s*\)\s*-\s*julianday\(\s*'now'\s*\)/gi,
    'DATEDIFF($1, CURDATE())'
  );
  query = query.replace(
    /julianday\(\s*'now'\s*\)\s*-\s*julianday\(\s*([^()]+?)\s*\)/gi,
    'DATEDIFF(CURDATE(), $1)'
  );
  query = query.replace(
    /julianday\(\s*([^()]+?)\s*\)\s*-\s*julianday\(\s*([^()]+?)\s*\)/gi,
    'DATEDIFF($1, $2)'
  );
  // strftime('<biçim>', <ifade>) → DATE_FORMAT(<ifade>, '<biçim>')
  // Yalnızca '%Y-%m-%d' değil her biçim için; nöbet çizelgesi '%Y-%m' kullanıyor.
  // Ortak belirteçler (%Y %m %d %H) aynıdır; SQLite'ta dakika %M, saniye %S iken
  // MySQL'de bunlar %i ve %s'tir (MySQL'de %M ay adı demektir).
  query = query.replace(
    /strftime\(\s*'([^']+)'\s*,\s*([^,()]+?)\s*\)/gi,
    (_match, fmt, expr) => {
      const mysqlFmt = fmt.replace(/%M/g, '%i').replace(/%S/g, '%s');
      const target = /^'now'$/i.test(expr.trim()) ? 'NOW()' : expr.trim();
      return `DATE_FORMAT(${target}, '${mysqlFmt}')`;
    }
  );
  query = query.replace(/INSERT OR IGNORE/gi, 'INSERT IGNORE');
  query = query.replace(/INSERT OR REPLACE/gi, 'REPLACE');

  // Postgres upsert sözdizimini MySQL karşılığına çevir.
  //
  //   ON CONFLICT(...) DO NOTHING          → INSERT IGNORE
  //   ON CONFLICT(...) DO UPDATE SET x = y → ON DUPLICATE KEY UPDATE x = y
  //
  // DO UPDATE gövdesinde `EXCLUDED.sutun` eklenmek istenen satırı gösterir;
  // MySQL'de bunun karşılığı VALUES(sutun). Ayrıca `tablo.sutun` biçimindeki
  // nitelemeler MySQL'in ON DUPLICATE KEY UPDATE gövdesinde geçerli değildir,
  // sade sütun adına indirgenir.
  if (/ON\s+CONFLICT/i.test(query)) {
    query = query.replace(/ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+NOTHING/gi, '');
    if (/^\s*INSERT\s+INTO/i.test(query) && !/INSERT\s+IGNORE/i.test(query) && !/DO\s+UPDATE/i.test(query)) {
      query = query.replace(/^(\s*)INSERT\s+INTO/i, '$1INSERT IGNORE INTO');
    }
    query = query.replace(
      /ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+UPDATE\s+SET/gi,
      'ON DUPLICATE KEY UPDATE'
    );
    query = query.replace(/EXCLUDED\.([a-zA-Z0-9_]+)/gi, 'VALUES($1)');
  }

  return { query, params };
};

/**
 * Execute query on MySQL with rows wrapper
 */
const executeMySQLQuery = async (sql, params = [], connection = mysqlPool) => {
  if (!connection) throw new Error('MySQL Pool is not initialized');
  await require('../services/scopeQueryContext').validateMySQLWrite(sql,params,connection,translateToMySQL);
  sql=require('../services/scopeQueryContext').apply(sql,'mysql');
  const { query, params: cleanParams } = translateToMySQL(sql, params);

  // MySQL'de RETURNING yoktur; yalnızca `RETURNING *` değil `RETURNING id`
  // gibi sütun listeleri de temizlenmelidir — aksi hâlde sözdizimi hatası olur.
  // Eklenen satır sonradan insertId ile okunup rows olarak döndürülür.
  const hasReturning = /\sRETURNING\s+[*\w][\w\s,."`]*$/i.test(query.trim());
  const cleanSql = query.replace(/\s+RETURNING\s+[*\w][\w\s,."`]*$/i, '');
  let beforeRows=null,returnTable=null;
  if(hasReturning&&/^\s*(UPDATE|DELETE)\b/i.test(sql)){
    const match=sql.match(/^\s*(UPDATE|DELETE\s+FROM)\s+([\w`"]+)/i);
    if(!match)throw Error('MySQL RETURNING yazması desteklenmiyor.');
    returnTable=match[2].replace(/[`"]+/g,'');
    const lexical=require('../services/scopeQueryContext').tokens(sql),where=lexical.find(t=>t.depth===0&&t.word==='where'),tail=lexical.find(t=>t.depth===0&&t.word==='returning');
    const selection='SELECT * FROM '+returnTable+' '+(where?sql.slice(where.start,tail.start):'')+' FOR UPDATE';
    const translated=translateToMySQL(selection,params);[beforeRows]=await connection.query(translated.query,translated.params);
  }
  const [results] = await connection.query(cleanSql, cleanParams);
  if(beforeRows){
    if(/^\s*DELETE/i.test(sql))return {rows:beforeRows,rowCount:results.affectedRows};
    const primary=require('../database/mysqlMigrator').manifest.tables.find(t=>t.name===returnTable)?.primary;
    if(!primary?.length)throw Error('RETURNING için birincil anahtar gerekli.');
    const rows=[];for(const row of beforeRows){const [updated]=await connection.query('SELECT * FROM `'+returnTable+'` WHERE '+primary.map(k=>'`'+k+'`=?').join(' AND '),primary.map(k=>row[k]));rows.push(...updated);}
    return {rows,rowCount:results.affectedRows};
  }

  if (hasReturning && results && results.insertId) {
    // Fetch inserted record
    const match = /INSERT\s+INTO\s+([^\s(]+)/i.exec(cleanSql);
    if (match) {
      const tableName = match[1].replace(/[`'"]/g, '');
      const schema=require('../database/mysqlMigrator').manifest.tables.find(t=>t.name===tableName);
      const primary=schema?.primary.length===1?schema.primary[0]:'id';
      const [rows] = await connection.query(`SELECT * FROM ${tableName} WHERE \`${primary}\` = ?`, [results.insertId]);
      return { rows, rowCount: rows.length,insertId:results.insertId,lastInsertRowid:results.insertId };
    }
  }

  if (Array.isArray(results)) {
    return { rows: results, rowCount: results.length };
  } else {
    return { rows: [], rowCount: results?.affectedRows || 0, insertId: results?.insertId,lastInsertRowid:results?.insertId };
  }
};

module.exports = {
  translateToMySQL,
  getMySQLConfig,
  initMySQL,
  executeMySQLQuery,
  getMySQLPool: () => mysqlPool,
  isMySQLConnected: () => isConnected
};
