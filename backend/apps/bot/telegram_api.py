import logging

import httpx

logger = logging.getLogger(__name__)

TELEGRAM_API = 'https://api.telegram.org'


async def send_message(token: str, chat_id: int, text: str) -> dict | None:
    """Send a text message. Tries Markdown first, falls back to plain text."""
    url = f'{TELEGRAM_API}/bot{token}/sendMessage'

    async with httpx.AsyncClient(timeout=15) as client:
        # Try with Markdown
        resp = await client.post(url, json={
            'chat_id': chat_id,
            'text': text,
            'parse_mode': 'Markdown',
        })
        result = resp.json()
        if result.get('ok'):
            return result.get('result')

        # Fallback: send without parse_mode
        logger.warning('Markdown failed for chat %s, sending plain text', chat_id)
        resp = await client.post(url, json={
            'chat_id': chat_id,
            'text': text,
        })
        result = resp.json()
        if result.get('ok'):
            return result.get('result')

        logger.error('Failed to send message to chat %s: %s', chat_id, result)
        return None


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
