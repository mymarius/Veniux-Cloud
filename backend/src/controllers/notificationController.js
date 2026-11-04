const { sendTestNotification } = require('../services/notificationService');

// Send test notification
const sendTest = async (req, res) => {
  try {
    const result = await sendTestNotification();
    if (!result.success) return res.status(503).json({error:'Bildirim gönderilemedi. SMTP/Telegram yapılandırmasını kontrol edin.'});
    res.json({
      message: 'Test notification sent',
      result
    });
  } catch (error) {
    console.error('Send test notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  sendTest
};
