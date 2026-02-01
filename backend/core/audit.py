"""
Audit logging middleware для логирования доступа к данным здоровья.

Соответствует требованиям GDPR и HIPAA по отслеживанию доступа
к чувствительным персональным данным (health data).
"""
import hashlib
import logging
import time
from typing import Optional

from django.conf import settings
from django.http import HttpRequest, HttpResponse

logger = logging.getLogger('audit')

# Паттерны URL, требующие аудит-логирования (содержат health data)
AUDITED_URL_PATTERNS = [
    '/api/meals/',
    '/api/metrics/',
    '/api/reports/',
    '/api/nutrition-programs/',
    '/api/clients/',
]

# Чувствительные действия, которые всегда логируются
SENSITIVE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}


def _hash_identifier(value: str) -> str:
    """Хеширует идентификатор для безопасного логирования."""
    return hashlib.sha256(value.encode()).hexdigest()[:12]


def _get_client_ip(request: HttpRequest) -> str:
    """Получает IP клиента с учётом прокси."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def _should_audit(request: HttpRequest) -> bool:
    """Определяет, нужно ли логировать запрос."""
    path = request.path

    # Проверяем соответствие паттернам
    for pattern in AUDITED_URL_PATTERNS:
        if path.startswith(pattern):
            return True

    return False


class AuditLoggingMiddleware:
    """
    Middleware для аудит-логирования доступа к health data.

    Логирует:
    - Все изменяющие операции (POST, PUT, PATCH, DELETE) с health data
    - GET-запросы к спискам данных (bulk access)
    - Информацию о пользователе, IP, времени, endpoint

    Не логирует:
    - Содержимое запросов/ответов (конфиденциальность)
    - Пароли и токены
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Пропускаем неаудируемые запросы
        if not _should_audit(request):
            return self.get_response(request)

        # Записываем время начала
        start_time = time.time()

        # Обрабатываем запрос
        response = self.get_response(request)

        # Вычисляем время обработки
        duration_ms = int((time.time() - start_time) * 1000)

        # Собираем информацию для лога
        self._log_access(request, response, duration_ms)

        return response

    def _log_access(
        self,
        request: HttpRequest,
        response: HttpResponse,
        duration_ms: int,
    ) -> None:
        """Логирует информацию о доступе."""
        user_info = self._get_user_info(request)
        client_ip = _get_client_ip(request)

        # Определяем уровень логирования
        if request.method in SENSITIVE_METHODS:
            log_level = logging.WARNING  # Изменяющие операции
        elif response.status_code >= 400:
            log_level = logging.WARNING  # Ошибки
        else:
            log_level = logging.INFO  # Чтение данных

        # Формируем лог-сообщение
        log_data = {
            'event': 'health_data_access',
            'method': request.method,
            'path': request.path,
            'status': response.status_code,
            'user': user_info,
            'ip': client_ip,
            'duration_ms': duration_ms,
            'user_agent_hash': _hash_identifier(
                request.META.get('HTTP_USER_AGENT', 'unknown')
            ),
        }

        # Добавляем query params (без значений для приватности)
        if request.GET:
            log_data['query_params'] = list(request.GET.keys())

        logger.log(
            log_level,
            f"AUDIT: {request.method} {request.path} -> {response.status_code} "
            f"[user={user_info}, ip={client_ip}, {duration_ms}ms]",
            extra={'audit_data': log_data},
        )

    def _get_user_info(self, request: HttpRequest) -> str:
        """Получает информацию о пользователе для лога."""
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return 'anonymous'

        # Хешируем ID для приватности в логах
        user_id = str(request.user.id)
        return f"user_{_hash_identifier(user_id)}"
