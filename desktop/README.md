# Desktop window

English | [中文](README.zh.md)

A local Electron window that boots the existing `dsh web` host and loads its loopback URL. The taskbar and title-bar icon is the DeepSeek whale from [`packages/client/ui-primitives/src/FishLogo.tsx`](../packages/client/ui-primitives/src/FishLogo.tsx), drawn on the Web UI brand blue `#3964FE`. This directory is not a pnpm workspace member and is not published.

The [Windows desktop window Agent Note](../.agents/notes/implemented/feature/2026-08-17-windows-desktop-window.md) records why this shell loads HTTP instead of the planned `file://` IPC Electron client.

## Run

From the repository root, after a full install and Web build:

```sh
pnpm install
pnpm run build
pnpm desktop
```

The first `pnpm desktop` runs `npm install` inside `desktop/` to download Electron. Later launches reuse `desktop/node_modules`. Closing the window stops the `dsh web` child process.

Extra arguments after `pnpm desktop` reach `dsh web`. Without `--port`, the host binds an OS-assigned port so a leftover browser server does not collide.

```sh
pnpm desktop -- --port 3080
```

Set `DSH_DESKTOP_DEVTOOLS=1` to open Chromium DevTools.

## Layout

| Path | Role |
|---|---|
| `main.mjs` | Electron main process: spawn `dsh web`, create the window, load the ready URL. |
| `splash.html` | Loading page shown until the host prints `dsh web: http://…`. |
| `icon.svg` / `icon.ico` | Whale mark used as the window and taskbar icon. |
