# Фаза 4: Client Onboarding — Детальный план

## Что уже есть:
- Модели `InviteLink` и `OnboardingQuestion` с миграцией
- Поля `Client.onboarding_completed` и `Client.onboarding_data` (JSONField)
- URL `api/onboarding/` подключён в `config/urls.py`
- `/start` handler отправляет только приветствие

---

## Что нужно реализовать:

### 1. `apps/onboarding/services.py` — Логика онбординга

- **`validate_invite(code) -> InviteLink | None`** — проверка кода (активен, не истёк, лимит использований)
- **`start_onboarding(client)`** — инициализация: записать в `onboarding_data` текущий вопрос = 0
- **`get_current_question(client) -> OnboardingQuestion | None`** — какой вопрос задавать сейчас
- **`process_answer(client, text) -> str`** — сохранить ответ, перейти к следующему вопросу или завершить
- **`complete_onboarding(client)`** — расчёт КБЖУ по Mifflin-St Jeor, сохранение норм
- **`calculate_tdee(weight, height, age, gender, activity)`** — формула

### 2. Обновить `apps/bot/handlers/commands.py`

Новая логика `/start`:
- `/start invite_CODE` → валидация invite → привязка к коучу → начало анкеты
- `/start` (без кода) → приветствие (как сейчас)

### 3. Создать `apps/bot/handlers/onboarding.py`

Обработчик ответов на вопросы анкеты:
- Получает текст → `process_answer()` → отправляет следующий вопрос или поздравление

### 4. Обновить `apps/bot/webhook.py`

Добавить проверку: если клиент в процессе онбординга (`onboarding_completed=False` + есть `onboarding_data`), роутить текст в onboarding handler, а не в text handler.

### 5. `apps/onboarding/serializers.py`

- `InviteLinkSerializer`
- `OnboardingQuestionSerializer`

### 6. `apps/onboarding/views.py` — API для консоли коуча

- `GET/POST /api/onboarding/invites/` — список / создание инвайтов
- `DELETE /api/onboarding/invites/<id>/` — удаление
- `GET/POST /api/onboarding/questions/` — список / создание вопросов
- `PUT/DELETE /api/onboarding/questions/<id>/` — редактирование / удаление

### 7. `apps/onboarding/urls.py` — маршруты

---

## Формула Mifflin-St Jeor:
```
Мужчины: BMR = 10 × вес(кг) + 6.25 × рост(см) − 5 × возраст + 5
Женщины: BMR = 10 × вес(кг) + 6.25 × рост(см) − 5 × возраст − 161
TDEE = BMR × коэффициент активности (1.2 — 1.9)
```

Распределение макросов: ~25% белки, ~25% жиры, ~50% углеводы (от TDEE).

---

## Порядок реализации:
1. `onboarding/services.py` (invite + onboarding flow + Mifflin-St Jeor)
2. `bot/handlers/commands.py` (обновить /start)
3. `bot/handlers/onboarding.py` (новый handler)
4. `bot/webhook.py` (роутинг на onboarding)
5. `onboarding/serializers.py`
6. `onboarding/views.py` + `urls.py`
