const pool = require('../config/database');

const createReminder = async (data) => {
    const { patient_id, medicine_id, reminder_type, frequency_days, notification_method } = data;
    const query = `
        INSERT INTO patient_reminders 
        (patient_id, medicine_id, reminder_type, frequency_days, notification_method, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP)
        RETURNING *
    `;
    const result = await pool.query(query, [
        patient_id, medicine_id, reminder_type, frequency_days, notification_method
    ]);
    return result.rows[0];
};

const getReminders = async (patientId) => {
    const query = `
        SELECT pr.*, p.name as medicine_name 
        FROM patient_reminders pr
        JOIN products p ON pr.medicine_id = p.id
        WHERE pr.patient_id = $1
        ORDER BY pr.created_at DESC
    `;
    const result = await pool.query(query, [patientId]);
    return result.rows;
};

const updateReminder = async (id, data) => {
    const { reminder_type, frequency_days, notification_method, is_active } = data;
    const query = `
        UPDATE patient_reminders 
        SET reminder_type = COALESCE($1, reminder_type),
            frequency_days = COALESCE($2, frequency_days),
            notification_method = COALESCE($3, notification_method),
            is_active = COALESCE($4, is_active)
        WHERE id = $5
        RETURNING *
    `;
    const result = await pool.query(query, [
        reminder_type, frequency_days, notification_method, is_active, id
    ]);
    return result.rows[0];
};

const deleteReminder = async (id) => {
    const query = `DELETE FROM patient_reminders WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
};

const getDueReminders = async () => {
    const query = `
        SELECT pr.*, pa.first_name, pa.last_name, pa.phone, p.name as medicine_name
        FROM patient_reminders pr
        JOIN patient_accounts pa ON pr.patient_id = pa.id
        JOIN products p ON pr.medicine_id = p.id
        WHERE pr.next_reminder_at <= CURRENT_TIMESTAMP AND pr.is_active = 1
    `;
    const result = await pool.query(query);
    return result.rows;
};

const markReminderSent = async (id) => {
    const getQuery = `SELECT frequency_days FROM patient_reminders WHERE id = $1`;
    const reminder = await pool.query(getQuery, [id]);
    
    if (reminder.rows.length === 0) return null;
    
    const freq = reminder.rows[0].frequency_days;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + freq);
    
    const updateQuery = `
        UPDATE patient_reminders 
        SET last_dispensed_at = CURRENT_TIMESTAMP,
            next_reminder_at = $1
        WHERE id = $2
        RETURNING *
    `;
    const result = await pool.query(updateQuery, [nextDate.toISOString(), id]);
    return result.rows[0];
};

const runReminderCheck = async () => {
    try {
        const dueReminders = await getDueReminders();
        
        for (const reminder of dueReminders) {
            console.log(\`Sending \${reminder.notification_method} to \${reminder.first_name} \${reminder.last_name} for \${reminder.medicine_name}\`);
            await markReminderSent(reminder.id);
        }
        
        return { success: true, processed_count: dueReminders.length };
    } catch (error) {
        console.error('Error in runReminderCheck:', error);
        throw error;
    }
};

module.exports = {
    createReminder,
    getReminders,
    updateReminder,
    deleteReminder,
    getDueReminders,
    markReminderSent,
    runReminderCheck
};
