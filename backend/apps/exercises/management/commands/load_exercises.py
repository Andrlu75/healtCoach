import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Coach
from apps.exercises.models import Exercise, ExerciseCategory, ExerciseType


class Command(BaseCommand):
    help = 'Load exercises fixture for a specific coach'

    def add_arguments(self, parser):
        parser.add_argument(
            '--coach-id',
            type=int,
            help='Coach ID to assign exercises to (default: first coach)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Delete existing exercises before loading',
        )

    def handle(self, *args, **options):
        # Find coach
        coach_id = options.get('coach_id')
        if coach_id:
            try:
                coach = Coach.objects.get(id=coach_id)
            except Coach.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Coach with ID {coach_id} not found'))
                return
        else:
            coach = Coach.objects.first()
            if not coach:
                self.stdout.write(self.style.ERROR('No coaches found. Create a coach first.'))
                return

        self.stdout.write(f'Loading exercises for coach: {coach.user.email} (id={coach.id})')

        # Load fixture
        fixture_path = Path(__file__).resolve().parent.parent.parent / 'fixtures' / 'exercises_full.json'
        self.stdout.write(f'Looking for fixture at: {fixture_path}')
        if not fixture_path.exists():
            self.stdout.write(self.style.ERROR(f'Fixture not found: {fixture_path}'))
            # Try alternative path
            alt_path = Path(__file__).resolve().parent.parent.parent.parent / 'exercises' / 'fixtures' / 'exercises_full.json'
            self.stdout.write(f'Trying alternative path: {alt_path}')
            if alt_path.exists():
                fixture_path = alt_path
            else:
                return

        with open(fixture_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Group by model
        categories_data = [d for d in data if d['model'] == 'exercises.exercisecategory']
        types_data = [d for d in data if d['model'] == 'exercises.exercisetype']
        exercises_data = [d for d in data if d['model'] == 'exercises.exercise']

        self.stdout.write(f'Found: {len(categories_data)} categories, {len(types_data)} types, {len(exercises_data)} exercises')

        # Delete existing if force
        if options.get('force'):
            deleted = Exercise.objects.filter(coach=coach).delete()
            self.stdout.write(f'Deleted {deleted[0]} existing exercises')
            deleted = ExerciseType.objects.filter(coach=coach).delete()
            self.stdout.write(f'Deleted {deleted[0]} existing types')
            deleted = ExerciseCategory.objects.filter(coach=coach).delete()
            self.stdout.write(f'Deleted {deleted[0]} existing categories')

        # Mapping old PK -> new PK
        category_map = {}
        type_map = {}

        with transaction.atomic():
            # Load categories
            for item in categories_data:
                old_pk = item['pk']
                fields = item['fields']

                cat, created = ExerciseCategory.objects.get_or_create(
                    coach=coach,
                    name=fields['name'],
                    defaults={
                        'description': fields.get('description', ''),
                        'color': fields.get('color', '#3B82F6'),
                        'icon': fields.get('icon', ''),
                        'order': fields.get('order', 0),
                        'is_active': fields.get('is_active', True),
                    }
                )
                category_map[old_pk] = cat.id
                if created:
                    self.stdout.write(f'  Created category: {cat.name}')

            # Load types
            for item in types_data:
                old_pk = item['pk']
                fields = item['fields']

                etype, created = ExerciseType.objects.get_or_create(
                    coach=coach,
                    name=fields['name'],
                    defaults={
                        'description': fields.get('description', ''),
                        'parameters': fields.get('parameters', []),
                        'is_active': fields.get('is_active', True),
                    }
                )
                type_map[old_pk] = etype.id
                if created:
                    self.stdout.write(f'  Created type: {etype.name}')

            # Load exercises
            created_count = 0
            skipped_count = 0

            for item in exercises_data:
                fields = item['fields']
                name = fields['name']

                # Check if exists
                if Exercise.objects.filter(coach=coach, name=name).exists():
                    skipped_count += 1
                    continue

                # Map foreign keys
                category_id = category_map.get(fields.get('category'))
                type_id = type_map.get(fields.get('exercise_type'))

                Exercise.objects.create(
                    coach=coach,
                    category_id=category_id,
                    exercise_type_id=type_id,
                    name=name,
                    description=fields.get('description', ''),
                    instructions=fields.get('instructions', []),
                    video_url=fields.get('video_url', ''),
                    media_type=fields.get('media_type', 'image'),
                    default_parameters=fields.get('default_parameters', {}),
                    muscle_groups=fields.get('muscle_groups', []),
                    equipment=fields.get('equipment', []),
                    difficulty=fields.get('difficulty', 'intermediate'),
                    is_active=fields.get('is_active', True),
                )
                created_count += 1

            self.stdout.write(self.style.SUCCESS(
                f'Done! Created {created_count} exercises, skipped {skipped_count} duplicates'
            ))
