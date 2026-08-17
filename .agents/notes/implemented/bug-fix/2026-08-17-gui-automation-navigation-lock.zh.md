# Agent Note: GUI URL must not be driven by browser automation

Status: implemented

[English](2026-08-17-gui-automation-navigation-lock.md) | 中文

## 问题

Web GUI 持有长寿命的 EventSource（`/plugins/events`）和 WebSocket 流。浏览器自动化若打开或绑定正在使用的 GUI URL，会等待导航结束，在这些流上超时，然后重试 `Page.goto` 或 reload。桌面壳层先前允许任意同源导航和同源 `window.open`，于是每次重试都会整页重载这个 SPA。对 `/plugins/events` 的文档 GET 会挂在 SSE 响应体上，重试模式相同。`app:web-surface` 提示词给出了 `DSH_WEB_URL`，并让模型在页面刷新后验证该 URL，于是用 OpenCLI 打开 GUI 成了合理的下一步。

## 决策

三处所有者共同闭合这条回路。

未发布的桌面壳层在 `loadURL` 之后取消窗口内导航：`will-navigate` 以及（首份文档加载完成后的）`will-redirect` 始终 `preventDefault`，并且不调用 `openExternal`。OpenCLI 把被取消的 CDP goto 归为可重试的目标导航（约 200ms）。若把每次重试交给系统浏览器，该 URL 会被反复重载，agent 就只能读到加载中的快照。`setWindowOpenHandler` 仍拒绝所有弹窗，并对不同的 http(s) 源在系统浏览器中至多每五秒打开一次。[桌面窗口说明](../feature/2026-08-17-windows-desktop-window.md) 仍负责该 Electron 装配。

`app:web-surface` 禁止用浏览器自动化或外部打开器打开、绑定、导航或重载此 GUI URL，并要求模型在单独的自有浏览器会话中驱动其他站点。打开第三方 URL 之后，不得再次打开或重载该 URL；加载中的快照意味着等待。`DSH_WEB_URL` 的描述写明 GUI 身份不是浏览目标。[GUI 反馈回路说明](2026-07-28-web-gui-feedback-loop.md) 仍负责为何发布该 URL。

没有 `Accept: text/event-stream` 的 `GET /plugins/events` 返回 406，因此文档导航无法挂在该流上。

## 考虑过的替代方案

**通过推迟 EventSource 和 WebSocket 来等到 networkidle。** 这些流必须为正在使用的 GUI 保持打开。推迟之后一旦连接，networkidle 仍然不可达，也无法阻止同源 `Page.goto` 重试。

**桌面窗口被导航走之后再用 GUI 的 `loadURL` 弹回。** 这会与自动化器竞态：它导航离开，壳层加载回来，自动化器再试——又是循环。

**只改提示词。** 若已绑定的会话瞄准 `dsh web` 的 Chrome 标签页，页面仍会刷新。提示词必要但不够；壳层锁定和 406 覆盖机械重试。

**把被取消的主框架导航交给 `shell.openExternal`。** OpenCLI 约每 200ms 重试被取消的 CDP goto。每次 `openExternal` 都会在系统浏览器中重载该 URL，于是 agent 只能读到加载中的快照。用户点击的 `target=_blank` 链接仍走 `setWindowOpenHandler`。

## 后果

从 dsh 会话用 OpenCLI 等工具 `browser open` 第三方站点时，应使用单独的自有浏览器会话；Electron GUI 留在已加载的文档上。被取消的主框架导航不会在系统浏览器中再次打开该站点。忽略提示词的操作者仍可绑定或重载 GUI 的 Chrome 标签页。Electron 上的 CDP `Page.reload` 并不总是以 `will-navigate` 送达；该路径仍由提示词覆盖。

## 测试

`web-app` 装配断言 `app:web-surface` 中的自动化禁令句。web-runtime-context 与 fresh-round-trip 快照钉住该段。HMR node-half 测试对 `/plugins/events` 分别 GET `text/html`（406）和 `text/event-stream`（200 SSE）。桌面导航锁定是 `desktop/main.mjs` 中的 Electron `will-navigate` / `will-redirect` 约定；CI 不启动 Electron。
