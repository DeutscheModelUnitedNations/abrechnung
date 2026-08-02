# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

DMUN Abrechnung is a German expense-reporting web app (travel/business-trip expenses with automatic per-diem lump sum calculation, general expenses, and health-care cost reimbursement). It's a three-package monorepo run entirely via Docker Compose:

- `backend/` — Express 5 + TypeScript + Mongoose + tsoa REST API
- `frontend/` — Vue 3 + TypeScript + Vite SPA (PWA)
- `common/` — shared TypeScript package (`abrechnung-common`) consumed by both via `file:../common` dependency — shared domain types, the per-diem calculator, i18n locale files, and env validation

This repo (`DeutscheModelUnitedNations/abrechnung`) is a fork of [david-loe/abrechnung](https://github.com/david-loe/abrechnung), adapted and maintained by DMUN for its own needs. When comparing behavior against upstream docs/issues, or deciding whether a change is a local customization vs. something to eventually upstream, keep this fork relationship in mind — check `git log`/history for DMUN-specific commits before assuming upstream conventions still apply everywhere.

## Development environment

```sh
cp .env.example .env      # adjust ports/URLs/secrets if needed
docker compose up
```

- Frontend: `http://localhost:5000` (default `.env`), login via `professor:professor` against the bundled test LDAP (`NODE_ENV=development`), or via the magic-login link printed in the backend container logs / caught by `inbucket` (test SMTP UI on `INBUCKET_UI_PORT`).
- Backend Swagger UI (dev only): `http://localhost:8000/docs`.
- `mongo-express` service gives DB access at `MONGO_EXPRESS_PORT`.
- `common` runs as its own watching container (`nodemon` → `tsc`) so `dist/` stays fresh for the backend/frontend containers, which bind-mount `./common` read-only.
- Backend and frontend containers bind-mount their source dirs, so code changes hot-reload inside the running containers — no rebuild needed for normal edits.

Pre-commit lint hook (Biome, backend/common only):

```sh
ln -sf ../../dev-tools/biome/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## Common commands

Run these inside the relevant container (`docker compose run <service> <cmd>`) or locally if you have Node set up matching the package's toolchain.

**common** (must be built before backend/frontend can see type changes — the dev containers do this automatically via `nodemon`):
```sh
npm run build   # tsc -> dist/
npm run test    # build + ava
```

**backend**:
```sh
npm run dev     # tsoa spec-and-routes + tsc + node, watched via nodemon
npm run build   # tsoa spec-and-routes && tsc  (regenerates dist/routes.js + dist/swagger.json)
npm run test    # build + ava --serial (dist/tests/**/*) — needs db/ldap/inbucket running
npm run setup   # build + node dist/setup.js  (also runs pending DB migrations)
```
Run a single backend test file after building: `LOG_LEVEL=WARN ava --serial dist/tests/api/travel.js`.

**frontend**:
```sh
npm run dev     # vite + vue-tsc --noEmit --watch
npm run build   # vue-tsc --noEmit && vite build
npm run lint    # eslint --fix src (Vue files)
```

**Linting/formatting** (backend + common, JS/TS/JSON/Vue): Biome, config at `/biome.json`.
```sh
npx biome check .        # from repo root
npx biome check --write .
```
CI runs `biome ci --changed --error-on-warnings`.

## Architecture

### tsoa-driven API (backend)

Controllers in `backend/controller/*Controller.ts` use `tsoa` decorators (`@Route`, `@Get`, `@Post`, `@Security`, ...). `tsoa.json` points at these globs; `npm run build`/`dev` runs `tsoa spec-and-routes` first, generating `backend/dist/routes.js` (mounted by `RegisterRoutes(app)` in `app.ts`) and `backend/dist/swagger.json` (served at `/docs` in dev). **After adding/changing a controller route or its types, the tsoa generation step must re-run before the route or Swagger doc reflects it** — this happens automatically under `npm run dev`/`build`.

Most controllers extend the shared `Controller` base class (`backend/controller/controller.ts`), which implements generic Mongoose-backed CRUD: `getter`/`setter`/`deleter`/`setterForArrayElement`, driving pagination, filtering (`GetterQuery`), and permission checks (`checkOldObject` callbacks) declaratively rather than each controller hand-rolling query logic.

Auth is session-based (`express-session` + `passport`, wired in `auth.ts`/`app.ts`). Multiple strategies live in `backend/authStrategies/` (LDAP, OIDC, Microsoft, magic-login email link, HTTP bearer for the API) and are selected/configured via env/organisation settings.

### Mongoose models + generated forms (backend/models)

Each domain object (`travel.ts`, `expenseReport.ts`, `healthCareCost.ts`, `advance.ts`, `user.ts`, etc.) defines a Mongoose schema plus instance methods (e.g. `saveToHistory`, `calculateExchangeRates`). Shared schema fragments live in `models/helper.ts` (e.g. `travelBaseSchema`, `requestBaseSchema`, `costObject`, history/logging helpers).

`models/vueformGenerator.ts` converts a Mongoose `SchemaDefinition` directly into a Vueform schema (`mongooseSchemaToVueformSchema`), which is what lets the frontend render forms for these models without hand-duplicating field definitions — when changing a model schema, check whether its form config needs no change (it's usually derived automatically) versus special-cased UI.

### Shared types and calculation logic (common/)

`common/types.ts` is the single source of truth for domain types (`Travel`, `User`, `State`, etc.) shared between backend and frontend — both depend on the compiled `abrechnung-common` package, so type changes require the `common` build step to propagate (handled automatically by the watching `common` container in dev).

`common/travel/calculator.ts` implements the actual per-diem/lump-sum travel cost calculation (see its `.spec.ts`/`calculatorBlackBox.spec.ts` tests for expected behavior) — this is business-logic-critical code, not just formatting.

`common/utils/env.ts` provides `cleanBackendEnv`/frontend env cleaners built on `envalid`; both `backend/env.ts` and `frontend/src/env.ts` are thin wrappers around these, giving a single validated env schema across both apps.

`common/locales/{de,en}.json` hold i18n strings shared by backend (emails/PDFs, via `backend/i18n.ts`) and frontend (`frontend/src/i18n.ts`); PDF report generation additionally uses fonts in `common/fonts/`.

### Frontend (Vue 3 + Vite)

- `src/api.ts` — thin generic `API` class wrapping axios `getter`/`setter`/etc. against the backend, typed against common's `GETResponse`/`SETResponse`, plus a shared alert/toast queue.
- `src/appData.ts` — global reactive app state (current user, settings, etc.), populated on load and consumed across views.
- `src/router.ts` — Vue Router routes/guards.
- `src/indexedDB.ts` — client-side persistence (used for offline/PWA support alongside `registerSW.ts`/`vite-plugin-pwa`).
- `src/components/` is organized by domain to mirror the backend: `travel/`, `advance/`, `expenseReport/`, `healthCareCost/`, `settings/`, plus shared `elements/`.
- Forms are largely built with `@vueform/vueform`, driven by the backend-generated Vueform schemas described above.

### PDF generation

`backend/pdf/` builds PDF reports (travel, expense, receipts) using `pdf-lib`/`pdf-fontkit`; `backend/pdf/flags` and `backend/pdf/receipt` hold supporting assets/logic. `pdf/helper.ts` handles writing to disk / emailing generated PDFs.

### Migrations

`backend/migrations.ts` runs `checkForMigrations()` on server startup (also invoked via `npm run setup`) to apply pending DB migrations — CI's `migration-test.yml` specifically validates upgrading from the previous released image runs migrations cleanly.

## Testing

- Backend and common tests use `ava` and run against the **compiled** `dist/` output (`npm run test` builds first). Backend API tests (`backend/tests/api/*.ts`) need `db`, `ldap`, and `inbucket` containers running (`docker compose up -d common db ldap inbucket`) since they exercise real auth flows and mail capture.
- `backend/tests/calculation/` covers cost/lump-sum calculation logic; `common/travel/calculator*.spec.ts` covers the underlying calculator in isolation.
- No automated tests exist for the frontend beyond `vue-tsc` type-checking during build.

## Notes

- `common` is a real dependency, not just shared source — always account for its build step (`npm run build` in `common/`, or the watching `common` container in dev) after editing anything under `common/`.
- Env vars are validated centrally through `common/utils/env.ts`; add new env vars there rather than reading `process.env`/`import.meta.env` ad hoc.
- Biome is the source of truth for backend/common formatting (2-space indent, single quotes, no semicolons, 140 char line width, organize-imports on). Frontend `.vue` files are linted/formatted separately via ESLint (`frontend/npm run lint`) and Biome overrides (`useConst`/import-related rules off for `.vue`).
