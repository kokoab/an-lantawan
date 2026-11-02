# An Lantawan

Website of An Lantawan, the official student publication of Leyte Normal University. It covers the public site, the editors' admin, Sportsfest coverage, and Sumat (`/sumat`).

Built with Astro on Cloudflare Workers. Data lives in Cloudflare D1 (SQLite), and files live in R2. Everything runs on Cloudflare's free tier.

## Run it on your computer

You need Node.js 24 or newer.

```sh
npm install                 # also generates Cloudflare types
npm run db:migrate:local    # creates a local copy of the database with starting data
npm run dev                 # http://localhost:4321
```

## Before you push

```sh
npx biome check --write .   # format and lint
npx astro check             # type check
npm test                    # logic tests
npm run build
```

GitHub runs the same checks on every push.

## Where things are

| Folder | What's in it |
|---|---|
| `src/core/` | Rules that don't need a database: medal tally, standings, brackets, Sumat checks. Each has a `.test.ts` beside it. |
| `src/db/schema/` | Database tables and how they relate |
| `src/db/queries/` | Reading and writing the database |
| `src/pages/` | One file per page or route. `src/pages/api/` holds JSON endpoints. |
| `migrations/` | Database changes, applied in order |

## Changing the database

1. Edit the tables in `src/db/schema/`.
2. Run `npm run db:generate`. This writes a new file in `migrations/`. Read it before committing.
3. Run `npm run db:migrate:local` to try it on your computer.
4. Commit. The deploy applies it to the live database.

Don't edit or delete a migration that has already been deployed. Write a new one instead.

## Deploying

Cloudflare builds and deploys every push to `main`. The build settings in the Cloudflare dashboard (Workers & Pages → an-lantawan → Settings → Build) are:

- Root directory: `/`
- Build command: `npm run build`
- Deploy command: `npx wrangler d1 migrations apply an-lantawan --remote && npx wrangler deploy`

## Security

- **Admin sign-in** is Google only. Nobody gets in unless their email is in the `editors` table and not archived. Archiving an editor signs them out everywhere straight away. Sessions last 30 days and are stored only as a hash.
- **Every page under `/admin` and every route under `/api/admin/`** needs a signed-in editor. `src/middleware.ts` enforces this, so a new admin page is protected without extra code.
- **Sumat** uses a hidden trap field, a minimum time on the page, Turnstile, a limit of 3 messages a minute per visitor, and 60 a minute overall.
- **Sign-in** is limited to 10 attempts a minute per visitor.
- **Every page** gets a Content-Security-Policy, so only this site's scripts run. Forms only accept posts from this site.
- **Secrets** (`GOOGLE_CLIENT_SECRET`, `TURNSTILE_SECRET`) are set with `npx wrangler secret put NAME`. Never commit them. Copy `.dev.vars.example` to `.dev.vars` for local work.
- **Turn on two-factor sign-in** for the Google, Cloudflare and GitHub accounts that own this site.

### Rules that keep the site free

- Stay on the **Workers Free** plan. Its daily request cap is what stops an attack from turning into a bill.
- Keep **public access off** on the R2 bucket. Files are served only through the site.
- Only signed-in editors can upload, and uploads have size limits.

### If something goes wrong

- **Bad deploy:** in the Cloudflare dashboard, open Workers & Pages → an-lantawan → Deployments and roll back to the previous version.
- **Bad data:** restore the database to any minute in the last 30 days with `npx wrangler d1 time-travel restore an-lantawan --timestamp=<time>`.
- **Lost or stolen account:** archive that editor in the admin, or delete their row in `editors` from the Cloudflare D1 console.
