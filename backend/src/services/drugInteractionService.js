const pool = require('../config/database');

class DrugInteractionService {
  async checkInteractions(atcCodes) {
    if (!atcCodes || atcCodes.length < 2) {
      return {
        has_interactions: false,
        interactions: [],
        grouped: {}
      };
    }
    
    // Fetch all interaction rules from database
    const allRulesRes = await pool.query('SELECT * FROM drug_interactions');
    const allRules = allRulesRes.rows;

    const matched = allRules.filter(r => {
      const matchForward = atcCodes.includes(r.atc_code_1) && atcCodes.includes(r.atc_code_2);
      const matchReverse = atcCodes.includes(r.atc_code_2) && atcCodes.includes(r.atc_code_1);
      return matchForward || matchReverse;
    });

    // Group by severity
    const grouped = matched.reduce((acc, curr) => {
      const level = curr.interaction_level || 'unknown';
      if (!acc[level]) {
        acc[level] = [];
      }
      acc[level].push(curr);
      return acc;
    }, {});
    
    return {
      has_interactions: matched.length > 0,
      interactions: matched,
      grouped
    };
  }

  async checkPatientInteractions(patientId, newMedicineAtcCode) {
    try {
      const recentMedsRes = await pool.query(`
        SELECT DISTINCT p.atc_code
        FROM pos_sale_items psi
        JOIN pos_sales ps ON ps.id = psi.sale_id
        JOIN products p ON p.id = psi.product_id
        WHERE ps.patient_id = $1 
          AND ps.created_at >= datetime('now', '-90 days')
          AND p.atc_code IS NOT NULL
      `, [patientId]);

      const patientAtcCodes = recentMedsRes.rows.map(r => r.atc_code);
      if (patientAtcCodes.length === 0) return [];

      const allRulesRes = await pool.query('SELECT * FROM drug_interactions');
      const allRules = allRulesRes.rows;

      return allRules.filter(r => 
        (r.atc_code_1 === newMedicineAtcCode && patientAtcCodes.includes(r.atc_code_2)) ||
        (r.atc_code_2 === newMedicineAtcCode && patientAtcCodes.includes(r.atc_code_1))
      );
    } catch (e) {
      console.error('Check patient interactions error:', e);
      return [];
    }
  }

  async getAllInteractions() {
    const result = await pool.query('SELECT * FROM drug_interactions ORDER BY id DESC');
    return result.rows;
  }

  async addInteractionRule(data) {
    const query = `
      INSERT INTO drug_interactions (
        atc_code_1, drug_name_1, atc_code_2, drug_name_2, 
        interaction_level, description, clinical_effect, recommendation, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [
      data.atc_code_1,
      data.drug_name_1,
      data.atc_code_2,
      data.drug_name_2,
      data.interaction_level,
      data.description,
      data.clinical_effect || null,
      data.recommendation || null,
      data.source || 'TEB_DB'
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }
}

module.exports = new DrugInteractionService();
