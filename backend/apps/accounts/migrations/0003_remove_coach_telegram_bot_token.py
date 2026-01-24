from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_coach_telegram_bot_token_and_more'),
        ('persona', '0004_telegram_bot'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='coach',
            name='telegram_bot_token',
        ),
    ]
