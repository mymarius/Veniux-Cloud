const nodemailer = require('nodemailer');

/**
 * Notification Service
 * Sends notifications via Email (Nodemailer) and Telegram Bot API
 */

const isEmailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

// Email transporter configuration
const getEmailTransporter = () => {
  if (!isEmailConfigured()) {
    console.log('Email configuration incomplete, email notifications disabled');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for STARTTLS ports
    requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

/**
 * Send email notification
 */
const sendEmail = async (to, subject, text, html, extra = {}) => {
  try {
    const transporter = getEmailTransporter();
    
    if (!transporter) {
      console.log('Email transporter not configured, skipping email notification');
      return { success: false, method: 'email', error: 'Not configured' };
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
      ...(extra.replyTo ? { replyTo: extra.replyTo } : {}),
      ...(Array.isArray(extra.attachments) ? { attachments: extra.attachments } : {})
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, method: 'email', messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, method: 'email', error: 'E-posta gönderimi doğrulanamadı. Bağlantı ayarlarını kontrol edin.' };
  }
};

/**
 * Send Telegram bot notification
 */
const sendTelegram = async (message) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      console.log('Telegram configuration incomplete, Telegram notifications disabled');
      return { success: false, method: 'telegram', error: 'Not configured' };
    }

    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();

    if (data.ok) {
      console.log('Telegram message sent successfully');
      return { success: true, method: 'telegram', messageId: data.result.message_id };
    } else {
      console.error('Telegram API error:', data.description);
      return { success: false, method: 'telegram', error: data.description };
    }
  } catch (error) {
    console.error('Telegram send error:', error);
    return { success: false, method: 'telegram', error: 'Telegram gönderimi doğrulanamadı. Bağlantı ayarlarını kontrol edin.' };
  }
};

/**
 * Send critical alert notification via all configured channels
 */
const sendCriticalAlert = async (alertData) => {
  const { product_name, sku, warehouse_name, message, severity } = alertData;
  
  // Only send notifications for critical alerts
  if (severity !== 'critical') {
    return { skipped: true, reason: 'Not a critical alert' };
  }

  const subject = `🚨 Critical Stock Alert: ${product_name} (${sku})`;
  const text = `
CRITICAL STOCK ALERT

Product: ${product_name} (${sku})
Warehouse: ${warehouse_name}
Severity: ${severity}

Message: ${message}

Time: ${new Date().toISOString()}
  `.trim();

  const html = `
    <h2>🚨 Critical Stock Alert</h2>
    <p><strong>Product:</strong> ${product_name} (${sku})</p>
    <p><strong>Warehouse:</strong> ${warehouse_name}</p>
    <p><strong>Severity:</strong> ${severity}</p>
    <p><strong>Message:</strong> ${message}</p>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
  `;

  const telegramMessage = `
🚨 <b>CRITICAL STOCK ALERT</b>

<b>Product:</b> ${product_name} (${sku})
<b>Warehouse:</b> ${warehouse_name}
<b>Severity:</b> ${severity}

${message}

<i>${new Date().toISOString()}</i>
  `.trim();

  const results = [];

  // Send email
  const emailResult = await sendEmail(
    process.env.ALERT_EMAIL || process.env.SMTP_USER,
    subject,
    text,
    html
  );
  results.push(emailResult);

  // Send Telegram
  const telegramResult = await sendTelegram(telegramMessage);
  results.push(telegramResult);

  return {
    success: results.some(r => r.success),
    results
  };
};

/**
 * Send test notification (for configuration testing)
 */
const sendTestNotification = async () => {
  const testData = {
    product_name: 'Test Product',
    sku: 'TEST-001',
    warehouse_name: 'Test Warehouse',
    message: 'This is a test notification to verify email and Telegram configuration.',
    severity: 'critical'
  };

  return await sendCriticalAlert(testData);
};

module.exports = {
  isEmailConfigured,
  sendEmail,
  sendTelegram,
  sendCriticalAlert,
  sendTestNotification
};
