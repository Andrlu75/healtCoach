from pathlib import Path
from decouple import config, Csv
from datetime import timedelta
import dj_database_url
from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SECURITY: SECRET_KEY должен быть установлен в env, дефолт только для локальной разработки
SECRET_KEY = config('DJANGO_SECRET_KEY', default='dev-only-insecure-key-DO-NOT-USE-IN-PRODUCTION')
DEBUG = config('DJANGO_DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',  # для BLACKLIST_AFTER_ROTATION
    'corsheaders',
    'django_filters',
    'django_celery_beat',
    'storages',
    # Local apps
    'apps.accounts',
    'apps.chat',
    'apps.meals',
    'apps.metrics',
    'apps.onboarding',
    'apps.reminders',
    'apps.reports',
    'apps.persona',
    'apps.weather',
    'apps.bot',
    'apps.exercises',
    'apps.workouts',
    'apps.integrations',
    'apps.nutrition_programs',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
# SECURITY: DATABASE_URL должен быть установлен в env для production
DATABASES = {
    'default': dj_database_url.config(
        default=config('DATABASE_URL', default='sqlite:///db.sqlite3')
    )
}

# Auth
AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'ru'
TIME_ZONE = 'Europe/Moscow'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# DRF
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    # Rate limiting (anti-spam protection)
    # Используем SafeThrottle с locmem кешем — не зависит от Redis
    'DEFAULT_THROTTLE_CLASSES': [
        'core.throttling.SafeAnonRateThrottle',
        'core.throttling.SafeUserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        # SECURITY: Отдельные лимиты для AI endpoints (дорогостоящие вызовы)
        'ai_hourly': '20/hour',
        'ai_daily': '100/day',
    },
}

# JWT
# SECURITY: Уменьшены сроки действия токенов для безопасности health data
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),  # было 12 часов
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),     # было 30 дней
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,  # отозванные refresh токены добавляются в blacklist
}

# CORS
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://localhost:3001',
    cast=Csv()
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# Redis
REDIS_URL = config('REDIS_URL', default='redis://localhost:6379/0')

# Cache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
    },
    # Локальный кеш для throttling — не зависит от Redis
    'throttle': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'throttle-cache',
    },
}

# Celery
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://localhost:6379/1')
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_TIMEZONE = 'Europe/Moscow'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_BEAT_SCHEDULE = {
    'check-reminders-every-minute': {
        'task': 'reminders.check_reminders',
        'schedule': 60.0,
    },
    'generate-daily-reports': {
        'task': 'reports.generate_daily_reports',
        'schedule': crontab(hour=22, minute=0),
    },
    'generate-weekly-reports': {
        'task': 'reports.generate_weekly_reports',
        'schedule': crontab(hour=10, minute=0, day_of_week=1),
    },
    'sync-google-fit-hourly': {
        'task': 'integrations.sync_all_google_fit',
        'schedule': 3600.0,  # каждый час
    },
    'sync-huawei-health-hourly': {
        'task': 'integrations.sync_all_huawei_health',
        'schedule': 3600.0,  # каждый час
    },
}

# S3 Storage
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default='')
AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME', default='')
AWS_S3_ENDPOINT_URL = config('AWS_S3_ENDPOINT_URL', default='')
AWS_S3_REGION_NAME = config('AWS_S3_REGION_NAME', default='eu-central-1')
AWS_DEFAULT_ACL = None
AWS_S3_FILE_OVERWRITE = False

# AI Configuration
AI_CONFIG = {
    'default_provider': config('DEFAULT_AI_PROVIDER', default='openai'),
    'default_model': config('DEFAULT_AI_MODEL', default='gpt-4o'),
    'openai': {
        'api_key': config('OPENAI_API_KEY', default=''),
    },
    'anthropic': {
        'api_key': config('ANTHROPIC_API_KEY', default=''),
    },
}

# Telegram
TELEGRAM_WEBHOOK_BASE_URL = config('TELEGRAM_WEBHOOK_BASE_URL', default='')
TELEGRAM_WEBHOOK_SECRET = config('TELEGRAM_WEBHOOK_SECRET', default='')
TELEGRAM_MINIAPP_URL = config('TELEGRAM_MINIAPP_URL', default='')
REPORTS_TELEGRAM_DELIVERY_ENABLED = config(
    'REPORTS_TELEGRAM_DELIVERY_ENABLED',
    default=False,
    cast=bool,
)

# Weather
OPENWEATHERMAP_API_KEY = config('OPENWEATHERMAP_API_KEY', default='')

# Google Fit Integration
GOOGLE_FIT_CLIENT_ID = config('GOOGLE_FIT_CLIENT_ID', default='')
GOOGLE_FIT_CLIENT_SECRET = config('GOOGLE_FIT_CLIENT_SECRET', default='')
GOOGLE_FIT_REDIRECT_URI = config('GOOGLE_FIT_REDIRECT_URI', default='http://localhost:8000/api/integrations/google-fit/callback/')

# Huawei Health Kit Integration
HUAWEI_HEALTH_CLIENT_ID = config('HUAWEI_HEALTH_CLIENT_ID', default='')
HUAWEI_HEALTH_CLIENT_SECRET = config('HUAWEI_HEALTH_CLIENT_SECRET', default='')
HUAWEI_HEALTH_REDIRECT_URI = config('HUAWEI_HEALTH_REDIRECT_URI', default='http://localhost:8000/api/integrations/huawei-health/callback/')

# Encryption key for tokens (Fernet) - generate with: from cryptography.fernet import Fernet; Fernet.generate_key()
# SECURITY: ENCRYPTION_KEY ОБЯЗАТЕЛЬНО должен быть уникальным в production!
ENCRYPTION_KEY = config('ENCRYPTION_KEY', default='')

# File upload limits
MAX_IMAGE_UPLOAD_SIZE = config('MAX_IMAGE_UPLOAD_SIZE', default=10 * 1024 * 1024, cast=int)  # 10 MB

# SECURITY: Ограничение размера request body для защиты от DoS
# Django default = 2.5 MB, устанавливаем явно для безопасности
DATA_UPLOAD_MAX_MEMORY_SIZE = config('DATA_UPLOAD_MAX_MEMORY_SIZE', default=5 * 1024 * 1024, cast=int)  # 5 MB
