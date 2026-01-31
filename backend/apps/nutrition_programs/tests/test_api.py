"""
Тесты API для программ питания.
"""
import pytest
from datetime import date, timedelta
from django.urls import reverse
from rest_framework import status

from apps.nutrition_programs.models import NutritionProgram, NutritionProgramDay


@pytest.mark.django_db
class TestNutritionProgramListCreate:
    """Тесты списка и создания программ питания."""

    def test_list_programs_authenticated(self, authenticated_client, nutrition_program):
        """Аутентифицированный коуч может получить список своих программ."""
        url = '/api/nutrition/programs/'
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['name'] == 'Тестовая программа'

    def test_list_programs_unauthorized(self, api_client):
        """Неаутентифицированный пользователь не может получить список."""
        url = '/api/nutrition/programs/'
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_programs_other_coach(self, another_authenticated_client, nutrition_program):
        """Коуч не видит программы другого коуча."""
        url = '/api/nutrition/programs/'
        response = another_authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 0

    def test_create_program(self, authenticated_client, client_obj):
        """Коуч может создать программу питания."""
        url = '/api/nutrition/programs/'
        data = {
            'client': client_obj.id,
            'name': 'Новая программа',
            'description': 'Описание',
            'start_date': str(date.today()),
            'duration_days': 14,
            'days': [
                {'allowed_ingredients': [{'name': 'яблоко'}], 'forbidden_ingredients': [{'name': 'сахар'}]},
            ],
        }
        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Новая программа'
        assert response.data['duration_days'] == 14
        assert NutritionProgram.objects.filter(name='Новая программа').exists()

    def test_create_program_other_coach_client(self, another_authenticated_client, client_obj):
        """Коуч не может создать программу для клиента другого коуча."""
        url = '/api/nutrition/programs/'
        data = {
            'client': client_obj.id,
            'name': 'Программа чужого клиента',
            'start_date': str(date.today()),
            'duration_days': 7,
        }
        response = another_authenticated_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestNutritionProgramDetail:
    """Тесты детального просмотра и редактирования программы."""

    def test_retrieve_program(self, authenticated_client, nutrition_program):
        """Коуч может просмотреть свою программу."""
        url = f'/api/nutrition/programs/{nutrition_program.id}/'
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Тестовая программа'
        assert 'days' in response.data
        assert len(response.data['days']) == 7

    def test_retrieve_other_coach_program(self, another_authenticated_client, nutrition_program):
        """Коуч не может просмотреть программу другого коуча."""
        url = f'/api/nutrition/programs/{nutrition_program.id}/'
        response = another_authenticated_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_program(self, authenticated_client, nutrition_program):
        """Коуч может обновить свою программу."""
        url = f'/api/nutrition/programs/{nutrition_program.id}/'
        data = {
            'name': 'Обновлённая программа',
            'client': nutrition_program.client_id,
            'start_date': str(nutrition_program.start_date),
            'duration_days': nutrition_program.duration_days,
        }
        response = authenticated_client.put(url, data, format='json')

        assert response.status_code == status.HTTP_200_OK
        nutrition_program.refresh_from_db()
        assert nutrition_program.name == 'Обновлённая программа'

    def test_delete_program(self, authenticated_client, nutrition_program):
        """Коуч может удалить свою программу."""
        url = f'/api/nutrition/programs/{nutrition_program.id}/'
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not NutritionProgram.objects.filter(id=nutrition_program.id).exists()


@pytest.mark.django_db
class TestNutritionProgramActions:
    """Тесты действий программы (активация, отмена)."""

    def test_activate_program(self, authenticated_client, nutrition_program):
        """Коуч может активировать программу."""
        url = f'/api/nutrition/programs/{nutrition_program.id}/activate/'
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'active'
        nutrition_program.refresh_from_db()
        assert nutrition_program.status == 'active'

    def test_activate_already_active(self, authenticated_client, active_program):
        """Нельзя активировать уже активную программу."""
        url = f'/api/nutrition/programs/{active_program.id}/activate/'
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_activate_expired_program(self, authenticated_client, client_obj, coach):
        """Нельзя активировать программу с датой окончания в прошлом."""
        expired_program = NutritionProgram.objects.create(
            client=client_obj,
            coach=coach,
            name='Просроченная программа',
            start_date=date.today() - timedelta(days=30),
            duration_days=7,
            status='draft',
        )

        url = f'/api/nutrition/programs/{expired_program.id}/activate/'
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'завершённую' in response.data['error']

    def test_cancel_program(self, authenticated_client, active_program):
        """Коуч может отменить программу."""
        url = f'/api/nutrition/programs/{active_program.id}/cancel/'
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'cancelled'
        active_program.refresh_from_db()
        assert active_program.status == 'cancelled'

    def test_complete_program(self, authenticated_client, active_program):
        """Коуч может завершить программу."""
        url = f'/api/nutrition/programs/{active_program.id}/complete/'
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'completed'
        active_program.refresh_from_db()
        assert active_program.status == 'completed'

    def test_activate_deactivates_other_programs(self, authenticated_client, nutrition_program, client_obj, coach):
        """При активации программы другие активные программы клиента завершаются."""
        # Создаём другую активную программу
        other_program = NutritionProgram.objects.create(
            client=client_obj,
            coach=coach,
            name='Другая программа',
            start_date=date.today() - timedelta(days=5),
            duration_days=10,
            status='active',
        )

        url = f'/api/nutrition/programs/{nutrition_program.id}/activate/'
        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        other_program.refresh_from_db()
        assert other_program.status == 'completed'


@pytest.mark.django_db
class TestNutritionProgramDays:
    """Тесты для дней программы."""

    def test_list_program_days(self, authenticated_client, nutrition_program):
        """Коуч может получить список дней программы."""
        url = f'/api/nutrition/programs/{nutrition_program.id}/days/'
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 7

    def test_update_program_day(self, authenticated_client, nutrition_program):
        """Коуч может обновить день программы."""
        day = nutrition_program.days.first()
        url = f'/api/nutrition/programs/{nutrition_program.id}/days/{day.id}/'
        data = {
            'allowed_ingredients': [{'name': 'гречка'}, {'name': 'рыба'}],
            'forbidden_ingredients': [{'name': 'мучное'}],
            'notes': 'День без мучного',
        }
        response = authenticated_client.patch(url, data, format='json')

        assert response.status_code == status.HTTP_200_OK
        day.refresh_from_db()
        assert len(day.allowed_ingredients) == 2
        assert day.notes == 'День без мучного'

    def test_copy_day(self, authenticated_client, nutrition_program):
        """Коуч может скопировать настройки из другого дня."""
        source_day = nutrition_program.days.first()
        target_day = nutrition_program.days.last()

        # Обновляем source_day
        source_day.allowed_ingredients = [{'name': 'творог'}]
        source_day.forbidden_ingredients = [{'name': 'жирное'}]
        source_day.notes = 'Творожный день'
        source_day.save()

        url = f'/api/nutrition/programs/{nutrition_program.id}/days/{target_day.id}/copy/'
        response = authenticated_client.post(url, {'source_day_id': source_day.id}, format='json')

        assert response.status_code == status.HTTP_200_OK
        target_day.refresh_from_db()
        assert target_day.allowed_ingredients == source_day.allowed_ingredients
        assert target_day.notes == 'Творожный день'


@pytest.mark.django_db
class TestComplianceStats:
    """Тесты для статистики соблюдения."""

    def test_list_stats(self, authenticated_client, active_program):
        """Коуч может получить статистику по программам."""
        url = '/api/nutrition/stats/'
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1
        assert response.data[0]['program_name'] == 'Тестовая программа'

    def test_list_stats_filter_by_program(self, authenticated_client, active_program):
        """Можно фильтровать статистику по программе."""
        url = f'/api/nutrition/stats/?program_id={active_program.id}'
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_violations_list(self, authenticated_client, active_program):
        """Коуч может получить список нарушений."""
        url = '/api/nutrition/stats/violations/'
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Нарушений пока нет (пагинированный ответ)
        assert response.data['count'] == 0
        assert len(response.data['results']) == 0

    def test_export_stats_csv(self, authenticated_client, active_program):
        """Коуч может экспортировать статистику в CSV."""
        url = '/api/nutrition/stats/export-csv/'
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'text/csv; charset=utf-8'
        assert 'attachment' in response['Content-Disposition']
        assert 'nutrition_stats.csv' in response['Content-Disposition']

        # Проверяем содержимое
        content = response.content.decode('utf-8')
        assert 'Программа' in content  # Header
        assert 'Тестовая программа' in content  # Data

    def test_export_violations_csv(self, authenticated_client, active_program):
        """Коуч может экспортировать нарушения в CSV."""
        url = '/api/nutrition/stats/export-csv/?type=violations'
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'text/csv; charset=utf-8'
        assert 'nutrition_violations.csv' in response['Content-Disposition']

        # Проверяем заголовки
        content = response.content.decode('utf-8')
        assert 'Дата' in content
        assert 'Клиент' in content
