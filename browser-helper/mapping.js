export const columns = [
  "code",
  "name",
  "gender",
  "sofifa_id",
  "url",
  "file",
  "badge_id",
];

export function parseMapping(text) {
  const table = [];
  let row = [],
    value = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
      row.push(value.trim());
      value = "";
      if (c !== ",") {
        if (row.some(Boolean)) table.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else value += c;
  }
  if (quoted) throw new Error("Unclosed quote in mapping CSV.");
  row.push(value.trim());
  if (row.some(Boolean)) table.push(row);
  const headers = table.shift()?.map((h) => h.toLowerCase());
  if (!headers?.includes("code"))
    throw new Error("Choose the Mimelo mapping CSV with a code column.");
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV column names must be unique.");
  if (!table.length || table.length > 10000)
    throw new Error("Map between 1 and 10,000 teams.");
  return table.map((values) => {
    if (values.length !== headers.length)
      throw new Error(
        "CSV rows must have the same number of columns as the header.",
      );
    return {
      ...Object.fromEntries(columns.map((h) => [h, ""])),
      ...Object.fromEntries(headers.map((h, i) => [h, values[i]])),
    };
  });
}

export function mappingCSV(rows) {
  return (
    [columns, ...rows.map((r) => columns.map((c) => r[c] || ""))]
      .map((r) =>
        r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
      )
      .join("\r\n") + "\r\n"
  );
}
export function crestURL(value) {
  value = String(value || "").trim();
  if (/^\d+$/.test(value))
    return `https://cdn.sofifa.net/meta/team/${value}/240.png`;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "cdn.sofifa.net" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/(?:meta\/team|teams)\/\d+\/\d+\.png$/.test(url.pathname)
  )
    throw new Error("Use a SoFIFA team PNG URL or its numeric image ID.");
  return url.href;
}
export function teamName(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function suggestCrests(rows, crests) {
  const choices = new Map();
  for (const crest of crests) {
    try {
      const url = crestURL(crest.url),
        key = teamName(crest.name);
      if (!key) continue;
      if (!choices.has(key)) choices.set(key, new Set());
      choices.get(key).add(url);
    } catch {
      /* Ignore non-team images. */
    }
  }
  return rows.map((r) => {
    const urls = choices.get(teamName(r.name));
    return !r.url && !r.sofifa_id && !r.badge_id && urls?.size === 1
      ? [...urls][0]
      : null;
  });
}
