#!/bin/bash
set -e

echo "Running collectstatic..."
python manage.py collectstatic --noinput

echo "Running migrations..."
python manage.py migrate

echo "Setting up Telegram webhooks..."
python manage.py setup_webhooks || true

# Start Celery worker in background if Redis is available
if [ -n "$CELERY_BROKER_URL" ]; then
    echo "Starting Celery worker in background..."
    celery -A config worker -l info --concurrency=1 &

    echo "Starting Celery beat in background..."
    celery -A config beat -l info &
fi

echo "Starting gunicorn on port 8000..."
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2 --timeout 120 --preload
