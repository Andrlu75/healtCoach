import logging

from celery import shared_task
from django.utils import timezone

from .models import Reminder
from .services import compute_next_fire, send_reminder_message

logger = logging.getLogger(__name__)


@shared_task(name='reminders.check_reminders')
def check_reminders():
    """
    Periodic task (every minute): find due reminders, send them, update next_fire_at.
    """
    now = timezone.now()

    due_reminders = Reminder.objects.filter(
        is_active=True,
        next_fire_at__isnull=False,
        next_fire_at__lte=now,
    ).select_related('client', 'coach')

    sent_count = 0
    for reminder in due_reminders:
        try:
            success = send_reminder_message(reminder)
            if success:
                sent_count += 1

            # Update regardless of success to avoid infinite retries
            reminder.last_sent_at = now
            reminder.next_fire_at = compute_next_fire(reminder)
            reminder.save(update_fields=['last_sent_at', 'next_fire_at'])

            # Deactivate one-time reminders after sending
            if reminder.frequency == 'once':
                reminder.is_active = False
                reminder.save(update_fields=['is_active'])

        except Exception as e:
            logger.exception('Error processing reminder %s: %s', reminder.pk, e)

    if sent_count:
        logger.info('Sent %d reminders', sent_count)
