import re
import time
import httpx


# OpenRouter provider prefixes for mapping model IDs
OPENROUTER_PROVIDER_MAP = {
    'openai': 'openai',
    'deepseek': 'deepseek',
}

# In-memory cache for OpenRouter metadata
_openrouter_cache: dict = {'data': {}, 'fetched_at': 0}
_CACHE_TTL = 3600  # 1 hour


async def _fetch_openrouter_metadata() -> dict[str, dict]:
    """Fetch model metadata (pricing + capabilities) from OpenRouter.
    Returns dict keyed by model_id (without provider prefix)."""
    now = time.time()
    if _openrouter_cache['data'] and (now - _openrouter_cache['fetched_at']) < _CACHE_TTL:
        return _openrouter_cache['data']

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get('https://openrouter.ai/api/v1/models')
            resp.raise_for_status()
            data = resp.json()

        result = {}
        for m in data.get('data', []):
            or_id = m.get('id', '')  # e.g. "openai/gpt-4o"
            parts = or_id.split('/', 1)
            if len(parts) != 2:
                continue
            provider_prefix, model_id = parts

            pricing = m.get('pricing', {})
            architecture = m.get('architecture', {})
            input_modalities = architecture.get('input_modalities', [])
            output_modalities = architecture.get('output_modalities', [])

            # Convert per-token price to per-1M-tokens price
            prompt_price = float(pricing.get('prompt', 0) or 0)
            completion_price = float(pricing.get('completion', 0) or 0)

            result[f"{provider_prefix}/{model_id}"] = {
                'price_input': round(prompt_price * 1_000_000, 4),
                'price_output': round(completion_price * 1_000_000, 4),
                'supports_text': 'text' in input_modalities,
                'supports_vision': 'image' in input_modalities,
                'supports_audio': 'audio' in input_modalities,
                'context_length': m.get('context_length', 0),
                'name': m.get('name', ''),
            }

        _openrouter_cache['data'] = result
        _openrouter_cache['fetched_at'] = now
        return result
    except Exception:
        # Return cached data if available, otherwise empty
        return _openrouter_cache['data']


def _find_openrouter_meta(model_id: str, or_prefix: str, metadata: dict) -> dict | None:
    """Try multiple ID variations to find a match in OpenRouter metadata."""
    # 1. Exact match
    meta = metadata.get(f"{or_prefix}/{model_id}")
    if meta:
        return meta

    # 2. Strip date suffix (e.g. -20250514, -20241022)
    base_id = re.sub(r'-\d{8}$', '', model_id)
    if base_id != model_id:
        meta = metadata.get(f"{or_prefix}/{base_id}")
        if meta:
            return meta

    # 3. Replace dashes with dots in version numbers (claude-3-5-haiku -> claude-3.5-haiku)
    dot_id = re.sub(r'-(\d+)-(\d+)-', r'-\1.\2-', base_id)
    if dot_id != base_id:
        meta = metadata.get(f"{or_prefix}/{dot_id}")
        if meta:
            return meta

    # 4. Try with -001 suffix (Gemini uses this in OpenRouter)
    meta = metadata.get(f"{or_prefix}/{model_id}-001")
    if meta:
        return meta
    meta = metadata.get(f"{or_prefix}/{base_id}-001")
    if meta:
        return meta

    # 5. Partial prefix match (find the best match)
    candidates = []
    for key, val in metadata.items():
        if key.startswith(f"{or_prefix}/{base_id}") or key.startswith(f"{or_prefix}/{dot_id}"):
            candidates.append((key, val))
    if candidates:
        # Return shortest key match (most specific)
        candidates.sort(key=lambda x: len(x[0]))
        return candidates[0][1]

    return None


def _enrich_models(models: list[dict], provider: str, metadata: dict) -> list[dict]:
    """Enrich model list with pricing and capabilities from OpenRouter metadata."""
    or_prefix = OPENROUTER_PROVIDER_MAP.get(provider, provider)
    enriched = []
    for m in models:
        model_id = m['id']
        meta = _find_openrouter_meta(model_id, or_prefix, metadata)

        entry = {
            'id': model_id,
            'name': m.get('name', model_id),
            'price_input': meta['price_input'] if meta else None,
            'price_output': meta['price_output'] if meta else None,
            'supports_text': meta['supports_text'] if meta else True,
            'supports_vision': meta['supports_vision'] if meta else False,
            'supports_audio': meta['supports_audio'] if meta else False,
            'context_length': meta['context_length'] if meta else None,
        }
        enriched.append(entry)
    return enriched


def get_cached_pricing(provider: str, model_id: str) -> tuple[float, float] | None:
    """Возвращает (price_input, price_output) за 1M токенов из кэша, или None."""
    metadata = _openrouter_cache['data']
    if not metadata:
        # Try to fetch synchronously if cache is empty
        _fetch_openrouter_metadata_sync()
        metadata = _openrouter_cache['data']
    if not metadata:
        return None
    or_prefix = OPENROUTER_PROVIDER_MAP.get(provider, provider)
    meta = _find_openrouter_meta(model_id, or_prefix, metadata)
    if meta:
        return (meta['price_input'], meta['price_output'])
    return None


def _fetch_openrouter_metadata_sync() -> None:
    """Synchronous version to populate cache if needed."""
    import time as time_module
    now = time_module.time()
    if _openrouter_cache['data'] and (now - _openrouter_cache['fetched_at']) < _CACHE_TTL:
        return

    try:
        with httpx.Client(timeout=20) as client:
            resp = client.get('https://openrouter.ai/api/v1/models')
            resp.raise_for_status()
            data = resp.json()

        result = {}
        for m in data.get('data', []):
            or_id = m.get('id', '')
            parts = or_id.split('/', 1)
            if len(parts) != 2:
                continue
            provider_prefix, model_id = parts

            pricing = m.get('pricing', {})
            architecture = m.get('architecture', {})
            input_modalities = architecture.get('input_modalities', [])
            output_modalities = architecture.get('output_modalities', [])

            prompt_price = float(pricing.get('prompt', 0) or 0)
            completion_price = float(pricing.get('completion', 0) or 0)

            result[f"{provider_prefix}/{model_id}"] = {
                'price_input': round(prompt_price * 1_000_000, 4),
                'price_output': round(completion_price * 1_000_000, 4),
                'supports_text': 'text' in input_modalities,
                'supports_vision': 'image' in input_modalities,
                'supports_audio': 'audio' in input_modalities,
                'context_length': m.get('context_length', 0),
                'name': m.get('name', ''),
            }

        _openrouter_cache['data'] = result
        _openrouter_cache['fetched_at'] = now
    except Exception:
        pass


async def fetch_models(provider: str, api_key: str) -> list[dict]:
    if provider == 'openai':
        raw = await _fetch_openai_models(api_key)
    elif provider == 'deepseek':
        raw = await _fetch_deepseek_models(api_key)
    else:
        raise ValueError(f'Unknown provider: {provider}')

    # Enrich with pricing and capabilities from OpenRouter
    metadata = await _fetch_openrouter_metadata()
    return _enrich_models(raw, provider, metadata)


async def _fetch_openai_models(api_key: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            'https://api.openai.com/v1/models',
            headers={'Authorization': f'Bearer {api_key}'},
        )
        resp.raise_for_status()
        data = resp.json()

    allowed_models = {'gpt-5-mini', 'gpt-5-nano'}

    models = []
    for m in data.get('data', []):
        model_id = m['id']
        if model_id in allowed_models:
            models.append({'id': model_id, 'name': model_id})

    models.sort(key=lambda x: x['id'])
    return models


async def _fetch_deepseek_models(api_key: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            'https://api.deepseek.com/models',
            headers={'Authorization': f'Bearer {api_key}'},
        )
        resp.raise_for_status()
        data = resp.json()

    models = []
    for m in data.get('data', []):
        models.append({'id': m['id'], 'name': m['id']})

    models.sort(key=lambda x: x['id'])
    return models


