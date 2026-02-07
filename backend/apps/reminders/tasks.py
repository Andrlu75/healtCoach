import logging

from celery import shared_task
from django.utils import timezone

from .models import Reminder
from .services import compute_next_fire, send_reminder_message

logger = logging.getLogger(__name__)


@shared_task(name='reminders.check_reminders', bind=True, max_retries=3)
def check_reminders(self):
    """
    Periodic task (every minute): find due reminders, send them, update next_fire_at.
    Also refreshes next_fire_at for meal_program reminders (dynamic schedule).
    """
    now = timezone.now()

    # 1. Пересчитываем next_fire_at для meal_program (расписание зависит от программы)
    meal_program_reminders = Reminder.objects.filter(
        is_active=True,
        reminder_type='meal_program',
    ).select_related('client')

    for reminder in meal_program_reminders:
        try:
            new_fire = compute_next_fire(reminder)
            if new_fire != reminder.next_fire_at:
                reminder.next_fire_at = new_fire
                reminder.save(update_fields=['next_fire_at'])
        except Exception as e:
            logger.exception('Error computing meal_program fire for %s: %s', reminder.pk, e)

    # 2. Находим и отправляем due напоминания
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
