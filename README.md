# Crew Organization and Vessel Allocation Planner

A crew organization and vessel allocation planner with a Vite + React frontend and a new Phase 1 backend foundation for secure internal use.

## Using the chart builder

### How to open the app

1. Open a terminal in this project folder.
2. Run `npm install` the first time only.
3. Run `npm run dev`.
4. Open the local address shown in the terminal, usually `http://localhost:5173`.

The Version 2 sample planner appears automatically. Changes are saved in the current browser. Existing Version 1 browser data and JSON imports are migrated automatically.

### How to run the backend

1. Open a second terminal in the same project folder.
2. Change into the server folder: `cd server`
3. Copy `server/.env.example` to `server/.env` and fill in your local values.
4. Run `npm install` inside `server` the first time.
5. Start the API with `npm run dev`.

The backend listens on port `8080` by default.

### How to create a local PostgreSQL database

1. Install PostgreSQL locally, or use a local Docker/Postgres instance if you already have one.
2. Create a database for the planner, for example `crew_chart_builder`.
3. Set `DATABASE_URL` in `server/.env` to point to that database.
4. Run Prisma migration commands from the `server` folder.

Example:

```bash
createdb crew_chart_builder
```

### How to configure `server/.env`

Use the variables in `server/.env.example`:

- `DATABASE_URL`
- `SESSION_SECRET`
- `NODE_ENV`
- `FRONTEND_URL`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `ADMIN_SEED_NAME`

Keep real values out of GitHub and out of the frontend.

### Edit chart details

Use the **Edit planner** panel on the left. Open **Chart settings** to change the title, organization name, effective date, and footer. Open **Crew Director** or **Operations hierarchy** to edit leadership.

### Add teams, assistants, and vessels

1. Open **Operations hierarchy** to add Operations Managers, Crew Managers, and Assistants.
2. Select **Vessel master** in the top navigation.
3. Add or edit vessels in the table and select the responsible Crew Manager.
4. Optionally select an Assistant from that Crew Manager's support team.
5. Use search and filters to focus on an operations group, status, or management type.

### Export for PowerPoint

1. Choose **Full org chart** or **Vessel allocation** at the top.
2. Select **Export**.
3. Choose **SVG vector** for the sharpest PowerPoint result, or **High-resolution PNG** for a ready-to-place image.
4. Insert the downloaded file into a 16:9 PowerPoint slide.

Use **Operations detail** to export one Operations Manager at a time. Use **Vessel allocation** when vessel metadata and allocation are the priority.

### Recommended PowerPoint workflow

1. Export the **Organization Overview** SVG first.
2. Export each **Operations Manager Detail** SVG you want to present.
3. Insert the SVG files directly into PowerPoint.
4. Keep the **Vessel Master** table for appendix slides or internal backup reference.

### Back up and restore chart data

Open **Backup & restore** and choose **Export JSON** to save a complete editable backup. Choose **Import JSON** later to restore it. Imported files are checked before the current chart is replaced.

## Developer quick start

```bash
npm install
npm run dev
```

Backend quick start:

```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed:admin
npm run dev
```

## Checks

```bash
npm run lint
npm run test
npm run build
```

## Data and privacy

Chart data is stored only in the browser under the `crew-chart-builder:v1` local-storage key. Use JSON export for backups or sharing. No data is sent to a server.

Phase 1 introduces a separate backend foundation for authentication and PostgreSQL, but it does not replace the current frontend localStorage flow yet.

## Phase 2 backend summary

Phase 2 adds the production data model and server APIs for organization structure, hierarchy, vessel master data, vessel allocations, reports, and audit logging.

### Database tables added

- `organizations`
- `people`
- `operations_managers`
- `crew_managers`
- `assistants`
- `vessels`
- `vessel_allocations`
- `audit_logs`

### Migration command

Run migrations from the `server` folder:

```bash
cd server
npm run prisma:migrate
```

### How to test APIs manually

1. Start the backend with `npm run dev` in `server/`.
2. Log in with the admin seed user through `POST /api/auth/login`.
3. Call `GET /api/auth/me` to confirm the session cookie is working.
4. Use `GET /api/organization`, `GET /api/hierarchy`, `GET /api/vessels`, and `GET /api/reports/summary` to inspect data.
5. Use `GET /api/audit-logs` as ADMIN to review logged changes.

The frontend still uses localStorage until Phase 3. Phase 2 is backend-only on purpose.

## Phase 3 frontend and backend workflow

The frontend now signs in against the backend and loads chart data from the API. PostgreSQL is the source of truth, and localStorage is no longer used for business data.

### Run both apps locally

Backend:

```bash
cd server
npm install
npm run dev
```

Frontend:

```bash
npm install
npm run dev
```

### Frontend env setup

Create a root `.env` file with:

```bash
VITE_API_BASE_URL=http://localhost:8080
```

### Login with the seeded admin

1. Seed the admin user in `server/`.
2. Open the frontend.
3. Sign in with the seeded email and password from `server/.env`.

### Role behavior

- `ADMIN` and `EDITOR` can see edit controls.
- `VIEWER` and `BOSS_VIEWER` get read-only access.
- Exports remain available to all authenticated users.

### Storage

- PostgreSQL is the source of truth for chart data.
- localStorage should only be used for harmless UI preferences if needed later.

### Developer note

- The backend API is the source of truth for business data.
- The frontend uses pure mapper helpers in `src/state/apiMappers.ts` to convert API responses into chart state and API payloads.
- localStorage is not used for organization, hierarchy, vessel, or allocation data.

## Low-cost deployment: DigitalOcean App Platform + Neon PostgreSQL

Recommended production structure:

- One DigitalOcean App Platform web service
- Backend serves `/api/*`
- Backend also serves the built Vite frontend from `dist/`
- Neon Free PostgreSQL provides `DATABASE_URL`
- No custom domain required

This keeps cookies simple, avoids cross-origin auth issues, and fits a small internal app.

### Production environment variables

Backend:

- `DATABASE_URL`
- `SESSION_SECRET`
- `PORT`
- `NODE_ENV=production`
- `FRONTEND_URL`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `ADMIN_SEED_NAME`

Frontend:

- `VITE_API_BASE_URL`

For the one-service App Platform setup, set `VITE_API_BASE_URL=/api` at build time so the browser calls the same origin.

### Recommended DigitalOcean App Platform commands

Install command:

```bash
npm run do:install
```

Build command:

```bash
npm run do:build
```

Run command:

```bash
npm run do:start
```

The frontend build output stays in the root `dist/` folder. The Fastify server now serves that folder for non-API routes and returns `index.html` for SPA paths such as `/set-password?token=...`.

### Neon setup

1. Create a Neon Free PostgreSQL project.
2. Copy the connection string into `server/.env`.
3. Make sure it includes `?sslmode=require`.
4. Do not commit the Neon URL to GitHub.
5. Run Prisma migrations against Neon with `npm run prisma:migrate` from `server/`.
6. Run `npm run seed:admin` once from `server/`.

### Deployment checklist

1. Push the repo to GitHub.
2. Create the DigitalOcean App Platform app from GitHub.
3. Set the app type to a single web service.
4. Add the production environment variables above.
5. Set `FRONTEND_URL` to the exact `https://your-app-name.ondigitalocean.app` URL.
6. Set `VITE_API_BASE_URL=/api`.
7. Use the install, build, and run commands listed above.
8. Run `npm run prisma:migrate` once against Neon.
9. Run `npm run seed:admin` once to create the first admin.
10. Open the `ondigitalocean.app` URL.
11. Log in with the seeded admin.
12. Approve other users manually.
13. Export JSON after setup and after major changes.

### Production behavior

- The backend serves both the Vite frontend and `/api/*` routes.
- `GET /api/health` remains available for App Platform health checks.
- Unknown non-API routes return `index.html`, so setup/reset links work directly.
- Cookies are `httpOnly`, use `sameSite=lax`, and switch to `secure=true` in production.
- CORS allows only the configured `FRONTEND_URL` and keeps `credentials: true`.

### Security checklist

- `.env` files stay gitignored.
- Secrets are never committed.
- Cookies remain HTTP-only.
- Cookies should be secure in production.
- Auth tokens are not stored in localStorage.
- CORS should allow only the configured frontend origin.
- Pending, rejected, and disabled users cannot log in.
- Access requests do not create active users.
- Password setup/reset links remain manual and one-time-use.
- Prisma migrations are used for schema changes.
- JSON export is the recommended backup after major updates.

### Backup guidance for Neon Free

- Export JSON after initial setup and after major data changes.
- Keep the GitHub repo and Prisma migrations safe.
- If the data becomes business-critical, plan an upgrade later instead of relying only on memory or screenshots.

## Exports

- SVG: native 1600 × 900 vector output without HTML `foreignObject` content
- PNG: 3200 × 1800 image rendered from the same SVG
- JSON: validated Version 2 planner data with automatic Version 1 migration

Organization Overview, Operations Detail, and Vessel Allocation views can be exported. Direct PDF/PPT generation is intentionally deferred; SVG is the recommended PowerPoint format.
