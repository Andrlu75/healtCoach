from datetime import date

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Meal
from .serializers import MealSerializer
from apps.accounts.models import Client


class MealListView(APIView):
    """List meals for a coach's clients."""

    def get(self, request):
        coach = request.user.coach_profile
        client_id = request.query_params.get('client_id')
        date_str = request.query_params.get('date')

        queryset = Meal.objects.filter(client__coach=coach)

        if client_id:
            queryset = queryset.filter(client_id=client_id)

        if date_str:
            try:
                target_date = date.fromisoformat(date_str)
            except ValueError:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = queryset.filter(meal_time__date=target_date)

        meals = queryset[:50]
        serializer = MealSerializer(meals, many=True)
        return Response(serializer.data)


class DailySummaryView(APIView):
    """Get daily nutrition summary for a client."""

    def get(self, request):
        coach = request.user.coach_profile
        client_id = request.query_params.get('client_id')

        if not client_id:
            return Response(
                {'error': 'client_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify client belongs to this coach
        from apps.accounts.models import Client
        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response(
                {'error': 'Client not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = date.fromisoformat(date_str)
            except ValueError:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            target_date = timezone.localdate()

        # Calculate summary
        meals = Meal.objects.filter(
            client=client,
            image_type='food',
            meal_time__date=target_date,
        )

        consumed = {
            'calories': sum(m.calories or 0 for m in meals),
            'proteins': sum(m.proteins or 0 for m in meals),
            'fats': sum(m.fats or 0 for m in meals),
            'carbohydrates': sum(m.carbohydrates or 0 for m in meals),
            'meals_count': meals.count(),
        }

        norms = {
            'calories': client.daily_calories or 2000,
            'proteins': client.daily_proteins or 80,
            'fats': client.daily_fats or 70,
            'carbohydrates': client.daily_carbs or 250,
        }

        remaining = {
            'calories': round(norms['calories'] - consumed['calories'], 1),
            'proteins': round(norms['proteins'] - consumed['proteins'], 1),
            'fats': round(norms['fats'] - consumed['fats'], 1),
            'carbohydrates': round(norms['carbohydrates'] - consumed['carbohydrates'], 1),
        }

        return Response({
            'date': target_date.isoformat(),
            'consumed': consumed,
            'norms': norms,
            'remaining': remaining,
        })


class TodayMealsDashboardView(APIView):
    """Get today's meals for all clients - for dashboard display."""

    def get(self, request):
        coach = request.user.coach_profile
        target_date = timezone.localdate()

        # Get all active clients
        clients = Client.objects.filter(coach=coach, status='active').order_by('first_name')

        result = []
        for client in clients:
            # Get meals for this client today
            meals = Meal.objects.filter(
                client=client,
                image_type='food',
                meal_time__date=target_date,
            ).order_by('meal_time')

            meals_data = []
            for meal in meals:
                meals_data.append({
                    'id': meal.id,
                    'dish_name': meal.dish_name or 'Без названия',
                    'dish_type': meal.dish_type or '',
                    'calories': meal.calories or 0,
                    'proteins': meal.proteins or 0,
                    'fats': meal.fats or 0,
                    'carbs': meal.carbohydrates or 0,
                    'meal_time': meal.meal_time.strftime('%H:%M') if meal.meal_time else '',
                    'thumbnail': meal.thumbnail.url if meal.thumbnail else (meal.image.url if meal.image else None),
                })

            # Calculate totals
            totals = {
                'calories': sum(m.calories or 0 for m in meals),
                'proteins': sum(m.proteins or 0 for m in meals),
                'fats': sum(m.fats or 0 for m in meals),
                'carbs': sum(m.carbohydrates or 0 for m in meals),
            }

            # Get norms
            norms = {
                'calories': client.daily_calories or 2000,
                'proteins': client.daily_proteins or 80,
                'fats': client.daily_fats or 70,
                'carbs': client.daily_carbs or 250,
            }

            result.append({
                'client_id': client.id,
                'client_name': f"{client.first_name or ''} {client.last_name or ''}".strip() or f"Клиент #{client.id}",
                'meals': meals_data,
                'totals': totals,
                'norms': norms,
            })

        return Response({
            'date': target_date.isoformat(),
            'clients': result,
        })
