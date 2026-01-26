from django.core.management.base import BaseCommand
from apps.exercises.models import ExerciseCategory, ExerciseType, Exercise
from apps.accounts.models import Coach


class Command(BaseCommand):
    help = 'Заполнение базы данных упражнениями'

    def handle(self, *args, **options):
        # Получаем первого коуча (или создаём тестового)
        coach = Coach.objects.first()
        if not coach:
            self.stdout.write(self.style.ERROR('Нет коучей в базе. Сначала создайте коуча.'))
            return

        self.stdout.write(f'Заполняем базу для коуча: {coach}')

        # Создаём категории
        categories = self.create_categories(coach)

        # Создаём типы упражнений
        types = self.create_types(coach)

        # Создаём упражнения
        self.create_exercises(coach, categories, types)

        self.stdout.write(self.style.SUCCESS('База упражнений успешно заполнена!'))

    def create_categories(self, coach):
        categories_data = [
            {'name': 'Грудь', 'color': '#EF4444', 'icon': 'chest', 'order': 1},
            {'name': 'Спина', 'color': '#3B82F6', 'icon': 'back', 'order': 2},
            {'name': 'Ноги', 'color': '#10B981', 'icon': 'legs', 'order': 3},
            {'name': 'Плечи', 'color': '#F59E0B', 'icon': 'shoulders', 'order': 4},
            {'name': 'Бицепс', 'color': '#8B5CF6', 'icon': 'biceps', 'order': 5},
            {'name': 'Трицепс', 'color': '#EC4899', 'icon': 'triceps', 'order': 6},
            {'name': 'Пресс', 'color': '#06B6D4', 'icon': 'abs', 'order': 7},
            {'name': 'Кардио', 'color': '#F97316', 'icon': 'cardio', 'order': 8},
            {'name': 'Ягодицы', 'color': '#D946EF', 'icon': 'glutes', 'order': 9},
            {'name': 'Икры', 'color': '#14B8A6', 'icon': 'calves', 'order': 10},
        ]

        categories = {}
        for cat_data in categories_data:
            cat, created = ExerciseCategory.objects.get_or_create(
                coach=coach,
                name=cat_data['name'],
                defaults=cat_data
            )
            categories[cat_data['name']] = cat
            if created:
                self.stdout.write(f'  Создана категория: {cat.name}')

        return categories

    def create_types(self, coach):
        types_data = [
            {
                'name': 'Силовое',
                'description': 'Упражнения с отягощением',
                'parameters': ['sets', 'reps', 'weight']
            },
            {
                'name': 'С собственным весом',
                'description': 'Упражнения без дополнительного веса',
                'parameters': ['sets', 'reps']
            },
            {
                'name': 'Кардио',
                'description': 'Аэробные упражнения',
                'parameters': ['duration', 'distance', 'calories']
            },
            {
                'name': 'Статика',
                'description': 'Упражнения на удержание позиции',
                'parameters': ['sets', 'duration']
            },
            {
                'name': 'Плиометрика',
                'description': 'Взрывные упражнения',
                'parameters': ['sets', 'reps']
            },
        ]

        types = {}
        for type_data in types_data:
            t, created = ExerciseType.objects.get_or_create(
                coach=coach,
                name=type_data['name'],
                defaults=type_data
            )
            types[type_data['name']] = t
            if created:
                self.stdout.write(f'  Создан тип: {t.name}')

        return types

    def create_exercises(self, coach, categories, types):
        exercises_data = [
            # === ГРУДЬ ===
            {
                'name': 'Жим штанги лёжа',
                'category': 'Грудь',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['большая грудная', 'передняя дельта', 'трицепс'],
                'equipment': ['штанга', 'скамья'],
                'instructions': [
                    'Лягте на скамью, стопы плотно на полу',
                    'Возьмите штангу хватом шире плеч',
                    'Снимите штангу со стоек и опустите к груди',
                    'Выжмите штангу вверх до полного выпрямления рук',
                    'Контролируйте движение на всём протяжении'
                ],
                'default_parameters': {'sets': 4, 'reps': 10, 'weight': 60}
            },
            {
                'name': 'Жим гантелей лёжа',
                'category': 'Грудь',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['большая грудная', 'передняя дельта', 'трицепс'],
                'equipment': ['гантели', 'скамья'],
                'instructions': [
                    'Лягте на скамью с гантелями в руках',
                    'Выжмите гантели вверх',
                    'Медленно опустите к груди, разводя локти',
                    'Выжмите обратно вверх'
                ],
                'default_parameters': {'sets': 4, 'reps': 12, 'weight': 20}
            },
            {
                'name': 'Жим штанги на наклонной скамье',
                'category': 'Грудь',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['верхняя часть груди', 'передняя дельта', 'трицепс'],
                'equipment': ['штанга', 'наклонная скамья'],
                'instructions': [
                    'Установите скамью под углом 30-45 градусов',
                    'Лягте на скамью и возьмите штангу',
                    'Опустите штангу к верхней части груди',
                    'Выжмите вверх'
                ],
                'default_parameters': {'sets': 4, 'reps': 10, 'weight': 50}
            },
            {
                'name': 'Разводка гантелей лёжа',
                'category': 'Грудь',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['большая грудная'],
                'equipment': ['гантели', 'скамья'],
                'instructions': [
                    'Лягте на скамью с гантелями над грудью',
                    'Слегка согните локти',
                    'Разведите руки в стороны до уровня груди',
                    'Сведите руки обратно'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 12}
            },
            {
                'name': 'Отжимания от пола',
                'category': 'Грудь',
                'type': 'С собственным весом',
                'difficulty': 'beginner',
                'muscle_groups': ['большая грудная', 'трицепс', 'передняя дельта'],
                'equipment': [],
                'instructions': [
                    'Примите упор лёжа, руки шире плеч',
                    'Тело держите прямым',
                    'Опуститесь, сгибая руки в локтях',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 3, 'reps': 15}
            },
            {
                'name': 'Сведение рук в кроссовере',
                'category': 'Грудь',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['большая грудная'],
                'equipment': ['кроссовер'],
                'instructions': [
                    'Встаньте между блоками кроссовера',
                    'Возьмите рукоятки и слегка наклонитесь вперёд',
                    'Сведите руки перед собой',
                    'Медленно разведите обратно'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 15}
            },
            {
                'name': 'Отжимания на брусьях',
                'category': 'Грудь',
                'type': 'С собственным весом',
                'difficulty': 'intermediate',
                'muscle_groups': ['нижняя часть груди', 'трицепс'],
                'equipment': ['брусья'],
                'instructions': [
                    'Примите упор на брусьях',
                    'Наклоните корпус вперёд',
                    'Опуститесь, сгибая руки',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 3, 'reps': 12}
            },

            # === СПИНА ===
            {
                'name': 'Подтягивания широким хватом',
                'category': 'Спина',
                'type': 'С собственным весом',
                'difficulty': 'intermediate',
                'muscle_groups': ['широчайшие', 'бицепс', 'ромбовидные'],
                'equipment': ['турник'],
                'instructions': [
                    'Возьмитесь за турник широким хватом',
                    'Подтянитесь, подводя грудь к перекладине',
                    'Опуститесь контролируемо'
                ],
                'default_parameters': {'sets': 4, 'reps': 10}
            },
            {
                'name': 'Тяга штанги в наклоне',
                'category': 'Спина',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['широчайшие', 'ромбовидные', 'трапеция'],
                'equipment': ['штанга'],
                'instructions': [
                    'Наклонитесь вперёд, держа штангу',
                    'Спину держите прямой',
                    'Потяните штангу к животу',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 4, 'reps': 10, 'weight': 50}
            },
            {
                'name': 'Тяга гантели в наклоне',
                'category': 'Спина',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['широчайшие', 'ромбовидные'],
                'equipment': ['гантель', 'скамья'],
                'instructions': [
                    'Обопритесь одной рукой и коленом на скамью',
                    'Возьмите гантель свободной рукой',
                    'Потяните гантель к поясу',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 20}
            },
            {
                'name': 'Тяга верхнего блока к груди',
                'category': 'Спина',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['широчайшие', 'бицепс'],
                'equipment': ['блочный тренажёр'],
                'instructions': [
                    'Сядьте в тренажёр, зафиксируйте бёдра',
                    'Возьмите рукоятку широким хватом',
                    'Потяните рукоятку к груди',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 4, 'reps': 12, 'weight': 50}
            },
            {
                'name': 'Тяга нижнего блока к поясу',
                'category': 'Спина',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['широчайшие', 'ромбовидные'],
                'equipment': ['блочный тренажёр'],
                'instructions': [
                    'Сядьте в тренажёр, упритесь ногами',
                    'Возьмите V-образную рукоятку',
                    'Потяните к животу, сводя лопатки',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 4, 'reps': 12, 'weight': 45}
            },
            {
                'name': 'Становая тяга',
                'category': 'Спина',
                'type': 'Силовое',
                'difficulty': 'advanced',
                'muscle_groups': ['разгибатели спины', 'ягодицы', 'бицепс бедра', 'трапеция'],
                'equipment': ['штанга'],
                'instructions': [
                    'Встаньте перед штангой, ноги на ширине плеч',
                    'Наклонитесь и возьмите гриф',
                    'Выпрямитесь, поднимая штангу',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 4, 'reps': 8, 'weight': 80}
            },
            {
                'name': 'Гиперэкстензия',
                'category': 'Спина',
                'type': 'С собственным весом',
                'difficulty': 'beginner',
                'muscle_groups': ['разгибатели спины', 'ягодицы'],
                'equipment': ['римский стул'],
                'instructions': [
                    'Лягте на римский стул лицом вниз',
                    'Руки за головой или на груди',
                    'Опустите корпус вниз',
                    'Поднимитесь до прямой линии с ногами'
                ],
                'default_parameters': {'sets': 3, 'reps': 15}
            },
            {
                'name': 'Шраги со штангой',
                'category': 'Спина',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['трапеция'],
                'equipment': ['штанга'],
                'instructions': [
                    'Встаньте прямо, держа штангу перед собой',
                    'Поднимите плечи максимально вверх',
                    'Задержитесь на секунду',
                    'Опустите плечи'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 40}
            },

            # === НОГИ ===
            {
                'name': 'Приседания со штангой',
                'category': 'Ноги',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['квадрицепс', 'ягодицы', 'бицепс бедра'],
                'equipment': ['штанга', 'стойка для приседаний'],
                'instructions': [
                    'Положите штангу на трапецию',
                    'Ноги на ширине плеч',
                    'Присядьте до параллели бёдер с полом',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 4, 'reps': 10, 'weight': 60}
            },
            {
                'name': 'Жим ногами в тренажёре',
                'category': 'Ноги',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['квадрицепс', 'ягодицы'],
                'equipment': ['тренажёр для жима ногами'],
                'instructions': [
                    'Сядьте в тренажёр, спина прижата',
                    'Поставьте ноги на платформу',
                    'Выжмите платформу вверх',
                    'Согните ноги, опуская платформу'
                ],
                'default_parameters': {'sets': 4, 'reps': 12, 'weight': 100}
            },
            {
                'name': 'Выпады с гантелями',
                'category': 'Ноги',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['квадрицепс', 'ягодицы', 'бицепс бедра'],
                'equipment': ['гантели'],
                'instructions': [
                    'Встаньте прямо с гантелями в руках',
                    'Сделайте шаг вперёд',
                    'Опуститесь до угла 90 градусов в колене',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 12}
            },
            {
                'name': 'Разгибание ног в тренажёре',
                'category': 'Ноги',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['квадрицепс'],
                'equipment': ['тренажёр для разгибания ног'],
                'instructions': [
                    'Сядьте в тренажёр',
                    'Зафиксируйте ноги под валиком',
                    'Разогните ноги',
                    'Согните обратно контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 40}
            },
            {
                'name': 'Сгибание ног в тренажёре',
                'category': 'Ноги',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['бицепс бедра'],
                'equipment': ['тренажёр для сгибания ног'],
                'instructions': [
                    'Лягте на тренажёр лицом вниз',
                    'Зафиксируйте ноги под валиком',
                    'Согните ноги, подтягивая валик к ягодицам',
                    'Разогните контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 35}
            },
            {
                'name': 'Румынская тяга',
                'category': 'Ноги',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['бицепс бедра', 'ягодицы', 'разгибатели спины'],
                'equipment': ['штанга'],
                'instructions': [
                    'Встаньте прямо со штангой',
                    'Отведите таз назад, наклоняясь вперёд',
                    'Опустите штангу вдоль ног',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 4, 'reps': 10, 'weight': 50}
            },
            {
                'name': 'Болгарские сплит-приседания',
                'category': 'Ноги',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['квадрицепс', 'ягодицы'],
                'equipment': ['гантели', 'скамья'],
                'instructions': [
                    'Положите заднюю ногу на скамью',
                    'Передняя нога впереди',
                    'Присядьте на передней ноге',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 3, 'reps': 10, 'weight': 10}
            },
            {
                'name': 'Гакк-приседания',
                'category': 'Ноги',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['квадрицепс'],
                'equipment': ['гакк-машина'],
                'instructions': [
                    'Встаньте в тренажёр, плечи под упоры',
                    'Ноги на платформе',
                    'Присядьте до параллели',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 4, 'reps': 12, 'weight': 80}
            },

            # === ПЛЕЧИ ===
            {
                'name': 'Жим штанги стоя',
                'category': 'Плечи',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['передняя дельта', 'средняя дельта', 'трицепс'],
                'equipment': ['штанга'],
                'instructions': [
                    'Встаньте прямо, штанга на груди',
                    'Выжмите штангу вверх',
                    'Опустите обратно к груди'
                ],
                'default_parameters': {'sets': 4, 'reps': 10, 'weight': 40}
            },
            {
                'name': 'Жим гантелей сидя',
                'category': 'Плечи',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['передняя дельта', 'средняя дельта', 'трицепс'],
                'equipment': ['гантели', 'скамья'],
                'instructions': [
                    'Сядьте на скамью с опорой для спины',
                    'Гантели на уровне плеч',
                    'Выжмите гантели вверх',
                    'Опустите обратно'
                ],
                'default_parameters': {'sets': 4, 'reps': 12, 'weight': 16}
            },
            {
                'name': 'Разводка гантелей в стороны',
                'category': 'Плечи',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['средняя дельта'],
                'equipment': ['гантели'],
                'instructions': [
                    'Встаньте прямо, гантели в опущенных руках',
                    'Поднимите руки в стороны до уровня плеч',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 8}
            },
            {
                'name': 'Подъём гантелей перед собой',
                'category': 'Плечи',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['передняя дельта'],
                'equipment': ['гантели'],
                'instructions': [
                    'Встаньте прямо, гантели перед бёдрами',
                    'Поднимите руки перед собой до уровня плеч',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 8}
            },
            {
                'name': 'Разводка в наклоне',
                'category': 'Плечи',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['задняя дельта'],
                'equipment': ['гантели'],
                'instructions': [
                    'Наклонитесь вперёд, гантели внизу',
                    'Разведите руки в стороны',
                    'Сведите лопатки в верхней точке',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 6}
            },
            {
                'name': 'Тяга штанги к подбородку',
                'category': 'Плечи',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['средняя дельта', 'трапеция'],
                'equipment': ['штанга'],
                'instructions': [
                    'Встаньте прямо, штанга перед бёдрами',
                    'Потяните штангу вверх вдоль тела',
                    'Локти ведите выше кистей',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 25}
            },
            {
                'name': 'Обратные разведения в тренажёре',
                'category': 'Плечи',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['задняя дельта'],
                'equipment': ['тренажёр пек-дек'],
                'instructions': [
                    'Сядьте лицом к тренажёру',
                    'Возьмите рукоятки',
                    'Разведите руки назад',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 20}
            },

            # === БИЦЕПС ===
            {
                'name': 'Сгибание рук со штангой стоя',
                'category': 'Бицепс',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['бицепс', 'брахиалис'],
                'equipment': ['штанга'],
                'instructions': [
                    'Встаньте прямо, штанга в опущенных руках',
                    'Согните руки, поднимая штангу',
                    'Не раскачивайте корпус',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 25}
            },
            {
                'name': 'Сгибание рук с гантелями',
                'category': 'Бицепс',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['бицепс'],
                'equipment': ['гантели'],
                'instructions': [
                    'Встаньте или сядьте с гантелями',
                    'Согните руки, поднимая гантели',
                    'Супинируйте кисти в верхней точке',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 12}
            },
            {
                'name': 'Молотковые сгибания',
                'category': 'Бицепс',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['бицепс', 'брахиалис', 'брахиорадиалис'],
                'equipment': ['гантели'],
                'instructions': [
                    'Встаньте с гантелями, хват нейтральный',
                    'Согните руки, сохраняя положение кистей',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 12}
            },
            {
                'name': 'Сгибание рук на скамье Скотта',
                'category': 'Бицепс',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['бицепс'],
                'equipment': ['скамья Скотта', 'штанга или гантели'],
                'instructions': [
                    'Сядьте за скамью Скотта',
                    'Положите руки на подушку',
                    'Согните руки с отягощением',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 20}
            },
            {
                'name': 'Сгибание рук на блоке',
                'category': 'Бицепс',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['бицепс'],
                'equipment': ['блочный тренажёр'],
                'instructions': [
                    'Встаньте перед нижним блоком',
                    'Возьмите рукоятку',
                    'Согните руки',
                    'Разогните контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 25}
            },
            {
                'name': 'Концентрированные сгибания',
                'category': 'Бицепс',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['бицепс'],
                'equipment': ['гантель', 'скамья'],
                'instructions': [
                    'Сядьте на скамью, ноги широко',
                    'Упритесь локтем во внутреннюю часть бедра',
                    'Согните руку с гантелью',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 10}
            },

            # === ТРИЦЕПС ===
            {
                'name': 'Французский жим лёжа',
                'category': 'Трицепс',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['трицепс'],
                'equipment': ['штанга', 'скамья'],
                'instructions': [
                    'Лягте на скамью, штанга над головой',
                    'Согните руки, опуская штангу ко лбу',
                    'Разогните руки',
                    'Локти неподвижны'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 25}
            },
            {
                'name': 'Разгибание рук на блоке',
                'category': 'Трицепс',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['трицепс'],
                'equipment': ['блочный тренажёр'],
                'instructions': [
                    'Встаньте перед верхним блоком',
                    'Возьмите рукоятку, локти прижаты',
                    'Разогните руки вниз',
                    'Согните контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 30}
            },
            {
                'name': 'Разгибание руки с гантелью из-за головы',
                'category': 'Трицепс',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['трицепс'],
                'equipment': ['гантель'],
                'instructions': [
                    'Сядьте или встаньте, гантель над головой',
                    'Согните руку, опуская гантель за голову',
                    'Разогните руку',
                    'Локоть неподвижен'
                ],
                'default_parameters': {'sets': 3, 'reps': 12, 'weight': 10}
            },
            {
                'name': 'Отжимания узким хватом',
                'category': 'Трицепс',
                'type': 'С собственным весом',
                'difficulty': 'intermediate',
                'muscle_groups': ['трицепс', 'грудь'],
                'equipment': [],
                'instructions': [
                    'Примите упор лёжа, руки уже плеч',
                    'Опуститесь, прижимая локти к корпусу',
                    'Отожмитесь'
                ],
                'default_parameters': {'sets': 3, 'reps': 15}
            },
            {
                'name': 'Разгибание рук с канатом',
                'category': 'Трицепс',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['трицепс'],
                'equipment': ['блочный тренажёр', 'канатная рукоятка'],
                'instructions': [
                    'Возьмите канат на верхнем блоке',
                    'Локти прижаты к корпусу',
                    'Разогните руки, разводя концы каната',
                    'Согните контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 25}
            },
            {
                'name': 'Обратные отжимания от скамьи',
                'category': 'Трицепс',
                'type': 'С собственным весом',
                'difficulty': 'beginner',
                'muscle_groups': ['трицепс'],
                'equipment': ['скамья'],
                'instructions': [
                    'Обопритесь руками о скамью сзади',
                    'Ноги вытянуты вперёд',
                    'Опуститесь, сгибая руки',
                    'Отожмитесь'
                ],
                'default_parameters': {'sets': 3, 'reps': 15}
            },

            # === ПРЕСС ===
            {
                'name': 'Скручивания',
                'category': 'Пресс',
                'type': 'С собственным весом',
                'difficulty': 'beginner',
                'muscle_groups': ['прямая мышца живота'],
                'equipment': ['коврик'],
                'instructions': [
                    'Лягте на спину, колени согнуты',
                    'Руки за головой или на груди',
                    'Поднимите плечи, напрягая пресс',
                    'Опуститесь контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 20}
            },
            {
                'name': 'Подъём ног в висе',
                'category': 'Пресс',
                'type': 'С собственным весом',
                'difficulty': 'intermediate',
                'muscle_groups': ['прямая мышца живота', 'подвздошно-поясничная'],
                'equipment': ['турник'],
                'instructions': [
                    'Повисните на турнике',
                    'Поднимите прямые или согнутые ноги',
                    'Опустите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15}
            },
            {
                'name': 'Планка',
                'category': 'Пресс',
                'type': 'Статика',
                'difficulty': 'beginner',
                'muscle_groups': ['кор', 'прямая мышца живота'],
                'equipment': ['коврик'],
                'instructions': [
                    'Примите упор на предплечьях',
                    'Тело прямое от головы до пяток',
                    'Удерживайте положение'
                ],
                'default_parameters': {'sets': 3, 'duration': 60}
            },
            {
                'name': 'Боковая планка',
                'category': 'Пресс',
                'type': 'Статика',
                'difficulty': 'intermediate',
                'muscle_groups': ['косые мышцы живота', 'кор'],
                'equipment': ['коврик'],
                'instructions': [
                    'Лягте на бок, обопритесь на предплечье',
                    'Поднимите таз, выровняв тело',
                    'Удерживайте положение'
                ],
                'default_parameters': {'sets': 3, 'duration': 45}
            },
            {
                'name': 'Велосипед',
                'category': 'Пресс',
                'type': 'С собственным весом',
                'difficulty': 'beginner',
                'muscle_groups': ['прямая мышца живота', 'косые мышцы'],
                'equipment': ['коврик'],
                'instructions': [
                    'Лягте на спину, руки за головой',
                    'Поочерёдно подтягивайте колени к груди',
                    'Тянитесь локтем к противоположному колену'
                ],
                'default_parameters': {'sets': 3, 'reps': 20}
            },
            {
                'name': 'Скручивания на блоке',
                'category': 'Пресс',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['прямая мышца живота'],
                'equipment': ['блочный тренажёр', 'канатная рукоятка'],
                'instructions': [
                    'Встаньте на колени перед верхним блоком',
                    'Возьмите канат за головой',
                    'Скрутитесь вниз, напрягая пресс',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 30}
            },
            {
                'name': 'Подъём туловища на наклонной скамье',
                'category': 'Пресс',
                'type': 'С собственным весом',
                'difficulty': 'intermediate',
                'muscle_groups': ['прямая мышца живота', 'подвздошно-поясничная'],
                'equipment': ['наклонная скамья'],
                'instructions': [
                    'Лягте на наклонную скамью, ноги зафиксированы',
                    'Руки за головой или на груди',
                    'Поднимите туловище',
                    'Опуститесь контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15}
            },

            # === КАРДИО ===
            {
                'name': 'Бег на беговой дорожке',
                'category': 'Кардио',
                'type': 'Кардио',
                'difficulty': 'beginner',
                'muscle_groups': ['сердечно-сосудистая система', 'ноги'],
                'equipment': ['беговая дорожка'],
                'instructions': [
                    'Встаньте на дорожку',
                    'Начните с ходьбы для разминки',
                    'Увеличьте скорость до комфортного бега',
                    'Поддерживайте темп'
                ],
                'default_parameters': {'duration': 1800, 'distance': 5000, 'calories': 300}
            },
            {
                'name': 'Велотренажёр',
                'category': 'Кардио',
                'type': 'Кардио',
                'difficulty': 'beginner',
                'muscle_groups': ['сердечно-сосудистая система', 'квадрицепс'],
                'equipment': ['велотренажёр'],
                'instructions': [
                    'Отрегулируйте высоту сиденья',
                    'Начните крутить педали',
                    'Поддерживайте комфортный темп'
                ],
                'default_parameters': {'duration': 1800, 'distance': 10000, 'calories': 250}
            },
            {
                'name': 'Эллиптический тренажёр',
                'category': 'Кардио',
                'type': 'Кардио',
                'difficulty': 'beginner',
                'muscle_groups': ['сердечно-сосудистая система', 'ноги', 'руки'],
                'equipment': ['эллиптический тренажёр'],
                'instructions': [
                    'Встаньте на педали',
                    'Возьмитесь за рукоятки',
                    'Двигайтесь плавно, имитируя ходьбу'
                ],
                'default_parameters': {'duration': 1800, 'distance': 3000, 'calories': 280}
            },
            {
                'name': 'Гребной тренажёр',
                'category': 'Кардио',
                'type': 'Кардио',
                'difficulty': 'intermediate',
                'muscle_groups': ['сердечно-сосудистая система', 'спина', 'руки', 'ноги'],
                'equipment': ['гребной тренажёр'],
                'instructions': [
                    'Сядьте на тренажёр, ноги зафиксированы',
                    'Возьмите рукоятку',
                    'Оттолкнитесь ногами и потяните рукоятку',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'duration': 1200, 'distance': 2000, 'calories': 200}
            },
            {
                'name': 'Прыжки на скакалке',
                'category': 'Кардио',
                'type': 'Кардио',
                'difficulty': 'beginner',
                'muscle_groups': ['сердечно-сосудистая система', 'икры'],
                'equipment': ['скакалка'],
                'instructions': [
                    'Возьмите скакалку',
                    'Прыгайте, вращая скакалку',
                    'Приземляйтесь на носки'
                ],
                'default_parameters': {'duration': 600, 'distance': 0, 'calories': 150}
            },
            {
                'name': 'Берпи',
                'category': 'Кардио',
                'type': 'Плиометрика',
                'difficulty': 'advanced',
                'muscle_groups': ['всё тело'],
                'equipment': [],
                'instructions': [
                    'Встаньте прямо',
                    'Присядьте и упритесь руками в пол',
                    'Выпрыгните в упор лёжа',
                    'Отожмитесь и прыжком вернитесь',
                    'Выпрыгните вверх'
                ],
                'default_parameters': {'sets': 3, 'reps': 10}
            },

            # === ЯГОДИЦЫ ===
            {
                'name': 'Ягодичный мостик',
                'category': 'Ягодицы',
                'type': 'С собственным весом',
                'difficulty': 'beginner',
                'muscle_groups': ['ягодицы', 'бицепс бедра'],
                'equipment': ['коврик'],
                'instructions': [
                    'Лягте на спину, колени согнуты',
                    'Поднимите таз вверх, напрягая ягодицы',
                    'Задержитесь в верхней точке',
                    'Опуститесь контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15}
            },
            {
                'name': 'Ягодичный мостик со штангой',
                'category': 'Ягодицы',
                'type': 'Силовое',
                'difficulty': 'intermediate',
                'muscle_groups': ['ягодицы', 'бицепс бедра'],
                'equipment': ['штанга', 'скамья'],
                'instructions': [
                    'Обопритесь лопатками о скамью',
                    'Штанга на бёдрах',
                    'Поднимите таз вверх',
                    'Опуститесь контролируемо'
                ],
                'default_parameters': {'sets': 4, 'reps': 12, 'weight': 40}
            },
            {
                'name': 'Отведение ноги назад в кроссовере',
                'category': 'Ягодицы',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['ягодицы'],
                'equipment': ['кроссовер', 'манжета'],
                'instructions': [
                    'Прикрепите манжету к лодыжке',
                    'Встаньте лицом к тренажёру',
                    'Отведите ногу назад',
                    'Вернитесь в исходное положение'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 15}
            },
            {
                'name': 'Разведение ног в тренажёре',
                'category': 'Ягодицы',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['ягодицы', 'средняя ягодичная'],
                'equipment': ['тренажёр для разведения ног'],
                'instructions': [
                    'Сядьте в тренажёр',
                    'Ноги на упорах',
                    'Разведите ноги в стороны',
                    'Сведите контролируемо'
                ],
                'default_parameters': {'sets': 3, 'reps': 15, 'weight': 40}
            },

            # === ИКРЫ ===
            {
                'name': 'Подъём на носки стоя',
                'category': 'Икры',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['икроножная', 'камбаловидная'],
                'equipment': ['тренажёр для икр'],
                'instructions': [
                    'Встаньте в тренажёр, плечи под упоры',
                    'Поднимитесь на носки',
                    'Опуститесь, растягивая икры'
                ],
                'default_parameters': {'sets': 4, 'reps': 15, 'weight': 60}
            },
            {
                'name': 'Подъём на носки сидя',
                'category': 'Икры',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['камбаловидная'],
                'equipment': ['тренажёр для икр сидя'],
                'instructions': [
                    'Сядьте в тренажёр, колени под упором',
                    'Поднимитесь на носки',
                    'Опуститесь контролируемо'
                ],
                'default_parameters': {'sets': 4, 'reps': 15, 'weight': 40}
            },
            {
                'name': 'Подъём на носки с гантелями',
                'category': 'Икры',
                'type': 'Силовое',
                'difficulty': 'beginner',
                'muscle_groups': ['икроножная'],
                'equipment': ['гантели', 'степ-платформа'],
                'instructions': [
                    'Встаньте носками на край платформы',
                    'Гантели в руках',
                    'Поднимитесь на носки',
                    'Опуститесь ниже уровня платформы'
                ],
                'default_parameters': {'sets': 3, 'reps': 20, 'weight': 15}
            },
        ]

        created_count = 0
        for ex_data in exercises_data:
            category = categories.get(ex_data['category'])
            ex_type = types.get(ex_data['type'])

            exercise, created = Exercise.objects.get_or_create(
                coach=coach,
                name=ex_data['name'],
                defaults={
                    'category': category,
                    'exercise_type': ex_type,
                    'description': '',
                    'instructions': ex_data.get('instructions', []),
                    'muscle_groups': ex_data.get('muscle_groups', []),
                    'equipment': ex_data.get('equipment', []),
                    'difficulty': ex_data.get('difficulty', 'intermediate'),
                    'default_parameters': ex_data.get('default_parameters', {}),
                }
            )
            if created:
                created_count += 1

        self.stdout.write(f'  Создано упражнений: {created_count}')
