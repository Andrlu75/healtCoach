"""
FitDB API for workouts - simplified interface without blocks abstraction
"""
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction

from apps.workouts.models import WorkoutTemplate, WorkoutTemplateBlock, WorkoutTemplateExercise
from apps.exercises.models import Exercise
from apps.accounts.models import Coach


class FitDBWorkoutSerializer(serializers.ModelSerializer):
    """Serializer for FitDB workout format"""
    is_template = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutTemplate
        fields = ['id', 'name', 'description', 'is_template', 'is_favorite', 'created_at', 'updated_at']

    def get_is_template(self, obj):
        return True  # All WorkoutTemplates are templates

    def get_is_favorite(self, obj):
        return False  # Not implemented yet


class FitDBWorkoutExerciseSerializer(serializers.Serializer):
    """Serializer for FitDB workout exercise format"""
    id = serializers.IntegerField(read_only=True)
    workout_id = serializers.SerializerMethodField()
    exercise_id = serializers.SerializerMethodField()
    sets = serializers.SerializerMethodField()
    reps = serializers.SerializerMethodField()
    rest_seconds = serializers.SerializerMethodField()
    weight_kg = serializers.SerializerMethodField()
    notes = serializers.CharField(allow_blank=True, required=False)
    order_index = serializers.SerializerMethodField()

    def get_workout_id(self, obj):
        return obj.block.template_id

    def get_exercise_id(self, obj):
        return obj.exercise_id

    def get_sets(self, obj):
        return obj.parameters.get('sets', 3)

    def get_reps(self, obj):
        return obj.parameters.get('reps', 10)

    def get_rest_seconds(self, obj):
        return obj.rest_after

    def get_weight_kg(self, obj):
        return obj.parameters.get('weight_kg')

    def get_order_index(self, obj):
        return obj.order


class FitDBWorkoutViewSet(viewsets.ModelViewSet):
    """Public FitDB API for workouts (templates)"""
    permission_classes = [AllowAny]
    serializer_class = FitDBWorkoutSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return WorkoutTemplate.objects.filter(is_active=True)

    def create(self, request, *args, **kwargs):
        data = request.data
        coach = Coach.objects.first()
        if not coach:
            return Response({'error': 'No coach found'}, status=400)

        with transaction.atomic():
            template = WorkoutTemplate.objects.create(
                coach=coach,
                name=data.get('name', 'Новая тренировка'),
                description=data.get('description', ''),
            )
            # Create default main block
            WorkoutTemplateBlock.objects.create(
                template=template,
                name='Основная часть',
                block_type='main',
                order=0,
            )

        serializer = self.get_serializer(template)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = request.data

        if 'name' in data:
            instance.name = data['name']
        if 'description' in data:
            instance.description = data['description']
        instance.save()

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class FitDBWorkoutExerciseViewSet(viewsets.ModelViewSet):
    """Public FitDB API for workout exercises"""
    permission_classes = [AllowAny]
    serializer_class = FitDBWorkoutExerciseSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ['order']
    ordering = ['order']

    def get_queryset(self):
        queryset = WorkoutTemplateExercise.objects.select_related('block__template', 'exercise')
        workout_id = self.request.query_params.get('workout_id')
        if workout_id:
            queryset = queryset.filter(block__template_id=workout_id)
        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data

        # Support bulk insert (array of exercises)
        if isinstance(data, list):
            return self._bulk_create(data)

        workout_id = data.get('workout_id')

        if not workout_id:
            return Response({'error': 'workout_id is required'}, status=400)

        # Get or create main block
        try:
            template = WorkoutTemplate.objects.get(id=workout_id)
        except WorkoutTemplate.DoesNotExist:
            return Response({'error': 'Workout not found'}, status=404)

        block = template.blocks.filter(block_type='main').first()
        if not block:
            block = WorkoutTemplateBlock.objects.create(
                template=template,
                name='Основная часть',
                block_type='main',
                order=0,
            )

        # Get exercise
        exercise_id = data.get('exercise_id')
        try:
            exercise = Exercise.objects.get(id=exercise_id)
        except Exercise.DoesNotExist:
            return Response({'error': 'Exercise not found'}, status=404)

        # Create workout exercise
        template_exercise = WorkoutTemplateExercise.objects.create(
            block=block,
            exercise=exercise,
            order=data.get('order_index', 0),
            parameters={
                'sets': data.get('sets', 3),
                'reps': data.get('reps', 10),
                'weight_kg': data.get('weight_kg'),
            },
            rest_after=data.get('rest_seconds', 60),
            notes=data.get('notes', ''),
        )

        serializer = self.get_serializer(template_exercise)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _bulk_create(self, items):
        """Bulk create workout exercises"""
        if not items:
            return Response([], status=status.HTTP_201_CREATED)

        workout_id = items[0].get('workout_id')
        if not workout_id:
            return Response({'error': 'workout_id is required'}, status=400)

        try:
            template = WorkoutTemplate.objects.get(id=workout_id)
        except WorkoutTemplate.DoesNotExist:
            return Response({'error': 'Workout not found'}, status=404)

        block = template.blocks.filter(block_type='main').first()
        if not block:
            block = WorkoutTemplateBlock.objects.create(
                template=template,
                name='Основная часть',
                block_type='main',
                order=0,
            )

        created = []
        with transaction.atomic():
            for item in items:
                exercise_id = item.get('exercise_id')
                try:
                    exercise = Exercise.objects.get(id=exercise_id)
                except Exercise.DoesNotExist:
                    continue

                template_exercise = WorkoutTemplateExercise.objects.create(
                    block=block,
                    exercise=exercise,
                    order=item.get('order_index', 0),
                    parameters={
                        'sets': item.get('sets', 3),
                        'reps': item.get('reps', 10),
                        'weight_kg': item.get('weight_kg'),
                    },
                    rest_after=item.get('rest_seconds', 60),
                    notes=item.get('notes', ''),
                )
                created.append(template_exercise)

        serializer = self.get_serializer(created, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def list(self, request, *args, **kwargs):
        # Support DELETE on list with workout_id filter
        if request.method == 'DELETE':
            workout_id = request.query_params.get('workout_id')
            if workout_id:
                WorkoutTemplateExercise.objects.filter(block__template_id=workout_id).delete()
                return Response(status=status.HTTP_204_NO_CONTENT)

        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['delete'])
    def bulk_delete(self, request):
        """Delete all exercises for a workout"""
        workout_id = request.query_params.get('workout_id')
        if not workout_id:
            return Response({'error': 'workout_id is required'}, status=400)
        WorkoutTemplateExercise.objects.filter(block__template_id=workout_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
