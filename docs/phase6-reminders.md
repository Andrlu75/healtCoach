# Фаза 6: Reminders — Детальный план

## Что уже есть:
- Модель `Reminder` (title, message, type, frequency, time, days_of_week, is_smart, next_fire_at)
- Celery + django-celery-beat настроены (Redis broker, DatabaseScheduler)
- Telegram API (`send_message`) для отправки
- `TelegramBot` модель с токенами
- URL `api/reminders/` подключён

---

## Что нужно реализовать:

### 1. `apps/reminders/tasks.py` — Celery задачи
- **`check_reminders()`** — periodic task (каждую минуту):
  1. Найти все активные напоминания где `next_fire_at <= now`
  2. Для каждого: отправить в Telegram
  3. Если `is_smart` — сгенерировать текст через AI
  4. Обновить `last_sent_at` и рассчитать `next_fire_at`

### 2. `apps/reminders/services.py` — Вспомогательная логика
- **`send_reminder_message(reminder)`** — отправка через Telegram API (sync httpx)
- **`generate_smart_text(reminder) -> str`** — AI генерирует мотивирующий текст
- **`compute_next_fire(reminder) -> datetime`** — расчёт next_fire_at

### 3. `apps/reminders/serializers.py`
- `ReminderSerializer` — полная сериализация
- `ReminderCreateSerializer` — создание/обновление

### 4. `apps/reminders/views.py` — CRUD API
- `GET /api/reminders/?client_id=X` — список
- `POST /api/reminders/` — создание
- `PUT /api/reminders/<id>/` — редактирование
- `DELETE /api/reminders/<id>/` — удаление

### 5. `apps/reminders/urls.py` — маршруты

---

## Порядок реализации:
1. `reminders/services.py`
2. `reminders/tasks.py`
3. `reminders/serializers.py`
4. `reminders/views.py` + `urls.py`
