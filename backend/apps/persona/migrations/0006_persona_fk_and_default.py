from django.db import migrations, models
import django.db.models.deletion


def mark_existing_as_default(apps, schema_editor):
    BotPersona = apps.get_model('persona', 'BotPersona')
    BotPersona.objects.all().update(is_default=True)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_remove_coach_telegram_bot_token'),
        ('persona', '0005_alter_telegrambot_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='botpersona',
            name='coach',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bot_personas',
                to='accounts.coach',
            ),
        ),
        migrations.AddField(
            model_name='botpersona',
            name='is_default',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(mark_existing_as_default, migrations.RunPython.noop),
    ]
