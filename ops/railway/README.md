# Railway CLI automation

Everything here works non-interactively once you export a token in `ops/railway/.env`.

## Scripts
- `link-all.sh` — привязать каталоги к проекту/окружению/сервисам.
- `deploy.sh [service|all]` — задеплоить из корректной папки `railway up`.
- `logs.sh [service|all]` — стрим логов с префиксами сервисов.
- `ssh.sh <service>` — интерактивный шелл в контейнер.
- `run.sh <service> <cmd>` — выполнить команду внутри сервиса.
- `status.sh` — показывает последний деплой каждого сервиса через `railway deployment list --json`.

## Tokens
Можно не задавать токены, если в CLI уже выполнен `railway login` (токен лежит в `~/.railway/config.json`). Иначе положите один из `RAILWAY_API_TOKEN` / `RAILWAY_TOKEN` / `RAILWAY_PROJECT_TOKEN` в `ops/railway/.env`. Project/env/service IDs зашиты в `config.sh`.
