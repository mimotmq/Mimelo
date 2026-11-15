# Smash and EA FC red-card handoff

Open the entire `/home/drrev/mimelo` repository in Cursor. This is the real C++/SQLite app; the separate Open Design mockup is a visual reference. Build/run instructions are in `README.md`. Do not open `static/game.html` directly: it needs the app's API. Use `/game.html?g=smash-ultimate`, `/game.html?g=ea-fc-26`, or `/game.html?g=ea-fc-27` on the running server.

## Implemented

- Persistent Smash singles and doubles, best-of 1/3/5, with 3 or 6 stocks taken per side per game. Doubles 6–5 is valid. No JV control or stored JV value.
- One fighter per participant and one stage per game; combined Pokémon Trainer and Pyra/Mythra entries, separate Echo entries shown with ε.
- Pending review, return for correction, resubmission, approval, audited edits/deletion, and explicit Elo publication.
- Separate individual singles/doubles ratings, participant histories, partner permissions, match filters, profiles and stock scorecards.
- Singles/fixed-pair doubles competition creation, manual/pre-seeded/Elo/random seeding, groups and qualifiers, league playoffs, single/double elimination, byes and conditional grand-final reset.
- Approved-result qualification and bracket advancement, with admin resolution of qualification ties and protection against conflicting upstream corrections.
- EA FC 26 and 27 red-card counts for each team, saved in match details and shown alongside the corresponding team in summaries, histories and competition results. Counts do not affect Elo or standings.
- Red-card validation accepts integers 0–11. New forms default to zero; historical omitted values stay unknown. API clients can omit counts on edits without erasing them.

## Main files

- `matches_core.inc`: score validation, match details and separate rating calculations.
- `routes_matches.inc`: match lifecycle, correction, histories, rating publication and fixture links.
- `competition_core.inc`, `routes_competitions.inc`: paired competitions, qualifiers and elimination progression.
- `static/kinds.js`: per-game forms, fighter/stage pickers and shared scorecards.
- `static/game.html`: match recording, review, rankings and competition entry points.
- `static/competitions.js`: draw controls and bracket display.
- `static/player.html`: format-specific player records and history.
- `static/base.css`: responsive forms, scorecards, icon slots and red-card labels.

The obsolete disconnected preview and duplicate roster declarations were removed from the game page. A single picker dialog now belongs to the live Smash form. Scheduled fixture partner controls remain locked while scores and character/stage choices remain editable.

## Assets still to supply

The existing game logos and fonts are retained. Character stock icons and stage artwork are not supplied. Set the local file paths in `SMASH_FIGHTER_ICONS` and `SMASH_STAGE_IMAGES` in `static/kinds.js` when available. The same fighter icon helper serves the picker, histories and bracket scorecards. Until then, fighter numbers and names identify the selections; stages use names. The current stage list is provisional.

## Reproducible verification

Build a fresh executable outside the tracked runtime binary, then run:

```sh
g++ -std=c++17 -O1 main.cpp -o /tmp/mimelo-check -lsqlite3 -lssl -lcrypto -lpthread
python3 tests/smash.py /tmp/mimelo-check
python3 tests/red_cards.py /tmp/mimelo-check
python3 tests/tennis.py /tmp/mimelo-check
python3 tests/migration.py /tmp/mimelo-check
MIMELO_PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/smash_redcards_browser.cjs /tmp/mimelo-check
MIMELO_PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/tennis_browser.cjs /tmp/mimelo-check
```

Each suite uses an isolated temporary database. The API suites passed against a fresh build, covering EA FC/Table Tennis regressions, Smash validation and rating isolation, doubles partner records, corrections, double-elimination draws with 2–8 entrants, resets, groups, league playoffs and server restart. Tennis's broader suite passed including 2–16 entrant draws and migration from the original schema. Both Chromium suites passed after the fixture-lock correction: EA FC 26/27 red-card submission/correction/approval/reload; Smash singles/doubles best-of 1/3/5, grouped and Echo fighters, Town and City, return/resubmit, approval, published ratings, partner profile, fixed-pair double-elimination creation and fixture recording. Desktop/mobile, light/dark, no page errors and no horizontal page overflow were checked. Tennis recording, tiebreaks, corrections, profiles, paired fixtures and other-game smoke tests also passed. A mobile Smash screenshot was visually reviewed.

## Remaining project work

EA FC and Table Tennis now share the expanded double-elimination/league-playoff engine. See `LAUNCH_READINESS.md` for current verification and deployment readiness; this document describes the earlier Smash milestone.

This document records the Smash milestone. The consolidated release excludes runtime data and the compiled executable from version control while preserving local copies. See `LAUNCH_READINESS.md` for current release verification and the remaining hosting work.
