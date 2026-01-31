# Правила проекта

- Всё общение в чате ведётся исключительно на русском языке.
- Все рассуждения и размышления также ведутся на русском языке.
- Не давать советы — самостоятельно решать проблемы и вносить изменения.
- Локальная разработка: SQLite, virtualenv — `backend/.venv/bin/python`.

## Railway: как работать
- Требования: установлен `railway` CLI, доступен интернет. Все ID проектов и сервисов зашиты в `ops/railway/config.sh`.
- Токены: скопировать `ops/railway/.env.example` в `ops/railway/.env` и вписать любой из токенов `RAILWAY_API_TOKEN` / `RAILWAY_TOKEN` / `RAILWAY_PROJECT_TOKEN`.
- Привязка директорий (один раз на машину): `ops/railway/link-all.sh` — пропишет project/env/service в `railway` для `backend`, `frontend/console`, `frontend/miniapp`.
- Деплой: `ops/railway/deploy.sh all` или `ops/railway/deploy.sh api|celery|beat|console|miniapp` — выполняется из корректного каталога и вызывает `railway up` с нужным service id.
- Логи: `ops/railway/logs.sh` (или перечислить сервисы) — стрим с префиксами сервисов.
- Статус деплоев: `ops/railway/status.sh` — использует `railway deployment list --json`, показывает последний деплой каждого сервиса в текущем окружении.
- SSH в контейнер: `ops/railway/ssh.sh <service>` (service: `api`, `celery`, `beat`, `console`, `miniapp`, `redis`).
- Команда внутри сервиса: `ops/railway/run.sh <service> <cmd>` (пример: `ops/railway/run.sh api python manage.py migrate`).
- Настройки и пути логов менять в `ops/railway/common.sh` (переменная `RAILWAY_LOG_LINES`) при необходимости.

### Где взять токены Railway
- Account/Team токен (`RAILWAY_API_TOKEN`): веб‑интерфейс railway.com → Account Settings → Tokens → Create token. Если не выбираешь Team — создаётся личный токен; если выбираешь Team — командный токен. Скопировать сразу — повторно не покажут. citeturn0search2turn0search5
- Project токен (`RAILWAY_TOKEN` или `RAILWAY_PROJECT_TOKEN`): в нужном проекте → Settings → Tokens → Create project token. Токен scoped на окружение проекта, подходит для `railway up`, `railway logs`, `railway redeploy` внутри него. citeturn0search1turn0search4
- Приоритет переменных в скриптах: `RAILWAY_API_TOKEN` → `RAILWAY_TOKEN` → `RAILWAY_PROJECT_TOKEN`. В Railway CLI при одновременном задании `RAILWAY_TOKEN` и `RAILWAY_PROJECT_TOKEN` приоритет у `RAILWAY_TOKEN`. Если переменные пустые, скрипты используют токен из `~/.railway/config.json` (после `railway login`). citeturn0search0
