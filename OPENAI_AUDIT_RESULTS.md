# Результаты аудита интеграции с OpenAI API

**Дата анализа:** 2026-02-01
**Проанализированные файлы:**
- `backend/core/ai/openai_provider.py` — OpenAI провайдер
- `backend/apps/meals/services.py` — сервисы анализа еды
- `backend/apps/bot/services.py` — сервисы бота
- `backend/apps/bot/handlers/photo.py` — обработчик фото

---

## КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. Неполная обработка исключений OpenAI

**Файл:** `backend/core/ai/openai_provider.py:40-47`

**Проблема:** Обрабатывается только `openai.BadRequestError`, все остальные исключения пробрасываются без обработки.

```python
try:
    response = await self.client.chat.completions.create(**kwargs)
except openai.BadRequestError as e:
    if 'temperature' in str(e):
        kwargs.pop('temperature', None)
        response = await self.client.chat.completions.create(**kwargs)
    else:
        raise  # ← Всё остальное просто падает
```

**Необработанные исключения:**
| Исключение | Когда возникает | Влияние |
|------------|-----------------|---------|
| `openai.RateLimitError` | Превышен лимит запросов | Пользователь получает ошибку |
| `openai.APIConnectionError` | Сетевые проблемы | Пользователь получает ошибку |
| `openai.APIError` | Внутренние ошибки OpenAI (5xx) | Пользователь получает ошибку |
| `openai.AuthenticationError` | Неверный API ключ | Пользователь получает ошибку |
| `asyncio.TimeoutError` | Таймаут запроса | Запрос висит бесконечно |

**Рекомендация:** Добавить обработку всех типов ошибок с retry для временных сбоев.

---

### 2. Отсутствие Retry логики

**Файл:** `backend/core/ai/openai_provider.py`

**Проблема:** Нет механизма повторных попыток при временных ошибках.

**Влияние:**
- При rate limit (429) — запрос сразу падает
- При сетевых проблемах — запрос сразу падает
- При 5xx ошибках OpenAI — запрос сразу падает

**Рекомендация:**
```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((
        openai.RateLimitError,
        openai.APIConnectionError,
        openai.APIError,
    ))
)
async def complete(self, ...):
    ...
```

---

### 3. Некорректный fallback при ошибке парсинга JSON

**Файл:** `backend/apps/meals/services.py:884-894`

**Проблема:** При ошибке парсинга JSON возвращаются нулевые значения вместо None.

```python
except json.JSONDecodeError:
    logger.error('Failed to parse food analysis JSON: %s', content)
    data = {
        'dish_name': 'Неизвестное блюдо',
        'calories': 0,      # ← Некорректно! 0 калорий = ничего не съел
        'proteins': 0,
        'fats': 0,
        'carbohydrates': 0,
    }
```

**Влияние:**
- В статистику записывается 0 калорий вместо "неизвестно"
- Искажается дневная сводка клиента
- Клиент думает что блюдо записано корректно

**Рекомендация:** Возвращать None для числовых полей или отдельный флаг `parse_error: true`.

---

### 4. Хрупкий парсинг markdown блоков

**Файл:** `backend/apps/meals/services.py:806-812`

**Проблема:** Код предполагает конкретный формат markdown, который может отличаться.

```python
if content.startswith('```'):
    content = content.split('\n', 1)[1] if '\n' in content else content[3:]
    if content.endswith('```'):
        content = content[:-3]
    content = content.strip()
```

**Возможные сбои:**
| Формат ответа | Результат |
|---------------|-----------|
| ` ```json\n{...}\n``` ` | ✅ Работает |
| `\`\`\`{...}\`\`\`` | ❌ Ломается (нет \n) |
| `\`\`\`json\n{...}\n\`\`\` extra` | ❌ Ломается (текст после) |
| `{...}` (без блока) | ✅ Работает |

**Рекомендация:** Использовать regex или json_mode в OpenAI API.

---

### 5. Refusal отправляется клиенту как обычный ответ

**Файл:** `backend/core/ai/openai_provider.py:72-74`

**Проблема:** Если модель отказывается отвечать, текст отказа отправляется клиенту.

```python
if hasattr(message, 'refusal') and message.refusal:
    return f'[Отказ модели: {message.refusal}]'  # ← Это уходит клиенту!
```

**Влияние:** Клиент может получить сообщение вида:
> [Отказ модели: I cannot analyze this image as it may contain inappropriate content]

**Рекомендация:** Обрабатывать refusal отдельно с человекочитаемым fallback сообщением.

---

### 6. Отсутствие таймаутов

**Файл:** `backend/core/ai/openai_provider.py:14-15`

**Проблема:** OpenAI клиент создаётся без явных таймаутов.

```python
def __init__(self, api_key: str):
    self.client = openai.AsyncOpenAI(api_key=api_key)  # ← Нет timeout
```

**Влияние:** Запросы могут висеть неопределённо долго при проблемах сети.

**Рекомендация:**
```python
self.client = openai.AsyncOpenAI(
    api_key=api_key,
    timeout=httpx.Timeout(60.0, connect=5.0)
)
```

---

## СРЕДНИЕ ПРОБЛЕМЫ

### 7. Hardcoded temperature для всех задач

**Файлы:** Все места вызова `provider.complete()` и `provider.analyze_image()`

**Проблема:** Температура 0.7 используется везде, включая задачи требующие детерминизма.

| Задача | Текущая temperature | Рекомендуемая |
|--------|---------------------|---------------|
| JSON анализ еды | 0.7 | 0.0-0.2 |
| Классификация фото | default | 0.0 |
| Пересчёт КБЖУ | 0.2 | 0.0 |
| Творческие ответы | 0.7 | 0.7-0.9 |

**Влияние:** Нестабильные результаты классификации и анализа.

---

### 8. Нет валидации обязательных полей JSON

**Файл:** `backend/apps/meals/services.py:814-818`

**Проблема:** После парсинга JSON не проверяются обязательные поля.

```python
try:
    data = json.loads(content)
except json.JSONDecodeError:
    ...
# ← Нет проверки что data содержит calories, proteins и т.д.
```

**Возможный ответ AI:**
```json
{"dish_name": "Салат", "confidence": 70}
```
Без calories, proteins, fats, carbohydrates.

**Влияние:** В БД записываются None/0 для КБЖУ.

---

### 9. Не используется json_mode для гарантированного JSON

**Файл:** `backend/apps/meals/services.py:775-780`

**Проблема:** Функция `classify_and_analyze()` не использует `json_mode=True`.

```python
response = await provider.analyze_image(
    image_data=image_data,
    prompt=prompt,
    max_tokens=500,
    model=model,
    # ← Нет json_mode=True
)
```

**Влияние:** Модель может вернуть текст вместо JSON.

**Рекомендация:** Добавить `json_mode=True` для всех функций ожидающих JSON.

---

### 10. Double AI calls без транзакционности

**Файл:** `backend/apps/bot/handlers/photo.py:150-156`

**Проблема:** Делается два AI вызова, но если второй падает, первый уже залогирован.

```python
# Первый call уже сделан в classify_and_analyze
result = await classify_and_analyze(bot, image_data, caption)

# Второй call для food_response_prompt
response = await provider.complete(...)  # ← Может упасть
```

**Влияние:**
- Первый вызов оплачен и залогирован
- Клиент не получает ответ
- Meal уже сохранён в БД

---

## НИЗКИЕ ПРОБЛЕМЫ

### 11. Дублирование кода логирования usage

**Файлы:** `backend/apps/meals/services.py`, `backend/apps/bot/services.py`

**Проблема:** Код логирования usage копипастится в каждой функции (~20 строк).

```python
# Повторяется в 10+ местах
model_used = response.model or model or ''
input_tokens = response.usage.get('input_tokens', 0) or response.usage.get('prompt_tokens', 0)
output_tokens = response.usage.get('output_tokens', 0) or response.usage.get('completion_tokens', 0)
cost_usd = Decimal('0')
pricing = get_cached_pricing(provider_name, model_used)
...
```

**Рекомендация:** Вынести в общую функцию `log_ai_usage()`.

---

### 12. Нет проверки лимита контекста (token counting)

**Файл:** `backend/apps/bot/services.py:149-157`

**Проблема:** История сообщений ограничена количеством (20), но не токенами.

```python
async def _get_context_messages(client: Client, limit: int = 20) -> list[dict]:
    messages = await sync_to_async(
        lambda: list(
            ChatMessage.objects.filter(client=client)
            .order_by('-created_at')[:limit]  # ← Лимит по количеству, не по токенам
        )
    )()
```

**Влияние:** Длинные сообщения могут превысить лимит контекста модели.

---

### 13. Whisper без обработки ошибок

**Файл:** `backend/core/ai/openai_provider.py:167-181`

**Проблема:** Транскрибирование не обрабатывает ошибки.

```python
async def transcribe_audio(self, audio_data: bytes, language: str = 'ru') -> str:
    audio_file = io.BytesIO(audio_data)
    audio_file.name = 'audio.ogg'

    response = await self.client.audio.transcriptions.create(
        model='whisper-1',
        file=audio_file,
        language=language,
    )
    return response.text  # ← Нет try/except
```

**Возможные ошибки:**
- Файл слишком большой (>25MB)
- Неподдерживаемый формат
- API ошибки

---

## НЕРЕАЛИЗОВАННЫЕ МЕХАНИЗМЫ

### Критически важные

| Механизм | Описание | Влияние отсутствия |
|----------|----------|-------------------|
| **Rate Limiting** | Ограничение запросов к OpenAI | 429 ошибки при пиковой нагрузке |
| **Circuit Breaker** | Отключение при массовых сбоях | Каскадные ошибки |
| **Request Queue** | Очередь запросов | Перегрузка при пиках |

### Рекомендуемые

| Механизм | Описание | Польза |
|----------|----------|--------|
| **Graceful Degradation** | Fallback на дешёвые модели | Экономия при сбоях |
| **Response Caching** | Кэширование одинаковых запросов | Экономия и скорость |
| **Cost Control** | Лимиты расходов по клиенту | Контроль бюджета |
| **Streaming** | Потоковая передача ответов | UX для длинных ответов |

---

## СВОДКА

| Приоритет | Было | Исправлено | Осталось |
|-----------|------|------------|----------|
| 🔴 Критические | 6 | 6 | 0 |
| 🟠 Средние | 4 | 4 | 0 |
| 🟢 Низкие | 3 | 3 | 0 |
| ⚪ Нереализованные | 6+ | 1 | 5+ |

### ✅ ИСПРАВЛЕНО (13/13 основных проблем)

1. ✅ **Retry логика** — tenacity с exponential backoff
2. ✅ **Таймауты** — разные для text/vision/whisper
3. ✅ **Fallback при ошибке парсинга** — None вместо 0
4. ✅ **Валидация полей JSON** — Pydantic схемы
5. ✅ **Обработка refusal** — человекочитаемые сообщения
6. ✅ **Обработка исключений** — все типы OpenAI ошибок
7. ✅ **Temperature** — 0.0-0.2 для JSON задач
8. ✅ **json_mode** — гарантированный JSON
9. ✅ **finish_reason** — обработка length, content_filter
10. ✅ **Token counting** — tiktoken для контекста
11. ✅ **Whisper ошибки** — обработка + fallback
12. ✅ **log_ai_usage** — общая функция
13. ✅ **Markdown stripping** — json_mode решает проблему

### ⚠️ НОВЫЕ ПРОБЛЕМЫ ИЗ АУДИТА (8 FIX-задач)

| ID | Приоритет | Проблема |
|----|-----------|----------|
| FIX-16 | 🔴 HIGH | Конфликт таймаутов retry/asyncio |
| FIX-17 | 🟡 MEDIUM | Дублирование try/except |
| FIX-21 | 🟡 MEDIUM | Нет model_config для extra |
| FIX-24 | 🟡 MEDIUM | TypeError при None content |
| FIX-15 | 🟡 MEDIUM | Неэффективный retry декоратор |
| FIX-18 | 🟢 LOW | Magic numbers GPT-5 |
| FIX-20 | 🟢 LOW | Дублирование валидаторов |
| FIX-23 | 🟢 LOW | lru_cache maxsize |

---

## ПРИМЕРЫ ИСПРАВЛЕНИЙ

### Retry логика с tenacity

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

class OpenAIProvider(AbstractAIProvider):

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((
            openai.RateLimitError,
            openai.APIConnectionError,
            openai.APIError,
        )),
        before_sleep=lambda retry_state: logger.warning(
            f"Retrying OpenAI request, attempt {retry_state.attempt_number}"
        )
    )
    async def complete(self, ...):
        ...
```

### Валидация JSON с pydantic

```python
from pydantic import BaseModel, Field
from typing import Optional

class FoodAnalysis(BaseModel):
    dish_name: str
    dish_type: Optional[str] = None
    calories: Optional[float] = Field(None, ge=0)
    proteins: Optional[float] = Field(None, ge=0)
    fats: Optional[float] = Field(None, ge=0)
    carbohydrates: Optional[float] = Field(None, ge=0)
    confidence: Optional[int] = Field(None, ge=0, le=100)

def parse_food_analysis(content: str) -> FoodAnalysis:
    try:
        data = json.loads(content)
        return FoodAnalysis(**data)
    except (json.JSONDecodeError, ValidationError) as e:
        logger.error(f"Failed to parse food analysis: {e}")
        return FoodAnalysis(dish_name="Неизвестное блюдо")
```

### Обработка refusal

```python
def _extract_content(self, response) -> str:
    if not response.choices:
        return AIResponse(
            content='Не удалось получить ответ от модели',
            is_error=True,
            error_type='empty_response'
        )

    message = response.choices[0].message

    if hasattr(message, 'refusal') and message.refusal:
        logger.warning(f'Model refused: {message.refusal}')
        return AIResponse(
            content='Не могу проанализировать это изображение. Попробуйте другое фото.',
            is_error=True,
            error_type='refusal',
            raw_refusal=message.refusal
        )

    return AIResponse(content=message.content)
```

---

*Документ создан: 2026-02-01*
