# Frontend (Next.js Admin Dashboard)
Responsive admin dashboard for batch scheduling and run monitoring.

## Environment
Local development (`apps/frontend/.env.local`):

```bash
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8080/api
BACKEND_INTERNAL_URL=http://localhost:8080
```

Production (`apps/frontend/.env.production`):

```bash
NEXT_PUBLIC_BACKEND_API_URL=https://smeiv3p6jn.ap-southeast-1.awsapprunner.com/api
BACKEND_INTERNAL_URL=https://smeiv3p6jn.ap-southeast-1.awsapprunner.com
```

- `NEXT_PUBLIC_BACKEND_API_URL` is the primary API base used in browser calls.
- `BACKEND_INTERNAL_URL` is optional for rewrite/proxy scenarios.

## Scripts
```bash
npm run dev
npm run lint
npm run build
npm run start
```

Open `http://localhost:3000`.

## Dashboard Features
- Professional responsive layout (mobile/tablet/desktop)
- Dark/light mode
- One-time welcome popup with keyword summary
- Architecture diagram section and modal
- Admin KPIs (backend status, schedules, run health, next run timer)
- Schedule form:
  - job type
  - timezone
  - date/time or cron mode
  - quick time buttons (`+5`, `+15`, `+30` min)
- Scheduled runs and run history filters
- Run-level actions: copy batch ID and export run JSON

## API
Frontend calls backend endpoints using:
- `${NEXT_PUBLIC_BACKEND_API_URL}/batch/schedule`
- `${NEXT_PUBLIC_BACKEND_API_URL}/batch/schedules/recent`
- `${NEXT_PUBLIC_BACKEND_API_URL}/batch/runs`
- `${NEXT_PUBLIC_BACKEND_API_URL}/batch/admin/summary`

## Docker
Build:
```bash
docker build -t batch-frontend .
```

Run:
```bash
docker run --rm -p 3000:3000 -e NEXT_PUBLIC_BACKEND_API_URL=https://smeiv3p6jn.ap-southeast-1.awsapprunner.com/api batch-frontend
```
