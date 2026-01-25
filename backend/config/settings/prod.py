from decouple import config  # noqa: E402

from .base import *  # noqa: F401, F403

DEBUG = False

# Logging to stdout for Render
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
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
    },
}

# Security
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Whitenoise for static files
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

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

# Cloudflare R2 Storage (S3-compatible) - temporarily disabled for debugging
# R2_ACCESS_KEY = config('R2_ACCESS_KEY_ID', default='')
# if R2_ACCESS_KEY:
#     AWS_ACCESS_KEY_ID = R2_ACCESS_KEY
#     AWS_SECRET_ACCESS_KEY = config('R2_SECRET_ACCESS_KEY', default='')
#     AWS_STORAGE_BUCKET_NAME = config('R2_BUCKET_NAME', default='healthcoach')
#     AWS_S3_ENDPOINT_URL = config('R2_ENDPOINT_URL', default='')
#     AWS_S3_REGION_NAME = 'auto'
#     AWS_DEFAULT_ACL = None
#     AWS_QUERYSTRING_AUTH = True
#     AWS_S3_FILE_OVERWRITE = False
#     DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

# Sentry
import sentry_sdk  # noqa: E402

SENTRY_DSN = config('SENTRY_DSN', default='')
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.1,
    )
