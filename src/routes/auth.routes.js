const express = require('express');
const prisma = require('../lib/prisma');
const { asyncRoute } = require('../lib/async-route');
const { HttpError } = require('../lib/http-error');
const { recordActivity } = require('../lib/activity');
const { env } = require('../config/env');
const { loginLimiter } = require('../middleware/rate-limits');
const { requireAuth, requireCsrf } = require('../middleware/auth');
const {
  SESSION_COOKIE,
  verifyPassword,
  hashPassword,
  generateSessionToken,
  hashToken,
  csrfTokenForSession,
  cookieOptions,
  clearCookieOptions,
  validPassword,
  normalizeEmail,
  publicUser,
} = require('../lib/security');

const router = express.Router();

router.post('/login', loginLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const valid = Boolean(user?.isActive) && await verifyPassword(password, user.passwordHash);

  if (!valid) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    throw new HttpError(401, 'Неверный email или пароль', 'LOGIN_FAILED');
  }

  const rawToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + env.sessionDays * 86400000);
  await prisma.$transaction([
    prisma.session.create({
      data: {
        tokenHash: hashToken(rawToken),
        userId: user.id,
        expiresAt,
        ipAddress: String(req.ip || '').slice(0, 80) || null,
        userAgent: String(req.get('user-agent') || '').slice(0, 400) || null,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
  ]);

  res.cookie(SESSION_COOKIE, rawToken, cookieOptions(expiresAt));
  req.user = user;
  await recordActivity({ req, action: 'LOGIN', entityType: 'USER', entityId: user.id, title: `${user.name} вошёл в систему` });
  res.json({ success: true, user: publicUser(user), csrfToken: csrfTokenForSession(rawToken) });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: publicUser(req.user), csrfToken: csrfTokenForSession(req.sessionToken) });
});

router.post('/logout', requireAuth, requireCsrf, asyncRoute(async (req, res) => {
  await recordActivity({ req, action: 'LOGOUT', entityType: 'USER', entityId: req.user.id, title: `${req.user.name} вышел из системы` });
  await prisma.session.delete({ where: { id: req.sessionRecord.id } }).catch(() => {});
  res.clearCookie(SESSION_COOKIE, clearCookieOptions());
  res.json({ success: true });
}));

router.post('/password', requireAuth, requireCsrf, asyncRoute(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (!await verifyPassword(currentPassword, req.user.passwordHash)) throw new HttpError(400, 'Текущий пароль указан неверно', 'PASSWORD_INVALID');
  if (!validPassword(newPassword)) throw new HttpError(400, 'Новый пароль должен содержать 12–128 символов', 'VALIDATION_ERROR');
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId: req.user.id, id: { not: req.sessionRecord.id } } }),
  ]);
  await recordActivity({ req, action: 'SECURITY', entityType: 'USER', entityId: req.user.id, title: `${req.user.name} изменил пароль` });
  res.json({ success: true, message: 'Пароль изменён' });
}));

module.exports = router;
