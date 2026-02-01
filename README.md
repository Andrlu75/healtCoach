# HealthCoach

Платформа для тренеров по питанию с AI-ассистентом. Включает Telegram-бота для клиентов, MiniApp для дневника питания и консоль управления для тренеров.

---

## Технологический стек

### Backend (Python 3.11+ / Django)

| Категория | Технология | Версия |
|-----------|------------|--------|
| **Framework** | Django | 5.1.4 |
| **API** | Django REST Framework | 3.15.2 |
| **Auth** | SimpleJWT + dj-rest-auth | 5.4.0 / 7.0.1 |
| **Database** | PostgreSQL (psycopg) | 3.2.4 |
| **Queue** | Celery + django-celery-beat | 5.4.0 / 2.7.0 |
| **Cache/Broker** | Redis | 5.2.1 |
| **Telegram Bot** | python-telegram-bot | 21.9 |
| **AI: OpenAI** | openai | 1.60.2 |
| **AI: Anthropic** | anthropic | 0.42.0 |
| **AI: Google** | google-genai | 1.0.0 |
| **Storage** | boto3 + django-storages | 1.35.92 / 1.14.4 |
| **Images** | Pillow | 11.1.0 |
| **PDF** | WeasyPrint | 63.1 |
| **HTTP Client** | httpx | 0.28.1 |
| **Validation** | Pydantic | 2.10.5 |
| **Monitoring** | Sentry | 2.19.2 |

### Frontend Console (Панель тренера)

| Категория | Технология | Версия |
|-----------|------------|--------|
| **Framework** | React | 19.2.0 |
| **Language** | TypeScript | 5.9.3 |
| **Build** | Vite | 7.2.4 |
| **Styling** | Tailwind CSS | 4.x |
| **UI** | Radix UI + Headless UI | 2.x |
| **Data** | TanStack Query | 5.90.20 |
| **Forms** | React Hook Form + Zod | 7.71.1 / 4.3.6 |
| **Routing** | React Router | 7.13.0 |
| **HTTP** | Axios | 1.13.2 |

### Frontend MiniApp (Telegram WebApp)

| Категория | Технология | Версия |
|-----------|------------|--------|
| **Framework** | React | 19.2.0 |
| **Language** | TypeScript | 5.9.3 |
| **Build** | Vite | 7.2.4 |
| **Telegram** | @twa-dev/sdk | 8.0.2 |
| **Styling** | Tailwind CSS | 4.x |
| **Animations** | Framer Motion | 12.29.0 |
| **State** | Zustand | 5.0.10 |
| **Data** | TanStack Query | 5.90.20 |
| **Charts** | Recharts | 3.7.0 |

### Infrastructure

| Компонент | Технология |
|-----------|------------|
| **Hosting** | Railway |
| **Database** | Railway PostgreSQL |
| **Queue/Cache** | Railway Redis |
| **File Storage** | Cloudflare R2 |
| **Static Files** | WhiteNoise |
| **CI/CD** | Auto-deploy on git push |

---

## Интеграции

- **Telegram Bot API** — обработка сообщений, фото, уведомления тренерам
- **Telegram MiniApp** — WebApp для клиентов (дневник питания, тренировки)
- **Google Fit** — синхронизация шагов, пульса, сна с умных часов
- **AI Vision** — анализ фото еды (OpenAI GPT-4o, Google Gemini)
- **AI Text** — генерация ответов, отчётов (OpenAI, Anthropic Claude, DeepSeek)

---

## Структура проекта

```
healthCoach/
├── backend/                 # Django API
│   ├── apps/
│   │   ├── accounts/        # Пользователи, клиенты, тренеры
│   │   ├── bot/             # Telegram bot handlers
│   │   ├── chat/            # История взаимодействий
│   │   ├── integrations/    # Google Fit
│   │   ├── meals/           # Приёмы пищи, анализ фото
│   │   ├── metrics/         # Метрики здоровья (вес, шаги, сон)
│   │   ├── nutrition_programs/  # Программы питания
│   │   ├── persona/         # AI-персоны ботов
│   │   ├── reports/         # Генерация отчётов
│   │   └── workouts/        # Тренировки
│   ├── core/
│   │   └── ai/              # AI провайдеры (OpenAI, Anthropic, Gemini)
│   └── config/              # Django settings
├── frontend/
│   ├── console/             # React SPA для тренеров
│   └── miniapp/             # Telegram MiniApp для клиентов
└── README.md
```

---

## Локальная разработка

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
python manage.py migrate
python manage.py runserver
```

### Frontend Console

```bash
cd frontend/console
npm install
npm run dev
```

### Frontend MiniApp

```bash
cd frontend/miniapp
npm install
npm run dev
```
