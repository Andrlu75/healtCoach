from rest_framework import serializers

from .models import InviteLink, OnboardingQuestion


class InviteLinkSerializer(serializers.ModelSerializer):
    invite_url = serializers.SerializerMethodField()

    class Meta:
        model = InviteLink
        fields = [
            'id', 'code', 'is_active', 'max_uses', 'uses_count',
            'expires_at', 'created_at', 'invite_url',
        ]
        read_only_fields = ['id', 'code', 'uses_count', 'created_at', 'invite_url']

    def get_invite_url(self, obj):
        # Deep link for Telegram miniapp
        bot_username = self.context.get('bot_username', '')
        miniapp_short_name = self.context.get('miniapp_short_name', '')

        if bot_username and miniapp_short_name:
            # Direct link to miniapp with invite code
            return f'https://t.me/{bot_username}/{miniapp_short_name}?startapp={obj.code}'
        elif bot_username:
            # Fallback to bot start (will show questions in bot)
            return f'https://t.me/{bot_username}?start={obj.code}'
        return f'https://t.me/BOT?start={obj.code}'


class InviteLinkCreateSerializer(serializers.Serializer):
    max_uses = serializers.IntegerField(default=1, min_value=1)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class OnboardingQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = OnboardingQuestion
        fields = [
            'id', 'text', 'question_type', 'options',
            'is_required', 'order', 'field_key', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class OnboardingQuestionCreateSerializer(serializers.Serializer):
    text = serializers.CharField()
    question_type = serializers.ChoiceField(choices=['text', 'number', 'choice', 'multi_choice', 'date'])
    options = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    is_required = serializers.BooleanField(default=True)
    order = serializers.IntegerField(default=0)
    field_key = serializers.CharField(required=False, default='', allow_blank=True)


class OnboardingQuestionUpdateSerializer(serializers.Serializer):
    text = serializers.CharField(required=False)
    question_type = serializers.ChoiceField(choices=['text', 'number', 'choice', 'multi_choice', 'date'], required=False)
    options = serializers.ListField(child=serializers.CharField(), required=False)
    is_required = serializers.BooleanField(required=False)
    order = serializers.IntegerField(required=False)
    field_key = serializers.CharField(required=False, allow_blank=True)
