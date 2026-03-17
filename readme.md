# LeadFlow AI 🚀

[![Vercel](https://thereveriecdn.xyz/vc-dy)](https://vercel.com/new/clone?repository-url=https://github.com/user/leadflow-ai)

**AI-Powered Lead Management & Social Inbox Platform**

LeadFlow AI is a full-stack CRM platform for businesses to capture leads via custom forms, manage them in a dashboard, handle customer conversations across WhatsApp/Facebook/Instagram in a unified inbox, with AI auto-replies and automation.

## ✨ Features

- **Lead Capture**: Public forms with QR codes/links
- **Dashboard**: CRUD leads, status/notes, PDF/Excel export
- **Unified Social Inbox**: WhatsApp, FB Messenger, Instagram DMs
- **AI Automation**: Auto-replies, message dispatching
- **Integrations**: Meta API, Twilio, Supabase
- **Realtime**: Live chat updates
- **Secure**: JWT auth, rate limiting, Supabase RLS-ready
- **Deploy**: Vercel serverless ready

## 🏗️ Tech Stack

- **Backend**: Node.js/Express, Supabase Postgres
- **Frontend**: Vanilla HTML/CSS/JS
- **Database**: Users, Leads, Conversations, Messages, Integrations
- **APIs**: Meta (FB/IG/WA), Twilio SMS/Voice


This project now uses Supabase (Postgres) instead of local JSON files for users and leads.

## 1. What Was Changed

The following backend flow is now Supabase-based:

- User signup/login data storage
- Password reset user updates
- Lead create/read/update/delete
- Lead export data source

Main files changed:

- `config/supabase.js`
- `models/User.js`
- `models/Lead.js`
- `controllers/authController.js`
- `controllers/leadsController.js`
- `controllers/publicController.js`
- `routes/leads.js`
- `routes/leadRoutes.js`
- `middleware/auth.js`
- `database/schema.sql`

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm/yarn
- [Supabase Account](https://supabase.com) (free tier OK)

### 1. Clone & Install

```bash
git clone <repo>
cd leadflow-ai
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill:

```env
PORT=5000
JWT_SECRET=your-super-secret-jwt-key
SUPABASE_URL=your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Backend secret key!
```

### 3. Setup Database

1. Run `src/database/schema.sql` in Supabase SQL Editor
2. Tables: users, leads, integrations, facebook_accounts, conversations, messages

### 4. Run Locally

```bash
npm run dev  # nodemon
# or
npm start
```

Open [http://localhost:5000](http://localhost:5000)

## 3. Environment Variables

Set these in `.env`:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Important:

- `SUPABASE_SERVICE_ROLE_KEY` should be a backend secret key (service role) for server-side operations.
- Do not expose this key in browser/frontend code.

## 4. Create Supabase Tables

Run `database/schema.sql` in Supabase SQL Editor.

File: `database/schema.sql`

It creates:

- `public.users`
- `public.leads`
- Indexes on `leads.user_id` and `leads.created_at`

If tables already exist, `IF NOT EXISTS` keeps this safe to re-run.

## 5. Install and Run

```bash
npm install
npm run dev
```

or

```bash
npm start
```

Server starts at:

- `http://localhost:5000`

## 📋 API Endpoints

All under `/api` (JSON body, JWT in `Authorization: Bearer <token>`)

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Create user |
| POST | `/login` | JWT login |
| POST | `/forgot-password` | Send reset email |
| POST | `/reset-password` | Reset via token |

### Leads (Auth required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/leads` | List user leads |
| POST | `/lead` | Create lead |
| PUT | `/lead/:id` | Update lead/status |
| PUT | `/lead-note/:id` | Add note |
| DELETE | `/lead/:id` | Delete |
| GET | `/leads/export` | PDF/Excel |

### Public
- POST `/lead-public` - Anonymous lead submit

### Social Inbox
- POST `/inbox/reply` - Send message
- GET `/inbox/conversations` - List threads

### Webhooks
- POST `/webhooks/meta` - Meta (FB/IG/WA) incoming

### Facebook
- GET `/facebook/oauth` - OAuth init
- POST `/facebook/accounts` - Connect page

## 7. Supabase Data Mapping

### Users

API/app fields:

- `businessName`
- `businessPhone`
- `createdAt`

Database columns:

- `business_name`
- `business_phone`
- `created_at`

### Leads

API/app fields:

- `userId`
- `createdAt`

Database columns:

- `user_id`
- `created_at`

## 8. Auth Header Format

JWT middleware now accepts both:

- Raw token: `Authorization: <token>`
- Bearer token: `Authorization: Bearer <token>`

## 9. Optional: Migrate Old Local JSON Data

If you want previous records from:

- `data/users.json`
- `data/leads.json`

You can import them into Supabase tables by matching fields:

- `businessName -> business_name`
- `businessPhone -> business_phone`
- `userId -> user_id`
- `createdAt -> created_at`

Keep `id` values as numbers to preserve existing token/form-link behavior.

## 10. Verification Checklist

After setup, test this flow:

1. Signup a new user
2. Login and receive JWT
3. Submit public lead
4. Open dashboard and load leads
5. Update lead status/note
6. Export leads to Excel

## 11. Troubleshooting

### `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment`

- Check `.env` exists at project root.
- Restart server after updating `.env`.

### `relation "users" does not exist` or `relation "leads" does not exist`

- Run `database/schema.sql` in Supabase SQL editor.

### Supabase permission/RLS errors

- Use a server-side secret key in `SUPABASE_SERVICE_ROLE_KEY`.
- Ensure your table policies/permissions allow backend operations.

### `Invalid token`

- Re-login to get a fresh JWT.
- Ensure request header is either raw token or `Bearer <token>`.

## 🔗 Integrations Setup

### Meta (Facebook/Instagram/WhatsApp)
1. Dashboard → Connect Facebook & Instagram / WhatsApp Business
2. Follow OAuth flow
3. Grants: pages_messaging, whatsapp_business_messaging, instagram_basic

### Supabase
- Service role key for server ops (bypass RLS)

## 📁 Project Structure

```
leadflow-ai/
├── server.js           # Express app
├── public/             # Static CSS/JS
├── views/              # HTML pages
├── src/
│   ├── config/         # Supabase, Meta, Twilio
│   ├── controllers/    # Route logic
│   ├── models/         # Supabase ops
│   ├── routes/         # API routes
│   ├── services/       # AI, inbox, integrations
│   └── middleware/     # Auth, rate limit
├── src/database/schema.sql
└── vercel.json         # Serverless deploy
```

## ☁️ Deployment (Vercel)

```bash
npm i -g vercel
vercel --prod
```

Config auto-handles via vercel.json (api/index.js as serverless func).

## 🤝 Contributing

1. Fork & PR
2. Follow existing style (vanilla JS, async/await)
3. Test changes: `npm run dev`

## ❓ Troubleshooting

- **No Supabase tables**: Run schema.sql
- **Invalid JWT**: Check `JWT_SECRET`, re-login
- **Webhook 403**: Verify Meta app tokens/permissions
- **CORS issues**: Local dev only; prod via Vercel

## 📄 License

ISC


