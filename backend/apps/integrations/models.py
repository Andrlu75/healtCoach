from django.db import models
from django.conf import settings
from django.utils import timezone
from cryptography.fernet import Fernet


class GoogleFitConnection(models.Model):
    """Хранит OAuth токены Google Fit для клиента."""

    client = models.OneToOneField(
        'accounts.Client',
        on_delete=models.CASCADE,
        related_name='google_fit_connection'
    )

    # Зашифрованные токены
    access_token_encrypted = models.TextField()
    refresh_token_encrypted = models.TextField()

    # Метаданные
    token_expires_at = models.DateTimeField()
    scopes = models.JSONField(default=list)

    # Статус
    is_active = models.BooleanField(default=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    error_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'google_fit_connections'
        verbose_name = 'Google Fit Connection'
        verbose_name_plural = 'Google Fit Connections'

    def __str__(self):
        return f'Google Fit: {self.client} ({"active" if self.is_active else "inactive"})'

    def _get_cipher(self):
        key = settings.ENCRYPTION_KEY
        if isinstance(key, str):
            key = key.encode()
        return Fernet(key)

    def set_tokens(self, access_token: str, refresh_token: str):
        """Шифрует и сохраняет токены."""
        cipher = self._get_cipher()
        self.access_token_encrypted = cipher.encrypt(access_token.encode()).decode()
        if refresh_token:
            self.refresh_token_encrypted = cipher.encrypt(refresh_token.encode()).decode()

    def get_access_token(self) -> str:
        """Расшифровывает access token."""
        cipher = self._get_cipher()
        return cipher.decrypt(self.access_token_encrypted.encode()).decode()

    def get_refresh_token(self) -> str:
        """Расшифровывает refresh token."""
        cipher = self._get_cipher()
        return cipher.decrypt(self.refresh_token_encrypted.encode()).decode()

    def is_token_expired(self) -> bool:
        return timezone.now() >= self.token_expires_at


class GoogleFitSyncLog(models.Model):
    """Лог синхронизации для отладки и мониторинга."""

    STATUS_CHOICES = [
        ('running', 'Выполняется'),
        ('success', 'Успешно'),
        ('partial', 'Частично'),
        ('failed', 'Ошибка'),
    ]

    connection = models.ForeignKey(
        GoogleFitConnection,
        on_delete=models.CASCADE,
        related_name='sync_logs'
    )

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='running')

    metrics_synced = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = 'google_fit_sync_logs'
        ordering = ['-started_at']
        verbose_name = 'Google Fit Sync Log'
        verbose_name_plural = 'Google Fit Sync Logs'

    def __str__(self):
        return f'Sync {self.connection.client}: {self.status} ({self.started_at})'


class HuaweiHealthConnection(models.Model):
    """Хранит OAuth токены Huawei Health Kit для клиента."""

    client = models.OneToOneField(
        'accounts.Client',
        on_delete=models.CASCADE,
        related_name='huawei_health_connection'
    )

    # Зашифрованные токены
    access_token_encrypted = models.TextField()
    refresh_token_encrypted = models.TextField()

    # Метаданные
    token_expires_at = models.DateTimeField()
    scopes = models.JSONField(default=list)

    # Статус
    is_active = models.BooleanField(default=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    error_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'huawei_health_connections'
        verbose_name = 'Huawei Health Connection'
        verbose_name_plural = 'Huawei Health Connections'

    def __str__(self):
        return f'Huawei Health: {self.client} ({"active" if self.is_active else "inactive"})'

    def _get_cipher(self):
        key = settings.ENCRYPTION_KEY
        if isinstance(key, str):
            key = key.encode()
        return Fernet(key)

    def set_tokens(self, access_token: str, refresh_token: str):
        """Шифрует и сохраняет токены."""
        cipher = self._get_cipher()
        self.access_token_encrypted = cipher.encrypt(access_token.encode()).decode()
        if refresh_token:
            self.refresh_token_encrypted = cipher.encrypt(refresh_token.encode()).decode()

    def get_access_token(self) -> str:
        """Расшифровывает access token."""
        cipher = self._get_cipher()
        return cipher.decrypt(self.access_token_encrypted.encode()).decode()

    def get_refresh_token(self) -> str:
        """Расшифровывает refresh token."""
        cipher = self._get_cipher()
        return cipher.decrypt(self.refresh_token_encrypted.encode()).decode()

    def is_token_expired(self) -> bool:
        return timezone.now() >= self.token_expires_at


class HuaweiHealthSyncLog(models.Model):
    """Лог синхронизации Huawei Health для отладки и мониторинга."""

    STATUS_CHOICES = [
        ('running', 'Выполняется'),
        ('success', 'Успешно'),
        ('partial', 'Частично'),
        ('failed', 'Ошибка'),
    ]

    connection = models.ForeignKey(
        HuaweiHealthConnection,
        on_delete=models.CASCADE,
        related_name='sync_logs'
    )

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='running')

    metrics_synced = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = 'huawei_health_sync_logs'
        ordering = ['-started_at']
        verbose_name = 'Huawei Health Sync Log'
        verbose_name_plural = 'Huawei Health Sync Logs'

    def __str__(self):
        return f'Huawei Sync {self.connection.client}: {self.status} ({self.started_at})'
