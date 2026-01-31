"""
Интеграционные тесты полного flow программ питания.

Тестируют весь путь:
1. Создание программы через API
2. Активация программы
3. Проверка приёма пищи на соответствие
4. Получение статистики
"""
import pytest
from datetime import date, timedelta
from django.utils import timezone
from rest_framework import status

from apps.meals.models import Meal
from apps.nutrition_programs.models import (
    MealComplianceCheck,
    NutritionProgram,
    NutritionProgramDay,
)
from apps.nutrition_programs.services import process_meal_compliance


@pytest.mark.django_db
class TestFullNutritionProgramFlow:
    """Интеграционный тест полного flow программы питания."""

    def test_complete_flow(self, authenticated_client, client_obj, coach):
        """
        Полный flow:
        1. Создание программы с днями
        2. Активация программы
        3. Клиент ест соответствующую еду → проверка проходит
        4. Клиент ест запрещённую еду → нарушение
        5. Получение статистики
        """
        # 1. Создаём программу через API
        create_url = '/api/nutrition/programs/'
        program_data = {
            'client': client_obj.id,
            'name': 'Интеграционная программа',
            'description': 'Тест полного flow',
            'start_date': str(date.today()),
            'duration_days': 7,
            'days': [
                {
                    'allowed_ingredients': [{'name': 'курица'}, {'name': 'рис'}, {'name': 'овощи'}],
                    'forbidden_ingredients': [{'name': 'сахар'}, {'name': 'шоколад'}],
                },
            ],
        }
        response = authenticated_client.post(create_url, program_data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        program_id = response.data['id']
        assert response.data['name'] == 'Интеграционная программа'
        assert response.data['status'] == 'draft'
        assert len(response.data['days']) == 7

        # Проверяем что день создан с ингредиентами
        first_day = response.data['days'][0]
        assert len(first_day['allowed_ingredients']) == 3
        assert len(first_day['forbidden_ingredients']) == 2

        # 2. Активируем программу
        activate_url = f'/api/nutrition/programs/{program_id}/activate/'
        response = authenticated_client.post(activate_url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'active'

        # Проверяем что программа действительно активна
        program = NutritionProgram.objects.get(id=program_id)
        assert program.status == 'active'

        # 3. Клиент ест курицу с рисом (соответствует программе)
        compliant_meal = Meal.objects.create(
            client=client_obj,
            dish_name='Курица с рисом',
            ingredients=[{'name': 'курица'}, {'name': 'рис'}],
            meal_time=timezone.now(),
        )

        check, feedback = process_meal_compliance(compliant_meal)

        assert check is not None
        assert check.is_compliant is True
        assert 'курица' in check.found_allowed
        assert 'рис' in check.found_allowed
        assert len(check.found_forbidden) == 0
        assert 'Отлично' in feedback

        # 4. Клиент ест шоколад (нарушение программы)
        violation_meal = Meal.objects.create(
            client=client_obj,
            dish_name='Шоколадный торт',
            ingredients=[{'name': 'шоколад'}, {'name': 'сахар'}],
            meal_time=timezone.now(),
        )

        check2, feedback2 = process_meal_compliance(violation_meal)

        assert check2 is not None
        assert check2.is_compliant is False
        assert 'шоколад' in check2.found_forbidden
        assert 'сахар' in check2.found_forbidden
        assert 'шоколад' in feedback2 or 'сахар' in feedback2

        # 5. Получаем статистику
        stats_url = f'/api/nutrition/stats/?program_id={program_id}'
        response = authenticated_client.get(stats_url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

        stats = response.data[0]
        assert stats['program_id'] == program_id
        assert stats['total_meals'] == 2
        assert stats['compliant_meals'] == 1
        assert stats['violations'] == 1
        assert stats['compliance_rate'] == 50.0

        # 6. Проверяем список нарушений
        violations_url = f'/api/nutrition/stats/violations/?program_id={program_id}'
        response = authenticated_client.get(violations_url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert len(response.data['results']) == 1

        violation = response.data['results'][0]
        assert violation['is_compliant'] is False
        assert 'шоколад' in violation['found_forbidden'] or 'сахар' in violation['found_forbidden']

    def test_program_day_boundaries(self, authenticated_client, client_obj, coach):
        """
        Тест проверки границ дней программы.
        Разные дни могут иметь разные ограничения.
        """
        # Создаём программу с разными ограничениями на разные дни
        create_url = '/api/nutrition/programs/'
        program_data = {
            'client': client_obj.id,
            'name': 'Программа с разными днями',
            'start_date': str(date.today()),
            'duration_days': 3,
            'days': [
                {  # День 1 - можно курицу
                    'allowed_ingredients': [{'name': 'курица'}],
                    'forbidden_ingredients': [{'name': 'свинина'}],
                },
                {  # День 2 - можно рыбу
                    'allowed_ingredients': [{'name': 'рыба'}],
                    'forbidden_ingredients': [{'name': 'мясо'}],
                },
                {  # День 3 - можно овощи
                    'allowed_ingredients': [{'name': 'овощи'}],
                    'forbidden_ingredients': [{'name': 'жареное'}],
                },
            ],
        }
        response = authenticated_client.post(create_url, program_data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        program_id = response.data['id']

        # Активируем
        authenticated_client.post(f'/api/nutrition/programs/{program_id}/activate/')

        # Проверяем что первый день имеет правильные ингредиенты
        program = NutritionProgram.objects.get(id=program_id)
        day1 = program.days.get(day_number=1)

        assert 'курица' in day1.allowed_ingredients_list
        assert 'свинина' in day1.forbidden_ingredients_list

    def test_multiple_active_programs_conflict(self, authenticated_client, client_obj, coach):
        """
        При активации новой программы старая должна завершиться.
        """
        # Создаём первую программу
        create_url = '/api/nutrition/programs/'
        program1_data = {
            'client': client_obj.id,
            'name': 'Программа 1',
            'start_date': str(date.today()),
            'duration_days': 7,
        }
        response1 = authenticated_client.post(create_url, program1_data, format='json')
        program1_id = response1.data['id']

        # Активируем первую программу
        authenticated_client.post(f'/api/nutrition/programs/{program1_id}/activate/')

        # Создаём вторую программу (на другие даты, чтобы избежать конфликта при создании)
        program2_data = {
            'client': client_obj.id,
            'name': 'Программа 2',
            'start_date': str(date.today() + timedelta(days=10)),
            'duration_days': 7,
        }
        response2 = authenticated_client.post(create_url, program2_data, format='json')
        program2_id = response2.data['id']

        # Активируем вторую программу
        authenticated_client.post(f'/api/nutrition/programs/{program2_id}/activate/')

        # Проверяем что первая программа завершена
        program1 = NutritionProgram.objects.get(id=program1_id)
        program2 = NutritionProgram.objects.get(id=program2_id)

        assert program1.status == 'completed'
        assert program2.status == 'active'

    def test_compliance_with_fuzzy_matching(self, authenticated_client, client_obj, coach):
        """
        Тест fuzzy matching при проверке ингредиентов.
        """
        # Создаём программу
        create_url = '/api/nutrition/programs/'
        program_data = {
            'client': client_obj.id,
            'name': 'Программа с fuzzy matching',
            'start_date': str(date.today()),
            'duration_days': 1,
            'days': [
                {
                    'allowed_ingredients': [{'name': 'куриная грудка'}],
                    'forbidden_ingredients': [{'name': 'белый сахар'}],
                },
            ],
        }
        response = authenticated_client.post(create_url, program_data, format='json')
        program_id = response.data['id']

        # Активируем
        authenticated_client.post(f'/api/nutrition/programs/{program_id}/activate/')

        # Тестируем fuzzy matching для разрешённых (с опечаткой)
        meal_allowed = Meal.objects.create(
            client=client_obj,
            dish_name='Куринная грудка',  # опечатка
            ingredients=[{'name': 'куринная грудка'}],  # опечатка
            meal_time=timezone.now(),
        )

        check, _ = process_meal_compliance(meal_allowed)
        assert check is not None
        # Fuzzy matching должен найти совпадение
        assert check.is_compliant is True
        assert 'куринная грудка' in check.found_allowed

        # Тестируем fuzzy matching для запрещённых
        meal_forbidden = Meal.objects.create(
            client=client_obj,
            dish_name='Сладкий чай',
            ingredients=[{'name': 'сахар белый'}],  # порядок слов изменён
            meal_time=timezone.now(),
        )

        check2, _ = process_meal_compliance(meal_forbidden)
        assert check2 is not None
        assert check2.is_compliant is False
        assert 'сахар белый' in check2.found_forbidden


@pytest.mark.django_db
class TestAPIPermissions:
    """Тесты прав доступа к API."""

    def test_coach_cannot_access_other_coach_program(
        self,
        authenticated_client,
        another_authenticated_client,
        nutrition_program,
    ):
        """Коуч не может получить программу другого коуча."""
        # Первый коуч создал программу (через fixture)
        # Второй коуч пытается её получить
        url = f'/api/nutrition/programs/{nutrition_program.id}/'
        response = another_authenticated_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_coach_cannot_modify_other_coach_program(
        self,
        authenticated_client,
        another_authenticated_client,
        nutrition_program,
    ):
        """Коуч не может изменить программу другого коуча."""
        url = f'/api/nutrition/programs/{nutrition_program.id}/'
        response = another_authenticated_client.patch(
            url,
            {'name': 'Взломанная программа'},
            format='json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_coach_cannot_activate_other_coach_program(
        self,
        authenticated_client,
        another_authenticated_client,
        nutrition_program,
    ):
        """Коуч не может активировать программу другого коуча."""
        url = f'/api/nutrition/programs/{nutrition_program.id}/activate/'
        response = another_authenticated_client.post(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_coach_cannot_see_other_coach_violations(
        self,
        authenticated_client,
        another_authenticated_client,
        active_program,
        client_obj,
    ):
        """Коуч не видит нарушения клиентов другого коуча."""
        # Создаём meal с нарушением для клиента первого коуча
        meal = Meal.objects.create(
            client=client_obj,
            dish_name='Шоколад',
            ingredients=[{'name': 'шоколад'}],
            meal_time=timezone.now(),
        )
        process_meal_compliance(meal)

        # Второй коуч пытается получить нарушения
        url = '/api/nutrition/stats/violations/'
        response = another_authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0  # Не видит чужие нарушения
