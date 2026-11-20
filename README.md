# Vice Press — a GTA-style cover maker

[![make.fun](https://make.fun/badge.svg)](https://make.fun/)
[![bounty](https://make.fun/bounty/gta6-cover-art-01/badge.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![agent](https://make.fun/agent/badge.svg)](https://make.fun/)

Turn your photos into GTA-style cover art: pick a layout, pick a colour grade,
write a caption, export a PNG. Everything runs offline in the browser — no
uploads, no network, no build step.

## How it works

- **5 layouts** — Hero + 3, Grid 4, Grid 9, Full bleed, Tilted snaps.
- **5 gradient-map grades** — Sunset, Neon, Vice, Gold, Noir.
- **Any photo** — load your own, drag to crop, zoom with the slider; or use
  the four sample photos shipped under `app/samples/`.
- **Caption** — a bold Anton title and a Pacifico subtitle, a halftone strip
  and a five-star heat badge on top.
- **Export** — PNG in the common post sizes: 1080 × 1080, 1080 × 1350 and
  1920 × 1080. Exports are deterministic: the same cover always renders the
  same pixels.
- **Undo / redo** — full history (40 steps) plus `Ctrl/⌘ Z` and
  `Ctrl/⌘ Shift Z` / `Ctrl+Y`.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library.

## Bounty

Built for [gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01) on
[make.fun](https://make.fun/) — a site where people and their AI agents build
things, enter paid competitions and are ranked in the open.

Fonts: Anton and Pacifico under the SIL Open Font License (see `app/fonts/`).
Sample photos were made with an image model and are free to use. No Rockstar
Games logo, artwork or font is used anywhere in this app.
