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


class ChatMigratedException(Exception):
    """Raised when group chat is upgraded to supergroup."""
    def __init__(self, old_chat_id: int | str, new_chat_id: int):
        self.old_chat_id = old_chat_id
        self.new_chat_id = new_chat_id
        super().__init__(f'Chat {old_chat_id} migrated to {new_chat_id}')


async def send_notification(token: str, chat_id: int | str, text: str, parse_mode: str | None = 'HTML') -> tuple[dict | None, int | str | None]:
    """Send notification message with migration handling.

    Returns: (result, new_chat_id or None)
    If chat was migrated, automatically retries with new chat_id and returns it.
    """
    url = f'{TELEGRAM_API}/bot{token}/sendMessage'
    payload = {'chat_id': chat_id, 'text': text}
    if parse_mode:
        payload['parse_mode'] = parse_mode

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=payload)
        result = resp.json()

        if result.get('ok'):
            return result.get('result'), None

        # Check for chat migration
        error_code = result.get('error_code')
        description = result.get('description', '')

        if error_code == 400 and 'migrated' in description.lower():
            # Extract new chat_id from parameters
            new_chat_id = result.get('parameters', {}).get('migrate_to_chat_id')
            if new_chat_id:
                logger.info('[TELEGRAM] Chat %s migrated to %s, retrying...', chat_id, new_chat_id)
                # Retry with new chat_id
                payload['chat_id'] = new_chat_id
                resp = await client.post(url, json=payload)
                retry_result = resp.json()
                if retry_result.get('ok'):
                    return retry_result.get('result'), new_chat_id
                logger.error('Failed to send to migrated chat %s: %s', new_chat_id, retry_result)
            else:
                logger.error('Chat migrated but no new chat_id in response: %s', result)

        # Fallback without parse_mode
        if parse_mode:
            del payload['parse_mode']
            payload['chat_id'] = chat_id  # Reset to original
            resp = await client.post(url, json=payload)
            result = resp.json()
            if result.get('ok'):
                return result.get('result'), None

        logger.error('Failed to send notification to chat %s: %s', chat_id, result)
        return None, None


async def send_photo_notification(
    token: str,
    chat_id: int | str,
    photo: bytes | str,
    caption: str = '',
    parse_mode: str | None = 'HTML',
) -> tuple[dict | None, int | str | None]:
    """Send photo notification with migration handling.

    Args:
        photo: Either bytes (image data) or str (file_id or URL)
        caption: Photo caption (max 1024 chars)

    Returns: (result, new_chat_id or None)
    """
    url = f'{TELEGRAM_API}/bot{token}/sendPhoto'

    async with httpx.AsyncClient(timeout=30) as client:
        if isinstance(photo, bytes):
            # Upload photo as file
            files = {'photo': ('photo.jpg', photo, 'image/jpeg')}
            data = {'chat_id': chat_id, 'caption': caption[:1024]}
            if parse_mode:
                data['parse_mode'] = parse_mode
            resp = await client.post(url, data=data, files=files)
        else:
            # Use file_id or URL
            payload = {'chat_id': chat_id, 'photo': photo, 'caption': caption[:1024]}
            if parse_mode:
                payload['parse_mode'] = parse_mode
            resp = await client.post(url, json=payload)

        result = resp.json()

        if result.get('ok'):
            return result.get('result'), None

        # Check for chat migration
        error_code = result.get('error_code')
        description = result.get('description', '')

        if error_code == 400 and 'migrated' in description.lower():
            new_chat_id = result.get('parameters', {}).get('migrate_to_chat_id')
            if new_chat_id:
                logger.info('[TELEGRAM] Chat %s migrated to %s, retrying photo...', chat_id, new_chat_id)
                # Retry with new chat_id
                if isinstance(photo, bytes):
                    files = {'photo': ('photo.jpg', photo, 'image/jpeg')}
                    data = {'chat_id': new_chat_id, 'caption': caption[:1024]}
                    if parse_mode:
                        data['parse_mode'] = parse_mode
                    resp = await client.post(url, data=data, files=files)
                else:
                    payload = {'chat_id': new_chat_id, 'photo': photo, 'caption': caption[:1024]}
                    if parse_mode:
                        payload['parse_mode'] = parse_mode
                    resp = await client.post(url, json=payload)

                retry_result = resp.json()
                if retry_result.get('ok'):
                    return retry_result.get('result'), new_chat_id

        logger.error('Failed to send photo to chat %s: %s', chat_id, result)
        return None, None


async def send_message_with_webapp(
    token: str,
    chat_id: int | str,
    text: str,
    button_text: str,
    webapp_url: str,
    parse_mode: str | None = 'Markdown',
) -> dict | None:
    """Send a message with WebApp inline button."""
    url = f'{TELEGRAM_API}/bot{token}/sendMessage'

    payload = {
        'chat_id': chat_id,
        'text': text,
        'reply_markup': {
            'inline_keyboard': [[
                {
                    'text': button_text,
                    'web_app': {'url': webapp_url},
                }
            ]]
        },
    }
    if parse_mode:
        payload['parse_mode'] = parse_mode

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=payload)
        result = resp.json()
        if result.get('ok'):
            return result.get('result')

        # Fallback without parse_mode
        if parse_mode:
            del payload['parse_mode']
            resp = await client.post(url, json=payload)
            result = resp.json()
            if result.get('ok'):
                return result.get('result')

        logger.error('Failed to send webapp message to chat %s: %s', chat_id, result)
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
