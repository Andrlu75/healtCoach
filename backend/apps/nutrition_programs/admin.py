from django.contrib import admin

from .models import MealComplianceCheck, MealReport, NutritionProgram, NutritionProgramDay


class NutritionProgramDayInline(admin.TabularInline):
    model = NutritionProgramDay
    extra = 0
    fields = ['day_number', 'date', 'meals', 'activity', 'allowed_ingredients', 'forbidden_ingredients', 'notes']


@admin.register(NutritionProgram)
class NutritionProgramAdmin(admin.ModelAdmin):
    list_display = ['name', 'client', 'coach', 'status', 'start_date', 'end_date', 'duration_days', 'created_at']
    list_filter = ['status', 'coach', 'created_at']
    search_fields = ['name', 'client__first_name', 'client__last_name']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [NutritionProgramDayInline]
    raw_id_fields = ['client', 'coach']


@admin.register(NutritionProgramDay)
class NutritionProgramDayAdmin(admin.ModelAdmin):
    list_display = ['program', 'day_number', 'date']
    list_filter = ['program__status']
    search_fields = ['program__name']
    raw_id_fields = ['program']


@admin.register(MealComplianceCheck)
class MealComplianceCheckAdmin(admin.ModelAdmin):
    list_display = ['meal', 'program_day', 'is_compliant', 'coach_notified', 'created_at']
    list_filter = ['is_compliant', 'coach_notified', 'created_at']
    search_fields = ['meal__dish_name', 'program_day__program__name']
    readonly_fields = ['created_at']
    raw_id_fields = ['meal', 'program_day']


@admin.register(MealReport)
class MealReportAdmin(admin.ModelAdmin):
    list_display = ['program_day', 'meal_type', 'meal_time', 'is_compliant', 'compliance_score', 'created_at']
    list_filter = ['meal_type', 'is_compliant', 'created_at']
    search_fields = ['program_day__program__name', 'program_day__program__client__first_name']
    readonly_fields = ['created_at', 'recognized_ingredients', 'is_compliant', 'compliance_score', 'ai_analysis']
    raw_id_fields = ['program_day']
    fieldsets = (
        (None, {
            'fields': ('program_day', 'meal_type', 'meal_time')
        }),
        ('Фото', {
            'fields': ('photo_file_id', 'photo_url')
        }),
        ('Анализ', {
            'fields': ('planned_description', 'recognized_ingredients', 'is_compliant', 'compliance_score', 'ai_analysis'),
            'classes': ('collapse',)
        }),
    )
