import base64
from typing import Optional

import openai

from .base import AbstractAIProvider, AIResponse


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

        kwargs = {
            'model': model,
            'input': input_messages,
            'max_output_tokens': max_tokens,
            'store': True,
        }
        if previous_response_id and previous_response_id.startswith('resp_'):
            kwargs['previous_response_id'] = previous_response_id

        response = await self.client.responses.create(**kwargs)

        content = ''
        for output_item in response.output:
            if hasattr(output_item, 'content'):
                for block in output_item.content:
                    if hasattr(block, 'text'):
                        content += block.text

        return AIResponse(
            content=content,
            response_id=response.id,
            model=response.model,
        )

    async def analyze_image(
        self,
        image_data: bytes,
        prompt: str,
        detail: str = 'low',
        max_tokens: int = 500,
        model: Optional[str] = None,
    ) -> AIResponse:
        model = model or 'gpt-4o'
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
        )

        return AIResponse(
            content=response.choices[0].message.content,
            model=response.model,
            usage={
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
            },
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
