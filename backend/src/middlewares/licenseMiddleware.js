const pool = require('../config/database');
const licenseService = require('../services/licenseService');

const checkEntitlement = (resourceName) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      
      // SYSTEM ADMIN BYPASS: The system root/admin should not be restricted by license limits
      if (req.user && req.user.isPlatformAdmin) {
        return next();
      }
      
      if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

      const licenseRes = req.centralLicense?.valid ? {rows:[req.centralLicense]} : await pool.query(
        "SELECT * FROM licenses WHERE tenant_id = $1 AND status IN ('ACTIVE','PAST_DUE') ORDER BY expires_at DESC LIMIT 1",
        [tenantId]
      );

      if (licenseRes.rows.length === 0) {
        return res.status(403).json({ error: 'No active license found for tenant' });
      }

      const activeLicense = licenseRes.rows[0];
      if (new Date(activeLicense.expires_at) < new Date()) {
        return res.status(403).json({ error: 'License expired' });
      }

      const plans = licenseService.getPlans();
      let planDetails = plans.find(p => p.id === activeLicense.plan_id);
      
      const packageContract=require('../services/productPackages').parse(JSON.parse(activeLicense.enabled_features_json||'{}'));
      if(packageContract)planDetails={max_users:packageContract.limits.users,max_warehouses:packageContract.limits.warehouses};
      if (!planDetails) {
        planDetails = { max_users: 10, max_warehouses: 2 };
      }

      if (resourceName === 'users') {
        const countRes = await pool.query('SELECT COUNT(*) as count FROM users WHERE tenant_id = $1', [tenantId]);
        if (parseInt(countRes.rows[0].count) >= planDetails.max_users) {
          return res.status(403).json({ error: 'Maximum users limit reached for this license plan' });
        }
      }

      if (resourceName === 'warehouses') {
        const countRes = await pool.query('SELECT COUNT(*) as count FROM warehouses WHERE tenant_id = $1', [tenantId]);
        if (parseInt(countRes.rows[0].count) >= planDetails.max_warehouses) {
          return res.status(403).json({ error: 'Maximum warehouses limit reached for this license plan' });
        }
      }

      next();
    } catch (error) {
      console.error('Entitlement check error:', error.message);
      res.status(500).json({ error: 'Internal server error during entitlement check' });
    }
  };
};

module.exports = checkEntitlement;
