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
