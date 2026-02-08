import sys
from decouple import config  # noqa: E402

from .base import *  # noqa: F401, F403

DEBUG = False

# SECURITY: Проверяем что критические ключи установлены
if 'dev-only' in SECRET_KEY or 'insecure' in SECRET_KEY:
    print("CRITICAL ERROR: SECRET_KEY не настроен для production!", file=sys.stderr)
    sys.exit(1)

if not ENCRYPTION_KEY or ENCRYPTION_KEY == 'zV6OM0v6JUcS7pGN_-oP8XxWJZxVlH5Kv7N8fDl3yxo=':
    print("CRITICAL ERROR: ENCRYPTION_KEY не настроен для production!", file=sys.stderr)
    sys.exit(1)

# Database connection pooling - reuse connections instead of creating new ones
DATABASES['default']['CONN_MAX_AGE'] = 60  # Keep connections alive for 60 seconds
DATABASES['default']['CONN_HEALTH_CHECKS'] = True  # Check connection health before reuse

# Logging to stdout for Render
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {name}: {message}',
            'style': '{',
        },
        'audit': {
            'format': '[AUDIT] {asctime} {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'audit_console': {
            'class': 'logging.StreamHandler',
            'formatter': 'audit',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'apps.bot': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'audit': {
            'handlers': ['audit_console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Security
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# HSTS (HTTP Strict Transport Security)
# Браузер будет всегда использовать HTTPS для этого домена
SECURE_HSTS_SECONDS = 31536000  # 1 год
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# X-Frame-Options для защиты от clickjacking
X_FRAME_OPTIONS = 'DENY'

# Referrer Policy для защиты приватности
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# CSRF trusted origins for Railway
CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='https://*.up.railway.app',
    cast=Csv()
)

# CORS for Railway - add production domains
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='https://healthcoach-console-production.up.railway.app,https://healthcoach-miniapp-production.up.railway.app',
    cast=Csv()
)

# Whitenoise for static files
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')

# Audit logging middleware для логирования доступа к health data
MIDDLEWARE.append('core.audit.AuditLoggingMiddleware')

# Cache — use Redis if available, otherwise locmem
REDIS_URL = config('REDIS_URL', default='')
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        },
    }
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        },
    }

# Cloudflare R2 Storage (S3-compatible)
R2_ACCESS_KEY = config('R2_ACCESS_KEY_ID', default='')
if R2_ACCESS_KEY:
    AWS_ACCESS_KEY_ID = R2_ACCESS_KEY
    AWS_SECRET_ACCESS_KEY = config('R2_SECRET_ACCESS_KEY', default='')
    AWS_STORAGE_BUCKET_NAME = config('R2_BUCKET_NAME', default='healthcoach')
    AWS_S3_ENDPOINT_URL = config('R2_ENDPOINT_URL', default='')
    AWS_S3_REGION_NAME = 'auto'
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_FILE_OVERWRITE = False
    # Django 4.2+ uses STORAGES instead of DEFAULT_FILE_STORAGE
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
else:
    # Fallback when R2 is not configured
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

# Sentry
import sentry_sdk  # noqa: E402

SENTRY_DSN = config('SENTRY_DSN', default='')
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.1,
    )
