const pool = require('../config/database');

// Get all audit logs with filters
const getAuditLogs = async (req, res) => {
  try {
    const { action, entity_type, limit = 50, sortBy, order = 'DESC', offset = 0, user_email } = req.query;

    // SQLi Prevention: Whitelist orderby
    const allowedSortColumns = ['id', 'user_email', 'action', 'entity_type', 'created_at'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const parsedLimit = parseInt(limit, 10) || 50;
    const parsedOffset = parseInt(offset, 10) || 0;

    let query = `
      SELECT * FROM audit_logs 
      WHERE tenant_id = $1
    `;
    let queryParams = [req.user.tenantId];

    if (action) {
      queryParams.push(action);
      query += ` AND action = $${queryParams.length}`;
    }

    if (entity_type) {
      queryParams.push(entity_type);
      query += ` AND entity_type = $${queryParams.length}`;
    }
    
    if (user_email) {
      queryParams.push(`%${user_email}%`);
      query += ` AND user_email LIKE $${queryParams.length}`;
    }

    query += ` ORDER BY ${safeSortBy} ${safeOrder}`;
    
    // Limits
    queryParams.push(parsedLimit, parsedOffset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAuditLogs
};
