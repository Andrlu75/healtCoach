"""Token counting utilities for AI context management."""

import functools
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Лимиты контекста для разных моделей (в токенах)
MODEL_CONTEXT_LIMITS = {
    # OpenAI
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
    'gpt-5': 200000,
    'gpt-5-mini': 200000,
    'gpt-5-nano': 100000,
    # Anthropic
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    'claude-3-5-sonnet': 200000,
    'claude-3-5-haiku': 200000,
    # DeepSeek
    'deepseek-chat': 64000,
    'deepseek-reasoner': 64000,
    # Default
    'default': 16000,
}

# Резерв токенов для ответа модели
RESPONSE_TOKEN_RESERVE = 2000


def _get_encoding_name(model: str) -> str:
    """Определить тип encoding для модели."""
    # Для GPT-4o и новых моделей используется o200k_base
    if model.startswith(('gpt-4o', 'gpt-5', 'o1', 'o3')):
        return 'o200k_base'
    # Для GPT-4, GPT-3.5-turbo, Claude и других используется cl100k_base
    return 'cl100k_base'


@functools.lru_cache(maxsize=4)
def _get_tiktoken_encoding_cached(encoding_name: str):
    """Получить tiktoken encoding по имени (с кэшированием)."""
    try:
        import tiktoken
    except ImportError:
        logger.warning('tiktoken not installed, token counting disabled')
        return None

    try:
        return tiktoken.get_encoding(encoding_name)
    except Exception as e:
        logger.warning(f'Failed to get tiktoken encoding {encoding_name}: {e}')
        return None


def _get_tiktoken_encoding(model: str):
    """Получить tiktoken encoding для модели."""
    encoding_name = _get_encoding_name(model)
    return _get_tiktoken_encoding_cached(encoding_name)


def count_tokens(text: str | None, model: str = 'gpt-4o') -> int:
    """Подсчитать количество токенов в тексте.

    Args:
        text: Текст для подсчёта (None обрабатывается как пустая строка)
        model: Модель для выбора токенизатора

    Returns:
        Количество токенов (или приблизительная оценка если tiktoken недоступен)
    """
    if not text:
        return 0

    encoding = _get_tiktoken_encoding(model)
    if encoding:
        return len(encoding.encode(text))

    # Fallback: приблизительная оценка (4 символа = 1 токен)
    return len(text) // 4


def count_messages_tokens(messages: list[dict], model: str = 'gpt-4o') -> int:
    """Подсчитать количество токенов в списке сообщений.

    Args:
        messages: Список сообщений в формате [{'role': '...', 'content': '...'}]
        model: Модель для выбора токенизатора

    Returns:
        Общее количество токенов
    """
    total = 0
    # Overhead per message (примерно 4 токена на сообщение для метаданных)
    per_message_overhead = 4

    for msg in messages:
        total += per_message_overhead
        total += count_tokens(msg.get('content') or '', model)
        total += count_tokens(msg.get('role') or '', model)

    # Overhead для всего запроса
    total += 3

    return total


def get_context_limit(model: str) -> int:
    """Получить лимит контекста для модели.

    Args:
        model: ID модели

    Returns:
        Лимит контекста в токенах
    """
    # Ищем точное совпадение
    if model in MODEL_CONTEXT_LIMITS:
        return MODEL_CONTEXT_LIMITS[model]

    # Ищем по префиксу
    for prefix, limit in MODEL_CONTEXT_LIMITS.items():
        if model.startswith(prefix):
            return limit

    return MODEL_CONTEXT_LIMITS['default']


def trim_messages_to_token_limit(
    messages: list[dict],
    max_tokens: Optional[int] = None,
    model: str = 'gpt-4o',
    reserve_tokens: int = RESPONSE_TOKEN_RESERVE,
) -> list[dict]:
    """Обрезать список сообщений до лимита токенов.

    Удаляет старые сообщения (с начала списка) пока не уложится в лимит.
    Всегда сохраняет минимум 1 последнее сообщение.

    Args:
        messages: Список сообщений (старые в начале, новые в конце)
        max_tokens: Максимум токенов (по умолчанию — лимит модели минус резерв)
        model: Модель для подсчёта токенов
        reserve_tokens: Резерв токенов для ответа модели

    Returns:
        Обрезанный список сообщений
    """
    if not messages:
        return messages

    if max_tokens is None:
        max_tokens = get_context_limit(model) - reserve_tokens

    # Подсчитываем токены с конца (новые сообщения важнее)
    result = []
    total_tokens = 0

    for msg in reversed(messages):
        msg_tokens = count_tokens(msg.get('content') or '', model) + 4
        if total_tokens + msg_tokens > max_tokens and result:
            # Достигли лимита, но уже есть хотя бы одно сообщение
            break
        result.append(msg)
        total_tokens += msg_tokens

    result.reverse()

    if len(result) < len(messages):
        logger.info(
            f'Trimmed context from {len(messages)} to {len(result)} messages '
            f'({total_tokens} tokens, limit {max_tokens})'
        )

    return result
