# LeadFlow AI - Supabase Migration README

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

## 2. Prerequisites

- Node.js 18+ recommended
- npm
- A Supabase project

## 3. Environment Variables

Set these in `.env`:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your_supabase_service_role_key
```

Important:

- `SUPABASE_KEY` should be a backend secret key (service role) for server-side operations.
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

## 6. API Endpoints (Current Backend)

All routes are mounted under `/api`.

Authentication:

- `POST /api/signup`
- `POST /api/login`
- `POST /api/forgot-password`
- `POST /api/reset-password`

Leads (JWT required):

- `GET /api/leads`
- `POST /api/lead`
- `PUT /api/lead/:id`
- `PUT /api/lead-note/:id`
- `DELETE /api/lead/:id`
- `GET /api/leads/export`

Public:

- `POST /api/lead-public`

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

### `Missing SUPABASE_URL or SUPABASE_KEY in environment`

- Check `.env` exists at project root.
- Restart server after updating `.env`.

### `relation "users" does not exist` or `relation "leads" does not exist`

- Run `database/schema.sql` in Supabase SQL editor.

### Supabase permission/RLS errors

- Use a server-side secret key in `SUPABASE_KEY`.
- Ensure your table policies/permissions allow backend operations.

### `Invalid token`

- Re-login to get a fresh JWT.
- Ensure request header is either raw token or `Bearer <token>`.

## 12. Notes

- `config/database.js` and local JSON files can be kept as legacy backups, but active runtime now uses Supabase models.
- Password reset tokens are still in-memory (`resetTokens` object). They are not persisted in Supabase yet.
