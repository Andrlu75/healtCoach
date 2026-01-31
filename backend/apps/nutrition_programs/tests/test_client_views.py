"""
Тесты miniapp API для программ питания (client_views).
"""
import pytest
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Coach, Client
from apps.meals.models import Meal
from apps.nutrition_programs.models import (
    MealComplianceCheck,
    NutritionProgram,
    NutritionProgramDay,
)
from apps.nutrition_programs.services import process_meal_compliance

User = get_user_model()


@pytest.fixture
def client_user(db):
    """Пользователь-клиент для JWT авторизации."""
    user = User.objects.create_user(
        username='tg_111222333',
        email='client@test.com',
        password='testpass123',
        role='client',
    )
    return user


@pytest.fixture
def client_api(client_user, client_obj):
    """Аутентифицированный API клиент для miniapp."""
    api = APIClient()
    refresh = RefreshToken.for_user(client_user)
    # Добавляем client_id в claims токена
    refresh['client_id'] = client_obj.pk
    refresh['coach_id'] = client_obj.coach_id
    api.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return api


@pytest.fixture
def another_client_obj(coach):
    """Другой клиент того же коуча."""
    return Client.objects.create(
        coach=coach,
        telegram_user_id=444555666,
        telegram_username='anotherclient',
        first_name='Другой',
        last_name='Клиент',
        status='active',
    )


@pytest.fixture
def another_client_user(db):
    """Пользователь для другого клиента."""
    user = User.objects.create_user(
        username='tg_444555666',
        email='another@test.com',
        password='testpass123',
        role='client',
    )
    return user


@pytest.fixture
def another_client_api(another_client_user, another_client_obj):
    """API клиент для другого клиента."""
    api = APIClient()
    refresh = RefreshToken.for_user(another_client_user)
    refresh['client_id'] = another_client_obj.pk
    refresh['coach_id'] = another_client_obj.coach_id
    api.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return api


@pytest.mark.django_db
class TestNutritionProgramTodayView:
    """Тесты /api/miniapp/nutrition-program/today/."""

    def test_no_program(self, client_api):
        """Возвращает has_program=false если нет программы."""
        url = '/api/miniapp/nutrition-program/today/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is False

    def test_draft_program_not_shown(self, client_api, nutrition_program):
        """Draft программа не показывается как активная."""
        url = '/api/miniapp/nutrition-program/today/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is False

    def test_active_program(self, client_api, active_program):
        """Возвращает данные активной программы."""
        url = '/api/miniapp/nutrition-program/today/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is True
        assert response.data['program_id'] == active_program.id
        assert response.data['program_name'] == 'Тестовая программа'
        assert response.data['day_number'] == 1
        assert response.data['total_days'] == 7
        assert 'allowed_ingredients' in response.data
        assert 'forbidden_ingredients' in response.data
        assert 'today_stats' in response.data

    def test_today_stats(self, client_api, active_program, client_obj):
        """Возвращает статистику за сегодня."""
        # Создаём meals и compliance checks
        meal1 = Meal.objects.create(
            client=client_obj,
            dish_name='Курица',
            ingredients=[{'name': 'курица'}],
            meal_time=timezone.now(),
        )
        meal2 = Meal.objects.create(
            client=client_obj,
            dish_name='Шоколад',
            ingredients=[{'name': 'шоколад'}],
            meal_time=timezone.now(),
        )
        process_meal_compliance(meal1)
        process_meal_compliance(meal2)

        url = '/api/miniapp/nutrition-program/today/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        stats = response.data['today_stats']
        assert stats['meals_count'] == 2
        assert stats['compliant_meals'] == 1
        assert stats['violations_count'] == 1

    def test_unauthorized(self, api_client):
        """Неавторизованный запрос возвращает 401."""
        url = '/api/miniapp/nutrition-program/today/'
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestNutritionProgramHistoryView:
    """Тесты /api/miniapp/nutrition-program/history/."""

    def test_no_program(self, client_api):
        """Возвращает has_program=false если нет программы."""
        url = '/api/miniapp/nutrition-program/history/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is False

    def test_program_history(self, client_api, active_program, client_obj):
        """Возвращает историю программы с днями."""
        # Создаём meal и violation
        meal = Meal.objects.create(
            client=client_obj,
            dish_name='Шоколад',
            ingredients=[{'name': 'шоколад'}],
            meal_time=timezone.now(),
        )
        process_meal_compliance(meal)

        url = '/api/miniapp/nutrition-program/history/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is True
        assert response.data['program_id'] == active_program.id
        assert response.data['status'] == 'active'
        assert len(response.data['days']) == 7

        # Проверяем первый день
        day1 = response.data['days'][0]
        assert day1['day_number'] == 1
        assert day1['meals_count'] == 1
        assert day1['compliant_meals'] == 0
        assert len(day1['violations']) == 1
        assert day1['violations'][0]['meal_name'] == 'Шоколад'

    def test_compliance_rate(self, client_api, active_program, client_obj):
        """Возвращает процент соблюдения."""
        # Создаём 2 compliant и 2 violation meals
        for name in ['курица', 'рис']:
            meal = Meal.objects.create(
                client=client_obj,
                dish_name=name.capitalize(),
                ingredients=[{'name': name}],
                meal_time=timezone.now(),
            )
            process_meal_compliance(meal)

        for name in ['шоколад', 'сахар']:
            meal = Meal.objects.create(
                client=client_obj,
                dish_name=name.capitalize(),
                ingredients=[{'name': name}],
                meal_time=timezone.now(),
            )
            process_meal_compliance(meal)

        url = '/api/miniapp/nutrition-program/history/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['compliance_rate'] == 50  # 2 из 4

    def test_unauthorized(self, api_client):
        """Неавторизованный запрос возвращает 401."""
        url = '/api/miniapp/nutrition-program/history/'
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestNutritionProgramViolationsView:
    """Тесты /api/miniapp/nutrition-program/violations/."""

    def test_empty_violations(self, client_api, active_program):
        """Возвращает пустой список если нет нарушений."""
        url = '/api/miniapp/nutrition-program/violations/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['violations'] == []

    def test_list_violations(self, client_api, active_program, client_obj):
        """Возвращает список нарушений."""
        # Создаём meals с нарушениями
        for name in ['шоколад', 'сахар']:
            meal = Meal.objects.create(
                client=client_obj,
                dish_name=name.capitalize(),
                ingredients=[{'name': name}],
                meal_time=timezone.now(),
            )
            process_meal_compliance(meal)

        url = '/api/miniapp/nutrition-program/violations/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['violations']) == 2

        # Проверяем структуру violation
        violation = response.data['violations'][0]
        assert 'id' in violation
        assert 'meal_id' in violation
        assert 'meal_name' in violation
        assert 'meal_time' in violation
        assert 'program_name' in violation
        assert 'day_number' in violation
        assert 'found_forbidden' in violation

    def test_violations_limit(self, client_api, active_program, client_obj):
        """Ограничение количества результатов."""
        # Создаём 5 нарушений
        for i in range(5):
            meal = Meal.objects.create(
                client=client_obj,
                dish_name=f'Шоколад {i}',
                ingredients=[{'name': 'шоколад'}],
                meal_time=timezone.now(),
            )
            process_meal_compliance(meal)

        url = '/api/miniapp/nutrition-program/violations/?limit=3'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['violations']) == 3

    def test_unauthorized(self, api_client):
        """Неавторизованный запрос возвращает 401."""
        url = '/api/miniapp/nutrition-program/violations/'
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestNutritionProgramSummaryView:
    """Тесты /api/miniapp/nutrition-program/summary/."""

    def test_no_program(self, client_api):
        """Возвращает has_program=false если нет программы."""
        url = '/api/miniapp/nutrition-program/summary/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is False

    def test_summary_data(self, client_api, active_program, client_obj):
        """Возвращает краткую сводку для dashboard."""
        # Создаём meals
        meal1 = Meal.objects.create(
            client=client_obj,
            dish_name='Курица',
            ingredients=[{'name': 'курица'}],
            meal_time=timezone.now(),
        )
        meal2 = Meal.objects.create(
            client=client_obj,
            dish_name='Шоколад',
            ingredients=[{'name': 'шоколад'}],
            meal_time=timezone.now(),
        )
        process_meal_compliance(meal1)
        process_meal_compliance(meal2)

        url = '/api/miniapp/nutrition-program/summary/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['has_program'] is True
        assert response.data['id'] == active_program.id
        assert response.data['name'] == 'Тестовая программа'
        assert response.data['status'] == 'active'
        assert response.data['current_day'] == 1
        assert response.data['total_days'] == 7
        assert response.data['compliance_rate'] == 50

    def test_unauthorized(self, api_client):
        """Неавторизованный запрос возвращает 401."""
        url = '/api/miniapp/nutrition-program/summary/'
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestClientIsolation:
    """Тесты изоляции данных между клиентами."""

    def test_client_sees_only_own_program(
        self,
        client_api,
        another_client_api,
        active_program,
    ):
        """Клиент видит только свою программу."""
        # Первый клиент видит программу
        url = '/api/miniapp/nutrition-program/today/'
        response1 = client_api.get(url)
        assert response1.data['has_program'] is True

        # Другой клиент не видит программу первого
        response2 = another_client_api.get(url)
        assert response2.data['has_program'] is False

    def test_client_sees_only_own_violations(
        self,
        client_api,
        another_client_api,
        active_program,
        client_obj,
    ):
        """Клиент видит только свои нарушения."""
        # Создаём нарушение для первого клиента
        meal = Meal.objects.create(
            client=client_obj,
            dish_name='Шоколад',
            ingredients=[{'name': 'шоколад'}],
            meal_time=timezone.now(),
        )
        process_meal_compliance(meal)

        # Первый клиент видит нарушение
        url = '/api/miniapp/nutrition-program/violations/'
        response1 = client_api.get(url)
        assert len(response1.data['violations']) == 1

        # Другой клиент не видит нарушение
        response2 = another_client_api.get(url)
        assert len(response2.data['violations']) == 0


@pytest.mark.django_db
class TestMealReportCreateView:
    """Тесты POST /api/miniapp/nutrition-program/meal-report/."""

    def test_create_report_with_base64(self, client_api, active_program):
        """Успешная загрузка фото отчёта с base64."""
        import base64

        # Минимальное валидное PNG изображение
        png_data = base64.b64encode(
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
            b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00'
            b'\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        ).decode()

        url = '/api/miniapp/nutrition-program/meal-report/'
        response = client_api.post(url, {
            'meal_type': 'breakfast',
            'photo_base64': png_data,
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['meal_type'] == 'breakfast'
        assert response.data['program_day'] is not None

    def test_create_report_with_file_id(self, client_api, active_program):
        """Создание отчёта с Telegram file_id."""
        url = '/api/miniapp/nutrition-program/meal-report/'
        response = client_api.post(url, {
            'meal_type': 'lunch',
            'photo_file_id': 'AgACAgIAAxkBAAI...',
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['meal_type'] == 'lunch'
        assert response.data['photo_file_id'] == 'AgACAgIAAxkBAAI...'

    def test_create_report_with_url(self, client_api, active_program):
        """Создание отчёта с URL фото."""
        url = '/api/miniapp/nutrition-program/meal-report/'
        response = client_api.post(url, {
            'meal_type': 'dinner',
            'photo_url': 'https://example.com/photo.jpg',
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['meal_type'] == 'dinner'
        assert response.data['photo_url'] == 'https://example.com/photo.jpg'

    def test_update_existing_report(self, client_api, active_program):
        """Обновление существующего отчёта."""
        url = '/api/miniapp/nutrition-program/meal-report/'

        # Первый отчёт
        response1 = client_api.post(url, {
            'meal_type': 'breakfast',
            'photo_file_id': 'old_file_id',
        })
        assert response1.status_code == status.HTTP_201_CREATED
        report_id = response1.data['id']

        # Обновляем отчёт
        response2 = client_api.post(url, {
            'meal_type': 'breakfast',
            'photo_file_id': 'new_file_id',
        })
        assert response2.status_code == status.HTTP_201_CREATED
        assert response2.data['id'] == report_id  # Тот же ID
        assert response2.data['photo_file_id'] == 'new_file_id'

    def test_no_active_program(self, client_api):
        """Ошибка если нет активной программы."""
        url = '/api/miniapp/nutrition-program/meal-report/'
        response = client_api.post(url, {
            'meal_type': 'breakfast',
            'photo_file_id': 'some_id',
        })

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'error' in response.data

    def test_invalid_meal_type(self, client_api, active_program):
        """Ошибка при некорректном meal_type."""
        url = '/api/miniapp/nutrition-program/meal-report/'
        response = client_api.post(url, {
            'meal_type': 'invalid_type',
            'photo_file_id': 'some_id',
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_no_photo_provided(self, client_api, active_program):
        """Ошибка если не передано фото."""
        url = '/api/miniapp/nutrition-program/meal-report/'
        response = client_api.post(url, {
            'meal_type': 'breakfast',
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_report_for_specific_date(self, client_api, active_program):
        """Загрузка отчёта за конкретную дату."""
        url = '/api/miniapp/nutrition-program/meal-report/'
        tomorrow = (date.today() + timedelta(days=1)).isoformat()

        response = client_api.post(url, {
            'meal_type': 'breakfast',
            'photo_file_id': 'some_id',
            'date': tomorrow,
        })

        assert response.status_code == status.HTTP_201_CREATED

    def test_unauthorized(self, api_client):
        """Неавторизованный запрос возвращает 401."""
        url = '/api/miniapp/nutrition-program/meal-report/'
        response = api_client.post(url, {
            'meal_type': 'breakfast',
            'photo_file_id': 'some_id',
        })

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestMealReportsListView:
    """Тесты GET /api/miniapp/nutrition-program/meal-reports/."""

    def test_empty_list(self, client_api, active_program):
        """Пустой список если нет отчётов."""
        url = '/api/miniapp/nutrition-program/meal-reports/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['reports'] == []

    def test_list_reports_today(self, client_api, active_program):
        """Получение отчётов за сегодня."""
        # Создаём отчёт
        create_url = '/api/miniapp/nutrition-program/meal-report/'
        client_api.post(create_url, {
            'meal_type': 'breakfast',
            'photo_file_id': 'file_id_1',
        })
        client_api.post(create_url, {
            'meal_type': 'lunch',
            'photo_file_id': 'file_id_2',
        })

        # Получаем список
        url = '/api/miniapp/nutrition-program/meal-reports/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['reports']) == 2
        assert response.data['day_number'] == 1

    def test_list_reports_by_date(self, client_api, active_program):
        """Получение отчётов за конкретную дату."""
        # Создаём отчёт на завтра
        create_url = '/api/miniapp/nutrition-program/meal-report/'
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        client_api.post(create_url, {
            'meal_type': 'breakfast',
            'photo_file_id': 'file_id',
            'date': tomorrow,
        })

        # Получаем список за завтра
        url = f'/api/miniapp/nutrition-program/meal-reports/?date={tomorrow}'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['reports']) == 1
        assert response.data['date'] == tomorrow

        # За сегодня - пусто
        url_today = '/api/miniapp/nutrition-program/meal-reports/'
        response_today = client_api.get(url_today)
        assert len(response_today.data['reports']) == 0

    def test_invalid_date_format(self, client_api, active_program):
        """Ошибка при некорректном формате даты."""
        url = '/api/miniapp/nutrition-program/meal-reports/?date=invalid'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_no_program(self, client_api):
        """Пустой список если нет программы."""
        url = '/api/miniapp/nutrition-program/meal-reports/'
        response = client_api.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['reports'] == []

    def test_unauthorized(self, api_client):
        """Неавторизованный запрос возвращает 401."""
        url = '/api/miniapp/nutrition-program/meal-reports/'
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
