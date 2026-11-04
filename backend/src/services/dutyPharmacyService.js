const pool = require('../config/database');

const dutyPharmacyService = {
  getStaffList: async (tenantId) => {
    const query = `SELECT * FROM pharmacy_staff WHERE tenant_id = $1 ORDER BY full_name ASC`;
    const { rows } = await pool.query(query, [tenantId]);
    return rows;
  },

  addStaff: async (data, tenantId) => {
    const { full_name, title, tc_no, phone, diploma_no, is_active = 1 } = data;
    const query = `
      INSERT INTO pharmacy_staff (tenant_id, full_name, title, tc_no, phone, diploma_no, is_active)
      VALUES ($7, $1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [full_name, title || 'eczaci', tc_no || null, phone || null, diploma_no || null, is_active ? 1 : 0, tenantId]);
    return rows[0];
  },

  updateStaff: async (id, data, tenantId) => {
    const { full_name, title, tc_no, phone, diploma_no, is_active } = data;
    const query = `
      UPDATE pharmacy_staff
      SET full_name = $1, title = $2, tc_no = $3, phone = $4, diploma_no = $5, is_active = $6
      WHERE id = $7 AND tenant_id = $8
      RETURNING *
    `;
    const { rows } = await pool.query(query, [full_name, title, tc_no, phone, diploma_no, is_active ? 1 : 0, id, tenantId]);
    return rows[0];
  },

  getDutySchedule: async (month, year, tenantId) => {
    const formattedMonth = String(month).padStart(2, '0');
    const monthYear = `${year}-${formattedMonth}`;
    const query = `
      SELECT ds.*, ps.full_name, ps.title 
      FROM duty_schedule ds
      LEFT JOIN pharmacy_staff ps ON ds.staff_id = ps.id
      WHERE strftime('%Y-%m', ds.duty_date) = $1 AND ds.tenant_id = $2
      ORDER BY ds.duty_date ASC, ds.start_time ASC
    `;
    const { rows } = await pool.query(query, [monthYear, tenantId]);
    return rows;
  },

  createDutyEntry: async (data, tenantId) => {
    const { duty_date, shift_type = 'nobetci', staff_id, start_time = '19:00', end_time = '08:00', night_surcharge_rate = 0.40, notes } = data;
    const query = `
      INSERT INTO duty_schedule (tenant_id, duty_date, shift_type, staff_id, start_time, end_time, night_surcharge_rate, notes)
      VALUES ($8, $1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [duty_date, shift_type, staff_id || null, start_time, end_time, night_surcharge_rate, notes || null, tenantId]);
    return rows[0];
  },

  deleteDutyEntry: async (id, tenantId) => {
    const query = `DELETE FROM duty_schedule WHERE id = $1 AND tenant_id = $2 RETURNING *`;
    const { rows } = await pool.query(query, [id, tenantId]);
    return rows[0];
  },

  getMonthlyDutySummary: async (month, year, tenantId) => {
    const formattedMonth = String(month).padStart(2, '0');
    const monthYear = `${year}-${formattedMonth}`;
    const query = `
      SELECT 
        ps.id as staff_id, 
        ps.full_name,
        COUNT(ds.id) as total_shifts,
        SUM(CASE WHEN ds.shift_type = 'nobetci' OR ds.shift_type = 'gece' THEN 1 ELSE 0 END) as night_shifts_count
      FROM pharmacy_staff ps
      LEFT JOIN duty_schedule ds ON ps.id = ds.staff_id 
        AND strftime('%Y-%m', ds.duty_date) = $1
      WHERE ps.tenant_id = $2
      GROUP BY ps.id, ps.full_name
      ORDER BY total_shifts DESC
    `;
    const { rows } = await pool.query(query, [monthYear, tenantId]);
    return rows;
  }
};

module.exports = dutyPharmacyService;
