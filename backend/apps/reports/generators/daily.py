from datetime import date, datetime, time

from django.utils import timezone

from apps.accounts.models import Client
from apps.chat.models import ChatMessage
from apps.meals.models import Meal
from apps.metrics.models import HealthMetric


def collect_daily_data(client: Client, target_date: date) -> dict:
    """Collect all client data for a single day."""
    day_start = timezone.make_aware(datetime.combine(target_date, time.min))
    day_end = timezone.make_aware(datetime.combine(target_date, time.max))

    # Meals
    meals_qs = Meal.objects.filter(
        client=client,
        image_type='food',
        meal_time__range=(day_start, day_end),
    ).values('dish_name', 'calories', 'proteins', 'fats', 'carbohydrates', 'meal_time')
    # Convert meal_time to string for JSON serialization
    meals = [
        {**m, 'meal_time': m['meal_time'].isoformat() if m['meal_time'] else None}
        for m in meals_qs
    ]

    total_calories = sum(m['calories'] or 0 for m in meals)
    total_proteins = sum(m['proteins'] or 0 for m in meals)
    total_fats = sum(m['fats'] or 0 for m in meals)
    total_carbs = sum(m['carbohydrates'] or 0 for m in meals)

    # Norms
    norms = {
        'calories': client.daily_calories or 2000,
        'proteins': client.daily_proteins or 80,
        'fats': client.daily_fats or 70,
        'carbs': client.daily_carbs or 250,
    }

    # Percent of norms
    norm_percent = {
        'calories': round(total_calories / norms['calories'] * 100) if norms['calories'] else 0,
        'proteins': round(total_proteins / norms['proteins'] * 100) if norms['proteins'] else 0,
        'fats': round(total_fats / norms['fats'] * 100) if norms['fats'] else 0,
        'carbs': round(total_carbs / norms['carbs'] * 100) if norms['carbs'] else 0,
    }

    # Metrics
    metrics = list(HealthMetric.objects.filter(
        client=client,
        recorded_at__range=(day_start, day_end),
    ).values('metric_type', 'value', 'unit'))

    # Messages count
    messages_count = ChatMessage.objects.filter(
        client=client,
        created_at__range=(day_start, day_end),
    ).count()

    return {
        'date': target_date.isoformat(),
        'meals': {
            'items': meals,
            'count': len(meals),
            'total': {
                'calories': round(total_calories, 1),
                'proteins': round(total_proteins, 1),
                'fats': round(total_fats, 1),
                'carbs': round(total_carbs, 1),
            },
        },
        'norms': norms,
        'norm_percent': norm_percent,
        'metrics': metrics,
        'messages_count': messages_count,
    }
