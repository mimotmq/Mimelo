export const isBracketFixture = (f) =>
  ["knockout", "semifinal", "final"].includes(f.stage);

// Replay the published draw using predicted winners and losers as feeders.
export function predictionRows(fixtures, picks = {}) {
  const outcomes = new Map();
  return fixtures
    .filter(isBracketFixture)
    .sort((a, b) => a.id - b.id)
    .map((fixture) => {
      const sources = ["a", "b"].map((side) => {
        const source = fixture["source_" + side];
        const ref = typeof source === "string" ? JSON.parse(source) : source;
        return ref
          ? { value: outcomes.get(ref.fixture)?.[ref.outcome], ref }
          : { value: fixture[side] };
      });
      const [a, b] = sources.map(({ value }) => value);
      const waiting = sources.some(({ value }) => value === undefined);
      const parent = outcomes.get(sources[0].ref?.fixture);
      const skipped =
        !waiting && !!fixture.conditional && parent?.winner !== parent?.b;
      const needsPick = !waiting && !skipped && !!a && !!b;
      const pick = picks[fixture.id];
      const winner = waiting
        ? undefined
        : skipped
          ? null
          : needsPick
            ? [a, b].includes(pick)
              ? pick
              : undefined
            : a || b || null;
      const loser =
        winner === undefined
          ? undefined
          : needsPick
            ? winner === a
              ? b
              : a
            : null;
      outcomes.set(fixture.id, { winner, loser, b });
      return { fixture, a, b, winner, waiting, skipped, needsPick };
    });
}
