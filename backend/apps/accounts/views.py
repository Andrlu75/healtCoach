from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Client, Coach
from .serializers import ClientSerializer, ClientDetailSerializer, CoachSerializer


class CoachProfileView(viewsets.GenericViewSet):
    serializer_class = CoachSerializer

    def get_object(self):
        return self.request.user.coach_profile

    def list(self, request):
        coach = self.get_object()
        serializer = self.get_serializer(coach)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        coach = self.get_object()
        serializer = self.get_serializer(coach, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['first_name', 'last_name', 'telegram_username']
    ordering_fields = ['created_at', 'first_name', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        return Client.objects.filter(coach=self.request.user.coach_profile)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ClientDetailSerializer
        return ClientSerializer

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        client = self.get_object()
        client.status = 'paused'
        client.save(update_fields=['status'])
        return Response({'status': 'paused'})

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        client = self.get_object()
        client.status = 'active'
        client.save(update_fields=['status'])
        return Response({'status': 'active'})

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        client = self.get_object()
        client.status = 'archived'
        client.save(update_fields=['status'])
        return Response({'status': 'archived'})
