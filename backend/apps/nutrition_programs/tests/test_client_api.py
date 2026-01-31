"""
Тесты miniapp API для программ питания (client_views).
"""
import pytest
from datetime import date, timedelta
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Coach, Client
from apps.nutrition_programs.models import (
    MealComplianceCheck,
    NutritionProgram,
    NutritionProgramDay,
)
from apps.meals.models import Meal


@pytest.fixture
def client_token(client_obj, coach_user):
    """JWT токен для клиента miniapp с client_id в payload."""
    refresh = RefreshToken.for_user(coach_user)
    refresh['client_id'] = client_obj.id
    return str(refresh.access_token)


@pytest.fixture
def miniapp_client(client_token):
    """Аутентифицированный API клиент (miniapp)."""
    api_client = APIClient()
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {client_token}')
    return api_client


@pytest.fixture
def active_program_today(client_obj, coach):
    """Активная программа питания с началом сегодня."""
    program = NutritionProgram.objects.create(
        client=client_obj,
        coach=coach,
        name='Активная программа',
        description='Для тестов',
        start_date=date.today(),
        duration_days=7,
        status='active',
    )
    for i in range(7):
        NutritionProgramDay.objects.create(
            program=program,
            day_number=i + 1,
            date=program.start_date + timedelta(days=i),
            allowed_ingredients=[{'name': 'курица'}, {'name': 'рис'}],
            forbidden_ingredients=[{'name': 'сахар'}],
        )
    return program


@pytest.fixture
def meal_with_violation(client_obj, active_program_today):
    """Приём пищи с нарушением программы."""
    meal = Meal.objects.create(
        client=client_obj,
        dish_name='Торт с сахаром',
        dish_type='snack',
        calories=500,
        ingredients=['сахар', 'мука', 'масло'],
        meal_time=date.today(),
        image_type='food',
        program_check_status='violation',
    )
    program_day = active_program_today.days.first()
    MealComplianceCheck.objects.create(
        meal=meal,
        program_day=program_day,
        is_compliant=False,
        found_forbidden=['сахар'],
        found_allowed=[],
        ai_comment='Сахар запрещён в вашей программе.',
    )
    return meal


@pytest.fixture
def compliant_meal(client_obj, active_program_today):
    """Приём пищи соответствующий программе."""
    meal = Meal.objects.create(
        client=client_obj,
        dish_name='Курица с рисом',
        dish_type='lunch',
        calories=400,
        ingredients=['курица', 'рис'],
        meal_time=date.today(),
        image_type='food',
        program_check_status='compliant',
    )
    program_day = active_program_today.days.first()
    MealComplianceCheck.objects.create(
        meal=meal,
        program_day=program_day,
        is_compliant=True,
        found_forbidden=[],
        found_allowed=['курица', 'рис'],
        ai_comment='',
    )
    return meal


@pytest.mark.django_db
class TestNutritionProgramTodayView:
    """Тесты GET /api/miniapp/nutrition-program/today/."""

    def test_no_active_program(self, miniapp_client):
        """Возвращает has_program=False если нет активной программы."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/today/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is False

    def test_with_active_program(self, miniapp_client, active_program_today):
        """Возвращает данные программы если есть активная."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/today/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is True
        assert response.data['program_name'] == 'Активная программа'
        assert response.data['day_number'] == 1
        assert 'allowed_ingredients' in response.data
        assert 'forbidden_ingredients' in response.data

    def test_with_meals_stats(self, miniapp_client, active_program_today, compliant_meal, meal_with_violation):
        """Возвращает статистику по приёмам пищи за сегодня."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/today/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['today_stats']['meals_count'] == 2
        assert response.data['today_stats']['compliant_meals'] == 1
        assert response.data['today_stats']['violations_count'] == 1

    def test_unauthorized(self, api_client):
        """Без авторизации возвращает 401."""
        response = api_client.get('/api/miniapp/nutrition-program/today/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestNutritionProgramHistoryView:
    """Тесты GET /api/miniapp/nutrition-program/history/."""

    def test_no_program(self, miniapp_client):
        """Возвращает has_program=False если нет программ."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/history/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is False

    def test_with_program(self, miniapp_client, active_program_today):
        """Возвращает историю программы с днями."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/history/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is True
        assert response.data['program_name'] == 'Активная программа'
        assert len(response.data['days']) == 7

    def test_with_violations(self, miniapp_client, active_program_today, meal_with_violation):
        """Возвращает историю с нарушениями."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/history/')

        assert response.status_code == status.HTTP_200_OK
        day1 = response.data['days'][0]
        assert day1['meals_count'] == 1
        assert day1['compliant_meals'] == 0
        assert len(day1['violations']) == 1
        assert day1['violations'][0]['meal_name'] == 'Торт с сахаром'

    def test_compliance_rate(self, miniapp_client, active_program_today, compliant_meal, meal_with_violation):
        """Рассчитывает правильный compliance_rate."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/history/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['compliance_rate'] == 50  # 1 из 2


@pytest.mark.django_db
class TestNutritionProgramViolationsView:
    """Тесты GET /api/miniapp/nutrition-program/violations/."""

    def test_no_violations(self, miniapp_client, active_program_today, compliant_meal):
        """Возвращает пустой список если нет нарушений."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/violations/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['violations'] == []

    def test_with_violations(self, miniapp_client, active_program_today, meal_with_violation):
        """Возвращает список нарушений."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/violations/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['violations']) == 1
        violation = response.data['violations'][0]
        assert violation['meal_name'] == 'Торт с сахаром'
        assert 'сахар' in violation['found_forbidden']
        assert violation['ai_comment'] == 'Сахар запрещён в вашей программе.'

    def test_limit_parameter(self, miniapp_client, active_program_today, meal_with_violation):
        """Параметр limit ограничивает количество результатов."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/violations/', {'limit': 5})

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestNutritionProgramSummaryView:
    """Тесты GET /api/miniapp/nutrition-program/summary/."""

    def test_no_active_program(self, miniapp_client):
        """Возвращает has_program=False если нет активной программы."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/summary/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is False

    def test_with_active_program(self, miniapp_client, active_program_today):
        """Возвращает сводку по программе."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/summary/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is True
        assert response.data['name'] == 'Активная программа'
        assert response.data['current_day'] == 1
        assert response.data['total_days'] == 7

    def test_compliance_rate(self, miniapp_client, active_program_today, compliant_meal, meal_with_violation):
        """Рассчитывает правильный compliance_rate."""
        response = miniapp_client.get('/api/miniapp/nutrition-program/summary/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['compliance_rate'] == 50
