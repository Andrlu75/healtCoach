# Railway Services

Project ID: `75cb42f9-59a8-4868-9eea-d2e92d2bdca8`
Environment ID: `dda15e54-8aca-492e-b0af-552233978e23`

## Services

| Service | Service ID |
|---------|------------|
| Console | `f81be445-0bda-4f5e-bfe8-876d5976535b` |
| Backend (API) | `19a77d17-5205-4b9c-aca5-e3b968d006a3` |
| Miniapp | `68d08cfd-1fa4-49dd-9453-41212432df90` |
| Celery | `1f77d369-7abd-48d6-be80-77e9038ecb9a` |
| Beat | `2cb54097-8517-4940-a83d-44846eb67d00` |
| Redis | `9544f55f-3eff-4f3e-807e-185a8cb6a7de` |

## SSH Commands

```bash
# Console
railway ssh --project=75cb42f9-59a8-4868-9eea-d2e92d2bdca8 --environment=dda15e54-8aca-492e-b0af-552233978e23 --service=f81be445-0bda-4f5e-bfe8-876d5976535b

# Backend (API)
railway ssh --project=75cb42f9-59a8-4868-9eea-d2e92d2bdca8 --environment=dda15e54-8aca-492e-b0af-552233978e23 --service=19a77d17-5205-4b9c-aca5-e3b968d006a3

# Miniapp
railway ssh --project=75cb42f9-59a8-4868-9eea-d2e92d2bdca8 --environment=dda15e54-8aca-492e-b0af-552233978e23 --service=68d08cfd-1fa4-49dd-9453-41212432df90

# Celery
railway ssh --project=75cb42f9-59a8-4868-9eea-d2e92d2bdca8 --environment=dda15e54-8aca-492e-b0af-552233978e23 --service=1f77d369-7abd-48d6-be80-77e9038ecb9a

# Beat
railway ssh --project=75cb42f9-59a8-4868-9eea-d2e92d2bdca8 --environment=dda15e54-8aca-492e-b0af-552233978e23 --service=2cb54097-8517-4940-a83d-44846eb67d00

# Redis
railway ssh --project=75cb42f9-59a8-4868-9eea-d2e92d2bdca8 --environment=dda15e54-8aca-492e-b0af-552233978e23 --service=9544f55f-3eff-4f3e-807e-185a8cb6a7de
```

## Deploy Commands

```bash
# Deploy all services
railway up --service=f81be445-0bda-4f5e-bfe8-876d5976535b  # Console
railway up --service=19a77d17-5205-4b9c-aca5-e3b968d006a3  # Backend
railway up --service=68d08cfd-1fa4-49dd-9453-41212432df90  # Miniapp
railway up --service=1f77d369-7abd-48d6-be80-77e9038ecb9a  # Celery
railway up --service=2cb54097-8517-4940-a83d-44846eb67d00  # Beat
```

## Run command on service

```bash
# Example: run migrations on backend
railway ssh --project=75cb42f9-59a8-4868-9eea-d2e92d2bdca8 --environment=dda15e54-8aca-492e-b0af-552233978e23 --service=19a77d17-5205-4b9c-aca5-e3b968d006a3 -- python manage.py migrate

# Example: check logs on console
railway ssh --project=75cb42f9-59a8-4868-9eea-d2e92d2bdca8 --environment=dda15e54-8aca-492e-b0af-552233978e23 --service=f81be445-0bda-4f5e-bfe8-876d5976535b -- cat /usr/share/nginx/html/index.html
```
