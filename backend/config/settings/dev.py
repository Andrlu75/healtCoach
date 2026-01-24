from .base import *  # noqa: F401, F403

DEBUG = True

INSTALLED_APPS += [  # noqa: F405
    'django_extensions',
    'debug_toolbar',
]

MIDDLEWARE.insert(0, 'debug_toolbar.middleware.DebugToolbarMiddleware')  # noqa: F405

INTERNAL_IPS = ['127.0.0.1', '172.0.0.0/8']

# Use local file storage in development
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
