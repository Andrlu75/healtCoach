# Миграция на Railway

## 1. Создать проект в Railway

1. Зайди на https://railway.app/ и войди через GitHub
2. **New Project** → **Empty Project**
3. Назови проект: `healthcoach`

## 2. Добавить базы данных

### PostgreSQL
1. **+ New** → **Database** → **PostgreSQL**
2. После создания скопируй `DATABASE_URL` из вкладки **Variables**

### Redis
1. **+ New** → **Database** → **Redis**
2. После создания скопируй `REDIS_URL` из вкладки **Variables**

## 3. Добавить Backend API

1. **+ New** → **GitHub Repo** → выбери `healtCoach`
2. В настройках сервиса:
   - **Settings** → **Root Directory**: `backend`
   - **Settings** → **Watch Paths**: `backend/**`

3. **Variables** → добавь переменные:
```
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_SECRET_KEY=<сгенерируй новый>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=.railway.app
CSRF_TRUSTED_ORIGINS=https://*.railway.app
DATABASE_URL=<из PostgreSQL>
REDIS_URL=<из Redis>
CELERY_BROKER_URL=<из Redis>

# Telegram
TELEGRAM_BOT_TOKEN=<твой токен>
TELEGRAM_WEBHOOK_SECRET=<сгенерируй>
TELEGRAM_WEBHOOK_BASE_URL=https://<api-domain>.railway.app
TELEGRAM_MINIAPP_URL=https://<miniapp-domain>.railway.app

# AI
OPENAI_API_KEY=<твой ключ>
ANTHROPIC_API_KEY=<твой ключ>
DEFAULT_AI_PROVIDER=openai
DEFAULT_AI_MODEL=gpt-4o

# Google Fit
GOOGLE_FIT_CLIENT_ID=<твой>
GOOGLE_FIT_CLIENT_SECRET=<твой>
GOOGLE_FIT_REDIRECT_URI=https://<api-domain>.railway.app/api/integrations/google-fit/callback/
ENCRYPTION_KEY=<твой>

# R2 Storage (опционально)
R2_ACCESS_KEY_ID=<твой>
R2_SECRET_ACCESS_KEY=<твой>
R2_BUCKET_NAME=<твой>
R2_ENDPOINT_URL=<твой>

# CORS
CORS_ALLOWED_ORIGINS=https://<miniapp-domain>.railway.app,https://<console-domain>.railway.app
```

4. **Settings** → **Networking** → **Generate Domain**

## 4. Добавить Celery Worker

1. **+ New** → **GitHub Repo** → выбери тот же `healtCoach`
2. **Settings**:
   - **Root Directory**: `backend`
   - **Watch Paths**: `backend/**`
   - **Start Command**: `celery -A config worker -l info --concurrency=2`

3. **Variables** — скопируй те же переменные что у API (DATABASE_URL, REDIS_URL, TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, etc.)

**НЕ генерируй домен** — worker не нужен публичный доступ.

## 5. Добавить Celery Beat (планировщик)

1. **+ New** → **GitHub Repo** → выбери тот же `healtCoach`
2. **Settings**:
   - **Root Directory**: `backend`
   - **Watch Paths**: `backend/**`
   - **Start Command**: `celery -A config beat -l info`

3. **Variables** — минимальный набор:
```
DJANGO_SETTINGS_MODULE=config.settings.prod
DATABASE_URL=<из PostgreSQL>
REDIS_URL=<из Redis>
CELERY_BROKER_URL=<из Redis>
```

**НЕ генерируй домен**.

## 6. Добавить Frontend MiniApp

1. **+ New** → **GitHub Repo** → выбери `healtCoach`
2. **Settings**:
   - **Root Directory**: `frontend/miniapp`
   - **Watch Paths**: `frontend/miniapp/**`

3. **Variables**:
```
VITE_API_URL=https://<api-domain>.railway.app/api
```

4. **Settings** → **Networking** → **Generate Domain**

## 7. Добавить Frontend Console

1. **+ New** → **GitHub Repo** → выбери `healtCoach`
2. **Settings**:
   - **Root Directory**: `frontend/console`
   - **Watch Paths**: `frontend/console/**`

3. **Variables**:
```
VITE_API_URL=https://<api-domain>.railway.app/api
```

4. **Settings** → **Networking** → **Generate Domain**

## 8. Обновить переменные с доменами

После генерации доменов, обнови:

1. **Backend API**:
   - `TELEGRAM_WEBHOOK_BASE_URL`
   - `TELEGRAM_MINIAPP_URL`
   - `CORS_ALLOWED_ORIGINS`
   - `GOOGLE_FIT_REDIRECT_URI`

2. **Google Cloud Console**:
   - Добавь новый redirect URI для Google Fit

3. **Telegram BotFather**:
   - Обнови Web App URL на новый домен miniapp

## 9. Загрузить упражнения и настроить вебхуки

В Railway можно запустить команды через **Deploy** → **View Logs** → кнопка **Shell**:

```bash
python manage.py load_exercises
python manage.py setup_webhooks
```

## 10. Проверить

1. Открой домен API — должен вернуть 404 (это нормально)
2. Открой домен MiniApp — должен открыться интерфейс
3. Отправь /start боту в Telegram
4. Проверь логи всех сервисов

## Стоимость

Railway Hobby: $5/месяц + usage
- PostgreSQL: ~$0.5-2/месяц
- Redis: ~$0.5-1/месяц
- API: ~$2-5/месяц
- Worker + Beat: ~$2-4/месяц
- Frontend x2: ~$0-2/месяц

**Итого: ~$10-15/месяц**

## После миграции

Можно удалить сервисы на Render.
