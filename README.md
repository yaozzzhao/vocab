# VocabMaster

A vocabulary learning app for students. Supports unit-based word testing, mistake tracking with spaced repetition, and AI-generated reading articles.

**Live:** https://vocabmaster-92k.pages.dev

## Stack

- **Frontend:** React + TypeScript + Vite, deployed on Cloudflare Pages
- **Backend:** Cloudflare Pages Functions (TypeScript)
- **Database:** Supabase (PostgreSQL)
- **AI:** Google Gemini (article generation)

## Features

- Unit-based vocabulary tests with multiple choice
- Mistake book with spaced repetition review scheduling
- AI-generated English articles using selected vocabulary
- Admin panel: word library management, user management
- JWT-based authentication

## Project Structure

```
├── frontend/          # React app (Vite)
│   ├── components/    # UI components
│   ├── db.ts          # API client
│   └── types.ts       # Shared types
├── functions/         # Cloudflare Pages Functions
│   ├── api/           # Route handlers
│   ├── _repositories.ts  # Supabase data access
│   └── _helpers.ts    # Auth, JWT utilities
├── data-handling/     # Data import scripts
│   ├── import_vocab.py   # Import words into Supabase
│   └── supabase_schema.sql
└── wrangler.toml
```

## Database Schema

Three tables in Supabase:

- `users` — accounts with hashed passwords and roles (`admin` / `user`)
- `words` — vocabulary entries; `owner_id = NULL` means shared system words visible to all users
- `mistakes` — per-user mistake records with review scheduling

## Local Development

```bash
npm install
npm run dev-frontend   # frontend only (Vite dev server)
```

For full local testing with Cloudflare Workers runtime:

```bash
npm run pages:dev
```

## Deployment

```bash
npm run deploy
```

Deploys frontend + Functions to Cloudflare Pages.

## Environment Variables

Configure in Cloudflare Pages dashboard (Settings → Environment variables):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (already in `wrangler.toml`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret) |
| `SESSION_SECRET` | JWT signing secret |
| `ADMIN_INITIAL_PASSWORD` | Password for the auto-created `admin` account |
| `GEMINI_API_KEY` | Google Gemini API key |

## Importing Vocabulary

```bash
cd data-handling
pip install -r requirements.txt
python import_vocab.py
```

Words imported with `owner_id = NULL` are shared across all users.
