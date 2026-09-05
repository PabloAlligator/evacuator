const prisma = require('../lib/prisma');
const { HttpError } = require('../lib/http-error');
const {
  text,
  enumValue,
  optionalDate,
  moneyToCents,
  normalizeSearch,
} = require('../lib/validation');
const { upsertClient } = require('./client.service');

const TYPES = new Set(['REGULAR', 'SCHEDULED']);
const STATUSES = new Set(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const PAYMENT_STATUSES = new Set(['UNPAID', 'PARTIAL', 'PAID']);
const PAYMENT_METHODS = new Set(['CASH', 'TRANSFER', 'CARD', 'OTHER']);

function paymentData(body, amountCents) {
  if (amountCents == null) return { paymentStatus: 'UNPAID', paymentMethod: null, paidAmountCents: 0 };
  const paymentStatus = enumValue(body.paymentStatus, PAYMENT_STATUSES, 'Статус оплаты', 'PAID');
  const paymentMethod = body.paymentMethod ? enumValue(body.paymentMethod, PAYMENT_METHODS, 'Способ оплаты') : null;
  let paidAmountCents = moneyToCents(body.paidAmount, 'Оплаченная сумма') ?? 0;
  if (paymentStatus === 'PAID') paidAmountCents = amountCents;
  if (paymentStatus === 'UNPAID') paidAmountCents = 0;
  if (paidAmountCents > amountCents) throw new HttpError(400, 'Оплаченная сумма не может превышать стоимость заказа', 'VALIDATION_ERROR');
  if (paymentStatus === 'PARTIAL' && (paidAmountCents <= 0 || paidAmountCents >= amountCents)) {
    throw new HttpError(400, 'Для частичной оплаты укажите сумму меньше полной стоимости', 'VALIDATION_ERROR');
  }
  return { paymentStatus, paymentMethod, paidAmountCents };
}

function orderSearchText({ client, pickupAddress, destinationAddress, vehicle, source, notes }) {
  return normalizeSearch(
    client?.name,
    client?.phone,
    client?.phoneNormalized,
    pickupAddress,
    destinationAddress,
    vehicle,
    source,
    notes,
  );
}

async function createOrder(body, userId) {
  const type = enumValue(body.type, TYPES, 'Тип заказа', 'REGULAR');
  const pickupAddress = text(body.pickupAddress, 'Откуда забрать', 300, true);
  const destinationAddress = text(body.destinationAddress, 'Куда отвезти', 300, true);
  const clientName = text(body.clientName, 'Имя клиента', 120);
  const vehicle = text(body.vehicle, 'Автомобиль', 180);
  const notes = text(body.notes, 'Комментарий', 2000);
  const source = text(body.source, 'Источник', 80) || 'Другое';
  const amountCents = moneyToCents(body.amount, 'Стоимость');
  const scheduledAt = type === 'SCHEDULED' ? optionalDate(body.scheduledAt, 'Дата и время') : null;
  if (type === 'SCHEDULED' && !scheduledAt) throw new HttpError(400, 'Укажите дату и время запланированного заказа', 'VALIDATION_ERROR');

  return prisma.$transaction(async (tx) => {
    const client = await upsertClient(tx, { phone: body.phone, name: clientName, vehicle });
    const now = new Date();
    const status = type === 'REGULAR' ? 'COMPLETED' : 'PLANNED';
    const payments = paymentData(body, amountCents);
    const order = await tx.order.create({
      data: {
        type,
        status,
        clientId: client.id,
        pickupAddress,
        destinationAddress,
        vehicle,
        amountCents,
        ...payments,
        source,
        notes,
        searchText: orderSearchText({ client, pickupAddress, destinationAddress, vehicle, source, notes }),
        scheduledAt,
        startedAt: type === 'REGULAR' ? now : null,
        completedAt: type === 'REGULAR' ? now : null,
        createdById: userId,
      },
      include: { client: true },
    });
    return order;
  });
}

async function updateOrder(id, body) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { id }, include: { client: true } });
    if (!existing) throw new HttpError(404, 'Заказ не найден', 'NOT_FOUND');

    const type = body.type !== undefined ? enumValue(body.type, TYPES, 'Тип заказа') : existing.type;
    const status = body.status !== undefined ? enumValue(body.status, STATUSES, 'Статус заказа') : existing.status;
    const pickupAddress = body.pickupAddress !== undefined ? text(body.pickupAddress, 'Откуда забрать', 300, true) : existing.pickupAddress;
    const destinationAddress = body.destinationAddress !== undefined ? text(body.destinationAddress, 'Куда отвезти', 300, true) : existing.destinationAddress;
    const clientName = body.clientName !== undefined ? text(body.clientName, 'Имя клиента', 120) : existing.client.name;
    const vehicle = body.vehicle !== undefined ? text(body.vehicle, 'Автомобиль', 180) : existing.vehicle;
    const notes = body.notes !== undefined ? text(body.notes, 'Комментарий', 2000) : existing.notes;
    const source = body.source !== undefined ? text(body.source, 'Источник', 80, true) : existing.source;
    const amountCents = body.amount !== undefined ? moneyToCents(body.amount, 'Стоимость') : existing.amountCents;
    const scheduledAt = type === 'SCHEDULED'
      ? body.scheduledAt !== undefined ? optionalDate(body.scheduledAt, 'Дата и время') : existing.scheduledAt
      : null;
    if (type === 'SCHEDULED' && !scheduledAt) throw new HttpError(400, 'Укажите дату и время запланированного заказа', 'VALIDATION_ERROR');

    const client = body.phone !== undefined || body.clientName !== undefined || body.vehicle !== undefined
      ? await upsertClient(tx, { phone: body.phone || existing.client.phone, name: clientName, vehicle })
      : existing.client;
    const payments = body.amount !== undefined || body.paymentStatus !== undefined || body.paymentMethod !== undefined || body.paidAmount !== undefined
      ? paymentData({
          paymentStatus: body.paymentStatus ?? existing.paymentStatus,
          paymentMethod: body.paymentMethod ?? existing.paymentMethod,
          paidAmount: body.paidAmount ?? existing.paidAmountCents / 100,
        }, amountCents)
      : {
          paymentStatus: existing.paymentStatus,
          paymentMethod: existing.paymentMethod,
          paidAmountCents: existing.paidAmountCents,
        };

    const now = new Date();
    return tx.order.update({
      where: { id },
      data: {
        type,
        status,
        clientId: client.id,
        pickupAddress,
        destinationAddress,
        vehicle,
        amountCents,
        ...payments,
        source,
        notes,
        scheduledAt,
        startedAt: status === 'IN_PROGRESS' && !existing.startedAt ? now : existing.startedAt,
        completedAt: status === 'COMPLETED' ? existing.completedAt || now : null,
        cancelledAt: status === 'CANCELLED' ? existing.cancelledAt || now : null,
        searchText: orderSearchText({ client, pickupAddress, destinationAddress, vehicle, source, notes }),
      },
      include: { client: true },
    });
  });
}

module.exports = { createOrder, updateOrder, orderSearchText, STATUSES, TYPES };
