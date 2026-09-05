const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const prisma = require('./src/lib/prisma');
const { env, validateEnv } = require('./src/config/env');
const { loadSession } = require('./src/middleware/auth');
const { verifyOrigin } = require('./src/middleware/origin');
const { apiLimiter } = require('./src/middleware/rate-limits');
const { notFound, errorHandler } = require('./src/middleware/error-handler');
const controlRoutes = require('./src/routes/control.routes');

validateEnv();

const app = express();
const root = __dirname;

app.disable('x-powered-by');
app.set('trust proxy', env.trustProxy);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(express.json({ limit: '100kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 80 }));
app.use(cookieParser());
app.use(loadSession);

app.use('/api/control', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  });
  next();
}, verifyOrigin, apiLimiter, controlRoutes);

const controlCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "manifest-src 'self'",
].join('; ');

app.use('/control', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Content-Security-Policy': controlCsp,
  });
  next();
});

app.use('/control/vendor/tabler', express.static(path.join(root, 'node_modules', '@tabler', 'icons-webfont', 'dist'), {
  dotfiles: 'deny',
  index: false,
  maxAge: env.isProduction ? '7d' : 0,
}));
app.use('/control/assets', express.static(path.join(root, 'control', 'assets'), {
  dotfiles: 'deny',
  index: false,
  maxAge: env.isProduction ? '1h' : 0,
}));
app.get('/control/manifest.webmanifest', (req, res) => res.sendFile(path.join(root, 'control', 'manifest.webmanifest')));
app.get(['/control', '/control/'], (req, res) => res.redirect(req.user ? '/control/app.html' : '/control/login.html'));
app.get('/control/login.html', (req, res) => {
  if (req.user) return res.redirect('/control/app.html');
  return res.sendFile(path.join(root, 'control', 'login.html'));
});
app.get('/control/app.html', (req, res) => {
  if (!req.user) return res.redirect('/control/login.html');
  return res.sendFile(path.join(root, 'control', 'app.html'));
});

const publicCsp = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' https://cdn.jsdelivr.net",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join('; ');

const publicStatic = {
  dotfiles: 'deny',
  index: false,
  maxAge: env.isProduction ? '1h' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  },
};

app.use((req, res, next) => {
  if (!req.path.startsWith('/control') && !req.path.startsWith('/api/')) res.setHeader('Content-Security-Policy', publicCsp);
  next();
});
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(root, 'index.html')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(root, 'robots.txt')));
app.get('/sitemap.xml', (req, res) => res.sendFile(path.join(root, 'sitemap.xml')));
app.use('/site', express.static(path.join(root, 'site'), publicStatic));

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, status: 'ok' });
  } catch {
    res.status(503).json({ success: false, status: 'database_unavailable' });
  }
});

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`Evakuator19 запущен на порту ${env.port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal}: корректная остановка`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
