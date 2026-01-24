.PHONY: up down logs migrate makemigrations shell test lint build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build

migrate:
	docker compose exec backend python manage.py migrate

makemigrations:
	docker compose exec backend python manage.py makemigrations

shell:
	docker compose exec backend python manage.py shell

createsuperuser:
	docker compose exec backend python manage.py createsuperuser

test:
	docker compose exec backend pytest

lint:
	docker compose exec backend ruff check .

format:
	docker compose exec backend ruff format .

setup-webhook:
	docker compose exec backend python manage.py setup_telegram_webhook
