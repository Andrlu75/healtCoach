from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('persona', '0002_multi_provider'),
    ]

    operations = [
        migrations.CreateModel(
            name='AIModelConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(max_length=20)),
                ('model_id', models.CharField(max_length=100)),
                ('model_name', models.CharField(max_length=150)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('coach', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_models', to='accounts.coach')),
            ],
            options={
                'db_table': 'ai_model_configs',
                'unique_together': {('coach', 'provider', 'model_id')},
            },
        ),
    ]
