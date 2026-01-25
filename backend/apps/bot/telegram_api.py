import logging

import httpx

logger = logging.getLogger(__name__)

TELEGRAM_API = 'https://api.telegram.org'


TG_MSG_LIMIT = 4096


def _split_text(text: str, limit: int = TG_MSG_LIMIT) -> list[str]:
    """Split text into chunks respecting paragraph boundaries."""
    if len(text) <= limit:
        return [text]

    chunks = []
    while text:
        if len(text) <= limit:
            chunks.append(text)
            break

        # Try to split at paragraph boundary
        split_at = text.rfind('\n\n', 0, limit)
        if split_at == -1:
            # Try newline
            split_at = text.rfind('\n', 0, limit)
        if split_at == -1:
            # Try space
            split_at = text.rfind(' ', 0, limit)
        if split_at == -1:
            split_at = limit

        chunks.append(text[:split_at].rstrip())
        text = text[split_at:].lstrip()

    return chunks


async def _send_single(client: httpx.AsyncClient, url: str, chat_id: int, text: str, parse_mode: str | None = 'Markdown') -> dict | None:
    """Send a single message, trying specified parse_mode then plain text."""
    payload = {'chat_id': chat_id, 'text': text}
    if parse_mode:
        payload['parse_mode'] = parse_mode

    resp = await client.post(url, json=payload)
    result = resp.json()
    if result.get('ok'):
        return result.get('result')

    # Fallback: send without parse_mode
    if parse_mode:
        resp = await client.post(url, json={
            'chat_id': chat_id,
            'text': text,
        })
        result = resp.json()
        if result.get('ok'):
            return result.get('result')

    logger.error('Failed to send message to chat %s: %s', chat_id, result)
    return None


async def send_message(token: str, chat_id: int | str, text: str, parse_mode: str | None = 'Markdown') -> dict | None:
    """Send a text message. Splits long messages into chunks."""
    url = f'{TELEGRAM_API}/bot{token}/sendMessage'
    chunks = _split_text(text)

    last_result = None
    async with httpx.AsyncClient(timeout=15) as client:
        for chunk in chunks:
            last_result = await _send_single(client, url, chat_id, chunk, parse_mode)

    return last_result


async def send_chat_action(token: str, chat_id: int, action: str = 'typing') -> None:
    """Send chat action (e.g. typing indicator)."""
    url = f'{TELEGRAM_API}/bot{token}/sendChatAction'

    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(url, json={
            'chat_id': chat_id,
            'action': action,
        })


async def get_file(token: str, file_id: str) -> bytes | None:
    """Download a file from Telegram by file_id."""
    async with httpx.AsyncClient(timeout=30) as client:
        # Get file path
        resp = await client.post(
            f'{TELEGRAM_API}/bot{token}/getFile',
            json={'file_id': file_id},
        )
        result = resp.json()
        if not result.get('ok'):
            logger.error('Failed to get file info for %s: %s', file_id, result)
            return None

        file_path = result['result']['file_path']

        # Download file
        download_url = f'{TELEGRAM_API}/file/bot{token}/{file_path}'
        resp = await client.get(download_url)
        if resp.status_code == 200:
            return resp.content

        logger.error('Failed to download file %s: status %s', file_path, resp.status_code)
        return None
