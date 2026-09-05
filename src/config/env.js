const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

function intValue(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function parseOrigin(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: intValue(process.env.PORT, 3000, 1, 65535),
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  sessionSecret: process.env.SESSION_SECRET || '',
  sessionDays: intValue(process.env.SESSION_DAYS, 14, 1, 30),
  appOrigin: parseOrigin(process.env.APP_ORIGIN),
  trustProxy: process.env.TRUST_PROXY === '1' ? 1 : false,
  backupRetentionDays: intValue(process.env.BACKUP_RETENTION_DAYS, 30, 1, 365),
  isProduction: process.env.NODE_ENV === 'production',
});

function validateEnv() {
  if (env.sessionSecret.length < 64) {
    throw new Error('SESSION_SECRET должен содержать минимум 64 символа');
  }
  if (env.isProduction && !env.appOrigin) {
    throw new Error('В production необходимо указать корректный APP_ORIGIN');
  }
}

module.exports = { env, validateEnv };
