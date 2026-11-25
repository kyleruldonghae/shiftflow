# ShiftFlow

*Your shifts. Your time. Your life.*

A personal, offline-first shift and life planner, built as an installable Progressive Web App.

**Privacy:** this repository contains only the app. All schedules and settings are stored locally on each
device (IndexedDB) and never leave it. There is no server, no account, no tracking.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (time zones, DST, overnight shifts, undo, import)
npm run build    # production build into dist/
```

## Stack

React · TypeScript · Vite · Tailwind CSS · Framer Motion · Lucide · Dexie (IndexedDB) · vite-plugin-pwa

Every push to `main` is tested, built and published to GitHub Pages.
