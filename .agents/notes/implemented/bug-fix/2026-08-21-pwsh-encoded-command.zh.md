# Agent Note: pwsh commands use EncodedCommand so nested quotes stay data

Status: implemented

[English](2026-08-21-pwsh-encoded-command.md) | 中文

## Problem

Windows 组合把面向模型的 `pwsh` 工具经 `pwsh -Command` 运行，并把 UTF-8 输出 preamble 拼到模型字符串前面。该字符串随后穿过两层引号解析：CreateProcess / `CommandLineToArgvW`（Windows ACL runner 会从 argv 重建一条命令行）以及 PowerShell 自己的 `-Command` 分词器。因此嵌套双引号、`git commit -m "…"`、`python -c "…"` 即使 argv 向量本身正确，仍会以 `ParserError` 失败。模型还会写出 POSIX heredoc（`cat <<EOF`），因为那是 bash 工具的写法；那些是 PowerShell 语法错误，不是引号缺陷。

## Decision

`PwshLocalExecutor.argv()` 传入 `pwsh -NoLogo -NoProfile -NonInteractive -EncodedCommand`，负载是 preamble 加模型命令的 UTF-16LE base64。编码后的负载不含引号字符，因此 CreateProcess 的引号处理与 `-Command` 分词器都无法再次切分脚本。同一 preamble 设置 `$ProgressPreference = 'SilentlyContinue'`，以免 EncodedCommand 把 CLIXML 进度记录写到 stderr。PowerShell 仍会解析解码后的文本，所以 bash heredoc 仍然是命令失败。`pwsh` 工具描述要求模型写 PowerShell 而不是 bash，并说明 here-string（`@'...'@`）作为数据往返。[pwsh 执行器与工具说明](../feature/2026-08-01-pwsh-tool-and-executor.zh.md) 仍拥有该 seam 与工具面。

## 考虑过的替代方案

**继续把 `-Command` 作为单个 argv 元素，只在提示词里教引号。** 提示词无法阻止 CreateProcess 给带空格的 `-Command` 值加双引号；内部的 `"…"` 仍会在 runner 处截断该包裹。编码把脚本从这层包裹里拿出来。

**写临时 `.ps1` 再用 `-File` spawn。** 可行，但 read-only 沙箱没有私有临时目录授权，文件只能落在工作区或失败。EncodedCommand 不需要额外文件。

**在执行器里把 bash 翻译成 PowerShell。** 执行器说明已否决：模型可见约定就是方言。编码不做翻译；描述仍然禁止 POSIX heredoc。

## 后果

合法 PowerShell 命令中的嵌套引号可以穿过受隔离的 Windows runner 往返。bash heredoc 或 `bash -c` 仍会作为 PowerShell 语法失败；该路径由工具描述覆盖。编码负载长于源文本（先 UTF-16LE 再 base64）；普通工具命令仍低于 Windows 命令行长度上限。

## 测试

`pwsh-local` 断言 argv 为 `-EncodedCommand`，其解码后的 UTF-16LE 等于 preamble 加命令，并且真实 pwsh 运行能往返嵌套引号与 here-string。`tool-pwsh` 断言描述点名 POSIX heredoc 与 here-string。pwsh-tool-turn 快照钉住该 schema 段。
