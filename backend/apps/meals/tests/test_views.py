"""Unit тесты для API endpoints: Product, DishTag, Dish ViewSets."""

import pytest
from decimal import Decimal
from django.urls import reverse
from django.db import connection

from apps.meals.models import Product, DishTag, Dish


def is_postgresql():
    """Проверяет, используется ли PostgreSQL."""
    return connection.vendor == 'postgresql'


# ============================================================================
# PRODUCT API TESTS
# ============================================================================

@pytest.mark.django_db
class TestProductAPI:
    """Тесты API продуктов."""

    def test_list_products(self, authenticated_client, product, another_product):
        """Тест получения списка продуктов."""
        response = authenticated_client.get('/api/meals/products/')

        assert response.status_code == 200
        assert response.data['count'] == 2
        names = [p['name'] for p in response.data['results']]
        assert 'Куриная грудка' in names
        assert 'Рис белый' in names

    def test_list_products_unauthenticated(self, api_client):
        """Тест: неаутентифицированный запрос отклоняется."""
        response = api_client.get('/api/meals/products/')
        assert response.status_code == 401

    def test_list_products_filter_by_category(self, authenticated_client, product, another_product, vegetable_product):
        """Тест фильтрации продуктов по категории."""
        response = authenticated_client.get('/api/meals/products/?category=meat')

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert response.data['results'][0]['name'] == 'Куриная грудка'

    def test_list_products_search(self, authenticated_client, coach):
        """Тест поиска продуктов по названию."""
        # Создаём продукты с латинскими названиями для теста поиска
        Product.objects.create(
            coach=coach, name='Apple', calories_per_100g=52,
            proteins_per_100g=0.3, fats_per_100g=0.2, carbs_per_100g=14,
        )
        Product.objects.create(
            coach=coach, name='Banana', calories_per_100g=89,
            proteins_per_100g=1.1, fats_per_100g=0.3, carbs_per_100g=23,
        )

        response = authenticated_client.get('/api/meals/products/?search=apple')

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert response.data['results'][0]['name'] == 'Apple'

    def test_products_isolation(self, authenticated_client, another_authenticated_client, product, another_coach):
        """Тест: коуч видит только свои продукты."""
        # Создаём продукт другого коуча
        Product.objects.create(
            coach=another_coach,
            name='Продукт другого коуча',
            calories_per_100g=100,
            proteins_per_100g=10,
            fats_per_100g=5,
            carbs_per_100g=15,
        )

        # Первый коуч видит только свой продукт
        response = authenticated_client.get('/api/meals/products/')
        assert response.data['count'] == 1
        assert response.data['results'][0]['name'] == 'Куриная грудка'

        # Второй коуч видит только свой продукт
        response2 = another_authenticated_client.get('/api/meals/products/')
        assert response2.data['count'] == 1
        assert response2.data['results'][0]['name'] == 'Продукт другого коуча'

    def test_create_product(self, authenticated_client):
        """Тест создания продукта."""
        data = {
            'name': 'Творог 5%',
            'calories_per_100g': '121.00',
            'proteins_per_100g': '17.20',
            'fats_per_100g': '5.00',
            'carbs_per_100g': '1.80',
            'category': 'dairy',
        }
        response = authenticated_client.post('/api/meals/products/', data)

        assert response.status_code == 201
        assert response.data['name'] == 'Творог 5%'
        assert response.data['category'] == 'dairy'
        assert Product.objects.filter(name='Творог 5%').exists()

    def test_create_product_sets_coach(self, authenticated_client):
        """Тест: при создании продукта автоматически устанавливается коуч."""
        data = {
            'name': 'Тестовый продукт',
            'calories_per_100g': '100',
            'proteins_per_100g': '10',
            'fats_per_100g': '5',
            'carbs_per_100g': '15',
        }
        response = authenticated_client.post('/api/meals/products/', data)

        assert response.status_code == 201
        product = Product.objects.get(id=response.data['id'])
        assert product.coach == authenticated_client._coach

    def test_create_product_validation_negative_calories(self, authenticated_client):
        """Тест валидации: отрицательные калории."""
        data = {
            'name': 'Тестовый продукт',
            'calories_per_100g': '-10',
            'proteins_per_100g': '10',
            'fats_per_100g': '5',
            'carbs_per_100g': '15',
        }
        response = authenticated_client.post('/api/meals/products/', data)
        assert response.status_code == 400

    def test_retrieve_product(self, authenticated_client, product):
        """Тест получения продукта по ID."""
        response = authenticated_client.get(f'/api/meals/products/{product.id}/')

        assert response.status_code == 200
        assert response.data['name'] == 'Куриная грудка'
        assert float(response.data['calories_per_100g']) == 165.0

    def test_retrieve_other_coach_product(self, authenticated_client, another_coach):
        """Тест: нельзя получить продукт другого коуча."""
        other_product = Product.objects.create(
            coach=another_coach,
            name='Чужой продукт',
            calories_per_100g=100,
            proteins_per_100g=10,
            fats_per_100g=5,
            carbs_per_100g=15,
        )
        response = authenticated_client.get(f'/api/meals/products/{other_product.id}/')
        assert response.status_code == 404

    def test_update_product(self, authenticated_client, product):
        """Тест обновления продукта."""
        data = {'name': 'Куриное филе', 'calories_per_100g': '170'}
        response = authenticated_client.patch(f'/api/meals/products/{product.id}/', data)

        assert response.status_code == 200
        product.refresh_from_db()
        assert product.name == 'Куриное филе'
        assert product.calories_per_100g == Decimal('170.00')

    def test_delete_product(self, authenticated_client, product):
        """Тест удаления продукта."""
        product_id = product.id
        response = authenticated_client.delete(f'/api/meals/products/{product_id}/')

        assert response.status_code == 204
        assert not Product.objects.filter(id=product_id).exists()

    def test_search_action(self, authenticated_client, coach):
        """Тест action search для автокомплита."""
        # Создаём продукты с латинскими названиями
        Product.objects.create(
            coach=coach, name='Chicken breast', calories_per_100g=165,
            proteins_per_100g=31, fats_per_100g=3.6, carbs_per_100g=0,
        )
        Product.objects.create(
            coach=coach, name='Rice', calories_per_100g=130,
            proteins_per_100g=2.7, fats_per_100g=0.3, carbs_per_100g=28,
        )

        response = authenticated_client.get('/api/meals/products/search/?q=chick')

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'Chicken breast'

    def test_search_action_min_length(self, authenticated_client, product):
        """Тест: search требует минимум 2 символа."""
        response = authenticated_client.get('/api/meals/products/search/?q=к')

        assert response.status_code == 200
        assert len(response.data) == 0


# ============================================================================
# DISH TAG API TESTS
# ============================================================================

@pytest.mark.django_db
class TestDishTagAPI:
    """Тесты API тегов блюд."""

    def test_list_tags(self, authenticated_client, dish_tag, another_dish_tag):
        """Тест получения списка тегов."""
        response = authenticated_client.get('/api/meals/dish-tags/')

        assert response.status_code == 200
        # API возвращает список напрямую (без пагинации) или пагинированный ответ
        if isinstance(response.data, list):
            assert len(response.data) == 2
        else:
            assert len(response.data['results']) == 2

    def test_tags_isolation(self, authenticated_client, another_authenticated_client, dish_tag, another_coach):
        """Тест: коуч видит только свои теги."""
        DishTag.objects.create(coach=another_coach, name='Other tag')

        response = authenticated_client.get('/api/meals/dish-tags/')
        # API возвращает список напрямую (без пагинации) или пагинированный ответ
        if isinstance(response.data, list):
            assert len(response.data) == 1
            assert response.data[0]['name'] == 'Низкоуглеводные'
        else:
            assert len(response.data['results']) == 1
            assert response.data['results'][0]['name'] == 'Низкоуглеводные'

    def test_create_tag(self, authenticated_client):
        """Тест создания тега."""
        data = {'name': 'Веганские', 'color': '#16A34A'}
        response = authenticated_client.post('/api/meals/dish-tags/', data)

        assert response.status_code == 201
        assert response.data['name'] == 'Веганские'
        assert response.data['color'] == '#16A34A'

    def test_create_tag_default_color(self, authenticated_client):
        """Тест: тег создаётся с цветом по умолчанию."""
        data = {'name': 'Простые рецепты'}
        response = authenticated_client.post('/api/meals/dish-tags/', data)

        assert response.status_code == 201
        assert response.data['color'] == '#3B82F6'

    def test_update_tag(self, authenticated_client, dish_tag):
        """Тест обновления тега."""
        data = {'color': '#EF4444'}
        response = authenticated_client.patch(f'/api/meals/dish-tags/{dish_tag.id}/', data)

        assert response.status_code == 200
        dish_tag.refresh_from_db()
        assert dish_tag.color == '#EF4444'

    def test_delete_tag(self, authenticated_client, dish_tag):
        """Тест удаления тега."""
        tag_id = dish_tag.id
        response = authenticated_client.delete(f'/api/meals/dish-tags/{tag_id}/')

        assert response.status_code == 204
        assert not DishTag.objects.filter(id=tag_id).exists()


# ============================================================================
# DISH API TESTS
# ============================================================================

@pytest.mark.django_db
class TestDishAPI:
    """Тесты API блюд."""

    def test_list_dishes(self, authenticated_client, dish):
        """Тест получения списка блюд."""
        response = authenticated_client.get('/api/meals/dishes/')

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert response.data['results'][0]['name'] == 'Куриная грудка с рисом'

    def test_list_dishes_excludes_archived(self, authenticated_client, dish, archived_dish):
        """Тест: архивированные блюда не показываются по умолчанию."""
        response = authenticated_client.get('/api/meals/dishes/')

        assert response.data['count'] == 1
        names = [d['name'] for d in response.data['results']]
        assert 'Куриная грудка с рисом' in names
        assert 'Старый рецепт' not in names

    def test_list_dishes_show_archived(self, authenticated_client, dish, archived_dish):
        """Тест: можно показать архивированные блюда."""
        response = authenticated_client.get('/api/meals/dishes/?show_archived=true')

        assert response.data['count'] == 2

    @pytest.mark.skipif(not is_postgresql(), reason='JSON contains lookup requires PostgreSQL')
    def test_list_dishes_filter_by_meal_type(self, authenticated_client, dish, coach):
        """Тест фильтрации по типу приёма пищи."""
        # Создаём блюдо только для завтрака
        Dish.objects.create(
            coach=coach,
            name='Овсянка',
            meal_types=['breakfast'],
        )

        response = authenticated_client.get('/api/meals/dishes/?meal_type=breakfast')

        assert response.data['count'] == 1
        assert response.data['results'][0]['name'] == 'Овсянка'

    def test_list_dishes_filter_by_tags(self, authenticated_client, dish_with_tags, dish_tag):
        """Тест фильтрации по тегам."""
        response = authenticated_client.get(f'/api/meals/dishes/?tags={dish_tag.id}')

        assert response.data['count'] == 1
        assert response.data['results'][0]['name'] == 'Куриная грудка с рисом'

    def test_list_dishes_search(self, authenticated_client, coach):
        """Тест поиска блюд."""
        # Создаём блюда с латинскими названиями для теста поиска
        Dish.objects.create(coach=coach, name='Chicken with rice')
        Dish.objects.create(coach=coach, name='Vegetable salad')

        response = authenticated_client.get('/api/meals/dishes/?search=chicken')

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert response.data['results'][0]['name'] == 'Chicken with rice'

    def test_dishes_isolation(self, authenticated_client, another_authenticated_client, dish, another_coach):
        """Тест: коуч видит только свои блюда."""
        Dish.objects.create(coach=another_coach, name='Чужое блюдо')

        response = authenticated_client.get('/api/meals/dishes/')
        assert response.data['count'] == 1
        assert response.data['results'][0]['name'] == 'Куриная грудка с рисом'

    def test_create_dish(self, authenticated_client):
        """Тест создания блюда."""
        data = {
            'name': 'Овощной салат',
            'description': 'Свежий и лёгкий',
            'portion_weight': 200,
            'calories': '150.00',
            'proteins': '5.00',
            'fats': '8.00',
            'carbohydrates': '15.00',
            'meal_types': ['lunch', 'dinner'],
        }
        response = authenticated_client.post('/api/meals/dishes/', data, format='json')

        assert response.status_code == 201
        assert response.data['name'] == 'Овощной салат'
        assert Dish.objects.filter(name='Овощной салат').exists()

    def test_create_dish_with_ingredients(self, authenticated_client):
        """Тест создания блюда с ингредиентами."""
        data = {
            'name': 'Тестовое блюдо',
            'ingredients': [
                {'name': 'Курица', 'weight': 100, 'calories': 165, 'proteins': 31, 'fats': 3.6, 'carbohydrates': 0},
            ],
        }
        response = authenticated_client.post('/api/meals/dishes/', data, format='json')

        assert response.status_code == 201
        assert len(response.data['ingredients']) == 1
        assert response.data['ingredients'][0]['name'] == 'Курица'

    def test_create_dish_with_tags(self, authenticated_client, dish_tag, another_dish_tag):
        """Тест создания блюда с тегами."""
        data = {
            'name': 'Блюдо с тегами',
            'tag_ids': [dish_tag.id, another_dish_tag.id],
        }
        response = authenticated_client.post('/api/meals/dishes/', data, format='json')

        assert response.status_code == 201
        assert len(response.data['tags']) == 2

    def test_retrieve_dish(self, authenticated_client, dish):
        """Тест получения блюда по ID."""
        response = authenticated_client.get(f'/api/meals/dishes/{dish.id}/')

        assert response.status_code == 200
        assert response.data['name'] == 'Куриная грудка с рисом'
        assert response.data['recipe'] == '1. Отварить рис\n2. Обжарить курицу\n3. Подать вместе'
        assert len(response.data['ingredients']) == 2

    def test_update_dish(self, authenticated_client, dish):
        """Тест обновления блюда."""
        data = {'name': 'Куриная грудка с бурым рисом', 'cooking_time': 45}
        response = authenticated_client.patch(f'/api/meals/dishes/{dish.id}/', data, format='json')

        assert response.status_code == 200
        dish.refresh_from_db()
        assert dish.name == 'Куриная грудка с бурым рисом'
        assert dish.cooking_time == 45

    def test_update_dish_tags(self, authenticated_client, dish, dish_tag):
        """Тест обновления тегов блюда."""
        data = {'tag_ids': [dish_tag.id]}
        response = authenticated_client.patch(f'/api/meals/dishes/{dish.id}/', data, format='json')

        assert response.status_code == 200
        dish.refresh_from_db()
        assert dish_tag in dish.tags.all()

    def test_delete_dish(self, authenticated_client, dish):
        """Тест удаления блюда."""
        dish_id = dish.id
        response = authenticated_client.delete(f'/api/meals/dishes/{dish_id}/')

        assert response.status_code == 204
        assert not Dish.objects.filter(id=dish_id).exists()

    def test_duplicate_dish(self, authenticated_client, dish_with_tags):
        """Тест дублирования блюда."""
        response = authenticated_client.post(f'/api/meals/dishes/{dish_with_tags.id}/duplicate/')

        assert response.status_code == 201
        assert response.data['name'] == 'Куриная грудка с рисом (копия)'
        assert response.data['id'] != dish_with_tags.id

        # Проверяем что теги тоже скопировались
        new_dish = Dish.objects.get(id=response.data['id'])
        assert new_dish.tags.count() == dish_with_tags.tags.count()

    def test_duplicate_dish_copies_ingredients(self, authenticated_client, dish):
        """Тест: при дублировании копируются ингредиенты."""
        response = authenticated_client.post(f'/api/meals/dishes/{dish.id}/duplicate/')

        assert response.status_code == 201
        new_dish = Dish.objects.get(id=response.data['id'])
        assert len(new_dish.ingredients) == len(dish.ingredients)

    def test_archive_dish(self, authenticated_client, dish):
        """Тест архивирования блюда."""
        response = authenticated_client.post(f'/api/meals/dishes/{dish.id}/archive/')

        assert response.status_code == 200
        assert response.data['status'] == 'archived'

        dish.refresh_from_db()
        assert dish.is_active is False

    def test_archived_dish_not_in_default_list(self, authenticated_client, dish):
        """Тест: после архивации блюдо не показывается в списке."""
        authenticated_client.post(f'/api/meals/dishes/{dish.id}/archive/')

        response = authenticated_client.get('/api/meals/dishes/')
        assert response.data['count'] == 0

    def test_cannot_access_other_coach_dish(self, authenticated_client, another_coach):
        """Тест: нельзя получить доступ к блюду другого коуча."""
        other_dish = Dish.objects.create(coach=another_coach, name='Чужое блюдо')

        response = authenticated_client.get(f'/api/meals/dishes/{other_dish.id}/')
        assert response.status_code == 404

    def test_cannot_duplicate_other_coach_dish(self, authenticated_client, another_coach):
        """Тест: нельзя дублировать блюдо другого коуча."""
        other_dish = Dish.objects.create(coach=another_coach, name='Чужое блюдо')

        response = authenticated_client.post(f'/api/meals/dishes/{other_dish.id}/duplicate/')
        assert response.status_code == 404

    def test_cannot_archive_other_coach_dish(self, authenticated_client, another_coach):
        """Тест: нельзя архивировать блюдо другого коуча."""
        other_dish = Dish.objects.create(coach=another_coach, name='Чужое блюдо')

        response = authenticated_client.post(f'/api/meals/dishes/{other_dish.id}/archive/')
        assert response.status_code == 404

    def test_dish_list_uses_compact_serializer(self, authenticated_client, dish):
        """Тест: список возвращает компактные данные (без recipe)."""
        response = authenticated_client.get('/api/meals/dishes/')

        # В списке не должно быть полного рецепта
        assert 'recipe' not in response.data['results'][0]
        # Но должны быть базовые поля
        assert 'name' in response.data['results'][0]
        assert 'calories' in response.data['results'][0]

    def test_dish_detail_uses_full_serializer(self, authenticated_client, dish):
        """Тест: детальный запрос возвращает полные данные."""
        response = authenticated_client.get(f'/api/meals/dishes/{dish.id}/')

        assert 'recipe' in response.data
        assert 'ingredients' in response.data
        assert 'shopping_links' in response.data
