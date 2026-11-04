const pool = require('../config/database');

const getDepotTransactions = async (req, res) => {
    try {
        const { depotId } = req.params;
        const { start_date, end_date } = req.query;
        
        let query = `SELECT * FROM depot_transactions WHERE depot_id = $1 AND tenant_id=$2`;
        const params = [depotId,req.user.tenantId];
        
        if (start_date) {
            params.push(start_date);
            query += ` AND transaction_date >= $${params.length}`;
        }
        if (end_date) {
            params.push(end_date);
            query += ` AND transaction_date <= $${params.length}`;
        }
        
        query += ` ORDER BY transaction_date ASC, created_at ASC`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in getDepotTransactions:', error);
        res.status(500).json({ error: 'Depo işlemleri getirilirken bir hata oluştu.' });
    }
};

const addDepotTransaction = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { transaction_type, amount, reference_no, description } = req.body;
        const depot_id=Number(req.params.depotId);
        if(!['purchase','payment','debit_note','credit_note'].includes(transaction_type)||!Number.isFinite(Number(amount))||Number(amount)<=0)throw new Error('Geçersiz tutar veya işlem türü.');
        
        const depotQuery = `SELECT current_balance FROM pharmacy_depots WHERE id = $1 AND tenant_id=$2`;
        const depotResult = await client.query(depotQuery, [depot_id,req.user.tenantId]);
        
        if (depotResult.rows.length === 0) {
            throw new Error('Depo bulunamadı.');
        }
        
        const currentBalance = parseFloat(depotResult.rows[0].current_balance);
        const transactionAmount = parseFloat(amount);
        let balance_after = currentBalance;
        
        if (transaction_type === 'purchase' || transaction_type === 'debit_note') {
            balance_after += transactionAmount;
        } else if (transaction_type === 'payment' || transaction_type === 'credit_note') {
            balance_after -= transactionAmount;
        }
        
        const insertTxQuery = `
            INSERT INTO depot_transactions 
            (tenant_id,depot_id, transaction_type, amount, reference_no, description, balance_after, created_at, transaction_date)
            VALUES ($7,$1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
        `;
        const insertTxResult = await client.query(insertTxQuery, [
            depot_id, transaction_type, transactionAmount, reference_no, description, balance_after,req.user.tenantId
        ]);
        
        const updateDepotQuery = `UPDATE pharmacy_depots SET current_balance = $1 WHERE id = $2`;
        await client.query(updateDepotQuery, [balance_after, depot_id]);
        
        await client.query('COMMIT');
        res.status(201).json(insertTxResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in addDepotTransaction:', error);
        res.status(500).json({ error: 'İşlem eklenirken bir hata oluştu.' });
    } finally {
        client.release();
    }
};

const getBalanceSummary = async (req, res) => {
    try {
        const query = `
            SELECT 
                pd.id,
                pd.name,
                pd.current_balance,
                SUM(CASE WHEN dt.transaction_type = 'purchase' THEN dt.amount ELSE 0 END) as total_purchases,
                SUM(CASE WHEN dt.transaction_type = 'payment' THEN dt.amount ELSE 0 END) as total_payments
            FROM pharmacy_depots pd
            LEFT JOIN depot_transactions dt ON pd.id = dt.depot_id
            WHERE pd.tenant_id=$1
            GROUP BY pd.id, pd.name, pd.current_balance
        `;
        const result = await pool.query(query,[req.user.tenantId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in getBalanceSummary:', error);
        res.status(500).json({ error: 'Bakiye özeti getirilirken bir hata oluştu.' });
    }
};

const createReconciliation = async (req, res) => {
    try {
        const { period_start, period_end, our_balance, depot_balance, notes } = req.body;
        const depot_id=Number(req.params.depotId);
        
        const difference = parseFloat(our_balance) - parseFloat(depot_balance);
        
        const query = `
            INSERT INTO depot_reconciliations 
            (tenant_id,depot_id, period_start, period_end, our_balance, depot_balance, difference, notes, status, created_at)
            VALUES ($8,$1, $2, $3, $4, $5, $6, $7, 'pending', CURRENT_TIMESTAMP)
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            depot_id, period_start, period_end, our_balance, depot_balance, difference, notes,req.user.tenantId
        ]);
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error in createReconciliation:', error);
        res.status(500).json({ error: 'Mutabakat oluşturulurken bir hata oluştu.' });
    }
};

const getReconciliations = async (req, res) => {
    try {
        const { depot_id, status } = req.query;
        let query = `SELECT * FROM depot_reconciliations WHERE tenant_id = $1`;
        const params = [req.user.tenantId];
        
        if (depot_id) {
            params.push(depot_id);
            query += ` AND depot_id = $${params.length}`;
        }
        
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        
        query += ` ORDER BY created_at DESC`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in getReconciliations:', error);
        res.status(500).json({ error: 'Mutabakatlar getirilirken bir hata oluştu.' });
    }
};

const updateReconciliationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        
        const query = `
            UPDATE depot_reconciliations 
            SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $3 AND tenant_id=$4 
            RETURNING *
        `;
        
        const result = await pool.query(query, [status, notes, id,req.user.tenantId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mutabakat bulunamadı.' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error in updateReconciliationStatus:', error);
        res.status(500).json({ error: 'Mutabakat güncellenirken bir hata oluştu.' });
    }
};

module.exports = {
    getDepotTransactions,
    addDepotTransaction,
    getBalanceSummary,
    createReconciliation,
    getReconciliations,
    updateReconciliationStatus
};
