const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Secure Local Storage directory in user AppData
const APP_DATA_DIR = process.env.VENIUX_LICENSE_STORAGE || path.join(os.homedir(), '.veniux-wms');
const LICENSE_CACHE_FILE = path.join(APP_DATA_DIR, 'license.enc');
const MONOTONIC_CLOCK_FILE = path.join(APP_DATA_DIR, '.clock');

// Derive machine encryption key for AES-256-GCM
function getStorageKey() {
  const machineSeed = `${os.hostname()}-${os.platform()}-${os.arch()}-VENIUX-ENT-SECRET`;
  return crypto.createHash('sha256').update(machineSeed).digest();
}

class SecureStorage {
  constructor() {
    if (!fs.existsSync(APP_DATA_DIR)) {
      fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    }
  }

  /**
   * Encrypt and save signed license token payload
   */
  saveLicenseToken(tokenData) {
    try {
      const key = getStorageKey();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

      const jsonStr = JSON.stringify(tokenData);
      let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');

      const filePayload = JSON.stringify({
        iv: iv.toString('hex'),
        authTag: authTag,
        data: encrypted,
        updated_at: Date.now()
      });

      fs.writeFileSync(LICENSE_CACHE_FILE, filePayload, 'utf8');
      this.updateMonotonicClock(Date.now());
      return true;
    } catch (err) {
      console.error('[SecureStorage] Error saving license token:', err);
      return false;
    }
  }

  /**
   * Load and decrypt cached license token
   */
  loadLicenseToken() {
    try {
      if (!fs.existsSync(LICENSE_CACHE_FILE)) return null;

      const raw = fs.readFileSync(LICENSE_CACHE_FILE, 'utf8');
      const filePayload = JSON.parse(raw);

      const key = getStorageKey();
      const iv = Buffer.from(filePayload.iv, 'hex');
      const authTag = Buffer.from(filePayload.authTag, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(filePayload.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Verify system clock against anti-rollback timestamp
      const isClockTampered = this.checkClockRollback();
      const tokenObj = JSON.parse(decrypted);

      return {
        ...tokenObj,
        _clock_tampered: isClockTampered
      };
    } catch (err) {
      console.error('[SecureStorage] Error loading or decrypting license token:', err);
      return null;
    }
  }

  /**
   * Anti-Tampering: Track highest observed monotonic timestamp
   */
  updateMonotonicClock(currentTimestamp) {
    try {
      let maxTime = currentTimestamp;
      if (fs.existsSync(MONOTONIC_CLOCK_FILE)) {
        const last = parseInt(fs.readFileSync(MONOTONIC_CLOCK_FILE, 'utf8'), 10);
        if (!isNaN(last) && last > maxTime) maxTime = last;
      }
      fs.writeFileSync(MONOTONIC_CLOCK_FILE, String(maxTime), 'utf8');
    } catch (e) {
      // ignore
    }
  }

  /**
   * Check if current system clock is older than previously recorded timestamp
   */
  checkClockRollback() {
    try {
      if (!fs.existsSync(MONOTONIC_CLOCK_FILE)) return false;
      const lastRecorded = parseInt(fs.readFileSync(MONOTONIC_CLOCK_FILE, 'utf8'), 10);
      const now = Date.now();
      // Allow 5 minutes of clock drift tolerance
      return now < (lastRecorded - 5 * 60 * 1000);
    } catch (e) {
      return false;
    }
  }

  clear() {
    try {
      if (fs.existsSync(LICENSE_CACHE_FILE)) fs.unlinkSync(LICENSE_CACHE_FILE);
    } catch (e) {}
  }
}

module.exports = new SecureStorage();
