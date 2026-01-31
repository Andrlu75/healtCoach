"""
Тесты сервисов программ питания.
"""
import pytest
from datetime import date, timedelta
from unittest.mock import MagicMock

from apps.nutrition_programs.services import (
    find_ingredient_match,
    find_all_matches,
    check_meal_compliance,
    generate_compliance_feedback,
    get_active_program_for_client,
    get_program_day,
    process_meal_compliance,
    ComplianceResult,
)
from apps.nutrition_programs.models import NutritionProgram, NutritionProgramDay, MealComplianceCheck


@pytest.mark.django_db
class TestFindIngredientMatch:
    """Тесты для функции fuzzy matching ингредиентов."""

    def test_exact_match(self):
        """Точное совпадение."""
        result = find_ingredient_match('сахар', ['сахар', 'соль', 'перец'])
        assert result == 'сахар'

    def test_case_insensitive(self):
        """Регистр не важен."""
        result = find_ingredient_match('САХАР', ['сахар', 'соль'])
        assert result == 'сахар'

    def test_partial_match(self):
        """Частичное совпадение с пониженным порогом."""
        result = find_ingredient_match('сахар', ['сахар белый', 'соль'], threshold=60)
        assert result == 'сахар белый'

    def test_typo_match(self):
        """Совпадение с опечаткой."""
        result = find_ingredient_match('куринная грудка', ['куриная грудка', 'говядина'])
        assert result == 'куриная грудка'

    def test_word_order(self):
        """Порядок слов не важен."""
        result = find_ingredient_match('белый хлеб', ['хлеб белый', 'хлеб чёрный'])
        assert result == 'хлеб белый'

    def test_no_match(self):
        """Нет совпадения."""
        result = find_ingredient_match('яблоко', ['груша', 'банан'])
        assert result is None

    def test_empty_list(self):
        """Пустой список."""
        result = find_ingredient_match('яблоко', [])
        assert result is None

    def test_threshold(self):
        """Порог совпадения."""
        # Совпадение выше порога
        result = find_ingredient_match('курица', ['куриная грудка'], threshold=50)
        assert result is not None

        # Совпадение ниже порога
        result = find_ingredient_match('яблоко', ['апельсин'], threshold=80)
        assert result is None


@pytest.mark.django_db
class TestFindAllMatches:
    """Тесты для функции поиска всех похожих ингредиентов."""

    def test_find_multiple_matches(self):
        """Находит несколько похожих."""
        ingredients = ['курица жареная', 'курица варёная', 'курица гриль', 'свинина']
        result = find_all_matches('курица', ingredients, threshold=60)

        assert len(result) >= 2
        assert all('курица' in match[0].lower() for match in result)

    def test_limit_results(self):
        """Ограничение количества результатов."""
        ingredients = ['курица 1', 'курица 2', 'курица 3', 'курица 4', 'курица 5']
        result = find_all_matches('курица', ingredients, limit=2)

        assert len(result) <= 2

    def test_sorted_by_score(self):
        """Результаты отсортированы по убыванию score."""
        ingredients = ['курица', 'куриная грудка', 'куриные крылышки']
        result = find_all_matches('курица', ingredients)

        if len(result) >= 2:
            for i in range(len(result) - 1):
                assert result[i][1] >= result[i + 1][1]


@pytest.mark.django_db
class TestCheckMealCompliance:
    """Тесты проверки соответствия приёма пищи."""

    @pytest.fixture
    def program_day(self, nutrition_program):
        """День программы с разрешёнными и запрещёнными ингредиентами."""
        day = nutrition_program.days.first()
        day.allowed_ingredients = [{'name': 'курица'}, {'name': 'рис'}, {'name': 'овощи'}]
        day.forbidden_ingredients = [{'name': 'сахар'}, {'name': 'шоколад'}, {'name': 'мучное'}]
        day.save()
        return day

    def test_compliant_meal(self, program_day):
        """Приём пищи соответствует программе."""
        meal = MagicMock()
        meal.ingredients = [{'name': 'курица'}, {'name': 'рис'}]

        result = check_meal_compliance(meal, program_day)

        assert result.is_compliant is True
        assert len(result.found_forbidden) == 0
        assert len(result.found_allowed) == 2

    def test_violation_meal(self, program_day):
        """Приём пищи содержит запрещённые продукты."""
        meal = MagicMock()
        meal.ingredients = [{'name': 'курица'}, {'name': 'шоколад'}]

        result = check_meal_compliance(meal, program_day)

        assert result.is_compliant is False
        assert 'шоколад' in result.found_forbidden
        assert 'курица' in result.found_allowed

    def test_neutral_ingredients(self, program_day):
        """Ингредиенты не в списках (нейтральные)."""
        meal = MagicMock()
        meal.ingredients = [{'name': 'курица'}, {'name': 'помидоры'}]

        result = check_meal_compliance(meal, program_day)

        assert result.is_compliant is True
        assert 'помидоры' in result.neutral

    def test_empty_ingredients(self, program_day):
        """Пустой список ингредиентов."""
        meal = MagicMock()
        meal.ingredients = []

        result = check_meal_compliance(meal, program_day)

        assert result.is_compliant is True

    def test_string_ingredients(self, program_day):
        """Ингредиенты как строки (не словари)."""
        meal = MagicMock()
        meal.ingredients = ['курица', 'рис']

        result = check_meal_compliance(meal, program_day)

        assert result.is_compliant is True


@pytest.mark.django_db
class TestGenerateComplianceFeedback:
    """Тесты генерации обратной связи."""

    @pytest.fixture
    def program_day(self, nutrition_program):
        day = nutrition_program.days.first()
        day.allowed_ingredients = [{'name': 'курица'}, {'name': 'рис'}]
        day.forbidden_ingredients = [{'name': 'сахар'}]
        day.save()
        return day

    def test_compliant_feedback(self, program_day):
        """Положительная обратная связь при соблюдении."""
        result = ComplianceResult(
            is_compliant=True,
            found_forbidden=[],
            found_allowed=['курица'],
            neutral=[],
        )

        feedback = generate_compliance_feedback(result, program_day)

        assert 'Отлично' in feedback or 'соблюдаете' in feedback.lower()

    def test_violation_feedback(self, program_day):
        """Обратная связь при нарушении."""
        result = ComplianceResult(
            is_compliant=False,
            found_forbidden=['сахар'],
            found_allowed=['курица'],
            neutral=[],
        )

        feedback = generate_compliance_feedback(result, program_day)

        assert 'сахар' in feedback
        assert 'рекомендуется' in feedback.lower() or 'программе' in feedback.lower()


@pytest.mark.django_db
class TestGetActiveProgramForClient:
    """Тесты получения активной программы клиента."""

    def test_active_program_exists(self, active_program, client_obj):
        """Есть активная программа на сегодня."""
        result = get_active_program_for_client(client_obj)

        assert result is not None
        assert result.id == active_program.id

    def test_no_active_program(self, nutrition_program, client_obj):
        """Нет активной программы (программа в статусе draft)."""
        result = get_active_program_for_client(client_obj)

        assert result is None

    def test_program_date_range(self, active_program, client_obj):
        """Программа только в указанном диапазоне дат."""
        # Проверяем сегодня
        result = get_active_program_for_client(client_obj, date.today())
        assert result is not None

        # Проверяем дату вне диапазона
        result = get_active_program_for_client(client_obj, date.today() - timedelta(days=30))
        assert result is None


@pytest.mark.django_db
class TestGetProgramDay:
    """Тесты получения дня программы."""

    def test_get_today(self, active_program):
        """Получить сегодняшний день."""
        result = get_program_day(active_program, date.today())

        assert result is not None
        assert result.day_number == 1

    def test_get_specific_day(self, active_program):
        """Получить конкретный день."""
        target_date = active_program.start_date + timedelta(days=2)
        result = get_program_day(active_program, target_date)

        assert result is not None
        assert result.day_number == 3

    def test_date_out_of_range(self, active_program):
        """Дата вне диапазона программы."""
        result = get_program_day(active_program, date.today() - timedelta(days=10))

        assert result is None


@pytest.mark.django_db
class TestProcessMealCompliance:
    """Тесты полного flow проверки приёма пищи."""

    def test_creates_compliance_check(self, active_program, client_obj):
        """Создаёт запись MealComplianceCheck."""
        from apps.meals.models import Meal
        from django.utils import timezone

        # Создаём meal
        meal = Meal.objects.create(
            client=client_obj,
            dish_name='Курица с рисом',
            ingredients=[{'name': 'курица'}, {'name': 'рис'}],
            meal_time=timezone.now(),
        )

        check, feedback = process_meal_compliance(meal)

        assert check is not None
        assert isinstance(check, MealComplianceCheck)
        assert check.meal == meal
        assert feedback != ''

    def test_no_active_program(self, nutrition_program, client_obj):
        """Нет активной программы - возвращает None."""
        from apps.meals.models import Meal
        from django.utils import timezone

        meal = Meal.objects.create(
            client=client_obj,
            dish_name='Тест',
            ingredients=[],
            meal_time=timezone.now(),
        )

        check, feedback = process_meal_compliance(meal)

        assert check is None
        assert feedback == ''
