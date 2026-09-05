const { env } = require('../config/env');
const { HttpError } = require('../lib/http-error');

function verifyOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origin = req.get('origin');
  const referer = req.get('referer');
  const expected = env.appOrigin || `${req.protocol}://${req.get('host')}`;

  if (origin && origin !== expected) return next(new HttpError(403, 'Источник запроса отклонён', 'ORIGIN_REJECTED'));
  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== expected) return next(new HttpError(403, 'Источник запроса отклонён', 'ORIGIN_REJECTED'));
    } catch {
      return next(new HttpError(403, 'Источник запроса отклонён', 'ORIGIN_REJECTED'));
    }
  }
  if (env.isProduction && !origin && !referer) return next(new HttpError(403, 'Источник запроса не указан', 'ORIGIN_REQUIRED'));
  return next();
}

module.exports = { verifyOrigin };
