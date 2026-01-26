import httpx
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.persona.models import TelegramBot


class Command(BaseCommand):
    help = 'Setup webhooks for all active Telegram bots'

    def handle(self, *args, **options):
        base_url = getattr(settings, 'TELEGRAM_WEBHOOK_BASE_URL', '')
        webhook_secret = getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', '')

        if not base_url:
            self.stdout.write(self.style.ERROR(
                'TELEGRAM_WEBHOOK_BASE_URL not configured'
            ))
            return

        bots = TelegramBot.objects.filter(is_active=True)

        if not bots.exists():
            self.stdout.write(self.style.WARNING('No active bots found'))
            return

        for bot in bots:
            self.stdout.write(f'\nBot: {bot.name} (id={bot.pk})')
            self.stdout.write(f'Username: @{bot.username}')

            webhook_url = f'{base_url}/api/bot/webhook/{bot.pk}/'
            self.stdout.write(f'Setting webhook: {webhook_url}')

            try:
                params = {'url': webhook_url}
                if webhook_secret:
                    params['secret_token'] = webhook_secret

                resp = httpx.post(
                    f'https://api.telegram.org/bot{bot.token}/setWebhook',
                    json=params,
                    timeout=10,
                )
                data = resp.json()

                if data.get('ok'):
                    self.stdout.write(self.style.SUCCESS('Webhook set successfully'))
                else:
                    self.stdout.write(self.style.ERROR(
                        f'API error: {data.get("description", data)}'
                    ))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Request error: {e}'))
