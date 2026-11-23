# Backend contract — fresh implementation

Implementation contract derived from REQUIREMENTS.md and the supplied templates. Automated verification lives in tests/; operating choices are documented in README.md and REBUILD.md.

## Match authority and independent states

Keep match result acceptance separate from rating authorization. Do not use one approved boolean for both.

Result states: submitted, accepted, voided. Record forfeit separately as a terminal outcome with no rating eligibility.

Rating states: disabled, awaiting_result, awaiting_admin, blocked_missing_team_rating, checked_off. Calculated rating entries are derived from checked-off match revisions, not editable source data.

Each result has a revision number. Participant confirmations, acceptance, and Elo checkoff reference a particular revision so stale browser requests cannot approve a subsequently edited score.

### Submit and confirm

- Participants or relevant admins submit results.
- Submission stores an immutable server timestamp as the default chronology when an optional played timestamp is absent and records submitter confirmation for their side, when applicable.
- Either side may confirm the current revision. One player represents a doubles side.
- A relevant admin or the competition organizer can accept the current revision directly. Otherwise acceptance requires one confirmation from each side.
- Result acceptance updates standings and eligible competition progression transactionally. It does not authorize Elo.
- Organizer status confers competition result-acceptance authority, not game-admin or account-admin privileges. It does not independently confer result-submission or finalized-result-correction rights.

### Elo checkoff

- Relevant admins alone can check off accepted results for Elo.
- Checkoff requires enabled Elo and all necessary team-overall inputs. Missing inputs are visible in the admin review queue; they do not block result acceptance.
- A checkoff, permitted correction, void, or Elo exclusion invalidates affected derived rating entries and replays eligible results in played-date order, falling back to submission time. Use a stable match identifier to break timestamp ties.
- Preserve separate result-acceptance and rating-checkoff actors/timestamps. Approval order never replaces played/entry chronology.
- Replay each game and singles/doubles rating pool independently. Each doubles result updates all four participant ratings atomically.
- An admin Recalculate Elo action must be idempotent and must not check off unreviewed results implicitly.

### Corrections and dependency locks

- Pending results are editable by participants and relevant admins. Edits create a new revision and invalidate confirmations of the previous score.
- Accepted results may be corrected or voided only by relevant admins.
- No actor may rewrite/void an upstream result once a submitted downstream game depends on its outcome. Enforce this in the server transaction, not just by disabling a button.
- A permitted accepted-result correction invalidates its prior rating checkoff; admin acceptance/checkoff of the corrected revision must be explicit. Rebuild affected standings and checked-off rating history consistently.
- Downstream fixture creation alone does not create the submission lock.
- Forfeits can be declared by organizer or relevant admin and progress immediately without a separate admin acceptance. They never enter the Elo ledger.
- Whole-competition deletion is a separate admin action: site admins and admins for that game may permanently remove any competition, including completed draws and locked results, after confirming its exact name. Remove its entrants, fixtures/dependencies, qualifications, results, revisions, confirmations, ledger entries and related notifications, then replay affected rating pools in the same transaction. Preserve player accounts, unrelated records and audit history. Organizers may still delete their own competitions before the draw.

## Core records

- Player identity: stable ID, display name, optional linked account, profile/flairs. Fill-ins are first-class identities shared across games.
- Account: stable ID, unique handle, optional email, password hash, sessions, account-change requests. Accounts and player identities are distinct so claiming a fill-in preserves references.
- Roles: site-admin and game-scoped admin assignments. Competition organizer is a separate relationship.
- Games: five code-defined books; scoring families for EA FC, tennis, table tennis, and Smash. EA FC 26 and 27 share scoring code but not catalogs, rating pools, or records.
- Team catalogs: game-scoped team IDs, names and numeric overall values, with atomic import validation, admin audit events, and rated-match strength snapshots.
- Competitions: game, organizer, singles/doubles format, immutable-start rule snapshot, enrollment mode/deadline, lifecycle, ordered standings tiebreak rules.
- Entrants: individual player or fixed doubles pair, registration status, seed and withdrawal state.
- Fixtures: stage/round, scheduled time, side references and explicit dependency edges for qualification/bracket progression.
- Matches: fixture optional, participants, scores, game-specific detail, immutable submission timestamp, optional played timestamp and whole-minute duration, revision and independent approval metadata.
- Match revisions and confirmations: retain history through ordinary result changes; remove them with an explicit whole-competition deletion. Audit events remain append-only records of meaningful changes and actors.
- Rating ledger: game and format pool, player, match revision, input rating, delta, output rating, formula/rules version and team-overall snapshots.
- In-app notifications: recipient, event, relevant game/match/competition, read state. No outgoing email in the first release.
- Claim/reset tokens and merge requests: single-use token records, expiry/revocation, issuer, target identity/account; merge conflicts reviewed before references are reassigned.

There is no season entity, runtime theme configuration, or user-created game/scoring-engine entity.

## Template integration contract

- Serve supplied HTML source unchanged and test its bytes against the saved reference hashes.
- Implement real data and behavior through the template's JavaScript entry points. Never load legacy frontend styles, renderers, theme endpoints, or sample records as live data.
- Hydrate live identities, statistics, statuses, permissions and empty/loading/error states.
- Apply explicit runtime removals requested by the user: season controls/wording, theme editor, Add game section and tennis tier.
- Display result acceptance and Elo review as distinct states so an advanced fixture is not falsely presented as rated.
- Use the template components for new required controls, including participant confirmations, Elo checkoff, per-game scoring inputs and catalog editing.
- Page public history/catalog queries. Do not fetch the entire growing database into every page.

## Required acceptance scenarios

1. One representative per doubles side accepts a result; standings/bracket update while all Elo values remain unchanged.
2. Organizer acceptance works without granting Elo checkoff authority. Admin checkoff subsequently updates ratings once.
3. A score edit invalidates older confirmations and checkoffs; stale requests fail without applying changes.
4. Late Elo checkoff replays by played timestamp (submission time if omitted) and produces the same ledger as a clean chronological rebuild.
5. A missing EA FC overall allows accepted results/progression, blocks rating checkoff, and alerts admins. Supplying the value allows explicit checkoff and correct replay.
6. A downstream submission races an upstream correction: the transaction permits only a consistent outcome and never rewrites a depended-on result.
7. Organizer-declared forfeit advances the competition without changing Elo.
8. Singles/doubles and FC 26/27 records remain independent under submissions, checkoffs, corrections and rebuilds.
9. Original HTML hashes match. All supplied screens are inspected at desktop/mobile sizes, with only documented user-requested runtime changes.
10. Empty initial database contains no template demonstration players/results and no imported data from the previous application.

## Profiles and historical context

Profiles are global, showing only games with nonvoided activity. Nationalities are optional, limited to two distinct catalogue countries; unchanged legacy labels remain valid. Shared player photos use the existing image validation and relevant-admin authorization. Public peaks exclude provisional matches and start after rated match eight. Match context uses strictly earlier accepted results in the same game/format, exact doubles pairs, historical standings, and pre-match ledger values. Elo odds use two outcomes except football win/draw/win, learned from prior same-edition accepted results with a ten-match 20% draw prior. UI odds use American signed stake/profit notation.

## Competition projections and extra qualifiers

- `GET /api/competitions/:id/projection` is public and read-only. Deterministic simulations retain accepted outcomes and fixture dependencies; state hashes invalidate the bounded cache. Current Elo is averaged for doubles; football uses the edition's accepted-result draw prior.
- Percentages are estimates. Confirmed qualification/elimination labels require mathematical bounds, exact accepted outcomes, or explicit qualification decisions; sample counts never certify a status. Remaining uncertainty is displayed as contention.
- Groups may add `extraCount` qualifiers from `extraPlace`, below `advance`. The position must exist in every group. `extraTieBreaks` has an independent validated order without head-to-head. Compare raw points, including unequal groups.
- Candidate-place ties and cross-group cutoff ties require audited admin resolution and block progression. Stored keys distinguish candidate decisions (`@place:<group>`) and cross-group decisions (`@extra`) from ordinary group qualifications.
- Knockout generation includes every selected entry exactly once and protects against first-round group rematches. Derived forecast, qualification, and table state is rebuilt after corrections.
