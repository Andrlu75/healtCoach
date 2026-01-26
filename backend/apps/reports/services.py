import json
import logging
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from asgiref.sync import async_to_sync
from django.core.files.base import ContentFile
from django.template.loader import render_to_string

from apps.accounts.models import Client
from apps.bot.services import _build_client_context
from apps.persona.models import AIProviderConfig, AIUsageLog, BotPersona
from core.ai.model_fetcher import get_cached_pricing

from .generators.daily import collect_daily_data
from .generators.weekly import collect_weekly_data
from .models import Report

try:
    from weasyprint import HTML
except (ImportError, OSError):
    HTML = None

logger = logging.getLogger(__name__)


def generate_report(client: Client, report_type: str, target_date: date = None) -> Report:
    """Generate a daily or weekly report for a client."""
    if target_date is None:
        target_date = date.today()

    if report_type == 'daily':
        period_start = target_date
        period_end = target_date
        content = collect_daily_data(client, target_date)
    else:  # weekly
        # Week starts on Monday
        period_start = target_date - timedelta(days=target_date.weekday())
        period_end = period_start + timedelta(days=6)
        content = collect_weekly_data(client, period_start)

    # Generate AI summary
    summary = generate_ai_summary(client, content, report_type)

    # Create report
    report = Report.objects.create(
        client=client,
        coach=client.coach,
        report_type=report_type,
        period_start=period_start,
        period_end=period_end,
        content=content,
        summary=summary,
    )

    # Generate PDF
    pdf_bytes = render_pdf(report)
    if pdf_bytes:
        filename = f'{report_type}_{client.pk}_{period_start}.pdf'
        report.pdf_file.save(filename, ContentFile(pdf_bytes), save=True)

    return report


def generate_ai_summary(client: Client, content: dict, report_type: str) -> str:
    """Generate AI summary of the report data."""
    # Use client's persona or coach's default
    persona = client.persona
    if not persona:
        persona = BotPersona.objects.filter(coach=client.coach).first()
    if not persona:
        return ''

    provider_name = persona.text_provider or 'openai'
    config = AIProviderConfig.objects.filter(
        coach=client.coach, provider=provider_name, is_active=True
    ).first()
    if not config:
        return ''

    from core.ai.factory import get_ai_provider
    provider = get_ai_provider(provider_name, config.api_key)

    type_label = 'дневной' if report_type == 'daily' else 'недельный'
    prompt = (
        f'Проанализируй {type_label} отчёт клиента и напиши краткую сводку (3-5 предложений).\n'
        f'Отметь что хорошо, что можно улучшить, дай рекомендацию.\n\n'
        f'Данные:\n{json.dumps(content, ensure_ascii=False, default=str)}'
    )

    # Build system prompt with client context (including gender)
    system_prompt = 'Ты опытный нутрициолог-аналитик. Пиши кратко и по делу.'
    client_context = _build_client_context(client)
    if client_context:
        system_prompt = system_prompt + client_context
        if client.gender:
            system_prompt += '\n\nВАЖНО: Учитывай пол клиента в рекомендациях.'

    try:
        response = async_to_sync(provider.complete)(
            messages=[{'role': 'user', 'content': prompt}],
            system_prompt=system_prompt,
            max_tokens=300,
            temperature=0.7,
        )
        # Log usage/cost
        usage = response.usage or {}
        input_tokens = usage.get('input_tokens') or usage.get('prompt_tokens') or 0
        output_tokens = usage.get('output_tokens') or usage.get('completion_tokens') or 0

        cost_usd = Decimal('0')
        pricing = get_cached_pricing(provider_name, response.model or '')
        if pricing and (input_tokens or output_tokens):
            price_in, price_out = pricing
            cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))

        AIUsageLog.objects.create(
            coach=client.coach,
            client=client,
            provider=provider_name,
            model=response.model or '',
            task_type='text',
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
        )

        return response.content.strip()
    except Exception as e:
        logger.exception('Failed to generate AI summary: %s', e)
        return ''


def render_pdf(report: Report) -> bytes | None:
    """Render report as PDF using WeasyPrint."""
    if HTML is None:
        logger.warning('WeasyPrint not available, skipping PDF generation')
        return None

    html_content = _build_report_html(report)

    try:
        pdf_file = BytesIO()
        HTML(string=html_content).write_pdf(pdf_file)
        return pdf_file.getvalue()
    except Exception as e:
        logger.exception('Failed to render PDF: %s', e)
        return None


def _build_report_html(report: Report) -> str:
    """Build HTML for the report."""
    content = report.content
    is_daily = report.report_type == 'daily'

    if is_daily:
        meals_data = content.get('meals', {})
        total = meals_data.get('total', {})
        norm_percent = content.get('norm_percent', {})
    else:
        meals_data = content.get('meals', {})
        total = meals_data.get('daily_avg', {})
        norm_percent = content.get('avg_norm_percent', {})

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: Arial, sans-serif; margin: 40px; font-size: 14px; }}
h1 {{ color: #2c3e50; font-size: 22px; }}
h2 {{ color: #34495e; font-size: 16px; margin-top: 20px; }}
.summary {{ background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }}
table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }}
th {{ background: #f1f3f5; font-weight: 600; }}
.percent {{ color: #666; font-size: 12px; }}
.good {{ color: #27ae60; }}
.warn {{ color: #f39c12; }}
.footer {{ margin-top: 30px; font-size: 11px; color: #999; }}
</style>
</head>
<body>
<h1>{'Дневной отчёт' if is_daily else 'Недельный отчёт'}</h1>
<p>{report.client.first_name} {report.client.last_name} | {report.period_start} — {report.period_end}</p>
"""

    if report.summary:
        html += f'<div class="summary"><h2>Сводка</h2><p>{report.summary}</p></div>'

    html += """
<h2>Питание</h2>
<table>
<tr><th>Показатель</th><th>Факт</th><th>Норма %</th></tr>
"""
    html += f'<tr><td>Калории</td><td>{total.get("calories", 0)} ккал</td><td>{norm_percent.get("calories", 0)}%</td></tr>'
    html += f'<tr><td>Белки</td><td>{total.get("proteins", 0)} г</td><td>{norm_percent.get("proteins", 0)}%</td></tr>'
    html += f'<tr><td>Жиры</td><td>{total.get("fats", 0)} г</td><td>{norm_percent.get("fats", 0)}%</td></tr>'
    html += f'<tr><td>Углеводы</td><td>{total.get("carbs", 0)} г</td><td>{norm_percent.get("carbs", 0)}%</td></tr>'
    html += '</table>'

    # Metrics
    metrics = content.get('metrics', [])
    if metrics:
        html += '<h2>Метрики</h2><table><tr><th>Тип</th><th>Значение</th></tr>'
        for m in metrics:
            html += f'<tr><td>{m.get("metric_type", "")}</td><td>{m.get("value", "")} {m.get("unit", "")}</td></tr>'
        html += '</table>'

    # Weight trend for weekly
    if not is_daily:
        weight = content.get('weight', {})
        change = weight.get('change')
        if change is not None:
            direction = '+' if change > 0 else ''
            html += f'<h2>Вес</h2><p>Изменение за неделю: {direction}{change} кг</p>'

    html += f'<div class="footer">Сгенерировано: {report.created_at.strftime("%d.%m.%Y %H:%M") if report.created_at else ""}</div>'
    html += '</body></html>'

    return html
