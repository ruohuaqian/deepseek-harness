# Desktop window

[English](README.md) | 中文

本地 Electron 窗口：启动现有的 `dsh web` 宿主，并加载其 loopback URL。任务栏与标题栏图标使用 [`packages/client/ui-primitives/src/FishLogo.tsx`](../packages/client/ui-primitives/src/FishLogo.tsx) 中的 DeepSeek 鲸鱼，绘制在 Web UI 品牌蓝 `#3964FE` 上。本目录不是 pnpm workspace 成员，也不会被发布。

[Windows 桌面窗口 Agent Note](../.agents/notes/implemented/feature/2026-08-17-windows-desktop-window.md) 记录了该壳层为何加载 HTTP，而不是计划中的 `file://` IPC Electron 客户端。

## Run

在仓库根目录完成安装与 Web 构建之后：

```sh
pnpm install
pnpm run build
pnpm desktop
```

首次 `pnpm desktop` 会在 `desktop/` 内运行 `npm install` 以下载 Electron。之后的启动会复用 `desktop/node_modules`。关闭窗口会停止 `dsh web` 子进程。

`pnpm desktop` 之后的额外参数会交给 `dsh web`。未指定 `--port` 时，宿主绑定操作系统分配的端口，以免与仍在运行的浏览器服务器冲突。

```sh
pnpm desktop -- --port 3080
```

设置 `DSH_DESKTOP_DEVTOOLS=1` 可打开 Chromium DevTools。

## Layout

| Path | Role |
|---|---|
| `main.mjs` | Electron 主进程：spawn `dsh web`、创建窗口、加载就绪 URL，并阻止该文档再导航。 |
| `splash.html` | 在宿主打印 `dsh web: http://…` 之前显示的加载页。 |
| `icon.svg` / `icon.ico` | 用作窗口与任务栏图标的鲸鱼标志。 |
