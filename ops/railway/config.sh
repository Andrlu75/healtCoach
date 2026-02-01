#!/usr/bin/env bash
# Static IDs for the HealthCoach project on Railway.
export RAILWAY_PROJECT_ID="75cb42f9-59a8-4868-9eea-d2e92d2bdca8"
export RAILWAY_ENVIRONMENT_ID="dda15e54-8aca-492e-b0af-552233978e23"

export RAILWAY_SERVICE_CONSOLE="f81be445-0bda-4f5e-bfe8-876d5976535b"
export RAILWAY_SERVICE_API="19a77d17-5205-4b9c-aca5-e3b968d006a3"
export RAILWAY_SERVICE_MINIAPP="68d08cfd-1fa4-49dd-9453-41212432df90"
# В проекте отдельного Celery-воркера сейчас нет; используем тот же сервис, что и beat.
export RAILWAY_SERVICE_CELERY="2cb54097-8517-4940-a83d-44846eb67d00"
export RAILWAY_SERVICE_BEAT="2cb54097-8517-4940-a83d-44846eb67d00"
export RAILWAY_SERVICE_REDIS="9544f55f-3eff-4f3e-807e-185a8cb6a7de"
# Управляемая БД Postgres: сервис с volume, раньше был под идом 1f77d369-7abd-48d6-be80-77e9038ecb9a
export RAILWAY_SERVICE_POSTGRES="1f77d369-7abd-48d6-be80-77e9038ecb9a"

# Default number of log lines per call; override per invocation if needed.
export RAILWAY_LOG_LINES="200"
