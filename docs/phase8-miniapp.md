# Фаза 8: Mini App (React) — Детальный план

## Что уже есть:
- Miniapp проект с Vite + React 19 + Tailwind + `@twa-dev/sdk`
- Recharts, Zustand, React Query, Axios в dependencies
- Backend: `api/clients/` (ClientViewSet)

---

## Что нужно реализовать:

### Backend:
- `POST /api/auth/telegram/` — initData validation + JWT tokens

### Frontend:
1. `src/api/client.ts` — Axios + interceptors
2. `src/api/endpoints.ts` — API функции
3. `src/stores/auth.ts` — Zustand auth store
4. `src/App.tsx` — Router + Telegram SDK init
5. Pages: Dashboard, Diary, Stats, Reminders
6. Components: Layout, NutritionProgress, MealCard, WeekChart

---

## Порядок:
1. Backend: TelegramAuthView
2. Frontend: API + auth
3. Frontend: App + Layout + routing
4. Frontend: Dashboard
5. Frontend: Diary
6. Frontend: Stats
7. Frontend: Reminders
