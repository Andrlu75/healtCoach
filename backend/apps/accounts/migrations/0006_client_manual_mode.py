from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_client_physiology'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='manual_mode',
            field=models.BooleanField(default=False),
        ),
    ]
