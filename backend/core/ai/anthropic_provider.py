import base64
from typing import Optional

import anthropic

from .base import AbstractAIProvider, AIResponse


class AnthropicProvider(AbstractAIProvider):

    def __init__(self, api_key: str):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)

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
        model = model or 'claude-sonnet-4-20250514'

        response = await self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=messages,
        )

        content = ''
        for block in response.content:
            if block.type == 'text':
                content += block.text

        # Anthropic stop_reason: 'end_turn', 'max_tokens', 'stop_sequence'
        stop_reason = response.stop_reason
        is_truncated = stop_reason == 'max_tokens'

        return AIResponse(
            content=content,
            response_id=response.id,
            model=response.model,
            usage={
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens,
            },
            finish_reason=stop_reason,
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
        model = model or 'claude-sonnet-4-20250514'
        b64_image = base64.b64encode(image_data).decode('utf-8')

        response = await self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'image',
                            'source': {
                                'type': 'base64',
                                'media_type': media_type,
                                'data': b64_image,
                            },
                        },
                        {'type': 'text', 'text': prompt},
                    ],
                }
            ],
        )

        content = ''
        for block in response.content:
            if block.type == 'text':
                content += block.text

        stop_reason = response.stop_reason
        is_truncated = stop_reason == 'max_tokens'

        return AIResponse(
            content=content,
            model=response.model,
            usage={
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens,
            },
            finish_reason=stop_reason,
            is_truncated=is_truncated,
        )

    async def transcribe_audio(
        self,
        audio_data: bytes,
        language: str = 'ru',
    ) -> str:
        # Anthropic doesn't have transcription — fallback to OpenAI Whisper
        raise NotImplementedError(
            'Anthropic does not support audio transcription. '
            'Use OpenAI provider for transcription.'
        )
