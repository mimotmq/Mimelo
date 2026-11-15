# mimELo

Shared accounts, roles and themes; EA FC 26, EA FC 27, Tennis and Smash singles/doubles, and Table Tennis match recording, independent competition management and published Elo.

## Build and run

On Debian/Ubuntu:

```sh
sudo apt install -y g++ libsqlite3-dev libssl-dev
cd mimelo
g++ -std=c++17 -O2 main.cpp -o mimelo -lsqlite3 -lssl -lcrypto -lpthread
./mimelo 8080
```

Open http://localhost:8080. SQLite's development package supplies `sqlite3.h` and the linker library. On Windows, use WSL with these instructions.

First run creates the main admin `mimo` and prints its generated password once. To choose a password, set `MIMELO_ADMIN_PASSWORD` before first launch. Change passwords on the Account page. The test suites create isolated accounts and databases; they do not modify an existing installation.

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

Red cards can be entered separately for each team (whole numbers 0–11). New forms start at zero; older records without counts remain unrecorded. Counts are saved in match details, appear beside their team in summaries, and survive corrections and approval. They do not affect Elo or standings. API fields are `red_cards1` and `red_cards2`; omitted values preserve existing counts on edits.

Both participants may use the same club. Previously selected clubs remain editable even if removed from the current catalog.

## Competitions

Create a league/tournament from the game's Leagues & tournaments tab, open it, then use Build the competition:

- League: single or double round robin, with optional playoffs for a configured number of top finishers.
- Knockout: single or double elimination, standard seed placement, automatic byes and approved-result advancement. Double elimination includes a losers bracket and conditional grand-final reset.
- Groups → knockout: seeded snake distribution into groups; single/double round robin, configurable qualifiers per group, then a knockout draw.
- Seeding: manual ordering, pre-seeded numbers, current published Elo, or random. Preview before creating. Seeds and Elo at creation are stored and do not change when ratings change. Unrated players seed at 1000; equal Elo preserves input order.
- Points: configurable win/draw/loss values (0–10). Optionally count the shoot-out winner as a standings winner. Otherwise shoot-outs count as standings draws.
- Standings tiebreakers: points, score difference, then scores won (goals, sets or games for the selected game). New draws pause for an admin decision if qualification places remain tied. Older EA FC/Table Tennis competitions retain seed-order qualification.
- Elo inclusion: enable/disable for the entire competition at draw creation. Game admins may override individual matches when opening/editing them.

Use Enter result on the appropriate fixture. Generated competitions require results attached to their fixtures. Only approved results affect standings and advancement. New draws automatically qualify entrants when all league/group results are approved, unless a qualifying place is tied. An admin resolves any tied cutoff before the bracket is generated. Older EA FC/Table Tennis group draws retain their manual Start knockout stage action. Group qualifiers are ordered by finishing position then group number.

A tied knockout needs a shoot-out winner before approval. Changing/deleting an earlier winner is blocked if it would alter a later fixture with a submitted result. Remove that later result first; unused downstream fixtures are rebuilt automatically. Qualifying league/group results cannot be edited/deleted after the knockout stage starts. Generated fixtures cannot be deleted individually. Draws cannot be regenerated once fixtures/results exist; create a new competition instead.

All five games support single-match knockout ties with single or double elimination. Two-leg aggregate knockout ties, custom bracket placement, customizable tiebreaker order and editing/resetting a live draw are not implemented. Group qualification does not include third-place cross-group qualification or special rematch-avoidance rules.

## Match records, competition outcomes and Elo

These share an approved match record but have independent rules:

1. Logged-in users submit matches. Pending records are visible with timestamps.
2. Submitter, either player or a game admin can edit pending results. Only the submitter/admin may delete a pending result.
3. A game admin approves/locks the result. Competition tables and the knockout bracket update immediately. Admin corrections after approval are audited.
4. Published Elo does not change until a game admin chooses Update ratings. That action rebuilds from eligible approved matches in played-time/ID order, including corrections/deletions to previously rated results.

A penalty winner advances in a knockout; Elo uses a draw. Standings use the competition's shoot-out rule. Public player records and head-to-head counts use the actual shoot-out winner. The rankings W/D/L columns describe Elo results, so penalties appear as draws there.

Changing a catalog does not rewrite historical Elo inputs. Editing/deleting a rated result leaves the published ratings unchanged until the next explicit update. A dirty indicator enables Update ratings even if only corrections or deletions await publication. Elo-excluded matches retain their competition outcomes.

EA FC Elo starts at 1000, K=32, goal-difference multiplier: 1 for 0–1 goals, 1.5 for 2 goals, (11+GD)/8 above that. Team stars shift expected strength by 50 Elo points per star. Draws can still transfer Elo when adjusted strengths differ. Constants are in `matches_core.inc`.

## Table Tennis

Table Tennis has a separate singles record book. Record a best-of-1, best-of-3, or best-of-5 match with the points for each game played. Games must reach 11 points and be won by two; after 10–10 they end as soon as one player leads by two. Results follow the existing pending → admin approval → rating publication workflow. Approved fixture results advance single- or double-elimination draws and determine group/league playoff qualification.

Table Tennis ratings start at 1000, use K=24 and scale the Elo change by both game and point margin, matching the mockup's margin formula. Elo remains unchanged until an admin publishes the update. Table Tennis supports single/double elimination, groups with configurable qualifiers, and league playoffs; doubles remains outside the implemented singles scope.

## Tennis

Tennis has persistent singles and doubles results, separate published ratings, player histories, and singles or fixed-pair competitions. Open `/game.html?g=tennis` on the running server.

- Choose singles or doubles and best-of-1, 3, or 5 sets. Enter games per set, plus both tiebreak scores for a 7–6 set. Sets are standard six-game sets; tiebreaks reach seven, win by two. Unplayed sets stay blank. No point-by-point logging is required.
- Doubles requires four distinct players. Partners are chosen per friendly; competition pairs remain fixed for the draw. All four participants see their histories and may edit a pending result. Partner records also count toward game membership and account flairs.
- Hardcourt is the default surface; clay and grass are available. Surface appears in match details, not rankings or scorecard summaries.
- Elo is enabled by default, subject to the competition setting and admin overrides. An estimated change appears for a complete entry. Approval updates competition results; **Review → Update ratings** publishes the actual Elo changes. Corrections and deletions do not change the published snapshot until that update.
- Singles and doubles each start at 1000. K=24 with set, game and tiebreak margins. Doubles compares the teams' average doubles ratings and applies the same signed delta to each partner. Singles never changes from a doubles result.
- Rankings have Singles/Doubles controls. Profiles show both ratings and both records, with per-set scorecards and each participant's signed rating change. Nationality and rank-tier labels use editable Tennis flairs on My account; two-letter nationality codes display as flags. Tier labels are descriptive, not an invented automatic Elo threshold system.
- Admins can return pending Tennis results for correction with a reason. Editing and saving resubmits them for review, preserving an audit trail. Only approved results affect standings or ratings.

Tennis's expanded competition builder supports round-robin leagues, optional league playoffs, groups → knockout, single/double elimination, any number of available entrants (minimum two), balanced groups with at least two entrants each, and selectable qualifiers per group. Seed by manual ordering, pre-seeded numbers, or published Elo (pair-average doubles Elo); random remains available. Previewed settings are invalidated when edited. Singles and doubles use the same draw mechanics.

Approved Tennis results automatically qualify entrants after every league/group fixture is complete. Points, set difference, then sets won determine qualification. A tie at the last qualifying place pauses for an admin selection among the tied entrants. Earned qualifiers feed the knockout draw. Double elimination has losers rounds and a conditional grand-final reset. Byes advance automatically. Qualifying results freeze after a knockout draw starts; changing an earlier knockout winner is blocked if a downstream result already exists. Playoff results never change league standings. Use each generated fixture's **Enter result** control so its participants and partners stay fixed.

Expanded playoff and double-elimination controls are connected for all five games. Older EA FC/Table Tennis draws retain their existing qualification behavior. See [TENNIS_HANDOFF.md](TENNIS_HANDOFF.md) for validation commands and the broader-project boundary.

## Future games

`static/kinds.js` provides game-specific fields, wiring, reading and summaries. Catalog CSV parsing is isolated in `catalog_core.inc`; competition logic is in `competition_core.inc`. EA FC's club schema is intentionally specific to EA FC. Smash uses its own fighter/stage catalogs and stock-score validation. Additional games should supply their own rules without using EA FC's club fields.

## Super Smash Bros. Ultimate

Open `/game.html?g=smash-ultimate`. Singles and doubles use best-of-1/3/5 games with stocks **taken** by each side: 3 in singles, 6 combined in doubles. A doubles score of 6–5 leaves the winners with one combined stock. There is no JV field. A game needs exactly one side at the stock limit; incomplete matches and games after the series is decided are rejected.

Choose one fighter per participant and one stage for each game. Pokémon Trainer (33–35) and Pyra/Mythra (79–80) remain combined selections; Echo Fighter numbers display ε. Stored fighter IDs/names and stage codes appear in match records, profiles and brackets. The current stage list is provisional. Add supplied local assets through `SMASH_FIGHTER_ICONS` and `SMASH_STAGE_IMAGES` in `static/kinds.js`; stock icons are shared across the picker and all scorecards. No character or stage artwork has been supplied yet.

Matches follow pending → approval → explicit Elo publication, including return for correction and resubmission. Singles and individual doubles ratings are separate, starting at 1000. Doubles uses team-average Elo with the same delta applied to both partners. K=24, scaled by game and stock margins; red cards are unrelated to this calculation.

Singles/fixed-pair doubles competitions support leagues, optional playoffs, groups with configurable qualifiers, single/double elimination, byes and a conditional final reset. Approved fixture results trigger progression. Ties at qualification boundaries pause for admin selection; downstream recorded results prevent conflicting upstream corrections.

Additional isolated tests:

```sh
python3 tests/smash.py ./mimelo
python3 tests/red_cards.py ./mimelo
MIMELO_PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/smash_redcards_browser.cjs ./mimelo
```

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

These exercise the team cascade, penalties/extra-time fields, compact summaries, draw preview/creation and settings CSV. Tennis additionally has a real Chromium workflow suite covering recording, correction, approval, ratings, profiles, fixed-pair tournaments, reloads, mobile layout and light/dark themes (see below).

Tennis's extended API/lifecycle suite includes the shared regression suite, double-elimination sizes 2–16, qualification ties and server restarts:

```sh
MIMELO_DOM_TEST=1 python3 tests/tennis.py ./mimelo
```

For browser checks, use an installed Playwright module and its Chromium browser:

```sh
node tests/tennis_browser.cjs ./mimelo
# If Playwright is installed in another local project:
MIMELO_PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/playwright node tests/tennis_browser.cjs ./mimelo
```

Both suites create temporary databases and test accounts. They never use the live database. Set `MIMELO_SCREENSHOT_DIR` to an optional temporary directory to capture the mobile record form.

## Data and hosting

Back up `mimelo.db`, `media/` and `fonts/`. This is a native C++ server requiring persistent disk; static hosting alone cannot run its API. The release excludes the local database, compiled executable and uploaded media/fonts from version control; bundled UI assets live under `static/assets/`. Earlier commits still contain historical runtime files. Choose compatible hosting separately when ready.

When upgrading a checkout from an older commit, make a backup outside the checkout before pulling: Git may remove previously tracked runtime files when applying this release. Restore the database and uploaded files from that backup before starting the rebuilt server. A fresh clone creates its own database and runtime directories on first launch.

## Expanded competition verification

```sh
MIMELO_DOM_TEST=1 python3 tests/competition_formats.py /tmp/mimelo-check
MIMELO_PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/competition_formats_browser.cjs /tmp/mimelo-check
```

These isolated suites exercise EA FC 26/27 and Table Tennis byes, single/double elimination, groups, league playoffs, tied qualification, fixture guards, persistence and desktop/mobile creation. See `LAUNCH_READINESS.md` for the release handoff and deployment boundary.
