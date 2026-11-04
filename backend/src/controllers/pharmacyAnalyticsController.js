const pool = require('../config/database');

const getRevenueAnalytics = async (req, res) => {
    try {
        const query = `
            SELECT 
                DATE(created_at) as date,
                SUM(total_amount) as revenue,
                COUNT(*) as count
            FROM pos_sales
            WHERE tenant_id=$1
            GROUP BY DATE(created_at)
            ORDER BY date ASC
            LIMIT 30
        `;
        const result = await pool.query(query,[req.user.tenantId]);
        
        const labels = result.rows.map(r => r.date);
        const revenue = result.rows.map(r => parseFloat(r.revenue || 0));
        const count = result.rows.map(r => parseInt(r.count || 0));

        res.json({ labels, revenue, count });
    } catch (error) {
        console.error('Error in getRevenueAnalytics:', error);
        res.status(500).json({ error: 'Gelir analizi getirilirken bir hata oluştu.' });
    }
};

const getTopSellingMedicines = async (req, res) => {
    try {
        const limit = Math.min(100,Math.max(1,parseInt(req.query.limit)||20));
        const period = req.query.period || '30d';
        
        let dateCondition = '';
        if (period === '30d') dateCondition = "AND p_sales.created_at >= datetime('now', '-30 days')";
        else if (period === '90d') dateCondition = "AND p_sales.created_at >= datetime('now', '-90 days')";

        const query = `
            SELECT 
                p.id as product_id,
                p.name as product_name,
                COALESCE(SUM(psi.quantity), 0) as total_quantity
            FROM pos_sale_items psi
            JOIN pos_sales p_sales ON p_sales.id = psi.sale_id
            JOIN products p ON p.id = psi.product_id
            WHERE (p.is_medicine = 1 OR p.category LIKE '%İlaç%') ${dateCondition} AND p_sales.tenant_id=$2
            GROUP BY p.id, p.name
            ORDER BY total_quantity DESC
            LIMIT $1
        `;
        
        const result = await pool.query(query, [limit,req.user.tenantId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in getTopSellingMedicines:', error);
        res.status(500).json({ error: 'En çok satan ilaçlar getirilirken bir hata oluştu.' });
    }
};

const getProfitMarginAnalysis = async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                name,
                kamu_fiyati,
                depocu_fiyati,
                ((kamu_fiyati - depocu_fiyati) / NULLIF(kamu_fiyati, 0)) * 100 as profit_margin
            FROM products
            WHERE (is_medicine = 1 OR category LIKE '%İlaç%') AND kamu_fiyati > 0 AND tenant_id=$1
            ORDER BY profit_margin DESC
            LIMIT 50
        `;
        const result = await pool.query(query,[req.user.tenantId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in getProfitMarginAnalysis:', error);
        res.status(500).json({ error: 'Kar marjı analizi getirilirken bir hata oluştu.' });
    }
};

const getPrescriptionTrends = async (req, res) => {
    try {
        const query = `
            SELECT 
                prescription_type,
                strftime('%Y-%m', created_at) as month,
                COUNT(*) as count
            FROM colored_prescriptions
            WHERE tenant_id=$1
            GROUP BY prescription_type, month
            ORDER BY month ASC
        `;
        const result = await pool.query(query,[req.user.tenantId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in getPrescriptionTrends:', error);
        res.status(500).json({ error: 'Reçete trendleri getirilirken bir hata oluştu.' });
    }
};

const getDepotComparison = async (req, res) => {
    try {
        const query = `
            SELECT 
                pd.id as depot_id,
                pd.name as depot_name,
                pd.current_balance,
                COUNT(dt.id) as transaction_count,
                COALESCE(SUM(CASE WHEN dt.transaction_type = 'purchase' THEN dt.amount ELSE 0 END), 0) as total_purchases
            FROM pharmacy_depots pd
            LEFT JOIN depot_transactions dt ON dt.depot_id = pd.id
            WHERE pd.tenant_id=$1
            GROUP BY pd.id, pd.name, pd.current_balance
            ORDER BY pd.name ASC
        `;
        const result = await pool.query(query,[req.user.tenantId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in getDepotComparison:', error);
        res.status(500).json({ error: 'Depo karşılaştırması getirilirken bir hata oluştu.' });
    }
};

const getMonthlyReport = async (req, res) => {
    try {
        const { month, year } = req.query;
        const currentYear = year || new Date().getFullYear();
        const currentMonth = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
        const monthFilter = `${currentYear}-${currentMonth}`;
        
        const salesQuery = `SELECT COALESCE(SUM(total_amount), 0) as total_sales FROM pos_sales WHERE strftime('%Y-%m', created_at) = $1 AND tenant_id=$2`;
        const salesResult = await pool.query(salesQuery, [monthFilter,req.user.tenantId]);
        
        const prescriptionsQuery = `SELECT COUNT(*) as total_prescriptions FROM colored_prescriptions WHERE strftime('%Y-%m', created_at) = $1 AND tenant_id=$2`;
        const prescriptionsResult = await pool.query(prescriptionsQuery, [monthFilter,req.user.tenantId]);
        
        const expiryQuery = `SELECT COUNT(*) as expiry_risk FROM medicine_batches WHERE tenant_id=$1 AND expiry_date <= date('now', '+3 months') AND status = 'in_stock'`;
        const expiryResult = await pool.query(expiryQuery,[req.user.tenantId]);
        
        const stockQuery = `
            SELECT COALESCE(SUM(sr.quantity * COALESCE(p.kamu_fiyati, p.sale_price)), 0) as stock_value 
            FROM stock_records sr
            JOIN products p ON sr.product_id = p.id
            WHERE sr.tenant_id=$1
        `;
        const stockResult = await pool.query(stockQuery,[req.user.tenantId]);
        
        res.json({
            period: monthFilter,
            total_sales: parseFloat(salesResult.rows[0]?.total_sales || 0),
            total_prescriptions: parseInt(prescriptionsResult.rows[0]?.total_prescriptions || 0),
            expiry_risk: parseInt(expiryResult.rows[0]?.expiry_risk || 0),
            stock_value: parseFloat(stockResult.rows[0]?.stock_value || 0)
        });
    } catch (error) {
        console.error('Error in getMonthlyReport:', error);
        res.status(500).json({ error: 'Aylık rapor getirilirken bir hata oluştu.' });
    }
};

module.exports = {
    getRevenueAnalytics,
    getTopSellingMedicines,
    getProfitMarginAnalysis,
    getPrescriptionTrends,
    getDepotComparison,
    getMonthlyReport
};
