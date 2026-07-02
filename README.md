# Rouleur Cue Sheet Studio

A local-first cycling cue sheet editor. Import a GPX route, place key sections and route points, arrange the cards on a physically sized sheet, and export a print-ready PDF.

## Development

```sh
npm install
npm run dev
```

Run verification with `npm test` and `npm run build`.

## Current behavior

- GPX parsing, cumulative distance, and elevation gain happen in the browser.
- Projects autosave to IndexedDB; no route data is sent to an application server.
- OpenStreetMap tiles are loaded while the route map is visible.
- PDF export uses the exact custom width and height configured in the editor.
