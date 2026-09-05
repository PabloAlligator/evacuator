const { Prisma } = require('@prisma/client');

function notFound(req, res) {
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Маршрут не найден' });
  return res.status(404).type('text').send('Страница не найдена');
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = Number(error.status) || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message || 'Внутренняя ошибка сервера';

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      status = 409;
      code = 'CONFLICT';
      message = 'Такая запись уже существует';
    } else if (error.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'Запись не найдена';
    }
  }

  if (status >= 500) {
    console.error('Внутренняя ошибка:', error);
    message = 'Внутренняя ошибка сервера';
    code = 'INTERNAL_ERROR';
  }

  return res.status(status).json({ success: false, code, message });
}

module.exports = { notFound, errorHandler };
