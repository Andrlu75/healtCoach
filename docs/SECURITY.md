# Безопасность HealthCoach

## Обзор

Система обрабатывает чувствительные health data клиентов, поэтому безопасность критически важна.

---

## Аутентификация

### JWT токены

**Файл:** `config/settings/base.py`

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),  # короткий срок
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,  # отозванные токены в blacklist
}
```

**Меры безопасности:**
- Access токены живут 30 минут (минимизация окна атаки)
- Refresh токены ротируются при использовании
- Отозванные токены добавляются в blacklist
- Требуется миграция для blacklist таблицы

---

### Telegram Mini App Auth

**Файл:** `apps/accounts/views.py:30` — `TelegramAuthView`

**Endpoint:** `POST /api/auth/telegram/`

**Защита от атак:**

1. **HMAC валидация подписи**
   - Проверка hash через все активные боты
   - Использование `hmac.compare_digest()` (constant-time comparison)

2. **Защита от replay attacks**
   - Обязательная проверка `auth_date`
   - Токены старше 24 часов отклоняются
   - Настраиваемый `TELEGRAM_AUTH_MAX_AGE`

3. **Валидация данных**
   - Проверка наличия обязательных полей
   - Парсинг JSON с обработкой ошибок

```python
# Защита от replay attacks
max_age = getattr(settings, 'TELEGRAM_AUTH_MAX_AGE', 86400)
if time.time() - auth_date > max_age:
    return Response({'error': 'Auth data expired'}, status=403)
```

---

### Валидация пароля

**Файл:** `apps/accounts/views.py:378` — `ChangePasswordView`

**Endpoint:** `POST /api/coach/change-password/`

**Меры безопасности:**
- Проверка текущего пароля перед сменой
- Использование Django AUTH_PASSWORD_VALIDATORS
- Информативные сообщения об ошибках на русском

```python
# Используем Django password validators
validate_password(new_password, user)
```

---

## Загрузка файлов

### Валидация изображений

**Файл:** `core/validators.py`

**Функция:** `validate_uploaded_image(file)`

**Проверки:**

| Проверка | Описание | Лимит |
|----------|----------|-------|
| Размер файла | `validate_image_size()` | 10 МБ |
| MIME-тип | `validate_image_content_type()` | JPEG, PNG, GIF, WebP |
| Расширение | `validate_image_extension()` | .jpg, .jpeg, .png, .gif, .webp |
| Валидность | `validate_image_is_valid()` | PIL verify() |

**Защита от CVE:**
```python
# Защита от decompression bombs (CVE-2013-7459)
Image.MAX_IMAGE_PIXELS = 89_478_485  # ~9500x9500
```

**Использование:**
- `MealCreateSerializer` — фото приёмов пищи
- `DishDetailSerializer` — фото блюд
- `ExerciseSerializer` — фото упражнений

---

## Валидация данных

### JSONField валидация

**Файл:** `apps/meals/serializers.py`

**Валидируемые поля в Dish:**

| Поле | Сериализатор | Проверки |
|------|--------------|----------|
| `ingredients` | `DishIngredientSerializer` | product_id, name, weight, КБЖУ >= 0 |
| `shopping_links` | `ShoppingLinkSerializer` | title, url (URLField) |
| `meal_types` | Inline validation | Только значения из MEAL_TYPES |

```python
def validate_ingredients(self, value: list) -> list:
    serializer = DishIngredientSerializer(data=value, many=True)
    serializer.is_valid(raise_exception=True)
    return value
```

### HEX-цвет валидация

**Файл:** `apps/meals/serializers.py:167`

```python
def validate_color(self, value: str) -> str:
    if not re.match(r'^#[0-9A-Fa-f]{6}$', value):
        raise ValidationError('Цвет должен быть в формате HEX (#RRGGBB).')
    return value.upper()
```

---

## Авторизация

### Изоляция данных коучей

Все ViewSets фильтруют данные по текущему коучу:

```python
def get_queryset(self):
    coach = self.request.user.coach_profile
    return Model.objects.filter(coach=coach)
```

### Изоляция данных клиентов

Клиенты видят только свои данные:

```python
def get_queryset(self):
    return Model.objects.filter(client=self.request.client)
```

---

## Рекомендации

### Открытые задачи

1. **Rate limiting** — ограничение запросов к API
2. **CSRF protection** — для cookie-based auth
3. **Audit logging** — логирование действий с чувствительными данными
4. **Data encryption** — шифрование health data at rest

### Настройки production

```python
# Рекомендуемые настройки
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
```

---

## Инциденты и реагирование

### При компрометации токенов
1. Добавить токены в blacklist
2. Принудительно разлогинить пользователей
3. Провести аудит действий

### При утечке API ключей
1. Ротировать ключи у провайдеров
2. Проверить логи использования
3. Обновить ключи в переменных окружения

---

*Документ создан: 2026-02-01*
*Последнее обновление: 2026-02-01*
