# Архитектура проекта HealthCoach

## 1. Общая структура папок

```
healthCooach/
├── backend/                    # Django REST API + Telegram Bot
│   ├── apps/                   # Django приложения
│   │   ├── accounts/           # User, Coach, Client модели + Auth
│   │   ├── bot/                # Telegram webhook, handlers
│   │   ├── chat/               # ChatMessage, InteractionLog
│   │   ├── meals/              # Meal, MealDraft (анализ фото еды)
│   │   ├── metrics/            # HealthMetric (вес, сон, пульс и т.д.)
│   │   ├── exercises/          # Упражнения для тренировок
│   │   ├── workouts/           # Программы тренировок
│   │   ├── integrations/       # Google Fit, Huawei Health
│   │   ├── reminders/          # Напоминания + Celery задачи
│   │   ├── reports/            # Отчёты, PDF генерация
│   │   ├── persona/            # BotPersona, AIProviderConfig, TelegramBot
│   │   ├── onboarding/         # Инвайт-ссылки, вопросы анкеты
│   │   ├── weather/            # OpenWeatherMap интеграция
│   ├── core/                   # Ядро системы
│   │   ├── ai/                 # AI провайдеры абстракция
│   │   │   ├── base.py         # AbstractAIProvider, AIResponse
│   │   │   ├── openai_provider.py
│   │   │   ├── anthropic_provider.py
│   │   │   ├── deepseek_provider.py
│   │   │   ├── gemini_provider.py
│   │   │   ├── factory.py      # Factory pattern для AI
│   │   │   └── model_fetcher.py  # Кэширование моделей и цен
│   │   └── validators.py       # Валидаторы
│   ├── config/                 # Django конфигурация
│   │   ├── settings/
│   │   │   ├── base.py         # Основные настройки
│   │   │   ├── dev.py          # Для локальной разработки
│   │   │   └── prod.py         # Для production
│   │   ├── urls.py             # Главные URL маршруты
│   │   ├── wsgi.py, asgi.py    # WSGI/ASGI entry points
│   │   └── celery.py           # Celery конфигурация
│   ├── requirements/           # Зависимости Python
│   ├── db.sqlite3              # Локальная БД (SQLite)
│   └── manage.py               # Django management
│
├── frontend/
│   ├── miniapp/                # Telegram Mini App (React) для клиента
│   │   ├── src/
│   │   │   ├── features/       # Модули приложения
│   │   │   │   ├── auth/       # Авторизация через Telegram initData
│   │   │   │   ├── diary/      # Дневник питания, Dashboard
│   │   │   │   ├── meals/      # Компоненты добавления еды
│   │   │   │   ├── stats/      # Графики КБЖУ
│   │   │   │   ├── reminders/  # Напоминания
│   │   │   │   ├── profile/    # Профиль клиента
│   │   │   │   ├── workouts/   # Тренировки (новое)
│   │   │   │   └── integrations/ # Google Fit, Huawei Health
│   │   │   ├── shared/         # Общие компоненты, hooks, UI
│   │   │   ├── api/            # API клиент для miniapp
│   │   │   └── types/          # TypeScript типы
│   │   └── vite.config.ts      # Vite конфигурация
│   │
│   └── console/                # Web-консоль коуча (React)
│       ├── src/
│       │   ├── pages/          # Страницы консоли
│       │   │   ├── Dashboard.tsx         # Обзор всех клиентов
│       │   │   ├── Clients.tsx           # Список клиентов
│       │   │   ├── ClientDetail.tsx      # Карточка клиента (4 вкладки)
│       │   │   ├── Reports.tsx           # Отчёты
│       │   │   ├── Invites.tsx           # Управление инвайт-ссылками
│       │   │   ├── OnboardingEditor.tsx  # Редактор анкеты
│       │   │   ├── Logs.tsx              # Логи взаимодействий
│       │   │   ├── Login.tsx             # Авторизация коуча
│       │   │   ├── settings/
│       │   │   │   ├── AISettings.tsx         # Настройка AI провайдеров
│       │   │   │   ├── PersonaSettings.tsx   # Редактор персонажа бота
│       │   │   │   ├── TelegramSettings.tsx  # Настройка Telegram ботов
│       │   │   │   └── AccountSettings.tsx   # Профиль коуча
│       │   │   └── fitdb/             # Модуль тренировок (отдельный UI)
│       │   ├── components/     # React компоненты
│       │   ├── api/            # API клиент для console
│       │   ├── stores/         # Zustand store (auth)
│       │   └── types/          # TypeScript типы
│       └── vite.config.ts      # Vite конфигурация
│
├── docker-compose.yml          # Локальная разработка (PostgreSQL, Redis)
├── Makefile                    # Команды для разработки
└── docs/                       # Документация
```

---

## 2. Используемые технологии

### Backend (Python)
- **Django 5.1** - веб-фреймворк
- **Django REST Framework** - REST API
- **PostgreSQL 16** - база данных (prod), SQLite (локально)
- **Celery + Redis** - асинхронные задачи и кэширование
- **python-telegram-bot 21** - Telegram Bot API
- **OpenAI 1.60** - GPT-4, GPT-4o
- **Anthropic 0.42** - Claude (Sonnet, Haiku)
- **google-genai 1.0** - Gemini
- **google-auth-oauthlib** - OAuth для Google Fit
- **boto3 + django-storages** - S3 для хранения фото
- **Pillow** - обработка изображений (thumbnails)
- **WeasyPrint** - генерация PDF отчётов
- **httpx** - асинхронный HTTP клиент
- **pydantic** - валидация данных
- **python-decouple** - управление переменными окружения

### Frontend (JavaScript/TypeScript)
- **React 19** - UI фреймворк
- **Vite 6** - build tool
- **TypeScript 5.7** - типизация
- **React Router 7** - маршрутизация
- **Tailwind CSS 4** - стили
- **Zustand** - управление состоянием
- **@tanstack/react-query** - кэширование и синхронизация данных
- **Recharts** - графики (КБЖУ)
- **@twa-dev/sdk** - Telegram Web App API
- **axios** - HTTP клиент
- **Lucide React** - иконки
- **Framer Motion** - анимации
- **dayjs** - работа с датами

---

## 3. Структура базы данных (модели)

### Core Models (accounts/models.py)

```python
User (AbstractUser)
  - role: 'coach' | 'client'
  - Django встроенные поля: username, email, password и т.д.

Coach (OneToOneField -> User)
  - telegram_user_id
  - telegram_notification_chat_id
  - business_name
  - timezone (default: 'Europe/Moscow')
  - created_at, updated_at

Client (ForeignKey -> Coach)
  - telegram_user_id (unique)
  - telegram_username
  - first_name, last_name, city
  - timezone
  - status: 'pending' | 'active' | 'paused' | 'archived'
  - gender: 'male' | 'female'

  # Физиологические данные
  - height (см)
  - weight (кг)
  - age (полных лет)
  - birth_date
  - activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

  # Персональные нормы КБЖУ
  - daily_calories, daily_proteins, daily_fats, daily_carbs
  - daily_water (литры)

  # Режимы
  - manual_mode (BOOL - сохранение без AI анализа)
  - meal_analysis_mode: 'ask' | 'fast' | 'smart'
  - onboarding_completed (BOOL)
  - onboarding_data (JSON)
  - persona (ForeignKey -> BotPersona, nullable)
```

### Meal Models (meals/models.py)

```python
MealDraft (для умного режима "smart")
  - id: UUID
  - client (FK -> Client)
  - image (ImageField)
  - dish_name, dish_type
  - estimated_weight (г)
  - ai_confidence (0-1)

  # Редактируемые ингредиенты (JSON)
  - ingredients: [
      {
        "name": "Свёкла",
        "weight": 80,
        "calories": 35,
        "proteins": 1.2,
        "fats": 0.1,
        "carbs": 7.6,
        "is_ai_detected": true,
        "is_user_edited": false
      },
      ...
    ]

  - calories, proteins, fats, carbohydrates (итого)
  - status: 'pending' | 'confirmed' | 'cancelled'
  - created_at, confirmed_at
  - meal (OneToOneField -> Meal, после подтверждения)

  # Методы:
  - recalculate_nutrition()      # Пересчёт КБЖУ из ингредиентов
  - scale_by_weight(new_weight)  # Масштабирование по весу
  - update_ingredient(index, data)  # Редактирование ингредиента
  - remove_ingredient(index)     # Удаление ингредиента

Meal
  - client (FK -> Client)
  - image, thumbnail (ImageField)
  - image_type: 'food' | 'data' | 'other'
  - dish_name, dish_type
  - calories, proteins, fats, carbohydrates
  - ingredients (JSON список)
  - health_analysis (JSON)
  - ai_confidence (0-100)
  - ai_comment (TextField)
  - plate_type, layout, decorations
  - meal_time (DateTimeField)
  - created_at
```

### Chat & Interaction Models (chat/models.py)

```python
ChatMessage
  - client (FK -> Client)
  - role: 'user' | 'assistant' | 'system'
  - message_type: 'text' | 'voice' | 'photo' | 'audio'
  - content (TextField)
  - visible_to_user (BOOL)
  - ai_response_id (для цепочки вызовов OpenAI)
  - ai_provider (OpenAI | Anthropic | ...)
  - metadata (JSON)
  - telegram_message_id (BigInt)
  - read_by_coach (BOOL)
  - created_at

InteractionLog (детальное логирование каждого AI взаимодействия)
  - client (FK -> Client)
  - coach (FK -> Coach)
  - interaction_type: 'text' | 'vision' | 'voice'
  - client_input (TextField)
  - ai_request (JSON - промпт и параметры)
  - ai_response (JSON - результат анализа)
  - client_output (TextField - ответ клиенту)
  - provider (openai, anthropic, ...)
  - model (конкретная модель)
  - duration_ms
  - created_at
```

### Persona & AI Models (persona/models.py)

```python
BotPersona (OneToOne -> Coach + ForeignKey for clients)
  - coach (FK -> Coach)
  - is_default (BOOL)
  - name (персонаж, например "Фёдор")
  - age, city
  - style_description (дружеский/формальный/мотивирующий)
  - system_prompt (главный промпт для бота)
  - food_response_prompt (специальный промпт для анализа еды)
  - greeting_message

  # Отдельные AI настройки для text/vision/voice
  - text_provider, text_model
  - vision_provider, vision_model
  - voice_provider, voice_model
  - temperature, max_tokens

AIProviderConfig
  - coach (FK -> Coach)
  - provider: 'openai' | 'anthropic' | 'deepseek' | 'gemini'
  - api_key, admin_api_key
  - is_active (BOOL)
  - unique_together: [coach, provider]

AIUsageLog (логирование затрат)
  - coach (FK -> Coach)
  - client (FK -> Client, nullable)
  - provider, model, task_type
  - input_tokens, output_tokens
  - cost_usd
  - created_at

TelegramBot
  - coach (FK -> Coach)
  - name ("Тестовый", "Продуктивный")
  - username (@bot)
  - token
  - miniapp_short_name
  - is_active
  - created_at
```

### Reminder Model (reminders/models.py)

```python
Reminder
  - client (FK -> Client)
  - coach (FK -> Coach)
  - title, message
  - reminder_type: 'meal' | 'water' | 'workout' | 'weigh_in' | 'custom'
  - frequency: 'once' | 'daily' | 'weekly' | 'custom'
  - time (TimeField)
  - days_of_week (JSON - для weekly)
  - is_active (BOOL)
  - is_smart (BOOL - AI генерирует текст)
  - last_sent_at, next_fire_at
  - created_at
```

### Metrics Model (metrics/models.py)

```python
HealthMetric
  - client (FK -> Client)
  - metric_type: 'weight' | 'sleep' | 'steps' | 'heart_rate' | 'blood_pressure' | 'water'
  - value (FloatField)
  - unit (CharField)
  - notes (TextField)
  - source: 'manual' | 'photo' | 'fitness_tracker'
  - recorded_at
```

### Onboarding Models (onboarding/models.py)

```python
InviteLink
  - coach (FK -> Coach)
  - code (unique)
  - is_active (BOOL)
  - max_uses, uses_count
  - expires_at

OnboardingQuestion
  - coach (FK -> Coach)
  - text, question_type: 'text' | 'number' | 'choice' | 'multi_choice' | 'date'
  - options (JSON)
  - is_required (BOOL)
  - order (IntegerField)
  - field_key (маппинг на поле Client)
```

---

## 4. Консоль коуча (Web Console)

### Структура: `/frontend/console/src`

#### Главные страницы:

1. **Dashboard** (`pages/Dashboard.tsx`)
   - Обзор всех клиентов в сетке
   - Статус активности каждого
   - Быстрый переход на карточку клиента
   - Фильтры и поиск

2. **Clients** (`pages/Clients.tsx`)
   - Список клиентов с фильтрами
   - Поиск по имени
   - Сортировка по статусу
   - Кнопка добавить нового

3. **ClientDetail** (`pages/ClientDetail.tsx`) — ГЛАВНАЯ КАРТОЧКА

   **4 основные вкладки:**

   a) **"Питание" (Meals)**
      - История всех приёмов пищи с фото
      - Детальный анализ каждого блюда (КБЖУ, ингредиенты)
      - Фильтр по дате
      - Возможность редактировать КБЖУ
      - Удаление неправильно распознанных

   b) **"Метрики" (Metrics)**
      - График веса по дням/неделям
      - Остальные метрики (сон, пульс, шаги и т.д.)
      - Добавление новых метрик вручную
      - Интеграция с фото (если на фото весы)

   c) **"Чат" (Chat)**
      - История всех сообщений с AI
      - Фильтр по типу (text, voice, photo)
      - Время отправки, AI модель использовавшаяся
      - Просмотр полного AI промпта и ответа

   d) **"Настройки" (Settings)**
      - Редактирование профиля (имя, город, timezone)
      - Физиологические данные (пол, рост, вес, возраст, активность)
      - Персональные нормы КБЖУ (расчёт или ручное переопределение)
      - Привязка персонажа бота
      - Смена статуса клиента

4. **Reports** (`pages/Reports.tsx`)
   - Генерация отчётов (ежедневные, еженедельные)
   - Просмотр КБЖУ за период
   - Экспорт в PDF
   - Отправка отчёта в Telegram клиенту

5. **Invites** (`pages/Invites.tsx`)
   - Генерация инвайт-ссылок для новых клиентов
   - Управление ссылками (активировать/деактивировать)
   - Просмотр использованных ссылок
   - Установка лимита использований

6. **OnboardingEditor** (`pages/OnboardingEditor.tsx`)
   - Конструктор вопросов для анкеты при регистрации
   - Добавление/редактирование/удаление вопросов
   - Выбор типа вопроса (текст, число, выбор, многовыбор, дата)
   - Привязка ответов к полям Client модели

7. **Logs** (`pages/Logs.tsx`)
   - Лог всех AI взаимодействий
   - Фильтр по типу (text, vision, voice)
   - Просмотр input токенов, output токенов, стоимости
   - Поиск по клиенту или дате

#### Настройки коуча (`pages/settings/`)

1. **AISettings.tsx** — Управление AI провайдерами
   - Список подключённых провайдеров (OpenAI, Anthropic, Deepseek, Gemini)
   - Добавление API ключей
   - Выбор активного провайдера для каждого типа (text/vision/voice)
   - Выбор конкретной модели (gpt-4o, claude-sonnet, и т.д.)
   - Просмотр стоимости использованных токенов

2. **PersonaSettings.tsx** — Редактор персонажа бота
   - Имя, возраст, город персонажа
   - Описание стиля (дружеский/формальный)
   - Главный system prompt (полностью редактируемый)
   - food_response_prompt (что AI пишет после анализа еды)
   - greeting_message (приветствие)
   - Настройка temperature и max_tokens

3. **TelegramSettings.tsx** — Управление Telegram ботами
   - Регистрация новых ботов (токен, short_name)
   - Активация/деактивация ботов
   - Просмотр статуса (подключен ли webhook)
   - Тестирование webhook

4. **AccountSettings.tsx** — Профиль коуча
   - Email, пароль
   - Бизнес-название
   - Timezone (для правильного расчёта времени напоминаний)
   - Привязка Telegram аккаунта для уведомлений

---

## 5. Miniapp приложение клиента (Telegram Mini App)

### Структура: `/frontend/miniapp/src`

#### Основные экраны:

1. **Dashboard** (`features/diary/Dashboard.tsx`) — Главная страница
   - Приветствие: "Привет, [имя]!"
   - **Карточка КБЖУ за сегодня** (4 колонки):
     - Ккал (текущее/норма, прогресс-бар)
     - Белки (г)
     - Жиры (г)
     - Углеводы (г)
   - **Список приёмов пищи за день** (сегодня):
     - Миниатюра фото
     - Название блюда
     - КБЖУ для блюда
     - Время добавления
   - **Кнопка "+ Добавить приём пищи"**:
     - Если `meal_analysis_mode == 'ask'` → меню выбора режима (Fast/Smart)
     - Если `meal_analysis_mode == 'fast'` → сразу на быстрый анализ
     - Если `meal_analysis_mode == 'smart'` → сразу на умный анализ с редактированием

2. **Diary** (`features/diary/Diary.tsx`) — Дневник питания
   - Список всех приёмов пищи (с фильтром по дате)
   - Карточка каждого приёма с:
     - Фото (thumbnail)
     - Название, время, КБЖУ
     - Список ингредиентов
   - Удаление приёма пищи
   - Переход в детальное редактирование

3. **AddMeal (Fast Mode)** - Быстрое добавление
   - Загрузка фото еды
   - AI анализирует и показывает результат (КБЖУ, ингредиенты)
   - Возможность исправить название или вес
   - Кнопка "Сохранить"
   - В фоне отправляется в Telegram боту с AI ответом

4. **AddMeal (Smart Mode)** - Умное добавление с редактированием
   - Загрузка фото еды
   - AI анализирует → создаётся MealDraft
   - Экран подтверждения с **редактируемым списком ингредиентов**:
     - Каждый ингредиент:
       - Название
       - Вес (г) → пересчитываются КБЖУ пропорционально
       - Калории, Б, Ж, У (можно редактировать)
       - Кнопка "X" (удалить)
     - Кнопка "+ Добавить ингредиент" → AI рассчитывает новый
   - **Пересчёт общего веса/КБЖУ** при изменении порции
   - Кнопка "Подтвердить" → сохранение Meal + MealDraft

5. **Stats** (`features/stats/Stats.tsx`) — Статистика
   - Графики с Recharts:
     - **КБЖУ за неделю** (столбцы: факт vs норма)
     - **Тренд калорий** (линейный график)
   - Выбор периода (неделя, месяц)
   - Экспорт данных (если нужно)

6. **Profile** (`features/profile/Profile.tsx`) — Профиль
   - Личные данные:
     - Имя, город, timezone
   - Физиологические данные (редактируемые):
     - Пол, возраст, рост, вес
   - Персональные нормы КБЖУ:
     - daily_calories, daily_proteins, daily_fats, daily_carbs
   - Результат анкеты (onboarding_data)
   - Кнопка сохранить изменения

7. **Reminders** (`features/reminders/`) — Напоминания
   - Список активных напоминаний
   - Добавление нового напоминания:
     - Выбор типа (приём пищи, вода, тренировка, взвешивание)
     - Время
     - Дни недели (для weekly)
   - Включение/выключение
   - Удаление

8. **Integrations** (`features/integrations/`) — Интеграции здоровья
   - Подключение Google Fit
   - Подключение Huawei Health
   - Импорт метрик (шаги, калории, сон, пульс)

9. **Workouts** (`features/workouts/`) — Тренировки
   - Список тренировочных программ
   - Запуск тренировки (засекание времени упражнений)
   - История пройденных тренировок

#### Авторизация
- Через Telegram Web App `initData` (никаких логинов/паролей)
- **AuthGate** проверяет валидность подписи инициализации
- Получение информации о клиенте при входе

#### API endpoints для miniapp

```
GET /api/miniapp/dashboard/       → daily summary (КБЖУ, remaining)
GET /api/miniapp/meals/           → список приёмов пищи
POST /api/miniapp/meals/          → добавление нового приёма (fast режим)
GET /api/miniapp/meals/:id/       → детали приёма
PUT /api/miniapp/meals/:id/       → редактирование приёма
DELETE /api/miniapp/meals/:id/    → удаление приёма

GET /api/miniapp/stats/           → статистика КБЖУ за период
GET /api/miniapp/reminders/       → список напоминаний
POST/PUT /api/miniapp/reminders/  → управление напоминаниями

GET /api/miniapp/profile/         → профиль клиента
PUT /api/miniapp/profile/         → обновление профиля

# Для умного режима
POST /api/miniapp/drafts/          → создание MealDraft
PUT /api/miniapp/drafts/:id/       → редактирование ингредиентов
POST /api/miniapp/drafts/:id/confirm/ → подтверждение → Meal

# Интеграции
GET /api/integrations/google-fit/  → подключение Google Fit
GET /api/integrations/huawei/      → подключение Huawei Health
```

---

## 6. Обработка фото еды (анализ ингредиентов)

### Общий flow обработки фото:

```
Пользователь отправляет фото в Telegram
         ↓
[telegram_webhook] Получает Update от Telegram
         ↓
[dispatch] Маршрутизирует на handle_photo()
         ↓
classify_image() — классификация: food/data/other
         ├─ food  → analyze_food() или analyze_food_smart()
         ├─ data  → парсинг цифровых показателей
         └─ other → просто сохранить описание
```

### 6.1 Быстрый режим (fast) - `apps/meals/services.py`

**Функция:** `classify_and_analyze()`
- **Один AI вызов** - и классификация, и анализ в одном
- **Prompt:** `CLASSIFY_AND_ANALYZE_PROMPT`
- **Результат JSON:**
  ```json
  {
    "type": "food",
    "dish_name": "Паста Карбонара",
    "dish_type": "обед",
    "calories": 450,
    "proteins": 20,
    "fats": 25,
    "carbohydrates": 45,
    "ingredients": ["макароны", "бекон", "яйца", "сливки"],
    "confidence": 85
  }
  ```

**Дальше:**
1. Сохраняется Meal в БД
2. Генерируется AI ответ (persona.food_response_prompt)
3. Отправляется в Telegram боту текстом:
   ```
   *Паста Карбонара*
   Ккал: 450 | Б: 20 | Ж: 25 | У: 45

   Приём пищи #1 за сегодня
   Остаток на день:
   Ккал: 1550 | Б: 80 | Ж: 45 | У: 205
   ```

### 6.2 Умный режим (smart) - `apps/meals/services.py`

**Функция:** `analyze_food_smart()`
- **Детальный анализ** с полным списком ингредиентов
- **Prompt:** `ANALYZE_FOOD_SMART_PROMPT` (профессиональный нутрициолог)
- **Параметры:**
  - `json_mode=True` (OpenAI гарантирует JSON)
  - `detail='high'` (высокая детализация для зрения)
  - `temperature=0.2` (низкая для стабильности)
  - `max_tokens=4096` (место для детального анализа)

**Результат:**
```json
{
  "dish_name": "Салат Цезарь",
  "dish_type": "обед",
  "estimated_weight": 300,
  "ingredients": [
    {"name": "Салат романо", "weight": 80, "calories": 16, "proteins": 1.2, "fats": 0.2, "carbs": 3},
    {"name": "Куриная грудка", "weight": 100, "calories": 165, "proteins": 31, "fats": 3.6, "carbs": 0},
    {"name": "Пармезан", "weight": 20, "calories": 80, "proteins": 7, "fats": 6, "carbs": 0.4},
    {"name": "Сухарики", "weight": 30, "calories": 120, "proteins": 3, "fats": 3, "carbs": 20},
    {"name": "Соус Цезарь", "weight": 40, "calories": 280, "proteins": 2, "fats": 28, "carbs": 2},
    {"name": "Масло оливковое", "weight": 15, "calories": 120, "proteins": 0, "fats": 14, "carbs": 0}
  ],
  "calories": 781,
  "proteins": 44,
  "fats": 55,
  "carbohydrates": 25,
  "confidence": 92
}
```

**Создаётся MealDraft:**
- Статус: `pending` (ожидает подтверждения)
- Ингредиенты с флагом `is_ai_detected: true`
- Пользователь видит в miniapp экран редактирования

**Пользователь может:**
1. **Изменить название** блюда
2. **Изменить вес порции** → ингредиенты пересчитываются пропорционально
   - Метод: `draft.scale_by_weight(new_weight)`
   - Ингредиенты с `is_user_edited=False` пересчитываются
   - Ингредиенты с `is_user_edited=True` остаются фиксированными

3. **Редактировать каждый ингредиент:**
   - Название
   - Вес → КБЖУ пересчитываются пропорционально
   - КБЖУ напрямую → ингредиент помечается как `is_user_edited=True`
   - Удалить ингредиент (кнопка "X")
   - Метод: `draft.update_ingredient(index, data)`

4. **Добавить ингредиент:**
   - `add_ingredient_to_draft(draft, ingredient_name)`
   - AI сам рассчитывает разумный вес и КБЖУ
   - Добавляется с флагом `is_ai_detected: False`

5. **Отклонить:**
   - `cancel_draft(draft)` → статус `cancelled`

**При подтверждении (confirm):**
- `confirm_draft(draft)` → создаётся Meal
- Копируется изображение
- Ингредиенты сохраняются в `health_analysis.detailed_ingredients`
- Статус MealDraft: `confirmed`

### 6.3 Коррекция/переанализ

**Во время разговора в Telegram (fast режим):**
- Пользователь отправляет текст после фото
- `is_meal_correction()` спрашивает AI: "Это уточнение к предыдущему блюду?"
- Если YES → `recalculate_meal(bot, meal, user_text)`
  - Prompt: `RECALCULATE_PROMPT`
  - AI переделает КБЖУ с учётом уточнения
  - Meal обновляется в БД

**В miniapp (smart режим):**
- Пользователь может менять ингредиенты до подтверждения
- `recalculate_meal_for_client()` - переанализ с уточнением

### 6.4 Анализ "цифровых данных"

Если на фото **весы, анализы крови, скриншот трекера**:
1. `classify_image()` вернёт `data`
2. Просто сохраняется как Meal с `image_type='data'`
3. Парсинг числовых значений (если есть) → HealthMetric

### 6.5 Логирование и стоимость

Каждый AI вызов логируется в **AIUsageLog**:
```python
AIUsageLog.objects.create(
    coach=client.coach,
    provider='openai',      # Какой провайдер
    model='gpt-4o',         # Какая модель
    task_type='vision',     # text, vision, voice
    input_tokens=1024,      # Входные токены
    output_tokens=256,      # Выходные токены
    cost_usd=0.012345,      # Стоимость из pricing (кэшированная)
)
```

Коуч видит в **Logs** странице:
- Каждый анализ еды
- Сколько стоил анализ
- Какую модель использовал
- Полный промпт и ответ AI

---

## Итоговая таблица ключевых компонентов

| Компонент | Назначение | Технология | Файл |
|-----------|-----------|-----------|------|
| Telegram Bot | Получение фото/текст | python-telegram-bot 21 | `apps/bot/webhook.py` |
| AI Анализ | Классификация + КБЖУ | OpenAI/Anthropic/Gemini | `apps/meals/services.py` |
| Модель Meal | Хранение приёмов пищи | Django ORM + PostgreSQL | `apps/meals/models.py` |
| Модель MealDraft | Умный режим редактирования | Django ORM + PostgreSQL | `apps/meals/models.py` |
| Dashboard коуча | Обзор клиентов | React 19 + Tailwind | `frontend/console/src/pages/Dashboard.tsx` |
| ClientDetail | Управление одним клиентом | React 19 + Zustand | `frontend/console/src/pages/ClientDetail.tsx` |
| Miniapp Dashboard | Главная клиента (КБЖУ) | React 19 + @twa-dev/sdk | `frontend/miniapp/src/features/diary/Dashboard.tsx` |
| Miniapp Stats | Графики КБЖУ | React 19 + Recharts | `frontend/miniapp/src/features/stats/Stats.tsx` |
| Напоминания | Расписание задач | Celery + Redis | `apps/reminders/tasks.py` |
| Отчёты | PDF генерация | WeasyPrint | `apps/reports/models.py` |
