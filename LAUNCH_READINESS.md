# mimELo release handoff

This is the C++/SQLite application, ready to open as a folder in Cursor or another editor. The OpenDesign Cloud project's `mockup/` directory is a separate reference; it is not the server-backed application. Run the server and open its HTTP URL rather than opening `static/game.html` as a file.

## Completed application scope

- Five independent game books: EA FC 26, EA FC 27, Tennis, Table Tennis and Smash Ultimate.
- Persistent match submission, correction, approval, player history and explicit Elo publication. Tennis and Smash have separate individual singles/doubles ratings and fixed-pair doubles competitions. Table Tennis is singles-only.
- EA FC team selection and red-card counts saved with each match; red cards do not affect Elo.
- Configurable groups/advancement, optional league playoffs, manual/pre-seeded/Elo/random seeding, single/double elimination, byes and conditional grand-final resets across all five games.
- New draws qualify players automatically after all preliminary fixtures are approved. Tied qualifying places pause for an admin; recorded downstream results protect earlier winners against conflicting corrections.
- Existing EA FC/Table Tennis competitions retain their previous qualification behavior. Create new draws to use the expanded options.
- The server-backed game shell follows the Open Design reference structure: a game switcher, grouped navigation, live season overview, and competition detail tabs for standings, fixtures, bracket and rules. Counts, match activity, standings, and review items come from the application API rather than mockup samples.
- Game, player, and competition layouts are responsive. Game-specific typefaces remain in place, with the reference typography used in shared areas.

## Application source map

| File | Responsibility |
| --- | --- |
| `static/game.html` | Shared app shell, game switcher, grouped game navigation, and live view container |
| `static/game.js` | Game API, permissions, match actions, standings, results, and competition state |
| `static/game-ui.js` | Reference-aligned overview, search, pagination, accessible navigation, and player directory |
| `static/competitions.js` | Draw setup, seeding, qualification, bracket rendering, and competition actions |
| `static/player.js` | Player profiles, Elo history, format selection, and match history |
| `static/app.css` | Responsive app, profile, and competition layouts based on the mockup hierarchy |
| `static/assets/fonts/` | Bundled app and game typefaces |

Smash fighter stock icons and stage images remain optional artwork inputs; current controls identify fighters and stages by names/numbers. Map supplied local artwork in `static/kinds.js`. This does not prevent score recording or competition progression.

## Verification of this source

Reverified on 2026-11-15. The API and domain suites below passed on the release source. After the UI alignment changes, all four Chromium suites passed at desktop/mobile widths, including overflow, page-error, and failed-request checks. The JavaScript files changed in the UI pass passed `node --check`. Runtime hashes mentioned in the original release verification refer to the release staging step before these UI changes.

A fresh optimized executable was built at `/tmp/mimelo-resume-check` using:

```sh
g++ -std=c++17 -O2 main.cpp -o /tmp/mimelo-resume-check -lsqlite3 -lssl -lcrypto -lpthread
```

Passed against isolated temporary databases:

- `MIMELO_DOM_TEST=1 python3 tests/competition_formats.py /tmp/mimelo-resume-check`: shared API/DOM regressions, both EA FC games and Table Tennis double-elimination completion, byes/resets, groups, playoffs, ties, correction guards, 65-player preview and restart persistence.
- `python3 tests/tennis.py /tmp/mimelo-resume-check`: singles/doubles lifecycle, ratings, competitions and restart persistence.
- `python3 tests/smash.py /tmp/mimelo-resume-check`: stock scoring, fighters/stages, singles/doubles lifecycle, ratings, competitions and restart persistence.
- `python3 tests/red_cards.py /tmp/mimelo-resume-check`: both EA FC games, corrections/history, legacy omissions and Elo isolation.
- `python3 tests/migration.py /tmp/mimelo-resume-check`: original-schema upgrade without loss of historical records/ratings.
- Syntax checks for static JavaScript and inline HTML scripts.

All three Chromium suites passed using `/home/drrev/my-playwright-tests/node_modules/playwright`:

- `tests/competition_formats_browser.cjs`: EA FC 26/27 and Table Tennis double-elimination/group/playoff creation, pre-seeded entrants, approved qualification, tied-qualifier resolution and fixed-fixture entry at desktop/mobile widths.
- `tests/tennis_browser.cjs`: singles/doubles best-of 1/3/5, tiebreaks, correction/resubmission, approval, ratings/reload, partner profiles, paired fixtures and dark/light layouts.
- `tests/smash_redcards_browser.cjs`: both EA FC red-card workflows and Smash singles/doubles scoring, character/stage pickers, approval, ratings, profiles and paired double-elimination fixtures at desktop/mobile widths.
- `tests/record_book_browser.cjs`: live overview metrics, match search/pagination and back navigation, profile charts/history, keyboard navigation, all five games, utility pages, and guest permissions.

Each suite exited successfully with its page-error/request-failure and overflow assertions passing. The checked app is ready for a local trial and Cursor handoff; public deployment remains pending. These checks are functional regressions, not a load test or a guarantee about an unconfigured production host.

## Local use and deployment boundary

To run this checked build locally:

```sh
cd /home/drrev/mimelo
/tmp/mimelo-resume-check 8080
```

Open `http://localhost:8080`. That command uses the real database in the working directory; stop any existing server and back up the database, `media/` and `fonts/` before upgrading. The temporary executable may be removed by the OS; rebuild using README instructions for continued use.

A public launch has not happened. Hosting/domain selection is still unanswered. This native server needs persistent storage and a running C++ process; an HTML-only upload cannot serve its API. At the chosen host, configure HTTPS and forwarding of `X-Forwarded-Proto`, persistent database/media storage, process startup/restart, and a backup/restore procedure, then verify sign-in and a match approval on that actual deployment. HTTPS is relevant to the existing session cookie's Secure attribute. First-run admin credentials are configured only when creating a new database; changing environment values does not replace an existing account's password.

## Cursor and GitHub

Open the whole app folder in Cursor. The release includes the application source, bundled UI assets, verification suites and these handoff documents. Tests use isolated databases and do not replace the local executable. Public deployment is a separate step after choosing hosting.

The release removes `mimelo.db`, the compiled executable, and uploaded files in `media/` and `fonts/` from Git tracking. Local runtime files are preserved, with a private backup made before preparing the release. `.gitignore` excludes these paths from future commits; bundled design assets remain in `static/assets/`.

Existing installations must back up runtime files outside their checkout before pulling this release, because Git can remove formerly tracked files during an update. Restore those files before restarting. Historical commits still contain their original runtime files; this release does not rewrite repository history.
