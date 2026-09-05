const prisma = require('../lib/prisma');
const { HttpError } = require('../lib/http-error');
const {
  SESSION_COOKIE,
  hashToken,
  csrfTokenForSession,
  safeEqual,
  clearCookieOptions,
} = require('../lib/security');

async function loadSession(req, res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return next();

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      res.clearCookie(SESSION_COOKIE, clearCookieOptions());
      return next();
    }

    req.user = session.user;
    req.sessionRecord = session;
    req.sessionToken = token;

    if (Date.now() - session.lastSeenAt.getTime() > 15 * 60 * 1000) {
      prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Требуется авторизация', 'AUTH_REQUIRED'));
  return next();
}

function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== 'OWNER') return next(new HttpError(403, 'Недостаточно прав', 'FORBIDDEN'));
  return next();
}

function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.user || !req.sessionToken) return next(new HttpError(401, 'Требуется авторизация', 'AUTH_REQUIRED'));
  const expected = csrfTokenForSession(req.sessionToken);
  if (!safeEqual(req.get('x-csrf-token'), expected)) {
    return next(new HttpError(403, 'Некорректный CSRF-токен', 'CSRF_INVALID'));
  }
  return next();
}

module.exports = { loadSession, requireAuth, requireOwner, requireCsrf };
