# Agent Note: Windows desktop window around dsh web

Status: implemented

English | [中文](2026-08-17-windows-desktop-window.zh.md)

## Problem

`dsh web` serves the GUI in a browser tab. A Windows operator who wants a dedicated application window — with the whale mark on the taskbar rather than a browser favicon — has no product assembly that creates one. The GUI layering note already names a future Electron client, but that client does not exist, and waiting for its `file://` plus IPC fetch carrier leaves the window request unanswered.

## Decision

`desktop/` is a local, unpublished Electron shell. `pnpm desktop` runs [`scripts/desktop-launch.mjs`](../../../../scripts/desktop-launch.mjs), which downloads Electron into `desktop/node_modules` on first use, then starts [`desktop/main.mjs`](../../../../desktop/main.mjs). The launcher passes its own Node.js executable as `DSH_NODE_EXEC_PATH`. The main process spawns the same `dsh web` host the browser uses with that Node path — not Electron's `process.execPath` — waits for the `dsh web: http://…` line, and loads that loopback URL in a `BrowserWindow` titled DeepSeek Harness. The Win32 folder-dialog worker is `spawn(process.execPath, worker)` with an IPC channel ([in-process dialog note](2026-08-02-win32-in-process-folder-dialog.md)); spawning `dsh web` under `electron.exe` made that worker exit before reporting a result.

The window icon is the FishLogo whale path from [`packages/client/ui-primitives/src/FishLogo.tsx`](../../../../packages/client/ui-primitives/src/FishLogo.tsx) on brand blue `#3964FE`, matching the Web UI accent used in [`packages/client/web/src/AppRoot.module.css`](../../../../packages/client/web/src/AppRoot.module.css). Closing the window stops the child host. Extra argv after `pnpm desktop` is forwarded to `dsh web`; `--port` is omitted unless the caller passed one, so the host takes an OS-assigned port.

The shell is not a pnpm workspace member and is not a dsh release member. Electron therefore stays out of `pnpm install`, CI, and npm publication. This is a window around the existing HTTP Web UI, not the IPC Electron client described in the [GUI layering note](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md).

## Alternatives considered

**Ship the planned `file://` plus IPC fetch Electron client.** That is the architecture the webserver README already states. Rejected for this request because it needs a new fetch carrier, a Host composition that does not bind HTTP, and a client connection subclass — work far larger than opening a native window on the GUI that already runs.

**Add `apps/desktop` as a `@deepseek-ai/dsh-*` workspace and release member.** Then `pnpm install` and every CI job download Electron, and the dsh family would publish a package whose runtime is a desktop shell. Rejected because the request is a local Windows window, not a new npm artifact.

**Open Microsoft Edge with `--app=`.** Gives a chromeless window with no extra dependency. Rejected because the taskbar identity stays Edge's, and the whale mark cannot be the application icon.

**A C# WebView2 executable.** Native and small at runtime. Rejected because it adds a .NET toolchain this repository does not otherwise use, while Electron reuses the Node install the Web UI already requires.

## Consequences

`pnpm desktop` is the launch path. The first run needs network access for `npm install` inside `desktop/`. Operators who only use `dsh web` in a browser are unchanged.

The HTTP host still binds loopback, so a browser can open the same URL while the window is up. The shell does not implement the IPC carrier, native directory-picker provider, or `file://` dist loading named in the layering note; those remain future Electron-client work.

## Testing

Launch `pnpm desktop` on Windows after `pnpm run build`. The window title is DeepSeek Harness, the taskbar icon is the blue whale badge, and the loaded page is the same Web UI as `dsh web`. **Open local folder** opens the Win32 `IFileOpenDialog`. Closing the window leaves no orphan `dsh web` process.
