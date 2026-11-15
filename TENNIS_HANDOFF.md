# Tennis implementation handoff

## Open in Cursor

Open the whole `/home/drrev/mimelo` directory. This is a C++/SQLite application, not a standalone HTML export. Build and run using README.md, then visit `/game.html?g=tennis` on that server. Existing installations migrate additively on startup; back up the database and uploaded assets before upgrading.

## Completed Tennis flows

- Persistent singles and four-player doubles entry, best-of 1/3/5, set games and both tiebreak scores.
- Default hardcourt, optional clay/grass, per-set scorecards, and a live Elo estimate.
- Pending review, return for correction with a reason, resubmission, audited approval/corrections/deletion.
- Separate individual singles/doubles Elo, explicit publication, and partner-aware permissions, directories, histories and signed deltas.
- Optional nationality flag and rank-tier profile labels via existing editable flairs. No automatic tier thresholds are assumed.
- Singles/fixed-pair doubles competitions: round robin, league playoffs, groups with configurable qualifiers, single/double elimination, byes and conditional reset.
- Manual ordering, pre-seeded numbers, published Elo and random seeding, stored with the draw.
- Automatic qualification from approved results, admin resolution of cutoff ties, and downstream-result protection.
- Responsive Gotham/green-purple Tennis interface; surface stays in match details.

## Source map

| File | Responsibility |
| --- | --- |
| `matches_core.inc` | Tennis validation, partner storage/migration, rating rebuilds, profiles and identity fields |
| `routes_matches.inc` | Entry/edit/review, rating preview/publication, partner-aware match lists and fixtures |
| `competition_core.inc` | Paired entrants, qualification, winners/losers graph, byes, reset and correction protection |
| `routes_competitions.inc` | Draw validation, paired seeds, playoff/group options and tie resolution |
| `static/kinds.js` | Tennis input, set scorecards and live estimate |
| `static/game.html` | Matches, review, Singles/Doubles rankings, recording and navigation |
| `static/competitions.js` | Creation controls, seed ordering, qualifiers and bracket display |
| `static/player.html`, `static/account.html` | Individual format records, histories and editable identity labels |
| `static/base.css` | Tennis score-entry and scorecard layout, responsive and dark styles |
| `tests/tennis.py` | Shared integration plus Tennis lifecycle/competition/restart checks |
| `tests/tennis_browser.cjs` | Real Chromium end-to-end workflows on a temporary database |

## Rules retained

Standard six-game sets and seven-point, win-by-two tiebreaks apply in both formats. A best-of-1 match is one set; best-of-3 needs two won sets; best-of-5 needs three. Sets after the deciding set and incomplete results are rejected. No retirements, walkovers, advantage final sets or deciding match-tiebreak variants were requested or added.

Elo publication is deliberately separate from approval. Estimates use current published ratings; actual deltas can differ when earlier results are published in chronological order. A doubles match transfers the same delta per partner, using the team's mean doubles rating. Partners are not permanent teams outside a competition.

Competition ties use points, set difference and sets won. An admin resolves qualification ties without changing the recorded scores. Qualifier records freeze once the knockout draw starts. Removing a downstream result is required before a correction can change its upstream participant.

## Verification

Build a fresh executable, then run:

```sh
MIMELO_DOM_TEST=1 python3 tests/tennis.py /path/to/fresh/mimelo
python3 tests/migration.py /path/to/fresh/mimelo
MIMELO_PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/tennis_browser.cjs /path/to/fresh/mimelo
```

The API suite covers score edges, permissions, rejected-result resubmission, rating isolation, partner-only histories, corrections/deletion, byes, bracket reset, fixed pairs, league playoffs, group qualification, ties and restart persistence. Double elimination covers 2, 3, 4, 5, 6, 7, 8, 9 and 16 entrants, both with and without a reset. Existing EA FC and Table Tennis regressions and the original-schema migration are included. Browser checks cover desktop/mobile, light/dark, all three match lengths, real submission/approval/publication/reload, paired competition creation and fixture entry.

## Broader project boundary

This records the Tennis milestone. Smash persistence is implemented; see `SMASH_HANDOFF.md`. The playoff/double-elimination engine now also supports EA FC and Table Tennis. See `LAUNCH_READINESS.md` for the consolidated release scope, verification and deployment boundary.
