const pool = require('../config/database');
const { runAlertRuleEngine } = require('../services/alertRuleEngine');
const { runAIAnalysis } = require('../services/aiAnalysisService');

// Get all alerts
const getAlerts = async (req, res) => {
  try {
    const { status, severity } = req.query;
    
    let query = `
      SELECT a.*, p.sku, p.name as product_name, w.name as warehouse_name 
      FROM alerts a 
      LEFT JOIN products p ON a.product_id = p.id 
      LEFT JOIN warehouses w ON a.warehouse_id = w.id 
      WHERE a.tenant_id = $1
    `;
    const params = [req.user.tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (severity) {
      query += ` AND a.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update alert status
const updateAlertStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['unread','read','resolved','active'].includes(status)) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const result = await pool.query(
      'UPDATE alerts SET status = $1 WHERE id = $2 AND tenant_id=$3 RETURNING *',
      [status, id, req.user.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update alert status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Run alert rule engine manually
const runRuleEngine = async (req, res) => {
  try {
    const result = await runAlertRuleEngine(req.user.tenantId);
    res.json({
      message: 'Alert rule engine executed',
      ...result
    });
  } catch (error) {
    console.error('Run rule engine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Run AI analysis manually
const runAIAnalysisEndpoint = async (req, res) => {
  try {
    const result = await runAIAnalysis(req.user.tenantId);
    res.json({
      message: 'AI analysis executed',
      ...result
    });
  } catch (error) {
    console.error('Run AI analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAlerts,
  updateAlertStatus,
  runRuleEngine,
  runAIAnalysisEndpoint
};
