# Фаза 10: Deploy + Polish

## Что нужно реализовать:

### 1. Production settings
- `config/settings/production.py` — DEBUG=False, SECURE_*, CSRF, SESSION
- Whitenoise для статики
- Правильные CORS origins

### 2. Docker / Deployment
- `Dockerfile` (Django + Gunicorn)
- `docker-compose.yml` (Django, Celery worker, Celery beat, Redis, Postgres)
- `.env.example`

### 3. Sentry + Logging
- Sentry SDK (Django + Celery)
- Structured logging

### 4. Rate Limiting
- django-ratelimit на auth и webhook

### 5. Tests
- Unit tests: services
- API tests: auth, views, webhook

---

## Порядок:
1. Production settings
2. Docker + compose
3. Sentry
4. Rate limiting
5. Tests
