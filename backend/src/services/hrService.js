const pool = require('../config/database');

/**
 * İnsan kaynakları / personel yönetimi servisi.
 *
 * `bootstrap` listeleme ekranlarının ihtiyacı olan tüm koleksiyonları tek
 * seferde verir; `getEmployeeDossier` ise tek personelin özlük dosyasını
 * (belge, eğitim, bordro, olay geçmişi dahil) döndürür.
 */

const hrService = {
  async bootstrap({ from, to } = {}) {
    const [departments, shifts, leaveTypes, employees, schedule, attendance, balances, leaveRequests, goals, reviews] =
      await Promise.all([
        pool.query('SELECT * FROM hr_departments ORDER BY name ASC'),
        pool.query('SELECT * FROM hr_shifts ORDER BY id ASC'),
        pool.query('SELECT * FROM hr_leave_types ORDER BY id ASC'),
        pool.query(`SELECT e.*, d.name AS department_name, d.color AS department_color,
                           m.full_name AS manager_name
                    FROM hr_employees e
                    LEFT JOIN hr_departments d ON d.id = e.department_id
                    LEFT JOIN hr_employees m ON m.id = e.manager_id
                    ORDER BY e.status ASC, e.full_name ASC`),
        from && to
          ? pool.query('SELECT * FROM hr_schedule WHERE work_date BETWEEN $1 AND $2 ORDER BY work_date ASC', [from, to])
          : pool.query('SELECT * FROM hr_schedule ORDER BY work_date ASC'),
        pool.query(`SELECT a.*, e.full_name FROM hr_attendance a
                    JOIN hr_employees e ON e.id = a.employee_id
                    ORDER BY a.work_date DESC, e.full_name ASC`),
        pool.query('SELECT * FROM hr_leave_balances WHERE year = 2026'),
        pool.query(`SELECT r.*, e.full_name FROM hr_leave_requests r
                    JOIN hr_employees e ON e.id = r.employee_id
                    ORDER BY r.status = 'bekliyor' DESC, r.start_date DESC`),
        pool.query('SELECT * FROM hr_goals ORDER BY employee_id ASC, id ASC'),
        pool.query('SELECT * FROM hr_reviews ORDER BY employee_id ASC, id DESC')
      ]);

    return {
      departments: departments.rows,
      shifts: shifts.rows,
      leaveTypes: leaveTypes.rows,
      employees: employees.rows,
      schedule: schedule.rows,
      attendance: attendance.rows,
      balances: balances.rows,
      leaveRequests: leaveRequests.rows,
      goals: goals.rows,
      reviews: reviews.rows
    };
  },

  async getEmployeeDossier(id) {
    const { rows } = await pool.query(
      `SELECT e.*, d.name AS department_name, d.color AS department_color, d.cost_center,
              m.full_name AS manager_name
       FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.department_id
       LEFT JOIN hr_employees m ON m.id = e.manager_id
       WHERE e.id = $1`,
      [id]
    );
    if (!rows[0]) return null;

    const [documents, trainings, payroll, events, goals, reviews, balance, leaves, attendance, reports] =
      await Promise.all([
        pool.query('SELECT * FROM hr_documents WHERE employee_id = $1 ORDER BY issued_at DESC', [id]),
        pool.query('SELECT * FROM hr_trainings WHERE employee_id = $1 ORDER BY completed_at DESC', [id]),
        pool.query('SELECT * FROM hr_payroll WHERE employee_id = $1 ORDER BY period DESC', [id]),
        pool.query('SELECT * FROM hr_events WHERE employee_id = $1 ORDER BY event_date DESC', [id]),
        pool.query('SELECT * FROM hr_goals WHERE employee_id = $1', [id]),
        pool.query('SELECT * FROM hr_reviews WHERE employee_id = $1 ORDER BY id DESC', [id]),
        pool.query('SELECT * FROM hr_leave_balances WHERE employee_id = $1 AND year = 2026', [id]),
        pool.query('SELECT * FROM hr_leave_requests WHERE employee_id = $1 ORDER BY start_date DESC', [id]),
        pool.query('SELECT * FROM hr_attendance WHERE employee_id = $1 ORDER BY work_date DESC LIMIT 30', [id]),
        pool.query('SELECT id, full_name, title FROM hr_employees WHERE manager_id = $1 ORDER BY full_name ASC', [id])
      ]);

    return {
      ...rows[0],
      documents: documents.rows,
      trainings: trainings.rows,
      payroll: payroll.rows,
      events: events.rows,
      goals: goals.rows,
      reviews: reviews.rows,
      balance: balance.rows[0] || null,
      leaveRequests: leaves.rows,
      attendance: attendance.rows,
      directReports: reports.rows
    };
  },

  async createEmployee(data) {
    const { rows } = await pool.query(
      `INSERT INTO hr_employees (employee_no, full_name, title, department_id, manager_id, status, employment_type,
        hire_date, birth_date, tc_no, sgk_no, phone, email, city, address, work_site, education,
        emergency_contact, default_shift, weekly_hours, iban, salary_gross, notes)
       VALUES ($1,$2,$3,$4,$5,'aktif',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [data.employee_no, data.full_name, data.title, data.department_id || null, data.manager_id || null,
        data.employment_type || 'Belirsiz Süreli', data.hire_date || null, data.birth_date || null,
        data.tc_no || null, data.sgk_no || null, data.phone || null, data.email || null, data.city || null,
        data.address || null, data.work_site || null, data.education || null, data.emergency_contact || null,
        data.default_shift || 'gunduz', Number(data.weekly_hours) || 45, data.iban || null,
        Number(data.salary_gross) || 0, data.notes || null]
    );
    const emp = rows[0];

    await pool.query(
      'INSERT INTO hr_leave_balances (employee_id, year, entitled_days, used_days, pending_days) VALUES ($1, 2026, 14, 0, 0)',
      [emp.id]
    );
    await pool.query(
      'INSERT INTO hr_events (employee_id, event_type, title, description, event_date, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [emp.id, 'ise_giris', 'İşe giriş', `${emp.title} olarak kadroya eklendi.`, emp.hire_date, 'İK']
    );
    return emp;
  },

  async updateEmployeeStatus(id, status, reason = null) {
    await pool.query(
      `UPDATE hr_employees SET status = $1,
         exit_date = CASE WHEN $1 = 'ayrildi' THEN COALESCE(exit_date, CURRENT_DATE) ELSE NULL END,
         exit_reason = CASE WHEN $1 = 'ayrildi' THEN $2 ELSE NULL END
       WHERE id = $3`,
      [status, reason, id]
    );
    if (status === 'ayrildi') {
      await pool.query(
        'INSERT INTO hr_events (employee_id, event_type, title, description, event_date, created_by) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)',
        [id, 'ayrilis', 'İşten ayrılış', reason || 'Kayıt güncellendi.', 'İK']
      );
    }
    const { rows } = await pool.query('SELECT * FROM hr_employees WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async setShift(employee_id, work_date, shift_code) {
    // Aynı gün için tek kayıt olmalı; varsa güncellenir.
    await pool.query(
      `INSERT INTO hr_schedule (employee_id, work_date, shift_code) VALUES ($1, $2, $3)
       ON CONFLICT(employee_id, work_date) DO UPDATE SET shift_code = EXCLUDED.shift_code`,
      [employee_id, work_date, shift_code]
    );
    const { rows } = await pool.query(
      'SELECT * FROM hr_schedule WHERE employee_id = $1 AND work_date = $2', [employee_id, work_date]
    );
    return rows[0] || null;
  },

  async punch(employee_id, work_date, kind) {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (kind === 'in') {
      const late = Math.max(0, now.getHours() * 60 + now.getMinutes() - 8 * 60);
      await pool.query(
        `INSERT INTO hr_attendance (employee_id, work_date, check_in, late_minutes, status)
         VALUES ($1, $2, $3, $4, 'icerde')
         ON CONFLICT(employee_id, work_date) DO UPDATE SET
           check_in = EXCLUDED.check_in, late_minutes = EXCLUDED.late_minutes, status = 'icerde'`,
        [employee_id, work_date, hhmm, late]
      );
    } else {
      const overtime = Math.max(0, now.getHours() * 60 + now.getMinutes() - 16 * 60);
      await pool.query(
        `UPDATE hr_attendance SET check_out = $1, overtime_minutes = $2, status = 'cikti'
         WHERE employee_id = $3 AND work_date = $4`,
        [hhmm, overtime, employee_id, work_date]
      );
    }

    const { rows } = await pool.query(
      'SELECT * FROM hr_attendance WHERE employee_id = $1 AND work_date = $2', [employee_id, work_date]
    );
    return rows[0] || null;
  },

  async createLeaveRequest(data) {
    const { rows } = await pool.query(
      `INSERT INTO hr_leave_requests (employee_id, leave_code, start_date, end_date, days, status, requested_at, reason)
       VALUES ($1,$2,$3,$4,$5,'bekliyor',CURRENT_DATE,$6) RETURNING *`,
      [data.employee_id, data.leave_code || 'yillik', data.start_date, data.end_date,
        Number(data.days) || 1, data.reason || null]
    );
    await pool.query(
      'UPDATE hr_leave_balances SET pending_days = pending_days + $1 WHERE employee_id = $2 AND year = 2026',
      [Number(data.days) || 1, data.employee_id]
    );
    return rows[0];
  },

  async decideLeave(id, status, approver) {
    const { rows } = await pool.query('SELECT * FROM hr_leave_requests WHERE id = $1', [id]);
    const req = rows[0];
    if (!req) return null;
    if (req.status !== 'bekliyor') return req;

    await pool.query('UPDATE hr_leave_requests SET status = $1, approver = $2 WHERE id = $3', [status, approver, id]);

    // Bakiye: bekleyenden düş, onaylandıysa kullanılana ekle.
    if (status === 'onaylandi') {
      await pool.query(
        `UPDATE hr_leave_balances SET pending_days = GREATEST(pending_days - $1, 0), used_days = used_days + $1
         WHERE employee_id = $2 AND year = 2026`,
        [req.days, req.employee_id]
      );
      await pool.query(
        'INSERT INTO hr_events (employee_id, event_type, title, description, event_date, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
        [req.employee_id, 'izin', 'İzin onaylandı', `${req.days} gün · ${req.leave_code}`, req.start_date, approver]
      );
    } else {
      await pool.query(
        'UPDATE hr_leave_balances SET pending_days = GREATEST(pending_days - $1, 0) WHERE employee_id = $2 AND year = 2026',
        [req.days, req.employee_id]
      );
    }

    const updated = await pool.query('SELECT * FROM hr_leave_requests WHERE id = $1', [id]);
    return updated.rows[0];
  },

  async addEvent(data) {
    const { rows } = await pool.query(
      `INSERT INTO hr_events (employee_id, event_type, title, description, event_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.employee_id, data.event_type, data.title, data.description || null,
        data.event_date, data.created_by || 'İK']
    );
    return rows[0];
  }
};

module.exports = hrService;
