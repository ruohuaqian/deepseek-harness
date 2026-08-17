# Agent Note: Windows desktop window around dsh web

Status: implemented

[English](2026-08-17-windows-desktop-window.md) | 中文

## Problem

`dsh web` 把 GUI 开在浏览器标签页里。Windows 使用者若想要一个独立的应用程序窗口——任务栏上是鲸鱼标志而不是浏览器 favicon——目前没有产品装配能创建这样的窗口。GUI 分层说明已经点名未来的 Electron 客户端，但该客户端尚不存在；若要等待它的 `file://` 加 IPC fetch 载体，窗口需求就得不到回应。

## Decision

`desktop/` 是本地、不发布的 Electron 壳层。`pnpm desktop` 运行 [`scripts/desktop-launch.mjs`](../../../../scripts/desktop-launch.mjs)，首次使用时把 Electron 下载到 `desktop/node_modules`，然后启动 [`desktop/main.mjs`](../../../../desktop/main.mjs)。启动器把它自己的 Node.js 可执行文件作为 `DSH_NODE_EXEC_PATH` 传入。主进程用该 Node 路径 spawn 与浏览器相同的 `dsh web` 宿主——而不是 Electron 的 `process.execPath`——等待 `dsh web: http://…` 这一行，再在标题为 DeepSeek Harness 的 `BrowserWindow` 中加载该 loopback URL。Win32 文件夹对话框 worker 是带 IPC 通道的 `spawn(process.execPath, worker)`（[进程内对话框说明](2026-08-02-win32-in-process-folder-dialog.md)）；若在 `electron.exe` 下 spawn `dsh web`，该 worker 会在报告结果之前退出。

窗口图标是 [`packages/client/ui-primitives/src/FishLogo.tsx`](../../../../packages/client/ui-primitives/src/FishLogo.tsx) 中的 FishLogo 鲸鱼路径，置于品牌蓝 `#3964FE` 上，与 [`packages/client/web/src/AppRoot.module.css`](../../../../packages/client/web/src/AppRoot.module.css) 使用的 Web UI 强调色一致。关闭窗口会停止子宿主。`pnpm desktop` 之后的额外 argv 会转发给 `dsh web`；除非调用方传入 `--port`，否则省略该 flag，让宿主使用操作系统分配的端口。

该壳层不是 pnpm workspace 成员，也不是 dsh release member。因此 Electron 不会进入 `pnpm install`、CI 和 npm 发布。这是套在现有 HTTP Web UI 外的窗口，不是 [GUI 分层说明](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md) 中描述的 IPC Electron 客户端。

## Alternatives considered

**交付计划中的 `file://` 加 IPC fetch Electron 客户端。** 这正是 webserver README 已经写明的架构。为本次需求否决：它需要新的 fetch 载体、不绑定 HTTP 的 Host 组合，以及 client connection 子类——远大于在已经能跑的 GUI 上打开一个原生窗口。

**把 `apps/desktop` 做成 `@deepseek-ai/dsh-*` workspace 与 release member。** 那样 `pnpm install` 和每项 CI 作业都会下载 Electron，dsh family 还会发布一个运行时是桌面壳层的包。否决：本次需求是本地 Windows 窗口，不是新的 npm 产物。

**用 Microsoft Edge 的 `--app=` 打开。** 能得到无浏览器外壳的窗口，且无额外依赖。否决：任务栏身份仍是 Edge，鲸鱼标志不能成为应用程序图标。

**C# WebView2 可执行文件。** 运行时更原生、更小。否决：它引入本仓库并不使用的 .NET 工具链，而 Electron 复用 Web UI 已经需要的 Node 安装。

## Consequences

启动路径是 `pnpm desktop`。首次运行需要网络，以便在 `desktop/` 内执行 `npm install`。只在浏览器里使用 `dsh web` 的操作者不受影响。

HTTP 宿主仍绑定 loopback，因此窗口打开时浏览器也可以打开同一 URL。该壳层不实现分层说明中点名的 IPC 载体、native 目录选择器提供方，或 `file://` dist 加载；那些仍属于未来的 Electron 客户端工作。

## Testing

在 `pnpm run build` 之后于 Windows 上启动 `pnpm desktop`。窗口标题为 DeepSeek Harness，任务栏图标为蓝底鲸鱼徽章，加载的页面与 `dsh web` 的 Web UI 相同。**Open local folder** 会打开 Win32 `IFileOpenDialog`。关闭窗口后不应留下孤儿 `dsh web` 进程。
