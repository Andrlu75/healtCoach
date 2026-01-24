from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/coach/', include('apps.accounts.coach_urls')),
    path('api/bot/', include('apps.bot.urls')),
    path('api/clients/', include('apps.accounts.client_urls')),
    path('api/meals/', include('apps.meals.urls')),
    path('api/metrics/', include('apps.metrics.urls')),
    path('api/onboarding/', include('apps.onboarding.urls')),
    path('api/reminders/', include('apps.reminders.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/persona/', include('apps.persona.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    try:
        import debug_toolbar
        urlpatterns += [path('__debug__/', include(debug_toolbar.urls))]
    except ImportError:
        pass
