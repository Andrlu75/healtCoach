import csv
from collections import Counter
from io import StringIO

from django.db.models import Count, Prefetch, Q
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class ViolationsPagination(PageNumberPagination):
    """Пагинация для списка нарушений."""

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

from .models import MealComplianceCheck, NutritionProgram, NutritionProgramDay
from .serializers import (
    ComplianceStatsSerializer,
    MealComplianceCheckSerializer,
    NutritionProgramCopySerializer,
    NutritionProgramCreateSerializer,
    NutritionProgramDaySerializer,
    NutritionProgramDayUpdateSerializer,
    NutritionProgramDetailSerializer,
    NutritionProgramSerializer,
)


class NutritionProgramViewSet(viewsets.ModelViewSet):
    """ViewSet для программ питания (CRUD)."""

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'client']
    search_fields = ['name', 'client__first_name', 'client__last_name']
    ordering_fields = ['created_at', 'start_date', 'name', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = NutritionProgram.objects.filter(coach=self.request.user.coach_profile)

        if self.action == 'list':
            qs = qs.select_related('client').annotate(
                _days_count=Count('days'),
                _total_checks=Count('days__compliance_checks'),
                _compliant_checks=Count(
                    'days__compliance_checks',
                    filter=Q(days__compliance_checks__is_compliant=True)
                ),
            )
        elif self.action == 'retrieve':
            qs = qs.select_related('client').prefetch_related('days')

        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return NutritionProgramDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return NutritionProgramCreateSerializer
        return NutritionProgramSerializer

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Активировать программу."""
        from datetime import date

        program = self.get_object()
        if program.status == 'active':
            return Response(
                {'error': 'Программа уже активна'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if program.end_date < date.today():
            return Response(
                {'error': 'Нельзя активировать завершённую программу'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Деактивируем другие активные программы этого клиента
        NutritionProgram.objects.filter(
            client=program.client,
            status='active',
        ).update(status='completed')

        program.status = 'active'
        program.save(update_fields=['status', 'updated_at'])

        return Response({'status': 'active'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Отменить программу."""
        program = self.get_object()
        if program.status == 'cancelled':
            return Response(
                {'error': 'Программа уже отменена'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        program.status = 'cancelled'
        program.save(update_fields=['status', 'updated_at'])

        return Response({'status': 'cancelled'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Завершить программу."""
        program = self.get_object()
        if program.status == 'completed':
            return Response(
                {'error': 'Программа уже завершена'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        program.status = 'completed'
        program.save(update_fields=['status', 'updated_at'])

        return Response({'status': 'completed'})

    @action(detail=True, methods=['post'])
    def copy(self, request, pk=None):
        """Копировать программу для другого клиента/периода."""
        from datetime import timedelta

        from apps.accounts.models import Client

        program = self.get_object()
        serializer = NutritionProgramCopySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        start_date = data['start_date']
        client_id = data.get('client')
        new_name = data.get('name')

        # Определяем клиента
        if client_id:
            try:
                client = Client.objects.get(
                    id=client_id,
                    coach=request.user.coach_profile,
                )
            except Client.DoesNotExist:
                return Response(
                    {'error': 'Клиент не найден'},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            client = program.client

        # Создаём новую программу
        new_program = NutritionProgram.objects.create(
            coach=request.user.coach_profile,
            client=client,
            name=new_name or f'Копия: {program.name}',
            description=program.description,
            general_notes=program.general_notes,
            start_date=start_date,
            duration_days=program.duration_days,
            status='draft',
        )

        # Копируем дни программы
        for day in program.days.all().order_by('day_number'):
            NutritionProgramDay.objects.create(
                program=new_program,
                day_number=day.day_number,
                date=start_date + timedelta(days=day.day_number - 1),
                meals=day.meals,
                activity=day.activity,
                allowed_ingredients=day.allowed_ingredients,
                forbidden_ingredients=day.forbidden_ingredients,
                notes=day.notes,
            )

        return Response(
            NutritionProgramDetailSerializer(new_program, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class NutritionProgramDayViewSet(viewsets.ModelViewSet):
    """ViewSet для дней программы питания."""

    serializer_class = NutritionProgramDaySerializer
    http_method_names = ['get', 'put', 'patch', 'post']

    def get_queryset(self):
        program_id = self.kwargs.get('program_pk')
        return NutritionProgramDay.objects.filter(
            program_id=program_id,
            program__coach=self.request.user.coach_profile,
        ).order_by('day_number')

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return NutritionProgramDayUpdateSerializer
        return NutritionProgramDaySerializer

    @action(detail=True, methods=['post'])
    def copy(self, request, program_pk=None, pk=None):
        """Копировать ингредиенты из другого дня."""
        target_day = self.get_object()
        source_day_id = request.data.get('source_day_id')

        if not source_day_id:
            return Response(
                {'error': 'source_day_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            source_day = NutritionProgramDay.objects.get(
                id=source_day_id,
                program__coach=self.request.user.coach_profile,
            )
        except NutritionProgramDay.DoesNotExist:
            return Response(
                {'error': 'День-источник не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )

        target_day.allowed_ingredients = source_day.allowed_ingredients
        target_day.forbidden_ingredients = source_day.forbidden_ingredients
        target_day.notes = source_day.notes
        target_day.save()

        return Response(NutritionProgramDaySerializer(target_day).data)


class ComplianceStatsViewSet(viewsets.GenericViewSet):
    """ViewSet для статистики соблюдения программ."""

    serializer_class = MealComplianceCheckSerializer
    pagination_class = ViolationsPagination

    def list(self, request):
        """Получить статистику по всем программам."""
        coach = request.user.coach_profile
        program_id = request.query_params.get('program_id')
        client_id = request.query_params.get('client_id')

        programs = NutritionProgram.objects.filter(coach=coach)

        if program_id:
            programs = programs.filter(id=program_id)
        if client_id:
            programs = programs.filter(client_id=client_id)

        # Оптимизация: используем annotate и prefetch вместо N+1 запросов
        programs = programs.select_related('client').annotate(
            _total_checks=Count('days__compliance_checks'),
            _compliant_checks=Count(
                'days__compliance_checks',
                filter=Q(days__compliance_checks__is_compliant=True)
            ),
        ).prefetch_related(
            Prefetch(
                'days__compliance_checks',
                queryset=MealComplianceCheck.objects.filter(is_compliant=False),
                to_attr='violation_checks',
            )
        )

        stats = []
        for program in programs:
            total = program._total_checks
            compliant = program._compliant_checks
            violations = total - compliant

            # Собираем частые нарушения из prefetch-данных
            violation_ingredients = []
            for day in program.days.all():
                for check in getattr(day, 'violation_checks', []):
                    for ingredient in check.found_forbidden:
                        if isinstance(ingredient, dict):
                            violation_ingredients.append(ingredient.get('name', str(ingredient)))
                        else:
                            violation_ingredients.append(str(ingredient))

            most_common = [ing for ing, _ in Counter(violation_ingredients).most_common(5)]

            stats.append({
                'program_id': program.id,
                'program_name': program.name,
                'client_name': f'{program.client.first_name} {program.client.last_name}'.strip(),
                'total_meals': total,
                'compliant_meals': compliant,
                'violations': violations,
                'compliance_rate': round(compliant / total * 100, 1) if total > 0 else 0,
                'most_common_violations': most_common,
            })

        serializer = ComplianceStatsSerializer(stats, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def violations(self, request):
        """Получить список нарушений."""
        coach = request.user.coach_profile
        program_id = request.query_params.get('program_id')
        client_id = request.query_params.get('client_id')
        notified = request.query_params.get('notified')

        checks = MealComplianceCheck.objects.filter(
            program_day__program__coach=coach,
            is_compliant=False,
        ).select_related(
            'meal',
            'program_day',
            'program_day__program',
            'program_day__program__client',
        ).order_by('-created_at')

        if program_id:
            checks = checks.filter(program_day__program_id=program_id)
        if client_id:
            checks = checks.filter(program_day__program__client_id=client_id)
        if notified is not None:
            checks = checks.filter(coach_notified=notified.lower() == 'true')

        # Пагинация
        page = self.paginate_queryset(checks)
        if page is not None:
            serializer = MealComplianceCheckSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = MealComplianceCheckSerializer(checks, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='mark-notified')
    def mark_notified(self, request):
        """Пометить нарушения как просмотренные."""
        coach = request.user.coach_profile
        check_ids = request.data.get('check_ids', [])

        if not check_ids:
            return Response(
                {'error': 'check_ids is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = MealComplianceCheck.objects.filter(
            id__in=check_ids,
            program_day__program__coach=coach,
        ).update(coach_notified=True)

        return Response({'updated': updated})

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        """Экспорт статистики и нарушений в CSV."""
        coach = request.user.coach_profile
        program_id = request.query_params.get('program_id')
        client_id = request.query_params.get('client_id')
        export_type = request.query_params.get('type', 'stats')  # 'stats' or 'violations'

        if export_type == 'violations':
            return self._export_violations_csv(coach, program_id, client_id)
        return self._export_stats_csv(coach, program_id, client_id)

    def _export_stats_csv(self, coach, program_id, client_id):
        """Экспорт статистики по программам."""
        programs = NutritionProgram.objects.filter(coach=coach)

        if program_id:
            programs = programs.filter(id=program_id)
        if client_id:
            programs = programs.filter(client_id=client_id)

        programs = programs.select_related('client').annotate(
            _total_checks=Count('days__compliance_checks'),
            _compliant_checks=Count(
                'days__compliance_checks',
                filter=Q(days__compliance_checks__is_compliant=True)
            ),
        )

        output = StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            'Программа',
            'Клиент',
            'Статус',
            'Дата начала',
            'Дата окончания',
            'Всего приёмов пищи',
            'Соблюдено',
            'Нарушений',
            '% соблюдения',
        ])

        # Data
        for program in programs:
            total = program._total_checks
            compliant = program._compliant_checks
            violations = total - compliant
            rate = round(compliant / total * 100, 1) if total > 0 else 0

            writer.writerow([
                program.name,
                f'{program.client.first_name} {program.client.last_name}'.strip(),
                program.get_status_display() if hasattr(program, 'get_status_display') else program.status,
                str(program.start_date),
                str(program.end_date),
                total,
                compliant,
                violations,
                f'{rate}%',
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="nutrition_stats.csv"'
        return response

    def _export_violations_csv(self, coach, program_id, client_id):
        """Экспорт списка нарушений."""
        checks = MealComplianceCheck.objects.filter(
            program_day__program__coach=coach,
            is_compliant=False,
        ).select_related(
            'meal',
            'program_day',
            'program_day__program',
            'program_day__program__client',
        ).order_by('-created_at')

        if program_id:
            checks = checks.filter(program_day__program_id=program_id)
        if client_id:
            checks = checks.filter(program_day__program__client_id=client_id)

        output = StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            'Дата',
            'Время',
            'Клиент',
            'Программа',
            'День',
            'Блюдо',
            'Запрещённые ингредиенты',
            'Комментарий AI',
        ])

        # Data
        for check in checks:
            meal = check.meal
            program = check.program_day.program
            client = program.client

            # Форматируем запрещённые ингредиенты
            forbidden = ', '.join(
                ing.get('name', str(ing)) if isinstance(ing, dict) else str(ing)
                for ing in check.found_forbidden
            )

            writer.writerow([
                meal.meal_time.strftime('%Y-%m-%d'),
                meal.meal_time.strftime('%H:%M'),
                f'{client.first_name} {client.last_name}'.strip(),
                program.name,
                check.program_day.day_number,
                meal.dish_name,
                forbidden,
                check.ai_comment or '',
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="nutrition_violations.csv"'
        return response
