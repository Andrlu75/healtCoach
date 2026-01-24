from datetime import date, timedelta

from apps.accounts.models import Client
from apps.meals.models import Meal
from apps.metrics.models import HealthMetric


def collect_weekly_data(client: Client, week_start: date) -> dict:
    """Collect aggregated client data for a 7-day period."""
    week_end = week_start + timedelta(days=6)

    # Meals for the week
    meals = Meal.objects.filter(
        client=client,
        image_type='food',
        meal_time__date__gte=week_start,
        meal_time__date__lte=week_end,
    )

    total_calories = sum(m.calories or 0 for m in meals)
    total_proteins = sum(m.proteins or 0 for m in meals)
    total_fats = sum(m.fats or 0 for m in meals)
    total_carbs = sum(m.carbohydrates or 0 for m in meals)
    meals_count = meals.count()
    days_with_meals = meals.dates('meal_time', 'day').count()

    # Daily averages
    divisor = days_with_meals or 1
    avg_calories = round(total_calories / divisor, 1)
    avg_proteins = round(total_proteins / divisor, 1)
    avg_fats = round(total_fats / divisor, 1)
    avg_carbs = round(total_carbs / divisor, 1)

    # Norms
    norms = {
        'calories': client.daily_calories or 2000,
        'proteins': client.daily_proteins or 80,
        'fats': client.daily_fats or 70,
        'carbs': client.daily_carbs or 250,
    }

    avg_norm_percent = {
        'calories': round(avg_calories / norms['calories'] * 100) if norms['calories'] else 0,
        'proteins': round(avg_proteins / norms['proteins'] * 100) if norms['proteins'] else 0,
        'fats': round(avg_fats / norms['fats'] * 100) if norms['fats'] else 0,
        'carbs': round(avg_carbs / norms['carbs'] * 100) if norms['carbs'] else 0,
    }

    # Weight trend
    weight_metrics = list(HealthMetric.objects.filter(
        client=client,
        metric_type='weight',
        recorded_at__date__gte=week_start,
        recorded_at__date__lte=week_end,
    ).order_by('recorded_at').values_list('value', flat=True))

    weight_change = None
    if len(weight_metrics) >= 2:
        weight_change = round(weight_metrics[-1] - weight_metrics[0], 1)

    # All metrics summary
    metrics = list(HealthMetric.objects.filter(
        client=client,
        recorded_at__date__gte=week_start,
        recorded_at__date__lte=week_end,
    ).values('metric_type', 'value', 'unit', 'recorded_at'))

    return {
        'period_start': week_start.isoformat(),
        'period_end': week_end.isoformat(),
        'meals': {
            'total_count': meals_count,
            'days_with_meals': days_with_meals,
            'totals': {
                'calories': round(total_calories, 1),
                'proteins': round(total_proteins, 1),
                'fats': round(total_fats, 1),
                'carbs': round(total_carbs, 1),
            },
            'daily_avg': {
                'calories': avg_calories,
                'proteins': avg_proteins,
                'fats': avg_fats,
                'carbs': avg_carbs,
            },
        },
        'norms': norms,
        'avg_norm_percent': avg_norm_percent,
        'weight': {
            'measurements': weight_metrics,
            'change': weight_change,
        },
        'metrics': metrics,
    }
