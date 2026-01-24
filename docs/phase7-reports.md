# Фаза 7: Reports — Детальный план

## Что уже есть:
- Модель `Report` (report_type, period_start/end, content JSON, summary, pdf_file, is_sent)
- WeasyPrint в requirements
- Пакет `generators/` (пустой)
- URL `api/reports/` подключён

---

## Что нужно реализовать:

### 1. `reports/generators/daily.py` — Сбор данных за день
- Приёмы пищи (Meal) + итого КБЖУ
- Метрики здоровья (HealthMetric)
- Количество сообщений
- Выполнение нормы (% от daily_calories и т.д.)

### 2. `reports/generators/weekly.py` — Сбор данных за неделю
- Те же данные агрегированно за 7 дней
- Тренды (средний КБЖУ, изменение веса)

### 3. `reports/services.py` — Генерация
- **`generate_report(client, report_type, date) -> Report`**
- **`generate_ai_summary(content) -> str`**
- **`render_pdf(report) -> bytes`**

### 4. `reports/tasks.py` — Celery задачи
- **`generate_daily_reports()`** — каждый день в 22:00
- **`generate_weekly_reports()`** — каждый понедельник
- **`send_report(report_id)`** — отправка PDF в Telegram

### 5. `reports/serializers.py` + `views.py` + `urls.py`
- `GET /api/reports/?client_id=X&type=daily`
- `GET /api/reports/<id>/`
- `POST /api/reports/generate/`

---

## Порядок реализации:
1. `generators/daily.py` + `generators/weekly.py`
2. `services.py` (AI summary + PDF)
3. `tasks.py` (Celery)
4. `serializers.py` + `views.py` + `urls.py`
