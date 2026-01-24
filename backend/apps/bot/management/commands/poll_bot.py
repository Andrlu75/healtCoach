"""
Long-polling management command for local development.
Usage: python manage.py poll_bot
"""
import asyncio
import logging

import httpx
from django.core.management.base import BaseCommand

from apps.bot.webhook import _dispatch
from apps.persona.models import TelegramBot

logger = logging.getLogger(__name__)

TELEGRAM_API = 'https://api.telegram.org'


class Command(BaseCommand):
    help = 'Run Telegram bot in long-polling mode (for local development)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--bot-id', type=int, default=None,
            help='Specific bot ID to poll. If not set, uses the first active bot.',
        )

    def handle(self, *args, **options):
        bot_id = options['bot_id']

        if bot_id:
            bot = TelegramBot.objects.filter(pk=bot_id, is_active=True).first()
        else:
            bot = TelegramBot.objects.filter(is_active=True).first()

        if not bot:
            self.stderr.write(self.style.ERROR('No active bot found.'))
            return

        self.stdout.write(self.style.SUCCESS(
            f'Starting polling for bot "{bot.name}" (id={bot.pk})'
        ))

        asyncio.run(self._poll_loop(bot))

    async def _poll_loop(self, bot: TelegramBot):
        token = bot.token
        bot_id = bot.pk

        # Delete webhook so getUpdates works
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f'{TELEGRAM_API}/bot{token}/deleteWebhook'
            )
            result = resp.json()
            if result.get('ok'):
                self.stdout.write('Webhook removed, polling started.')
            else:
                self.stderr.write(f'Warning: deleteWebhook failed: {result}')

        offset = 0

        while True:
            try:
                async with httpx.AsyncClient(timeout=35) as client:
                    resp = await client.get(
                        f'{TELEGRAM_API}/bot{token}/getUpdates',
                        params={
                            'offset': offset,
                            'timeout': 30,
                        },
                    )
                    data = resp.json()

                if not data.get('ok'):
                    logger.error('getUpdates error: %s', data)
                    await asyncio.sleep(3)
                    continue

                updates = data.get('result', [])
                for update in updates:
                    offset = update['update_id'] + 1
                    try:
                        await _dispatch(bot_id, update)
                    except Exception as e:
                        logger.exception('Error processing update %s: %s', update.get('update_id'), e)

            except httpx.RequestError as e:
                logger.error('Network error: %s', e)
                await asyncio.sleep(5)
            except KeyboardInterrupt:
                self.stdout.write('\nStopping polling.')
                break
