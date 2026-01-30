"""
Workout notifications to coach
"""
import asyncio
import logging

from asgiref.sync import sync_to_async
from apps.bot.telegram_api import send_notification
from apps.persona.models import TelegramBot

logger = logging.getLogger(__name__)


def notify_workout_started(session):
    """Send notification when client starts a workout"""
    try:
        asyncio.get_event_loop().run_until_complete(
            _send_workout_started_notification(session)
        )
    except RuntimeError:
        # No event loop, create one
        asyncio.run(_send_workout_started_notification(session))


def notify_workout_completed(session):
    """Send notification when client completes a workout"""
    try:
        asyncio.get_event_loop().run_until_complete(
            _send_workout_completed_notification(session)
        )
    except RuntimeError:
        asyncio.run(_send_workout_completed_notification(session))


async def _send_workout_started_notification(session):
    """Async implementation of workout start notification"""
    try:
        client = session.client
        if not client:
            return

        # Get coach's notification chat ID
        coach = await sync_to_async(lambda: client.coach)()
        notification_chat_id = coach.telegram_notification_chat_id
        if not notification_chat_id:
            return

        # Get bot
        bot = await sync_to_async(
            lambda: TelegramBot.objects.filter(coach=coach, is_active=True).first()
        )()
        if not bot:
            return

        # Format message
        client_name = await sync_to_async(
            lambda: f'{client.first_name} {client.last_name}'.strip() or client.telegram_username or f'Клиент #{client.pk}'
        )()
        workout_name = await sync_to_async(lambda: session.workout.name)()

        message = (
            f'🏋️ <b>{client_name}</b>\n\n'
            f'Начал тренировку:\n'
            f'<b>{workout_name}</b>'
        )

        result, new_chat_id = await send_notification(
            bot.token, notification_chat_id, message, parse_mode='HTML'
        )

        # Update chat_id if migrated
        if new_chat_id:
            coach.telegram_notification_chat_id = str(new_chat_id)
            await sync_to_async(coach.save)(update_fields=['telegram_notification_chat_id'])

        if result:
            logger.info('[NOTIFY] Sent workout start notification for client=%s', client.pk)

    except Exception as e:
        logger.warning('[NOTIFY] Failed to send workout start notification: %s', e)


async def _send_workout_completed_notification(session):
    """Async implementation of workout completion notification"""
    try:
        client = session.client
        if not client:
            return

        # Get coach's notification chat ID
        coach = await sync_to_async(lambda: client.coach)()
        notification_chat_id = coach.telegram_notification_chat_id
        if not notification_chat_id:
            return

        # Get bot
        bot = await sync_to_async(
            lambda: TelegramBot.objects.filter(coach=coach, is_active=True).first()
        )()
        if not bot:
            return

        # Get session stats
        workout_name = await sync_to_async(lambda: session.workout.name)()
        client_name = await sync_to_async(
            lambda: f'{client.first_name} {client.last_name}'.strip() or client.telegram_username or f'Клиент #{client.pk}'
        )()

        # Calculate stats from exercise logs
        from apps.workouts.models import FitDBExerciseLog
        logs = await sync_to_async(
            lambda: list(FitDBExerciseLog.objects.filter(session=session))
        )()

        total_sets = len(logs)
        total_reps = sum(log.reps_completed for log in logs)
        total_volume = sum(
            (float(log.weight_kg) if log.weight_kg else 0) * log.reps_completed
            for log in logs
        )
        exercises_count = len(set(log.exercise_id for log in logs))

        # Format duration
        duration_str = ''
        if session.duration_seconds:
            mins = session.duration_seconds // 60
            secs = session.duration_seconds % 60
            if mins > 0:
                duration_str = f'{mins} мин'
            else:
                duration_str = f'{secs} сек'

        message = (
            f'✅ <b>{client_name}</b>\n\n'
            f'Завершил тренировку:\n'
            f'<b>{workout_name}</b>\n\n'
        )

        stats_parts = []
        if duration_str:
            stats_parts.append(f'⏱ {duration_str}')
        if exercises_count:
            stats_parts.append(f'💪 {exercises_count} упр.')
        if total_sets:
            stats_parts.append(f'📊 {total_sets} подходов')
        if total_reps:
            stats_parts.append(f'🔢 {total_reps} повторений')
        if total_volume > 0:
            stats_parts.append(f'🏋️ {int(total_volume)} кг объём')

        if stats_parts:
            message += ' | '.join(stats_parts)

        result, new_chat_id = await send_notification(
            bot.token, notification_chat_id, message, parse_mode='HTML'
        )

        # Update chat_id if migrated
        if new_chat_id:
            coach.telegram_notification_chat_id = str(new_chat_id)
            await sync_to_async(coach.save)(update_fields=['telegram_notification_chat_id'])

        if result:
            logger.info('[NOTIFY] Sent workout completion notification for client=%s', client.pk)

    except Exception as e:
        logger.warning('[NOTIFY] Failed to send workout completion notification: %s', e)
