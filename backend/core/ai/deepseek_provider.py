import base64
from typing import Optional

import openai

from .base import AbstractAIProvider, AIResponse


class DeepSeekProvider(AbstractAIProvider):

    def __init__(self, api_key: str):
        self.client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url='https://api.deepseek.com',
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
        model = model or 'deepseek-chat'
        input_messages = [{'role': 'system', 'content': system_prompt}] + messages

        kwargs = {
            'model': model,
            'messages': input_messages,
            'max_tokens': max_tokens,
            'temperature': temperature,
        }

        # JSON mode для гарантированного JSON ответа (DeepSeek совместим с OpenAI API)
        if json_mode:
            kwargs['response_format'] = {'type': 'json_object'}

        response = await self.client.chat.completions.create(**kwargs)

        choice = response.choices[0]
        content = choice.message.content or ''
        finish_reason = getattr(choice, 'finish_reason', None) or 'unknown'
        is_truncated = finish_reason == 'length'

        usage = {}
        if response.usage:
            usage = {
                'input_tokens': response.usage.prompt_tokens,
                'output_tokens': response.usage.completion_tokens,
            }

        return AIResponse(
            content=content,
            model=response.model,
            usage=usage,
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

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
        seed: int = None,
    ) -> AIResponse:
        model = model or 'deepseek-chat'
        b64_image = base64.b64encode(image_data).decode('utf-8')

        response = await self.client.chat.completions.create(
            model=model,
            messages=[
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f'data:image/jpeg;base64,{b64_image}',
                                'detail': detail,
                            },
                        },
                    ],
                }
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )

        choice = response.choices[0]
        content = choice.message.content or ''
        finish_reason = getattr(choice, 'finish_reason', None) or 'unknown'
        is_truncated = finish_reason == 'length'

        usage = {}
        if response.usage:
            usage = {
                'input_tokens': response.usage.prompt_tokens,
                'output_tokens': response.usage.completion_tokens,
            }

        return AIResponse(
            content=content,
            model=response.model,
            usage=usage,
            finish_reason=finish_reason,
            is_truncated=is_truncated,
        )

    async def transcribe_audio(
        self,
        audio_data: bytes,
        language: str = 'ru',
    ) -> str:
        raise NotImplementedError(
            'DeepSeek does not support audio transcription. '
            'Use OpenAI provider for transcription.'
        )
