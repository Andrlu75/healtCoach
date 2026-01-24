# Фаза 5: Weather + Metrics — Детальный план

## Что уже есть:
- Модель `HealthMetric` (weight, sleep, steps, heart_rate, blood_pressure, water, custom)
- `OPENWEATHERMAP_API_KEY` в settings
- Redis настроен для Celery (но `CACHES` не настроен)
- Photo handler: при `image_type == 'data'` → generic AI response (нужно заменить на парсинг метрик)
- URL `api/metrics/` подключён в `config/urls.py`

---

## Что нужно реализовать:

### 1. `config/settings/base.py` — добавить CACHES
Redis-кэш для погоды (15 мин TTL).

### 2. `apps/weather/services.py` — Сервис погоды
- **`get_weather(city: str) -> dict`** — запрос к OpenWeatherMap, кэш 15 мин
- Возвращает: температура, описание, влажность, ветер

### 3. `apps/weather/views.py` + `urls.py` — API погоды
- `GET /api/weather/?city=Москва` — погода по городу

### 4. `apps/metrics/services.py` — Парсинг метрик из фото
- **`parse_metrics_from_photo(bot, image_data) -> list[dict]`** — AI извлекает числовые данные
- **`save_metrics(client, metrics_data) -> list[HealthMetric]`** — сохранение

### 5. Обновить `apps/bot/handlers/photo.py`
- При `image_type == 'data'` → `parse_metrics_from_photo` → сохранить → ответ

### 6. `apps/metrics/serializers.py` + `views.py` + `urls.py`
- `GET /api/metrics/?client_id=X&type=weight&date_from=...` — список метрик
- `POST /api/metrics/` — ручное добавление

---

## Порядок реализации:
1. `settings/base.py` (CACHES)
2. `weather/services.py`
3. `weather/views.py` + `urls.py`
4. `metrics/services.py` (AI парсинг)
5. `bot/handlers/photo.py` (обработка data-фото)
6. `metrics/serializers.py` + `views.py` + `urls.py`
