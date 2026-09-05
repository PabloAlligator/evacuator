# Эвакуатор 19

Публичный сайт `evakuator19.ru` и закрытая мобильная CRM для владельца эвакуатора.

## Что входит

- публичный лендинг из исходного проекта;
- закрытая CRM на `/control`;
- дашборд с заказами, выручкой, расходами, прибылью и долгами;
- обычные и запланированные заказы;
- список и канбан-доска заказов;
- клиентская база с историей поездок;
- задачи списком и доской;
- доходы, расходы и экспорт заказов в CSV;
- журнал важных действий;
- серверные сессии, CSRF, Origin-проверка, CSP, rate limit и Argon2id;
- Prisma/SQLite, миграции, резервное копирование и security-тесты.

Обычный заказ сразу получает статус `COMPLETED`: текущие дата и время фиксируются автоматически. Запланированный заказ получает статус `PLANNED` и требует дату со временем. В выручку попадают только выполненные заказы.

## Стек

- HTML5, SCSS, Vanilla JavaScript;
- Node.js 22+, Express 5;
- Prisma 6 и SQLite;
- Argon2id;
- PM2, Nginx, SSL.

React не используется.

## Структура

```text
control/                 интерфейс CRM
  assets/                SCSS, CSS и JavaScript CRM
deploy/                  пример Nginx-конфига
prisma/                  схема и миграции
scripts/                 создание владельца и backup
site/                    публичные стили, скрипты и изображения
src/
  config/                проверка окружения
  lib/                   Prisma, безопасность, валидация, ошибки
  middleware/            авторизация, Origin, rate limit, обработка ошибок
  routes/                API по разделам
  services/              бизнес-логика клиентов, заказов и статистики
tests/                   проверки безопасности и бизнес-логики
server.js                точка входа
```

## Первый локальный запуск

```bash
npm ci
cp .env.example .env
```

В Windows CMD вместо `cp` используйте:

```cmd
copy .env.example .env
```

Заменить `SESSION_SECRET` в `.env`. Сгенерировать безопасное значение можно командой:

```bash
openssl rand -hex 48
```

Затем:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run owner:create
npm run build:css
npm start
```

Публичный сайт откроется на `http://localhost:3000`, CRM — на `http://localhost:3000/control`.

## Production `.env`

Минимальный пример:

```dotenv
NODE_ENV=production
PORT=3000
DATABASE_URL="file:./dev.db"
SESSION_SECRET=СЛУЧАЙНАЯ_СТРОКА_НЕ_КОРОЧЕ_64_СИМВОЛОВ
SESSION_DAYS=14
APP_ORIGIN=https://evakuator19.ru
TRUST_PROXY=1
BACKUP_RETENTION_DAYS=30
```

Файл `.env` нельзя добавлять в Git или передавать третьим лицам.

## Обновление сервера

Перед обновлением создать резервную копию:

```bash
npm run db:backup
```

После получения новых файлов:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run build:css
pm2 restart evakuator19 --update-env
pm2 save
```

Проверка:

```bash
curl -fsS http://127.0.0.1:3000/health
pm2 status
pm2 logs evakuator19 --lines 100
```

## Первый деплой

1. Разместить проект, например, в `/var/www/evakuator19`.
2. Создать production `.env` с правами `600`.
3. Выполнить `npm ci`, `npm run prisma:generate`, `npm run prisma:deploy`.
4. Создать владельца командой `npm run owner:create`.
5. Собрать CSS командой `npm run build:css`.
6. Запустить `pm2 start ecosystem.config.cjs` и `pm2 save`.
7. Адаптировать `deploy/nginx-evakuator19.conf`, включить конфиг и проверить `nginx -t`.
8. Выпустить или обновить SSL через Certbot.
9. Проверить `/health`, `/control`, вход и создание тестового заказа.

## Резервные копии

Команда `npm run db:backup` создаёт согласованную SQLite-копию в `backups/` и удаляет копии старше `BACKUP_RETENTION_DAYS`.

Пример ежедневного cron в 03:15:

```cron
15 3 * * * cd /var/www/evakuator19 && /usr/bin/npm run db:backup >> /var/log/evakuator19-backup.log 2>&1
```

Папку `backups/` желательно дополнительно копировать в отдельное защищённое хранилище.

## Проверки

```bash
npm test
npm audit --omit=dev
```

Перед production-деплоем обе команды должны завершаться без ошибок.

## Важные правила

- не хранить реальные пароли и базу в репозитории;
- не открывать файл SQLite через Nginx;
- не раздавать папки `prisma/`, `backups/`, `src/` и `.env` как статику;
- работать с CRM только через HTTPS;
- перед миграциями и крупными обновлениями делать backup;
- удаление заказов и расходов использовать только для ошибочных записей.
