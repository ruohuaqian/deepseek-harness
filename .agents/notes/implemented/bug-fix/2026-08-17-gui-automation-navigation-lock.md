# Agent Note: GUI URL must not be driven by browser automation

Status: implemented

English | [中文](2026-08-17-gui-automation-navigation-lock.zh.md)

## Problem

The Web GUI holds long-lived EventSource (`/plugins/events`) and WebSocket streams. Browser automation that opens or binds the live GUI URL waits for a finished navigation, times out on those streams, and retries `Page.goto` or reload. The desktop shell previously allowed any same-origin navigation and same-origin `window.open`, so each retry full-reloaded the SPA. A document GET of `/plugins/events` hung on the SSE body, which is the same retry pattern. The `app:web-surface` prompt named `DSH_WEB_URL` and told the model to verify that URL after a page refresh, which made opening the GUI with OpenCLI a plausible next step.

## Decision

Three owners close the loop.

The unpublished desktop shell cancels in-window navigation after `loadURL`: `will-navigate` and (once the first document has finished) `will-redirect` always `preventDefault` and do not call `openExternal`. OpenCLI classifies a cancelled CDP goto as retryable target navigation (~200ms). Handing each retry to the system browser reloads that URL, so the agent only ever reads a loading snapshot. `setWindowOpenHandler` still denies every popup and opens a distinct http(s) origin in the system browser at most once per five seconds. The [desktop window note](../feature/2026-08-17-windows-desktop-window.md) still owns that Electron assembly.

`app:web-surface` forbids opening, binding, navigating, or reloading this GUI URL with browser automation or an external opener, and tells the model to drive other sites in a separate owned browser session. After opening a third-party URL, it must not open or reload that URL again; a loading snapshot means wait. `DSH_WEB_URL`'s description states the GUI identity is not a browse target. The [GUI feedback-loop note](2026-07-28-web-gui-feedback-loop.md) still owns why the URL is published.

`GET /plugins/events` without `Accept: text/event-stream` is 406, so a document navigation cannot hang on the stream.

## Alternatives considered

**Wait for networkidle by delaying EventSource and WebSockets.** The streams must stay open for the live GUI. Delaying them would still leave networkidle unreachable once they connect, and would not stop a same-origin `Page.goto` retry.

**Bounce a navigated desktop window back with `loadURL` of the GUI.** That races the automator: it navigates away, the shell loads back, the automator retries — another loop.

**Only change the prompt.** A Chrome tab of `dsh web` still reloads if an already-bound session targets it. The prompt is necessary and not sufficient; the shell lock and 406 cover the mechanical retries.

**Hand cancelled main-frame navigations to `shell.openExternal`.** OpenCLI retries a cancelled CDP goto about every 200ms. Each `openExternal` reloads that URL in the system browser, so the agent only ever reads a loading snapshot. User-clicked `target=_blank` links still go through `setWindowOpenHandler`.

## Consequences

OpenCLI and similar `browser open` of a third-party site from a dsh session use a separate owned browser session; the Electron GUI stays on the loaded document. Cancelled main-frame navigations do not reopen that site in the system browser. A Chrome tab of the GUI can still be bound or reloaded by an operator who ignores the prompt. CDP `Page.reload` on Electron is not always delivered as `will-navigate`; the prompt remains the coverage for that path.

## Testing

`web-app` assembly asserts the automation sentence in `app:web-surface`. The web-runtime-context and fresh-round-trip snapshots pin the paragraph. The HMR node-half test GETs `/plugins/events` with `text/html` (406) and `text/event-stream` (200 SSE). Desktop navigation lock is the Electron `will-navigate` / `will-redirect` contract in `desktop/main.mjs`; CI does not launch Electron.
