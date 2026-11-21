# Checkpoint

A coaching web app for coaches and their clients. Clients log daily weight, steps and nutrition, workouts, weekly check-ins with progress photos, and blood test results. Coaches see every client's progress, compare check-ins side by side, set targets and leave feedback.

Built with Next.js (App Router), TypeScript, Tailwind CSS, Drizzle ORM and Postgres. It is installable on a phone's home screen as a web app.

## Run it locally

```bash
npm install
npm run db:seed      # creates a local database in ./data with demo data
npm run dev          # http://localhost:3000
```

Demo logins (password `password123`):

- Coach: `coach@demo.test` (invite code `DEMO1234`)
- Client: `alex@demo.test`

Without `DATABASE_URL`, the app uses an embedded Postgres (PGlite) stored in `./data/pglite`, and uploads go to `./data/uploads`. Delete `./data` to start fresh.

## Features

| Area | What it does |
| --- | --- |
| Accounts | Coach and client roles. Clients join with their coach's invite code. |
| Nutrition | Meal-by-meal food log with a searchable food library and custom foods. Each meal shows logged vs planned macros, "Use plan" fills it from the coach's plan, meals and the whole day can be marked complete, extra meals can be added, and the last logged day can be copied. Training and rest days have separate plans and targets. |
| Barcode scanning | Scan a product with the phone camera (or type the barcode) to look it up in [Open Food Facts](https://world.openfoodfacts.org), a free open food database. Found products are saved to the shared food library, so the next scan is instant. Unknown barcodes can be added by hand and are remembered. You can also search Open Food Facts by name. |
| Meal plans | Coaches build training-day and rest-day plans: named meals, planned foods and amounts, notes per meal, reordering, and copying one plan to the other day type. |
| Cardio & steps | Coach sets a weekly plan (e.g. "Mon: 30 min stair climber"). Clients log cardio sessions and steps; the week view shows plan vs done. Steps can be imported from CSV. |
| History | Daily weight, steps, calories and macros for the last 30 days, compared against targets. |
| Check-ins | Weight, body fat, five measurements, front/side/back photos, energy/sleep/adherence ratings, notes, coach feedback. |
| Compare | Any two check-ins side by side: photos per pose and the change in every measurement. |
| Training | Log sessions set by set (reps, kg, RPE), with history, volume and best sets. |
| Blood work | Upload the lab report and enter markers with reference ranges. Out-of-range values are flagged and repeated markers are charted. |
| Coach dashboard | Roster with last check-in, weight change, average steps, logging consistency and check-ins waiting for feedback. |

Photos and lab reports are never public. They are served through `/api/files/...` only to the client who owns them and their coach.

## Production

Set `SESSION_SECRET` and `DATABASE_URL` (any Postgres, e.g. Supabase), then:

```bash
npm run build && npm start
```

The app applies database migrations itself when it starts (`npm run db:migrate` does the same by hand).

The camera scanner needs the site to be served over HTTPS (or localhost). Barcode lookups call `world.openfoodfacts.org` from the server, so that host must be reachable.

File storage writes to local disk (`src/lib/storage.ts`). On serverless hosting, swap that module for Supabase Storage or S3.

## Database changes

Edit `src/db/schema.ts`, then run `npm run db:generate` to create a migration in `./drizzle`.
