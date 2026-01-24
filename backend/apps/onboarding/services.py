import logging
from datetime import timezone as dt_timezone

from asgiref.sync import sync_to_async
from django.utils import timezone

from apps.accounts.models import Client

from .models import InviteLink, OnboardingQuestion

logger = logging.getLogger(__name__)

# Activity level multipliers for TDEE
ACTIVITY_MULTIPLIERS = {
    'sedentary': 1.2,       # Сидячий образ жизни
    'light': 1.375,         # Лёгкая активность (1-3 дня/нед)
    'moderate': 1.55,       # Умеренная (3-5 дней/нед)
    'active': 1.725,        # Высокая (6-7 дней/нед)
    'very_active': 1.9,     # Очень высокая (2 раза/день)
}


async def validate_invite(code: str) -> InviteLink | None:
    """Validate invite code. Returns InviteLink if valid, None otherwise."""
    invite = await sync_to_async(
        lambda: InviteLink.objects.select_related('coach').filter(
            code=code, is_active=True
        ).first()
    )()

    if not invite:
        return None

    # Check expiration
    if invite.expires_at and invite.expires_at < timezone.now():
        return None

    # Check usage limit
    if invite.uses_count >= invite.max_uses:
        return None

    return invite


async def use_invite(invite: InviteLink):
    """Increment invite usage counter."""
    invite.uses_count += 1
    await sync_to_async(invite.save)(update_fields=['uses_count'])


async def start_onboarding(client: Client, coach):
    """Initialize onboarding state for client."""
    client.onboarding_data = {
        'started': True,
        'current_question_index': 0,
        'answers': {},
    }
    client.onboarding_completed = False
    client.coach = coach
    await sync_to_async(client.save)(
        update_fields=['onboarding_data', 'onboarding_completed', 'coach']
    )


async def get_current_question(client: Client) -> OnboardingQuestion | None:
    """Get the current onboarding question for the client."""
    data = client.onboarding_data or {}
    if not data.get('started'):
        return None

    index = data.get('current_question_index', 0)

    questions = await sync_to_async(
        lambda: list(
            OnboardingQuestion.objects.filter(coach=client.coach).order_by('order')
        )
    )()

    if index >= len(questions):
        return None

    return questions[index]


def format_question(question: OnboardingQuestion) -> str:
    """Format question for Telegram display."""
    text = question.text

    if question.question_type == 'choice' and question.options:
        text += '\n\nВарианты:'
        for i, opt in enumerate(question.options, 1):
            text += f'\n{i}. {opt}'

    if question.question_type == 'multi_choice' and question.options:
        text += '\n\nВарианты (можно несколько через запятую):'
        for i, opt in enumerate(question.options, 1):
            text += f'\n{i}. {opt}'

    return text


async def process_answer(client: Client, text: str) -> dict:
    """
    Process answer to current question.
    Returns: {"next_question": str | None, "completed": bool}
    """
    data = client.onboarding_data or {}
    index = data.get('current_question_index', 0)

    questions = await sync_to_async(
        lambda: list(
            OnboardingQuestion.objects.filter(coach=client.coach).order_by('order')
        )
    )()

    if index >= len(questions):
        return {'next_question': None, 'completed': True}

    current_q = questions[index]

    # Parse answer based on question type
    answer = _parse_answer(current_q, text)

    # Save answer
    answers = data.get('answers', {})
    key = current_q.field_key or f'q_{current_q.pk}'
    answers[key] = answer

    # Move to next question
    next_index = index + 1
    data['current_question_index'] = next_index
    data['answers'] = answers
    client.onboarding_data = data
    await sync_to_async(client.save)(update_fields=['onboarding_data'])

    # Check if there are more questions
    if next_index < len(questions):
        next_q = questions[next_index]
        return {'next_question': format_question(next_q), 'completed': False}

    # All questions answered — complete onboarding
    await complete_onboarding(client)
    return {'next_question': None, 'completed': True}


def _parse_answer(question: OnboardingQuestion, text: str):
    """Parse answer text based on question type."""
    if question.question_type == 'number':
        # Extract number from text
        cleaned = text.strip().replace(',', '.')
        try:
            return float(cleaned)
        except ValueError:
            return text

    if question.question_type == 'choice' and question.options:
        # Try to match by number
        try:
            idx = int(text.strip()) - 1
            if 0 <= idx < len(question.options):
                return question.options[idx]
        except ValueError:
            pass
        return text

    if question.question_type == 'multi_choice' and question.options:
        parts = [p.strip() for p in text.split(',')]
        results = []
        for part in parts:
            try:
                idx = int(part) - 1
                if 0 <= idx < len(question.options):
                    results.append(question.options[idx])
                    continue
            except ValueError:
                pass
            results.append(part)
        return results

    return text.strip()


async def complete_onboarding(client: Client):
    """Complete onboarding: calculate norms and save."""
    answers = client.onboarding_data.get('answers', {})

    # Try to calculate TDEE from standard fields
    weight = _to_float(answers.get('weight'))
    height = _to_float(answers.get('height'))
    age = _to_float(answers.get('age'))
    gender = answers.get('gender', '').lower() if isinstance(answers.get('gender'), str) else ''
    activity = answers.get('activity_level', 'moderate')

    if weight and height and age:
        norms = calculate_tdee(weight, height, age, gender, activity)
        client.daily_calories = round(norms['calories'])
        client.daily_proteins = round(norms['proteins'], 1)
        client.daily_fats = round(norms['fats'], 1)
        client.daily_carbs = round(norms['carbs'], 1)

    client.onboarding_completed = True
    client.status = 'active'
    await sync_to_async(client.save)(update_fields=[
        'daily_calories', 'daily_proteins', 'daily_fats', 'daily_carbs',
        'onboarding_completed', 'status', 'onboarding_data',
    ])

    logger.info('Onboarding completed for client %s', client.pk)


def calculate_tdee(weight: float, height: float, age: float, gender: str, activity: str) -> dict:
    """
    Calculate TDEE and macros using Mifflin-St Jeor.

    Returns: {"calories": float, "proteins": float, "fats": float, "carbs": float}
    """
    # Mifflin-St Jeor BMR
    if gender in ('male', 'м', 'мужской', 'муж'):
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161

    # Activity multiplier
    if isinstance(activity, str):
        multiplier = ACTIVITY_MULTIPLIERS.get(activity.lower(), 1.55)
    else:
        multiplier = 1.55

    tdee = bmr * multiplier

    # Macro distribution: 25% protein, 25% fat, 50% carbs
    protein_cals = tdee * 0.25
    fat_cals = tdee * 0.25
    carb_cals = tdee * 0.50

    return {
        'calories': tdee,
        'proteins': protein_cals / 4,    # 4 kcal per gram
        'fats': fat_cals / 9,            # 9 kcal per gram
        'carbs': carb_cals / 4,          # 4 kcal per gram
    }


def _to_float(value) -> float | None:
    """Safely convert value to float."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
