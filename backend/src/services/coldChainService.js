const pool = require('../config/database');

class ColdChainService {
  async runColdChainCheck() {
    return pool.transaction(async client => {
      const devices=(await client.query(`SELECT d.id,d.tenant_id,d.device_name,d.warehouse_id,d.min_temp,d.max_temp,
        l.temperature,l.recorded_at FROM cold_chain_devices d
        LEFT JOIN cold_chain_logs l ON l.id=(SELECT x.id FROM cold_chain_logs x WHERE x.device_id=d.id AND x.tenant_id=d.tenant_id ORDER BY x.recorded_at DESC,x.id DESC LIMIT 1)
        WHERE d.is_active=1`)).rows;
      let created=0;
      for(const d of devices){
        const timestamp=d.recorded_at ? Date.parse(String(d.recorded_at).replace(' ','T').replace(/(?<!Z)$/,'Z')) : NaN;
        const stale=!Number.isFinite(timestamp)||Date.now()-timestamp>30*60*1000;
        const unsafe=d.temperature!==null&&(d.temperature<d.min_temp||d.temperature>d.max_temp);
        if(!stale&&!unsafe)continue;
        const type=stale?'cold_chain_stale':'cold_chain_monitor';
        const message=stale?`Cihaz #${d.id} (${d.device_name}): son 30 dakikada sıcaklık verisi alınamadı.`:`Cihaz #${d.id} (${d.device_name}): son sıcaklık ${d.temperature}°C, tanımlı sınırların dışında.`;
        const existing=await client.query("SELECT id FROM alerts WHERE tenant_id=$1 AND alert_type=$2 AND message=$3 AND status='unread'",[d.tenant_id,type,message]);
        if(existing.rows.length)continue;
        await client.query("INSERT INTO alerts (tenant_id,warehouse_id,alert_type,severity,message,status) VALUES ($1,$2,$3,$4,$5,'unread')",[d.tenant_id,d.warehouse_id,type,stale?'warning':'critical',message]);
        created++;
      }
      return {checked:devices.length,created};
    });
  }
  async getDevices(tenantId) {
    const query = `
      SELECT c.*, c.device_name as name, w.name as warehouse_name 
      FROM cold_chain_devices c
      LEFT JOIN warehouses w ON c.warehouse_id = w.id
      WHERE c.tenant_id = $1
    `;
    const result = await pool.query(query, [tenantId]);
    return result.rows;
  }

  async addDevice(data, tenantId) {
    const { device_name, device_type, location, min_temp, max_temp, warehouse_id } = data;
    const query = `
      INSERT INTO cold_chain_devices (tenant_id, device_name, device_type, location, min_temp, max_temp, warehouse_id, is_active)
      VALUES ($8, $1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(query, [device_name, device_type, location, min_temp, max_temp, warehouse_id, 1, tenantId]);
    return result.rows[0];
  }

  async logTemperature(deviceId, temperature, humidity, tenantId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const deviceRes = await client.query('SELECT * FROM cold_chain_devices WHERE id = $1 AND tenant_id = $2', [deviceId, tenantId]);
      if (deviceRes.rows.length === 0) {
        throw new Error('Cihaz bulunamadı');
      }
      const device = deviceRes.rows[0];

      let is_alarm = 0;
      let alarm_type = null;

      if (temperature < device.min_temp) {
        is_alarm = 1;
        alarm_type = 'low_temp';
      } else if (temperature > device.max_temp) {
        is_alarm = 1;
        alarm_type = 'high_temp';
      }

      const logQuery = `
        INSERT INTO cold_chain_logs (tenant_id, device_id, temperature, humidity, is_alarm, alarm_type, recorded_at)
        VALUES ($6, $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      const logRes = await client.query(logQuery, [deviceId, temperature, humidity, is_alarm, alarm_type, tenantId]);
      
      if (is_alarm) {
        const alertMsg = `🚨 Soğuk Zincir Alarmı: ${device.device_name} sıcaklığı kritik seviyede: ${temperature}°C (Limit: ${device.min_temp}°C - ${device.max_temp}°C)`;
        const alertQuery = `
          INSERT INTO alerts (tenant_id, product_id, warehouse_id, alert_type, severity, message, status)
          VALUES ($4, NULL, $1, $2, 'critical', $3, 'unread')
        `;
        await client.query(alertQuery, [device.warehouse_id || null, `cold_chain_${alarm_type}`, alertMsg, tenantId]);
      }

      await client.query('COMMIT');
      return logRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTemperatureHistory(deviceId, period, tenantId) {
    const query = `
      SELECT id, device_id, temperature, humidity, is_alarm, alarm_type, recorded_at, recorded_at as timestamp
      FROM cold_chain_logs 
      WHERE device_id = $1 AND tenant_id = $2
      ORDER BY recorded_at DESC
      LIMIT 100
    `;
    const result = await pool.query(query, [deviceId, tenantId]);
    return result.rows.reverse();
  }

  async getAlarms(deviceId, tenantId) {
    let query = `
      SELECT l.*, l.alarm_type as type, l.recorded_at as timestamp, d.device_name, d.location 
      FROM cold_chain_logs l
      LEFT JOIN cold_chain_devices d ON l.device_id = d.id
      WHERE l.is_alarm = 1 AND l.tenant_id = $1
    `;
    const params = [tenantId];
    if (deviceId) {
      query += ' AND l.device_id = $2';
      params.push(deviceId);
    }
    query += ' ORDER BY l.recorded_at DESC LIMIT 50';
    const result = await pool.query(query, params);
    return result.rows;
  }

  async getCurrentReadings(tenantId) {
    const query = `
      SELECT l.*, l.recorded_at as timestamp, d.device_name, d.device_name as name, d.device_type, d.location, d.min_temp, d.max_temp 
      FROM cold_chain_logs l
      INNER JOIN (
        SELECT device_id, MAX(recorded_at) as max_recorded_at
        FROM cold_chain_logs
        WHERE tenant_id = $1
        GROUP BY device_id
      ) latest ON l.device_id = latest.device_id AND l.recorded_at = latest.max_recorded_at
      INNER JOIN cold_chain_devices d ON l.device_id = d.id
      WHERE d.is_active = 1 AND d.tenant_id = $1
    `;
    const result = await pool.query(query, [tenantId]);
    return result.rows;
  }
}

module.exports = new ColdChainService();
