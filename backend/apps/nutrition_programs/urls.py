from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ComplianceStatsViewSet, NutritionProgramDayViewSet, NutritionProgramViewSet

router = DefaultRouter()
router.register('programs', NutritionProgramViewSet, basename='nutrition-program')
router.register('stats', ComplianceStatsViewSet, basename='compliance-stats')

# Дни программы как отдельный viewset с передачей program_pk через URL
urlpatterns = [
    path('', include(router.urls)),
    path(
        'programs/<int:program_pk>/days/',
        NutritionProgramDayViewSet.as_view({'get': 'list'}),
        name='program-days-list',
    ),
    path(
        'programs/<int:program_pk>/days/<int:pk>/',
        NutritionProgramDayViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update'}),
        name='program-days-detail',
    ),
    path(
        'programs/<int:program_pk>/days/<int:pk>/copy/',
        NutritionProgramDayViewSet.as_view({'post': 'copy'}),
        name='program-days-copy',
    ),
    path(
        'programs/<int:program_pk>/days/<int:pk>/generate-shopping-list/',
        NutritionProgramDayViewSet.as_view({'post': 'generate_shopping_list'}),
        name='program-days-generate-shopping-list',
    ),
    path(
        'programs/<int:program_pk>/days/<int:pk>/analyze-products/',
        NutritionProgramDayViewSet.as_view({'post': 'analyze_products'}),
        name='program-days-analyze-products',
    ),
]
