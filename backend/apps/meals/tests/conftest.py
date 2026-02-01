"""Фикстуры для тестов приложения meals."""

import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Coach
from apps.meals.models import Product, DishTag, Dish

User = get_user_model()


# ============================================================================
# USER & COACH FIXTURES
# ============================================================================

@pytest.fixture
def api_client():
    """Неаутентифицированный API клиент."""
    return APIClient()


@pytest.fixture
def coach_user(db):
    """Пользователь-коуч."""
    user = User.objects.create_user(
        username='testcoach',
        email='coach@test.com',
        password='testpass123',
        role='coach',
    )
    return user


@pytest.fixture
def coach(coach_user):
    """Профиль коуча."""
    return Coach.objects.create(
        user=coach_user,
        telegram_user_id=123456789,
        business_name='Test Coach Business',
    )


@pytest.fixture
def another_coach_user(db):
    """Другой пользователь-коуч."""
    user = User.objects.create_user(
        username='othercoach',
        email='other@test.com',
        password='testpass123',
        role='coach',
    )
    return user


@pytest.fixture
def another_coach(another_coach_user):
    """Профиль другого коуча."""
    return Coach.objects.create(
        user=another_coach_user,
        telegram_user_id=987654321,
        business_name='Other Coach Business',
    )


@pytest.fixture
def authenticated_client(coach_user, coach):
    """Аутентифицированный API клиент (коуч)."""
    client = APIClient()
    refresh = RefreshToken.for_user(coach_user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    client._coach = coach
    client._user = coach_user
    return client


@pytest.fixture
def another_authenticated_client(another_coach_user, another_coach):
    """Аутентифицированный API клиент (другой коуч)."""
    client = APIClient()
    refresh = RefreshToken.for_user(another_coach_user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    client._coach = another_coach
    client._user = another_coach_user
    return client


# ============================================================================
# PRODUCT FIXTURES
# ============================================================================

@pytest.fixture
def product(coach):
    """Продукт для тестов."""
    return Product.objects.create(
        coach=coach,
        name='Куриная грудка',
        calories_per_100g=Decimal('165.00'),
        proteins_per_100g=Decimal('31.00'),
        fats_per_100g=Decimal('3.60'),
        carbs_per_100g=Decimal('0.00'),
        category='meat',
        is_verified=True,
    )


@pytest.fixture
def another_product(coach):
    """Ещё один продукт для тестов."""
    return Product.objects.create(
        coach=coach,
        name='Рис белый',
        calories_per_100g=Decimal('130.00'),
        proteins_per_100g=Decimal('2.70'),
        fats_per_100g=Decimal('0.30'),
        carbs_per_100g=Decimal('28.00'),
        category='grains',
    )


@pytest.fixture
def vegetable_product(coach):
    """Овощной продукт для тестов."""
    return Product.objects.create(
        coach=coach,
        name='Брокколи',
        calories_per_100g=Decimal('34.00'),
        proteins_per_100g=Decimal('2.80'),
        fats_per_100g=Decimal('0.40'),
        carbs_per_100g=Decimal('7.00'),
        category='vegetables',
    )


# ============================================================================
# DISH TAG FIXTURES
# ============================================================================

@pytest.fixture
def dish_tag(coach):
    """Тег блюда для тестов."""
    return DishTag.objects.create(
        coach=coach,
        name='Низкоуглеводные',
        color='#22C55E',
    )


@pytest.fixture
def another_dish_tag(coach):
    """Ещё один тег блюда."""
    return DishTag.objects.create(
        coach=coach,
        name='Быстрые рецепты',
        color='#3B82F6',
    )


# ============================================================================
# DISH FIXTURES
# ============================================================================

@pytest.fixture
def dish(coach):
    """Блюдо для тестов."""
    return Dish.objects.create(
        coach=coach,
        name='Куриная грудка с рисом',
        description='Простое и питательное блюдо',
        recipe='1. Отварить рис\n2. Обжарить курицу\n3. Подать вместе',
        portion_weight=350,
        calories=Decimal('450.00'),
        proteins=Decimal('45.00'),
        fats=Decimal('8.00'),
        carbohydrates=Decimal('42.00'),
        cooking_time=30,
        meal_types=['lunch', 'dinner'],
        ingredients=[
            {
                'name': 'Куриная грудка',
                'weight': 200,
                'calories': 330,
                'proteins': 62,
                'fats': 7.2,
                'carbohydrates': 0,
            },
            {
                'name': 'Рис белый',
                'weight': 150,
                'calories': 195,
                'proteins': 4.05,
                'fats': 0.45,
                'carbohydrates': 42,
            },
        ],
    )


@pytest.fixture
def dish_with_tags(dish, dish_tag, another_dish_tag):
    """Блюдо с тегами."""
    dish.tags.add(dish_tag, another_dish_tag)
    return dish


@pytest.fixture
def archived_dish(coach):
    """Архивированное блюдо."""
    return Dish.objects.create(
        coach=coach,
        name='Старый рецепт',
        portion_weight=200,
        calories=Decimal('300.00'),
        proteins=Decimal('20.00'),
        fats=Decimal('10.00'),
        carbohydrates=Decimal('30.00'),
        is_active=False,
    )
