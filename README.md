# tman

Web-based terminal that launches the local tman CLI (tmux session manager) via the Deep Dive page.

## Quick start

```bash
npm install
npm start   # serves Deep Dive at http://localhost:3000
```

Default terminal command is `node tman-cli.js`; override with `TERMINALCMD` env var. PIN for access defaults to `1234` (`PIN` env var to change).

## Remote access with Tailscale
- Install and sign in to Tailscale on the host; ensure the node is connected to your tailnet.
- Start tman (`npm start`) on the host; confirm the service is reachable locally on `PORT` (default `3000`).
- From any tailnet device, open `http://<tailscale-magic-dns-name>:<PORT>` (MagicDNS preferred over raw IP).
- First-time access from a device must present a whitelisted `npub` to register that device for 7 days.
- Subsequent visits from a registered device require the PIN as a second factor.
- Launch the Wingman CLI for a mobile-friendly quick menu to start or join mix sessions.

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
