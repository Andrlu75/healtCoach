from rest_framework import serializers
from apps.workouts.models import TrainingSchedule, TrainingProgram, ProgramWorkout
from .workouts import ClientWorkoutListSerializer


class TrainingScheduleSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.__str__', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True)
    days_display = serializers.SerializerMethodField()

    class Meta:
        model = TrainingSchedule
        fields = [
            'id', 'client', 'client_name', 'name',
            'days_of_week', 'days_display', 'time',
            'template', 'template_name',
            'is_active', 'start_date', 'end_date', 'created_at'
        ]

    def get_days_display(self, obj):
        days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
        return [days[d] for d in obj.days_of_week if d < len(days)]

    def validate_client(self, value):
        if value.coach != self.context['request'].user.coach_profile:
            raise serializers.ValidationError("Клиент не найден")
        return value

    def validate_template(self, value):
        if value and value.coach != self.context['request'].user.coach_profile:
            raise serializers.ValidationError("Шаблон не найден")
        return value


class ProgramWorkoutSerializer(serializers.ModelSerializer):
    workout_detail = ClientWorkoutListSerializer(source='workout', read_only=True)
    day_display = serializers.SerializerMethodField()

    class Meta:
        model = ProgramWorkout
        fields = [
            'id', 'workout', 'workout_detail',
            'week_number', 'day_of_week', 'day_display'
        ]

    def get_day_display(self, obj):
        days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
        return days[obj.day_of_week] if obj.day_of_week < len(days) else ''


class TrainingProgramListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.__str__', read_only=True)
    workouts_count = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = TrainingProgram
        fields = [
            'id', 'client', 'client_name', 'name', 'description',
            'duration_weeks', 'status', 'start_date', 'current_week',
            'workouts_count', 'progress_percentage', 'created_at'
        ]

    def get_workouts_count(self, obj):
        return obj.program_workouts.count()

    def get_progress_percentage(self, obj):
        if obj.duration_weeks == 0:
            return 0
        return round((obj.current_week - 1) / obj.duration_weeks * 100)


class TrainingProgramDetailSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.__str__', read_only=True)
    program_workouts = ProgramWorkoutSerializer(many=True, read_only=True)
    weeks = serializers.SerializerMethodField()

    class Meta:
        model = TrainingProgram
        fields = [
            'id', 'client', 'client_name', 'name', 'description',
            'duration_weeks', 'status', 'start_date', 'current_week',
            'program_workouts', 'weeks', 'created_at', 'updated_at'
        ]

    def get_weeks(self, obj):
        """Возвращает тренировки сгруппированные по неделям"""
        weeks = {}
        for pw in obj.program_workouts.select_related('workout'):
            week = pw.week_number
            if week not in weeks:
                weeks[week] = []
            weeks[week].append(ProgramWorkoutSerializer(pw).data)
        return weeks
