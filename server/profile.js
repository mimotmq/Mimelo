import { readFileSync } from "node:fs";
import { assert } from "./db.js";

const countries = JSON.parse(
  readFileSync(new URL("../static/catalogs/countries.json", import.meta.url)),
);
const names = new Set(countries.map((country) => country.name));

export function nationalityValue(value, previous = "") {
  const name = String(value || "").trim();
  assert(
    !name || names.has(name) || name === previous,
    "Choose a nationality from the list.",
  );
  return name;
}

export function profileNationalities(profile = {}) {
  return [
    ...new Set(
      (Array.isArray(profile.nationalities)
        ? profile.nationalities
        : [profile.nationality]
      ).filter(Boolean),
    ),
  ].slice(0, 2);
}

export function nationalitiesValue(value, previous = []) {
  assert(
    Array.isArray(value) && value.length <= 2,
    "Choose up to two nationalities.",
  );
  const selected = value
    .map((name) => nationalityValue(name, previous.includes(name) ? name : ""))
    .filter(Boolean);
  assert(
    new Set(selected).size === selected.length,
    "Choose two different nationalities.",
  );
  return selected;
}
