from django.contrib import admin

from .models import MealComplianceCheck, NutritionProgram, NutritionProgramDay


class NutritionProgramDayInline(admin.TabularInline):
    model = NutritionProgramDay
    extra = 0
    fields = ['day_number', 'date', 'allowed_ingredients', 'forbidden_ingredients', 'notes']


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
