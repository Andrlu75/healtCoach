import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Coach, Client
from apps.nutrition_programs.models import NutritionProgram, NutritionProgramDay

User = get_user_model()


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
def client_obj(coach):
    """Клиент коуча."""
    return Client.objects.create(
        coach=coach,
        telegram_user_id=111222333,
        telegram_username='testclient',
        first_name='Тест',
        last_name='Клиент',
        status='active',
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


@pytest.fixture
def nutrition_program(client_obj, coach):
    """Программа питания."""
    from datetime import date, timedelta

    program = NutritionProgram.objects.create(
        client=client_obj,
        coach=coach,
        name='Тестовая программа',
        description='Описание программы',
        start_date=date.today(),
        duration_days=7,
        status='draft',
    )
    # Создаём дни программы
    for i in range(7):
        NutritionProgramDay.objects.create(
            program=program,
            day_number=i + 1,
            date=program.start_date + timedelta(days=i),
            allowed_ingredients=[{'name': 'курица'}, {'name': 'рис'}],
            forbidden_ingredients=[{'name': 'сахар'}, {'name': 'шоколад'}],
        )
    return program


@pytest.fixture
def active_program(nutrition_program):
    """Активная программа питания."""
    nutrition_program.status = 'active'
    nutrition_program.save()
    return nutrition_program
