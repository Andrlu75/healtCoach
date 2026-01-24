import hmac
import json
import logging

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def telegram_webhook(request):
    token = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
    if settings.TELEGRAM_WEBHOOK_SECRET and not hmac.compare_digest(token, settings.TELEGRAM_WEBHOOK_SECRET):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    # TODO: Dispatch to handlers (Phase 2)
    logger.info('Received telegram update: %s', data.get('update_id'))

    return JsonResponse({'ok': True})
