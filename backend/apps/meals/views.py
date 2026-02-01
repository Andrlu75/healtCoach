from datetime import date
import zoneinfo

from asgiref.sync import async_to_sync
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Dish, DishTag, Meal, MealDraft, Product
from .serializers import (
    DishDetailSerializer,
    DishListSerializer,
    DishTagSerializer,
    MealDraftSerializer,
    MealSerializer,
    ProductSerializer,
)
from apps.accounts.models import Client


def get_client_timezone(client):
    """Get timezone object for client."""
    try:
        return zoneinfo.ZoneInfo(client.timezone or 'Europe/Moscow')
    except Exception:
        return zoneinfo.ZoneInfo('Europe/Moscow')


class MealListView(APIView):
    """List meals for a coach's clients."""

    def get(self, request):
        coach = request.user.coach_profile
        client_id = request.query_params.get('client_id')
        date_str = request.query_params.get('date')

        queryset = Meal.objects.filter(client__coach=coach)

        if client_id:
            queryset = queryset.filter(client_id=client_id)

        if date_str:
            try:
                target_date = date.fromisoformat(date_str)
            except ValueError:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = queryset.filter(meal_time__date=target_date)

        meals = queryset[:50]
        serializer = MealSerializer(meals, many=True)
        return Response(serializer.data)


class DailySummaryView(APIView):
    """Get daily nutrition summary for a client."""

    def get(self, request):
        coach = request.user.coach_profile
        client_id = request.query_params.get('client_id')

        if not client_id:
            return Response(
                {'error': 'client_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify client belongs to this coach
        from apps.accounts.models import Client
        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response(
                {'error': 'Client not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = date.fromisoformat(date_str)
            except ValueError:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            target_date = timezone.localdate()

        # Calculate summary using aggregate (один запрос к БД вместо итерации)
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
            carbohydrates=Coalesce(Sum('carbohydrates'), 0.0),
            meals_count=Count('id'),
        )

        consumed = {
            'calories': aggregated['calories'],
            'proteins': aggregated['proteins'],
            'fats': aggregated['fats'],
            'carbohydrates': aggregated['carbohydrates'],
            'meals_count': aggregated['meals_count'],
        }

        norms = {
            'calories': client.daily_calories or 2000,
            'proteins': client.daily_proteins or 80,
            'fats': client.daily_fats or 70,
            'carbohydrates': client.daily_carbs or 250,
        }

        remaining = {
            'calories': round(norms['calories'] - consumed['calories'], 1),
            'proteins': round(norms['proteins'] - consumed['proteins'], 1),
            'fats': round(norms['fats'] - consumed['fats'], 1),
            'carbohydrates': round(norms['carbohydrates'] - consumed['carbohydrates'], 1),
        }

        return Response({
            'date': target_date.isoformat(),
            'consumed': consumed,
            'norms': norms,
            'remaining': remaining,
        })


class TodayMealsDashboardView(APIView):
    """Get today's meals for all clients - for dashboard display."""

    def get(self, request):
        from datetime import datetime

        coach = request.user.coach_profile

        # Get all active clients first
        clients = Client.objects.filter(
            coach=coach, status='active'
        ).order_by('first_name')

        result = []
        for client in clients:
            # Get today's date in client's timezone
            client_tz = get_client_timezone(client)
            client_now = timezone.now().astimezone(client_tz)
            client_today = client_now.date()

            # Filter meals for client's today
            meals = Meal.objects.filter(
                client=client,
                image_type='food',
                meal_time__date=client_today
            ).order_by('-meal_time')

            meals_data = []
            for meal in meals:
                # Convert meal_time to client's timezone
                meal_time_local = meal.meal_time.astimezone(client_tz) if meal.meal_time else None
                meals_data.append({
                    'id': meal.id,
                    'dish_name': meal.dish_name or 'Без названия',
                    'dish_type': meal.dish_type or '',
                    'calories': meal.calories or 0,
                    'proteins': meal.proteins or 0,
                    'fats': meal.fats or 0,
                    'carbs': meal.carbohydrates or 0,
                    'meal_time': meal_time_local.strftime('%H:%M') if meal_time_local else '',
                    'thumbnail': meal.thumbnail.url if meal.thumbnail else (meal.image.url if meal.image else None),
                    'image': meal.image.url if meal.image else None,
                    'ai_comment': meal.ai_comment or '',
                    'ingredients': meal.ingredients or [],
                })

            # Calculate totals
            totals = {
                'calories': sum(m.calories or 0 for m in meals),
                'proteins': sum(m.proteins or 0 for m in meals),
                'fats': sum(m.fats or 0 for m in meals),
                'carbs': sum(m.carbohydrates or 0 for m in meals),
            }

            # Get norms
            norms = {
                'calories': client.daily_calories or 2000,
                'proteins': client.daily_proteins or 80,
                'fats': client.daily_fats or 70,
                'carbs': client.daily_carbs or 250,
            }

            result.append({
                'client_id': client.id,
                'client_name': f"{client.first_name or ''} {client.last_name or ''}".strip() or f"Клиент #{client.id}",
                'meals': meals_data,
                'totals': totals,
                'norms': norms,
            })

        return Response({
            'date': timezone.localdate().isoformat(),
            'clients': result,
        })


# ========== УМНЫЙ РЕЖИМ API ==========

class MealDraftDetailView(APIView):
    """Получить/обновить/удалить черновик."""

    def get(self, request, draft_id):
        """Получить черновик по ID."""
        coach = request.user.coach_profile
        try:
            # Проверяем что черновик принадлежит клиенту этого коуча
            draft = MealDraft.objects.get(pk=draft_id, client__coach=coach)
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден'}, status=status.HTTP_404_NOT_FOUND)

        serializer = MealDraftSerializer(draft)
        return Response(serializer.data)

    def patch(self, request, draft_id):
        """Обновить черновик (название, тип, вес)."""
        coach = request.user.coach_profile
        try:
            # Проверяем что черновик принадлежит клиенту этого коуча
            draft = MealDraft.objects.get(pk=draft_id, status='pending', client__coach=coach)
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден или уже подтверждён'}, status=status.HTTP_404_NOT_FOUND)

        if 'dish_name' in request.data:
            draft.dish_name = request.data['dish_name']
        if 'dish_type' in request.data:
            draft.dish_type = request.data['dish_type']
        if 'estimated_weight' in request.data:
            draft.estimated_weight = request.data['estimated_weight']

        draft.save()
        serializer = MealDraftSerializer(draft)
        return Response(serializer.data)

    def delete(self, request, draft_id):
        """Отменить черновик."""
        coach = request.user.coach_profile
        try:
            # Проверяем что черновик принадлежит клиенту этого коуча
            draft = MealDraft.objects.get(pk=draft_id, status='pending', client__coach=coach)
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден или уже подтверждён'}, status=status.HTTP_404_NOT_FOUND)

        from .services import cancel_draft
        async_to_sync(cancel_draft)(draft)
        return Response({'status': 'cancelled'})


class MealDraftConfirmView(APIView):
    """Подтвердить черновик и создать Meal."""

    def post(self, request, draft_id):
        coach = request.user.coach_profile
        try:
            # Проверяем что черновик принадлежит клиенту этого коуча
            draft = MealDraft.objects.get(pk=draft_id, status='pending', client__coach=coach)
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден или уже подтверждён'}, status=status.HTTP_404_NOT_FOUND)

        from .services import confirm_draft
        meal = async_to_sync(confirm_draft)(draft)

        return Response({
            'status': 'confirmed',
            'meal_id': meal.id,
            'meal': MealSerializer(meal).data,
            'ai_response': meal.ai_comment or '',
        })


class MealDraftAddIngredientView(APIView):
    """Добавить ингредиент в черновик."""

    def post(self, request, draft_id):
        coach = request.user.coach_profile
        try:
            # Проверяем что черновик принадлежит клиенту этого коуча
            draft = MealDraft.objects.get(pk=draft_id, status='pending', client__coach=coach)
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден или уже подтверждён'}, status=status.HTTP_404_NOT_FOUND)

        ingredient_name = request.data.get('name')
        if not ingredient_name:
            return Response({'error': 'Укажите название ингредиента'}, status=status.HTTP_400_BAD_REQUEST)

        from .services import add_ingredient_to_draft
        try:
            new_ingredient = async_to_sync(add_ingredient_to_draft)(draft, ingredient_name)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Обновляем draft из БД
        draft.refresh_from_db()

        return Response({
            'ingredient': new_ingredient,
            'draft': MealDraftSerializer(draft).data,
        })


class MealDraftRemoveIngredientView(APIView):
    """Удалить ингредиент из черновика."""

    def delete(self, request, draft_id, index):
        coach = request.user.coach_profile
        try:
            # Проверяем что черновик принадлежит клиенту этого коуча
            draft = MealDraft.objects.get(pk=draft_id, status='pending', client__coach=coach)
        except MealDraft.DoesNotExist:
            return Response({'error': 'Черновик не найден или уже подтверждён'}, status=status.HTTP_404_NOT_FOUND)

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


# ============================================================================
# PAGINATION CLASSES
# ============================================================================

class ProductPagination(PageNumberPagination):
    """Пагинация для списка продуктов."""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class DishPagination(PageNumberPagination):
    """Пагинация для списка блюд."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ============================================================================
# PRODUCT VIEWSET
# ============================================================================

class ProductViewSet(viewsets.ModelViewSet):
    """ViewSet для CRUD операций с продуктами коуча.

    Endpoints:
    - GET /api/products/ — список продуктов
    - POST /api/products/ — создать продукт
    - GET /api/products/{id}/ — получить продукт
    - PUT/PATCH /api/products/{id}/ — обновить продукт
    - DELETE /api/products/{id}/ — удалить продукт
    - GET /api/products/search/?q=... — поиск для автокомплита
    """

    serializer_class = ProductSerializer
    pagination_class = ProductPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'category', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        """Возвращает продукты текущего коуча."""
        coach = self.request.user.coach_profile
        queryset = Product.objects.filter(coach=coach)

        # Фильтрация по категории
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        # Фильтрация по is_verified
        is_verified = self.request.query_params.get('is_verified')
        if is_verified is not None:
            queryset = queryset.filter(is_verified=is_verified.lower() == 'true')

        return queryset

    def perform_create(self, serializer):
        """Устанавливает coach при создании продукта."""
        serializer.save(coach=self.request.user.coach_profile)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Поиск продуктов для автокомплита.

        GET /api/products/search/?q=молоко
        Возвращает до 10 продуктов, подходящих под запрос.
        """
        query = request.query_params.get('q', '').strip()
        if len(query) < 2:
            return Response([])

        coach = request.user.coach_profile
        products = Product.objects.filter(
            coach=coach,
            name__icontains=query,
        )[:10]

        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)


# ============================================================================
# DISH TAG VIEWSET
# ============================================================================

class DishTagViewSet(viewsets.ModelViewSet):
    """ViewSet для CRUD операций с тегами блюд.

    Endpoints:
    - GET /api/dish-tags/ — список тегов
    - POST /api/dish-tags/ — создать тег
    - GET /api/dish-tags/{id}/ — получить тег
    - PUT/PATCH /api/dish-tags/{id}/ — обновить тег
    - DELETE /api/dish-tags/{id}/ — удалить тег
    """

    serializer_class = DishTagSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ['name']

    def get_queryset(self):
        """Возвращает теги текущего коуча."""
        coach = self.request.user.coach_profile
        return DishTag.objects.filter(coach=coach)

    def perform_create(self, serializer):
        """Устанавливает coach при создании тега."""
        serializer.save(coach=self.request.user.coach_profile)


# ============================================================================
# DISH VIEWSET
# ============================================================================

class DishViewSet(viewsets.ModelViewSet):
    """ViewSet для CRUD операций с блюдами.

    Endpoints:
    - GET /api/dishes/ — список блюд
    - POST /api/dishes/ — создать блюдо
    - GET /api/dishes/{id}/ — получить блюдо
    - PUT/PATCH /api/dishes/{id}/ — обновить блюдо
    - DELETE /api/dishes/{id}/ — удалить блюдо
    - POST /api/dishes/{id}/duplicate/ — дублировать блюдо
    - POST /api/dishes/{id}/archive/ — архивировать блюдо
    """

    pagination_class = DishPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['updated_at', 'name', 'calories', 'created_at']
    ordering = ['-updated_at']

    def get_queryset(self):
        """Возвращает блюда текущего коуча с фильтрацией."""
        coach = self.request.user.coach_profile
        queryset = Dish.objects.filter(coach=coach)

        # По умолчанию показываем только активные блюда в списке
        if self.action == 'list':
            show_archived = self.request.query_params.get('show_archived', 'false')
            if show_archived.lower() != 'true':
                queryset = queryset.filter(is_active=True)

        # Фильтрация по типу приёма пищи
        meal_type = self.request.query_params.get('meal_type')
        if meal_type:
            queryset = queryset.filter(meal_types__contains=[meal_type])

        # Фильтрация по тегам
        tag_ids = self.request.query_params.get('tags')
        if tag_ids:
            tag_id_list = [int(t) for t in tag_ids.split(',') if t.isdigit()]
            if tag_id_list:
                queryset = queryset.filter(tags__id__in=tag_id_list).distinct()

        # Фильтрация по is_active
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset.prefetch_related('tags')

    def get_serializer_class(self):
        """Возвращает соответствующий сериализатор."""
        if self.action == 'list':
            return DishListSerializer
        return DishDetailSerializer

    def perform_create(self, serializer):
        """Устанавливает coach при создании блюда."""
        serializer.save(coach=self.request.user.coach_profile)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Дублировать блюдо.

        POST /api/dishes/{id}/duplicate/
        Создаёт копию блюда с суффиксом " (копия)".
        """
        dish = self.get_object()

        # Создаём копию
        new_dish = Dish.objects.create(
            coach=dish.coach,
            name=f'{dish.name} (копия)',
            description=dish.description,
            recipe=dish.recipe,
            portion_weight=dish.portion_weight,
            calories=dish.calories,
            proteins=dish.proteins,
            fats=dish.fats,
            carbohydrates=dish.carbohydrates,
            cooking_time=dish.cooking_time,
            video_url=dish.video_url,
            ingredients=dish.ingredients.copy() if dish.ingredients else [],
            shopping_links=dish.shopping_links.copy() if dish.shopping_links else [],
            meal_types=dish.meal_types.copy() if dish.meal_types else [],
            is_active=True,
        )

        # Копируем теги
        new_dish.tags.set(dish.tags.all())

        serializer = DishDetailSerializer(new_dish, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Архивировать блюдо.

        POST /api/dishes/{id}/archive/
        Устанавливает is_active=False.
        """
        dish = self.get_object()
        dish.is_active = False
        dish.save(update_fields=['is_active', 'updated_at'])

        return Response({'status': 'archived', 'id': dish.id})
