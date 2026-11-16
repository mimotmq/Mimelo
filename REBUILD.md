# Template-source rebuild

The earlier main branch applied visual changes to the previous application. This rebuild replaces that application: it removes the C++ backend, old frontend renderers/styles, old tests, and previous installation instructions. It neither loads nor migrates the old database or runtime theme configuration.

## Source fidelity

The source is OpenDesign Cloud project `e98cc95f-f9c8-4e37-b70b-c8fab25662b9/mockup`. All 46 supplied files are preserved under `design-reference/`; `SOURCE.json` records their SHA-256 hashes. Eight live HTML pages and all supplied CSS/assets—31 files altogether—remain byte-identical to that reference. `npm run verify:templates` enforces this independently of screenshots.

The template JavaScript's mock records, local-storage persistence, fake logins, and demo handlers have been replaced. Runtime additions use the supplied component classes, typefaces, colors, and layouts. Small runtime layout rules contain new administrative controls and score inputs on mobile. The login retains the supplied split visual/form layout.

## Screen integration

| Template         | Live implementation                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Home             | Five game links, public player count, latest accepted result, empty state                                                              |
| Login            | Handle/email login, optional-email signup, fill-in claim/merge, private reset link                                                     |
| Account          | Profile/photo/flairs, handle request, password/session controls, in-app preferences                                                    |
| Player directory | Search, pagination, real profiles and independent game ratings                                                                         |
| Player           | Per-game singles/doubles records, published Elo chart/rank, game scorecards, match history, FC team usage                              |
| Game             | Overview, matches, Elo/competition tables, competitions, players, sport-specific recording and live Elo estimate, result/Elo review    |
| Competition      | Registration, pairing/seeding, rules/schedule management, standings, fixtures/results, single/double bracket, qualification resolution |
| Admin            | Fill-ins, claim/reset links, roles, account requests, per-game weights, team editing/import, Elo rebuild and public-record export      |

Explicitly removed at runtime: sample records, season wording/controls, theme editor, Add game, tennis tiers, and email delivery controls. New approval states, registration deadlines, fixed doubles pairs, updated sport scoring, numeric team overalls, and claim links follow the agreed requirements rather than the mockup's demonstration behavior.

## Backend and operating decisions

- New Node/Fastify server and SQLite schema; five game definitions are the only initial data.
- Result acceptance, Elo checkoff, participant confirmations, and score revisions are separate records/states.
- Submission time is server-assigned and immutable. Eligible ratings replay in submission/ID order. Rated football matches retain their overall snapshots.
- Structural rules freeze at draw generation, an explicit and visible start boundary; schedules remain editable.
- Claim/reset links expire after seven days/one hour. Existing-account merges require site-admin review and preserve audit history.
- Tied qualification supports admin reasons or additional games, including multi-player rounds. League championship ties receive the same handling.
- Email/digests, a domain, and external hosting are deferred as requested. No server-side design editor or game-creation endpoint exists.

See [REQUIREMENTS.md](REQUIREMENTS.md) for the interview record, [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md) for invariants, and [README.md](README.md) for running, administration, testing, and backup commands.
