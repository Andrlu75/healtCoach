from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('chat', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='InteractionLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('interaction_type', models.CharField(choices=[('text', 'Text'), ('vision', 'Vision'), ('voice', 'Voice')], max_length=10)),
                ('client_input', models.TextField()),
                ('ai_request', models.JSONField(default=dict)),
                ('ai_response', models.JSONField(default=dict)),
                ('client_output', models.TextField()),
                ('provider', models.CharField(max_length=30)),
                ('model', models.CharField(max_length=100)),
                ('duration_ms', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='interaction_logs', to='accounts.client')),
                ('coach', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='interaction_logs', to='accounts.coach')),
            ],
            options={
                'db_table': 'interaction_logs',
                'ordering': ['-created_at'],
            },
        ),
    ]
