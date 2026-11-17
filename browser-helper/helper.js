import {
  parseMapping,
  mappingCSV,
  crestURL,
  suggestCrests,
} from "./mapping.js";

const $ = (id) => document.getElementById(id);
let rows = [],
  suggestions = [],
  stopped = false,
  controller;
const localFiles = new Map();
const message = (s) => {
  $("message").textContent = s;
};
function save(blob, name) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function render() {
  const search = $("search").value.toLowerCase();
  $("teams").replaceChildren();
  rows.forEach((row, i) => {
    if (![row.name, row.code].some((s) => s.toLowerCase().includes(search)))
      return;
    const tr = document.createElement("tr"),
      team = document.createElement("td");
    team.textContent = row.name;
    const small = document.createElement("small");
    small.textContent = row.code + " · " + (row.gender || "men");
    team.append(small);
    tr.append(team);
    for (const key of ["url", "file", "badge_id"]) {
      const td = document.createElement("td"),
        input = document.createElement("input");
      input.value = key === "url" ? row.url || row.sofifa_id : row[key];
      input.setAttribute("aria-label", row.name + " " + key);
      input.addEventListener("input", () => {
        row[key] = input.value.trim();
        if (key === "url") {
          row.sofifa_id = "";
          suggestions[i] = null;
          tr.lastElementChild?.replaceChildren();
        }
      });
      td.append(input);
      tr.append(td);
    }
    const status = document.createElement("td");
    if (suggestions[i]) {
      const label = document.createElement("small");
      label.textContent = suggestions[i];
      status.append(label);
      const button = document.createElement("button");
      button.textContent = "Confirm suggested crest";
      button.onclick = () => {
        row.url = suggestions[i];
        suggestions[i] = null;
        render();
      };
      status.append(button);
    } else
      status.textContent =
        row.result || (row.badge_id ? "Reuse saved badge" : "Enter a source");
    tr.append(status);
    $("teams").append(tr);
  });
}
$("mapping").onchange = async (e) => {
  try {
    rows = parseMapping(await e.target.files[0].text());
    suggestions = [];
    localFiles.clear();
    render();
    for (const id of ["collect", "download", "save"]) $(id).disabled = false;
    message(
      `${rows.length} teams loaded. Existing badge IDs will be reused without downloading.`,
    );
  } catch (e) {
    message(e.message);
  }
};
$("local").onchange = (e) => {
  for (const file of e.target.files) localFiles.set(file.name, file);
  message(
    `${localFiles.size} local files available. Enter their filenames in the matching rows.`,
  );
};
$("search").oninput = render;
$("save").onclick = () =>
  save(new Blob([mappingCSV(rows)], { type: "text/csv" }), "mapping.csv");
$("cancel").onclick = () => {
  stopped = true;
  controller?.abort();
};
$("collect").onclick = async () => {
  try {
    const tabs = await chrome.tabs.query({ url: "https://sofifa.com/*" }),
      crests = [];
    for (const tab of tabs) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () =>
          [...document.querySelectorAll("img")].map((img) => {
            const container =
              img.closest("tr") || img.closest("li") || img.parentElement;
            const link = container?.querySelector('a[href*="/team/"]');
            return {
              name: link?.textContent?.trim() || img.alt,
              url: img.currentSrc || img.src,
            };
          }),
      });
      for (const result of results) crests.push(...(result.result || []));
    }
    suggestions = suggestCrests(rows, crests);
    render();
    message(
      `${suggestions.filter(Boolean).length} name matches suggested from ${tabs.length} open SoFIFA pages. Confirm only the correct crests; other rows need a URL or image ID.`,
    );
  } catch (e) {
    message("Could not read SoFIFA tabs: " + e.message);
  }
};
$("download").onclick = async () => {
  const controls = [...document.querySelectorAll("input,button")];
  controls.forEach((c) => {
    c.disabled = true;
  });
  $("cancel").disabled = false;
  stopped = false;
  const zip = new JSZip(),
    sources = new Map(),
    output = rows.map((r) => ({ ...r }));
  let count = 0,
    expanded = 0,
    blocked = false;
  try {
    for (let i = 0; i < output.length; i++) {
      if (stopped) break;
      const row = output[i];
      if (row.badge_id) {
        rows[i].result = "Reuse saved badge";
        continue;
      }
      try {
        const local = localFiles.get(row.file);
        if (local) {
          if (!sources.has("local:" + row.file)) {
            if (Object.hasOwn(zip.files, row.file))
              throw new Error("Filename already used by another source");
            if (local.size > 5 * 1024 * 1024)
              throw new Error("File exceeds 5 MB");
            expanded += local.size;
            if (expanded > 100 * 1024 * 1024)
              throw new Error("Images exceed 100 MB; split this mapping");
            zip.file(row.file, local);
            sources.set("local:" + row.file, row.file);
            count++;
          }
          rows[i].result = "Local file packaged";
          continue;
        }
        if (!row.url && !row.sofifa_id) {
          rows[i].result = row.file
            ? "Mapped file; review in Mimelo"
            : "Missing source; review in Mimelo";
          continue;
        }
        const url = crestURL(row.url || row.sofifa_id);
        if (sources.has(url)) {
          row.file = sources.get(url);
          rows[i].result = "Shares downloaded crest";
          continue;
        }
        if (blocked) {
          row.file = "";
          rows[i].result = "Download stopped after access block";
          continue;
        }
        row.url = url;
        row.file ||= "sofifa-" + url.split("/").at(-2) + ".png";
        if (Object.hasOwn(zip.files, row.file))
          throw new Error("Filename already used by another source");
        message(`Downloading ${i + 1} of ${rows.length}: ${row.name}…`);
        controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        let response, data;
        try {
          response = await fetch(url, {
            credentials: "include",
            redirect: "error",
            signal: controller.signal,
          });
          if ([403, 429].includes(response.status)) blocked = true;
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (response.headers.get("content-type")?.includes("text/html")) {
            blocked = true;
            throw new Error("Received an HTML page instead of a crest");
          }
          data = new Uint8Array(await response.arrayBuffer());
        } finally {
          clearTimeout(timeout);
        }
        if (data.length > 5 * 1024 * 1024) throw new Error("File exceeds 5 MB");
        if (![137, 80, 78, 71, 13, 10, 26, 10].every((b, n) => data[n] === b))
          throw new Error("Response was not a PNG");
        expanded += data.length;
        if (expanded > 100 * 1024 * 1024)
          throw new Error("Images exceed 100 MB; split this mapping");
        zip.file(row.file, data);
        sources.set(url, row.file);
        count++;
        rows[i].result = "Downloaded";
        await new Promise((resolve) => setTimeout(resolve, 750));
      } catch (e) {
        row.file = "";
        rows[i].result = "Not packaged: " + e.message;
      }
    }
    for (let i = 0; i < output.length; i++) rows[i].file = output[i].file;
    zip.file("mapping.csv", mappingCSV(output));
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
    });
    if (blob.size > 25 * 1024 * 1024)
      throw new Error(
        "ZIP exceeds 25 MB. Save your mapping and split it into smaller imports.",
      );
    save(blob, "mimelo-crests.zip");
    message(
      `${count} image files packaged${blocked ? "; SoFIFA blocked further downloads" : stopped ? "; downloads stopped" : ""}. Upload the ZIP in Mimelo to review all matches and missing files.`,
    );
  } catch (e) {
    message(e.message);
  } finally {
    controls.forEach((c) => {
      c.disabled = false;
    });
    $("cancel").disabled = true;
    render();
  }
};
