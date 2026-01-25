import httpx
from django.core.management.base import BaseCommand

from apps.persona.models import TelegramBot


class Command(BaseCommand):
    help = 'Check webhook status for active Telegram bots'

    def handle(self, *args, **options):
        bots = TelegramBot.objects.filter(is_active=True)

        if not bots.exists():
            self.stdout.write(self.style.WARNING('No active bots found'))
            return

        for bot in bots:
            self.stdout.write(f'\nBot: {bot.name} (id={bot.pk})')
            self.stdout.write(f'Username: @{bot.username}')

            try:
                resp = httpx.get(
                    f'https://api.telegram.org/bot{bot.token}/getWebhookInfo',
                    timeout=10,
                )
                data = resp.json()

                if data.get('ok'):
                    info = data['result']
                    url = info.get('url', '')
                    pending = info.get('pending_update_count', 0)
                    last_error = info.get('last_error_message', '')
                    last_error_date = info.get('last_error_date', '')

                    self.stdout.write(f'Webhook URL: {url or "(not set)"}')
                    self.stdout.write(f'Pending updates: {pending}')

                    if last_error:
                        self.stdout.write(self.style.ERROR(f'Last error: {last_error}'))
                    else:
                        self.stdout.write(self.style.SUCCESS('No errors'))
                else:
                    self.stdout.write(self.style.ERROR(f'API error: {data}'))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Request error: {e}'))
