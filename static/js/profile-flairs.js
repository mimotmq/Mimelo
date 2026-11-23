let countries;
let countryNames = new Map();
export async function countryList() {
  countries ||= fetch("catalogs/countries.json").then((response) => {
    if (!response.ok) throw new Error("Could not load the nationality list.");
    return response.json().then((rows) => {
      countryNames = new Map(
        rows.map((country) => [country.name.toLowerCase(), country]),
      );
      return rows;
    });
  });
  return countries;
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
export function nationalityFlags(profile) {
  const flags = profileNationalities(profile)
    .map((name) => {
      const country = countryNames.get(name.toLowerCase());
      return country
        ? `<img class="country-flag" src="assets/flags/${country.code.toLowerCase()}.svg" alt="${UI.esc(country.name)}" title="${UI.esc(country.name)}" width="24" height="18">`
        : `<span class="nationality-country">${UI.esc(name)}</span>`;
    })
    .join("");
  return flags ? `<span class="nationality-flags">${flags}</span>` : "";
}
export function renderProfileFlairs(profile, kind) {
  const { esc } = UI;
  const fields = [
    ...(kind === "fc" ? [["favoriteTeam", "Favourite team"]] : []),
    ...(kind === "smash"
      ? [
          ["tag", "Smash tag"],
          ["mains", "Smash mains"],
        ]
      : []),
  ];
  return (
    nationalityFlags(profile) +
    fields
      .filter(([key]) => profile[key])
      .map(
        ([key, label]) =>
          `<span class="chip" data-profile-flair="${key}" aria-label="${esc(label + ": " + profile[key])}">${esc(profile[key])}</span>`,
      )
      .join("")
  );
}
