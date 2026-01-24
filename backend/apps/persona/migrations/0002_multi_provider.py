from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('persona', '0001_initial'),
    ]

    operations = [
        # Remove old AI fields from BotPersona
        migrations.RemoveField(
            model_name='botpersona',
            name='ai_provider',
        ),
        migrations.RemoveField(
            model_name='botpersona',
            name='ai_model_chat',
        ),
        migrations.RemoveField(
            model_name='botpersona',
            name='ai_model_vision',
        ),
        # Add new separate provider/model fields
        migrations.AddField(
            model_name='botpersona',
            name='text_provider',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='botpersona',
            name='text_model',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='botpersona',
            name='vision_provider',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='botpersona',
            name='vision_model',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='botpersona',
            name='voice_provider',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='botpersona',
            name='voice_model',
            field=models.CharField(blank=True, max_length=100),
        ),
        # Create AIProviderConfig model
        migrations.CreateModel(
            name='AIProviderConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(choices=[('openai', 'OpenAI'), ('anthropic', 'Anthropic'), ('deepseek', 'DeepSeek'), ('gemini', 'Gemini')], max_length=20)),
                ('api_key', models.CharField(max_length=300)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('coach', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_providers', to='accounts.coach')),
            ],
            options={
                'db_table': 'ai_provider_configs',
                'unique_together': {('coach', 'provider')},
            },
        ),
        # Create AIUsageLog model
        migrations.CreateModel(
            name='AIUsageLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(max_length=20)),
                ('model', models.CharField(max_length=100)),
                ('task_type', models.CharField(choices=[('text', 'Text'), ('vision', 'Vision'), ('voice', 'Voice')], max_length=20)),
                ('input_tokens', models.IntegerField(default=0)),
                ('output_tokens', models.IntegerField(default=0)),
                ('cost_usd', models.DecimalField(decimal_places=6, default=0, max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('coach', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_usage', to='accounts.coach')),
                ('client', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='accounts.client')),
            ],
            options={
                'db_table': 'ai_usage_logs',
                'ordering': ['-created_at'],
            },
        ),
    ]
