import logging
from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Client
from apps.meals.models import Meal, MealDraft
from apps.meals.serializers import MealCreateSerializer, MealSerializer, MealDraftSerializer
from apps.meals.services import analyze_food_for_client, get_daily_summary
from apps.persona.models import TelegramBot
from apps.reminders.models import Reminder
from apps.reminders.serializers import ReminderSerializer
from core.validators import validate_uploaded_image

logger = logging.getLogger(__name__)


def get_client_from_token(request):
    """Extract client from JWT token claims."""
    if not request.auth:
        logger.debug('get_client_from_token: no request.auth')
        return None

    # simplejwt tokens: access claims via payload dict or dict-like access
    try:
        # Try payload dict first (works for all token types)
        payload = getattr(request.auth, 'payload', None)
        if payload:
            client_id = payload.get('client_id')
        else:
            # Fallback: dict-like access (request.auth['key'])
            client_id = request.auth['client_id']
    except (AttributeError, KeyError, TypeError) as e:
        logger.warning('get_client_from_token: error accessing claims: %s', e)
        client_id = None

    if not client_id:
        logger.debug('get_client_from_token: no client_id in token')
        return None
    try:
        return Client.objects.get(pk=client_id)
    except Client.DoesNotExist:
        logger.warning('get_client_from_token: client %s not found', client_id)
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
            logger.warning('[MEAL CREATE] No client from token')
            return Response(status=status.HTTP_403_FORBIDDEN)

        logger.info(
            '[MEAL CREATE] Starting: client=%s (%s), content_type=%s',
            client.pk, client.telegram_username, request.content_type
        )

        data = request.data.copy()
        data['client'] = client.pk
        data['image_type'] = 'food'
        data['meal_time'] = timezone.now()

        # Log incoming data (without image binary)
        log_data = {k: v for k, v in data.items() if k != 'image'}
        if 'image' in request.FILES:
            log_data['image'] = f"<File: {request.FILES['image'].name}, {request.FILES['image'].size} bytes>"
        logger.info('[MEAL CREATE] Data: %s', log_data)

        serializer = MealCreateSerializer(data=data)
        if serializer.is_valid():
            meal = serializer.save()
            logger.info(
                '[MEAL CREATE] Success: client=%s meal_id=%s dish="%s"',
                client.pk, meal.pk, meal.dish_name
            )

            # Send notification to coach
            async_to_sync(_notify_coach_about_meal_miniapp)(client, meal)

            return Response(MealSerializer(meal).data, status=status.HTTP_201_CREATED)

        logger.error(
            '[MEAL CREATE] Validation failed: client=%s errors=%s',
            client.pk, serializer.errors
        )
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

        # Используем aggregate для одного запроса к БД
        from django.db.models import Sum, Count
        from django.db.models.functions import Coalesce

        aggregated = Meal.objects.filter(
            client=client,
            image_type='food',
            meal_time__date=target_date,
        ).aggregate(
            calories=Coalesce(Sum('calories'), 0.0),
            proteins=Coalesce(Sum('proteins'), 0.0),
            fats=Coalesce(Sum('fats'), 0.0),
            carbs=Coalesce(Sum('carbohydrates'), 0.0),
            meals_count=Count('id'),
        )

        totals = {
            'calories': round(aggregated['calories']),
            'proteins': round(aggregated['proteins']),
            'fats': round(aggregated['fats']),
            'carbs': round(aggregated['carbs']),
        }

        return Response({
            'date': target_date.isoformat(),
            'totals': totals,
            'meals_count': aggregated['meals_count'],
        })


class ClientMealAnalyzeView(APIView):
    """Analyze a food photo and return nutrition data."""

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from asgiref.sync import async_to_sync
        from apps.chat.models import InteractionLog

        client = get_client_from_token(request)
        if not client:
            logger.warning('[MEAL ANALYZE] No client from token')
            return Response(status=status.HTTP_403_FORBIDDEN)

        logger.info(
            '[MEAL ANALYZE] Starting: client=%s (%s)',
            client.pk, client.telegram_username
        )

        image = request.FILES.get('image')
        if not image:
            logger.warning('[MEAL ANALYZE] No image in request: client=%s', client.pk)
            return Response(
                {'error': 'Image is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Валидация изображения перед чтением
        try:
            validate_uploaded_image(image)
        except DjangoValidationError as e:
            logger.warning('[MEAL ANALYZE] Invalid image: client=%s error=%s', client.pk, e.message)
            return Response(
                {'error': e.message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_data = image.read()
        caption = request.data.get('caption', '')

        logger.info(
            '[MEAL ANALYZE] Image: %s, %d bytes, caption="%s"',
            image.name, len(image_data), caption[:50] if caption else ''
        )

        try:
            result = async_to_sync(analyze_food_for_client)(client, image_data, caption)
            logger.info(
                '[MEAL ANALYZE] Success: client=%s dish="%s"',
                client.pk, result.get('dish_name', 'unknown')
            )
            return Response(result)
        except Exception as e:
            logger.exception(
                '[ANALYZE] Error analyzing photo for client=%s: %s',
                client.pk, str(e)
            )

            # Log failed interaction
            InteractionLog.objects.create(
                client=client,
                coach=client.coach,
                interaction_type='vision',
                client_input=caption or '[Miniapp: Фото еды]',
                ai_request={
                    'source': 'miniapp',
                    'caption': caption,
                    'error': True,
                },
                ai_response={
                    'error': str(e),
                },
                client_output=f'Ошибка: {str(e)}',
                provider='unknown',
                model='unknown',
                duration_ms=0,
            )

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

        logger.info(
            '[RECALCULATE VIEW] Received: correction="%s", previous_analysis=%s',
            correction, previous_analysis
        )

        if not previous_analysis or not correction:
            return Response(
                {'error': 'previous_analysis and correction required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = async_to_sync(recalculate_meal_for_client)(
                client, previous_analysis, correction
            )
            logger.info('[RECALCULATE VIEW] Result: %s', result)
            return Response(result)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ========== УМНЫЙ РЕЖИМ ==========

class ClientMealAnalyzeSmartView(APIView):
    """Анализ фото еды в умном режиме - возвращает черновик для подтверждения."""

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from asgiref.sync import async_to_sync
        from apps.meals.services import analyze_food_smart

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        logger.info('[SMART ANALYZE] Starting for client=%s', client.pk)

        image = request.FILES.get('image')
        if not image:
            return Response(
                {'error': 'Image is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Валидация изображения перед чтением
        try:
            validate_uploaded_image(image)
        except DjangoValidationError as e:
            logger.warning('[SMART ANALYZE] Invalid image: client=%s error=%s', client.pk, e.message)
            return Response(
                {'error': e.message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_data = image.read()
        caption = request.data.get('caption', '')

        try:
            draft = async_to_sync(analyze_food_smart)(client, image_data, caption)
            logger.info('[SMART ANALYZE] Created draft=%s', draft.pk)
            return Response(MealDraftSerializer(draft).data)
        except Exception as e:
            logger.exception('[SMART ANALYZE] Error: %s', e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ClientMealDraftDetailView(APIView):
    """Получить/обновить/удалить черновик клиента."""

    def get(self, request, draft_id):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            draft = MealDraft.objects.get(pk=draft_id, client=client)
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден'}, status=status.HTTP_404_NOT_FOUND)

        return Response(MealDraftSerializer(draft).data)

    def patch(self, request, draft_id):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            draft = MealDraft.objects.get(pk=draft_id, client=client, status='pending')
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден'}, status=status.HTTP_404_NOT_FOUND)

        if 'dish_name' in request.data:
            draft.dish_name = request.data['dish_name']
        if 'dish_type' in request.data:
            draft.dish_type = request.data['dish_type']
        if 'estimated_weight' in request.data:
            new_weight = int(request.data['estimated_weight'])
            # Пропорциональный пересчёт всех ингредиентов
            draft.scale_by_weight(new_weight)
            logger.info('[DRAFT UPDATE] Scaled weight: %d -> %d', draft.estimated_weight, new_weight)

        draft.save()
        return Response(MealDraftSerializer(draft).data)

    def delete(self, request, draft_id):
        from asgiref.sync import async_to_sync
        from apps.meals.services import cancel_draft

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            draft = MealDraft.objects.get(pk=draft_id, client=client, status='pending')
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден'}, status=status.HTTP_404_NOT_FOUND)

        async_to_sync(cancel_draft)(draft)
        return Response({'status': 'cancelled'})


class ClientMealDraftConfirmView(APIView):
    """Подтвердить черновик и создать Meal."""

    def post(self, request, draft_id):
        from asgiref.sync import async_to_sync
        from apps.meals.services import confirm_draft

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        logger.info('[DRAFT CONFIRM VIEW] Starting: draft_id=%s client=%s', draft_id, client.pk)

        try:
            draft = MealDraft.objects.get(pk=draft_id, client=client, status='pending')
        except MealDraft.DoesNotExist:
            logger.warning('[DRAFT CONFIRM VIEW] Draft not found: %s', draft_id)
            return Response({'error': 'Черновик не найден'}, status=status.HTTP_404_NOT_FOUND)

        try:
            meal = async_to_sync(confirm_draft)(draft)
            logger.info('[DRAFT CONFIRM VIEW] Meal created: %s', meal.pk)
        except Exception as e:
            logger.exception('[DRAFT CONFIRM VIEW] Error confirming draft: %s', e)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Generate AI comment (like in regular mode)
        ai_response = ''
        try:
            from apps.meals.services import generate_meal_comment
            ai_response = async_to_sync(generate_meal_comment)(client, meal)
            logger.info('[DRAFT CONFIRM VIEW] AI comment generated: %d chars', len(ai_response))
        except Exception as comment_err:
            logger.warning('[DRAFT CONFIRM VIEW] Failed to generate AI comment: %s', comment_err)

        # Notify coach
        try:
            async_to_sync(_notify_coach_about_meal_miniapp)(client, meal)
        except Exception as notify_err:
            logger.warning('[DRAFT CONFIRM VIEW] Failed to notify coach: %s', notify_err)

        # Add compliance feedback to response
        compliance_feedback = None
        meal.refresh_from_db()  # Get updated program_check_status
        if meal.program_check_status:
            if meal.program_check_status == 'violation':
                from apps.nutrition_programs.models import MealComplianceCheck
                compliance_check = MealComplianceCheck.objects.filter(meal=meal).first()
                if compliance_check:
                    compliance_feedback = {
                        'is_compliant': False,
                        'found_forbidden': compliance_check.found_forbidden,
                        'ai_comment': compliance_check.ai_comment,
                    }
                    if ai_response:
                        ai_response += f'\n\n⚠️ {compliance_check.ai_comment}'
                    else:
                        ai_response = f'⚠️ {compliance_check.ai_comment}'
            elif meal.program_check_status == 'compliant':
                compliance_feedback = {
                    'is_compliant': True,
                    'found_forbidden': [],
                    'ai_comment': 'Отлично! Вы соблюдаете программу питания.',
                }
                if ai_response:
                    ai_response += '\n\n✅ Отлично! Вы соблюдаете программу питания.'
                else:
                    ai_response = '✅ Отлично! Вы соблюдаете программу питания.'

        return Response({
            'status': 'confirmed',
            'meal_id': meal.id,
            'meal': MealSerializer(meal).data,
            'ai_response': ai_response,
            'compliance_feedback': compliance_feedback,
        })


class ClientMealDraftAddIngredientView(APIView):
    """Добавить ингредиент в черновик (AI прикидывает вес и КБЖУ)."""

    def post(self, request, draft_id):
        from asgiref.sync import async_to_sync
        from apps.meals.services import add_ingredient_to_draft

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            draft = MealDraft.objects.get(pk=draft_id, client=client, status='pending')
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден'}, status=status.HTTP_404_NOT_FOUND)

        ingredient_name = request.data.get('name')
        if not ingredient_name:
            return Response({'error': 'Укажите название ингредиента'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_ingredient = async_to_sync(add_ingredient_to_draft)(draft, ingredient_name)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        draft.refresh_from_db()
        return Response({
            'ingredient': new_ingredient,
            'draft': MealDraftSerializer(draft).data,
        })


class ClientMealDraftRemoveIngredientView(APIView):
    """Удалить или отредактировать ингредиент в черновике."""

    def delete(self, request, draft_id, index):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            draft = MealDraft.objects.get(pk=draft_id, client=client, status='pending')
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден'}, status=status.HTTP_404_NOT_FOUND)

        try:
            index = int(index)
        except ValueError:
            return Response({'error': 'Неверный индекс'}, status=status.HTTP_400_BAD_REQUEST)

        if index < 0 or index >= len(draft.ingredients):
            return Response({'error': 'Индекс вне диапазона'}, status=status.HTTP_400_BAD_REQUEST)

        draft.remove_ingredient(index)
        draft.save()

        return Response({
            'status': 'removed',
            'draft': MealDraftSerializer(draft).data,
        })

    def patch(self, request, draft_id, index):
        """Обновить данные ингредиента (name, weight, calories, proteins, fats, carbs)."""
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            draft = MealDraft.objects.get(pk=draft_id, client=client, status='pending')
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден'}, status=status.HTTP_404_NOT_FOUND)

        try:
            index = int(index)
        except ValueError:
            return Response({'error': 'Неверный индекс'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            draft.update_ingredient(index, request.data)
            draft.save()
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        logger.info('[DRAFT] Updated ingredient %d in draft %s: %s', index, draft_id, request.data)

        return Response({
            'status': 'updated',
            'ingredient': draft.ingredients[index],
            'draft': MealDraftSerializer(draft).data,
        })


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
    """Send notification about meal to coach's report chat (from miniapp, with photo)."""
    from asgiref.sync import sync_to_async
    from apps.bot.telegram_api import send_notification, send_photo_notification

    try:
        # Get bot for client's coach
        bot = await sync_to_async(
            lambda: TelegramBot.objects.filter(coach=client.coach).first()
        )()
        if not bot:
            return

        # Get coach's notification chat ID
        coach = await sync_to_async(lambda: client.coach)()
        notification_chat_id = coach.telegram_notification_chat_id
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

        caption = (
            f'🍽 <b>{client_name}</b> (miniapp)\n\n'
            f'<b>{dish_name}</b>\n'
            f'{kbju_str}\n\n'
        )

        if daily_target:
            progress_pct = int(daily_calories / daily_target * 100) if daily_target else 0
            caption += f'📊 За день: {int(daily_calories)} / {int(daily_target)} ккал ({progress_pct}%)'
        else:
            caption += f'📊 За день: {int(daily_calories)} ккал'

        # Try to send with photo
        image_data = None
        if meal.image:
            try:
                # Сбрасываем указатель на начало перед чтением
                await sync_to_async(lambda: meal.image.seek(0))()
                image_data = await sync_to_async(lambda: meal.image.read())()
            except Exception as img_err:
                logger.warning('[NOTIFY] Could not read meal image: %s', img_err)

        if image_data:
            result, new_chat_id = await send_photo_notification(
                bot.token, notification_chat_id, image_data, caption, parse_mode='HTML'
            )
        else:
            result, new_chat_id = await send_notification(
                bot.token, notification_chat_id, caption, parse_mode='HTML'
            )

        # Обновляем chat_id если группа мигрировала в супергруппу
        if new_chat_id:
            coach.telegram_notification_chat_id = str(new_chat_id)
            await sync_to_async(coach.save)(update_fields=['telegram_notification_chat_id'])
            logger.info('[NOTIFY] Updated notification chat_id for coach=%s: %s -> %s',
                       coach.pk, notification_chat_id, new_chat_id)

        if result:
            logger.info('[NOTIFY] Sent miniapp meal notification for client=%s to chat=%s', client.pk, notification_chat_id)

    except Exception as e:
        logger.warning('[NOTIFY] Failed to send miniapp meal notification: %s', e)


class ClientOnboardingQuestionsView(APIView):
    """Get onboarding questions for the client's coach."""

    def get(self, request):
        from apps.onboarding.models import OnboardingQuestion

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        questions = OnboardingQuestion.objects.filter(coach=client.coach).order_by('order')

        return Response({
            'questions': [
                {
                    'id': q.pk,
                    'text': q.text,
                    'type': q.question_type,
                    'options': q.options,
                    'is_required': q.is_required,
                    'field_key': q.field_key,
                }
                for q in questions
            ],
            'client': {
                'first_name': client.first_name,
                'onboarding_completed': client.onboarding_completed,
            },
        })


class ClientOnboardingSubmitView(APIView):
    """Submit all onboarding answers at once."""

    def post(self, request):
        from apps.onboarding.services import calculate_tdee

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        answers = request.data.get('answers', {})
        if not answers:
            return Response(
                {'error': 'answers required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Save answers to onboarding_data
        client.onboarding_data = {
            'started': True,
            'completed': True,
            'answers': answers,
        }

        # Try to calculate TDEE from standard fields
        weight = self._to_float(answers.get('weight'))
        height = self._to_float(answers.get('height'))
        age = self._to_float(answers.get('age'))
        gender = answers.get('gender', '').lower() if isinstance(answers.get('gender'), str) else ''
        activity = answers.get('activity_level', 'moderate')

        if weight and height and age:
            norms = calculate_tdee(weight, height, age, gender, activity)
            client.daily_calories = round(norms['calories'])
            client.daily_proteins = round(norms['proteins'], 1)
            client.daily_fats = round(norms['fats'], 1)
            client.daily_carbs = round(norms['carbs'], 1)

        # Save additional fields directly to client
        if weight:
            client.weight = weight
        if height:
            client.height = int(height)
        if age:
            client.age = int(age)
        if gender:
            client.gender = gender
        if activity:
            client.activity_level = activity

        client.onboarding_completed = True
        client.status = 'active'
        client.save()

        logger.info('Onboarding completed via miniapp for client %s', client.pk)

        return Response({
            'success': True,
            'client': {
                'id': client.pk,
                'first_name': client.first_name,
                'last_name': client.last_name,
                'daily_calories': client.daily_calories,
                'daily_proteins': client.daily_proteins,
                'daily_fats': client.daily_fats,
                'daily_carbs': client.daily_carbs,
                'daily_water': client.daily_water,
                'onboarding_completed': client.onboarding_completed,
            },
        })

    def _to_float(self, value) -> float | None:
        """Safely convert value to float."""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None


class ClientProfileView(APIView):
    """Get and update client profile."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        return Response({
            'id': client.pk,
            'first_name': client.first_name,
            'last_name': client.last_name,
            'gender': client.gender,
            'age': client.age,
            'height': client.height,
            'weight': float(client.weight) if client.weight else None,
            'daily_calories': client.daily_calories,
            'daily_proteins': float(client.daily_proteins) if client.daily_proteins else None,
            'daily_fats': float(client.daily_fats) if client.daily_fats else None,
            'daily_carbs': float(client.daily_carbs) if client.daily_carbs else None,
            'daily_water': float(client.daily_water) if client.daily_water else None,
            'onboarding_completed': client.onboarding_completed,
            'meal_analysis_mode': client.meal_analysis_mode,
        })

    def patch(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        data = request.data
        updated_fields = []

        # Update basic profile fields
        if 'gender' in data:
            client.gender = data['gender']
            updated_fields.append('gender')

        if 'age' in data:
            client.age = data['age']
            updated_fields.append('age')

        if 'height' in data:
            client.height = data['height']
            updated_fields.append('height')

        if 'weight' in data:
            client.weight = data['weight']
            updated_fields.append('weight')

        # Update nutrition goals
        if 'daily_calories' in data:
            client.daily_calories = data['daily_calories']
            updated_fields.append('daily_calories')

        if 'daily_proteins' in data:
            client.daily_proteins = data['daily_proteins']
            updated_fields.append('daily_proteins')

        if 'daily_fats' in data:
            client.daily_fats = data['daily_fats']
            updated_fields.append('daily_fats')

        if 'daily_carbs' in data:
            client.daily_carbs = data['daily_carbs']
            updated_fields.append('daily_carbs')

        if 'daily_water' in data:
            client.daily_water = data['daily_water']
            updated_fields.append('daily_water')

        # Режим анализа еды
        if 'meal_analysis_mode' in data:
            if data['meal_analysis_mode'] in ('ask', 'fast', 'smart'):
                client.meal_analysis_mode = data['meal_analysis_mode']
                updated_fields.append('meal_analysis_mode')

        if updated_fields:
            client.save(update_fields=updated_fields)

        return Response({
            'id': client.pk,
            'first_name': client.first_name,
            'last_name': client.last_name,
            'gender': client.gender,
            'age': client.age,
            'height': client.height,
            'weight': float(client.weight) if client.weight else None,
            'daily_calories': client.daily_calories,
            'daily_proteins': float(client.daily_proteins) if client.daily_proteins else None,
            'daily_fats': float(client.daily_fats) if client.daily_fats else None,
            'daily_carbs': float(client.daily_carbs) if client.daily_carbs else None,
            'daily_water': float(client.daily_water) if client.daily_water else None,
            'onboarding_completed': client.onboarding_completed,
            'meal_analysis_mode': client.meal_analysis_mode,
        })
