from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('nutrition_programs', '0005_add_shopping_list'),
    ]

    operations = [
        migrations.AddField(
            model_name='nutritionprogram',
            name='track_compliance',
            field=models.BooleanField(default=True, verbose_name='Отслеживать выполнение'),
        ),
    ]
