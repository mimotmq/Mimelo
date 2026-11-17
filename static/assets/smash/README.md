Fighter icons are preloaded from the owner's SSBU_200x200_Head_Icons folder.
icon-sources.json maps the original filenames to the bundled assets.

Stage images are preloaded from the owner's ssbu/stages folder, encoded as WebP
for delivery. stage-sources.json maps the original files to the bundled assets.

Icons for historical individual Pokémon/Pyra/Mythra picks come from
https://github.com/joaorb64/StreamHelperAssets/tree/main/games/ssbu
(Nintendo / respective character rights holders).

Add stages to static/catalogs/smash.json with a stable id, name, code, image, and
group (Starters or Counterpicks). The picker discovers entries and groups from
the catalog. Fighter numbers are display metadata, separate from stable IDs.
legacyFighters retains old individually selected forms for saved matches.
Uploaded catalog images override the bundled defaults.
