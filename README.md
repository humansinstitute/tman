# tman

Web-based terminal that launches the local tman CLI (tmux session manager) via the Deep Dive page.

## Quick start

```bash
npm install
npm start   # serves Deep Dive at http://localhost:3000
```

Default terminal command is `node tman-cli.js`; override with `TERMINALCMD` env var. PIN for access defaults to `1234` (`PIN` env var to change).

## Assets
- `public/deep-dive.html` – single-page UI
- `public/tman_icon.png` – favicon/app icon
- `tman-cli.js` – tmux session manager launched inside the web terminal

## Scripts
- `npm start` / `npm run web` – start server
- `npm run cli` – run CLI locally

## Notes
- Server routes only: `/` and `/deep-dive`
- Socket namespace: `/terminal`
- Environment: `PORT`, `PIN`, `TERMINALCMD`
