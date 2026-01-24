import asyncio
from datetime import timedelta

import httpx
from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import BotPersona, AIProviderConfig, AIModelConfig, AIUsageLog
from .serializers import (
    BotPersonaSerializer,
    AIProviderConfigSerializer,
    AIProviderCreateSerializer,
    FetchModelsSerializer,
    AIModelSelectionSerializer,
    AIModelConfigSerializer,
    AIModelAddSerializer,
    TelegramSettingsSerializer,
)
from core.ai.model_fetcher import fetch_models, _fetch_openrouter_metadata, _find_openrouter_meta, OPENROUTER_PROVIDER_MAP


class BotPersonaView(APIView):

    def get(self, request):
        persona, _ = BotPersona.objects.get_or_create(
            coach=request.user.coach_profile,
            defaults={'system_prompt': self._default_system_prompt()}
        )
        serializer = BotPersonaSerializer(persona)
        return Response(serializer.data)

    def put(self, request):
        persona, _ = BotPersona.objects.get_or_create(
            coach=request.user.coach_profile,
            defaults={'system_prompt': self._default_system_prompt()}
        )
        serializer = BotPersonaSerializer(persona, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def _default_system_prompt(self):
        return (
            '\u0422\u044b \u2014 \u0434\u0440\u0443\u0436\u0435\u043b\u044e\u0431\u043d\u044b\u0439 \u043f\u043e\u043c\u043e\u0449\u043d\u0438\u043a health-\u043a\u043e\u0443\u0447\u0430. '
            '\u041e\u0431\u0449\u0430\u0439\u0441\u044f \u043b\u0435\u0433\u043a\u043e \u0438 \u043d\u0435\u043f\u0440\u0438\u043d\u0443\u0436\u0434\u0451\u043d\u043d\u043e, \u043a\u0430\u043a \u0441\u043e \u0441\u0442\u0430\u0440\u044b\u043c \u0434\u0440\u0443\u0433\u043e\u043c. '
            '\u041d\u0435 \u0434\u0430\u0432\u0430\u0439 \u043c\u0435\u0434\u0438\u0446\u0438\u043d\u0441\u043a\u0438\u0445 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0439. '
            '\u0422\u0432\u043e\u044f \u0440\u043e\u043b\u044c \u2014 \u0434\u0440\u0443\u0436\u0435\u0441\u043a\u0430\u044f \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430 \u0438 \u043b\u0451\u0433\u043a\u0430\u044f \u043c\u043e\u0442\u0438\u0432\u0430\u0446\u0438\u044f.'
        )


class AIProviderListView(APIView):

    def get(self, request):
        providers = AIProviderConfig.objects.filter(coach=request.user.coach_profile)
        serializer = AIProviderConfigSerializer(providers, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = AIProviderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        coach = request.user.coach_profile
        provider = serializer.validated_data['provider']
        api_key = serializer.validated_data['api_key']

        # Validate API key by fetching models
        try:
            loop = asyncio.new_event_loop()
            models = loop.run_until_complete(fetch_models(provider, api_key))
            loop.close()
        except Exception as e:
            return Response(
                {'error': f'\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 API \u043a\u043b\u044e\u0447: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        config, created = AIProviderConfig.objects.update_or_create(
            coach=coach,
            provider=provider,
            defaults={'api_key': api_key, 'is_active': True},
        )

        return Response(
            {
                'provider': AIProviderConfigSerializer(config).data,
                'models': models,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AIProviderDeleteView(APIView):

    def delete(self, request, pk):
        try:
            config = AIProviderConfig.objects.get(
                pk=pk, coach=request.user.coach_profile
            )
        except AIProviderConfig.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        provider = config.provider
        config.delete()

        # Delete all added models for this provider
        AIModelConfig.objects.filter(
            coach=request.user.coach_profile, provider=provider
        ).delete()

        # Clear model selections for this provider
        persona, _ = BotPersona.objects.get_or_create(coach=request.user.coach_profile)
        updated_fields = []
        if persona.text_provider == provider:
            persona.text_provider = ''
            persona.text_model = ''
            updated_fields.extend(['text_provider', 'text_model'])
        if persona.vision_provider == provider:
            persona.vision_provider = ''
            persona.vision_model = ''
            updated_fields.extend(['vision_provider', 'vision_model'])
        if persona.voice_provider == provider:
            persona.voice_provider = ''
            persona.voice_model = ''
            updated_fields.extend(['voice_provider', 'voice_model'])
        if updated_fields:
            persona.save(update_fields=updated_fields)

        return Response(status=status.HTTP_204_NO_CONTENT)


class AIProviderModelsView(APIView):

    def post(self, request):
        serializer = FetchModelsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        provider = serializer.validated_data['provider']
        api_key = serializer.validated_data.get('api_key', '').strip()

        # If no api_key provided, use stored one
        if not api_key:
            try:
                config = AIProviderConfig.objects.get(
                    coach=request.user.coach_profile,
                    provider=provider,
                )
                api_key = config.api_key
            except AIProviderConfig.DoesNotExist:
                return Response(
                    {'error': '\u041f\u0440\u043e\u0432\u0430\u0439\u0434\u0435\u0440 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            loop = asyncio.new_event_loop()
            models = loop.run_until_complete(fetch_models(provider, api_key))
            loop.close()
        except Exception as e:
            return Response(
                {'error': f'\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u044f \u043c\u043e\u0434\u0435\u043b\u0435\u0439: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({'models': models})


class AIModelListView(APIView):

    def get(self, request):
        models = AIModelConfig.objects.filter(
            coach=request.user.coach_profile
        ).order_by('provider', 'model_name')
        serializer = AIModelConfigSerializer(models, many=True)
        data = serializer.data

        # Enrich with pricing/capabilities from OpenRouter
        try:
            loop = asyncio.new_event_loop()
            metadata = loop.run_until_complete(_fetch_openrouter_metadata())
            loop.close()
        except Exception:
            metadata = {}

        for item in data:
            or_prefix = OPENROUTER_PROVIDER_MAP.get(item['provider'], item['provider'])
            meta = _find_openrouter_meta(item['model_id'], or_prefix, metadata)

            item['price_input'] = meta['price_input'] if meta else None
            item['price_output'] = meta['price_output'] if meta else None
            item['supports_text'] = meta['supports_text'] if meta else True
            item['supports_vision'] = meta['supports_vision'] if meta else False
            item['supports_audio'] = meta['supports_audio'] if meta else False
            item['context_length'] = meta['context_length'] if meta else None

        return Response(data)

    def post(self, request):
        serializer = AIModelAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        coach = request.user.coach_profile
        created = []
        for item in serializer.validated_data['models']:
            obj, was_created = AIModelConfig.objects.get_or_create(
                coach=coach,
                provider=item['provider'],
                model_id=item['model_id'],
                defaults={'model_name': item['model_name']},
            )
            created.append(obj)

        data = AIModelConfigSerializer(created, many=True).data

        # Enrich with pricing/capabilities
        try:
            loop = asyncio.new_event_loop()
            metadata = loop.run_until_complete(_fetch_openrouter_metadata())
            loop.close()
        except Exception:
            metadata = {}

        for item in data:
            or_prefix = OPENROUTER_PROVIDER_MAP.get(item['provider'], item['provider'])
            meta = _find_openrouter_meta(item['model_id'], or_prefix, metadata)
            item['price_input'] = meta['price_input'] if meta else None
            item['price_output'] = meta['price_output'] if meta else None
            item['supports_text'] = meta['supports_text'] if meta else True
            item['supports_vision'] = meta['supports_vision'] if meta else False
            item['supports_audio'] = meta['supports_audio'] if meta else False
            item['context_length'] = meta['context_length'] if meta else None

        return Response(data, status=status.HTTP_201_CREATED)


class AIModelDeleteView(APIView):

    def delete(self, request, pk):
        try:
            model_config = AIModelConfig.objects.get(
                pk=pk, coach=request.user.coach_profile
            )
        except AIModelConfig.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        provider = model_config.provider
        model_id = model_config.model_id
        model_config.delete()

        # Clear model selections if this model was assigned
        persona, _ = BotPersona.objects.get_or_create(coach=request.user.coach_profile)
        updated_fields = []
        if persona.text_provider == provider and persona.text_model == model_id:
            persona.text_provider = ''
            persona.text_model = ''
            updated_fields.extend(['text_provider', 'text_model'])
        if persona.vision_provider == provider and persona.vision_model == model_id:
            persona.vision_provider = ''
            persona.vision_model = ''
            updated_fields.extend(['vision_provider', 'vision_model'])
        if persona.voice_provider == provider and persona.voice_model == model_id:
            persona.voice_provider = ''
            persona.voice_model = ''
            updated_fields.extend(['voice_provider', 'voice_model'])
        if updated_fields:
            persona.save(update_fields=updated_fields)

        return Response(status=status.HTTP_204_NO_CONTENT)


class AISettingsView(APIView):

    def get(self, request):
        persona, _ = BotPersona.objects.get_or_create(
            coach=request.user.coach_profile
        )
        data = {
            'text_provider': persona.text_provider,
            'text_model': persona.text_model,
            'vision_provider': persona.vision_provider,
            'vision_model': persona.vision_model,
            'voice_provider': persona.voice_provider,
            'voice_model': persona.voice_model,
            'temperature': persona.temperature,
            'max_tokens': persona.max_tokens,
        }
        return Response(data)

    def put(self, request):
        serializer = AIModelSelectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        coach = request.user.coach_profile
        persona, _ = BotPersona.objects.get_or_create(coach=coach)
        data = serializer.validated_data

        # Validate that selected models exist in coach's AIModelConfig
        for modality in ['text', 'vision', 'voice']:
            model_val = data.get(f'{modality}_model', '')
            provider_val = data.get(f'{modality}_provider', '')
            if model_val and provider_val:
                if not AIModelConfig.objects.filter(
                    coach=coach, provider=provider_val, model_id=model_val
                ).exists():
                    return Response(
                        {'error': f'Модель {model_val} не добавлена в список моделей'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        for field in ['text_provider', 'text_model', 'vision_provider', 'vision_model',
                      'voice_provider', 'voice_model', 'temperature', 'max_tokens']:
            if field in data:
                setattr(persona, field, data[field])

        persona.save()
        return Response({'status': 'updated'})


class AIUsageView(APIView):

    def get(self, request):
        coach = request.user.coach_profile
        period = request.query_params.get('period', 'month')
        provider_filter = request.query_params.get('provider', '')
        model_filter = request.query_params.get('model', '')

        now = timezone.now()
        if period == 'today':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == 'week':
            start_date = now - timedelta(days=7)
        elif period == 'month':
            start_date = now - timedelta(days=30)
        else:
            start_date = None

        queryset = AIUsageLog.objects.filter(coach=coach)
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if provider_filter:
            queryset = queryset.filter(provider=provider_filter)
        if model_filter:
            queryset = queryset.filter(model=model_filter)

        stats = queryset.values('provider', 'model', 'task_type').annotate(
            requests_count=Count('id'),
            total_input_tokens=Sum('input_tokens'),
            total_output_tokens=Sum('output_tokens'),
            total_cost_usd=Sum('cost_usd'),
        ).order_by('-total_cost_usd')

        total_cost = queryset.aggregate(total=Sum('cost_usd'))['total'] or 0

        return Response({
            'stats': list(stats),
            'total_cost_usd': total_cost,
            'period': period,
        })


class AITestView(APIView):
    """Test the selected AI model: chat or vision."""

    def post(self, request):
        from core.ai.factory import get_ai_provider

        task_type = request.data.get('task_type', 'text')  # text or vision
        coach = request.user.coach_profile
        persona, _ = BotPersona.objects.get_or_create(coach=coach)

        if task_type == 'text':
            provider_name = persona.text_provider
            model_id = persona.text_model
        elif task_type == 'vision':
            provider_name = persona.vision_provider
            model_id = persona.vision_model
        else:
            return Response(
                {'error': f'Неизвестный тип задачи: {task_type}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not provider_name or not model_id:
            return Response(
                {'error': f'Модель для "{task_type}" не назначена'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get API key
        try:
            config = AIProviderConfig.objects.get(coach=coach, provider=provider_name)
            api_key = config.api_key
        except AIProviderConfig.DoesNotExist:
            return Response(
                {'error': f'Провайдер {provider_name} не настроен'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from core.ai.model_fetcher import _fetch_openrouter_metadata

            provider = get_ai_provider(provider_name, api_key)
            loop = asyncio.new_event_loop()

            # Предзагрузить кэш цен OpenRouter
            loop.run_until_complete(_fetch_openrouter_metadata())

            if task_type == 'text':
                # Accept messages history for chat
                import json
                messages_raw = request.data.get('messages', '[]')
                if isinstance(messages_raw, str):
                    messages = json.loads(messages_raw)
                else:
                    messages = messages_raw

                result = loop.run_until_complete(
                    provider.complete(
                        messages=messages,
                        system_prompt=persona.system_prompt or 'Ты — помощник.',
                        max_tokens=persona.max_tokens,
                        temperature=persona.temperature,
                        model=model_id,
                    )
                )
            else:  # vision
                image_file = request.FILES.get('image')
                if not image_file:
                    loop.close()
                    return Response(
                        {'error': 'Загрузите изображение для теста'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                image_data = image_file.read()
                content_type = image_file.content_type or 'image/jpeg'
                result = loop.run_until_complete(
                    provider.analyze_image(
                        image_data=image_data,
                        prompt='Опиши подробно что изображено на этом фото.',
                        media_type=content_type,
                        max_tokens=persona.max_tokens,
                        model=model_id,
                    )
                )

            loop.close()

            # Записать usage в лог
            from core.ai.model_fetcher import get_cached_pricing

            input_tokens = result.usage.get('input_tokens', 0) or result.usage.get('prompt_tokens', 0)
            output_tokens = result.usage.get('output_tokens', 0) or result.usage.get('completion_tokens', 0)
            if input_tokens or output_tokens:
                cost_usd = 0
                pricing = get_cached_pricing(provider_name, model_id)
                if pricing:
                    price_in, price_out = pricing
                    cost_usd = (input_tokens * price_in + output_tokens * price_out) / 1_000_000

                AIUsageLog.objects.create(
                    coach=coach,
                    provider=provider_name,
                    model=model_id,
                    task_type=task_type,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost_usd=cost_usd,
                )

            return Response({
                'response': result.content,
                'model': result.model,
                'usage': result.usage,
            })

        except Exception as e:
            return Response(
                {'error': f'Ошибка модели: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class TelegramSettingsView(APIView):

    def get(self, request):
        coach = request.user.coach_profile
        data = {
            'bot_token': coach.telegram_bot_token,
            'webhook_url': '',
            'notification_chat_id': coach.telegram_notification_chat_id,
        }
        return Response(data)

    def put(self, request):
        serializer = TelegramSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        coach = request.user.coach_profile
        coach.telegram_bot_token = serializer.validated_data.get('bot_token', '')
        coach.telegram_notification_chat_id = serializer.validated_data.get('notification_chat_id', '')
        coach.save(update_fields=['telegram_bot_token', 'telegram_notification_chat_id'])
        return Response({'status': 'updated'})


class TelegramTestView(APIView):

    def post(self, request):
        bot_token = request.data.get('bot_token', '').strip()
        chat_id = request.data.get('chat_id', '').strip()

        if not bot_token or not chat_id:
            return Response(
                {'error': '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 bot_token \u0438 chat_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            resp = httpx.post(
                f'https://api.telegram.org/bot{bot_token}/sendMessage',
                json={
                    'chat_id': chat_id,
                    'text': '\u2705 \u0422\u0435\u0441\u0442\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043e\u0442 Health Coach. \u0411\u043e\u0442 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442!',
                },
                timeout=10,
            )
            result = resp.json()
            if result.get('ok'):
                return Response({'status': 'sent', 'message_id': result['result']['message_id']})
            else:
                return Response(
                    {'error': result.get('description', 'Telegram API error')},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except httpx.RequestError as e:
            return Response(
                {'error': f'\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class DashboardStatsView(APIView):

    def get(self, request):
        coach = request.user.coach_profile
        clients = coach.clients.all()

        stats = {
            'total_clients': clients.count(),
            'active_clients': clients.filter(status='active').count(),
            'pending_clients': clients.filter(status='pending').count(),
            'paused_clients': clients.filter(status='paused').count(),
        }
        return Response(stats)
