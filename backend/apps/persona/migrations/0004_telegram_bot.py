from django.db import migrations, models
import django.db.models.deletion


def migrate_bot_tokens(apps, schema_editor):
    """Migrate existing coach.telegram_bot_token to TelegramBot entries."""
    Coach = apps.get_model('accounts', 'Coach')
    TelegramBot = apps.get_model('persona', 'TelegramBot')

    for coach in Coach.objects.exclude(telegram_bot_token=''):
        TelegramBot.objects.create(
            coach=coach,
            name='Основной',
            token=coach.telegram_bot_token,
            is_active=True,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_coach_telegram_bot_token_and_more'),
        ('persona', '0003_ai_model_config'),
    ]

    operations = [
        migrations.CreateModel(
            name='TelegramBot',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('token', models.CharField(max_length=100)),
                ('is_active', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('coach', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='telegram_bots',
                    to='accounts.coach',
                )),
            ],
            options={
                'db_table': 'telegram_bots',
            },
        ),
        migrations.RunPython(migrate_bot_tokens, migrations.RunPython.noop),
    ]
