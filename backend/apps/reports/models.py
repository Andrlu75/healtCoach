from django.db import models


class Report(models.Model):
    REPORT_TYPE_CHOICES = [
        ('daily', 'Ежедневный'),
        ('weekly', 'Еженедельный'),
    ]

    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, related_name='reports')
    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='reports')
    report_type = models.CharField(max_length=10, choices=REPORT_TYPE_CHOICES)
    period_start = models.DateField()
    period_end = models.DateField()
    content = models.JSONField(default=dict)
    summary = models.TextField(blank=True)
    pdf_file = models.FileField(upload_to='reports/%Y/%m/', blank=True)
    is_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reports'
        ordering = ['-period_end']

    def __str__(self):
        return f'{self.report_type} {self.period_start} - {self.period_end} ({self.client})'
