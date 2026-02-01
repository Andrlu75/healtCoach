# TASK LIST: База данных блюд коуча
# Создан: 2026-02-01 12:00
# Обновлён: 2026-02-01 (актуализация статусов)
# Общий контекст: Функциональность для создания и управления личной базой данных блюд коуча с AI-помощью, интеграцией с программами питания и системой категоризации

---

## 🎯 COORDINATION STATUS

TOTAL_TASKS: 52
COMPLETED_TASKS: 52
IN_PROGRESS_TASKS: 0
BLOCKED_TASKS: 0
TODO_TASKS: 0
SKIPPED_TASKS: 3 (inline реализация: #017, #023, #024)
CRITICAL_PATH: ✅ ЗАВЕРШЁН
ALL_PHASES: ✅ ЗАВЕРШЕНЫ
ACTIVE_AGENTS: []
DEADLOCK_DETECTED: false
VERIFICATION_CYCLES: 1
MAX_FIX_ITERATIONS: 2
ESCALATION_NEEDED: false
LAST_UPDATE: 2026-02-01 14:17

---

## 📊 ПРОГРЕСС ПО ГРУППАМ

| Группа | Выполнено | Всего | Процент |
|--------|-----------|-------|---------|
| Backend Models | 3/3 | 3 | 100% |
| Database | 2/2 | 2 | 100% |
| Backend Serializers | 3/3 | 3 | 100% |
| Backend Views & API | 4/4 | 4 | 100% |
| Frontend Types & API | 3/3 | 3 | 100% |
| Frontend Base Components | 4/6 | 6 | 67% |
| Frontend Products Components | 2/2 | 2 | 100% |
| Frontend Ingredients | 0/2 | 2 | 0% (SKIPPED) |
| Frontend Pages | 4/4 | 4 | 100% |
| Integration | 3/3 | 3 | 100% |
| Navigation | 1/1 | 1 | 100% |
| AI Services Backend | 5/5 | 5 | 100% |
| AI Frontend | 2/2 | 2 | 100% |
| Celery Tasks | 2/2 | 2 | 100% |
| Advanced Features | 5/5 | 5 | 100% |
| Drag-and-Drop | 3/3 | 3 | 100% |
| Testing | 4/4 | 4 | 100% |
| Deploy | 1/1 | 1 | 100% |

---

## ⚠️ COORDINATION ALERTS

- [x] INFO: Task list создан, готов к выполнению
- [x] INFO: Critical path завершён
- [x] INFO: Backend полностью готов (модели, сериализаторы, views, URLs, AI)
- [x] INFO: Frontend полностью готов (все компоненты, страницы, интеграция)
- [x] DONE: ShoppingLinksInput интегрирован в DishForm
- [x] DONE: Страницы ProductsDatabase и ProductForm готовы
- [x] DONE: AI кнопки добавлены во все формы
- [ ] TODO: Тесты не написаны (Phase 3)
- [ ] TODO: Деплой на production (Phase 3)

---

# PHASE 1: MVP (Must Have)

## Группа: Backend Models

---

## ЗАДАЧА #001
TITLE: [BACKEND] Create Product Model
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: -
BLOCKS: #003, #004, #006, #009
ESTIMATED: 2h

ОПИСАНИЕ:
Создать модель Product для хранения базы продуктов коуча с КБЖУ на 100г.

ВЫПОЛНЕНО:
- Модель Product создана в models.py
- Поля: coach (FK), name, calories_per_100g, proteins_per_100g, fats_per_100g, carbs_per_100g
- PRODUCT_CATEGORIES с 10 категориями
- Все DecimalField с MinValueValidator(0)
- Meta: db_table='products', unique_together, ordering, indexes
- Метод get_nutrition_for_weight()
- Type hints и docstrings

ФАЙЛЫ:
- `backend/apps/meals/models.py`

---

## ЗАДАЧА #002
TITLE: [BACKEND] Create DishTag Model
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: -
BLOCKS: #003, #004, #007, #010
ESTIMATED: 1h

ОПИСАНИЕ:
Создать модель DishTag для гибкой категоризации блюд тегами.

ВЫПОЛНЕНО:
- Модель DishTag с полями: coach (FK), name, color
- created_at/updated_at для аудита
- Meta: db_table='dish_tags', unique_together, ordering, index

ФАЙЛЫ:
- `backend/apps/meals/models.py`

---

## ЗАДАЧА #003
TITLE: [BACKEND] Create Dish Model
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #001, #002
BLOCKS: #004, #008, #011
ESTIMATED: 3h

ОПИСАНИЕ:
Создать основную модель Dish для хранения блюд коуча.

ВЫПОЛНЕНО:
- Модель Dish со всеми полями
- КБЖУ: portion_weight, calories, proteins, fats, carbohydrates
- JSON: ingredients, shopping_links, meal_types
- M2M: tags → DishTag
- recalculate_nutrition() метод
- Meta: db_table='dishes', ordering, indexes

ФАЙЛЫ:
- `backend/apps/meals/models.py`

---

## Группа: Database

---

## ЗАДАЧА #004
TITLE: [DATABASE] Create Migrations
PRIORITY: CRITICAL
TYPE: INFRASTRUCTURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #001, #002, #003
BLOCKS: #005, #009, #010, #011
ESTIMATED: 1h

ОПИСАНИЕ:
Создать и применить миграции для моделей Product, DishTag, Dish.

ВЫПОЛНЕНО:
- Миграция 0006_add_product_dishtag_dish.py создана
- Таблицы products, dish_tags, dishes, dishes_tags созданы
- Индексы и unique constraints настроены

ФАЙЛЫ:
- `backend/apps/meals/migrations/0006_add_product_dishtag_dish.py`

---

## ЗАДАЧА #005
TITLE: [DATABASE] Add Database Indexes
PRIORITY: HIGH
TYPE: OPTIMIZATION
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #004
BLOCKS: -
ESTIMATED: 1h

ОПИСАНИЕ:
Добавить индексы для оптимизации запросов.

ВЫПОЛНЕНО:
- Индексы добавлены в миграции 0006:
  - Product: (coach, name), (category)
  - DishTag: (coach)
  - Dish: (coach, name), (coach, is_active), (-updated_at)

ФАЙЛЫ:
- `backend/apps/meals/migrations/0006_add_product_dishtag_dish.py`

---

## Группа: Backend Serializers

---

## ЗАДАЧА #006
TITLE: [BACKEND] Create ProductSerializer
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #001
BLOCKS: #009, #014
ESTIMATED: 1h

ОПИСАНИЕ:
Создать сериализатор для модели Product.

ВЫПОЛНЕНО:
- ProductSerializer создан
- Поля: id, name, calories_per_100g, proteins_per_100g, fats_per_100g, carbs_per_100g, category, is_verified, created_at, updated_at
- Валидация КБЖУ >= 0
- read_only: id, created_at, updated_at

ФАЙЛЫ:
- `backend/apps/meals/serializers.py`

---

## ЗАДАЧА #007
TITLE: [BACKEND] Create DishTagSerializer
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #002
BLOCKS: #008, #010, #014
ESTIMATED: 30m

ОПИСАНИЕ:
Создать сериализатор для модели DishTag.

ВЫПОЛНЕНО:
- DishTagSerializer создан
- Поля: id, name, color, created_at
- Валидация HEX цвета (#RRGGBB)

ФАЙЛЫ:
- `backend/apps/meals/serializers.py`

---

## ЗАДАЧА #008
TITLE: [BACKEND] Create DishSerializers
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #003, #007
BLOCKS: #011, #014
ESTIMATED: 2h

ОПИСАНИЕ:
Создать сериализаторы для модели Dish.

ВЫПОЛНЕНО:
- DishListSerializer для списков (компактный)
- DishDetailSerializer для редактирования (полный)
- Вложенные сериализаторы: DishIngredientSerializer, ShoppingLinkSerializer
- Валидация JSON полей
- Методы create/update с обработкой тегов

ФАЙЛЫ:
- `backend/apps/meals/serializers.py`

---

## Группа: Backend Views & API

---

## ЗАДАЧА #009
TITLE: [BACKEND] Create ProductViewSet
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #004, #006
BLOCKS: #012
ESTIMATED: 2h

ОПИСАНИЕ:
Создать ViewSet для CRUD операций с продуктами.

ВЫПОЛНЕНО:
- ProductViewSet с CRUD операциями
- Фильтрация по category, is_verified
- Action search для автокомплита
- Пагинация (page_size=50)
- SearchFilter, OrderingFilter

ФАЙЛЫ:
- `backend/apps/meals/views.py`

---

## ЗАДАЧА #010
TITLE: [BACKEND] Create DishTagViewSet
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #004, #007
BLOCKS: #012
ESTIMATED: 1h

ОПИСАНИЕ:
Создать ViewSet для CRUD операций с тегами.

ВЫПОЛНЕНО:
- DishTagViewSet с CRUD операциями
- Ordering по name
- Автоматическая установка coach

ФАЙЛЫ:
- `backend/apps/meals/views.py`

---

## ЗАДАЧА #011
TITLE: [BACKEND] Create DishViewSet
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #004, #008
BLOCKS: #012, #042, #043
ESTIMATED: 3h

ОПИСАНИЕ:
Создать ViewSet для CRUD операций с блюдами.

ВЫПОЛНЕНО:
- DishViewSet с CRUD операциями
- Action duplicate (POST /dishes/{id}/duplicate/)
- Action archive (POST /dishes/{id}/archive/)
- Фильтрация: meal_type, tags, is_active, show_archived
- Поиск по name, description
- Пагинация (page_size=20)
- Разные serializers для разных actions

ФАЙЛЫ:
- `backend/apps/meals/views.py`

---

## ЗАДАЧА #012
TITLE: [BACKEND] Configure URL Routing
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #009, #010, #011
BLOCKS: #014
ESTIMATED: 1h

ОПИСАНИЕ:
Настроить URL маршруты для API.

ВЫПОЛНЕНО:
- DefaultRouter с ViewSets
- /api/dishes/ — DishViewSet
- /api/products/ — ProductViewSet
- /api/dish-tags/ — DishTagViewSet
- AI endpoints настроены

ФАЙЛЫ:
- `backend/apps/meals/urls.py`

---

## Группа: Frontend Types & API

---

## ЗАДАЧА #013
TITLE: [FRONTEND] Create TypeScript Types
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: -
BLOCKS: #014, #015, #016-#030
ESTIMATED: 2h

ОПИСАНИЕ:
Создать TypeScript типы для блюд, продуктов и тегов.

ВЫПОЛНЕНО:
- Все интерфейсы: Dish, DishFormData, DishListItem, Product, ProductFormData, DishTag, DishTagFormData, Ingredient, ShoppingLink
- Типы: MealType, ProductCategory
- API типы: DishListParams, ProductListParams, и др.

ФАЙЛЫ:
- `frontend/console/src/types/dishes.ts`

---

## ЗАДАЧА #014
TITLE: [FRONTEND] Create API Client Functions
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #012, #013
BLOCKS: #015, #025, #026, #027, #028
ESTIMATED: 2h

ОПИСАНИЕ:
Создать функции API клиента.

ВЫПОЛНЕНО:
- dishesApi: list, get, create, update, delete, duplicate, archive
- productsApi: list, search, get, create, update, delete
- dishTagsApi: list, create, update, delete
- Поддержка multipart/form-data для фото

ФАЙЛЫ:
- `frontend/console/src/api/dishes.ts`

---

## ЗАДАЧА #015
TITLE: [FRONTEND] Create Zustand Store
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #013, #014
BLOCKS: #025, #026
ESTIMATED: 3h

ОПИСАНИЕ:
Создать Zustand store для управления состоянием.

ВЫПОЛНЕНО:
- State: dishes, products, tags, filters, loading, error
- Actions: fetchDishes, createDish, updateDish, deleteDish, duplicateDish, archiveDish
- Пагинация с load more
- Фильтры: поиск, meal_type, tags, archive
- Оптимистичные обновления

ФАЙЛЫ:
- `frontend/console/src/stores/dishes.ts`

---

## Группа: Frontend Base Components

---

## ЗАДАЧА #016
TITLE: [FRONTEND] Create DishCard Component
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #013
BLOCKS: #025
ESTIMATED: 2h

ОПИСАНИЕ:
Создать компонент карточки блюда для списка.

ВЫПОЛНЕНО:
- DishCard с фото, названием, КБЖУ, тегами, временем готовки
- Hover эффекты
- Dropdown menu с действиями (редактировать, дублировать, архивировать)
- Responsive дизайн

ФАЙЛЫ:
- `frontend/console/src/components/dishes/DishCard.tsx`

---

## ЗАДАЧА #017
TITLE: [FRONTEND] Create NutritionSummary Component
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ⏭️ SKIPPED
DEPENDS_ON: #013
BLOCKS: #026
ESTIMATED: 1h

ОПИСАНИЕ:
Создать компонент сводки КБЖУ.

ПРИМЕЧАНИЕ:
Реализовано inline в DishForm. Отдельный компонент не требуется.

---

## ЗАДАЧА #018
TITLE: [FRONTEND] Create TagsInput Component
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #013
BLOCKS: #026
ESTIMATED: 2h

ОПИСАНИЕ:
Создать компонент выбора и создания тегов.

ВЫПОЛНЕНО:
- TagsInput с Popover для выбора тегов
- Выбранные теги отображаются как chips
- Поиск по названию тегов
- Создание нового тега с выбором цвета (8 предустановленных)
- Клавиатурная навигация

ФАЙЛЫ:
- `frontend/console/src/components/dishes/TagsInput.tsx`

---

## ЗАДАЧА #019
TITLE: [FRONTEND] Create MealTypeSelector Component
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #013
BLOCKS: #026
ESTIMATED: 1h

ОПИСАНИЕ:
Создать компонент выбора типов приёмов пищи.

ВЫПОЛНЕНО:
- MealTypeSelector с toggle buttons
- MealTypeSelectorCompact с чекбоксами
- Multiselect с локализованными названиями

ФАЙЛЫ:
- `frontend/console/src/components/dishes/MealTypeSelector.tsx`

---

## ЗАДАЧА #020
TITLE: [FRONTEND] Create ShoppingLinksInput Component
PRIORITY: MEDIUM
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #013
BLOCKS: #026
ESTIMATED: 1h

ОПИСАНИЕ:
Создать компонент ввода ссылок на покупку.

ВЫПОЛНЕНО:
- ShoppingLinksInput с динамическим списком
- Добавление/удаление ссылок
- Валидация URL с отображением ошибок
- Кнопка открытия ссылки в новой вкладке

ФАЙЛЫ:
- `frontend/console/src/components/dishes/ShoppingLinksInput.tsx`

⚠️ ВНИМАНИЕ: Компонент создан, но НЕ ИНТЕГРИРОВАН в DishForm!

---

## Группа: Frontend Products Components

---

## ЗАДАЧА #021
TITLE: [FRONTEND] Create ProductAutocomplete Component
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #013, #014
BLOCKS: #023
ESTIMATED: 2h

ОПИСАНИЕ:
Создать компонент автокомплита для поиска продуктов.

ВЫПОЛНЕНО:
- ProductAutocomplete с debounced поиском (300ms)
- Dropdown с результатами: название, КБЖУ, категория
- Отображение выбранного продукта
- Кнопка "Создать" когда не найдено
- Loading и empty states

ФАЙЛЫ:
- `frontend/console/src/components/products/ProductAutocomplete.tsx`

---

## ЗАДАЧА #022
TITLE: [FRONTEND] Create ProductQuickAdd Modal
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01 15:00]
DEPENDS_ON: #013, #014
BLOCKS: #023, #028
ESTIMATED: 2h

ОПИСАНИЕ:
Создать модальное окно быстрого добавления продукта.

ВЫПОЛНЕНО:
- Создан компонент ProductQuickAdd с Dialog
- Props: isOpen, onClose, onProductCreated, initialName
- Форма с полями: название, категория (Select), КБЖУ на 100г (4 поля)
- Кнопка "Подсказать КБЖУ" с AI (dishesAiApi.suggestProductNutrition)
- Валидация всех полей с отображением ошибок
- Сохранение через productsApi.create()
- Toast уведомления об успехе/ошибке
- Интеграция с ProductAutocomplete — автоматическое открытие при клике "Создать"

ФАЙЛЫ:
- `frontend/console/src/components/products/ProductQuickAdd.tsx` (новый)
- `frontend/console/src/components/products/ProductAutocomplete.tsx` (обновлён)

---

## Группа: Frontend Ingredients Components

---

## ЗАДАЧА #023
TITLE: [FRONTEND] Create IngredientInput Component
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ⏭️ SKIPPED
DEPENDS_ON: #013, #021
BLOCKS: #024
ESTIMATED: 2h

ОПИСАНИЕ:
Создать компонент ввода одного ингредиента.

ПРИМЕЧАНИЕ:
Реализовано inline в DishForm. Отдельный компонент не требуется.

---

## ЗАДАЧА #024
TITLE: [FRONTEND] Create IngredientsTable Component
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ⏭️ SKIPPED
DEPENDS_ON: #013, #023
BLOCKS: #026
ESTIMATED: 2h

ОПИСАНИЕ:
Создать компонент таблицы ингредиентов.

ПРИМЕЧАНИЕ:
Реализовано inline в DishForm. Отдельный компонент не требуется.

---

## Группа: Frontend Pages

---

## ЗАДАЧА #025
TITLE: [FRONTEND] Create DishesDatabase Page
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #013, #014, #015, #016
BLOCKS: #032
ESTIMATED: 4h

ОПИСАНИЕ:
Создать главную страницу базы данных блюд.

ВЫПОЛНЕНО:
- Страница DishesDatabase.tsx создана
- Header с кнопкой "Добавить блюдо"
- Фильтры: поиск, тип приёма пищи, теги
- Grid карточек DishCard
- Пагинация "Загрузить ещё"
- Empty state
- Loading skeleton

ФАЙЛЫ:
- `frontend/console/src/pages/dishes/DishesDatabase.tsx`

---

## ЗАДАЧА #026
TITLE: [FRONTEND] Create DishForm Page
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #013, #014, #015, #017, #018, #019, #020, #024
BLOCKS: #029, #032
ESTIMATED: 6h

ОПИСАНИЕ:
Создать страницу формы создания/редактирования блюда.

ВЫПОЛНЕНО:
- Режимы: создание и редактирование
- Секции формы:
  - ✅ Основная информация: название, описание, фото (upload)
  - ✅ Ингредиенты: inline таблица
  - ✅ КБЖУ с кнопкой пересчёта
  - ✅ Рецепт: textarea
  - ✅ Дополнительно: время готовки, видео URL
  - ✅ Типы приёмов пищи: checkboxes
  - ✅ Теги: toggle buttons
  - ✅ Ссылки на покупку: ShoppingLinksInput
- AI кнопки: генерация рецепта, описания, расчёт КБЖУ

ФАЙЛЫ:
- `frontend/console/src/pages/dishes/DishForm.tsx`

---

## ЗАДАЧА #027
TITLE: [FRONTEND] Create ProductsDatabase Page
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01 15:15]
DEPENDS_ON: #013, #014
BLOCKS: #032
ESTIMATED: 3h

ОПИСАНИЕ:
Создать страницу базы данных продуктов.

ВЫПОЛНЕНО:
- Создана страница ProductsDatabase.tsx
- Таблица продуктов с колонками: название, категория, КБЖУ на 100г
- Поиск по названию с debounce
- Фильтр по категории через Select
- Кнопка "Добавить продукт" → открывает ProductQuickAdd
- Inline-редактирование в таблице (без отдельной формы)
- AI-подсказка КБЖУ при редактировании
- Удаление с подтверждением через AlertDialog
- Пагинация "Загрузить ещё"
- Добавлен маршрут /products в App.tsx
- Добавлена ссылка в навигацию Layout.tsx

ФАЙЛЫ:
- `frontend/console/src/pages/products/ProductsDatabase.tsx` (новый)
- `frontend/console/src/App.tsx` (маршрут)
- `frontend/console/src/components/common/Layout.tsx` (навигация)

---

## ЗАДАЧА #028
TITLE: [FRONTEND] Create ProductForm Page
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01 15:15]
DEPENDS_ON: #013, #014, #022
BLOCKS: #032
ESTIMATED: 2h

ОПИСАНИЕ:
Создать форму редактирования продукта.

ВЫПОЛНЕНО:
Реализовано двумя способами:
1. **Создание** — через ProductQuickAdd модальное окно (#022)
2. **Редактирование** — inline в таблице ProductsDatabase (#027)

Такой подход обеспечивает лучший UX без необходимости покидать страницу.

Функциональность:
- Все поля: название, категория, КБЖУ на 100г
- Валидация (пустое название, отрицательные значения)
- AI-подсказка КБЖУ
- Сохранение через API

ФАЙЛЫ:
- `frontend/console/src/components/products/ProductQuickAdd.tsx` (создание)
- `frontend/console/src/pages/products/ProductsDatabase.tsx` (редактирование)

---

## Группа: Integration with Nutrition Programs

---

## ЗАДАЧА #029
TITLE: [FRONTEND] Create DishSelector Modal
PRIORITY: CRITICAL
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #014, #016, #026
BLOCKS: #031
ESTIMATED: 3h

ОПИСАНИЕ:
Создать модальное окно выбора блюда для программы питания.

ВЫПОЛНЕНО:
- DishSelector с поиском и фильтрами
- Grid карточек блюд
- Выбор блюда с callback
- Ссылка на создание нового блюда

ФАЙЛЫ:
- `frontend/console/src/components/dishes/DishSelector.tsx`

---

## ЗАДАЧА #030
TITLE: [FRONTEND] Create DishPreview Component
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #013
BLOCKS: #031
ESTIMATED: 1h

ОПИСАНИЕ:
Создать компонент превью блюда для программы питания.

ВЫПОЛНЕНО:
- DishPreview с фото, названием, КБЖУ
- DishPreviewCompact для компактного отображения
- Кнопка удаления

ФАЙЛЫ:
- `frontend/console/src/components/dishes/DishPreview.tsx`

---

## ЗАДАЧА #031
TITLE: [FRONTEND] Integrate DishSelector into NutritionProgramEdit
PRIORITY: CRITICAL
TYPE: INTEGRATION
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #029, #030
BLOCKS: -
ESTIMATED: 4h

ОПИСАНИЕ:
Интегрировать выбор блюд из базы в редактор программ питания.

ВЫПОЛНЕНО:
- Кнопка "Добавить из базы" в приёмах пищи
- DishSelector открывается с фильтром по типу
- Данные блюда копируются в программу
- DishPreview отображается в сетке
- Удаление работает

ФАЙЛЫ:
- `frontend/console/src/pages/NutritionProgramEdit.tsx`

---

## Группа: Navigation & Routing

---

## ЗАДАЧА #032
TITLE: [FRONTEND] Add Routes and Navigation
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #025, #026, #027, #028
BLOCKS: -
ESTIMATED: 2h

ОПИСАНИЕ:
Добавить маршруты и навигацию для страниц блюд и продуктов.

ВЫПОЛНЕНО:
- /dishes — DishesDatabase
- /dishes/new — DishForm (создание)
- /dishes/:id — DishForm (редактирование)
- Навигация в Layout.tsx с иконкой ChefHat

⚠️ TODO: Добавить маршруты для /products когда страницы будут готовы

ФАЙЛЫ:
- `frontend/console/src/App.tsx`
- `frontend/console/src/components/Layout.tsx`

---

# PHASE 2: AI & UX (Should Have)

## Группа: AI Services Backend

---

## ЗАДАЧА #033
TITLE: [BACKEND] Create AI Service: Generate Recipe
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #003
BLOCKS: #037, #038
ESTIMATED: 3h

ОПИСАНИЕ:
Создать AI сервис для генерации рецепта блюда.

ВЫПОЛНЕНО:
- Функция generate_recipe(dish_name) async
- Возвращает: RecipeData с ingredients, recipe, cooking_time, portion_weight, КБЖУ
- JSON mode, валидация, error handling

ФАЙЛЫ:
- `backend/apps/meals/ai_services.py`

---

## ЗАДАЧА #034
TITLE: [BACKEND] Create AI Service: Calculate Nutrition
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #003
BLOCKS: #037, #038
ESTIMATED: 2h

ОПИСАНИЕ:
Создать AI сервис для расчёта КБЖУ по ингредиентам.

ВЫПОЛНЕНО:
- Функция calculate_nutrition_from_ingredients(ingredients) async
- Возвращает: NutritionData (calories, proteins, fats, carbohydrates)
- Детерминированный режим (temperature=0.0)

ФАЙЛЫ:
- `backend/apps/meals/ai_services.py`

---

## ЗАДАЧА #035
TITLE: [BACKEND] Create AI Service: Suggest Product Nutrition
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #001
BLOCKS: #037, #039
ESTIMATED: 2h

ОПИСАНИЕ:
Создать AI сервис для подсказки КБЖУ продукта.

ВЫПОЛНЕНО:
- Функция suggest_product_nutrition(product_name) async
- Возвращает КБЖУ на 100г
- Детерминированный режим

ФАЙЛЫ:
- `backend/apps/meals/ai_services.py`

---

## ЗАДАЧА #036
TITLE: [BACKEND] Create AI Service: Suggest Dish Description
PRIORITY: MEDIUM
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #003
BLOCKS: #037, #038
ESTIMATED: 1h

ОПИСАНИЕ:
Создать AI сервис для генерации описания блюда.

ВЫПОЛНЕНО:
- Функция suggest_dish_description(dish_name) async
- Возвращает 1-2 предложения
- Креативный режим (temperature=0.8)

ФАЙЛЫ:
- `backend/apps/meals/ai_services.py`

---

## ЗАДАЧА #037
TITLE: [BACKEND] Create AI API Endpoints
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #033, #034, #035, #036
BLOCKS: #038, #039
ESTIMATED: 2h

ОПИСАНИЕ:
Создать API endpoints для AI функций.

ВЫПОЛНЕНО:
- POST /api/meals/ai/generate-recipe/
- POST /api/meals/ai/calculate-nutrition/
- POST /api/meals/ai/suggest-description/
- POST /api/meals/ai/suggest-product-nutrition/

ФАЙЛЫ:
- `backend/apps/meals/views.py`
- `backend/apps/meals/urls.py`

---

## Группа: AI Frontend Integration

---

## ЗАДАЧА #038
TITLE: [FRONTEND] Add AI Buttons to DishForm
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #026, #037
BLOCKS: -
ESTIMATED: 3h

ОПИСАНИЕ:
Добавить AI кнопки в форму блюда.

ВЫПОЛНЕНО:
Все AI кнопки уже реализованы в DishForm.tsx:

1. **"Сгенерировать рецепт"** (строка 379-394):
   - Кнопка рядом с полем названия
   - Вызывает dishesAiApi.generateRecipe()
   - Заполняет: recipe, ingredients, portion_weight, cooking_time, КБЖУ
   - Loading: isGeneratingRecipe
   - Toast уведомления

2. **"Сгенерировать описание"** (строка 407-422):
   - Кнопка рядом с полем описания
   - Вызывает dishesAiApi.suggestDescription()
   - Заполняет description
   - Loading: isGeneratingDescription

3. **"AI расчёт КБЖУ"** (строка 467-480):
   - Кнопка в секции ингредиентов
   - Вызывает dishesAiApi.calculateNutrition()
   - Обновляет calories, proteins, fats, carbohydrates
   - Loading: isCalculatingNutrition

Функции-обработчики: строки 185-309.

ФАЙЛЫ:
- `frontend/console/src/pages/dishes/DishForm.tsx`

---

## ЗАДАЧА #039
TITLE: [FRONTEND] Add AI Button to ProductForm
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01 15:00]
DEPENDS_ON: #022, #037
BLOCKS: -
ESTIMATED: 1h

ОПИСАНИЕ:
Добавить AI кнопку подсказки КБЖУ в форму продукта.

ВЫПОЛНЕНО:
AI кнопка добавлена в рамках задач #022 и #027:

1. **ProductQuickAdd** (#022):
   - Кнопка с иконкой Sparkles рядом с полем названия
   - Вызывает dishesAiApi.suggestProductNutrition()
   - Заполняет все 4 поля КБЖУ
   - Loading состояние (Loader2)
   - Toast уведомления об успехе/ошибке

2. **ProductsDatabase inline-редактирование** (#027):
   - Кнопка AI при редактировании строки
   - Та же логика suggestProductNutrition()
   - Loading состояние для конкретной строки

ФАЙЛЫ:
- `frontend/console/src/components/products/ProductQuickAdd.tsx`
- `frontend/console/src/pages/products/ProductsDatabase.tsx`

---

## Группа: Celery Tasks

---

## ЗАДАЧА #040
TITLE: [BACKEND] Create Celery Task: Generate Dish Thumbnail
PRIORITY: MEDIUM
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01 15:45]
DEPENDS_ON: #003
BLOCKS: -
ESTIMATED: 2h

ОПИСАНИЕ:
Создать Celery task для генерации миниатюры фото блюда.

ВЫПОЛНЕНО:
- Добавлено поле thumbnail в модель Dish
- Создан таск generate_dish_thumbnail(dish_id):
  - Генерирует миниатюру 300x300 с сохранением пропорций
  - Белый фон для квадратного изображения
  - JPEG с качеством 85%, оптимизация
  - Retry при ошибках (max 3 попытки)
- Создан signal post_save для Dish:
  - Отслеживает изменение photo
  - Автоматически запускает таск
- Создана миграция 0007_add_dish_thumbnail

ФАЙЛЫ:
- `backend/apps/meals/models.py` (поле thumbnail)
- `backend/apps/meals/tasks.py` (новый)
- `backend/apps/meals/signals.py` (новый)
- `backend/apps/meals/apps.py` (ready)
- `backend/apps/meals/migrations/0007_add_dish_thumbnail.py`

---

## ЗАДАЧА #041
TITLE: [BACKEND] Create Celery Task: Recalculate Dishes Nutrition
PRIORITY: MEDIUM
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01 15:45]
DEPENDS_ON: #001, #003
BLOCKS: -
ESTIMATED: 2h

ОПИСАНИЕ:
Создать Celery task для пересчёта КБЖУ блюд при изменении продукта.

ВЫПОЛНЕНО:
- Создан таск recalculate_dishes_nutrition(product_id):
  - Находит блюда с этим продуктом в ingredients
  - Пересчитывает КБЖУ ингредиентов по обновлённым данным продукта
  - Вызывает dish.recalculate_nutrition()
  - Сохраняет обновлённые данные
  - Retry при ошибках
- Создан signal post_save для Product:
  - Отслеживает изменение КБЖУ
  - Автоматически запускает таск при изменении
- Бонус: создан таск cleanup_orphaned_thumbnails() для очистки

ФАЙЛЫ:
- `backend/apps/meals/tasks.py`
- `backend/apps/meals/signals.py`

---

## Группа: Advanced Features

---

## ЗАДАЧА #042
TITLE: [BACKEND] Implement Dish Duplicate Action
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #011
BLOCKS: -
ESTIMATED: 1h

ОПИСАНИЕ:
Реализовать action дублирования блюда.

ВЫПОЛНЕНО:
- POST /api/dishes/{id}/duplicate/
- Создаёт копию с суффиксом " (копия)"
- Копируются все поля и теги

ФАЙЛЫ:
- `backend/apps/meals/views.py`

---

## ЗАДАЧА #043
TITLE: [BACKEND] Implement Dish Archive Action
PRIORITY: HIGH
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #011
BLOCKS: -
ESTIMATED: 30m

ОПИСАНИЕ:
Реализовать action архивирования блюда.

ВЫПОЛНЕНО:
- POST /api/dishes/{id}/archive/
- Устанавливает is_active=False

ФАЙЛЫ:
- `backend/apps/meals/views.py`

---

## ЗАДАЧА #044
TITLE: [FEATURE] Implement Dishes Import/Export
PRIORITY: MEDIUM
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01 16:15]
DEPENDS_ON: #011, #025
BLOCKS: -
ESTIMATED: 4h
ACTUAL: 1h

ОПИСАНИЕ:
Реализовать импорт и экспорт блюд в JSON формате.

ВЫПОЛНЕНО:
- Добавлен DishExportSerializer для экспорта блюд
- Добавлен DishImportSerializer для валидации импортируемых данных
- GET /api/dishes/export/ - экспорт в JSON файл
- POST /api/dishes/import/ - импорт из JSON файла
- Поддержка пропуска дубликатов (skip_duplicates=true)
- Автоматическое создание тегов при импорте
- Формат версионирования экспорта (version 1.0)
- UI кнопки "Экспорт" и "Импорт" на странице базы блюд
- Toast уведомления о результате

ФАЙЛЫ:
- `backend/apps/meals/serializers.py`
- `backend/apps/meals/views.py`
- `frontend/console/src/api/dishes.ts`
- `frontend/console/src/pages/dishes/DishesDatabase.tsx`

---

## ЗАДАЧА #045
TITLE: [FEATURE] Create Dish from Nutrition Program
PRIORITY: MEDIUM
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #031
BLOCKS: -
ESTIMATED: 3h
ACTUAL: 15m

ОПИСАНИЕ:
Быстрое создание блюда из приёма пищи в программе.

ВЫПОЛНЕНО:
- Добавлена кнопка "Сохранить как блюдо" (BookmarkPlus) в карточке приёма пищи
- При клике переходит на /dishes/new с предзаполненными данными через location.state
- DishForm уже поддерживал предзаполнение через PrefillData

ФАЙЛЫ:
- `frontend/console/src/pages/NutritionProgramEdit.tsx`

---

## Группа: Drag-and-Drop

---

## ЗАДАЧА #046
TITLE: [FRONTEND] Create Draggable Dishes Panel
PRIORITY: MEDIUM
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #025, #031
BLOCKS: #047
ESTIMATED: 3h
ACTUAL: Было реализовано ранее

ОПИСАНИЕ:
Боковая панель с перетаскиваемыми блюдами.

ВЫПОЛНЕНО:
- DraggableDishesPanel с поиском и фильтром по типу приёма пищи
- DraggableDishCard с useDraggable из @dnd-kit/core
- DishDragOverlay для красивого отображения при перетаскивании
- Кнопка "База блюд" в header редактора для открытия/закрытия панели

ФАЙЛЫ:
- `frontend/console/src/components/dishes/DraggableDishesPanel.tsx`

---

## ЗАДАЧА #047
TITLE: [FRONTEND] Implement Drop Zones in Program Editor
PRIORITY: MEDIUM
TYPE: FEATURE
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #031, #046
BLOCKS: -
ESTIMATED: 4h
ACTUAL: Было реализовано ранее

ОПИСАНИЕ:
Drop zones для блюд в редакторе программ.

ВЫПОЛНЕНО:
- MealDropZone компонент с useDroppable из @dnd-kit/core
- DndContext оборачивает весь редактор
- handleDragStart и handleDragEnd обработчики
- Drop zones для каждого типа приёма пищи (завтрак, перекус 1, обед, перекус 2, ужин)
- Визуальная обратная связь при наведении

ФАЙЛЫ:
- `frontend/console/src/pages/NutritionProgramEdit.tsx`

---

# PHASE 3: Testing & Documentation

---

## ЗАДАЧА #048
TITLE: [TESTING] Backend Unit Tests for Models
PRIORITY: HIGH
TYPE: TESTING
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #004
BLOCKS: -
ESTIMATED: 3h
ACTUAL: Готово (создано ранее)

ОПИСАНИЕ:
Unit тесты для моделей Product, DishTag, Dish.

ВЫПОЛНЕНО:
- 36 тестов для моделей в test_models.py
- TestProductModel: создание, уникальность, валидация, расчёт КБЖУ, сортировка
- TestDishTagModel: создание, цвет по умолчанию, уникальность
- TestDishModel: создание, теги, ингредиенты, recalculate_nutrition

ФАЙЛЫ:
- `backend/apps/meals/tests/test_models.py`
- `backend/apps/meals/tests/conftest.py`

---

## ЗАДАЧА #049
TITLE: [TESTING] Backend Unit Tests for API
PRIORITY: HIGH
TYPE: TESTING
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #012
BLOCKS: -
ESTIMATED: 4h
ACTUAL: Готово (создано ранее)

ОПИСАНИЕ:
Unit тесты для API endpoints.

ВЫПОЛНЕНО:
- 52 теста для API в test_views.py
- TestProductAPI: CRUD, фильтрация, поиск, изоляция данных
- TestDishTagAPI: CRUD, изоляция данных
- TestDishAPI: CRUD, фильтрация, теги, duplicate, archive, изоляция

ФАЙЛЫ:
- `backend/apps/meals/tests/test_views.py`

---

## ЗАДАЧА #050
TITLE: [TESTING] Frontend Component Tests
PRIORITY: MEDIUM
TYPE: TESTING
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #026, #029
BLOCKS: -
ESTIMATED: 4h
ACTUAL: 30m

ОПИСАНИЕ:
Тесты для React компонентов.

ВЫПОЛНЕНО:
- 24 теста для React компонентов
- DishCard.test.tsx: рендеринг, КБЖУ, теги, клик, фото
- DishSelector.test.tsx: открытие/закрытие, загрузка блюд, выбор, empty state
- DraggableDishesPanel.test.tsx: DishDragOverlay рендеринг
- DishForm.test.tsx: заголовок, кнопки, секции

ФАЙЛЫ:
- `frontend/console/src/components/dishes/__tests__/DishCard.test.tsx`
- `frontend/console/src/components/dishes/__tests__/DishSelector.test.tsx`
- `frontend/console/src/components/dishes/__tests__/DraggableDishesPanel.test.tsx`
- `frontend/console/src/pages/dishes/__tests__/DishForm.test.tsx`

---

## ЗАДАЧА #051
TITLE: [TESTING] Backend AI Services Tests
PRIORITY: MEDIUM
TYPE: TESTING
STATUS: ✅ COMPLETED [2026-02-01]
DEPENDS_ON: #037
BLOCKS: -
ESTIMATED: 2h
ACTUAL: Готово (создано ранее)

ОПИСАНИЕ:
Тесты для AI сервисов с mock OpenAI.

ВЫПОЛНЕНО:
- 43 теста для AI сервисов в test_ai_services.py
- TestGenerateRecipe: успех, пустое имя, ошибки AI
- TestCalculateNutrition: успех, валидация, ошибки
- TestSuggestProductNutrition: успех, валидация
- TestSuggestDishDescription: успех, валидация
- Все тесты используют mock для OpenAI

ФАЙЛЫ:
- `backend/apps/meals/tests/test_ai_services.py`

---

## ЗАДАЧА #052
TITLE: [DEPLOY] Production Deployment Preparation
PRIORITY: HIGH
TYPE: INFRASTRUCTURE
STATUS: ✅ COMPLETED [2026-02-01 13:58]
DEPENDS_ON: #048, #049
BLOCKS: -
ESTIMATED: 2h
ACTUAL: 30m

ОПИСАНИЕ:
Подготовка к деплою на Railway.

ВЫПОЛНЕНО:
- ✅ Все миграции созданы и применены
- ✅ Все backend тесты проходят (131 passed)
- ✅ Celery tasks настроены (tasks.py, signals.py)
- ✅ AI сервисы с rate limiting задеплоены
- ✅ Security improvements в production
- ✅ Деплой успешно выполнен:
  - api: SUCCESS
  - beat: SUCCESS
  - console: SUCCESS

СЕРВИСЫ:
- API: https://healthcoach-api-production.up.railway.app
- Console: https://healthcoach-console-production.up.railway.app

---

# 📋 СВОДКА ОСТАВШИХСЯ ЗАДАЧ

## ✅ PHASE 1 & 2 ЗАВЕРШЕНЫ!

Вся основная функциональность базы блюд реализована:
- Backend: модели, сериализаторы, views, URLs, AI сервисы
- Frontend: типы, API клиент, store, компоненты, страницы
- Интеграция с программами питания
- AI-помощники во всех формах

## Средний приоритет (Phase 3):
- Celery tasks (#040, #041) — генерация миниатюр, пересчёт КБЖУ
- Import/Export (#044) — импорт/экспорт блюд в JSON
- Тестирование (#048-#051) — unit и integration тесты
- Деплой (#052) — production deployment

## Отложено:
- Drag-and-drop (#045, #046, #047) — перетаскивание блюд в редакторе программ

---

# 📊 DEPENDENCY GRAPH (актуальный)

```
ЗАВЕРШЕНО:
#001 ✅ → #003 ✅ → #004 ✅ → #005 ✅
#002 ✅ ↗

#006 ✅ → #009 ✅ ↘
#007 ✅ → #008 ✅ → #011 ✅ → #012 ✅ → #014 ✅ → #015 ✅
#010 ✅ ↗

#013 ✅ → #016 ✅ → #025 ✅
       → #018 ✅ → #026 ✅ (80%)
       → #019 ✅ ↗
       → #020 ✅ (не интегрирован!)
       → #021 ✅ → #029 ✅ → #031 ✅
       → #030 ✅ ↗

#033-#036 ✅ → #037 ✅

#042 ✅, #043 ✅

ОЖИДАЕТ:
#022 TODO → #028 TODO
#027 TODO
#038 TODO (после #026)
#039 TODO (после #022)
```

---

# ИСТОРИЯ ОБНОВЛЕНИЙ

| Дата | Изменение |
|------|-----------|
| 2026-02-01 12:00 | Создание таск-листа |
| 2026-02-01 14:30 | Полная ревизия статусов. Backend 100% готов. Frontend MVP готов (кроме ProductsDatabase). |
| 2026-02-01 15:30 | **Phase 1 & 2 завершены!** Выполнены задачи: #022 ProductQuickAdd, #027 ProductsDatabase, #028 ProductForm, #038 AI в DishForm, #039 AI в ProductForm. Интегрирован ShoppingLinksInput в DishForm. |
