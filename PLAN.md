# Health Coach Platform - Техническое задание и план реализации

## 1. Общее описание

Платформа для health-коучей, позволяющая вести клиентов через Telegram-бота с AI-помощником. Бот анализирует фото еды, голосовые сообщения, ведёт дневник питания, считает КБЖУ и поддерживает клиента в дружеском тоне. Коуч управляет всем через веб-консоль, клиент видит свой прогресс в Telegram Mini App.

---

## 2. Стек технологий

| Компонент | Технология |
|-----------|-----------|
| Бэкенд | Django 5 + DRF + Celery + Redis |
| Фронтенд | React 19 + TypeScript + Vite + Tailwind |
| Telegram Mini App | React + @twa-dev/sdk |
| База данных | PostgreSQL 16 |
| Хранение фото | S3-совместимое (AWS S3 / MinIO) |
| AI | Настраиваемый (OpenAI / Anthropic) |
| Очереди задач | Celery + Redis |
| Деплой | Render |
| Telegram Bot | python-telegram-bot 21 |
| Транскрибация | OpenAI Whisper API |

---

## 3. Архитектура

```
Telegram Bot API
       |
       v
Django Backend (REST API)
  +-- Telegram Webhook Handler
  +-- AI Service (абстракция над провайдерами)
  +-- Meal Analysis Service
  +-- Reminder Service (Celery)
  +-- Report Service
  +-- Notification Service
       |
       v
  PostgreSQL + S3
       |
       v
React Frontend
  +-- Mini App (клиент)
  +-- Web Console (коуч)
```

---

## 4. Структура проекта

```
healthcoach/
+-- docker-compose.yml
+-- .env.example
+-- Makefile
+-- backend/
|   +-- Dockerfile
|   +-- requirements/ (base.txt, dev.txt, prod.txt)
|   +-- manage.py
|   +-- config/
|   |   +-- settings/ (base.py, dev.py, prod.py, test.py)
|   |   +-- urls.py
|   |   +-- celery.py
|   |   +-- wsgi.py
|   |   +-- asgi.py
|   +-- core/
|   |   +-- ai/
|   |   |   +-- base.py            # AbstractAIProvider, AIResponse
|   |   |   +-- openai_provider.py
|   |   |   +-- anthropic_provider.py
|   |   |   +-- factory.py
|   |   +-- storage.py
|   |   +-- permissions.py
|   |   +-- pagination.py
|   |   +-- exceptions.py
|   |   +-- utils.py
|   +-- apps/
|       +-- accounts/   (User, Coach, Client)
|       +-- bot/        (webhook, handlers: text/voice/photo/audio)
|       +-- chat/       (ChatMessage, ConversationService)
|       +-- meals/      (Meal, КБЖУ analysis, prompts)
|       +-- metrics/    (HealthMetric)
|       +-- onboarding/ (InviteLink, OnboardingQuestion)
|       +-- reminders/  (Reminder, Celery tasks)
|       +-- reports/    (Report, PDF, daily/weekly generators)
|       +-- persona/    (BotPersona)
|       +-- weather/    (OpenWeatherMap service)
+-- frontend/
|   +-- miniapp/  (React - Telegram Mini App для клиента)
|   |   +-- src/
|   |       +-- pages/ (Dashboard, Diary, Stats, Reminders)
|   |       +-- components/
|   |       +-- api/
|   |       +-- stores/ (zustand)
|   |       +-- hooks/
|   +-- console/ (React - веб-консоль для коуча)
|       +-- src/
|           +-- pages/ (Dashboard, ClientList, ClientDetail, Reports, Settings, PersonaSettings, OnboardingEditor)
|           +-- components/
|           +-- api/
|           +-- stores/
|           +-- hooks/
+-- deploy/
    +-- render.yaml
```

---

## 5. Модули системы

### 5.1 Telegram Bot

**Входящие типы сообщений:**
- Текст -> AI-ответ от персонажа
- Голосовое -> транскрибация (Whisper) -> AI-ответ
- Аудио -> транскрибация -> обработка как "мысль от коуча"
- Фото -> классификация -> обработка по типу

**Обработка фото (3 подтипа):**
- **Еда**: анализ КБЖУ, сохранение в дневник, ответ нутрициолога
- **Цифровые данные**: извлечение показателей (сон, вес, пульс), сохранение
- **Прочее**: описание изображения, сохранение в контекст

**Контекст диалога:**
- previous_response_id для OpenAI
- Хранение message history для Anthropic
- Учёт времени суток, дня недели, погоды в промптах

### 5.2 Онбординг клиента

1. Коуч генерирует **инвайт-ссылку** (уникальный токен)
2. Клиент переходит по ссылке -> бот привязывает к коучу
3. Бот запускает **настраиваемую анкету** (вопросы заданы коучем)
4. На основе анкеты рассчитываются **персональные нормы КБЖУ** (Mifflin-St Jeor)
5. Коуч может скорректировать нормы вручную

### 5.3 Персонаж бота (настраиваемый)

Коуч задаёт через панель:
- Имя, возраст, город персонажа
- Стиль общения (дружеский / формальный / мотивирующий)
- Уровень юмора
- Пол обращения к клиенту
- Системный промпт (полностью редактируемый)
- Роль (просто поддержка / нутрициолог / тренер)

### 5.4 AI-сервис (абстракция)

```python
class AbstractAIProvider(ABC):
    async def complete(messages, system_prompt, previous_response_id, ...) -> AIResponse
    async def analyze_image(image_data, prompt, ...) -> AIResponse
    async def transcribe_audio(audio_data, language) -> str
```

Поддерживаемые провайдеры:
- OpenAI (GPT-4o, GPT-4o-mini) — через Responses API
- Anthropic (Claude Sonnet, Haiku) — через Messages API

Коуч выбирает: провайдер, модель, API-ключ

### 5.5 Система напоминаний

**Расписание (индивидуальное):**
- Клиент задаёт через Mini App или бота
- Типы: приём пищи, вода, тренировка, взвешивание

**Умные напоминания:**
- Если клиент не отправлял фото еды > N часов
- Если пропущен обычный приём пищи (по паттерну)
- Если давно не было активности
- Текст генерируется AI в стиле персонажа

**Реализация:** Celery periodic task каждую минуту, проверка next_fire_at с учётом timezone

### 5.6 Персональные нормы КБЖУ

- Расчёт по формуле Mifflin-St Jeor (из анкеты: пол, возраст, рост, вес, активность)
- Коуч может переопределить вручную
- Нормы: калории, белки, жиры, углеводы, вода
- Учёт цели (похудеть / набрать / поддержать)

### 5.7 Отчёты

**Форматы:**
- Веб-консоль (графики, таблицы)
- Telegram-сводки (ежедневные/еженедельные)
- PDF-экспорт (WeasyPrint)

**Метрики в отчётах:**
- КБЖУ по дням/неделям (факт vs норма)
- Количество приёмов пищи
- Регулярность отправки фото
- Показатели здоровья (вес, сон, пульс)
- AI-сводка (краткое резюме за период)

---

## 6. Mini App (клиент)

### Экраны:
1. **Главная** — сводка за день (КБЖУ, прогресс-бары)
2. **Дневник питания** — список приёмов пищи с фото и КБЖУ
3. **Статистика** — графики КБЖУ за неделю/месяц (recharts)
4. **Напоминания** — настройка расписания
5. **Профиль** — личные данные, нормы, анкета

### Авторизация:
- Через Telegram Web App initData (без логина/пароля)

---

## 7. Веб-консоль (коуч)

### Экраны:
1. **Дашборд** — обзор всех клиентов (активность, отклонения)
2. **Клиенты** — список, фильтры, поиск
3. **Карточка клиента** — история питания, графики, чат, заметки
4. **Настройки бота** — персонаж, AI-провайдер, промпты
5. **Анкета** — конструктор вопросов для онбординга
6. **Отчёты** — генерация, просмотр, экспорт PDF
7. **Инвайты** — генерация ссылок, статус приглашений
8. **Настройки** — профиль коуча, API-ключи, нормы по умолчанию

### Авторизация:
- Email + пароль (Django auth + JWT)
- Привязка Telegram-аккаунта коуча

---

## 8. База данных (модели)

### Coach
- user (FK -> Django User)
- telegram_user_id
- business_name
- timezone

### Client
- coach (FK -> Coach)
- telegram_user_id, telegram_username
- first_name, last_name
- city (для погоды)
- timezone
- status (pending / active / paused / archived)
- daily_calories, daily_proteins, daily_fats, daily_carbs
- onboarding_completed, onboarding_data (JSON)

### ChatMessage
- client (FK -> Client)
- role (user / assistant / system)
- message_type (text / voice / photo / audio)
- content
- visible_to_user
- ai_response_id (для chain context)
- ai_provider
- metadata (JSON)
- telegram_message_id
- created_at

### Meal
- client (FK -> Client)
- image (S3 URL)
- image_type (food / data / other)
- dish_name, dish_type
- calories, proteins, fats, carbohydrates
- ingredients (JSON)
- health_analysis (JSON)
- ai_confidence (0-100)
- plate_type, layout, decorations
- meal_time, created_at

### HealthMetric
- client (FK -> Client)
- metric_type (weight / sleep / steps / heart_rate / blood_pressure / water)
- value, unit
- notes
- source (manual / photo / fitness_tracker)
- recorded_at

### Reminder
- client (FK -> Client)
- coach (FK -> Coach)
- title, message
- frequency (once / daily / weekly / custom)
- time
- days_of_week (JSON)
- is_active, is_smart
- last_sent_at, next_fire_at

### InviteLink
- coach (FK -> Coach)
- code (unique)
- is_active
- max_uses, uses_count
- expires_at

### OnboardingQuestion
- coach (FK -> Coach)
- text
- question_type (text / number / choice / multi_choice / date)
- options (JSON)
- is_required
- order
- field_key (маппинг на поле Client)

### BotPersona
- coach (OneToOne -> Coach)
- name, age, city
- style_description
- system_prompt
- greeting_message
- ai_provider, ai_model
- temperature, max_tokens

### Report
- client (FK -> Client)
- coach (FK -> Coach)
- report_type (daily / weekly)
- period_start, period_end
- content (JSON)
- summary (AI-текст)
- pdf_file (S3)
- is_sent

---

## 9. API-эндпоинты

### Бот:
- `POST /api/bot/webhook/` — вебхук Telegram

### Auth:
- `POST /api/auth/login/` — логин коуча (JWT)
- `POST /api/auth/miniapp/` — auth через Telegram initData

### Клиент (Mini App):
- `GET /api/client/dashboard/` — сводка за день
- `GET /api/client/meals/` — дневник питания
- `GET /api/client/stats/` — статистика
- `GET/PUT /api/client/reminders/` — напоминания
- `GET/PUT /api/client/profile/` — профиль

### Коуч (веб-консоль):
- `GET /api/coach/clients/` — список клиентов
- `GET /api/coach/clients/{id}/` — карточка клиента
- `GET /api/coach/clients/{id}/meals/` — дневник клиента
- `GET /api/coach/clients/{id}/metrics/` — метрики клиента
- `GET /api/coach/clients/{id}/chat/` — история чата
- `GET/PUT /api/coach/persona/` — настройки бота
- `CRUD /api/coach/onboarding/questions/` — анкета
- `POST /api/coach/invites/` — генерация инвайта
- `GET /api/coach/reports/` — отчёты
- `GET /api/coach/reports/{id}/pdf/` — экспорт PDF

---

## 10. Docker Compose (локальная разработка)

Сервисы:
- `db` — PostgreSQL 16
- `redis` — Redis 7
- `backend` — Django runserver :8000
- `celery-worker` — Celery worker
- `celery-beat` — Celery beat
- `miniapp` — Vite dev :3000
- `console` — Vite dev :3001
- `ngrok` (profile: tunnel) — для webhook тестирования

---

## 11. Фазы реализации

### Фаза 0: Scaffolding
- Инициализация Django + React проектов
- Docker Compose
- Settings (base/dev/prod), env vars
- Git, .gitignore, Makefile

### Фаза 1: Core Models + Auth
- User, Coach, Client модели + миграции
- JWT auth для коуча
- Telegram initData auth для клиента
- CRUD API

### Фаза 2: AI Service + Telegram Bot
- core/ai/ — AbstractAIProvider, OpenAI, Anthropic, Factory
- Telegram webhook + security
- Handlers: text, voice, photo, audio
- ChatMessage, previous_response_id chain
- BotPersona

### Фаза 3: Meal Analysis
- Meal модель
- Классификация фото (еда/данные/прочее)
- КБЖУ анализ
- Дневная сводка + расчёт остатков
- S3 upload, API

### Фаза 4: Client Onboarding
- InviteLink генерация/валидация
- OnboardingQuestion CRUD
- Telegram flow: /start с invite -> анкета -> нормы
- Mifflin-St Jeor

### Фаза 5: Weather + Metrics
- OpenWeatherMap (город клиента, Redis-кэш)
- HealthMetric + парсинг из фото
- API

### Фаза 6: Reminders
- Reminder CRUD
- Celery periodic task (каждую минуту, timezone)
- Умные напоминания (AI-текст)

### Фаза 7: Reports
- Daily/Weekly генераторы
- AI-сводка
- PDF (WeasyPrint)
- Celery tasks + отправка в Telegram

### Фаза 8: Mini App (React)
- initData validation
- Dashboard, Diary, Stats, Reminders
- recharts графики
- Tailwind UI

### Фаза 9: Web Console (React)
- Auth, Dashboard, Clients, ClientDetail
- Persona Settings, Onboarding Editor
- Reports + PDF, Invites

### Фаза 10: Deploy + Polish
- render.yaml
- Production settings, CORS, security
- Sentry, rate limiting
- Tests

---

## 12. Улучшения относительно оригинала (n8n)

| Было (n8n) | Стало (Django) |
|------------|---------------|
| Фиксированные нормы КБЖУ (40/85-100/250) | Персональные нормы из анкеты + коуч корректирует |
| Один захардкоженный персонаж | Настраиваемый персонаж через панель |
| Только OpenAI | Выбор AI-провайдера (OpenAI / Anthropic) |
| Нет напоминаний | Расписание + умные напоминания |
| Нет отчётов | Telegram + веб + PDF |
| Нет дашборда | Mini App для клиента + веб-консоль для коуча |
| Нет онбординга | Инвайт + настраиваемая анкета |
| Погода только Москва | Погода по городу клиента |
| Пересылка фото в один чат | Фото в S3 + просмотр через консоль |
| Нет аналитики | Графики, тренды, отклонения |
| API-ключи в коде | Безопасное хранение в env vars |

---

## 13. На будущее (заложено в архитектуру)

- Система оплаты/подписок (Telegram Payments)
- Интеграция с Apple Health / Google Fit
- Мультикоуч (несколько коучей на платформе)
- Групповые программы
- Генерация планов питания

---

## 14. Библиотеки

### Backend (Python)
- Django 5.1, djangorestframework, django-cors-headers, django-filter
- celery[redis], django-celery-beat
- psycopg 3, python-decouple, dj-database-url
- python-telegram-bot 21
- openai, anthropic
- boto3, django-storages
- weasyprint (PDF)
- httpx (async HTTP)
- djangorestframework-simplejwt
- Pillow (images)
- pydantic (AI response validation)
- sentry-sdk

### Frontend (JavaScript/TypeScript)
- React 19, react-router-dom 7, axios
- zustand (state management)
- @tanstack/react-query (data fetching)
- recharts (графики)
- tailwindcss 4
- @twa-dev/sdk (Mini App)
- react-hook-form + zod (Console формы)
- @headlessui/react (UI компоненты)
- lucide-react (иконки)
- vite 6, typescript 5.7, vitest (тесты)

---

## 15. Deploy (Render)

```yaml
services:
  - type: web          # Django API (Gunicorn)
  - type: worker       # Celery worker
  - type: worker       # Celery beat
  - type: static       # Mini App (React build)
  - type: static       # Console (React build)

databases:
  - PostgreSQL (Render Managed)

# + Render Redis add-on
```
