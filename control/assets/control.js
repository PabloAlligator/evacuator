'use strict';

const state = {
  user: null,
  csrfToken: '',
  orderView: localStorage.getItem('ev19-order-view') === 'board' ? 'board' : 'list',
  taskView: localStorage.getItem('ev19-task-view') === 'board' ? 'board' : 'list',
  orderFilters: { search: '', status: '', type: '' },
};

const app = document.querySelector('#app');
const appShell = document.querySelector('.app-shell');
const modalRoot = document.querySelector('#modal-root');
const toastRoot = document.querySelector('#toast-root');
let modalReturnFocus = null;

const labels = {
  orderStatus: {
    PLANNED: 'Запланирован',
    IN_PROGRESS: 'В работе',
    COMPLETED: 'Выполнен',
    CANCELLED: 'Отменён',
  },
  orderType: { REGULAR: 'Обычный', SCHEDULED: 'Запланированный' },
  paymentStatus: { UNPAID: 'Не оплачен', PARTIAL: 'Частично', PAID: 'Оплачен' },
  paymentMethod: { CASH: 'Наличные', TRANSFER: 'Перевод', CARD: 'Карта', OTHER: 'Другое' },
  taskStatus: { TODO: 'Нужно сделать', IN_PROGRESS: 'В процессе', DONE: 'Выполнено' },
  taskPriority: { LOW: 'Низкий', MEDIUM: 'Обычный', HIGH: 'Высокий' },
  expenseCategory: {
    FUEL: 'Топливо', REPAIR: 'Ремонт', ADVERTISING: 'Реклама', WASH: 'Мойка',
    SERVICE: 'Обслуживание', TAX: 'Налоги', OTHER: 'Прочее',
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function attr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function money(cents) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

function shortDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function dateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function time(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function datetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function localDayRange(date = new Date()) {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function monthRange() {
  const from = new Date();
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setMonth(to.getMonth() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function isoRangeQuery(range) {
  return new URLSearchParams({ from: range.from, to: range.to }).toString();
}

async function api(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-CSRF-Token'] = state.csrfToken;
  const response = await fetch(`/api/control${path}`, {
    ...options,
    method,
    headers,
    credentials: 'same-origin',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.replace('/control/login.html');
    throw new Error('Сессия завершена');
  }
  if (!response.ok) throw new Error(data.message || 'Не удалось выполнить запрос');
  return data;
}

function toast(message, type = 'success') {
  const element = document.createElement('div');
  element.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  element.textContent = message;
  toastRoot.append(element);
  window.setTimeout(() => element.remove(), 3600);
}

function badge(textValue, color = '') {
  return `<span class="badge${color ? ` badge--${color}` : ''}">${escapeHtml(textValue)}</span>`;
}

function statusBadge(status) {
  const colors = { PLANNED: 'blue', IN_PROGRESS: 'orange', COMPLETED: 'green', CANCELLED: 'red' };
  return badge(labels.orderStatus[status] || status, colors[status]);
}

function emptyState(icon, textValue) {
  return `<div class="empty-state"><div><i class="ti ti-${icon}"></i><span>${escapeHtml(textValue)}</span></div></div>`;
}

function pageHeader(title, subtitle, actions = '') {
  return `<header class="page-header"><div><span class="eyebrow">Эвакуатор 19</span><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div><div class="page-header__actions">${actions}</div></header>`;
}

function setActiveNav(route) {
  document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('is-active', link.dataset.route === route));
}

function openModal(title, body, footer = '', wide = false) {
  if (!modalRoot.firstElementChild) {
    modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal${wide ? ' modal--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header class="modal__header"><h2 id="modal-title">${escapeHtml(title)}</h2><button class="icon-button modal__close" type="button" data-close-modal aria-label="Закрыть окно"><i class="ti ti-x" aria-hidden="true"></i></button></header><div class="modal__body">${body}</div>${footer ? `<footer class="modal__footer">${footer}</footer>` : ''}</section></div>`;
  document.body.classList.add('is-modal-open');
  appShell?.setAttribute('inert', '');
  const modal = modalRoot.querySelector('.modal');
  const initialFocus = modal?.querySelector('input:not([type="hidden"]), select, textarea, button:not([data-close-modal])') || modal;
  initialFocus?.focus({ preventScroll: true });
}

function closeModal() {
  if (!modalRoot.firstElementChild) return;
  modalRoot.innerHTML = '';
  document.body.classList.remove('is-modal-open');
  appShell?.removeAttribute('inert');
  const returnFocus = modalReturnFocus;
  modalReturnFocus = null;
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

function modalFocusableElements() {
  return [...modalRoot.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

function formError(form, message) {
  const error = form.querySelector('.form-error');
  if (error) {
    error.textContent = message;
    error.hidden = false;
  } else {
    toast(message, 'error');
  }
}

function formValues(form) {
  return Object.fromEntries(new FormData(form));
}

function orderRow(order) {
  const mainDate = order.type === 'SCHEDULED' && order.status === 'PLANNED' ? order.scheduledAt : order.completedAt || order.createdAt;
  return `<article class="order-row" data-order-id="${order.id}" tabindex="0" role="button" aria-label="Открыть заказ №${order.id}">
    <span class="order-row__time">${escapeHtml(time(mainDate))}</span>
    <span class="order-row__route"><b>${escapeHtml(order.pickupAddress)} → ${escapeHtml(order.destinationAddress)}</b><small>${escapeHtml(order.vehicle || 'Автомобиль не указан')}</small></span>
    <span class="order-row__client"><b>${escapeHtml(order.client.name || order.client.phone)}</b><small>${escapeHtml(order.client.phone)}</small></span>
    ${statusBadge(order.status)}
    <strong class="order-row__amount">${order.amountCents == null ? '—' : money(order.amountCents)}</strong>
  </article>`;
}

async function renderDashboard() {
  const range = localDayRange();
  const data = await api(`/dashboard?${isoRangeQuery(range)}`);
  const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  app.innerHTML = `<div class="page">
    ${pageHeader('Сегодня', weekday, '<button class="button button--primary" data-action="new-order"><i class="ti ti-plus"></i><span class="mobile-hide">Новый заказ</span></button>')}
    <section class="metric-strip">
      <div class="metric metric--accent"><span>Выручка сегодня</span><strong>${money(data.stats.revenueCents)}</strong><small>Оплачено ${money(data.stats.paidCents)}</small></div>
      <div class="metric"><span>Заказов</span><strong>${data.stats.orderCount}</strong><small>Средний чек ${money(data.stats.averageCheckCents)}</small></div>
      <div class="metric"><span>Расходы</span><strong>${money(data.stats.expenseCents)}</strong><small>За сегодняшний день</small></div>
      <div class="metric"><span>Прибыль</span><strong>${money(data.stats.profitCents)}</strong><small>${data.stats.debtCents ? `Долг ${money(data.stats.debtCents)}` : 'Долгов нет'}</small></div>
    </section>
    <div class="dashboard-grid">
      <section class="panel"><header class="panel__header"><div><h2>Сегодняшние заказы</h2><p>Последние действия за день</p></div><a class="text-link" href="#/orders">Все заказы</a></header><div class="order-list">${data.recentOrders.length ? data.recentOrders.map(orderRow).join('') : emptyState('clipboard', 'Сегодня заказов пока нет')}</div></section>
      <div class="stack">
        <section class="panel"><header class="panel__header"><div><h3>Ближайшие</h3><p>Запланированные поездки</p></div></header><div class="order-list">${data.planned.length ? data.planned.map((order) => `<article class="order-card" data-order-id="${order.id}"><b>${escapeHtml(dateTime(order.scheduledAt))}</b><p>${escapeHtml(order.pickupAddress)} → ${escapeHtml(order.destinationAddress)}</p><div class="order-card__foot"><span>${escapeHtml(order.client.phone)}</span><strong>${order.amountCents == null ? '—' : money(order.amountCents)}</strong></div></article>`).join('') : emptyState('calendar', 'Нет запланированных заказов')}</div></section>
        <section class="panel"><header class="panel__header"><div><h3>Задачи</h3><p>Что нельзя забыть</p></div><a class="text-link" href="#/tasks">Открыть</a></header><div class="task-list">${data.activeTasks.length ? data.activeTasks.map((task) => `<article class="task-row"><input class="task-row__check" type="checkbox" data-task-done="${task.id}" aria-label="Выполнить задачу"><span class="task-row__content"><b>${escapeHtml(task.title)}</b><small>${task.dueAt ? dateTime(task.dueAt) : 'Без срока'}</small></span>${badge(labels.taskPriority[task.priority], task.priority === 'HIGH' ? 'orange' : '')}<span></span><button class="icon-button" data-task-id="${task.id}" aria-label="Открыть"><i class="ti ti-chevron-right"></i></button></article>`).join('') : emptyState('circle-check', 'Активных задач нет')}</div></section>
      </div>
    </div>
  </div>`;
}

function orderFiltersMarkup() {
  return `<section class="filters">
    <input class="input" id="order-search" type="search" maxlength="120" placeholder="Телефон, адрес, автомобиль" value="${attr(state.orderFilters.search)}">
    <select class="select" id="order-status"><option value="">Все статусы</option>${Object.entries(labels.orderStatus).map(([value, label]) => `<option value="${value}"${state.orderFilters.status === value ? ' selected' : ''}>${label}</option>`).join('')}</select>
    <select class="select" id="order-type"><option value="">Все типы</option>${Object.entries(labels.orderType).map(([value, label]) => `<option value="${value}"${state.orderFilters.type === value ? ' selected' : ''}>${label}</option>`).join('')}</select>
    <div class="view-toggle" aria-label="Вид заказов"><button type="button" data-order-view="list" class="${state.orderView === 'list' ? 'is-active' : ''}" aria-label="Показать списком" aria-pressed="${state.orderView === 'list'}"><i class="ti ti-list" aria-hidden="true"></i></button><button type="button" data-order-view="board" class="${state.orderView === 'board' ? 'is-active' : ''}" aria-label="Показать доской" aria-pressed="${state.orderView === 'board'}"><i class="ti ti-layout-kanban" aria-hidden="true"></i></button></div>
  </section>`;
}

function orderBoard(orders) {
  const columns = [
    ['PLANNED', 'Запланированы'], ['IN_PROGRESS', 'В работе'], ['COMPLETED', 'Выполнены'], ['CANCELLED', 'Отменены'],
  ];
  return `<section class="board">${columns.map(([status, title]) => {
    const rows = orders.filter((order) => order.status === status);
    return `<div class="board-column"><header class="board-column__head"><h3>${title}</h3><span>${rows.length}</span></header><div class="board-column__body">${rows.length ? rows.map((order) => `<article class="order-card" data-order-id="${order.id}" tabindex="0" role="button" aria-label="Открыть заказ №${order.id}"><b>Заказ №${order.id}</b><p>${escapeHtml(order.pickupAddress)} → ${escapeHtml(order.destinationAddress)}</p><div class="order-card__foot"><span>${escapeHtml(order.client.phone)}</span><strong>${order.amountCents == null ? '—' : money(order.amountCents)}</strong></div></article>`).join('') : '<div class="empty-state">Пусто</div>'}</div></div>`;
  }).join('')}</section>`;
}

async function renderOrders() {
  app.innerHTML = `<div class="page">${pageHeader('Заказы', 'Все поездки в одном журнале', '<button class="button button--primary" data-action="new-order"><i class="ti ti-plus"></i><span class="mobile-hide">Новый заказ</span></button>')}${orderFiltersMarkup()}<section id="orders-content" class="panel">${emptyState('loader-2', 'Загружаем заказы')}</section></div>`;
  await loadOrders();
  let timer;
  document.querySelector('#order-search')?.addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.orderFilters.search = event.target.value; loadOrders(); }, 250);
  });
  document.querySelector('#order-status')?.addEventListener('change', (event) => { state.orderFilters.status = event.target.value; loadOrders(); });
  document.querySelector('#order-type')?.addEventListener('change', (event) => { state.orderFilters.type = event.target.value; loadOrders(); });
}

async function loadOrders() {
  const query = new URLSearchParams({ limit: '100' });
  Object.entries(state.orderFilters).forEach(([key, value]) => { if (value) query.set(key, value); });
  const data = await api(`/orders?${query}`);
  const content = document.querySelector('#orders-content');
  if (!content) return;
  content.classList.toggle('panel', state.orderView === 'list');
  content.innerHTML = data.orders.length
    ? state.orderView === 'board' ? orderBoard(data.orders) : `<div class="order-list">${data.orders.map(orderRow).join('')}</div>`
    : emptyState('clipboard-off', 'Заказы не найдены');
}

function sourceOptions(selected = 'Другое') {
  return ['Сайт', 'Яндекс', '2ГИС', 'Рекомендация', 'Постоянный клиент', 'Социальные сети', 'Другое']
    .map((source) => `<option value="${attr(source)}"${source === selected ? ' selected' : ''}>${escapeHtml(source)}</option>`).join('');
}

function orderFormMarkup(order = null) {
  const isScheduled = order?.type === 'SCHEDULED';
  const amount = order?.amountCents == null ? '' : order.amountCents / 100;
  const paidAmount = order?.paidAmountCents ? order.paidAmountCents / 100 : '';
  return `<form id="order-form" class="form-grid" novalidate data-order-id="${order?.id || ''}">
    <div class="segmented field--wide" role="group" aria-label="Тип заказа">
      <button type="button" data-order-type-choice="REGULAR" class="${isScheduled ? '' : 'is-active'}">Обычный</button>
      <button type="button" data-order-type-choice="SCHEDULED" class="${isScheduled ? 'is-active' : ''}">Запланированный</button>
    </div>
    <input type="hidden" name="type" value="${isScheduled ? 'SCHEDULED' : 'REGULAR'}">
    <p class="form-hint field--wide" id="order-type-hint">${isScheduled ? 'Выберите дату и время поездки' : 'Заказ сохранится выполненным, текущие дата и время установятся автоматически'}</p>
    <label class="field field--wide" id="scheduled-field"${isScheduled ? '' : ' hidden'}><span>Дата и время *</span><input class="input" name="scheduledAt" type="datetime-local" value="${attr(datetimeLocal(order?.scheduledAt))}"></label>
    <div class="route-fields">
      <div class="route-input"><i class="ti ti-map-pin-filled"></i><label><span>Откуда *</span><input name="pickupAddress" required maxlength="300" value="${attr(order?.pickupAddress || '')}" placeholder="Адрес подачи"></label></div>
      <div class="route-input"><i class="ti ti-flag-filled"></i><label><span>Куда *</span><input name="destinationAddress" required maxlength="300" value="${attr(order?.destinationAddress || '')}" placeholder="Адрес назначения"></label></div>
    </div>
    <label class="field"><span>Телефон *</span><span class="input-wrap"><i class="ti ti-phone"></i><input name="phone" type="tel" required maxlength="30" value="${attr(order?.client.phone || '')}" placeholder="+7 999 000-00-00"></span></label>
    <label class="field"><span>Имя клиента</span><input class="input" name="clientName" maxlength="120" value="${attr(order?.client.name || '')}" placeholder="Необязательно"></label>
    <label class="field field--wide"><span>Автомобиль</span><span class="input-wrap"><i class="ti ti-car"></i><input name="vehicle" maxlength="180" value="${attr(order?.vehicle || '')}" placeholder="Марка, модель, номер"></span></label>
    <label class="field"><span>Стоимость, ₽</span><input class="input" name="amount" type="number" min="0" max="100000000" step="1" value="${amount}" placeholder="Можно указать позже"></label>
    <label class="field"><span>Статус оплаты</span><select class="select" name="paymentStatus"><option value="PAID"${order?.paymentStatus === 'PAID' || !order ? ' selected' : ''}>Оплачен</option><option value="UNPAID"${order?.paymentStatus === 'UNPAID' ? ' selected' : ''}>Не оплачен</option><option value="PARTIAL"${order?.paymentStatus === 'PARTIAL' ? ' selected' : ''}>Частично</option></select></label>
    <label class="field"><span>Способ оплаты</span><select class="select" name="paymentMethod"><option value="">Не указан</option>${Object.entries(labels.paymentMethod).map(([value, label]) => `<option value="${value}"${order?.paymentMethod === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
    <label class="field"><span>Оплачено, ₽</span><input class="input" name="paidAmount" type="number" min="0" step="1" value="${paidAmount}" placeholder="Для частичной оплаты"></label>
    <label class="field"><span>Источник</span><select class="select" name="source">${sourceOptions(order?.source)}</select></label>
    <label class="field field--wide"><span>Комментарий</span><textarea class="textarea" name="notes" maxlength="2000" placeholder="Детали поездки">${escapeHtml(order?.notes || '')}</textarea></label>
    <div class="form-error field--wide" hidden></div>
  </form>`;
}

function bindOrderTypeToggle() {
  document.querySelectorAll('[data-order-type-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const form = document.querySelector('#order-form');
      const type = button.dataset.orderTypeChoice;
      form.elements.type.value = type;
      document.querySelectorAll('[data-order-type-choice]').forEach((item) => item.classList.toggle('is-active', item === button));
      const scheduled = document.querySelector('#scheduled-field');
      scheduled.hidden = type !== 'SCHEDULED';
      scheduled.querySelector('input').required = type === 'SCHEDULED';
      if (!form.dataset.orderId) form.elements.paymentStatus.value = type === 'SCHEDULED' ? 'UNPAID' : 'PAID';
      document.querySelector('#order-type-hint').textContent = type === 'SCHEDULED'
        ? 'Выберите дату и время поездки'
        : 'Заказ сохранится выполненным, текущие дата и время установятся автоматически';
    });
  });
}

function openOrderForm(order = null) {
  openModal(order ? `Заказ №${order.id}` : 'Новый заказ', orderFormMarkup(order), `<button class="button" type="button" data-close-modal>Отмена</button><button class="button button--primary" type="submit" form="order-form">${order ? 'Сохранить' : 'Создать заказ'}</button>`, true);
  bindOrderTypeToggle();
  document.querySelector('#order-form').addEventListener('submit', submitOrderForm);
}

async function submitOrderForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.querySelector('[form="order-form"]');
  button.disabled = true;
  try {
    const body = formValues(form);
    if (body.scheduledAt) body.scheduledAt = new Date(body.scheduledAt).toISOString();
    const id = form.dataset.orderId;
    await api(id ? `/orders/${id}` : '/orders', { method: id ? 'PATCH' : 'POST', body });
    closeModal();
    toast(id ? 'Заказ сохранён' : 'Заказ создан');
    await renderCurrentRoute();
  } catch (error) {
    formError(form, error.message);
  } finally {
    button.disabled = false;
  }
}

async function showOrder(id) {
  const { order } = await api(`/orders/${id}`);
  const debt = Math.max((order.amountCents || 0) - order.paidAmountCents, 0);
  openModal(`Заказ №${order.id}`, `<div class="detail-grid">
    <div class="detail-item"><span>Статус</span><strong>${statusBadge(order.status)}</strong></div>
    <div class="detail-item"><span>Тип</span><strong>${escapeHtml(labels.orderType[order.type])}</strong></div>
    <div class="detail-item"><span>Клиент</span><strong>${escapeHtml(order.client.name || 'Имя не указано')}</strong></div>
    <div class="detail-item"><span>Телефон</span><strong><a href="tel:${attr(order.client.phoneNormalized)}">${escapeHtml(order.client.phone)}</a></strong></div>
    <div class="detail-item detail-item--wide"><span>Маршрут</span><strong>${escapeHtml(order.pickupAddress)} → ${escapeHtml(order.destinationAddress)}</strong></div>
    <div class="detail-item"><span>Автомобиль</span><strong>${escapeHtml(order.vehicle || '—')}</strong></div>
    <div class="detail-item"><span>Дата</span><strong>${escapeHtml(dateTime(order.scheduledAt || order.completedAt || order.createdAt))}</strong></div>
    <div class="detail-item"><span>Стоимость</span><strong>${order.amountCents == null ? 'Не указана' : money(order.amountCents)}</strong></div>
    <div class="detail-item"><span>Оплата</span><strong>${escapeHtml(labels.paymentStatus[order.paymentStatus])}${debt ? ` · долг ${money(debt)}` : ''}</strong></div>
    <div class="detail-item"><span>Источник</span><strong>${escapeHtml(order.source)}</strong></div>
    <div class="detail-item detail-item--wide"><span>Комментарий</span><strong>${escapeHtml(order.notes || '—')}</strong></div>
  </div>
  <div class="modal-actions">
    ${order.status === 'PLANNED' ? `<button class="button button--primary" data-order-status="IN_PROGRESS" data-order-id="${order.id}"><i class="ti ti-route"></i> Начать</button>` : ''}
    ${order.status === 'IN_PROGRESS' ? `<button class="button button--primary" data-order-status="COMPLETED" data-order-id="${order.id}"><i class="ti ti-check"></i> Завершить</button>` : ''}
    ${!['COMPLETED', 'CANCELLED'].includes(order.status) ? `<button class="button button--danger" data-order-status="CANCELLED" data-order-id="${order.id}">Отменить</button>` : ''}
    <button class="button" data-edit-order="${order.id}"><i class="ti ti-edit"></i> Редактировать</button>
    <button class="button button--danger" data-delete-order="${order.id}"><i class="ti ti-trash"></i> Удалить</button>
  </div>`, '<button class="button" type="button" data-close-modal>Закрыть</button>', true);
}

async function renderClients() {
  const { clients } = await api('/clients');
  app.innerHTML = `<div class="page">${pageHeader('Клиенты', 'История обращений и задолженности')}<section class="filters"><input class="input" id="client-search" type="search" maxlength="120" placeholder="Имя, телефон или автомобиль"></section><section id="clients-content" class="panel"><div class="client-list">${clients.length ? clients.map(clientRow).join('') : emptyState('users', 'Клиенты появятся после первого заказа')}</div></section></div>`;
  let timer;
  document.querySelector('#client-search').addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const data = await api(`/clients?search=${encodeURIComponent(event.target.value)}`);
      document.querySelector('#clients-content').innerHTML = `<div class="client-list">${data.clients.length ? data.clients.map(clientRow).join('') : emptyState('user-off', 'Клиенты не найдены')}</div>`;
    }, 250);
  });
}

function clientRow(client) {
  return `<article class="client-row" data-client-id="${client.id}" tabindex="0" role="button" aria-label="Открыть клиента ${attr(client.name || client.phone)}"><span class="client-row__identity"><b>${escapeHtml(client.name || 'Без имени')}</b><small>${escapeHtml(client.phone)}</small></span><span>${escapeHtml(client.defaultVehicle || '—')}</span><span>${client._count.orders} заказов</span><strong class="client-row__money">${money(client.totalCents)}</strong><strong class="client-row__debt">${client.debtCents ? money(client.debtCents) : '—'}</strong></article>`;
}

async function showClient(id) {
  const { client } = await api(`/clients/${id}`);
  openModal(client.name || client.phone, `<form id="client-form" class="form-grid" data-client-id="${client.id}">
    <label class="field"><span>Имя</span><input class="input" name="name" maxlength="120" value="${attr(client.name || '')}"></label>
    <label class="field"><span>Телефон</span><input class="input" name="phone" type="tel" required value="${attr(client.phone)}"></label>
    <label class="field field--wide"><span>Автомобиль</span><input class="input" name="defaultVehicle" maxlength="180" value="${attr(client.defaultVehicle || '')}"></label>
    <label class="field field--wide"><span>Заметка</span><textarea class="textarea" name="notes" maxlength="2000">${escapeHtml(client.notes || '')}</textarea></label>
    <div class="form-error field--wide" hidden></div>
  </form>
  <section class="panel"><header class="panel__header"><h3>История заказов</h3></header><div class="order-list">${client.orders.length ? client.orders.map((order) => `<article class="order-row" data-order-id="${order.id}" tabindex="0" role="button" aria-label="Открыть заказ №${order.id}"><span class="order-row__time">${shortDate(order.createdAt)}</span><span class="order-row__route"><b>${escapeHtml(order.pickupAddress)} → ${escapeHtml(order.destinationAddress)}</b><small>${escapeHtml(order.vehicle || '')}</small></span><span></span>${statusBadge(order.status)}<strong class="order-row__amount">${order.amountCents == null ? '—' : money(order.amountCents)}</strong></article>`).join('') : emptyState('clipboard', 'Заказов нет')}</div></section>`, '<button class="button" type="button" data-close-modal>Отмена</button><button class="button button--primary" type="submit" form="client-form">Сохранить</button>', true);
  document.querySelector('#client-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api(`/clients/${client.id}`, { method: 'PATCH', body: formValues(event.currentTarget) });
      closeModal();
      toast('Клиент сохранён');
      await renderClients();
    } catch (error) { formError(event.currentTarget, error.message); }
  });
}

async function renderTasks() {
  const { tasks } = await api('/tasks');
  const taskList = `<section class="panel"><div class="task-list">${tasks.length ? tasks.map((task) => `<article class="task-row${task.status === 'DONE' ? ' is-done' : ''}"><input class="task-row__check" type="checkbox" data-task-done="${task.id}" aria-label="${task.status === 'DONE' ? 'Вернуть задачу в работу' : 'Отметить задачу выполненной'}"${task.status === 'DONE' ? ' checked' : ''}><span class="task-row__content"><b>${escapeHtml(task.title)}</b><small>${escapeHtml(task.description || '')}</small></span>${badge(labels.taskPriority[task.priority], task.priority === 'HIGH' ? 'orange' : '')}<span>${task.dueAt ? dateTime(task.dueAt) : 'Без срока'}</span><button class="icon-button icon-button--danger" type="button" data-delete-task="${task.id}" aria-label="Удалить задачу"><i class="ti ti-trash" aria-hidden="true"></i></button></article>`).join('') : emptyState('circle-check', 'Задач пока нет')}</div></section>`;
  const columns = [['TODO', 'Нужно сделать'], ['IN_PROGRESS', 'В процессе'], ['DONE', 'Выполнено']];
  const taskBoard = `<section class="board board--tasks">${columns.map(([status, title]) => {
    const rows = tasks.filter((task) => task.status === status);
    return `<div class="board-column"><header class="board-column__head"><h3>${title}</h3><span>${rows.length}</span></header><div class="board-column__body">${rows.length ? rows.map((task) => `<article class="order-card"><b>${escapeHtml(task.title)}</b><p>${escapeHtml(task.description || (task.dueAt ? `Срок: ${dateTime(task.dueAt)}` : 'Без срока'))}</p><div class="order-card__foot">${badge(labels.taskPriority[task.priority], task.priority === 'HIGH' ? 'orange' : '')}<span>${status !== 'DONE' ? `<button class="text-link" data-task-status="${status === 'TODO' ? 'IN_PROGRESS' : 'DONE'}" data-task-id="${task.id}">${status === 'TODO' ? 'Начать' : 'Завершить'}</button>` : `<button class="text-link" data-task-status="TODO" data-task-id="${task.id}">Вернуть</button>`}</span></div></article>`).join('') : '<div class="empty-state">Пусто</div>'}</div></div>`;
  }).join('')}</section>`;
  const actions = `<div class="view-toggle" aria-label="Вид задач"><button type="button" data-task-view="list" class="${state.taskView === 'list' ? 'is-active' : ''}" aria-label="Показать списком" aria-pressed="${state.taskView === 'list'}"><i class="ti ti-list" aria-hidden="true"></i></button><button type="button" data-task-view="board" class="${state.taskView === 'board' ? 'is-active' : ''}" aria-label="Показать доской" aria-pressed="${state.taskView === 'board'}"><i class="ti ti-layout-kanban" aria-hidden="true"></i></button></div><button class="button button--primary" type="button" data-action="new-task"><i class="ti ti-plus" aria-hidden="true"></i><span class="mobile-hide">Новая задача</span></button>`;
  app.innerHTML = `<div class="page">${pageHeader('Задачи', 'Личные дела, звонки и обслуживание', actions)}<div id="tasks-content">${state.taskView === 'board' ? taskBoard : taskList}</div></div>`;
}

function openTaskForm() {
  openModal('Новая задача', `<form id="task-form" class="form-grid"><label class="field field--wide"><span>Название *</span><input class="input" name="title" required maxlength="240" placeholder="Что нужно сделать"></label><label class="field"><span>Приоритет</span><select class="select" name="priority"><option value="LOW">Низкий</option><option value="MEDIUM" selected>Обычный</option><option value="HIGH">Высокий</option></select></label><label class="field"><span>Срок</span><input class="input" name="dueAt" type="datetime-local"></label><label class="field field--wide"><span>Описание</span><textarea class="textarea" name="description" maxlength="2000"></textarea></label><div class="form-error field--wide" hidden></div></form>`, '<button class="button" type="button" data-close-modal>Отмена</button><button class="button button--primary" type="submit" form="task-form">Создать</button>');
  document.querySelector('#task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formValues(event.currentTarget);
    if (body.dueAt) body.dueAt = new Date(body.dueAt).toISOString();
    try {
      await api('/tasks', { method: 'POST', body });
      closeModal();
      toast('Задача создана');
      await renderTasks();
    } catch (error) { formError(event.currentTarget, error.message); }
  });
}

async function renderFinances() {
  const range = monthRange();
  const query = isoRangeQuery(range);
  const [summary, expenseData] = await Promise.all([api(`/finances/summary?${query}`), api(`/finances/expenses?${query}`)]);
  app.innerHTML = `<div class="page">${pageHeader('Финансы', 'Доходы и расходы за текущий месяц', '<button class="button button--primary" data-action="new-expense"><i class="ti ti-plus"></i><span class="mobile-hide">Добавить расход</span></button>')}
    <section class="finance-grid"><article class="finance-card finance-card--accent"><span>Выручка</span><strong>${money(summary.stats.revenueCents)}</strong></article><article class="finance-card"><span>Оплачено</span><strong>${money(summary.stats.paidCents)}</strong></article><article class="finance-card finance-card--danger"><span>Расходы</span><strong>${money(summary.stats.expenseCents)}</strong></article><article class="finance-card"><span>Прибыль</span><strong>${money(summary.stats.profitCents)}</strong></article></section>
    <section class="panel"><header class="panel__header"><div><h2>Расходы</h2><p>${summary.stats.orderCount} заказов · средний чек ${money(summary.stats.averageCheckCents)} · долг ${money(summary.stats.debtCents)}</p></div><button class="text-link" type="button" data-action="export-csv">Выгрузить CSV</button></header><div class="expense-list">${expenseData.expenses.length ? expenseData.expenses.map((expense) => `<article class="expense-row"><span>${shortDate(expense.occurredAt)}</span><span>${escapeHtml(labels.expenseCategory[expense.category])}<small>${escapeHtml(expense.note || '')}</small></span><strong>${money(expense.amountCents)}</strong><button class="icon-button icon-button--danger" type="button" data-delete-expense="${expense.id}" aria-label="Удалить расход"><i class="ti ti-trash" aria-hidden="true"></i></button></article>`).join('') : emptyState('receipt', 'Расходов за месяц нет')}</div></section>
  </div>`;
}

function openExpenseForm() {
  const now = datetimeLocal(new Date());
  openModal('Новый расход', `<form id="expense-form" class="form-grid"><label class="field"><span>Сумма, ₽ *</span><input class="input" name="amount" type="number" min="0.01" step="0.01" required></label><label class="field"><span>Категория</span><select class="select" name="category">${Object.entries(labels.expenseCategory).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><label class="field field--wide"><span>Дата и время</span><input class="input" name="occurredAt" type="datetime-local" value="${now}"></label><label class="field field--wide"><span>Комментарий</span><textarea class="textarea" name="note" maxlength="1000"></textarea></label><div class="form-error field--wide" hidden></div></form>`, '<button class="button" type="button" data-close-modal>Отмена</button><button class="button button--primary" type="submit" form="expense-form">Добавить</button>');
  document.querySelector('#expense-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formValues(event.currentTarget);
    if (body.occurredAt) body.occurredAt = new Date(body.occurredAt).toISOString();
    try {
      await api('/finances/expenses', { method: 'POST', body });
      closeModal();
      toast('Расход добавлен');
      await renderFinances();
    } catch (error) { formError(event.currentTarget, error.message); }
  });
}

async function renderSettings() {
  const { activities } = await api('/activity');
  app.innerHTML = `<div class="page">${pageHeader('Настройки', 'Безопасность аккаунта и журнал действий')}<div class="dashboard-grid"><section class="panel"><header class="panel__header"><div><h2>Сменить пароль</h2><p>Не менее 12 символов</p></div></header><div class="panel__body"><form id="password-form" class="form-stack"><label class="field"><span>Текущий пароль</span><input class="input" type="password" name="currentPassword" autocomplete="current-password" required></label><label class="field"><span>Новый пароль</span><input class="input" type="password" name="newPassword" autocomplete="new-password" minlength="12" maxlength="128" required></label><div class="form-error" hidden></div><button class="button button--primary" type="submit">Изменить пароль</button></form></div></section><section class="panel"><header class="panel__header"><div><h2>Последние действия</h2><p>Журнал безопасности</p></div></header><div class="task-list">${activities.slice(0, 20).map((item) => `<article class="task-row"><i class="ti ti-history"></i><span class="task-row__content"><b>${escapeHtml(item.title)}</b><small>${dateTime(item.createdAt)}</small></span><span></span><span></span><span></span></article>`).join('')}</div></section></div></div>`;
  document.querySelector('#password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/auth/password', { method: 'POST', body: formValues(event.currentTarget) });
      event.currentTarget.reset();
      toast('Пароль изменён');
    } catch (error) { formError(event.currentTarget, error.message); }
  });
}

function renderMore() {
  app.innerHTML = `<div class="page">${pageHeader('Ещё', 'Дополнительные разделы')}<section class="more-grid"><a class="more-link" href="#/tasks"><i class="ti ti-checklist"></i><span><b>Задачи</b><small>Дела и напоминания</small></span></a><a class="more-link" href="#/finances"><i class="ti ti-wallet"></i><span><b>Финансы</b><small>Доходы и расходы</small></span></a><a class="more-link" href="#/settings"><i class="ti ti-settings"></i><span><b>Настройки</b><small>Пароль и журнал</small></span></a><button class="more-link" data-action="logout"><i class="ti ti-logout"></i><span><b>Выйти</b><small>Завершить сессию</small></span></button></section></div>`;
}

function currentRoute() {
  return window.location.hash.replace(/^#\//, '').split('/')[0] || 'dashboard';
}

async function renderCurrentRoute() {
  const route = currentRoute();
  setActiveNav(route);
  app.setAttribute('aria-busy', 'true');
  try {
    if (route === 'dashboard') await renderDashboard();
    else if (route === 'orders') await renderOrders();
    else if (route === 'clients') await renderClients();
    else if (route === 'tasks') await renderTasks();
    else if (route === 'finances') await renderFinances();
    else if (route === 'settings') await renderSettings();
    else if (route === 'more') renderMore();
    else window.location.hash = '#/dashboard';
  } catch (error) {
    app.innerHTML = `<div class="page">${pageHeader('Не удалось загрузить раздел', error.message)}${emptyState('alert-triangle', 'Обновите страницу или повторите позже')}</div>`;
  } finally {
    app.removeAttribute('aria-busy');
    app.focus({ preventScroll: true });
  }
}

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } finally { window.location.replace('/control/login.html'); }
}

document.addEventListener('click', async (event) => {
  const close = event.target.closest('[data-close-modal]');
  if (close && modalRoot.contains(close)) { closeModal(); return; }
  if (event.target.matches('[data-modal-backdrop]')) { closeModal(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'new-order') { openOrderForm(); return; }
  if (action === 'new-task') { openTaskForm(); return; }
  if (action === 'new-expense') { openExpenseForm(); return; }
  if (action === 'logout') { await logout(); return; }
  if (action === 'export-csv') {
    const range = monthRange();
    window.location.assign(`/api/control/finances/export.csv?${isoRangeQuery(range)}`);
    return;
  }

  const view = event.target.closest('[data-order-view]');
  if (view) {
    state.orderView = view.dataset.orderView;
    localStorage.setItem('ev19-order-view', state.orderView);
    document.querySelectorAll('[data-order-view]').forEach((button) => {
      const isActive = button === view;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    await loadOrders();
    return;
  }

  const taskView = event.target.closest('[data-task-view]');
  if (taskView) {
    state.taskView = taskView.dataset.taskView;
    localStorage.setItem('ev19-task-view', state.taskView);
    document.querySelectorAll('[data-task-view]').forEach((button) => {
      const isActive = button === taskView;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    await renderTasks();
    return;
  }

  const orderElement = event.target.closest('[data-order-id]');
  if (orderElement && !event.target.closest('[data-order-status]')) { await showOrder(orderElement.dataset.orderId); return; }
  const clientElement = event.target.closest('[data-client-id]');
  if (clientElement) { await showClient(clientElement.dataset.clientId); return; }

  const statusButton = event.target.closest('[data-order-status]');
  if (statusButton) {
    try {
      await api(`/orders/${statusButton.dataset.orderId}`, { method: 'PATCH', body: { status: statusButton.dataset.orderStatus } });
      closeModal();
      toast('Статус заказа изменён');
      await renderCurrentRoute();
    } catch (error) { toast(error.message, 'error'); }
    return;
  }

  const editOrder = event.target.closest('[data-edit-order]');
  if (editOrder) {
    const { order } = await api(`/orders/${editOrder.dataset.editOrder}`);
    openOrderForm(order);
    return;
  }

  const deleteOrder = event.target.closest('[data-delete-order]');
  if (deleteOrder && window.confirm('Удалить заказ без возможности восстановления?')) {
    try {
      await api(`/orders/${deleteOrder.dataset.deleteOrder}`, { method: 'DELETE' });
      closeModal();
      toast('Заказ удалён');
      await renderCurrentRoute();
    } catch (error) { toast(error.message, 'error'); }
    return;
  }

  const taskDone = event.target.closest('[data-task-done]');
  if (taskDone) {
    try {
      await api(`/tasks/${taskDone.dataset.taskDone}`, { method: 'PATCH', body: { status: taskDone.checked ? 'DONE' : 'TODO' } });
      await renderCurrentRoute();
    } catch (error) { toast(error.message, 'error'); }
    return;
  }

  const taskStatus = event.target.closest('[data-task-status]');
  if (taskStatus) {
    try {
      await api(`/tasks/${taskStatus.dataset.taskId}`, { method: 'PATCH', body: { status: taskStatus.dataset.taskStatus } });
      await renderTasks();
    } catch (error) { toast(error.message, 'error'); }
    return;
  }

  const deleteTask = event.target.closest('[data-delete-task]');
  if (deleteTask && window.confirm('Удалить задачу?')) {
    await api(`/tasks/${deleteTask.dataset.deleteTask}`, { method: 'DELETE' });
    toast('Задача удалена');
    await renderTasks();
    return;
  }

  const deleteExpense = event.target.closest('[data-delete-expense]');
  if (deleteExpense && window.confirm('Удалить расход?')) {
    await api(`/finances/expenses/${deleteExpense.dataset.deleteExpense}`, { method: 'DELETE' });
    toast('Расход удалён');
    await renderFinances();
  }
});

document.addEventListener('keydown', (event) => {
  const modal = modalRoot.querySelector('.modal');
  if (event.key === 'Escape' && modal) {
    event.preventDefault();
    closeModal();
    return;
  }
  if (event.key === 'Tab' && modal) {
    const focusable = modalFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      modal.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!modal.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-order-id], [data-client-id]')) {
    event.preventDefault();
    event.target.click();
  }
});

window.addEventListener('hashchange', renderCurrentRoute);

(async function boot() {
  try {
    const data = await api('/auth/me');
    state.user = data.user;
    state.csrfToken = data.csrfToken;
    document.querySelector('#user-name').textContent = data.user.name;
    document.querySelector('#user-avatar').textContent = data.user.name.slice(0, 1).toUpperCase();
    await renderCurrentRoute();
  } catch (error) {
    if (!error.message.includes('Сессия')) toast(error.message, 'error');
  }
})();
