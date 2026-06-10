# Q&A Board

A lightweight, self-hosted live Q&A board for talks, webinars, and town halls.
Attendees post questions, upvote each other, and the most relevant rise to the
top. One admin moderates. No build step, no database, no framework install —
just PHP files you drop on a host.

## Features

- **Ask & upvote** — attendees submit questions and vote; one vote per person
  per question, no voting on your own.
- **Balanced ranking** — surfaces questions by a blend of votes and freshness so
  new questions aren't buried. Half-life is admin-configurable.
- **Per-person limit** — caps how many live questions one person can have
  (default 3, admin-configurable 1–20).
- **Admin moderation** — mark answered, delete, and reset all questions.
- **Auto-refresh with jitter** — clients poll on an interval (default 15s,
  admin-configurable 5–120s). Polls are de-synchronized so the server isn't hit
  by every client at once.
- **Post-event poll redirect** — when the session ends, the admin can push a
  poll URL. Attendees get a 5-second countdown overlay (with an opt-out +
  confirm), and anyone arriving at the same link within 60 minutes is forwarded
  too. Admins are exempt.
- **Case-insensitive entry** — `qa.html`, `Qa.html`, etc. resolve to `QA.html`
  via `.htaccess`.
- **Privacy-respecting identity** — a server-set HttpOnly cookie, no accounts,
  no third-party trackers.

## Quick start

1. Upload these files to any PHP-capable host (shared hosting is fine), keeping
   them together in one directory:
   `QA.html`, `QA.js`, `api.php`, `ranking.js`, `redirect.js`, `auth.js`,
   `.htaccess`.
2. Visit `https://your-host/path/QA.html`.
3. Click the ⚙ gear and **set the admin password** — the first visitor to do so
   claims it. Set it immediately after deploying.
4. Share the `QA.html` link with your audience. That's it.

`data.json` is created automatically on first write and holds all questions and
settings. You do not upload it; do not commit it.

> **Local preview:** the backend needs PHP. Opening `QA.html` from `file://`
> won't run `api.php`. Use `php -S localhost:8000` in the project directory, or
> deploy to a PHP host.

## Admin settings

Sign in via the ⚙ gear, then use the admin bars to change at runtime:

- **Balanced half-life** (5–10080 min) — how fast a question's freshness decays.
- **Max questions per person** (1–20).
- **Refresh interval** (5–120 s) — see *Realistic concurrency* before lowering.
- **Change admin password** — sets a new password and signs out all other admin
  sessions.

## Resetting / recovering the admin password

The password is stored only as a bcrypt hash inside `data.json` (never in the
code). If you lose it, edit that file on the host:

- **Forgot the password (keep questions):** open `data.json` and remove the
  `adminPasswordHash` field (or set it to `""`). The next visit to `QA.html`
  re-runs first-time setup so you can set a new one.
- **Start completely fresh:** delete `data.json` entirely. It is recreated on
  the next request, and the board re-runs first-time setup. **This also deletes
  all questions and settings.**

## Hosting notes

- **Apache:** the bundled `.htaccess` blocks direct access to `data.json` /
  `data.lock` / temp files and handles case-insensitive URLs. Nothing else to do.
- **nginx:** there is no `.htaccess`. Add a location block denying
  `data.json`, `data.lock`, and `data.json.new*`, and (optionally) redirect
  wrong-case `qa.html` to `QA.html` yourself.
- Requires PHP 7+ (uses `password_hash`/`password_verify`, `random_bytes`).

## Realistic concurrency

The backend is a single JSON file guarded by an exclusive lock, so **every
request — including refresh polls — is processed one at a time**. That keeps the
data consistent and the setup trivial, but it caps throughput.

- **~100–150 concurrent participants** is comfortable on modest shared hosting
  at the default 15-second refresh.
- **A few hundred** is realistic on a VPS or dedicated host.
- **The refresh interval is the primary load lever.** Halving it roughly doubles
  request rate; the 5-second floor exists to stop an accidental server overload.
  For larger audiences, raise the interval rather than lower it.
- It is **not built for thousands** of simultaneous users. That scale needs a
  real datastore (Postgres/Redis) and a different concurrency model — out of
  scope for this project by design.

## Files

| File | Role |
|------|------|
| `QA.html` | Page shell; loads the scripts. |
| `QA.js` | React UI (via CDN, no build step). |
| `api.php` | Backend: storage, auth, validation, locking. |
| `ranking.js` | Pure ranking/freshness helper (unit-tested). |
| `redirect.js` | Pure poll-redirect decision helper (unit-tested). |
| `auth.js` | Pure setup-vs-login decision helper (unit-tested). |
| `.htaccess` | Apache: protects data files, case-insensitive URLs. |

## Development

Pure helpers have Node tests (no dependencies):

```bash
node --test
```

The PHP backend has no local test harness; verify it against a real PHP host.

## License

MIT — see [LICENSE](LICENSE).
