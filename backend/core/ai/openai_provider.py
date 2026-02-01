import asyncio
import base64
import logging
from typing import Optional

import httpx
import openai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

from .base import AbstractAIProvider, AIResponse

logger = logging.getLogger(__name__)

# Таймауты для разных операций
DEFAULT_TIMEOUT = httpx.Timeout(60.0, connect=10.0)
VISION_TIMEOUT = httpx.Timeout(90.0, connect=10.0)
TRANSCRIBE_TIMEOUT = httpx.Timeout(120.0, connect=10.0)

# GPT-5 использует reasoning с большим количеством токенов на обдумывание.
# Множители увеличивают max_tokens чтобы оставить место для reasoning tokens.
GPT5_TEXT_TOKEN_MULTIPLIER = 10  # Текстовые задачи требуют больше reasoning
GPT5_TEXT_MIN_TOKENS = 8192
GPT5_VISION_TOKEN_MULTIPLIER = 4  # Vision задачи требуют меньше reasoning
GPT5_VISION_MIN_TOKENS = 4096

# Исключения для retry (временные ошибки)
RETRYABLE_EXCEPTIONS = (
    openai.RateLimitError,
    openai.APIConnectionError,
    openai.APIError,
)

# Все обрабатываемые исключения OpenAI
HANDLED_EXCEPTIONS = (
    openai.RateLimitError,
    openai.APIConnectionError,
    openai.AuthenticationError,
    openai.APIError,
    asyncio.TimeoutError,
)

# Декоратор retry создаётся один раз на уровне модуля
_retry_decorator = retry(
    retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)


class OpenAIProvider(AbstractAIProvider):

    def __init__(self, api_key: str):
        self.client = openai.AsyncOpenAI(
            api_key=api_key,
            timeout=DEFAULT_TIMEOUT,
        )

    async def _call_with_retry(self, coro_func, *args, **kwargs):
        """Выполнить async вызов с retry для временных ошибок."""
        @_retry_decorator
        async def _inner():
            return await coro_func(*args, **kwargs)
        return await _inner()

    def _handle_openai_error(self, e: Exception, operation: str) -> AIResponse:
        """Обработка ошибок OpenAI с человекочитаемыми сообщениями."""
        if isinstance(e, openai.RateLimitError):
            logger.warning(f'OpenAI rate limit exceeded during {operation}: {e}')
            return AIResponse(
                content='Сервис временно перегружен. Пожалуйста, попробуйте через минуту.',
                is_error=True,
                error_type='rate_limit',
            )
        elif isinstance(e, openai.APIConnectionError):
            logger.error(f'OpenAI connection error during {operation}: {e}')
            return AIResponse(
                content='Ошибка соединения с сервисом. Пожалуйста, попробуйте позже.',
                is_error=True,
                error_type='connection',
            )
        elif isinstance(e, openai.AuthenticationError):
            logger.critical(f'OpenAI authentication error during {operation}: {e}')
            return AIResponse(
                content='Ошибка авторизации сервиса. Администратор уведомлён.',
                is_error=True,
                error_type='auth',
            )
        elif isinstance(e, asyncio.TimeoutError):
            logger.error(f'OpenAI timeout during {operation}: {e}')
            return AIResponse(
                content='Превышено время ожидания ответа. Пожалуйста, попробуйте позже.',
                is_error=True,
                error_type='timeout',
            )
        elif isinstance(e, openai.APIError):
            logger.error(f'OpenAI API error during {operation}: {e}')
            return AIResponse(
                content='Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.',
                is_error=True,
                error_type='api',
            )
        else:
            logger.exception(f'Unexpected error during {operation}: {e}')
            return AIResponse(
                content='Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже.',
                is_error=True,
                error_type='unknown',
            )

    async def complete(
        self,
        messages: list[dict],
        system_prompt: str,
        previous_response_id: Optional[str] = None,
        max_tokens: int = 600,
        temperature: float = 0.7,
        model: Optional[str] = None,
        json_mode: bool = False,
    ) -> AIResponse:
        model = model or 'gpt-4o-mini'
        input_messages = [{'role': 'system', 'content': system_prompt}] + messages

        is_gpt5 = model.startswith('gpt-5')

        kwargs = {
            'model': model,
            'messages': input_messages,
            'max_completion_tokens': (
                max(max_tokens * GPT5_TEXT_TOKEN_MULTIPLIER, GPT5_TEXT_MIN_TOKENS)
                if is_gpt5 else max_tokens
            ),
        }

        if not is_gpt5:
            kwargs['temperature'] = temperature

        # JSON mode для гарантированного JSON ответа
        if json_mode:
            kwargs['response_format'] = {'type': 'json_object'}

        try:
            response = await self._call_with_retry(
                self.client.chat.completions.create, **kwargs
            )
        except openai.BadRequestError as e:
            error_str = str(e)
            # Fallback для моделей не поддерживающих max_completion_tokens
            if 'max_completion_tokens' in error_str:
                del kwargs['max_completion_tokens']
                kwargs['max_tokens'] = max_tokens
                try:
                    response = await self._call_with_retry(
                        self.client.chat.completions.create, **kwargs
                    )
                except HANDLED_EXCEPTIONS as retry_error:
                    return self._handle_openai_error(retry_error, 'complete')
            # Fallback для моделей не поддерживающих temperature
            elif 'temperature' in error_str:
                kwargs.pop('temperature', None)
                try:
                    response = await self._call_with_retry(
                        self.client.chat.completions.create, **kwargs
                    )
                except HANDLED_EXCEPTIONS as retry_error:
                    return self._handle_openai_error(retry_error, 'complete')
            else:
                return self._handle_openai_error(e, 'complete')
        except HANDLED_EXCEPTIONS as e:
            return self._handle_openai_error(e, 'complete')

        content, finish_reason, is_truncated = self._extract_content(response)
        return AIResponse(
            content=content,
            model=response.model,
            usage={
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
            } if response.usage else {},
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

    def _extract_content(self, response) -> tuple[str, str, bool]:
        """Извлечь текст ответа из разных форматов OpenAI response.

        Returns:
            (content, finish_reason, is_truncated)
        """
        if not response.choices:
            logger.warning(f'OpenAI response has no choices: {response}')
            return 'Не удалось получить ответ. Пожалуйста, попробуйте ещё раз.', 'unknown', False

        choice = response.choices[0]
        message = choice.message
        finish_reason = getattr(choice, 'finish_reason', None) or 'unknown'

        # Обработка content_filter — модерация заблокировала ответ
        if finish_reason == 'content_filter':
            logger.warning(f'OpenAI content filtered: {message}')
            return 'Извините, не могу ответить на этот запрос.', finish_reason, False

        # Стандартный формат
        content = None
        if message.content:
            content = message.content
        # Refusal (модель отказалась отвечать)
        elif hasattr(message, 'refusal') and message.refusal:
            logger.warning(f'OpenAI model refused: {message.refusal}')
            content = 'Не могу обработать этот запрос. Попробуйте переформулировать или отправить другое фото.'
        # Reasoning модели
        elif hasattr(message, 'reasoning_content') and message.reasoning_content:
            content = message.reasoning_content

        # Обработка length — ответ обрезан
        is_truncated = finish_reason == 'length'
        if is_truncated:
            logger.warning(
                f'OpenAI response truncated (finish_reason=length). '
                f'Content length: {len(content) if content else 0}'
            )

        if content:
            return content, finish_reason, is_truncated

        # Логируем для диагностики
        logger.warning(
            f'OpenAI empty content. finish_reason={finish_reason}, '
            f'message={message.model_dump() if hasattr(message, "model_dump") else message}'
        )
        return 'Не удалось получить ответ. Пожалуйста, попробуйте ещё раз.', finish_reason, False

    async def analyze_image(
        self,
        image_data: bytes,
        prompt: str,
        detail: str = 'low',
        media_type: str = 'image/jpeg',
        max_tokens: int = 500,
        model: Optional[str] = None,
        temperature: float = 0.7,
        json_mode: bool = False,
        seed: Optional[int] = None,
    ) -> AIResponse:
        """Анализ изображения с OpenAI Vision API.

        Args:
            image_data: Байты изображения
            prompt: Промпт для анализа
            detail: Уровень детализации ('low', 'high', 'auto')
            media_type: MIME-тип изображения
            max_tokens: Максимальное количество токенов в ответе
            model: Модель OpenAI (по умолчанию gpt-4o)
            temperature: Температура (0.0-2.0). Низкие значения = более стабильные ответы
            json_mode: Включить JSON mode для гарантированного JSON ответа
            seed: Seed для воспроизводимости результатов
        """
        model = model or 'gpt-4o'
        b64_image = base64.b64encode(image_data).decode('utf-8')

        is_gpt5 = model.startswith('gpt-5')

        kwargs = {
            'model': model,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f'data:{media_type};base64,{b64_image}',
                                'detail': detail,
                            },
                        },
                    ],
                }
            ],
            'max_completion_tokens': (
                max(max_tokens * GPT5_VISION_TOKEN_MULTIPLIER, GPT5_VISION_MIN_TOKENS)
                if is_gpt5 else max_tokens
            ),
            'temperature': temperature,
        }

        # JSON mode для гарантированного JSON ответа
        if json_mode:
            kwargs['response_format'] = {'type': 'json_object'}

        # Seed для воспроизводимости
        if seed is not None:
            kwargs['seed'] = seed

        # Используем per-request timeout вместо asyncio.wait_for
        # чтобы не конфликтовать с retry delays
        kwargs['timeout'] = VISION_TIMEOUT.read

        try:
            response = await self._call_with_retry(
                self.client.chat.completions.create, **kwargs
            )
        except openai.BadRequestError as e:
            if 'max_completion_tokens' in str(e):
                del kwargs['max_completion_tokens']
                kwargs['max_tokens'] = max_tokens
                try:
                    response = await self._call_with_retry(
                        self.client.chat.completions.create, **kwargs
                    )
                except HANDLED_EXCEPTIONS as retry_error:
                    return self._handle_openai_error(retry_error, 'analyze_image')
            else:
                return self._handle_openai_error(e, 'analyze_image')
        except HANDLED_EXCEPTIONS as e:
            return self._handle_openai_error(e, 'analyze_image')

        content, finish_reason, is_truncated = self._extract_content(response)
        return AIResponse(
            content=content,
            model=response.model,
            usage={
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
            } if response.usage else {},
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

    async def transcribe_audio(
        self,
        audio_data: bytes,
        language: str = 'ru',
    ) -> str:
        import io
        audio_file = io.BytesIO(audio_data)
        audio_file.name = 'audio.ogg'

        try:
            # Per-request timeout для Whisper (длинные аудио)
            response = await self._call_with_retry(
                self.client.audio.transcriptions.create,
                model='whisper-1',
                file=audio_file,
                language=language,
                timeout=TRANSCRIBE_TIMEOUT.read,
            )
            return response.text
        except openai.BadRequestError as e:
            logger.error(f'Whisper bad request: {e}')
            return ''  # Пустая транскрипция при ошибке формата
        except HANDLED_EXCEPTIONS as e:
            logger.error(f'Whisper transcription error: {e}')
            return ''  # Пустая транскрипция при ошибках API
