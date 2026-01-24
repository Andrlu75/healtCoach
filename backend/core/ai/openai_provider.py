import base64
import logging
from typing import Optional

import openai

from .base import AbstractAIProvider, AIResponse

logger = logging.getLogger(__name__)


class OpenAIProvider(AbstractAIProvider):

    def __init__(self, api_key: str):
        self.client = openai.AsyncOpenAI(api_key=api_key)

    async def complete(
        self,
        messages: list[dict],
        system_prompt: str,
        previous_response_id: Optional[str] = None,
        max_tokens: int = 600,
        temperature: float = 0.7,
        model: Optional[str] = None,
    ) -> AIResponse:
        model = model or 'gpt-4o-mini'
        input_messages = [{'role': 'system', 'content': system_prompt}] + messages

        is_gpt5 = model.startswith('gpt-5')

        kwargs = {
            'model': model,
            'messages': input_messages,
            # GPT-5: reasoning tokens + output tokens укладываются в лимит
            'max_completion_tokens': max(max_tokens * 4, 4096) if is_gpt5 else max_tokens,
        }

        if not is_gpt5:
            kwargs['temperature'] = temperature

        try:
            response = await self.client.chat.completions.create(**kwargs)
        except openai.BadRequestError as e:
            if 'temperature' in str(e):
                kwargs.pop('temperature', None)
                response = await self.client.chat.completions.create(**kwargs)
            else:
                raise

        content = self._extract_content(response)
        return AIResponse(
            content=content,
            model=response.model,
            usage={
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
            } if response.usage else {},
        )

    def _extract_content(self, response) -> str:
        """Извлечь текст ответа из разных форматов OpenAI response."""
        if not response.choices:
            logger.warning(f'OpenAI response has no choices: {response}')
            return '[Пустой ответ от модели]'

        choice = response.choices[0]
        message = choice.message

        # Стандартный формат
        if message.content:
            return message.content

        # Refusal (модель отказалась отвечать)
        if hasattr(message, 'refusal') and message.refusal:
            return f'[Отказ модели: {message.refusal}]'

        # Reasoning модели
        if hasattr(message, 'reasoning_content') and message.reasoning_content:
            return message.reasoning_content

        # Логируем для диагностики
        finish = choice.finish_reason if hasattr(choice, 'finish_reason') else 'unknown'
        logger.warning(
            f'OpenAI empty content. finish_reason={finish}, '
            f'message={message.model_dump() if hasattr(message, "model_dump") else message}'
        )
        return f'[Пустой ответ. finish_reason={finish}]'

    async def analyze_image(
        self,
        image_data: bytes,
        prompt: str,
        detail: str = 'low',
        media_type: str = 'image/jpeg',
        max_tokens: int = 500,
        model: Optional[str] = None,
    ) -> AIResponse:
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
            'max_completion_tokens': max(max_tokens * 4, 4096) if is_gpt5 else max_tokens,
        }

        try:
            response = await self.client.chat.completions.create(**kwargs)
        except openai.BadRequestError as e:
            if 'max_completion_tokens' in str(e):
                del kwargs['max_completion_tokens']
                kwargs['max_tokens'] = max_tokens
                response = await self.client.chat.completions.create(**kwargs)
            else:
                raise

        content = self._extract_content(response)
        return AIResponse(
            content=content,
            model=response.model,
            usage={
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
            } if response.usage else {},
        )

    async def transcribe_audio(
        self,
        audio_data: bytes,
        language: str = 'ru',
    ) -> str:
        import io
        audio_file = io.BytesIO(audio_data)
        audio_file.name = 'audio.ogg'

        response = await self.client.audio.transcriptions.create(
            model='whisper-1',
            file=audio_file,
            language=language,
        )
        return response.text
