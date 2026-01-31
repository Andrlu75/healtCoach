#!/bin/bash
set -e

echo "Running collectstatic..."
python manage.py collectstatic --noinput

echo "Running migrations..."
python manage.py migrate

echo "Fixing admin coach exercises..."
python manage.py fix_admin_coach || true

echo "Starting gunicorn on port 8000..."
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2 --timeout 120 --preload
