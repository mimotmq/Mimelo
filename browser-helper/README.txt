Mimelo crest helper (Chrome / Edge)

1. Unzip this helper into a folder. Keep all files together.
2. Open chrome://extensions (or edge://extensions), enable Developer mode,
   choose Load unpacked, and select that folder.
3. Click the Mimelo crest helper extension icon to open its page.
4. In Mimelo: Admin > Games > Administer > Manage images > Bulk import crests.
   Download the team mapping CSV for the edition, then load it in the helper.
5. Enter each team's SoFIFA numeric image ID or full PNG URL. These IDs are NOT
   Mimelo team codes or necessarily the IDs in SoFIFA team-page URLs.
   Example supplied by the site owner: MUN uses
   https://cdn.sofifa.net/meta/team/14/240.png
6. Optionally open SoFIFA team listing pages and choose Read open SoFIFA pages.
   Suggestions use exact normalized team names and must be confirmed individually.
   Review national teams, women's teams and similar names carefully.
7. To share one crest, use the same URL for both teams. To reuse an existing
   Mimelo badge, copy its badge_id from the mapping into the other team's row.
   Saved badge IDs take priority over downloads. Existing associations in Mimelo
   are always preserved by the bulk importer.
8. Download crest ZIP and upload it to Mimelo. Review the preview, then Apply.
   Rows with problems are skipped; valid rows are imported. Repeated imports
   preserve existing badges. One source file creates one reusable badge.

Mapping CSV columns: code,name,gender,sofifa_id,url,file,badge_id
The file column is a relative filename inside the ZIP, not a website URL.
Manual ZIPs work too: put mapping.csv at the root, with the named PNG/JPEG/WebP
files. You may also add already downloaded images in the helper.

Downloads run locally using the browser's normal connection. Successful access
in another tab does not guarantee that extension requests will be accepted.
The helper never solves or bypasses Cloudflare challenges. On HTTP 403/429 it
stops network downloads and packages completed files plus the full mapping.
You can save the CSV, add missing images locally, and package it again later.

Limits: 25 MB ZIP, 5 MB per image, 100 MB of image data, 2,500 archive entries,
10,000 mapping rows. Split larger catalogs into smaller imports.
No Mimelo login cookies, passwords or account data are read by this extension.
The helper only contacts cdn.sofifa.net and reads open sofifa.com tabs on request.
