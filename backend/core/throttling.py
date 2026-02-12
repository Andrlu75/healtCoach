"""
Throttle классы, использующие locmem кеш вместо Redis.

Это предотвращает зависание запросов при недоступности Redis,
так как DRF throttle обращается к кешу при каждом запросе.
"""
from django.core.cache import caches
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class SafeAnonRateThrottle(AnonRateThrottle):
    cache = caches['throttle']


class SafeUserRateThrottle(UserRateThrottle):
    cache = caches['throttle']
