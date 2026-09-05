const { HttpError } = require('./http-error');

function text(value, field, maxLength = 500, required = false) {
  const normalized = String(value ?? '').replace(/\0/g, '').trim();
  if (required && !normalized) throw new HttpError(400, `Заполните поле «${field}»`, 'VALIDATION_ERROR');
  if (normalized.length > maxLength) throw new HttpError(400, `Поле «${field}» слишком длинное`, 'VALIDATION_ERROR');
  return normalized || null;
}

function positiveId(value, field = 'Идентификатор') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new HttpError(400, `${field} указан неверно`, 'VALIDATION_ERROR');
  return parsed;
}

function enumValue(value, allowed, field, fallback) {
  if (value == null && fallback !== undefined) return fallback;
  if (!allowed.has(value)) throw new HttpError(400, `Поле «${field}» указано неверно`, 'VALIDATION_ERROR');
  return value;
}

function optionalDate(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `Поле «${field}» содержит неверную дату`, 'VALIDATION_ERROR');
  return date;
}

function moneyToCents(value, field, required = false) {
  if (value === '' || value == null) {
    if (required) throw new HttpError(400, `Заполните поле «${field}»`, 'VALIDATION_ERROR');
    return null;
  }
  const normalized = String(value).replace(',', '.').replace(/\s/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000000) {
    throw new HttpError(400, `Поле «${field}» содержит неверную сумму`, 'VALIDATION_ERROR');
  }
  return Math.round(parsed * 100);
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  if (!/^7\d{10}$/.test(digits)) throw new HttpError(400, 'Укажите корректный номер телефона', 'VALIDATION_ERROR');
  return digits;
}

function formatPhone(digits) {
  return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

function normalizeSearch(...values) {
  return values
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9+]+/gi, ' ')
    .trim()
    .slice(0, 2000);
}

function dateRange(query, defaultDays = 30) {
  const now = new Date();
  const fallbackFrom = new Date(now.getTime() - defaultDays * 86400000);
  const from = query.from ? optionalDate(query.from, 'Начало периода') : fallbackFrom;
  const to = query.to ? optionalDate(query.to, 'Конец периода') : now;
  if (from >= to) throw new HttpError(400, 'Начало периода должно быть раньше конца', 'VALIDATION_ERROR');
  if (to.getTime() - from.getTime() > 370 * 86400000) throw new HttpError(400, 'Период не может превышать 370 дней', 'VALIDATION_ERROR');
  return { from, to };
}

module.exports = {
  text,
  positiveId,
  enumValue,
  optionalDate,
  moneyToCents,
  normalizePhone,
  formatPhone,
  normalizeSearch,
  dateRange,
};
