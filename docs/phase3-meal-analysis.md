# Фаза 3: Meal Analysis — Детальный план

## Что уже есть:
- Модель `Meal` с полями КБЖУ, `image_type`, `image` (ImageField)
- S3 storage настроен (dev — локально, prod — S3)
- Photo handler скачивает фото и отправляет в generic AI vision
- Миграция `0001_initial` для meals уже создана
- URL `api/meals/` уже подключён в `config/urls.py`

---

## Что нужно реализовать:

### 1. `apps/meals/services.py` — Сервис анализа
- **`classify_image(provider, image_data) -> str`** — AI определяет тип: `food` / `data` / `other`
- **`analyze_food(provider, image_data, caption) -> dict`** — AI возвращает структурированный JSON: `dish_name`, `calories`, `proteins`, `fats`, `carbohydrates`, `ingredients`
- **`save_meal(client, image_data, analysis) -> Meal`** — сохранение в БД + запись фото через ImageField
- **`get_daily_summary(client, date) -> dict`** — сумма КБЖУ за день + остатки от нормы клиента

### 2. Обновить `apps/bot/handlers/photo.py`
Новая логика:
1. Скачать фото
2. Классифицировать (`classify_image`)
3. Если `food` → `analyze_food` → `save_meal` → ответ с КБЖУ + дневной остаток
4. Если `other` → текущее поведение (generic AI vision)

### 3. `apps/meals/serializers.py`
- `MealSerializer` — полная сериализация Meal
- `DailySummarySerializer` — consumed + remaining

### 4. `apps/meals/views.py` — API для консоли/mini-app
- `GET /api/meals/` — список приёмов пищи (фильтр по дате, клиенту)
- `GET /api/meals/daily/?date=YYYY-MM-DD` — дневная сводка

### 5. `apps/meals/urls.py` — подключить эндпоинты

### 6. Обновить `apps/bot/services.py`
- Вынести получение vision-провайдера в отдельную функцию (переиспользуется в meals)

---

## Порядок реализации:
1. `meals/services.py` (classify + analyze + save + daily summary)
2. `bot/handlers/photo.py` (новая логика с классификацией)
3. `meals/serializers.py`
4. `meals/views.py` + `meals/urls.py`
