# Fresh template implementation — requirements interview

Status: interview in progress. This file distinguishes user decisions from implementation interpretations and unresolved questions. The previous application is not a source of requirements or design.

## Source and initial state

- User requires the HTML files to be the same as the OpenDesign Cloud originals. Implementation contract stated in the interview: preserve source HTML byte-for-byte; hydrate real content and connect actions through JavaScript. Preserve template styling, fonts, images, and layouts. Verify source equality automatically.
- Start with an empty database. Do not import existing accounts, players, matches, competitions, ratings, or saved themes. Template sample records are not production seed data.
- One shared group with public browsing. Games have separate competitions, each with its own participant set.
- Frontend and backend requirements come from this interview and the supplied templates, not the previous build.

## Identity and administration

- Registration is open to anyone.
- Accounts have a handle, password, display name, and optional email. Login accepts either handle or supplied email.
- Users can change passwords and display names. Handle changes require site-admin approval.
- Site admins alone issue password-reset links, including for users without email.
- Site admins and per-game admins can create fill-in profiles.
- Fill-ins are shared player identities usable across games. They can participate in competitions, matches, and ratings before registering.
- A private claim link converts a fill-in to an account while retaining its histories.
- Relevant game admins manage their assigned games; site-wide identity actions belong to site admins.
- Both site and game admins can issue/regenerate fill-in claim links. Password resets remain site-admin-only.
- Claiming a fill-in into an already registered account requires admin review; site-admin review was the proposed handling for account-wide merges.

## Notifications, catalogs, and customization

- In-app notifications are required. Email notifications were specified as explicit opt-in, limited to a player's own matches; admins may receive alerts within their admin scope.
- Latest instruction permits scrapping email features for now due to undecided hosting budget. Implementation decision communicated: defer outgoing email for the first release. Retain optional email as an account/login field and admin-provided claim/reset links.
- Weekly digest was accepted as a separate optional subscription before email deferral. In-app digest delivery versus deferring the digest itself remains to be settled.
- EA FC catalogs support both manual editing and CSV/spreadsheet import. Site admins manage both editions; game admins manage their assigned game's catalog.
- User explicitly removed the theme editor. Appearance is changed only through code. Preserve source HTML equality while removing access to the editor at runtime; do not implement persisted theme editing or inherit prior themes.
- Players may edit their own flairs. Tennis tier is unnecessary and must be removed.
- New games require a code change. Remove the runtime Add game section/action while preserving the original HTML source.

## Hosting and capacity

- Domain not selected; user will choose after seeing the finished product.
- Monthly hosting budget undecided. Outgoing email deferred as above.
- Expect fewer than 50 simultaneous users, but the total player/database size may grow large. Do not assume small in-memory catalogs or unpaginated result histories.

## Match lifecycle

- Participants and relevant admins can submit results.
- Either participant and relevant admins can edit pending results.
- Latest approval decisions supersede the earlier admin-only result approval rule. Result acceptance and Elo checkoff are separate.
- A relevant admin, the competition organizer, or approval from both sides can accept a result and update standings/advance brackets. Doubles requires one representative from each side, not all four players. Admins may approve their own matches.
- Communicated default: submission counts as the submitter's approval; a score edit clears previous participant approvals. This is implementation behavior proposed alongside the user-confirmed one-representative quorum.
- Elo always requires a separate relevant-admin checkoff, including results already accepted by an organizer or both sides.
- Only admins can correct or void approved results.
- A downstream submitted result locks the earlier tournament results on which it depends against correction/deletion. Scheduling alone does not trigger the lock.
- Permitted corrections recalculate Elo and standings with accurate chronological ordering.

## Elo decisions

- Every player starts at 1000. Base K is 24; user delegates reasonable implementation details.
- Admin Elo checkoff triggers automatic, immediate Elo recalculation in played-time order (entry time if omitted); result acceptance alone does not affect ratings. Retain the manual admin Recalculate Elo recovery action.
- Matches count for Elo by default unless a participant/admin toggles it off. Changes after approval follow the admin-only correction rule.
- User wording on chronology: "follow when actually played, or rather submitted by the participant/admin, if this causes problems, add back an admin elo update feature."
- Implementation interpretation communicated: server submission time is the default rating order; approval time is stored separately. Include an admin Recalculate Elo recovery action. The November 22 follow-up allows an optional played date/start time; when supplied it determines chronology, with the entry time retained for audit. Optional duration is independent.
- User-selected importance multipliers: friendly 0.8; league 1.0; tournament group 1.0; knockout round 1.1; semifinal 1.1; final 1.2.
- Game admins may configure weights. User delegated implementation details. Save competition rule versions to prevent later configuration edits silently changing historical calculations.
- EA FC team strength uses a user-supplied numeric average team rating (typically around 80–90), not template star ratings. Make room for this editable catalog value. Strong Team XI ratings must affect expected outcomes, including larger penalties for upset losses. Exact scaling is an implementation decision still to be documented.
- Missing required team ratings block Elo checkoff/calculation and produce an admin warning to supply the value. The two-stage approval model permits result acceptance and advancement independently of Elo eligibility.
- Winning margins affect ratings in all games, including football goal difference. Communicated implementation direction: a bounded margin multiplier. Exact formula remains to be documented and tested.
- Tennis and Smash alone support doubles. Each player has separate singles and doubles Elo, with separate ranking lists. Each doubles team's strength is the average of its two players' doubles Elo. Communicated implementation direction: both partners receive the same team-derived adjustment.
- Communicated implementation direction: retain the team-rating values used for each match so later catalog updates do not silently rewrite prior calculations. Missing-rating resolution must still support chronological replay.

## Persistent game records

- There are no seasons, season resets, or season transitions. Each game maintains continuous Elo and records.
- EA FC 26 and EA FC 27 are independent games. Player ability and Elo must not carry across editions. Maintain separate team catalogs and allow game-specific rules.
- Template source HTML remains identical. Adapt season-related display text and incompatible controls through runtime JavaScript to reflect continuous game records. Do not introduce a season model because the mockup contains season terminology.
- EA FC 26 and 27 use the same application scoring and Elo rules. Their team overalls, player ratings, and records remain independent.

## Competition creation and participation

- All five games support round-robin leagues, leagues with playoffs, groups followed by knockout, single elimination, and double elimination. Tables/brackets adapt to each game's scoring while sharing the format concepts.
- Regular players as well as relevant admins can create competitions.
- There is no advance competition verification gate. Result acceptance may be by admin, organizer, or both sides; admin checkoff remains required for Elo.
- Creators can manage entrants, schedules, and settings without renewed admin verification, subject to the structural freeze below.
- Support organizer-selected entrants, open registration, and both together. Open registration requires a deadline.
- Deadline closes registration; it does not automatically generate the draw. Organizer finalizes the draw afterward.
- Doubles supports fixed-pair registration and individual registration with organizer-assigned partners.
- Doubles partners cannot switch once the competition begins.
- User delegated structural changes after play starts. Communicated policy: freeze entrants, pairs, format, scoring rules, and draw once play begins; schedules remain editable and withdrawals become forfeits.
- Organizer and relevant admins may declare forfeits. Forfeits advance without a further admin approval requirement and never affect Elo.
- Site admins and relevant game admins can permanently delete tournaments at any stage, including their associated records and rating effects. Require a typed tournament-name confirmation, preserve unrelated records, and recalculate affected Elo transactionally. Organizers retain deletion before the draw.
- Support Elo, random, manual-order, and explicitly numbered seeding. Doubles Elo seeding uses the partners' average doubles rating. First-round byes go to the highest seeds.

## Sport scoring decisions

- EA FC friendlies permit draws, extra time, and penalties. Leagues permit draws. Knockout games require a winner, using extra time/penalties when necessary. Penalty shootouts count as draws for Elo, with a separate advancement winner. Shootout goals are separate from match goal margin.
- Tennis singles: best of 1/3/5 sets; sets to 6, win by two, tiebreak at 6–6. User confirmed Wimbledon-style tiebreaks: 7 points normally, 10 in the deciding set, win by two.
- Tennis doubles: latest user instruction supersedes the earlier sets-to-8 proposal. Use best of 1 or 3, sets to 6. User confirmed Wimbledon-style tiebreaks: 7 points normally, 10 in a deciding set, win by two; in best of one the only set is deciding. Retain an optional 10-point match tiebreak replacing the entire final set in doubles.
- Table tennis: best of 1/3/5/7; games to 11 or 21, win by two.
- Smash: maximum best of 5 games. Record stocks TAKEN rather than remaining stocks. Singles game counts range 0–3; normal winner takes 3. Record fighter and stage for each game.
- Smash singles: sudden death can resolve equal stocks taken; select sudden-death winner explicitly. JV is a manual flag on the winner.
- Smash doubles: combined team stocks taken, up to 6; each of four players selects a fighter per game, with a shared stage. Support sudden death. No doubles JV toggle.
- User requested approximately 1.1% Elo bonus for JV; communicated literal interpretation is multiplier 1.011, retaining fractional Elo internally. Exact per-game-to-match aggregation remains an implementation detail. Sudden-death wins receive minimal victory-margin credit.

## Standings and qualification

- EA FC league points: win 3, draw 1, loss 0.
- Tennis, table tennis, and Smash standings use wins/losses, with no points column needed because matches cannot draw.
- Organizers choose the ordered tiebreak criteria for their league/group stages, including head-to-head and game-appropriate score differences. Save the rule order with the competition, subject to the structural freeze once play begins.
- Support both an additional tiebreak match and an admin-decided qualifier with a recorded explanation for otherwise unresolved qualification ties. These are competition settings.

## Delegated implementation decisions

- Server submission time is immutable. The November 22 follow-up permits a separate optional played date/start time and duration, blank by default; played time determines chronology, otherwise entry time is used. Stable match ID breaks timestamp ties. Admin checkoff/correction replays eligible results chronologically.
- Latest rating decisions: show numeric Elo with `?` until 8 matches receive Elo checkoff in that game/format. Player K starts at 124, tapers logarithmically to 24 on rated match 45, and stays at 24. Match K is the arithmetic mean of the participants’ individual K values; doubles averages all four.
- Baseline1000, football overall scale20, bounded sport-specific margins, and proportional JV bonus are implemented in server/scoring.js and documented in README.md.
- Freeze structure at draw generation; schedules stay editable. Withdrawals after the draw use organizer/admin forfeits.
- Claim links last seven days; resets one hour. Reissue revokes older links. Existing-account merges require site-admin review and reject identity conflicts.
- Additional multi-player qualifying rounds use round robin. Still-tied entrants can play another round or receive an explained admin decision. League title ties are not silently settled by ID.
- Node/Fastify and SQLite WAL provide a fresh local implementation. The old application's runtime data is never imported. See REBUILD.md for screen integration and tests/ for acceptance checks.
- Public-record JSON export and database backup are distinct. No outgoing email or digest is enabled.
- Domain and external hosting remain undecided; local operation requires neither.

These choices implement the discretion granted during the interview; the preserved template's demo data and old application's behavior are not product requirements.

## November 22 profile and match presentation follow-up

- Equal homepage game cards and identical Open game buttons. Account/player navigation belongs to the main site. Profiles open on all actually played games, with no records invented for inactive games.
- Peaks start after rated match eight, ignoring provisional highs. Admins may upload/remove player photos.
- Nationalities come from a country list, at most two, represented by flags on profiles and racket-sport rankings/scorecards. Football/Smash flairs are scoped to their game.
- Match results are larger and directly clickable. Overviews show pre-match form for friendlies, historical tournament standings where applicable, head-to-head, and American Elo odds. Football uses three outcomes with a learned draw estimate starting at 20%.
- Optional played date/start time and duration are blank initially; an omitted played date falls back to the entry date.

## Competition outlook follow-up

- Show title and qualification chances at the competition's current state. Confirmed qualifiers/group winners are green; confirmed eliminated entries are red, with text labels. Estimates do not constitute proof.
- Allow a configurable number from a chosen lower finishing position, such as the best eight thirds across twelve groups.
- Compare raw points even across unequal groups, then a configurable cross-group order (default difference and scores for), with admin resolution if still tied. No cross-group head-to-head criterion.
- General knockout brackets avoid same-group first-round opponents; FIFA's exact predefined matchup matrix is outside the requested scope.

- Racket-sport tournament and score views use player nationality flags alongside profile photos and names, analogous to club badges in EA FC and fighter icons in Smash. Doubles show flags for each player independently.
