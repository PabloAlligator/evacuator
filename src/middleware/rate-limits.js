const { rateLimit } = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMIT', message: 'Слишком много запросов. Попробуйте позже.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, code: 'LOGIN_RATE_LIMIT', message: 'Слишком много попыток входа. Повторите через 15 минут.' },
});

module.exports = { apiLimiter, loginLimiter };
