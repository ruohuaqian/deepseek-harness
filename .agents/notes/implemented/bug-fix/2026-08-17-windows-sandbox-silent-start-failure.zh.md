# Agent Note: Silent Windows sandbox start failures

Status: implemented

[English](2026-08-17-windows-sandbox-silent-start-failure.md) | 中文

## Problem

在 Windows ACL 受限令牌下，工作区里再拉起 `git.exe` 或 `python.exe` 的命令常常在 DLL 初始化期间以 `STATUS_DLL_INIT_FAILED`（`0xC0000142`）或 `STATUS_ACCESS_DENIED`（`0xC0000022`）死亡。随后 Windows 会弹出阻塞式 Application Error 对话框。进程此时已经失败；该对话框不是权限提示，stderr 通常为空，因此 bash/pwsh 沙箱分类器不会设置 `sandbox.denied`，工具也就不会提供 `sandbox_permissions` 升权。

## Decision

加载 Win32 绑定时调用 `SetErrorMode`，标志为 `SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX`。这是子进程会继承的进程错误模式（`SetThreadErrorMode` 不会传播）。受限孙进程随后以该 NTSTATUS 码安静退出。

windows-acl 包装通过 `ConfinedArgv.denialExitCodes` 携带这些 NTSTATUS 值。`classifyDenial` / `matchesSignature` 用 `exitCode >>> 0` 比较，因此无符号的 `0xC0000142` 与 Node 有符号形式 `-1073741502` 都算沙箱拒绝。工具层随后渲染已有的 `[sandbox: file access denied …]` 标记，以及同一轮次的 `sandbox_permissions` 审批路径。其他后端省略该字段；空 stderr 加退出码 1 仍然不是拒绝。

[Windows ACL 沙箱 note](../feature/2026-08-08-windows-acl-restricted-token-sandbox.md) 仍负责令牌机制以及 `CREATE_NO_WINDOW` 不可用的原因；本 note 只负责静默退出加分类器这条路径。

## Alternatives considered

**保留 Windows 对话框，让用户点确定。** 对话框会挡住桌面窗口，不含 harness 的权限词汇，也永远到不了模型可见的拒绝标记。

**把所有非零且 stderr 为空的退出都当成拒绝。** 普通命令失败（非仓库里的 `git status`、`python -c` 语法错误）会看起来像沙箱拦截，并触发错误的升权提示。

**改用 `SetThreadErrorMode` 或 `CREATE_NO_WINDOW`。** 线程局部错误模式不会传播到 `CreateProcess` 子进程。在此令牌下使用 `CREATE_NO_WINDOW` 正是已记录的 `STATUS_DLL_INIT_FAILED` 路径。

## Consequences

操作者不会再为这类启动失败看到 Application Error 框。模型会看到沙箱拒绝，并可能用 `sandbox_permissions` 重试一次（仍须用户批准）。不在所列 NTSTATUS 中的真实崩溃仍按普通退出报告。Microsoft Store 的 python App Execution Alias 对话框是另一套 OS UI，不属于这条 `SetErrorMode` 路径。

## Testing

`classifyDenial` 覆盖空 stderr 下无符号与有符号的 `0xC0000142`。windows-acl confine 测试把 `denialExitCodes` 钉为 `[0xC0000142, 0xC0000022]`。`SILENT_HARD_ERROR_MODE` 是三标志掩码 `0x8003`。端到端对话框抑制依赖 Windows 的 `SetErrorMode` 约定与现有 ACL runner 套件；CI 无法点击消息框。
