from django.conf import settings

from .base import AbstractAIProvider
from .openai_provider import OpenAIProvider
from .deepseek_provider import DeepSeekProvider

PROVIDERS = {
    'openai': OpenAIProvider,
    'deepseek': DeepSeekProvider,
}


def get_ai_provider(provider_name: str = None, api_key: str = None) -> AbstractAIProvider:
    provider_name = provider_name or settings.AI_CONFIG['default_provider']

    if provider_name not in PROVIDERS:
        raise ValueError(f'Unknown AI provider: {provider_name}. Available: {list(PROVIDERS.keys())}')

    if not api_key:
        api_key = settings.AI_CONFIG.get(provider_name, {}).get('api_key', '')

    if not api_key:
        raise ValueError(f'API key not configured for provider: {provider_name}')

    return PROVIDERS[provider_name](api_key=api_key)
