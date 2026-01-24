import logging

import httpx
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_TTL = 900  # 15 minutes
OWM_API = 'https://api.openweathermap.org/data/2.5/weather'


def get_weather(city: str) -> dict | None:
    """
    Get current weather for a city via OpenWeatherMap.
    Results are cached for 15 minutes.
    """
    if not city:
        return None

    api_key = getattr(settings, 'OPENWEATHERMAP_API_KEY', '')
    if not api_key:
        logger.warning('OPENWEATHERMAP_API_KEY not configured')
        return None

    # Check cache
    cache_key = f'weather:{city.lower()}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Fetch from API
    try:
        resp = httpx.get(
            OWM_API,
            params={
                'q': city,
                'appid': api_key,
                'units': 'metric',
                'lang': 'ru',
            },
            timeout=10,
        )

        if resp.status_code != 200:
            logger.error('OpenWeatherMap error for %s: %s', city, resp.text)
            return None

        data = resp.json()

        result = {
            'city': data.get('name', city),
            'temp': round(data['main']['temp']),
            'feels_like': round(data['main']['feels_like']),
            'description': data['weather'][0]['description'] if data.get('weather') else '',
            'humidity': data['main']['humidity'],
            'wind_speed': round(data['wind']['speed'], 1),
            'icon': data['weather'][0]['icon'] if data.get('weather') else '',
        }

        # Cache result
        cache.set(cache_key, result, CACHE_TTL)
        return result

    except httpx.RequestError as e:
        logger.exception('Failed to fetch weather for %s: %s', city, e)
        return None
