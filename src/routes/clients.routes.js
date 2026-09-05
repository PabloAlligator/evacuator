const express = require('express');
const prisma = require('../lib/prisma');
const { asyncRoute } = require('../lib/async-route');
const { HttpError } = require('../lib/http-error');
const { recordActivity } = require('../lib/activity');
const { text, positiveId, normalizeSearch, normalizePhone, formatPhone } = require('../lib/validation');
const { clientSearchText } = require('../services/client.service');

const router = express.Router();

router.get('/', asyncRoute(async (req, res) => {
  const search = normalizeSearch(text(req.query.search, 'Поиск', 120));
  const clients = await prisma.client.findMany({
    where: search ? { searchText: { contains: search } } : {},
    include: {
      _count: { select: { orders: true } },
      orders: { where: { status: 'COMPLETED' }, select: { amountCents: true, paidAmountCents: true }, orderBy: { completedAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  const rows = clients.map(({ orders, ...client }) => ({
    ...client,
    totalCents: orders.reduce((sum, order) => sum + (order.amountCents || 0), 0),
    debtCents: orders.reduce((sum, order) => sum + Math.max((order.amountCents || 0) - order.paidAmountCents, 0), 0),
  }));
  res.json({ success: true, clients: rows });
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const client = await prisma.client.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: 'desc' }, take: 100 } },
  });
  if (!client) throw new HttpError(404, 'Клиент не найден', 'NOT_FOUND');
  res.json({ success: true, client });
}));

router.patch('/:id', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Клиент не найден', 'NOT_FOUND');
  const digits = req.body.phone !== undefined ? normalizePhone(req.body.phone) : existing.phoneNormalized;
  const data = {
    name: req.body.name !== undefined ? text(req.body.name, 'Имя', 120) : existing.name,
    phone: formatPhone(digits),
    phoneNormalized: digits,
    defaultVehicle: req.body.defaultVehicle !== undefined ? text(req.body.defaultVehicle, 'Автомобиль', 180) : existing.defaultVehicle,
    notes: req.body.notes !== undefined ? text(req.body.notes, 'Заметка', 2000) : existing.notes,
  };
  data.searchText = clientSearchText(data);
  const client = await prisma.client.update({ where: { id }, data });
  await recordActivity({ req, action: 'UPDATE', entityType: 'CLIENT', entityId: id, title: `Обновлён клиент ${client.name || client.phone}` });
  res.json({ success: true, client });
}));

module.exports = router;
