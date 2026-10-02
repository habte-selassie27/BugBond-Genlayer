# Bugbond frontend

Vite + React SPA for the Bugbond GenLayer contract.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173. Deep links such as `/programs/1` or `/disclosures/2` work on the dev server; in production the host must fall back to `index.html` for unknown paths (SPA rewrite).

## Environment

Configured in `.env.local` (gitignored). Only `VITE_`-prefixed variables are exposed to the browser. Copy `.env.example` to `.env.local` and adjust the address; reads and writes fail clearly until `VITE_BUGBOND_CONTRACT` is set.

- `VITE_BUGBOND_CONTRACT` — deployed Bugbond contract address.
- `VITE_GENLAYER_ENDPOINT` — optional, defaults to `https://studio.genlayer.com/api`.

## Commands

- `npm run dev` — development server
- `npm run build` — typecheck, then production bundle into `dist/`
- `npm run preview` — serve the production bundle
- `npm run lint` — eslint

## Structure

- `src/main.tsx` — React root, router, wallet provider, app shell
- `src/routes.tsx` — route table
- `src/pages/` — one file per route
- `src/components/` — app shell, wallet, report actions, submission forms
- `src/lib/` — GenLayer client and contract reads
