const pool = require('../config/database');

/**
 * CRM veri servisi.
 *
 * Arayüz tüm koleksiyonları tek seferde yüklediği için `bootstrap` hepsini
 * birlikte döndürür; böylece açılışta tek istek yeterli olur.
 * JSON metni olarak saklanan alanlar (tags, tech_stack, steps_json) burada
 * çözülür — istemci ham metinle uğraşmaz.
 */

const parseJson = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const mapCompany = (r) => ({ ...r, techStack: parseJson(r.tech_stack, []) });
const mapContact = (r) => ({ ...r, tags: parseJson(r.tags, []) });
const mapDeal = (r) => ({ ...r, tags: parseJson(r.tags, []) });
const mapTask = (r) => ({ ...r, tags: parseJson(r.tags, []) });
const mapAutomation = (r) => ({ ...r, steps: parseJson(r.steps_json, []), enabled: !!r.enabled });

const crmService = {
  async bootstrap() {
    const [companies, contacts, leads, deals, tasks, activities, automations, notifications] = await Promise.all([
      pool.query('SELECT * FROM crm_companies ORDER BY name ASC'),
      pool.query(`SELECT c.*, co.name AS company_name FROM crm_contacts c
                  LEFT JOIN crm_companies co ON co.id = c.company_id
                  ORDER BY c.lead_score DESC, c.full_name ASC`),
      pool.query('SELECT * FROM crm_leads ORDER BY score DESC, id DESC'),
      pool.query(`SELECT d.*, co.name AS company_name FROM crm_deals d
                  LEFT JOIN crm_companies co ON co.id = d.company_id
                  ORDER BY d.value DESC`),
      pool.query(`SELECT t.*, co.name AS related_company, d.title AS related_deal FROM crm_tasks t
                  LEFT JOIN crm_companies co ON co.id = t.related_company_id
                  LEFT JOIN crm_deals d ON d.id = t.related_deal_id
                  ORDER BY t.id DESC`),
      pool.query('SELECT * FROM crm_activities ORDER BY created_at DESC, id DESC'),
      pool.query('SELECT * FROM crm_automations ORDER BY id ASC'),
      pool.query('SELECT * FROM crm_notifications ORDER BY id DESC')
    ]);

    return {
      companies: companies.rows.map(mapCompany),
      contacts: contacts.rows.map(mapContact),
      leads: leads.rows,
      deals: deals.rows.map(mapDeal),
      tasks: tasks.rows.map(mapTask),
      activities: activities.rows,
      automations: automations.rows.map(mapAutomation),
      notifications: notifications.rows.map((n) => ({ ...n, read: !!n.is_read }))
    };
  },

  async logActivity({ activity_type = 'note', title, description = null, user_name = 'Sistem', related_object = null, badge_color = 'info' }) {
    const { rows } = await pool.query(
      `INSERT INTO crm_activities (activity_type, title, description, user_name, related_object, badge_color)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [activity_type, title, description, user_name, related_object, badge_color]
    );
    return rows[0];
  },

  /* ── Fırsatlar ── */
  async createDeal(data) {
    const { rows } = await pool.query(
      `INSERT INTO crm_deals (title, company_id, value, stage, probability, sales_rep, expected_close_date, priority, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.title, data.company_id || null, Number(data.value) || 0, data.stage || 'qualification',
        Number(data.probability) || 50, data.sales_rep || null, data.expected_close_date || null,
        data.priority || 'medium', JSON.stringify(data.tags || [])]
    );
    await this.logActivity({
      activity_type: 'stage_change',
      title: `Yeni fırsat oluşturuldu: ${data.title}`,
      description: `${data.sales_rep || 'Atanmadı'} · ${Number(data.value || 0).toLocaleString('tr-TR')} ₺`,
      user_name: data.sales_rep || 'Sistem',
      related_object: data.company_name || null
    });
    return mapDeal(rows[0]);
  },

  async updateDealStage(id, stage) {
    const probability = stage === 'won' ? 100 : stage === 'lost' ? 0 : null;
    await pool.query(
      `UPDATE crm_deals SET stage = $1, probability = COALESCE($2, probability), updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [stage, probability, id]
    );
    const { rows } = await pool.query('SELECT * FROM crm_deals WHERE id = $1', [id]);
    if (rows[0]) {
      await this.logActivity({
        activity_type: stage === 'won' ? 'deal_won' : 'stage_change',
        title: `Fırsat aşaması güncellendi: ${rows[0].title}`,
        description: `Yeni aşama: ${stage}`,
        user_name: rows[0].sales_rep || 'Sistem',
        badge_color: stage === 'won' ? 'success' : stage === 'lost' ? 'danger' : 'purple'
      });
    }
    return rows[0] ? mapDeal(rows[0]) : null;
  },

  async deleteDeal(id) {
    await pool.query('DELETE FROM crm_deals WHERE id = $1', [id]);
    return { success: true };
  },

  /* ── Adaylar ── */
  async createLead(data) {
    const { rows } = await pool.query(
      `INSERT INTO crm_leads (name, company, job_title, email, phone, source, status, score, estimated_value, owner, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.name, data.company || null, data.job_title || null, data.email || null, data.phone || null,
        data.source || null, data.status || 'new', Number(data.score) || 60,
        Number(data.estimated_value) || 0, data.owner || null, data.notes || null]
    );
    return rows[0];
  },

  async updateLeadStatus(id, status) {
    await pool.query('UPDATE crm_leads SET status = $1 WHERE id = $2', [status, id]);
    const { rows } = await pool.query('SELECT * FROM crm_leads WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async deleteLead(id) {
    await pool.query('DELETE FROM crm_leads WHERE id = $1', [id]);
    return { success: true };
  },

  /* ── Kişi & Şirket ── */
  async createContact(data) {
    const { rows } = await pool.query(
      `INSERT INTO crm_contacts (full_name, job_title, company_id, email, phone, location, contact_status, owner, lead_score, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [data.full_name, data.job_title || null, data.company_id || null, data.email || null, data.phone || null,
        data.location || null, data.contact_status || 'Aktif', data.owner || null,
        Number(data.lead_score) || 60, JSON.stringify(data.tags || [])]
    );
    return mapContact(rows[0]);
  },

  async createCompany(data) {
    const { rows } = await pool.query(
      `INSERT INTO crm_companies (name, domain, industry, employees, annual_revenue, location, tier, health_status,
        account_owner, tech_stack, description, website, phone, tax_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [data.name, data.domain || null, data.industry || null, data.employees || null, data.annual_revenue || null,
        data.location || null, data.tier || 'Yeni Hesap', data.health_status || 'healthy',
        data.account_owner || null, JSON.stringify(data.techStack || []), data.description || null,
        data.website || null, data.phone || null, data.tax_no || null]
    );
    return mapCompany(rows[0]);
  },

  /* ── Görevler ── */
  async createTask(data) {
    const { rows } = await pool.query(
      `INSERT INTO crm_tasks (title, priority, assignee, due_date, related_company_id, related_deal_id, status, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [data.title, data.priority || 'medium', data.assignee || null, data.due_date || null,
        data.related_company_id || null, data.related_deal_id || null, data.status || 'todo',
        JSON.stringify(data.tags || [])]
    );
    return mapTask(rows[0]);
  },

  async toggleTask(id) {
    const { rows } = await pool.query('SELECT status FROM crm_tasks WHERE id = $1', [id]);
    if (!rows[0]) return null;
    const next = rows[0].status === 'completed' ? 'todo' : 'completed';
    await pool.query('UPDATE crm_tasks SET status = $1 WHERE id = $2', [next, id]);
    const updated = await pool.query('SELECT * FROM crm_tasks WHERE id = $1', [id]);
    return mapTask(updated.rows[0]);
  },

  async deleteTask(id) {
    await pool.query('DELETE FROM crm_tasks WHERE id = $1', [id]);
    return { success: true };
  },

  /* ── Otomasyon & Bildirim ── */
  async toggleAutomation(id) {
    await pool.query('UPDATE crm_automations SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = $1', [id]);
    const { rows } = await pool.query('SELECT * FROM crm_automations WHERE id = $1', [id]);
    return rows[0] ? mapAutomation(rows[0]) : null;
  },

  async markNotificationRead(id) {
    await pool.query('UPDATE crm_notifications SET is_read = 1 WHERE id = $1', [id]);
    return { success: true };
  },

  async markAllNotificationsRead() {
    await pool.query('UPDATE crm_notifications SET is_read = 1 WHERE is_read = 0');
    return { success: true };
  }
};

module.exports = crmService;
