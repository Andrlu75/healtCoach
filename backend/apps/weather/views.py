from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_weather


class WeatherView(APIView):
    """Get current weather by city."""

    def get(self, request):
        city = request.query_params.get('city', '').strip()

        if not city:
            # Try client's city
            if hasattr(request.user, 'coach_profile'):
                client_id = request.query_params.get('client_id')
                if client_id:
                    from apps.accounts.models import Client
                    try:
                        client = Client.objects.get(
                            pk=client_id, coach=request.user.coach_profile
                        )
                        city = client.city
                    except Client.DoesNotExist:
                        pass

        if not city:
            return Response({'error': 'city parameter is required'}, status=400)

        weather = get_weather(city)
        if not weather:
            return Response({'error': 'Could not fetch weather'}, status=502)

        return Response(weather)
