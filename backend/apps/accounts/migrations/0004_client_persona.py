from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_remove_coach_telegram_bot_token'),
        ('persona', '0006_persona_fk_and_default'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='persona',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='clients',
                to='persona.botpersona',
            ),
        ),
    ]
