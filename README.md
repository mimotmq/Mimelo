# mimELo

A public record book for one shared group, with independent EA FC 26, EA FC 27, tennis, table tennis, Smash, and pickleball records. This is a fresh implementation. It does not read or migrate the previous application's database, accounts, settings, or themes.

Game pages use compact mobile banners, direct view navigation, two-column statistics, wrapping player names, and rankings that fit phone screens. The homepage lists six games without “Live” badges. Pickleball supports singles and fixed doubles pairs, with separate ratings, competitions, and per-game score entry. Standard side-out scoring defaults to best of three games to 11; best of five to 11 and single games to 11, 15, or 21 are also available. Every game must end at the first score that reaches its target with a two-point lead, and no games may follow the match-winning game. These rules follow the [2026 USA Pickleball rulebook](https://usapickleball.org/docs/rules/USAP-Official-Rulebook.pdf?court=2026), sections 4 and 15.C.1; single games to 11 are available for recreational play. Rally scoring is not offered.

The homepage's Recently accepted panel shows the latest five accepted results across every game, ordered by acceptance time. Its horizontal broadcast ticker continuously loops through results, pauses on hover or keyboard focus, offers a pause/resume control, and stays still for reduced-motion preferences. Each rectangular segment reuses the game overview scorecard: football club crests, Smash fighter icons and stocks for every game, and tennis/table-tennis set scores. The strip spans the page width with square corners and no gaps between results. Game names stay in the upper left, large faint game logos sit directly behind the scores, and subtle alternating hues distinguish consecutive results. Player counts convey singles/doubles without an extra label. Each result links to its game and match details.

On a competition page, site admins and admins for that game can use Delete at any stage, including completed tournaments. The confirmation dialog requires the exact competition name. Deletion permanently removes registrations, fixtures, dependencies, qualification decisions, matches (including voided results and forfeits), score revisions, confirmations, rating ledger entries and related notifications. Affected game/format ratings and peaks are rebuilt from remaining results in the same transaction; player accounts, other competitions and unrelated games/formats remain intact. Audit history records the deletion. Organizers retain permission to delete their own competitions before the draw.

Tournament setup and rule editing use wide, responsive layouts with compact numeric inputs and toggles. Standings tiebreaks are an ordered list of named rules: select, move, add or remove criteria without entering comma-separated keys. Seed numbers also use compact fields, and signup deadlines appear only when open registration is enabled. Demo-only template notices are removed before live screens appear.

The eight HTML files, stylesheet, fonts, and images in `static/` are byte-identical to the supplied OpenDesign Cloud mockup. JavaScript connects them to a new Fastify/SQLite backend. `design-reference/` preserves the complete source and its hashes; see [REBUILD.md](REBUILD.md) for the integration map.

## Run locally

Use Node.js 22.12 or later (Node 24 is used by CI), npm, and a persistent local filesystem. The SQLite native dependency needs Python and a C/C++ build toolchain if a compatible binary is unavailable.

```sh
npm ci
npm start
```

Open **http://localhost:8080**. Public viewing needs no account. The first launch creates only the six game definitions: no sample people, teams, competitions, results, or default administrator. Existing books gain the pickleball definition on restart. Anyone may register a player account; email is optional.

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

Knockout competitions open on the bracket. Wide screens show a single-elimination draw from both sides toward a central final; mobile keeps all matches in a round together and scrolls horizontally between rounds. Round buttons also navigate, and later rounds come into view vertically after a swipe in large draws. Cards show player photos (or initials), the recorded club crests, separate scores, penalty scores and `a.e.t.` when applicable. Future matches do not inherit a team's choice from an earlier round. Completed/pending result cards open the existing result dialog; ready matches link to recording. Byes, source-match placeholders, doubles, and the double-elimination lanes/reset remain visible. Entrants collapse into an expandable list after the draw. Explicit `?view=table`, `fixtures`, `bracket`, or `rules` links select that competition view.

Organizers choose ordered standings tiebreaks. A tied qualifying boundary waits for an admin selection with a reason or an additional round among the tied entrants. A multi-way tie uses a small round robin; a remaining tie can receive another round or an admin decision. Additional games do not rewrite the original league/group standings. A tied league championship also waits for resolution.

Ratings start at 1000. Each player’s K starts at 124 and tapers logarithmically to 24 on rated match 45, staying at 24 thereafter: `K(n) = 24 + 100 × (1 − ln(1 + min(n, 44)) / ln(45))`, where `n` is prior matches with Elo checked off in that game and format. A match uses the arithmetic mean of all participants’ K values (both players in singles, all four in doubles), preserving equal-and-opposite changes between sides. The recording estimate uses the same rule. On the first start after this upgrade, existing checked-off matches replay atomically with this policy; stored approvals, original submission ordering, and team-overall snapshots are preserved.

Ratings and ledger values retain decimal precision (four decimal places) in storage and calculations. User-facing Elo displays round to the nearest integer; ranking order uses the stored decimal values. Ratings appear with a question mark (for example, `1024?`) until the player has **8 matches with Elo checked off** in that game and format. All early matches affect Elo normally. Acceptance alone, Elo-disabled matches, and forfeits do not advance this count. Corrections, voids, and eligibility changes recalculate provisional status from the rating ledger. The same stored rating is used for calculations and seeding during this period. This is a custom Elo policy informed by [Chess.com’s explanation of confidence in new ratings](https://support.chess.com/en/articles/8566476-how-do-ratings-work-on-chess-com).

Each game and singles/doubles pool is independent. Doubles uses each pair's average doubles Elo and applies the same signed change to both partners. Replay orders by the original server submission timestamp, then match ID, regardless of checkoff order. No seasons, backdating, or automatic resets exist.

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

Recording uses compact numeric score fields across all games. Smash has searchable visual fighter/stage popouts; choosing a tile applies it immediately. Fighters and stages carry forward within a match until a later game changes them. Sudden-death winner choices appear only when both stock scores are entered, equal, and below the normal winning total (3 singles / 6 doubles); changing to an unequal score clears the choice. Pokémon Trainer and Pyra/Mythra each occupy one roster slot, with official fighter numbers and superscript epsilon labels for echoes. Historical individual forms keep their original IDs and names when correcting results.

Smash's 86 roster icons and ten stage images are bundled from the owner's supplied head-icon set and `ssbu/stages` folder in `static/assets/smash/`; no uploads are needed. The desktop picker uses the available width, with uniformly aligned icons and names, faint fighter numbers behind the icons, and horizontal fitting for long names. Starter stages are Battlefield, Final Destination, and Smashville; the remaining seven stages are Counterpicks. Add future stages to `static/catalogs/smash.json` with stable IDs, images, and group labels; the picker discovers them automatically.

Game overview pages keep navigation pinned on desktop. Other game views and detail pages use an overlay sidebar that opens when the pointer enters the left edge and closes after it leaves. Keyboard users can focus the edge target; Escape closes the drawer. Phones, tablets, and other touch devices use a menu icon in the header, with a dismissible backdrop and keyboard focus kept inside the open drawer.

## Team catalogs

Site/game admins can edit teams or import CSV/XLSX from **Admin → Games → Administer**. Catalogs are independent per EA FC edition. Headers:

```csv
code,name,overall,nation,league,gender
```

`code` is unique within the edition; importing an existing code updates that team. `name` is required. `overall` is 0–100 or empty until supplied. Optional `nation`, `league`, and `gender` support filtering. Imports accept up to 10,000 rows and a 5 MB file; validation failure rolls back the entire import. Nothing imports automatically.

## Team badges, Smash stock icons, and stage photos

Open **Admin → Games → Administer → Manage images** for EA FC 26, EA FC 27, or Smash.

- **Team badges:** upload a badge once, then choose **Use existing badge** for other teams that share it (for example, Chelsea, Chelsea Women, and Chelsea All Time XI). Teams with the same code and gender automatically share the association across EA FC editions. Different codes or genders can be linked to the same saved badge. **Upload new badge** changes only the selected code/gender across editions; **Unlink badge** clears that association while retaining the badge in the library and on other teams.
- **Character stock icons:** select this image type in Smash and upload beside the character's displayed ID. These are mimELo catalog IDs, not official fighter numbers.
- **Stage photos:** select **Stage photos** in Smash and upload beside the stage's ID (for example, `battlefield`). The photo appears in each game's match details, including doubles/team matches.

Uploads accept PNG, JPEG, or WebP up to 5 MB. Transparent icons retain transparency and fit inside a square; stage photos retain their aspect ratio. For Smash images, use **Replace image** to override a bundled icon/photo or **Use default image** to restore it. Uploaded images have no added background fill, so transparent PNG areas show the page underneath. Names/codes remain visible when an image is unavailable. Badges appear beside EA FC match sides, and stock icons appear per game and player in Smash scorecards and recording pickers.

The app stores the files in `.runtime/uploads/catalog/` and reusable EA FC badges in SQLite's `team_badges` table, their code/gender associations in `team_badge_links`, and Smash character/stage associations in `catalog_images`. Existing edition-specific uploads migrate into the library automatically. If matching code/gender entries had different badges, the most recently uploaded badge becomes the shared default; the alternatives remain in the library. Upload through the admin screen rather than copying files into the folder: copying alone does not create an association. The shared Smash IDs and names are in `static/catalogs/smash.json`. Back up the database and the entire `.runtime/uploads/` directory together. Replaced/removed files are retained for existing cached pages and backups; removal clears the active association.

### Bulk club crests

In **Admin → Games → Administer → Manage images → Bulk import crests**, download the edition's team mapping CSV and the browser helper ZIP. Unzip the helper, open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select the helper folder. Open the extension and load the CSV. Enter confirmed SoFIFA numeric image IDs or direct PNG URLs. These image IDs are separate from Mimelo team codes and may differ from SoFIFA page IDs. The helper can suggest exact normalized name matches from open SoFIFA pages; each suggestion requires confirmation. It does not guess women's club associations.

Developers can also run `npm run crest-helper` to build `artifacts/mimelo-crest-helper.zip` without starting a server.

Download a crest ZIP from the helper, then upload it in Mimelo, preview the matches, and apply the ready rows. Downloads run on your computer through the extension; this does not guarantee SoFIFA will accept them. On HTTP 403/429, further network downloads stop. You can add manually downloaded PNG/JPEG/WebP files to the helper instead. Save the mapping CSV to keep your progress; closing the helper tab clears its in-memory state.

Manual ZIPs are also accepted. Put `mapping.csv` at the root with these columns and the referenced image files:

```csv
code,name,gender,sofifa_id,url,file,badge_id
MUN,Manchester United,men,14,https://cdn.sofifa.net/meta/team/14/240.png,sofifa-14.png,
```

`code` and `gender` must match the current edition's catalog. Names are labels, not matching keys. URL/SoFIFA ID columns are download instructions for the helper; the server only imports files inside the ZIP and never fetches URLs. To share a new crest across confirmed teams, use the same `file` on their rows. To reuse an existing library badge (including for a women's team), copy its `badge_id` from the exported mapping onto that team's row. Saved badge IDs take priority over image files. The importer always preserves existing associations, including manually uploaded crests, and shared code/gender associations apply across editions. Individual image management remains available for replacing a crest.

Preview does not save images or change associations. Apply imports only ready rows and reports skipped rows. Missing codes/files, invalid images, gender mismatches and duplicate target codes are reported. If the catalog changes after preview, a new preview is required. One source file creates one reusable library badge; repeated imports preserve existing associations. Limits: 25 MB ZIP, 5 MB per image, 100 MB expanded image data, 2,500 archive entries and 10,000 mapping rows. Split larger imports.

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
