"""
API views для miniapp клиента — программы питания.
"""
from datetime import date

from django.db.models import Count, Prefetch, Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Client
from apps.bot.client_views import get_client_from_token

from .models import MealComplianceCheck, NutritionProgram, NutritionProgramDay
from .services import get_active_program_for_client, get_client_today, get_program_day


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
            'day_number': program_day.day_number,
            'total_days': program.duration_days,
            'date': str(program_day.date),
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

        limit = int(request.query_params.get('limit', 20))

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
