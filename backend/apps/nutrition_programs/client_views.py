"""
API views для miniapp клиента — программы питания.
"""
import base64
import logging
from datetime import date

from django.db.models import Count, Prefetch, Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Client
from apps.bot.client_views import get_client_from_token

from .models import MealComplianceCheck, MealReport, NutritionProgram, NutritionProgramDay
from .serializers import MealReportCreateSerializer, MealReportSerializer
from .services import (
    analyze_meal_report,
    get_active_program_for_client,
    get_client_today,
    get_program_day,
)

logger = logging.getLogger(__name__)


class NutritionProgramTodayView(APIView):
    """GET /api/miniapp/nutrition-program/today/ — программа на сегодня."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        today = get_client_today(client)
        program = get_active_program_for_client(client, today)

        if not program:
            return Response({'has_program': False})

        program_day = get_program_day(program, today)
        if not program_day:
            return Response({'has_program': False})

        # Статистика за сегодня
        today_checks = MealComplianceCheck.objects.filter(
            program_day=program_day,
        )
        meals_count = today_checks.count()
        compliant_meals = today_checks.filter(is_compliant=True).count()
        violations_count = meals_count - compliant_meals

        return Response({
            'has_program': True,
            'program_id': program.id,
            'program_name': program.name,
            'general_notes': program.general_notes,
            'day_number': program_day.day_number,
            'total_days': program.duration_days,
            'date': str(program_day.date),
            'meals': program_day.get_meals_list(),
            'activity': program_day.activity,
            'allowed_ingredients': program_day.allowed_ingredients_list,
            'forbidden_ingredients': program_day.forbidden_ingredients_list,
            'notes': program_day.notes,
            'today_stats': {
                'meals_count': meals_count,
                'compliant_meals': compliant_meals,
                'violations_count': violations_count,
            },
        })


class NutritionProgramHistoryView(APIView):
    """GET /api/miniapp/nutrition-program/history/ — история соблюдения."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Получаем программу с оптимизированной загрузкой
        program = NutritionProgram.objects.filter(
            client=client,
        ).prefetch_related(
            Prefetch(
                'days',
                queryset=NutritionProgramDay.objects.annotate(
                    _meals_count=Count('compliance_checks'),
                    _compliant_count=Count(
                        'compliance_checks',
                        filter=Q(compliance_checks__is_compliant=True)
                    ),
                ).prefetch_related(
                    Prefetch(
                        'compliance_checks',
                        queryset=MealComplianceCheck.objects.filter(
                            is_compliant=False
                        ).select_related('meal'),
                        to_attr='violation_checks',
                    )
                ).order_by('day_number'),
            )
        ).order_by('-created_at').first()

        if not program:
            return Response({'has_program': False})

        # Статистика по дням
        days_data = []
        total_meals = 0
        total_compliant = 0

        for day in program.days.all():
            meals_count = day._meals_count
            compliant_meals = day._compliant_count
            total_meals += meals_count
            total_compliant += compliant_meals

            violations = []
            for check in day.violation_checks:
                violations.append({
                    'meal_id': check.meal_id,
                    'meal_name': check.meal.dish_name,
                    'meal_time': check.meal.meal_time.isoformat(),
                    'found_forbidden': check.found_forbidden,
                    'ai_comment': check.ai_comment,
                })

            days_data.append({
                'day_number': day.day_number,
                'date': str(day.date),
                'meals_count': meals_count,
                'compliant_meals': compliant_meals,
                'violations': violations,
            })

        # Общая статистика (уже посчитана в цикле)
        compliance_rate = round(total_compliant / total_meals * 100) if total_meals > 0 else None

        return Response({
            'has_program': True,
            'program_id': program.id,
            'program_name': program.name,
            'status': program.status,
            'start_date': str(program.start_date),
            'end_date': str(program.end_date),
            'total_days': program.duration_days,
            'compliance_rate': compliance_rate,
            'days': days_data,
        })


class NutritionProgramViolationsView(APIView):
    """GET /api/miniapp/nutrition-program/violations/ — список нарушений."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            limit = min(max(1, int(request.query_params.get('limit', 20))), 100)
        except (ValueError, TypeError):
            limit = 20

        checks = MealComplianceCheck.objects.filter(
            program_day__program__client=client,
            is_compliant=False,
        ).select_related(
            'meal',
            'program_day',
            'program_day__program',
        ).order_by('-created_at')[:limit]

        violations = []
        for check in checks:
            violations.append({
                'id': check.id,
                'meal_id': check.meal_id,
                'meal_name': check.meal.dish_name,
                'meal_time': check.meal.meal_time.isoformat(),
                'program_name': check.program_day.program.name,
                'day_number': check.program_day.day_number,
                'found_forbidden': check.found_forbidden,
                'ai_comment': check.ai_comment,
                'created_at': check.created_at.isoformat(),
            })

        return Response({'violations': violations})


class NutritionProgramSummaryView(APIView):
    """GET /api/miniapp/nutrition-program/summary/ — краткая сводка для dashboard."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        today = get_client_today(client)
        program = get_active_program_for_client(client, today)

        if not program:
            return Response({'has_program': False})

        program_day = get_program_day(program, today)
        current_day = program_day.day_number if program_day else None

        # Общая статистика
        total_checks = MealComplianceCheck.objects.filter(program_day__program=program)
        total_meals = total_checks.count()
        total_compliant = total_checks.filter(is_compliant=True).count()
        compliance_rate = round(total_compliant / total_meals * 100) if total_meals > 0 else None

        return Response({
            'has_program': True,
            'id': program.id,
            'name': program.name,
            'status': program.status,
            'current_day': current_day,
            'total_days': program.duration_days,
            'compliance_rate': compliance_rate,
        })


class ShoppingListView(APIView):
    """GET /api/miniapp/nutrition-program/shopping-list/ — список продуктов для покупки (из базы)."""

    def get(self, request):
        from datetime import timedelta

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Количество дней вперёд (по умолчанию 3)
        try:
            days_ahead = min(max(1, int(request.query_params.get('days', 3))), 14)
        except (ValueError, TypeError):
            days_ahead = 3

        today = get_client_today(client)
        program = get_active_program_for_client(client, today)

        if not program:
            return Response({'has_program': False, 'categories': [], 'items_count': 0})

        # Получаем дни программы на указанный период
        end_date = today + timedelta(days=days_ahead - 1)
        program_days = NutritionProgramDay.objects.filter(
            program=program,
            date__gte=today,
            date__lte=end_date,
        ).order_by('date')

        # Собираем продукты из shopping_list каждого дня
        # Группируем по категориям
        category_map = {
            'vegetables': {'name': 'Овощи и фрукты', 'emoji': '🥬', 'items': set()},
            'meat': {'name': 'Мясо и рыба', 'emoji': '🥩', 'items': set()},
            'dairy': {'name': 'Молочные продукты', 'emoji': '🥛', 'items': set()},
            'grains': {'name': 'Крупы и гарниры', 'emoji': '🌾', 'items': set()},
            'other': {'name': 'Прочее', 'emoji': '🛒', 'items': set()},
        }

        for day in program_days:
            for item in day.shopping_list:
                if isinstance(item, dict) and item.get('name'):
                    cat = item.get('category', 'other')
                    if cat not in category_map:
                        cat = 'other'
                    category_map[cat]['items'].add(item['name'])

        # Формируем список категорий (только непустые)
        categories = []
        for cat_key in ['vegetables', 'meat', 'dairy', 'grains', 'other']:
            cat_data = category_map[cat_key]
            if cat_data['items']:
                categories.append({
                    'name': cat_data['name'],
                    'emoji': cat_data['emoji'],
                    'items': sorted(list(cat_data['items'])),
                })

        total_items = sum(len(cat['items']) for cat in categories)

        return Response({
            'has_program': True,
            'program_name': program.name,
            'days_count': days_ahead,
            'start_date': str(today),
            'end_date': str(end_date),
            'categories': categories,
            'items_count': total_items,
        })


class MealReportCreateView(APIView):
    """POST /api/miniapp/nutrition-program/meal-report/ — загрузка фото-отчёта."""

    def post(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = MealReportCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        meal_type = serializer.validated_data['meal_type']
        photo_file_id = serializer.validated_data.get('photo_file_id', '')
        photo_url = serializer.validated_data.get('photo_url', '')
        photo_base64 = serializer.validated_data.get('photo_base64', '')

        # Если передан base64, сохраняем как data URL для отображения во фронтенде
        if photo_base64 and not photo_url:
            photo_url = f"data:image/jpeg;base64,{photo_base64}"

        # Получаем целевую дату (опционально, по умолчанию сегодня)
        target_date = serializer.validated_data.get('date') or get_client_today(client)
        program = get_active_program_for_client(client, target_date)

        if not program:
            return Response(
                {'error': 'Нет активной программы питания на указанную дату'},
                status=status.HTTP_404_NOT_FOUND
            )

        program_day = get_program_day(program, target_date)
        if not program_day:
            return Response(
                {'error': 'День программы не найден для указанной даты'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Создаём новый отчёт (разрешаем несколько фото на один приём пищи)
        meal_report = MealReport(
            program_day=program_day,
            meal_type=meal_type,
            photo_file_id=photo_file_id,
            photo_url=photo_url,
        )
        meal_report.save()

        # Получаем данные фото для анализа
        image_data = None
        if photo_base64:
            try:
                image_data = base64.b64decode(photo_base64)
            except Exception as e:
                logger.error('Failed to decode base64: %s', e)

        # Если есть фото — запускаем анализ
        if image_data:
            try:
                from asgiref.sync import async_to_sync
                logger.info(
                    '[MEAL_REPORT] Starting analysis: report=%s meal_type=%s program_day=%s image_size=%d',
                    meal_report.pk, meal_type, program_day.pk, len(image_data)
                )
                async_to_sync(analyze_meal_report)(meal_report, image_data)
                logger.info('[MEAL_REPORT] Analysis completed successfully for report=%s', meal_report.pk)
            except Exception as e:
                logger.exception(
                    '[MEAL_REPORT] Failed to analyze report=%s: %s (type=%s)',
                    meal_report.pk, str(e), type(e).__name__
                )
                meal_report.ai_analysis = f'Не удалось проанализировать фото: {str(e)[:100]}'
                meal_report.save()

        return Response(MealReportSerializer(meal_report).data, status=status.HTTP_201_CREATED)


class MealReportPhotoView(APIView):
    """GET /api/miniapp/nutrition-program/meal-report/<id>/photo/ — получение фото отчёта."""

    def get(self, request, report_id):
        from asgiref.sync import async_to_sync
        from django.http import HttpResponse, HttpResponseRedirect

        from apps.bot.models import TelegramBot
        from apps.bot.telegram_api import get_file

        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Получаем отчёт и проверяем что он принадлежит клиенту
        report = MealReport.objects.filter(
            id=report_id,
            program_day__program__client=client,
        ).first()

        if not report:
            return Response(
                {'error': 'Отчёт не найден'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Если есть photo_url — редирект
        if report.photo_url:
            return HttpResponseRedirect(report.photo_url)

        # Если есть photo_file_id — скачиваем из Telegram
        if report.photo_file_id:
            bot = TelegramBot.objects.filter(is_active=True).first()
            if not bot:
                return Response(
                    {'error': 'Telegram бот не настроен'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            try:
                file_data = async_to_sync(get_file)(bot.token, report.photo_file_id)
                if file_data:
                    return HttpResponse(
                        file_data,
                        content_type='image/jpeg',
                    )
            except Exception as e:
                logger.exception('Failed to get photo from Telegram: %s', e)

        return Response(
            {'error': 'Фото не найдено'},
            status=status.HTTP_404_NOT_FOUND
        )


class MealReportsListView(APIView):
    """GET /api/miniapp/nutrition-program/meal-reports/ — список фото-отчётов за день."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Параметр date (опционально, по умолчанию сегодня)
        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = date.fromisoformat(date_str)
            except ValueError:
                return Response(
                    {'error': 'Invalid date format, use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            target_date = get_client_today(client)

        # Получаем программу и день
        program = get_active_program_for_client(client, target_date)
        if not program:
            return Response({'reports': []})

        program_day = get_program_day(program, target_date)
        if not program_day:
            return Response({'reports': []})

        # Получаем отчёты за день
        reports = MealReport.objects.filter(
            program_day=program_day
        ).order_by('created_at')

        return Response({
            'date': str(target_date),
            'day_number': program_day.day_number,
            'reports': MealReportSerializer(reports, many=True).data,
        })
