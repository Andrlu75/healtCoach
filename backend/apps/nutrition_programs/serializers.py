from rest_framework import serializers

from .models import MealComplianceCheck, MealReport, NutritionProgram, NutritionProgramDay


class NutritionProgramDaySerializer(serializers.ModelSerializer):
    """Serializer для дня программы питания."""

    class Meta:
        model = NutritionProgramDay
        fields = [
            'id',
            'day_number',
            'date',
            'meals',
            'activity',
            'allowed_ingredients',
            'forbidden_ingredients',
            'notes',
        ]
        read_only_fields = ['id']


class NutritionProgramSerializer(serializers.ModelSerializer):
    """Serializer для списка программ питания."""

    client_name = serializers.SerializerMethodField()
    days_count = serializers.SerializerMethodField()
    compliance_rate = serializers.SerializerMethodField()
    current_day = serializers.SerializerMethodField()

    class Meta:
        model = NutritionProgram
        fields = [
            'id',
            'client',
            'client_name',
            'name',
            'description',
            'general_notes',
            'start_date',
            'end_date',
            'duration_days',
            'status',
            'days_count',
            'compliance_rate',
            'current_day',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'coach', 'end_date', 'created_at', 'updated_at']

    def get_client_name(self, obj) -> str:
        return f'{obj.client.first_name} {obj.client.last_name}'.strip()

    def get_days_count(self, obj) -> int:
        if hasattr(obj, '_days_count'):
            return obj._days_count
        return obj.days.count()

    def get_compliance_rate(self, obj) -> float | None:
        """Процент соблюдения программы."""
        # Используем аннотации если доступны (избегаем N+1)
        if hasattr(obj, '_total_checks') and hasattr(obj, '_compliant_checks'):
            total = obj._total_checks
            if total == 0:
                return None
            return round(obj._compliant_checks / total * 100, 1)
        # Fallback для случаев без аннотаций (retrieve, etc.)
        checks = MealComplianceCheck.objects.filter(program_day__program=obj)
        total = checks.count()
        if total == 0:
            return None
        compliant = checks.filter(is_compliant=True).count()
        return round(compliant / total * 100, 1)

    def get_current_day(self, obj) -> int | None:
        """Номер текущего дня программы (1-based) или None если вне диапазона."""
        from datetime import date

        today = date.today()
        if obj.start_date <= today <= obj.end_date:
            return (today - obj.start_date).days + 1
        return None


class NutritionProgramDetailSerializer(NutritionProgramSerializer):
    """Подробный serializer с днями программы."""

    days = NutritionProgramDaySerializer(many=True, read_only=True)

    class Meta(NutritionProgramSerializer.Meta):
        fields = NutritionProgramSerializer.Meta.fields + ['days']


class NutritionProgramCreateSerializer(serializers.ModelSerializer):
    """Serializer для создания программы."""

    days = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        help_text='Список дней с ингредиентами',
    )

    class Meta:
        model = NutritionProgram
        fields = [
            'client',
            'name',
            'description',
            'general_notes',
            'start_date',
            'duration_days',
            'days',
        ]

    def validate_client(self, value):
        """Проверяем, что клиент принадлежит коучу."""
        request = self.context.get('request')
        if request and value.coach != request.user.coach_profile:
            raise serializers.ValidationError('Клиент не найден')
        return value

    def validate(self, attrs):
        """Проверяем что программа не пересекается с активными программами клиента."""
        from datetime import timedelta

        client = attrs.get('client')
        start_date = attrs.get('start_date')
        duration_days = attrs.get('duration_days')

        if client and start_date and duration_days:
            end_date = start_date + timedelta(days=duration_days - 1)

            # Проверяем пересечение с активными программами
            overlapping = NutritionProgram.objects.filter(
                client=client,
                status='active',
                start_date__lte=end_date,
                end_date__gte=start_date,
            )

            # Исключаем текущую программу при обновлении
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)

            if overlapping.exists():
                program = overlapping.first()
                raise serializers.ValidationError({
                    'start_date': f'Даты пересекаются с активной программой "{program.name}" '
                                  f'({program.start_date} - {program.end_date})'
                })

        return attrs

    def create(self, validated_data):
        days_data = validated_data.pop('days', [])
        request = self.context.get('request')
        validated_data['coach'] = request.user.coach_profile

        program = NutritionProgram.objects.create(**validated_data)

        # Создаём дни программы
        from datetime import timedelta

        for i in range(program.duration_days):
            day_data = days_data[i] if i < len(days_data) else {}
            NutritionProgramDay.objects.create(
                program=program,
                day_number=i + 1,
                date=program.start_date + timedelta(days=i),
                meals=day_data.get('meals', []),
                activity=day_data.get('activity', ''),
                allowed_ingredients=day_data.get('allowed_ingredients', []),
                forbidden_ingredients=day_data.get('forbidden_ingredients', []),
                notes=day_data.get('notes', ''),
            )

        return program

    def update(self, instance, validated_data):
        """Обновление программы с днями."""
        days_data = validated_data.pop('days', None)

        # Обновляем основные поля
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Обновляем дни если переданы
        if days_data is not None:
            for day_data in days_data:
                day_number = day_data.get('day_number')
                if day_number:
                    # Обновляем только переданные поля, чтобы не затирать существующие данные
                    update_fields = {}
                    if 'meals' in day_data:
                        update_fields['meals'] = day_data['meals']
                    if 'activity' in day_data:
                        update_fields['activity'] = day_data['activity']
                    if 'allowed_ingredients' in day_data:
                        update_fields['allowed_ingredients'] = day_data['allowed_ingredients']
                    if 'forbidden_ingredients' in day_data:
                        update_fields['forbidden_ingredients'] = day_data['forbidden_ingredients']
                    if 'notes' in day_data:
                        update_fields['notes'] = day_data['notes']

                    if update_fields:
                        NutritionProgramDay.objects.filter(
                            program=instance, day_number=day_number
                        ).update(**update_fields)

        return instance

    def to_representation(self, instance):
        """Использовать детальный сериализатор для ответа."""
        return NutritionProgramDetailSerializer(instance, context=self.context).data


class NutritionProgramDayUpdateSerializer(serializers.ModelSerializer):
    """Serializer для обновления дня программы."""

    class Meta:
        model = NutritionProgramDay
        fields = [
            'meals',
            'activity',
            'allowed_ingredients',
            'forbidden_ingredients',
            'notes',
        ]


class MealComplianceCheckSerializer(serializers.ModelSerializer):
    """Serializer для проверки соответствия."""

    meal_name = serializers.CharField(source='meal.dish_name', read_only=True)
    meal_time = serializers.DateTimeField(source='meal.meal_time', read_only=True)
    program_name = serializers.CharField(source='program_day.program.name', read_only=True)
    day_number = serializers.IntegerField(source='program_day.day_number', read_only=True)

    class Meta:
        model = MealComplianceCheck
        fields = [
            'id',
            'meal',
            'meal_name',
            'meal_time',
            'program_day',
            'program_name',
            'day_number',
            'is_compliant',
            'found_forbidden',
            'found_allowed',
            'ai_comment',
            'coach_notified',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ComplianceStatsSerializer(serializers.Serializer):
    """Serializer для статистики соблюдения."""

    program_id = serializers.IntegerField()
    program_name = serializers.CharField()
    client_name = serializers.CharField()
    total_meals = serializers.IntegerField()
    compliant_meals = serializers.IntegerField()
    violations = serializers.IntegerField()
    compliance_rate = serializers.FloatField()
    most_common_violations = serializers.ListField(child=serializers.CharField())


class MealReportSerializer(serializers.ModelSerializer):
    """Serializer для фото-отчёта о приёме пищи."""

    meal_type_display = serializers.CharField(source='get_meal_type_display', read_only=True)
    program_name = serializers.CharField(source='program_day.program.name', read_only=True)
    day_number = serializers.IntegerField(source='program_day.day_number', read_only=True)

    class Meta:
        model = MealReport
        fields = [
            'id',
            'program_day',
            'meal_type',
            'meal_type_display',
            'meal_time',
            'photo_file_id',
            'photo_url',
            'planned_description',
            'recognized_ingredients',
            'is_compliant',
            'compliance_score',
            'ai_analysis',
            'program_name',
            'day_number',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'planned_description',
            'recognized_ingredients',
            'is_compliant',
            'compliance_score',
            'ai_analysis',
            'created_at',
        ]


class MealReportCreateSerializer(serializers.Serializer):
    """Serializer для создания фото-отчёта."""

    meal_type = serializers.ChoiceField(choices=MealReport.MEAL_TYPE_CHOICES)
    photo_file_id = serializers.CharField(required=False, allow_blank=True)
    photo_url = serializers.URLField(required=False, allow_blank=True)
    photo_base64 = serializers.CharField(required=False, allow_blank=True)
    date = serializers.DateField(
        required=False,
        help_text='Дата отчёта (опционально, по умолчанию сегодня). Формат: YYYY-MM-DD',
    )

    def validate(self, attrs):
        """Проверяем что передано хотя бы одно из полей фото."""
        if not any([
            attrs.get('photo_file_id'),
            attrs.get('photo_url'),
            attrs.get('photo_base64'),
        ]):
            raise serializers.ValidationError(
                'Необходимо передать photo_file_id, photo_url или photo_base64'
            )
        return attrs
