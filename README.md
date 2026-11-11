# mimELo

Shared accounts, roles and themes; EA FC 26 and EA FC 27 match recording, independent competition management and published Elo.

## Build and run

On Debian/Ubuntu:

```sh
sudo apt install -y g++ libsqlite3-dev libssl-dev
cd mimelo
g++ -std=c++17 -O2 main.cpp -o mimelo -lsqlite3 -lssl -lcrypto -lpthread
./mimelo 8080
```

Open http://localhost:8080. SQLite's development package supplies `sqlite3.h` and the linker library. On Windows, use WSL with these instructions.

First run creates the main admin `mimo` and prints its generated password once. To choose a password, set `MIMELO_ADMIN_PASSWORD` before first launch. Change passwords on the Account page. No admin credentials or runtime database are included in this archive.

## Updating an existing installation

Stop the old server and back up `mimelo.db`, `media/` and `fonts/` together. Replace the source/static files, rebuild, and restart from the same working directory. Do not delete the database or media directories. New columns/tables are added automatically; existing matches, users, fixtures and Elo are retained. Historical club strength is captured on migration using the old catalog (or the old three-star fallback).

Keep the backup if you need to return to the previous version. Existing tournaments retain their old fixtures; create a new competition to use the expanded draw builder.

## EA FC club catalog

Open the game's Settings page and upload/paste a UTF-8 CSV. The header is required (column order may vary):

```csv
gender,league,name,stars,code,icon
men,Example Men's League,Example City,4.5,EC,
women,Example Women's League,Example City,4.5,EC,
```

`data/teams-template.csv` and the Settings download contain fictional examples, not official EA ratings. Supply a separate catalog for each EA FC edition.

- `gender`: `men` or `women`.
- `league`: league/category name, up to 80 characters.
- `name`: club name, up to 40 characters. A name may repeat across leagues/genders.
- `stars`: 0.5 through 5, in increments of 0.5.
- `code`: 2–4 letters/digits, unique within each gender. Displayed in match summaries.
- `icon`: optional HTTPS image URL or a local `/media/...` URL from the Settings icon uploader. Empty values need a trailing comma.

Quoted commas, escaped quotes, CRLF, UTF-8 BOM and multiline quoted fields are supported. Import validates the entire file and changes nothing if any row fails. A valid import replaces that game's current catalog. Saved match club names, codes, icons and stars remain unchanged. Broken icons are hidden. Club selections use gender/league/name identities, so men's and women's clubs with identical names remain distinct.

Record a match through Men/Women → League → Club for each player. Goals include extra time. The a.e.t. flag is independent of the penalty flag. Shoot-outs require level goals and unequal penalty scores. Summary example:

`Mustafa [icon] EC 2(5)–(4)2 EU [icon] Arav · a.e.t.`

Both participants may use the same club. Previously selected clubs remain editable even if removed from the current catalog.

## Competitions

Create a league/tournament from the game's Leagues & tournaments tab, open it, then use Build the competition:

- League: single or double round robin.
- Knockout: single-match elimination with standard seed placement, byes, round display and automatic approved-winner advancement.
- Groups → knockout: seeded snake distribution into groups; single/double round robin, configurable qualifiers per group, then a knockout draw.
- Seeding: manual numbered seeds, current published Elo, or random. Preview before creating. Seeds and Elo at creation are stored and do not change when ratings change. Unrated players seed at 1000; equal Elo preserves input order.
- Points: configurable win/draw/loss values (0–10). Optionally count the shoot-out winner as a standings winner. Otherwise shoot-outs count as standings draws.
- Standings tiebreakers: points, goal difference, goals scored, then original seed order (player ID for legacy competitions without seeds).
- Elo inclusion: enable/disable for the entire competition at draw creation. Game admins may override individual matches when opening/editing them.

Use Enter result on the appropriate fixture. Group/knockout competitions require results attached to fixtures. Only approved results affect standings and advancement. Once every group fixture is approved, an admin starts the knockout stage; qualifiers are ordered by group finishing position then group number and placed into the seeded bracket.

A tied knockout needs a shoot-out winner before approval. Changing/deleting an earlier winner is blocked if it would alter a later fixture with a submitted result. Remove that later result first; unused downstream fixtures are rebuilt automatically. Group results cannot be edited/deleted after the knockout stage starts. Generated group/knockout fixtures cannot be deleted individually. Draws cannot be regenerated once fixtures/results exist; create a new competition instead.

This version supports single-match knockout ties. Two-leg aggregate knockout ties, double elimination, custom bracket placement, customizable tiebreaker order and editing/resetting a live draw are not implemented. Group qualification does not include third-place cross-group qualification or special rematch-avoidance rules.

## Match records, competition outcomes and Elo

These share an approved match record but have independent rules:

1. Logged-in users submit matches. Pending records are visible with timestamps.
2. Submitter, either player or a game admin can edit pending results. Only the submitter/admin may delete a pending result.
3. A game admin approves/locks the result. Competition tables and the knockout bracket update immediately. Admin corrections after approval are audited.
4. Published Elo does not change until a game admin chooses Update ratings. That action rebuilds from eligible approved matches in played-time/ID order, including corrections/deletions to previously rated results.

A penalty winner advances in a knockout; Elo uses a draw. Standings use the competition's shoot-out rule. Public player records and head-to-head counts use the actual shoot-out winner. The rankings W/D/L columns describe Elo results, so penalties appear as draws there.

Changing a catalog does not rewrite historical Elo inputs. Editing/deleting a rated result leaves the published ratings unchanged until the next explicit update. A dirty indicator enables Update ratings even if only corrections or deletions await publication. Elo-excluded matches retain their competition outcomes.

EA FC Elo starts at 1000, K=32, goal-difference multiplier: 1 for 0–1 goals, 1.5 for 2 goals, (11+GD)/8 above that. Team stars shift expected strength by 50 Elo points per star. Draws can still transfer Elo when adjusted strengths differ. Constants are in `matches_core.inc`.

## Future games

`static/kinds.js` provides game-specific fields, wiring, reading and summaries. Catalog CSV parsing is isolated in `catalog_core.inc`; competition logic is in `competition_core.inc`. EA FC's club schema is intentionally specific to EA FC. Smash will need separate character/stage catalogs and matchup factors rather than forcing them into club fields; tennis/table tennis can keep sport-specific score forms. Match support for those three games is still pending.

## Verification

After compiling:

```sh
python3 tests/integration.py ./mimelo
python3 tests/migration.py ./mimelo
```

The Python standard-library integration suite starts an isolated temporary server/database and tests catalog validation, half-stars, shoot-outs, byes, group qualification, Elo publication, snapshots, profile deltas and correction rollback. It does not modify your live database. `migration.py` separately checks an upgrade from the old schema and retention of historical club strengths.

Optional DOM interaction checks require Node 20+:

```sh
npm ci
MIMELO_DOM_TEST=1 python3 tests/integration.py ./mimelo
```

These exercise the team cascade, penalties/extra-time fields, compact summaries, draw preview/creation and settings CSV. A full Chromium visual/layout check was blocked in the development environment; verify appearance in your browser after launching.

## Data and hosting

Back up `mimelo.db`, `media/` and `fonts/`. This is a native C++ server requiring persistent disk; static hosting alone cannot run its API. The archive does not contain runtime data. Choose compatible hosting separately when ready.
