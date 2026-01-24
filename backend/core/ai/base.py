from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AIResponse:
    content: str
    response_id: Optional[str] = None
    model: str = ''
    usage: dict = field(default_factory=dict)


class AbstractAIProvider(ABC):

    @abstractmethod
    async def complete(
        self,
        messages: list[dict],
        system_prompt: str,
        previous_response_id: Optional[str] = None,
        max_tokens: int = 600,
        temperature: float = 0.7,
        model: Optional[str] = None,
    ) -> AIResponse:
        pass

    @abstractmethod
    async def analyze_image(
        self,
        image_data: bytes,
        prompt: str,
        detail: str = 'low',
        max_tokens: int = 500,
        model: Optional[str] = None,
    ) -> AIResponse:
        pass

    @abstractmethod
    async def transcribe_audio(
        self,
        audio_data: bytes,
        language: str = 'ru',
    ) -> str:
        pass
