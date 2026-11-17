import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMapping,
  mappingCSV,
  crestURL,
  suggestCrests,
} from "../browser-helper/mapping.js";

test("crest helper round-trips quoted CSV names and preserves team codes and saved links", () => {
  const rows = parseMapping(
    '\uFEFFcode,name,gender,file,badge_id\r\nMUN,"Manchester, \"\"United\"\"",men,crest.png,7\r\n',
  );
  assert.equal(rows[0].name, 'Manchester, "United"');
  assert.equal(rows[0].badge_id, "7");
  assert.deepEqual(parseMapping(mappingCSV(rows)), rows);
  assert.throws(() => parseMapping("code,code\nA,B\n"), /unique/);
  assert.throws(() => parseMapping('code,name\nA,"broken'), /quote/);
});

test("crest helper accepts only direct SoFIFA team PNGs and requires unique exact name suggestions", () => {
  const url = "https://cdn.sofifa.net/meta/team/14/240.png";
  assert.equal(crestURL("14"), url);
  assert.equal(crestURL(url), url);
  for (const unsafe of [
    "https://example.com/a.png",
    "https://cdn.sofifa.net.evil.com/teams/14/240.png",
    "http://cdn.sofifa.net/teams/14/240.png",
    url + "?other=1",
    "https://user@cdn.sofifa.net/teams/14/240.png",
  ])
    assert.throws(() => crestURL(unsafe));
  assert.deepEqual(
    suggestCrests(
      [
        { name: "Manchester United" },
        { name: "Manchester United Women" },
        { name: "Manchester United", badge_id: "1" },
        { name: "Other" },
      ],
      [
        { name: "Manchester United", url },
        { name: "Other", url },
        { name: "Other", url: "https://cdn.sofifa.net/meta/team/15/240.png" },
      ],
    ),
    [url, null, null, null],
  );
});
