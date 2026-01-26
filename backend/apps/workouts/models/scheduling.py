from django.db import models


class TrainingSchedule(models.Model):
    """Расписание тренировок клиента (ПН-СР-ПТ)"""
    client = models.ForeignKey(
        'accounts.Client',
        on_delete=models.CASCADE,
        related_name='training_schedules'
    )
    name = models.CharField(max_length=200)
    # Дни недели: 0=Пн, 1=Вт, ..., 6=Вс
    days_of_week = models.JSONField(
        default=list,
        help_text='Список дней недели [0, 2, 4] = Пн, Ср, Пт'
    )
    time = models.TimeField(help_text='Время тренировки')
    # Какую тренировку создавать (шаблон или конкретная)
    template = models.ForeignKey(
        'workouts.WorkoutTemplate',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='schedules'
    )
    is_active = models.BooleanField(default=True)
    # Дата начала и окончания расписания
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'training_schedules'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.client} - {self.name}"

    @property
    def coach(self):
        return self.client.coach


class TrainingProgram(models.Model):
    """Программа тренировок на несколько недель"""
    STATUS_CHOICES = [
        ('draft', 'Черновик'),
        ('active', 'Активна'),
        ('completed', 'Завершена'),
        ('paused', 'Приостановлена'),
    ]

    client = models.ForeignKey(
        'accounts.Client',
        on_delete=models.CASCADE,
        related_name='training_programs'
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    # Длительность программы в неделях
    duration_weeks = models.PositiveIntegerField(default=4)
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='draft'
    )
    start_date = models.DateField(null=True, blank=True)
    current_week = models.PositiveIntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'training_programs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.client} - {self.name}"

    @property
    def coach(self):
        return self.client.coach


class ProgramWorkout(models.Model):
    """Тренировка в программе (привязка к неделе и дню)"""
    program = models.ForeignKey(
        TrainingProgram,
        on_delete=models.CASCADE,
        related_name='program_workouts'
    )
    workout = models.ForeignKey(
        'workouts.ClientWorkout',
        on_delete=models.CASCADE,
        related_name='program_entries'
    )
    week_number = models.PositiveIntegerField()
    day_of_week = models.PositiveIntegerField(
        help_text='День недели: 0=Пн, 1=Вт, ..., 6=Вс'
    )

    class Meta:
        db_table = 'program_workouts'
        ordering = ['week_number', 'day_of_week']
        unique_together = ['program', 'week_number', 'day_of_week']

    def __str__(self):
        return f"{self.program.name} - Неделя {self.week_number}, День {self.day_of_week}"
