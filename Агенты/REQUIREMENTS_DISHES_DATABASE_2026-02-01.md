# REQUIREMENTS: База данных блюд коуча
# Дата создания: 2026-02-01
# Аналитик: Business Analyst
# Статус: Готово к разработке

---

## КРАТКОЕ ОПИСАНИЕ

Функциональность для создания и управления личной базой данных блюд коуча. Коуч создаёт блюда с рецептами, КБЖУ, ингредиентами и фото, структурирует их по категориям и тегам, затем быстро добавляет в программы питания клиентов. Блюдо — переиспользуемая сущность, которую можно включать в любые программы и дни.

---

## ЦЕЛЕВЫЕ ПОЛЬЗОВАТЕЛИ

### Тренеры (Коучи)
- **Основная потребность**: Быстро составлять программы питания из готовых проверенных блюд
- **Сценарии использования**:
  - Создание библиотеки блюд с детальными рецептами
  - Организация блюд по категориям и тегам
  - Быстрый поиск и добавление блюд в программы питания
  - Повторное использование блюд для разных клиентов

### Клиенты (в будущем, через MiniApp)
- **Потенциальная потребность**: Просмотр рецептов назначенных блюд
- **Статус**: Could Have (не входит в текущий scope)

---

## ОСНОВНЫЕ ФУНКЦИИ

### КРИТИЧЕСКИ ВАЖНЫЕ (Must Have)

#### 1. Модель данных "Блюдо" (Dish)
**Зачем**: Основная сущность для хранения информации о блюде

**Поля блюда**:
- `name` — название блюда
- `description` — краткое описание
- `recipe` — полный рецепт приготовления (текст, markdown)
- `calories`, `proteins`, `fats`, `carbohydrates` — КБЖУ на порцию
- `portion_weight` — вес порции в граммах
- `cooking_time` — время приготовления (минуты)
- `photo` — фото блюда (URL на внешнем хранилище)
- `video_url` — ссылка на видео с рецептом (YouTube и др.)
- `ingredients` — JSON список ингредиентов с КБЖУ
- `shopping_links` — JSON список ссылок на покупку продуктов
- `meal_types` — типы приёмов пищи (завтрак, обед, ужин, перекус)
- `tags` — теги для поиска и фильтрации
- `coach` — владелец блюда (FK → Coach)
- `is_active` — активно/архивировано
- `created_at`, `updated_at` — временные метки

#### 2. Модель данных "Продукт" (Product)
**Зачем**: База продуктов коуча для переиспользования в разных блюдах

**Поля продукта**:
- `name` — название продукта
- `calories_per_100g`, `proteins_per_100g`, `fats_per_100g`, `carbs_per_100g` — КБЖУ на 100г
- `category` — категория (молочные, мясо, овощи, крупы, фрукты, и др.)
- `coach` — владелец (FK → Coach)
- `is_verified` — проверено AI / подтверждено коучем
- `created_at`, `updated_at`

#### 3. Модель данных "Тег" (DishTag)
**Зачем**: Гибкая система категоризации блюд

**Поля**:
- `name` — название тега
- `color` — цвет для отображения (hex)
- `coach` — владелец (FK → Coach)

#### 4. CRUD операции для блюд
**Зачем**: Базовые операции управления блюдами

- Создание нового блюда
- Просмотр списка блюд с пагинацией
- Редактирование блюда
- Удаление/архивирование блюда
- Дублирование блюда

#### 5. CRUD операции для продуктов
**Зачем**: Управление базой продуктов

- Создание продукта с КБЖУ
- Просмотр списка продуктов
- Редактирование продукта
- Удаление продукта

#### 6. Страница "База данных блюд" в консоли
**Зачем**: Центральное место управления блюдами

**Расположение**: Раздел "Программы питания" → вкладка "База блюд"

**Компоненты**:
- Список блюд с карточками (фото, название, КБЖУ)
- Поиск по названию
- Фильтры по типу приёма пищи и тегам
- Сортировка (по дате, названию, калориям)
- Кнопка создания нового блюда

#### 7. Форма создания/редактирования блюда
**Зачем**: Удобный интерфейс для работы с блюдами

**Секции формы**:
1. **Основная информация**: название, описание, фото
2. **Ингредиенты**: список с возможностью добавления из базы продуктов
3. **КБЖУ**: автоматический расчёт + ручная корректировка
4. **Рецепт**: текстовый редактор с форматированием
5. **Категоризация**: тип приёма пищи, теги
6. **Ссылки**: видео рецепта, ссылки на покупку продуктов

#### 8. Интеграция с редактором программ питания
**Зачем**: Быстрое добавление блюд в программы

**Механизмы**:
- Кнопка "Добавить из базы" в редакторе дня программы
- Модальное окно выбора блюда с поиском и фильтрами
- Drag-and-drop блюда в день программы (Should Have)
- При добавлении блюда в программу — копируется описание и КБЖУ

---

### ВАЖНЫЕ (Should Have)

#### 9. AI-помощь при создании блюда
**Зачем**: Ускорение создания блюд и точность данных

**Функции**:
- **Генерация рецепта**: по названию блюда AI предлагает рецепт
- **Расчёт КБЖУ**: по списку ингредиентов AI рассчитывает итоговое КБЖУ
- **Подсказки ингредиентов**: автокомплит при вводе с подсказкой КБЖУ
- **Генерация описания**: краткое описание блюда по названию

**Провайдер**: OpenAI GPT-4o

#### 10. AI-помощь при создании продукта
**Зачем**: Быстрое добавление продуктов с корректным КБЖУ

- При вводе названия продукта AI подсказывает КБЖУ на 100г
- Коуч может скорректировать значения
- Флаг `is_verified` после подтверждения коучем

#### 11. Drag-and-drop в редакторе программ
**Зачем**: Удобное перетаскивание блюд в программу

- Панель с блюдами сбоку редактора программы
- Перетаскивание блюда в конкретный приём пищи дня
- Визуальная обратная связь при перетаскивании

#### 12. Импорт/экспорт блюд
**Зачем**: Резервное копирование и миграция данных

- Экспорт базы блюд в JSON/CSV
- Импорт блюд из файла

#### 13. Быстрое создание блюда из программы
**Зачем**: Сохранение удачных блюд из существующих программ

- В редакторе программы: кнопка "Сохранить в базу" для приёма пищи
- Автоматическое заполнение полей из данных программы

---

### ЖЕЛАТЕЛЬНЫЕ (Could Have)

#### 14. Общая библиотека блюд платформы
- Базовый набор блюд, доступный всем коучам
- Возможность скопировать блюдо из общей библиотеки в свою базу

#### 15. Просмотр рецептов в MiniApp
- Клиент может посмотреть рецепт назначенного блюда
- Список ингредиентов для покупки

#### 16. Статистика использования блюд
- Сколько раз блюдо использовано в программах
- Популярность блюд у клиентов

#### 17. Версионирование блюд
- История изменений блюда
- Возможность откатить к предыдущей версии

---

## ТЕХНИЧЕСКИЕ КОМПОНЕНТЫ

### Backend (Django)

#### Models (`backend/apps/meals/models.py`)

```python
class Product(models.Model):
    """База продуктов коуча"""
    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=255)

    # КБЖУ на 100г
    calories_per_100g = models.DecimalField(max_digits=7, decimal_places=2)
    proteins_per_100g = models.DecimalField(max_digits=6, decimal_places=2)
    fats_per_100g = models.DecimalField(max_digits=6, decimal_places=2)
    carbs_per_100g = models.DecimalField(max_digits=6, decimal_places=2)

    category = models.CharField(max_length=50, choices=PRODUCT_CATEGORIES)
    is_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['coach', 'name']
        ordering = ['name']


class DishTag(models.Model):
    """Теги для категоризации блюд"""
    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='dish_tags')
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=7, default='#3B82F6')  # hex color

    class Meta:
        unique_together = ['coach', 'name']
        ordering = ['name']


class Dish(models.Model):
    """Блюдо в базе данных коуча"""
    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='dishes')

    # Основная информация
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    recipe = models.TextField(blank=True)  # Markdown

    # КБЖУ на порцию
    portion_weight = models.PositiveIntegerField(help_text='Вес порции в граммах')
    calories = models.DecimalField(max_digits=7, decimal_places=2)
    proteins = models.DecimalField(max_digits=6, decimal_places=2)
    fats = models.DecimalField(max_digits=6, decimal_places=2)
    carbohydrates = models.DecimalField(max_digits=6, decimal_places=2)

    # Время приготовления
    cooking_time = models.PositiveIntegerField(null=True, blank=True, help_text='Минуты')

    # Медиа
    photo = models.ImageField(upload_to='dishes/%Y/%m/', blank=True, null=True)
    video_url = models.URLField(blank=True)

    # Ингредиенты (JSON)
    # [{"product_id": 1, "name": "Куриная грудка", "weight": 150, "calories": 165, "proteins": 31, "fats": 3.6, "carbs": 0}]
    ingredients = models.JSONField(default=list)

    # Ссылки на покупку (JSON)
    # [{"title": "Ozon", "url": "https://..."}]
    shopping_links = models.JSONField(default=list)

    # Категоризация
    meal_types = models.JSONField(default=list)  # ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2']
    tags = models.ManyToManyField(DishTag, blank=True, related_name='dishes')

    # Статус
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Блюдо'
        verbose_name_plural = 'Блюда'

    def recalculate_nutrition(self):
        """Пересчёт КБЖУ по ингредиентам"""
        totals = {'calories': 0, 'proteins': 0, 'fats': 0, 'carbs': 0}
        for ing in self.ingredients:
            totals['calories'] += ing.get('calories', 0)
            totals['proteins'] += ing.get('proteins', 0)
            totals['fats'] += ing.get('fats', 0)
            totals['carbs'] += ing.get('carbohydrates', ing.get('carbs', 0))

        self.calories = totals['calories']
        self.proteins = totals['proteins']
        self.fats = totals['fats']
        self.carbohydrates = totals['carbs']
```

#### API Endpoints (`backend/apps/meals/views.py`)

```
# Блюда
GET    /api/dishes/                    # Список блюд с фильтрами и поиском
POST   /api/dishes/                    # Создание блюда
GET    /api/dishes/{id}/               # Детали блюда
PATCH  /api/dishes/{id}/               # Обновление блюда
DELETE /api/dishes/{id}/               # Удаление блюда
POST   /api/dishes/{id}/duplicate/     # Дублирование блюда
POST   /api/dishes/{id}/archive/       # Архивирование блюда

# Продукты
GET    /api/products/                  # Список продуктов
POST   /api/products/                  # Создание продукта
GET    /api/products/{id}/             # Детали продукта
PATCH  /api/products/{id}/             # Обновление продукта
DELETE /api/products/{id}/             # Удаление продукта
GET    /api/products/search/           # Поиск продуктов (автокомплит)

# Теги
GET    /api/dish-tags/                 # Список тегов
POST   /api/dish-tags/                 # Создание тега
PATCH  /api/dish-tags/{id}/            # Обновление тега
DELETE /api/dish-tags/{id}/            # Удаление тега

# AI помощь
POST   /api/dishes/ai/generate-recipe/      # Генерация рецепта по названию
POST   /api/dishes/ai/calculate-nutrition/  # Расчёт КБЖУ по ингредиентам
POST   /api/dishes/ai/suggest-description/  # Генерация описания
POST   /api/products/ai/suggest-nutrition/  # Подсказка КБЖУ для продукта
```

#### Serializers

```python
class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'calories_per_100g', 'proteins_per_100g',
                  'fats_per_100g', 'carbs_per_100g', 'category', 'is_verified']

class DishTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = DishTag
        fields = ['id', 'name', 'color']

class DishListSerializer(serializers.ModelSerializer):
    """Для списка блюд (компактный)"""
    tags = DishTagSerializer(many=True, read_only=True)

    class Meta:
        model = Dish
        fields = ['id', 'name', 'photo', 'calories', 'proteins', 'fats',
                  'carbohydrates', 'meal_types', 'tags', 'updated_at']

class DishDetailSerializer(serializers.ModelSerializer):
    """Для детального просмотра/редактирования"""
    tags = DishTagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Dish
        fields = '__all__'
        read_only_fields = ['coach', 'created_at', 'updated_at']
```

#### Background Tasks (Celery)

```python
# Генерация миниатюры фото блюда
@shared_task
def generate_dish_thumbnail(dish_id: int):
    """Создаёт миниатюру 300x300 для карточки блюда"""
    pass

# Пересчёт КБЖУ при изменении продукта
@shared_task
def recalculate_dishes_nutrition(product_id: int):
    """Пересчитывает КБЖУ всех блюд с этим продуктом"""
    pass
```

#### AI Services (`backend/apps/meals/ai_services.py`)

```python
async def generate_recipe(dish_name: str) -> dict:
    """Генерирует рецепт по названию блюда через OpenAI"""
    pass

async def calculate_nutrition_from_ingredients(ingredients: list) -> dict:
    """Рассчитывает КБЖУ по списку ингредиентов"""
    pass

async def suggest_product_nutrition(product_name: str) -> dict:
    """Подсказывает КБЖУ продукта на 100г"""
    pass

async def suggest_dish_description(dish_name: str) -> str:
    """Генерирует краткое описание блюда"""
    pass
```

---

### Frontend Console (React)

#### Pages

```
frontend/console/src/pages/
├── dishes/
│   ├── DishesDatabase.tsx      # Главная страница базы блюд
│   ├── DishForm.tsx            # Форма создания/редактирования
│   └── DishCard.tsx            # Карточка блюда в списке
├── products/
│   ├── ProductsDatabase.tsx    # Страница базы продуктов
│   └── ProductForm.tsx         # Форма продукта
```

#### Components

```
frontend/console/src/components/
├── dishes/
│   ├── DishSelector.tsx        # Модальное окно выбора блюда
│   ├── DishPreview.tsx         # Превью блюда в программе
│   ├── IngredientInput.tsx     # Ввод ингредиента с автокомплитом
│   ├── IngredientsTable.tsx    # Таблица ингредиентов с КБЖУ
│   ├── NutritionSummary.tsx    # Сводка КБЖУ блюда
│   ├── TagsInput.tsx           # Ввод тегов
│   ├── MealTypeSelector.tsx    # Выбор типов приёма пищи
│   └── ShoppingLinksInput.tsx  # Ввод ссылок на покупку
├── products/
│   ├── ProductAutocomplete.tsx # Автокомплит продуктов
│   └── ProductQuickAdd.tsx     # Быстрое добавление продукта
```

#### State Management (Zustand)

```typescript
// stores/dishesStore.ts
interface DishesStore {
  dishes: Dish[];
  products: Product[];
  tags: DishTag[];
  filters: DishFilters;

  // Actions
  fetchDishes: () => Promise<void>;
  createDish: (data: DishFormData) => Promise<Dish>;
  updateDish: (id: number, data: Partial<DishFormData>) => Promise<void>;
  deleteDish: (id: number) => Promise<void>;

  setFilters: (filters: DishFilters) => void;
  searchDishes: (query: string) => void;
}
```

#### API Client (`frontend/console/src/api/dishes.ts`)

```typescript
export const dishesApi = {
  // Блюда
  list: (params?: DishListParams) => api.get('/dishes/', { params }),
  get: (id: number) => api.get(`/dishes/${id}/`),
  create: (data: DishFormData) => api.post('/dishes/', data),
  update: (id: number, data: Partial<DishFormData>) => api.patch(`/dishes/${id}/`, data),
  delete: (id: number) => api.delete(`/dishes/${id}/`),
  duplicate: (id: number) => api.post(`/dishes/${id}/duplicate/`),

  // AI
  generateRecipe: (name: string) => api.post('/dishes/ai/generate-recipe/', { name }),
  calculateNutrition: (ingredients: Ingredient[]) => api.post('/dishes/ai/calculate-nutrition/', { ingredients }),
  suggestDescription: (name: string) => api.post('/dishes/ai/suggest-description/', { name }),
};

export const productsApi = {
  list: (params?: ProductListParams) => api.get('/products/', { params }),
  search: (query: string) => api.get('/products/search/', { params: { q: query } }),
  create: (data: ProductFormData) => api.post('/products/', data),
  update: (id: number, data: Partial<ProductFormData>) => api.patch(`/products/${id}/`, data),
  delete: (id: number) => api.delete(`/products/${id}/`),

  // AI
  suggestNutrition: (name: string) => api.post('/products/ai/suggest-nutrition/', { name }),
};
```

#### Types (`frontend/console/src/types/dishes.ts`)

```typescript
interface Dish {
  id: number;
  name: string;
  description: string;
  recipe: string;
  portion_weight: number;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  cooking_time: number | null;
  photo: string | null;
  video_url: string;
  ingredients: Ingredient[];
  shopping_links: ShoppingLink[];
  meal_types: MealType[];
  tags: DishTag[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Ingredient {
  product_id?: number;
  name: string;
  weight: number;  // граммы
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
}

interface Product {
  id: number;
  name: string;
  calories_per_100g: number;
  proteins_per_100g: number;
  fats_per_100g: number;
  carbs_per_100g: number;
  category: ProductCategory;
  is_verified: boolean;
}

interface DishTag {
  id: number;
  name: string;
  color: string;
}

interface ShoppingLink {
  title: string;
  url: string;
}

type MealType = 'breakfast' | 'snack1' | 'lunch' | 'snack2' | 'dinner';

type ProductCategory = 'dairy' | 'meat' | 'fish' | 'vegetables' | 'fruits' | 'grains' | 'nuts' | 'oils' | 'spices' | 'other';
```

---

### Database

#### New Tables

1. **meals_product** — база продуктов коуча
2. **meals_dishtag** — теги блюд
3. **meals_dish** — блюда
4. **meals_dish_tags** — связь M2M блюд и тегов

#### Indexes

```sql
CREATE INDEX idx_dish_coach ON meals_dish(coach_id);
CREATE INDEX idx_dish_name ON meals_dish(name);
CREATE INDEX idx_dish_is_active ON meals_dish(is_active);
CREATE INDEX idx_dish_updated ON meals_dish(updated_at DESC);

CREATE INDEX idx_product_coach ON meals_product(coach_id);
CREATE INDEX idx_product_name ON meals_product(name);
CREATE INDEX idx_product_category ON meals_product(category);

CREATE INDEX idx_dishtag_coach ON meals_dishtag(coach_id);
```

---

### AI Integration

#### OpenAI Usage

1. **Генерация рецепта** — GPT-4o, ~500-1000 tokens output
2. **Расчёт КБЖУ** — GPT-4o, ~200 tokens output
3. **Подсказка КБЖУ продукта** — GPT-4o, ~100 tokens output
4. **Генерация описания** — GPT-4o, ~100 tokens output

#### Prompts

**Генерация рецепта**:
```
Ты — профессиональный нутрициолог. Напиши подробный рецепт блюда "{dish_name}".

Формат ответа (JSON):
{
  "ingredients": [{"name": "...", "weight": 100}],
  "recipe": "Пошаговый рецепт...",
  "cooking_time": 30,
  "portion_weight": 300
}

Учитывай: здоровое питание, доступные продукты, простота приготовления.
```

**Расчёт КБЖУ**:
```
Рассчитай КБЖУ для блюда из следующих ингредиентов:
{ingredients_list}

Верни JSON: {"calories": X, "proteins": X, "fats": X, "carbohydrates": X}
```

**Подсказка КБЖУ продукта**:
```
Укажи КБЖУ на 100г для продукта: "{product_name}"

Верни JSON: {"calories": X, "proteins": X, "fats": X, "carbs": X}
Используй средние значения для типичного продукта.
```

---

## SECURITY & COMPLIANCE

### Health Data
- Данные о питании считаются чувствительными
- Хранение только на серверах внутри ЕС (Railway EU region)

### GDPR Requirements
- Право на удаление: коуч может удалить все свои блюда
- Право на экспорт: функция экспорта базы блюд

### Access Control
- Коуч видит только свои блюда и продукты
- Проверка `coach_id` на уровне API (ViewSet queryset)
- Нет доступа к блюдам других коучей

### Data Encryption
- Фото блюд хранятся на Cloudflare R2 с шифрованием at rest
- HTTPS для всех API запросов

---

## КЛЮЧЕВЫЕ СЦЕНАРИИ ИСПОЛЬЗОВАНИЯ

### Сценарий 1: Создание нового блюда

**Пользователь**: Коуч
**Входная точка**: Программы питания → База блюд → "Добавить блюдо"

**Шаги**:
1. Коуч нажимает "Добавить блюдо"
2. Система открывает форму создания
3. Коуч вводит название блюда
4. Коуч нажимает "Сгенерировать рецепт" (AI)
5. Система генерирует рецепт, ингредиенты, КБЖУ
6. Коуч корректирует данные при необходимости
7. Коуч загружает фото блюда
8. Коуч выбирает типы приёмов пищи и теги
9. Коуч сохраняет блюдо
10. Система добавляет блюдо в базу

**Edge Cases**:
- AI не может сгенерировать рецепт → показываем ошибку, коуч вводит вручную
- Фото слишком большое → сжимаем на клиенте перед загрузкой
- Дубликат названия → предупреждаем, но разрешаем сохранить

### Сценарий 2: Добавление блюда в программу питания

**Пользователь**: Коуч
**Входная точка**: Редактор программы питания → День → Приём пищи

**Шаги**:
1. Коуч редактирует программу питания
2. В конкретном дне нажимает "Добавить из базы" у приёма пищи
3. Система открывает модальное окно с базой блюд
4. Коуч использует поиск/фильтры для нахождения блюда
5. Коуч выбирает блюдо
6. Система копирует описание и КБЖУ блюда в программу
7. Модальное окно закрывается
8. Коуч видит добавленное блюдо в программе

**Edge Cases**:
- База блюд пуста → показываем сообщение и ссылку на создание
- Блюдо не подходит по типу приёма пищи → показываем предупреждение

### Сценарий 3: Создание продукта с AI-подсказкой

**Пользователь**: Коуч
**Входная точка**: Форма блюда → Добавление ингредиента → "Создать продукт"

**Шаги**:
1. Коуч добавляет ингредиент, но продукта нет в базе
2. Коуч нажимает "Создать продукт"
3. Система открывает форму создания продукта
4. Коуч вводит название продукта
5. Коуч нажимает "Подсказать КБЖУ" (AI)
6. Система подставляет КБЖУ от AI
7. Коуч корректирует значения при необходимости
8. Коуч сохраняет продукт
9. Система добавляет продукт в базу и выбирает его как ингредиент

**Edge Cases**:
- AI выдал некорректные значения → коуч исправляет вручную
- Продукт с таким названием уже есть → предлагаем использовать существующий

---

## UX/UI КЛЮЧЕВЫЕ МОМЕНТЫ

### Design Consistency
- Использовать существующие UI компоненты консоли
- Карточки блюд в стиле карточек клиентов
- Формы в стиле редактора программ питания

### Mobile Optimization
- Консоль адаптивна, но приоритет — desktop
- Карточки блюд в grid на desktop, stack на mobile

### Key Interactions
- **Автосохранение** формы блюда (debounce 2 сек)
- **Оптимистичные обновления** при удалении/архивировании
- **Skeleton loading** для списка блюд
- **Infinite scroll** для больших баз блюд

### Error States
- Ошибка загрузки списка → retry button
- Ошибка AI генерации → fallback на ручной ввод с сообщением
- Ошибка сохранения → toast с retry

### Loading States
- Генерация рецепта AI → spinner с текстом "Генерируем рецепт..."
- Загрузка фото → progress bar
- Сохранение блюда → disabled кнопка + spinner

---

## ИНТЕГРАЦИИ

### Cloudflare R2 (Storage)
- Загрузка фото блюд
- Генерация миниатюр (300x300)
- CDN для быстрой загрузки

### OpenAI API
- Генерация рецептов
- Расчёт КБЖУ
- Подсказки для продуктов

### Существующие модули
- `NutritionProgram` — связь блюд с программами
- `NutritionProgramDay` — добавление блюд в дни
- Редактор программ — интеграция выбора блюд

---

## КРИТЕРИИ КАЧЕСТВА

### Performance
- Загрузка списка блюд: < 500ms
- Генерация рецепта AI: < 10s
- Загрузка фото: < 3s для 5MB файла

### Reliability
- API доступность: 99.9%
- Fallback при недоступности AI: ручной ввод
- Автосохранение черновиков форм

### Usability
- Создание блюда с AI: < 2 минут
- Поиск блюда: < 5 секунд
- Добавление в программу: 3 клика

### Security
- Все запросы через HTTPS
- Проверка прав доступа на каждый запрос
- Валидация загружаемых файлов

---

## МЕТРИКИ УСПЕХА

### User Engagement
- Количество созданных блюд на коуча
- Частота использования AI-генерации
- Время на создание блюда

### Feature Adoption
- % коучей, использующих базу блюд
- Среднее количество блюд в базе
- % блюд, добавленных из базы в программы

### Business Impact
- Сокращение времени создания программ питания
- Увеличение количества программ на коуча
- Удовлетворённость коучей (NPS)

---

## ТЕХНИЧЕСКИЕ ОГРАНИЧЕНИЯ

### Platform Limitations
- Railway: ограничение на размер диска (фото хранятся на R2)
- Telegram: не влияет (только консоль)

### API Rate Limits
- OpenAI: 500 RPM (достаточно)
- Cloudflare R2: без ограничений

### Performance Constraints
- Максимум 1000 блюд на коуча (мягкое ограничение)
- Максимум 50 ингредиентов на блюдо
- Максимум 10 MB на фото (сжатие на клиенте)

### Budget Constraints
- AI генерация: ~$0.01-0.02 на блюдо
- Отслеживать usage через OpenAI dashboard

---

## ПРИОРИТЕТ И TIMELINE

- **Business Priority**: High
- **Technical Complexity**: Medium
- **Estimated Scope**: Large

### Suggested Phases

**Phase 1 — MVP (Must Have)**:
- Модели данных (Dish, Product, DishTag)
- CRUD API для блюд и продуктов
- Страница базы блюд в консоли
- Форма создания/редактирования блюда
- Базовая интеграция с редактором программ

**Phase 2 — AI & UX (Should Have)**:
- AI генерация рецепта
- AI расчёт КБЖУ
- AI подсказки для продуктов
- Drag-and-drop в редакторе программ
- Импорт/экспорт блюд

**Phase 3 — Advanced (Could Have)**:
- Общая библиотека платформы
- Просмотр рецептов в MiniApp
- Статистика использования

---

## ГОТОВНОСТЬ К РАЗРАБОТКЕ

- [x] Требования детализированы
- [x] Технические компоненты определены
- [x] UX сценарии проработаны
- [x] Security требования учтены
- [x] Интеграции спланированы
- [x] Критерии качества установлены

---

## ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ

### Существующий код для референса
- `/backend/apps/meals/models.py` — модели Meal, MealDraft (паттерн для Dish)
- `/backend/apps/nutrition_programs/models.py` — NutritionProgram, NutritionProgramDay
- `/frontend/console/src/pages/NutritionProgramEdit.tsx` — редактор программ (интеграция)
- `/backend/apps/meals/services.py` — AI сервисы (паттерн для Dish AI)
- `/backend/apps/exercises/models.py` — Exercise модель (аналогичная структура базы)

### Конкурентный анализ
- MyFitnessPal — база продуктов с КБЖУ
- Yazio — рецепты с ингредиентами
- MacroFactor — AI анализ еды

---

**Статус**: Готово для Task List Creator
**Следующий шаг**: Передача Task List Creator для декомпозиции на задачи
