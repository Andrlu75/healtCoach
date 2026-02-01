from django.apps import AppConfig


class MealsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.meals'
    verbose_name = 'Питание'

    def ready(self) -> None:
        """Подключение сигналов при загрузке приложения."""
        import apps.meals.signals  # noqa: F401
