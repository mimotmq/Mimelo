# mimELo

A public record book for one shared group, with independent EA FC 26, EA FC 27, tennis, table tennis, and Smash records. This is a fresh implementation. It does not read or migrate the previous application's database, accounts, settings, or themes.

The eight HTML files, stylesheet, fonts, and images in `static/` are byte-identical to the supplied OpenDesign Cloud mockup. JavaScript connects them to a new Fastify/SQLite backend. `design-reference/` preserves the complete source and its hashes; see [REBUILD.md](REBUILD.md) for the integration map.

## Run locally

Use Node.js 22.12 or later (Node 24 is used by CI), npm, and a persistent local filesystem. The SQLite native dependency needs Python and a C/C++ build toolchain if a compatible binary is unavailable.

```sh
npm ci
npm start
```

Open **http://localhost:8080**. Public viewing needs no account. The first launch creates only the five game definitions: no sample people, teams, competitions, results, or default administrator. Anyone may register a player account; email is optional.

Create the initial site administrator explicitly. The following Bash commands keep the password out of shell history:

```sh
read -r -s -p 'New site-admin password: ' MIMELO_ADMIN_PASSWORD
export MIMELO_ADMIN_PASSWORD
npm run admin -- --handle yourhandle --name 'Your display name'
unset MIMELO_ADMIN_PASSWORD
```

Choose a new, unused handle. Run this from the project directory against the same `MIMELO_DATABASE` as the server. Site administrators can assign game-admin roles in the Admin page. There is no automatic promotion of the first public signup.

## Configuration and hosting

The server uses environment variables; `.env.example` documents them. To load a local file explicitly, use `node --env-file=.env server/index.js`. Do not commit passwords or runtime files.

| Variable          | Default                | Purpose                                                       |
| ----------------- | ---------------------- | ------------------------------------------------------------- |
| `HOST`            | `127.0.0.1`            | Listening interface                                           |
| `PORT`            | `8080`                 | HTTP port                                                     |
| `MIMELO_DATABASE` | `.runtime/book.sqlite` | Fresh SQLite database; use an absolute path for deployment    |
| `APP_ORIGIN`      | Request origin         | Public origin used to validate browser mutations              |
| `NODE_ENV`        | development            | Set `production` behind HTTPS; enables secure session cookies |
| `TRUST_PROXY`     | `0`                    | Set `1` only behind your trusted reverse proxy                |

Run one server process with a persistent disk. Store `.runtime/uploads/` alongside the database backup for profile photos. SQLite uses WAL, foreign keys, transactions, and a busy timeout. Do not put its live database on a network filesystem or deploy to an ephemeral/static-only host. HTTPS, a domain, and an external deployment are not configured by this rebuild.

A checkoff rebuilds the affected rating pool synchronously to preserve submission chronology. Large rating histories should be benchmarked on the chosen host before increasing concurrency. Public lists are paginated; a competition supports 2–256 entries. The server applies request limits and stricter login/signup limits.

## Accounts and permissions

- Login accepts a handle or email. Display name, optional email, password, photo, and flairs are editable. Handle changes require site-admin review.
- Site/game admins create shared fill-in profiles and expiring claim links. Claiming a new account keeps the profile's history. An existing account requests a reviewed merge; overlapping matches or competition entries block a merge.
- Only site admins issue password-reset links. Links are single-use: claims last seven days, resets one hour. Issuing another link revokes previous links for that target. There is no email delivery, email digest, or email password recovery.
- Game admins act within their games. Competition organizers manage their competitions and accept results, but need a separate game/site-admin role to check off Elo.
- Session cookies are HTTP-only; mutations require a session CSRF token and same-origin verification. Passwords use salted scrypt hashes. Private link tokens and session tokens are hashed in storage.

## Results, competitions, and ratings

A participant or relevant admin submits a result. An organizer, relevant admin, or one representative from each side can accept it; submission counts as the submitting participant's confirmation. Acceptance updates standings and brackets. **Elo changes only after a separate relevant-admin checkoff.**

Edits require the current revision, discard previous confirmations/checkoff, and recalculate eligible ratings. Only admins correct accepted results. An earlier dependent result locks when a downstream result is submitted. Organizer/admin forfeits advance immediately and never affect Elo.

All games support round robin, leagues with playoffs, groups followed by knockout, and single/double elimination. Registration can be selected, open with a deadline, or both. The organizer closes registration before drawing; an expired deadline also permits the draw. Rules, entrants, and doubles partners freeze at draw generation. Schedules remain editable. Withdrawals during play are handled as forfeits. Seeding supports Elo, random, manual order, or numbered seeds; highest seeds receive first-round byes. Double elimination includes a conditional final reset.

Organizers choose ordered standings tiebreaks. A tied qualifying boundary waits for an admin selection with a reason or an additional round among the tied entrants. A multi-way tie uses a small round robin; a remaining tie can receive another round or an admin decision. Additional games do not rewrite the original league/group standings. A tied league championship also waits for resolution.

Ratings start at 1000 with K=24. Each game and singles/doubles pool is independent. Doubles uses each pair's average doubles Elo and applies the same signed change to both partners. Replay orders by the original server submission timestamp, then match ID, regardless of checkoff order. No seasons, backdating, or automatic resets exist.

Default weights: friendly **0.8**, league **1.0**, group **1.0**, knockout **1.1**, semifinal **1.1**, final **1.2**. Competition creation snapshots its weights. Game-admin changes apply to future competitions and future friendlies. Participants can disable Elo on pending results; admins can change eligibility after acceptance, including on bracket-locked scores. Eligibility-only changes preserve acceptance and advancement; re-enabling requires a fresh Elo checkoff. The recovery action **Recalculate Elo** replays checked-off results without approving additional results.

EA FC adjusts expected strength by **20 Elo points per team-overall point**. Missing overalls block Elo checkoff, but permit acceptance and advancement. Checkoff snapshots the overalls used; later catalog edits do not silently change rated matches. Football's margin multiplier is `min(1.6, 1 + 0.15 × log2(1 + goal difference))`. Other games use bounded series and score margins; Smash JV contributes up to a 1.011 multiplier, and sudden death reduces margin credit. Exact formulas and validation live in `server/scoring.js`. Estimates in the recording form use current published ratings; chronological replay determines final changes.

## Sport rules

| Game         | Recording rules                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EA FC        | Draws, extra time, and separate shootout scores. Knockout requires a winner. Shootouts decide advancement but remain draws for Elo. League points: 3/1/0.                                     |
| Tennis       | Singles best of 1/3/5; doubles 1/3. Sets to six; 7-point tiebreak at 6–6, or 10 in the deciding set, win by two. Optional doubles final-set replacement match tiebreak to 10.                 |
| Table tennis | Best of 1/3/5/7, to 11 or 21, win by two.                                                                                                                                                     |
| Smash        | Best of 1/3/5; stocks taken, up to 3 in singles or 6 combined in doubles. Fighter per player and stage per game. Equal-stock sudden death selects its winner; manual JV flag only in singles. |

Non-football standings show win/loss records. Players edit their own flairs; there are no tennis tiers. Adding a game or altering the visual design requires a code change. There is no theme editor or Add game screen.

## Team catalogs

Site/game admins can edit teams or import CSV/XLSX from **Admin → Games → Administer**. Catalogs are independent per EA FC edition. Headers:

```csv
code,name,overall,nation,league,gender
```

`code` is unique within the edition; importing an existing code updates that team. `name` is required. `overall` is 0–100 or empty until supplied. Optional `nation`, `league`, and `gender` support filtering. Imports accept up to 10,000 rows and a 5 MB file; validation failure rolls back the entire import. Nothing imports automatically.

## Backups and verification

```sh
npm run backup -- /absolute/path/mimelo-backup.sqlite
# Also copy .runtime/uploads/ to the backup location.

npx playwright install chromium
npm test
npm run verify:templates
npm audit --omit=dev
```

The backup command uses SQLite's online backup API. To restore, stop the server, point `MIMELO_DATABASE` at the restored SQLite file, restore photos, and restart. The Admin export is a public-record JSON export, not a complete account/database backup.

Tests use memory or temporary databases and test accounts; they never seed the running application. Browser checks exercise all game views at 1440px/390px, real login/recording/approval/competition/account flows, and generate ignored screenshots under `artifacts/`. Core checks cover permissions, claims, chronological replay, sport rules, doubles, byes, qualification ties, dependency locks, imports, restarts, and backup restoration.
