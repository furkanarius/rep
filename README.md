# Rep: your personal strength coach

A phone-first, offline-capable web app for one person. Open it and it tells you what to do today: tap **Start**, log each set with one tap, **Finish**. The plan runs about a year in 5 stages that unlock by performance, not by the calendar. See [PROGRAM.md](PROGRAM.md).

- No accounts, no tracking, no ads. Your data lives in your browser (IndexedDB) with optional private backup to a GitHub Gist.
- Works in airplane mode after the first load (installable PWA).
- Free hosting on GitHub Pages.

## Install on iPhone
1. Open the app URL in **Safari**.
2. Tap the **Share** button (square with arrow).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open **Rep** from your Home Screen (it runs full-screen, like an app).
5. Open it once while online; after that it works with no signal.

## Backup & sync with a secret GitHub Gist (optional, 5 steps)
Your data stays on your phone. iOS can clear website data if you don't use a site for a long time, so a backup is a good idea. This also lets you continue on a laptop.

1. **Create a token.** On github.com go to *Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)*. You'll see a form with a "Note" field, an "Expiration" dropdown and a long list of checkboxes.
2. **Give it only the gist scope.** Note: `Rep backup`. Expiration: whatever you prefer (e.g. 1 year). Tick **only** the box labelled **`gist`** ("Create gists"). Nothing else.
3. **Copy it.** Click the green *Generate token* button at the bottom. GitHub shows the token once (a string starting `ghp_`). Tap the copy icon next to it.
4. **Paste it into Rep.** In Rep, tap the gear → *Backup & sync* → paste into the token field → **Save token & sync**. The status line changes to "last synced just now". A *secret* Gist named "Rep backup" now exists in your GitHub account.
5. **On your other device**, open Rep and paste the same token. Rep finds the Gist and merges it in. From then on, Rep syncs after every finished workout (and when you tap *Sync now*).

How sync behaves: the token is stored only on that device and is never included in exports. Merging is per record: the newest change wins, and deletes travel as tombstones, so nothing disappears silently. Offline? Changes are queued and sent when you're back online.

No token? Use *Export JSON* in Settings now and then (you'll get a gentle reminder after 14 days). *Import a JSON backup* merges a file back in.

## Develop

```bash
npm install
```

```bash
npm run dev
```

| Command | What it does |
|---|---|
| `npm test` | Vitest unit tests (progression, scheduler, gates, deload, units, backup, sync) |
| `npm run e2e` | Playwright smoke test at an iPhone 14 viewport: onboarding → workout → progress |
| `npm run lint` | ESLint |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run media` | Re-download and convert exercise photos (only needed when adding exercises) |
| `npm run icons` | Regenerate app icons |

In dev mode, Settings has a **Load demo data** button (hidden in production) to fill the charts.

## Deploy (GitHub Pages)
Pushing to `main` runs `.github/workflows/deploy.yml`: lint, unit tests, build with `BASE_PATH=/<repo>/`, and deploy `dist/` to Pages (plus a separate e2e job). One-time setup: in the repo go to *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.

## Structure
```
src/
  app/        routes, shell, live data context, derived values
  features/   today · workout · plan · progress · library · settings · onboarding
  engine/     pure, tested logic: progression, scheduler, gates, deload, stats, session builder, ics
  data/       program.json (the year plan) · exercises.json (76 exercises)
  db/         Dexie schema, repository layer, backup/merge, Gist sync
  lib/        units, dates, e1RM, sound, wake lock
public/exercise-media/   bundled WebP photos (public domain)
```

## Editing the plan
Everything about stages, workouts, rep ranges and gates is in `src/data/program.json`; exercise text and media are in `src/data/exercises.json`. `npm test` validates that every reference resolves and every exercise has a full how-to.

## Safety
Rep is a general training app, not medical advice. Stop any exercise that causes sharp pain, and check with a doctor if pain persists.
