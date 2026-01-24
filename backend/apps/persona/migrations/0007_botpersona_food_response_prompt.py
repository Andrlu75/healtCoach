from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('persona', '0006_persona_fk_and_default'),
    ]

    operations = [
        migrations.AddField(
            model_name='botpersona',
            name='food_response_prompt',
            field=models.TextField(blank=True, default=''),
            preserve_default=False,
        ),
    ]
