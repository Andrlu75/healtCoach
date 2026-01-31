from django.core.management.base import BaseCommand
from apps.accounts.models import User, Coach
from apps.exercises.models import Exercise


class Command(BaseCommand):
    help = 'Fix admin user coach relationship and exercises ownership'

    def handle(self, *args, **options):
        # Find admin user
        admin = User.objects.filter(username='admin').first()
        if not admin:
            self.stdout.write(self.style.ERROR('Admin user not found'))
            return

        self.stdout.write(f'Admin user id: {admin.id}')

        # Check if admin has coach profile
        try:
            coach = admin.coach_profile
            self.stdout.write(f'Admin coach id: {coach.id}')
        except Coach.DoesNotExist:
            self.stdout.write(self.style.WARNING('Admin has no coach profile, creating...'))
            coach = Coach.objects.create(
                user=admin,
                business_name='Health Coach',
            )
            self.stdout.write(self.style.SUCCESS(f'Created coach id: {coach.id}'))

        # Show all coaches
        self.stdout.write('\nAll coaches:')
        for c in Coach.objects.all():
            self.stdout.write(f'  Coach id={c.id}, user={c.user.username}')

        # Check exercises
        total = Exercise.objects.count()
        self.stdout.write(f'\nTotal exercises: {total}')

        coach_ids = Exercise.objects.values_list('coach_id', flat=True).distinct()
        self.stdout.write(f'Exercise coach_ids: {list(coach_ids)}')

        # Update exercises to belong to admin's coach
        if total > 0:
            updated = Exercise.objects.exclude(coach=coach).update(coach=coach)
            self.stdout.write(self.style.SUCCESS(f'Updated {updated} exercises to coach id={coach.id}'))

        # Verify
        admin_exercises = Exercise.objects.filter(coach=coach).count()
        self.stdout.write(f'Exercises now owned by admin coach: {admin_exercises}')
