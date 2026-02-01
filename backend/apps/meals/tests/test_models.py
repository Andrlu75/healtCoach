"""Unit тесты для моделей Product, DishTag, Dish."""

import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.meals.models import Product, DishTag, Dish, PRODUCT_CATEGORIES, MEAL_TYPES


# ============================================================================
# PRODUCT MODEL TESTS
# ============================================================================

class TestProductModel:
    """Тесты модели Product."""

    def test_create_product(self, coach):
        """Тест создания продукта."""
        product = Product.objects.create(
            coach=coach,
            name='Творог 5%',
            calories_per_100g=Decimal('121.00'),
            proteins_per_100g=Decimal('17.20'),
            fats_per_100g=Decimal('5.00'),
            carbs_per_100g=Decimal('1.80'),
            category='dairy',
        )
        assert product.id is not None
        assert product.name == 'Творог 5%'
        assert product.category == 'dairy'
        assert product.is_verified is False
        assert product.coach == coach

    def test_product_str(self, product):
        """Тест строкового представления продукта."""
        assert str(product) == 'Куриная грудка'

    def test_product_unique_name_per_coach(self, coach, product):
        """Тест уникальности названия продукта для коуча."""
        with pytest.raises(IntegrityError):
            Product.objects.create(
                coach=coach,
                name='Куриная грудка',  # Уже существует
                calories_per_100g=Decimal('100.00'),
                proteins_per_100g=Decimal('20.00'),
                fats_per_100g=Decimal('1.00'),
                carbs_per_100g=Decimal('0.00'),
            )

    def test_product_same_name_different_coach(self, coach, another_coach):
        """Тест: разные коучи могут иметь продукты с одинаковым названием."""
        Product.objects.create(
            coach=coach,
            name='Яблоко',
            calories_per_100g=Decimal('52.00'),
            proteins_per_100g=Decimal('0.30'),
            fats_per_100g=Decimal('0.20'),
            carbs_per_100g=Decimal('14.00'),
            category='fruits',
        )
        product2 = Product.objects.create(
            coach=another_coach,
            name='Яблоко',  # То же название, другой коуч
            calories_per_100g=Decimal('50.00'),
            proteins_per_100g=Decimal('0.40'),
            fats_per_100g=Decimal('0.10'),
            carbs_per_100g=Decimal('13.00'),
            category='fruits',
        )
        assert product2.id is not None

    def test_product_negative_calories_validation(self, coach):
        """Тест валидации: калории не могут быть отрицательными."""
        product = Product(
            coach=coach,
            name='Тестовый продукт',
            calories_per_100g=Decimal('-10.00'),
            proteins_per_100g=Decimal('10.00'),
            fats_per_100g=Decimal('5.00'),
            carbs_per_100g=Decimal('20.00'),
        )
        with pytest.raises(ValidationError):
            product.full_clean()

    def test_product_negative_proteins_validation(self, coach):
        """Тест валидации: белки не могут быть отрицательными."""
        product = Product(
            coach=coach,
            name='Тестовый продукт',
            calories_per_100g=Decimal('100.00'),
            proteins_per_100g=Decimal('-5.00'),
            fats_per_100g=Decimal('5.00'),
            carbs_per_100g=Decimal('20.00'),
        )
        with pytest.raises(ValidationError):
            product.full_clean()

    def test_product_negative_fats_validation(self, coach):
        """Тест валидации: жиры не могут быть отрицательными."""
        product = Product(
            coach=coach,
            name='Тестовый продукт',
            calories_per_100g=Decimal('100.00'),
            proteins_per_100g=Decimal('10.00'),
            fats_per_100g=Decimal('-5.00'),
            carbs_per_100g=Decimal('20.00'),
        )
        with pytest.raises(ValidationError):
            product.full_clean()

    def test_product_negative_carbs_validation(self, coach):
        """Тест валидации: углеводы не могут быть отрицательными."""
        product = Product(
            coach=coach,
            name='Тестовый продукт',
            calories_per_100g=Decimal('100.00'),
            proteins_per_100g=Decimal('10.00'),
            fats_per_100g=Decimal('5.00'),
            carbs_per_100g=Decimal('-20.00'),
        )
        with pytest.raises(ValidationError):
            product.full_clean()

    def test_product_zero_nutrition_valid(self, coach):
        """Тест: нулевые значения КБЖУ допустимы."""
        product = Product(
            coach=coach,
            name='Вода',
            calories_per_100g=Decimal('0.00'),
            proteins_per_100g=Decimal('0.00'),
            fats_per_100g=Decimal('0.00'),
            carbs_per_100g=Decimal('0.00'),
            category='other',
        )
        product.full_clean()  # Не должно вызывать исключение
        product.save()
        assert product.id is not None

    def test_get_nutrition_for_weight(self, product):
        """Тест расчёта КБЖУ для заданного веса."""
        # Куриная грудка: 165 ккал, 31г белка, 3.6г жира, 0г углеводов на 100г
        nutrition = product.get_nutrition_for_weight(200)

        assert nutrition['calories'] == Decimal('330.00')
        assert nutrition['proteins'] == Decimal('62.00')
        assert nutrition['fats'] == Decimal('7.20')
        assert nutrition['carbohydrates'] == Decimal('0.00')

    def test_get_nutrition_for_weight_small_portion(self, product):
        """Тест расчёта КБЖУ для маленькой порции."""
        nutrition = product.get_nutrition_for_weight(50)

        assert nutrition['calories'] == Decimal('82.50')
        assert nutrition['proteins'] == Decimal('15.50')
        assert nutrition['fats'] == Decimal('1.80')
        assert nutrition['carbohydrates'] == Decimal('0.00')

    def test_get_nutrition_for_weight_zero(self, product):
        """Тест расчёта КБЖУ для нулевого веса."""
        nutrition = product.get_nutrition_for_weight(0)

        assert nutrition['calories'] == Decimal('0.00')
        assert nutrition['proteins'] == Decimal('0.00')
        assert nutrition['fats'] == Decimal('0.00')
        assert nutrition['carbohydrates'] == Decimal('0.00')

    def test_product_categories_choices(self):
        """Тест: проверка наличия всех категорий."""
        categories = [cat[0] for cat in PRODUCT_CATEGORIES]
        expected = ['dairy', 'meat', 'fish', 'vegetables', 'fruits', 'grains', 'nuts', 'oils', 'spices', 'other']
        assert categories == expected

    def test_product_ordering(self, coach):
        """Тест сортировки продуктов по имени."""
        Product.objects.create(
            coach=coach, name='Яблоко',
            calories_per_100g=52, proteins_per_100g=0.3,
            fats_per_100g=0.2, carbs_per_100g=14,
        )
        Product.objects.create(
            coach=coach, name='Апельсин',
            calories_per_100g=47, proteins_per_100g=0.9,
            fats_per_100g=0.1, carbs_per_100g=12,
        )
        Product.objects.create(
            coach=coach, name='Банан',
            calories_per_100g=89, proteins_per_100g=1.1,
            fats_per_100g=0.3, carbs_per_100g=23,
        )

        products = list(Product.objects.filter(coach=coach).values_list('name', flat=True))
        assert products == ['Апельсин', 'Банан', 'Яблоко']


# ============================================================================
# DISH TAG MODEL TESTS
# ============================================================================

class TestDishTagModel:
    """Тесты модели DishTag."""

    def test_create_dish_tag(self, coach):
        """Тест создания тега."""
        tag = DishTag.objects.create(
            coach=coach,
            name='Веганские',
            color='#16A34A',
        )
        assert tag.id is not None
        assert tag.name == 'Веганские'
        assert tag.color == '#16A34A'

    def test_dish_tag_str(self, dish_tag):
        """Тест строкового представления тега."""
        assert str(dish_tag) == 'Низкоуглеводные'

    def test_dish_tag_default_color(self, coach):
        """Тест цвета по умолчанию."""
        tag = DishTag.objects.create(coach=coach, name='Тестовый тег')
        assert tag.color == '#3B82F6'

    def test_dish_tag_unique_name_per_coach(self, coach, dish_tag):
        """Тест уникальности названия тега для коуча."""
        with pytest.raises(IntegrityError):
            DishTag.objects.create(
                coach=coach,
                name='Низкоуглеводные',  # Уже существует
            )

    def test_dish_tag_same_name_different_coach(self, coach, another_coach):
        """Тест: разные коучи могут иметь теги с одинаковым названием."""
        DishTag.objects.create(coach=coach, name='Диетические')
        tag2 = DishTag.objects.create(coach=another_coach, name='Диетические')
        assert tag2.id is not None

    def test_dish_tag_ordering(self, coach):
        """Тест сортировки тегов по имени."""
        DishTag.objects.create(coach=coach, name='Яблочные')
        DishTag.objects.create(coach=coach, name='Апельсиновые')
        DishTag.objects.create(coach=coach, name='Банановые')

        tags = list(DishTag.objects.filter(coach=coach).values_list('name', flat=True))
        assert tags == ['Апельсиновые', 'Банановые', 'Яблочные']


# ============================================================================
# DISH MODEL TESTS
# ============================================================================

class TestDishModel:
    """Тесты модели Dish."""

    def test_create_dish(self, coach):
        """Тест создания блюда."""
        dish = Dish.objects.create(
            coach=coach,
            name='Овощной салат',
            description='Свежий и лёгкий',
            portion_weight=200,
            calories=Decimal('150.00'),
            proteins=Decimal('5.00'),
            fats=Decimal('8.00'),
            carbohydrates=Decimal('15.00'),
        )
        assert dish.id is not None
        assert dish.name == 'Овощной салат'
        assert dish.is_active is True

    def test_dish_str(self, dish):
        """Тест строкового представления блюда."""
        assert str(dish) == 'Куриная грудка с рисом'

    def test_dish_default_values(self, coach):
        """Тест значений по умолчанию."""
        dish = Dish.objects.create(coach=coach, name='Тестовое блюдо')

        assert dish.portion_weight == 0
        assert dish.calories == Decimal('0')
        assert dish.proteins == Decimal('0')
        assert dish.fats == Decimal('0')
        assert dish.carbohydrates == Decimal('0')
        assert dish.is_active is True
        assert dish.ingredients == []
        assert dish.shopping_links == []
        assert dish.meal_types == []

    def test_dish_negative_calories_validation(self, coach):
        """Тест валидации: калории не могут быть отрицательными."""
        dish = Dish(
            coach=coach,
            name='Тестовое блюдо',
            calories=Decimal('-10.00'),
        )
        with pytest.raises(ValidationError):
            dish.full_clean()

    def test_dish_negative_proteins_validation(self, coach):
        """Тест валидации: белки не могут быть отрицательными."""
        dish = Dish(
            coach=coach,
            name='Тестовое блюдо',
            proteins=Decimal('-5.00'),
        )
        with pytest.raises(ValidationError):
            dish.full_clean()

    def test_dish_with_tags(self, dish_with_tags, dish_tag, another_dish_tag):
        """Тест блюда с тегами."""
        tags = list(dish_with_tags.tags.all())
        assert len(tags) == 2
        assert dish_tag in tags
        assert another_dish_tag in tags

    def test_dish_meal_types(self, dish):
        """Тест типов приёмов пищи."""
        assert 'lunch' in dish.meal_types
        assert 'dinner' in dish.meal_types
        assert 'breakfast' not in dish.meal_types

    def test_dish_ingredients_json(self, dish):
        """Тест JSON поля ингредиентов."""
        assert len(dish.ingredients) == 2
        assert dish.ingredients[0]['name'] == 'Куриная грудка'
        assert dish.ingredients[1]['name'] == 'Рис белый'

    def test_recalculate_nutrition(self, coach):
        """Тест пересчёта КБЖУ по ингредиентам."""
        dish = Dish.objects.create(
            coach=coach,
            name='Тестовое блюдо',
            ingredients=[
                {'name': 'Курица', 'weight': 100, 'calories': 165, 'proteins': 31, 'fats': 3.6, 'carbohydrates': 0},
                {'name': 'Рис', 'weight': 100, 'calories': 130, 'proteins': 2.7, 'fats': 0.3, 'carbohydrates': 28},
            ],
        )

        dish.recalculate_nutrition()

        assert dish.portion_weight == 200
        assert dish.calories == Decimal('295.00')
        assert dish.proteins == Decimal('33.70')
        assert dish.fats == Decimal('3.90')
        assert dish.carbohydrates == Decimal('28.00')

    def test_recalculate_nutrition_empty_ingredients(self, coach):
        """Тест пересчёта КБЖУ без ингредиентов."""
        dish = Dish.objects.create(
            coach=coach,
            name='Пустое блюдо',
            calories=Decimal('100.00'),  # Начальные значения
            proteins=Decimal('10.00'),
            ingredients=[],
        )

        dish.recalculate_nutrition()

        assert dish.portion_weight == 0
        assert dish.calories == Decimal('0.00')
        assert dish.proteins == Decimal('0.00')
        assert dish.fats == Decimal('0.00')
        assert dish.carbohydrates == Decimal('0.00')

    def test_recalculate_nutrition_partial_ingredients(self, coach):
        """Тест пересчёта КБЖУ с неполными данными ингредиентов."""
        dish = Dish.objects.create(
            coach=coach,
            name='Блюдо с неполными данными',
            ingredients=[
                {'name': 'Продукт 1', 'weight': 100, 'calories': 50},  # Без белков/жиров/углеводов
                {'name': 'Продукт 2', 'weight': 50},  # Только вес
            ],
        )

        dish.recalculate_nutrition()

        assert dish.portion_weight == 150
        assert dish.calories == Decimal('50.00')
        assert dish.proteins == Decimal('0.00')
        assert dish.fats == Decimal('0.00')
        assert dish.carbohydrates == Decimal('0.00')

    def test_dish_ordering(self, coach):
        """Тест сортировки блюд по дате обновления (новые первые)."""
        dish1 = Dish.objects.create(coach=coach, name='Первое блюдо')
        dish2 = Dish.objects.create(coach=coach, name='Второе блюдо')
        dish3 = Dish.objects.create(coach=coach, name='Третье блюдо')

        # Обновляем первое блюдо, чтобы оно стало новее
        dish1.description = 'Обновлённое'
        dish1.save()

        dishes = list(Dish.objects.filter(coach=coach))
        assert dishes[0] == dish1  # Последнее обновлённое первым
        assert dishes[1] == dish3
        assert dishes[2] == dish2

    def test_archived_dish_exists(self, archived_dish):
        """Тест существования архивированного блюда."""
        assert archived_dish.is_active is False
        assert Dish.objects.filter(id=archived_dish.id).exists()

    def test_active_dishes_filter(self, dish, archived_dish):
        """Тест фильтрации активных блюд."""
        active_dishes = Dish.objects.filter(is_active=True)
        assert dish in active_dishes
        assert archived_dish not in active_dishes

    def test_meal_types_choices(self):
        """Тест: проверка наличия всех типов приёмов пищи."""
        meal_types = [mt[0] for mt in MEAL_TYPES]
        expected = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner']
        assert meal_types == expected

    def test_dish_shopping_links_json(self, coach):
        """Тест JSON поля ссылок на покупку."""
        dish = Dish.objects.create(
            coach=coach,
            name='Блюдо со ссылками',
            shopping_links=[
                {'title': 'Яндекс Маркет', 'url': 'https://market.yandex.ru/product/123'},
                {'title': 'Ozon', 'url': 'https://ozon.ru/product/456'},
            ],
        )

        assert len(dish.shopping_links) == 2
        assert dish.shopping_links[0]['title'] == 'Яндекс Маркет'
        assert dish.shopping_links[1]['url'] == 'https://ozon.ru/product/456'

    def test_dish_can_have_no_tags(self, dish):
        """Тест: блюдо может не иметь тегов."""
        assert dish.tags.count() == 0

    def test_dish_cooking_time_nullable(self, coach):
        """Тест: время приготовления может быть null."""
        dish = Dish.objects.create(
            coach=coach,
            name='Блюдо без времени',
            cooking_time=None,
        )
        assert dish.cooking_time is None

    def test_tag_relationship_dishes(self, dish_with_tags, dish_tag):
        """Тест обратной связи: тег → блюда."""
        dishes_with_tag = dish_tag.dishes.all()
        assert dish_with_tags in dishes_with_tag
