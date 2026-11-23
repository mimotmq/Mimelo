// Field names match the totals used by the standings and qualification engines.
export function statCatalog(kind) {
  const football = kind === "fc",
    tennis = kind === "tennis",
    smash = kind === "smash";
  const catalog = {
    played: ["P", "Matches played"],
    w: ["W", "Wins"],
    ...(football ? { d: ["D", "Draws"] } : {}),
    l: ["L", "Losses"],
    pct: ["PCT", "Win percentage"],
    for: football
      ? ["GF", "Goals scored"]
      : tennis
        ? ["SW", "Sets won"]
        : ["GW", "Games won"],
    against: football
      ? ["GA", "Goals against"]
      : tennis
        ? ["SL", "Sets lost"]
        : ["GL", "Games lost"],
    difference: football
      ? ["GD", "Goal difference"]
      : tennis
        ? ["SD", "Set difference"]
        : ["GD", "Game difference"],
  };
  if (!football)
    Object.assign(catalog, {
      points_for: smash
        ? ["ST", "Stocks taken"]
        : tennis
          ? ["GW", "Games won"]
          : ["PF", "Points for"],
      points_against: smash
        ? ["SL", "Stocks lost"]
        : tennis
          ? ["GL", "Games lost"]
          : ["PA", "Points against"],
      points_difference: smash
        ? ["SD", "Stock difference"]
        : tennis
          ? ["GD", "Game difference"]
          : ["PD", "Point difference"],
    });
  if (football) catalog.points = ["Pts", "Standings points"];
  return catalog;
}

export function defaultColumns(kind) {
  const record = ["played", "w", ...(kind === "fc" ? ["d"] : []), "l"];
  if (kind === "fc")
    return [...record, "for", "against", "difference", "points"];
  if (kind === "tennis" || kind === "smash")
    return [...record, "pct", "difference", "points_difference"];
  return [
    ...record,
    "pct",
    "points_for",
    "points_against",
    "points_difference",
    "for",
    "against",
  ];
}

export function defaultTiebreaks(kind) {
  if (kind === "fc") return ["difference", "for", "head_to_head"];
  if (kind === "smash" || kind === "tennis")
    return ["difference", "points_difference", "head_to_head"];
  return ["points_difference", "points_for", "head_to_head"];
}

export const playpassOrder = [
  "played",
  "points",
  "pct",
  "w",
  "points_difference",
  "points_for",
  "points_against",
];

export function lowerIsBetter(key) {
  return ["l", "against", "points_against"].includes(key);
}

export function statText(row, key) {
  if (key === "pct")
    return row.played
      ? ((row.w + (row.d + (row.nc || 0)) / 2) / row.played).toFixed(3)
      : "—";
  const value = row[key] ?? 0;
  return key.endsWith("difference") && value > 0 ? "+" + value : String(value);
}
