import datetime
import json
import os
import ssl
import urllib.request

from django.http import HttpResponse, JsonResponse

BACKBOARD_URL = "https://backboard.railway.app/graphql/v2"

# Значения по умолчанию зашиты в репозитории; при необходимости можно переопределить через переменные окружения.
PROJECT_ID = os.getenv("RAILWAY_PROJECT_ID", "75cb42f9-59a8-4868-9eea-d2e92d2bdca8")
ENVIRONMENT_ID = os.getenv("RAILWAY_ENVIRONMENT_ID", "dda15e54-8aca-492e-b0af-552233978e23")


def _build_ssl_context():
    try:
        import certifi  # type: ignore

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def _gql(token: str, query: str, variables: dict):
    payload = json.dumps({"query": query, "variables": variables}).encode()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }
    req = urllib.request.Request(BACKBOARD_URL, data=payload, headers=headers, method="POST")
    ctx = _build_ssl_context()
    with urllib.request.urlopen(req, context=ctx) as resp:
        data = json.loads(resp.read().decode())
    if "errors" in data:
        raise RuntimeError(data["errors"])
    return data["data"]


SERVICES_QUERY = """
query($projectId: String!) {
  project(id: $projectId) {
    services {
      edges { node { id name } }
    }
  }
}
"""

DEPLOYMENTS_QUERY = """
query($projectId: String!, $environmentId: String!, $first: Int!) {
  deployments(input: { projectId: $projectId, environmentId: $environmentId }, first: $first) {
    edges {
      node {
        id
        status
        createdAt
        service { id name }
        user { name }
      }
    }
  }
}
"""


def _latest_by_service(token: str):
    project = _gql(token, SERVICES_QUERY, {"projectId": PROJECT_ID})["project"]
    services = {edge["node"]["id"]: edge["node"]["name"] for edge in project["services"]["edges"]}

    deployments = _gql(
        token,
        DEPLOYMENTS_QUERY,
        {"projectId": PROJECT_ID, "environmentId": ENVIRONMENT_ID, "first": 50},
    )["deployments"]["edges"]

    latest = {}
    for edge in deployments:
        node = edge["node"]
        svc = node.get("service")
        if not svc:
            continue
        sid = svc["id"]
        if sid not in latest or node["createdAt"] > latest[sid]["createdAt"]:
            latest[sid] = node

    # Преобразуем в список словарей для рендеринга
    rows = []
    for sid, name in services.items():
        node = latest.get(sid)
        if not node:
            rows.append(
                {"service": name, "status": "UNKNOWN", "created_at": None, "user": None, "deployment_id": None}
            )
            continue
        rows.append(
            {
                "service": name,
                "status": node.get("status"),
                "created_at": node.get("createdAt"),
                "user": (node.get("user") or {}).get("name"),
                "deployment_id": node.get("id"),
            }
        )
    return rows


def railway_status(request):
    token = (
        os.getenv("RAILWAY_MONITOR_TOKEN")
        or os.getenv("RAILWAY_API_TOKEN")
        or os.getenv("RAILWAY_TOKEN")
        or os.getenv("RAILWAY_PROJECT_TOKEN")
    )
    if not token:
        return HttpResponse("Не задан токен Railway (RAILWAY_MONITOR_TOKEN / RAILWAY_API_TOKEN / RAILWAY_TOKEN).", status=503)

    try:
        rows = _latest_by_service(token)
    except Exception as exc:  # noqa: BLE001
        return HttpResponse(f"Ошибка Railway API: {exc}", status=502)

    if request.GET.get("format") == "json":
        return JsonResponse({"project": PROJECT_ID, "environment": ENVIRONMENT_ID, "services": rows})

    # Простой HTML с автообновлением
    def fmt_dt(ts):
        if not ts:
            return "—"
        try:
            dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt.astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
        except Exception:
            return ts

    color = {
        "SUCCESS": "#16a34a",
        "BUILDING": "#2563eb",
        "FAILED": "#dc2626",
        "REMOVED": "#6b7280",
        "UNKNOWN": "#6b7280",
    }

    rows_html = "\n".join(
        f"<tr>"
        f"<td>{r['service']}</td>"
        f"<td style='color:{color.get(r['status'], '#000')};font-weight:600'>{r['status']}</td>"
        f"<td>{fmt_dt(r['created_at'])}</td>"
        f"<td>{r.get('user') or '—'}</td>"
        f"<td>{r.get('deployment_id') or '—'}</td>"
        f"</tr>"
        for r in rows
    )

    html = f"""
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="30" />
  <title>Railway статус</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; background:#0b1021; color:#e5e7eb; }}
    h1 {{ margin: 0 0 12px; }}
    table {{ width: 100%; border-collapse: collapse; background: #111827; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; }}
    th, td {{ padding: 10px 12px; text-align: left; }}
    th {{ background: #1f2937; color: #9ca3af; font-weight: 600; }}
    tr:nth-child(even) td {{ background: #0f172a; }}
    tr:hover td {{ background: #111827; }}
    small {{ color:#9ca3af; }}
  </style>
</head>
<body>
  <h1>Railway деплои</h1>
  <small>Проект {PROJECT_ID} / окружение {ENVIRONMENT_ID}. Автообновление каждые 30 сек.</small>
  <table>
    <thead>
      <tr><th>Сервис</th><th>Статус</th><th>Время</th><th>Пользователь</th><th>Deployment ID</th></tr>
    </thead>
    <tbody>
      {rows_html}
    </tbody>
  </table>
</body>
</html>
"""
    return HttpResponse(html)
