# WhatsApp CRM SaaS

A production-grade, multi-tenant WhatsApp CRM. Every WhatsApp conversation is connected to a complete customer profile — contacts, leads, deals pipeline, follow-ups, message templates, automations, analytics and AI assistance — with realtime updates via Socket.IO.

![stack](https://img.shields.io/badge/stack-Express%20%7C%20Prisma%20%7C%20PostgreSQL%20%7C%20Redis%20%7C%20React%20%7C%20Vite-brightgreen)

## Features

- **WhatsApp Inbox** — 3-column layout (conversation list / chat / customer profile), unread badges, filters, search
- **Realtime** — messages, status ticks (✓✓), conversation updates and notifications stream over Socket.IO
- **Messages** — outbound replies, customer media, internal notes (never sent to customer), templates with `{{variables}}`
- **AI assistance** — conversation summaries, suggested replies (4 tones), lead scoring / intent analysis (works offline with `AI_PROVIDER=mock`)
- **Contacts** — 360° customer profiles, tags, notes, source, lead score, full activity timeline
- **Leads** — drag-and-drop kanban (`New → Contacted → Qualified → Unqualified → Converted → Lost`), hot-lead scoring
- **Deals** — drag-and-drop pipeline (`New Lead → … → Won/Lost`) with value, probability, weighted forecast
- **Tasks & follow-ups** — priority, due dates, recurrence, overdue detection, BullMQ reminder jobs
- **Message templates** — reusable WhatsApp templates (MARKETING / UTILITY / AUTHENTICATION) with variable detection
- **Automations** — trigger → conditions → actions (assign, tag, create task, send template, auto-reply…), run history
- **Analytics** — messaging volume, response times, conversion, revenue, team leaderboards (recharts)
- **Team** — invite members, roles (OWNER/ADMIN/MANAGER/AGENT), per-agent performance
- **WhatsApp provider abstraction** — Meta Cloud API (production) or built-in **demo simulator** (dev, generates realistic inbound traffic)
- **Security** — JWT auth (jose), bcrypt, per-workspace authorization, rate limiting (Redis), helmet, audit logs

## Architecture

```
apps/
  backend/   Express + Prisma + PostgreSQL + Redis + Socket.IO + BullMQ
  frontend/  React 18 + Vite + TypeScript + Tailwind + zustand + recharts
```

| Layer | Tech |
|---|---|
| API | Express (REST, Zod-validated) |
| ORM / DB | Prisma + PostgreSQL |
| Cache / queues | Redis, BullMQ (follow-up reminders, notifications) |
| Realtime | Socket.IO (rooms per workspace) |
| Auth | JWT (jose, HS256), bcrypt password hashing |
| WhatsApp | Provider interface: `DemoWhatsAppProvider` \| `MetaWhatsAppProvider` |
| AI | Provider interface: `MockAIProvider` (offline) \| LLM providers |
| Frontend | React 18, Vite, Tailwind, zustand (persisted session), recharts |

## Quick start (local development)

Prerequisites: **Node 18+**, **PostgreSQL 14+**, **Redis 6.2+** (or use Docker, below).

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure the backend environment (read from apps/backend/.env)
cp .env.example apps/backend/.env
# edit as needed (DB, Redis, AUTH_SECRET)

# 3. Create the database schema
npm run db:push        # runs `prisma db push` (schema-only, no migration files)

# 4. Seed demo data (contacts, conversations, leads, deals, tasks, templates, automations)
npm run db:seed

# 5. Run backend (port 4000) + frontend (port 5173)
npm run dev
```

### Demo credentials

| Email | Password | Role |
|---|---|---|
| `agent@acme.com` | `password123` | Agent |
| `owner@acme.com` | `password123` | Owner |
| `admin@acme.com` | `password123` | Admin |
| `manager@acme.com` | `password123` | Manager |

> With `DEMO_MODE=true` (default), a simulator sends realistic inbound WhatsApp messages every ~45s and the AI provider is `mock` (works with zero external dependencies).

## Testing it right now

1. Open **http://localhost:5173** and sign in with `agent@acme.com` / `password123`.
2. **Inbox** — click a conversation, reply (the demo customer replies back), toggle **Internal Note** (shown only to your team), use **✨ Generate Reply**, and click **✨ AI summary** in the header. Open the **customer panel** (right edge) for the 360° profile + AI lead analysis.
3. **Dashboard** — KPIs update live as the simulator delivers messages.
4. **Leads** — drag cards between kanban columns; status updates instantly.
5. **Deals** — drag deals through the pipeline; won deals contribute to revenue analytics.
6. **Tasks** — create a follow-up, mark it complete, watch overdue highlighting.
7. **Templates / Automations / Analytics / Team / Settings** — full CRUD on each.
8. **Forgot password** — sign out, use the "Forgot password?" link; dev mode returns the reset token on-screen so you can complete the reset.

### Verify the API directly

```bash
# login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@acme.com","password":"password123"}'

# list conversations (token above)
curl http://localhost:4000/api/workspaces/<workspaceId>/conversations \
  -H "Authorization: Bearer <token>"

# webhook handshake (used by Meta to verify your endpoint)
curl "http://localhost:4000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=my-webhook-verify-token&hub.challenge=challenge-ok"
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `AUTH_SECRET` | — | JWT signing secret (≥32 chars in production) |
| `PORT` | `4000` | Backend HTTP port |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |
| `WHATSAPP_ACCESS_TOKEN` | — | Meta Cloud API token (empty = demo mode) |
| `WHATSAPP_PHONE_NUMBER_ID` | — | Meta phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | — | Meta business account ID |
| `WHATSAPP_VERIFY_TOKEN` | `my-webhook-verify-token` | Webhook verification token |
| `AI_PROVIDER` | `mock` | `mock` \| `anthropic` \| `openai` |
| `AI_API_KEY` | — | Provider key (not needed for `mock`) |
| `DEMO_MODE` | `true` | Simulate inbound WhatsApp traffic |
| `DEMO_MESSAGE_INTERVAL_MS` | `45000` | Simulator tick interval |

## Deploy with Docker

Docker Compose runs **PostgreSQL 16 + Redis 7 + backend + frontend (nginx)**.

```bash
docker compose up --build -d
```

- Frontend (nginx) → **http://localhost:8080**
- Backend API → **http://localhost:4000**

On first boot the backend auto-creates the schema (`DB_AUTO_PUSH=true`). Seed demo data once:

```bash
docker compose exec backend npx tsx prisma/seed.ts
```

Stop / tear down:

```bash
docker compose down          # stop
docker compose down -v       # stop + delete database volume
```

## Useful commands

```bash
npm run dev          # backend + frontend together
npm run dev:backend  # backend only
npm run dev:frontend # frontend only
npm run build        # production build of both apps
npm run db:seed      # reset + reseed demo data
```

## Project structure

```
apps/backend/
  prisma/schema.prisma          # full multi-tenant schema
  prisma/seed.ts                # demo data
  src/index.ts                  # HTTP + Socket.IO + worker + demo simulator entry
  src/app.ts                    # Express app, route mounts, rate limiting
  src/modules/                  # auth, workspaces, contacts, leads, deals, tasks,
                                # conversations, messages, whatsapp, templates,
                                # automations, analytics, dashboard, team, search, ai
  src/automation/engine.ts      # trigger → conditions → actions
  src/jobs/worker.ts            # BullMQ: follow-up reminders, notifications
  src/realtime/socket.ts        # workspace rooms + emit helpers
apps/frontend/
  src/features/                 # inbox, contacts, leads, deals, tasks, templates,
                                # automations, analytics, team, settings, auth, dashboard
  src/components/               # layout, base UI, overlays, command palette
  src/store/auth.ts             # zustand session + socket connection
  src/lib/api.ts                # authenticated fetch wrapper
```

## Production checklist

- [ ] Set a strong `AUTH_SECRET`
- [ ] Set `DEMO_MODE=false`, remove demo users
- [ ] Connect real Meta Cloud API credentials (Settings → WhatsApp)
- [ ] Point `AI_PROVIDER` + `AI_API_KEY` at a real provider
- [ ] Terminate TLS at the load balancer; set `FRONTEND_URL` to the public origin
- [ ] Point the WhatsApp webhook at `https://<your-domain>/api/webhooks/whatsapp`