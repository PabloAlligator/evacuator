const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../src/lib/security');

const ORIGIN = 'http://127.0.0.1:3109';
let server;
let cookie;
let csrfToken;

async function request(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${ORIGIN}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, data };
}

function authHeaders(extra = {}) {
  return { Origin: ORIGIN, Cookie: cookie, 'X-CSRF-Token': csrfToken, ...extra };
}

test.before(async () => {
  await prisma.activity.deleteMany();
  await prisma.session.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.task.deleteMany();
  await prisma.order.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({
    data: {
      name: 'Владелец',
      email: 'owner@evakuator19.test',
      passwordHash: await hashPassword('VeryStrongTestPassword-2026'),
      role: 'OWNER',
    },
  });
  await new Promise((resolve) => { server = app.listen(3109, '127.0.0.1', resolve); });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test('закрытый API возвращает 401 без сессии', async () => {
  const { response, data } = await request('/api/control/dashboard');
  assert.equal(response.status, 401);
  assert.equal(data.code, 'AUTH_REQUIRED');
});

test('вход создаёт защищённую сессию', async () => {
  const { response, data } = await request('/api/control/auth/login', {
    method: 'POST',
    headers: { Origin: ORIGIN },
    body: { email: 'owner@evakuator19.test', password: 'VeryStrongTestPassword-2026' },
  });
  assert.equal(response.status, 200);
  cookie = response.headers.get('set-cookie').split(';')[0];
  csrfToken = data.csrfToken;
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(response.headers.get('set-cookie'), /SameSite=Strict/i);
  assert.ok(csrfToken.length >= 64);
});

test('мутация без CSRF блокируется', async () => {
  const { response, data } = await request('/api/control/tasks', {
    method: 'POST',
    headers: { Origin: ORIGIN, Cookie: cookie },
    body: { title: 'Проверка' },
  });
  assert.equal(response.status, 403);
  assert.equal(data.code, 'CSRF_INVALID');
});

test('чужой Origin блокируется', async () => {
  const { response, data } = await request('/api/control/tasks', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', Cookie: cookie, 'X-CSRF-Token': csrfToken },
    body: { title: 'Проверка' },
  });
  assert.equal(response.status, 403);
  assert.equal(data.code, 'ORIGIN_REJECTED');
});

test('обычный заказ сразу завершён и попадает в выручку', async () => {
  const { response, data } = await request('/api/control/orders', {
    method: 'POST',
    headers: authHeaders(),
    body: {
      type: 'REGULAR',
      phone: '+7 999 123-45-67',
      pickupAddress: 'Абакан, Пушкина, 1',
      destinationAddress: 'Черногорск, Мира, 2',
      amount: 3000,
      paymentStatus: 'PAID',
      paymentMethod: 'TRANSFER',
    },
  });
  assert.equal(response.status, 201);
  assert.equal(data.order.status, 'COMPLETED');

  const range = new URLSearchParams({ ...localDayRange() });
  const dashboard = await request(`/api/control/dashboard?${range}`, { headers: { Cookie: cookie } });
  assert.equal(dashboard.data.stats.orderCount, 1);
  assert.equal(dashboard.data.stats.revenueCents, 300000);
});

test('запланированный заказ не учитывается до завершения', async () => {
  const scheduledAt = new Date(Date.now() + 86400000).toISOString();
  const created = await request('/api/control/orders', {
    method: 'POST',
    headers: authHeaders(),
    body: {
      type: 'SCHEDULED',
      phone: '+7 999 555-44-33',
      pickupAddress: 'Абакан, Кирова, 10',
      destinationAddress: 'Минусинск, Ленина, 5',
      scheduledAt,
      amount: 5000,
      paymentStatus: 'UNPAID',
    },
  });
  assert.equal(created.data.order.status, 'PLANNED');
  const range = new URLSearchParams({ ...localDayRange() });
  let dashboard = await request(`/api/control/dashboard?${range}`, { headers: { Cookie: cookie } });
  assert.equal(dashboard.data.stats.orderCount, 1);

  const completed = await request(`/api/control/orders/${created.data.order.id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: { status: 'COMPLETED' },
  });
  assert.equal(completed.data.order.status, 'COMPLETED');
  dashboard = await request(`/api/control/dashboard?${range}`, { headers: { Cookie: cookie } });
  assert.equal(dashboard.data.stats.orderCount, 2);
  assert.equal(dashboard.data.stats.revenueCents, 800000);
});

test('страница CRM отдаёт строгую CSP и запрещает индексацию', async () => {
  const { response } = await request('/control/app.html', { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
});

function localDayRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
