import csv
from collections import Counter
from io import StringIO

from core.ai.utils import strip_markdown_codeblock

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

from .models import MealComplianceCheck, MealReport, NutritionProgram, NutritionProgramDay
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

    @action(detail=True, methods=['get'], url_path='detailed-report')
    def detailed_report(self, request, pk=None):
        """Подробный отчёт по программе: план vs факт по дням."""
        from apps.meals.models import Meal
        from datetime import datetime, timedelta

        program = self.get_object()

        # Маппинг типов приёмов пищи (русский → английский и обратно)
        ru_to_en = {
            'завтрак': 'breakfast',
            'перекус': 'snack',
            'обед': 'lunch',
            'ужин': 'dinner',
        }
        en_to_types = {
            'breakfast': ['breakfast', 'завтрак'],
            'snack1': ['snack1', 'snack', 'перекус'],
            'snack2': ['snack2', 'snack', 'перекус'],
            'lunch': ['lunch', 'обед'],
            'dinner': ['dinner', 'ужин'],
        }

        # Получаем все приёмы пищи клиента за период программы
        all_meals = Meal.objects.filter(
            client=program.client,
            meal_time__date__gte=program.start_date,
            meal_time__date__lte=program.end_date,
        ).order_by('meal_time')

        # Группируем приёмы пищи по дате
        meals_by_date = {}
        for meal in all_meals:
            date_key = meal.meal_time.date()
            if date_key not in meals_by_date:
                meals_by_date[date_key] = []
            meals_by_date[date_key].append(meal)

        # Получаем все дни программы
        days_data = []
        for day in program.days.all().order_by('day_number'):
            # Получаем приёмы пищи для этого дня
            day_meals = meals_by_date.get(day.date, [])

            # Группируем по типу приёма пищи
            meals_by_type = {}
            for meal in day_meals:
                dish_type = meal.dish_type.lower() if meal.dish_type else ''
                # Нормализуем тип
                normalized_type = ru_to_en.get(dish_type, dish_type)
                if normalized_type not in meals_by_type:
                    meals_by_type[normalized_type] = []
                meals_by_type[normalized_type].append(meal)

            # Формируем данные по каждому приёму пищи из программы
            meals_list = day.get_meals_list()
            meals_data = []
            for program_meal in meals_list:
                meal_type = program_meal.get('type', '')
                # Ищем соответствующие приёмы пищи
                matching_meals = []
                for type_variant in en_to_types.get(meal_type, [meal_type]):
                    matching_meals.extend(meals_by_type.get(type_variant, []))

                # Формируем данные о фактических приёмах
                actual_meals = []
                for meal in matching_meals:
                    # Формируем URL фото
                    photo_url = ''
                    if meal.image:
                        photo_url = request.build_absolute_uri(meal.image.url) if meal.image else ''
                    elif meal.thumbnail:
                        photo_url = request.build_absolute_uri(meal.thumbnail.url) if meal.thumbnail else ''

                    actual_meals.append({
                        'id': meal.id,
                        'dish_name': meal.dish_name,
                        'photo_url': photo_url,
                        'ingredients': meal.ingredients or [],
                        'calories': meal.calories,
                        'proteins': meal.proteins,
                        'fats': meal.fats,
                        'carbohydrates': meal.carbohydrates,
                        'is_compliant': meal.program_check_status == 'compliant',
                        'program_check_status': meal.program_check_status,
                        'created_at': meal.created_at.isoformat(),
                    })

                meals_data.append({
                    'type': meal_type,
                    'time': program_meal.get('time', ''),
                    'name': program_meal.get('name', ''),
                    'description': program_meal.get('description', ''),
                    'actual_meals': actual_meals,
                    'has_meal': len(actual_meals) > 0,
                })

            days_data.append({
                'day_number': day.day_number,
                'date': day.date.isoformat() if day.date else None,
                'meals': meals_data,
                'notes': day.notes,
            })

        return Response({
            'program_id': program.id,
            'program_name': program.name,
            'client_name': f'{program.client.first_name} {program.client.last_name}'.strip(),
            'start_date': program.start_date.isoformat(),
            'end_date': program.end_date.isoformat(),
            'duration_days': program.duration_days,
            'status': program.status,
            'days': days_data,
        })


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

    @action(detail=True, methods=['post'], url_path='generate-shopping-list')
    def generate_shopping_list(self, request, program_pk=None, pk=None):
        """Сгенерировать список покупок для дня через AI."""
        import json as json_module
        import logging

        from asgiref.sync import async_to_sync

        from apps.persona.models import AIProviderConfig, BotPersona
        from core.ai.factory import get_ai_provider

        logger = logging.getLogger(__name__)
        day = self.get_object()
        coach = self.request.user.coach_profile

        # Собираем описания блюд
        meal_descriptions = []
        for meal in day.meals:
            if isinstance(meal, dict):
                name = meal.get('name', '')
                desc = meal.get('description', '')
                if name or desc:
                    meal_descriptions.append(f"{name}: {desc}" if desc else name)

        if not meal_descriptions:
            return Response({
                'shopping_list': [],
                'message': 'Нет блюд для анализа',
            })

        # Получаем AI провайдер
        config = AIProviderConfig.objects.filter(
            coach=coach, provider='openai', is_active=True
        ).first()
        if not config:
            return Response(
                {'error': 'Не настроен AI провайдер'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        provider = get_ai_provider('openai', config.api_key)

        meals_text = "\n".join(f"- {m}" for m in meal_descriptions)

        # Получаем промпт из персоны коуча
        persona = BotPersona.objects.filter(coach=coach, is_default=True).first()
        custom_prompt = persona.shopping_list_prompt if persona and persona.shopping_list_prompt else None

        if custom_prompt:
            # Используем кастомный промпт с подстановкой переменных
            prompt = custom_prompt.replace('{meals_description}', meals_text)
        else:
            # Дефолтный промпт
            prompt = f"""Проанализируй меню на день и составь список продуктов для покупки.

Меню:
{meals_text}

Выведи список в формате JSON массива:
[
  {{"name": "Куриная грудка", "category": "meat"}},
  {{"name": "Помидоры", "category": "vegetables"}},
  {{"name": "Гречка", "category": "grains"}}
]

Категории: vegetables (овощи/фрукты), meat (мясо/рыба), dairy (молочные), grains (крупы/гарниры), other (прочее).

Правила:
- Объединяй похожие продукты
- Каждый продукт с заглавной буквы
- Не добавляй количество
- Выведи ТОЛЬКО JSON массив, без комментариев"""

        try:
            response = async_to_sync(provider.complete)(
                messages=[{'role': 'user', 'content': prompt}],
                system_prompt='Ты помощник по составлению списка покупок. Отвечай только валидным JSON.',
                max_tokens=500,
                temperature=0.3,
                json_mode=True,
            )
            content = strip_markdown_codeblock(response.content)
            shopping_list = json_module.loads(content)

            # Сохраняем в модель
            day.shopping_list = shopping_list
            day.save(update_fields=['shopping_list'])

            return Response({
                'shopping_list': shopping_list,
                'message': f'Сгенерировано {len(shopping_list)} продуктов',
            })

        except Exception as e:
            logger.exception('Failed to generate shopping list: %s', e)
            return Response(
                {'error': f'Ошибка генерации: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['post'], url_path='analyze-products')
    def analyze_products(self, request, program_pk=None, pk=None):
        """Проанализировать связь между продуктами и текстами блюд с помощью AI."""
        import json as json_module
        import logging

        from asgiref.sync import async_to_sync

        from apps.persona.models import AIProviderConfig
        from core.ai.factory import get_ai_provider

        logger = logging.getLogger(__name__)
        day = self.get_object()
        coach = self.request.user.coach_profile

        # Собираем продукты из списка покупок
        products = []
        if day.shopping_list:
            for item in day.shopping_list:
                if isinstance(item, dict) and item.get('name'):
                    products.append(item['name'])

        if not products:
            return Response({'mapping': {}})

        # Собираем тексты блюд
        meal_texts = []
        for meal in day.meals:
            if isinstance(meal, dict):
                name = meal.get('name', '')
                desc = meal.get('description', '')
                if desc:
                    meal_texts.append(desc)
                if name:
                    meal_texts.append(name)

        if not meal_texts:
            return Response({'mapping': {}})

        all_text = '\n'.join(meal_texts)
        products_list = '\n'.join(f'- {p}' for p in products)

        # Получаем AI провайдер
        config = AIProviderConfig.objects.filter(
            coach=coach, provider='openai', is_active=True
        ).first()
        if not config:
            return Response(
                {'error': 'Не настроен AI провайдер'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        provider = get_ai_provider('openai', config.api_key)

        prompt = f"""Проанализируй связь между списком продуктов и текстом меню.

Список продуктов:
{products_list}

Текст меню:
{all_text}

Для КАЖДОГО продукта найди ВСЕ слова и фразы в тексте, которые к нему относятся.
Выведи JSON объект где ключ - название продукта, значение - массив найденных слов/фраз ТОЧНО как они написаны в тексте:

{{
  "Гречка": ["гречневая каша", "гречневую"],
  "Яйца": ["яйцо", "яичница", "яйца"],
  "Курица": ["куриное филе", "курицу"]
}}

Правила:
- Ищи однокоренные слова (гречка → гречневая, гречку)
- Ищи синонимы и связанные понятия
- Ищи все формы слова
- Слова в массиве - ТОЧНО как в тексте
- Если для продукта ничего не найдено - пустой массив []
- Выведи ТОЛЬКО JSON объект"""

        try:
            response = async_to_sync(provider.complete)(
                messages=[{'role': 'user', 'content': prompt}],
                system_prompt='Ты помощник по анализу продуктов. Отвечай только валидным JSON.',
                max_tokens=1000,
                temperature=0.1,
                json_mode=True,
            )
            content = strip_markdown_codeblock(response.content)
            mapping = json_module.loads(content)
            if not isinstance(mapping, dict):
                mapping = {}

            return Response({'mapping': mapping})

        except Exception as e:
            logger.exception('Failed to analyze products: %s', e)
            return Response(
                {'error': f'Ошибка анализа: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


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
