import logging
from datetime import date

from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Client
from apps.meals.models import Meal
from apps.meals.serializers import MealCreateSerializer, MealSerializer
from apps.meals.services import analyze_food_for_client, get_daily_summary
from apps.persona.models import TelegramBot
from apps.reminders.models import Reminder
from apps.reminders.serializers import ReminderSerializer

logger = logging.getLogger(__name__)


def get_client_from_token(request):
    """Extract client from JWT token claims."""
    client_id = getattr(request.auth, 'payload', {}).get('client_id') if request.auth else None
    if not client_id:
        return None
    try:
        return Client.objects.get(pk=client_id)
    except Client.DoesNotExist:
        return None


class ClientMealListView(APIView):
    """List and create meals for the authenticated client."""

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        date_str = request.query_params.get('date')
        queryset = Meal.objects.filter(client=client, image_type='food')

        if date_str:
            try:
                target_date = date.fromisoformat(date_str)
            except ValueError:
                return Response(
                    {'error': 'Invalid date format'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = queryset.filter(meal_time__date=target_date)

        meals = queryset[:50]
        serializer = MealSerializer(meals, many=True)
        return Response({'results': serializer.data})

    def post(self, request):
        """Create a new meal for the authenticated client."""
        from asgiref.sync import async_to_sync

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        data['client'] = client.pk
        data['image_type'] = 'food'
        data['meal_time'] = timezone.now()

        serializer = MealCreateSerializer(data=data)
        if serializer.is_valid():
            meal = serializer.save()

            # Send notification to coach
            async_to_sync(_notify_coach_about_meal_miniapp)(client, meal)

            return Response(MealSerializer(meal).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ClientMealDetailView(APIView):
    """Delete a meal for the authenticated client."""

    def delete(self, request, pk):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            meal = Meal.objects.get(pk=pk, client=client)
        except Meal.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        meal.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClientDailySummaryView(APIView):
    """Get daily nutrition summary for the authenticated client."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = date.fromisoformat(date_str)
            except ValueError:
                return Response(
                    {'error': 'Invalid date format'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            target_date = timezone.localdate()

        meals = Meal.objects.filter(
            client=client,
            image_type='food',
            meal_time__date=target_date,
        )

        totals = {
            'calories': round(sum(m.calories or 0 for m in meals)),
            'proteins': round(sum(m.proteins or 0 for m in meals)),
            'fats': round(sum(m.fats or 0 for m in meals)),
            'carbs': round(sum(m.carbohydrates or 0 for m in meals)),
        }

        return Response({
            'date': target_date.isoformat(),
            'totals': totals,
            'meals_count': meals.count(),
        })


class ClientMealAnalyzeView(APIView):
    """Analyze a food photo and return nutrition data."""

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from asgiref.sync import async_to_sync

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        image = request.FILES.get('image')
        if not image:
            return Response(
                {'error': 'Image is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_data = image.read()
        caption = request.data.get('caption', '')

        try:
            result = async_to_sync(analyze_food_for_client)(client, image_data, caption)
            return Response(result)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ClientMealRecalculateView(APIView):
    """Recalculate meal nutrition based on user correction."""

    parser_classes = [JSONParser]

    def post(self, request):
        from asgiref.sync import async_to_sync
        from apps.meals.services import recalculate_meal_for_client

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        previous_analysis = request.data.get('previous_analysis')
        correction = request.data.get('correction')

        if not previous_analysis or not correction:
            return Response(
                {'error': 'previous_analysis and correction required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = async_to_sync(recalculate_meal_for_client)(
                client, previous_analysis, correction
            )
            return Response(result)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ClientReminderListView(APIView):
    """List reminders for the authenticated client."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        reminders = Reminder.objects.filter(client=client)
        serializer = ReminderSerializer(reminders, many=True)
        return Response(serializer.data)

    def patch(self, request):
        """Toggle reminder active state."""
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        reminder_id = request.data.get('id')
        is_active = request.data.get('is_active')
        if reminder_id is None or is_active is None:
            return Response(
                {'error': 'id and is_active required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reminder = Reminder.objects.get(pk=reminder_id, client=client)
        except Reminder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        reminder.is_active = is_active
        reminder.save(update_fields=['is_active'])
        return Response(ReminderSerializer(reminder).data)


async def _notify_coach_about_meal_miniapp(client: Client, meal: Meal):
    """Send notification about meal to coach's report chat (from miniapp)."""
    from asgiref.sync import sync_to_async
    from apps.bot.telegram_api import send_message

    try:
        # Get bot for client's coach
        bot = await sync_to_async(
            lambda: TelegramBot.objects.filter(coach=client.coach).first()
        )()
        if not bot:
            return

        # Get coach's notification chat ID
        notification_chat_id = await sync_to_async(lambda: client.coach.telegram_notification_chat_id)()
        if not notification_chat_id:
            return

        # Get daily summary
        summary = await get_daily_summary(client)

        # Format notification message
        client_name = await sync_to_async(
            lambda: f'{client.first_name} {client.last_name}'.strip() or client.telegram_username or f'Клиент #{client.pk}'
        )()

        dish_name = meal.dish_name or 'Неизвестное блюдо'

        # Build KBJU string
        kbju_parts = []
        if meal.calories:
            kbju_parts.append(f'{int(meal.calories)} ккал')
        if meal.proteins:
            kbju_parts.append(f'Б: {int(meal.proteins)}')
        if meal.fats:
            kbju_parts.append(f'Ж: {int(meal.fats)}')
        if meal.carbohydrates:
            kbju_parts.append(f'У: {int(meal.carbohydrates)}')
        kbju_str = ' | '.join(kbju_parts) if kbju_parts else 'КБЖУ не определено'

        # Daily totals from summary
        consumed = summary.get('consumed', {})
        norms = summary.get('norms', {})
        daily_calories = consumed.get('calories', 0)
        daily_target = norms.get('calories', 0)

        message = (
            f'🍽 <b>{client_name}</b> (miniapp)\n\n'
            f'<b>{dish_name}</b>\n'
            f'{kbju_str}\n\n'
        )

        if daily_target:
            progress_pct = int(daily_calories / daily_target * 100) if daily_target else 0
            message += f'📊 За день: {int(daily_calories)} / {int(daily_target)} ккал ({progress_pct}%)'
        else:
            message += f'📊 За день: {int(daily_calories)} ккал'

        await send_message(bot.token, notification_chat_id, message, parse_mode='HTML')
        logger.info('[NOTIFY] Sent miniapp meal notification for client=%s to chat=%s', client.pk, notification_chat_id)

    except Exception as e:
        logger.warning('[NOTIFY] Failed to send miniapp meal notification: %s', e)
