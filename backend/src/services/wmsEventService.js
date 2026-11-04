const pool = require('../config/database');

class WMSEventService {
  emit(eventName, payload) {
    // In-memory / console domain event logger. Ready for Redis / RabbitMQ / Webhooks in production.
    console.log(`[WMS Domain Event] ⚡ ${eventName}`, process.env.NODE_ENV==='production' ? {event_recorded:true} : JSON.stringify(payload));
  }
}

module.exports = new WMSEventService();
