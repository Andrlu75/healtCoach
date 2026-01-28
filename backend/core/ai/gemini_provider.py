import base64
from typing import Optional

from google import genai
from google.genai import types

from .base import AbstractAIProvider, AIResponse


class GeminiProvider(AbstractAIProvider):

    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    async def complete(
        self,
        messages: list[dict],
        system_prompt: str,
        previous_response_id: Optional[str] = None,
        max_tokens: int = 600,
        temperature: float = 0.7,
        model: Optional[str] = None,
    ) -> AIResponse:
        model = model or 'gemini-2.0-flash'

        contents = []
        for msg in messages:
            role = 'model' if msg['role'] == 'assistant' else 'user'
            contents.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg['content'])],
            ))

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        response = await self.client.aio.models.generate_content(
            model=model,
            contents=contents,
            config=config,
        )

        content = response.text or ''
        usage = {}
        if response.usage_metadata:
            usage = {
                'input_tokens': response.usage_metadata.prompt_token_count or 0,
                'output_tokens': response.usage_metadata.candidates_token_count or 0,
            }

        return AIResponse(
            content=content,
            model=model,
            usage=usage,
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
        model = model or 'gemini-2.0-flash'

        image_part = types.Part.from_bytes(data=image_data, mime_type='image/jpeg')
        text_part = types.Part.from_text(text=prompt)

        config = types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        response = await self.client.aio.models.generate_content(
            model=model,
            contents=[image_part, text_part],
            config=config,
        )

        content = response.text or ''
        usage = {}
        if response.usage_metadata:
            usage = {
                'input_tokens': response.usage_metadata.prompt_token_count or 0,
                'output_tokens': response.usage_metadata.candidates_token_count or 0,
            }

        return AIResponse(
            content=content,
            model=model,
            usage=usage,
        )

    async def transcribe_audio(
        self,
        audio_data: bytes,
        language: str = 'ru',
    ) -> str:
        model = 'gemini-2.0-flash'

        audio_part = types.Part.from_bytes(data=audio_data, mime_type='audio/ogg')
        text_part = types.Part.from_text(
            text=f'Transcribe this audio to text. Language: {language}. Return only the transcription text.'
        )

        response = await self.client.aio.models.generate_content(
            model=model,
            contents=[audio_part, text_part],
        )

        return response.text or ''
