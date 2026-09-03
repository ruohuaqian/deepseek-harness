# Agent Note: pwsh commands use EncodedCommand so nested quotes stay data

Status: implemented

English | [中文](2026-08-21-pwsh-encoded-command.zh.md)

## Problem

Windows compositions run the model-facing `pwsh` tool through `pwsh -Command` with the UTF-8 output preamble concatenated onto the model string. That string then travels through two quote parsers: CreateProcess / `CommandLineToArgvW` (the Windows ACL runner rebuilds one command line from argv) and PowerShell's own `-Command` tokenizer. Nested double quotes, `git commit -m "…"`, and `python -c "…"` therefore fail as `ParserError` even when the argv vector is well-formed. Models also emit POSIX heredocs (`cat <<EOF`) because that is the bash-tool recipe; those are PowerShell syntax errors, not quoting bugs.

## Decision

`PwshLocalExecutor.argv()` passes `pwsh -NoLogo -NoProfile -NonInteractive -EncodedCommand` with UTF-16LE base64 of the preamble plus the model command. The encoded payload contains no quote characters, so neither CreateProcess quoting nor the `-Command` tokenizer can retokenize the script. The same preamble sets `$ProgressPreference = 'SilentlyContinue'` so EncodedCommand does not emit CLIXML progress records on stderr. PowerShell still parses the decoded text, so a bash heredoc remains a command failure. The `pwsh` tool description tells the model to write PowerShell, not bash, and that here-strings (`@'...'@`) round-trip as data. The [pwsh executor and tool note](../feature/2026-08-01-pwsh-tool-and-executor.md) still owns the seam and tool surface.

## Alternatives considered

**Keep `-Command` as one argv element and teach quoting in the prompt.** The prompt cannot stop CreateProcess from wrapping a space-bearing `-Command` value in double quotes; an inner `"…"` still terminates that wrap at the runner. Encoding removes the wrap from the script.

**Write a temp `.ps1` and spawn `-File`.** Works, but read-only sandbox has no private temp grant, so the file would have to live in the workspace or fail. EncodedCommand needs no extra file.

**Translate bash to PowerShell in the executor.** Rejected by the executor note: the model-visible contract is the dialect. Encoding does not translate; the description still forbids POSIX heredoc.

## Consequences

Nested quotes in a legal PowerShell command round-trip through the confined Windows runner. A bash heredoc or `bash -c` still fails as PowerShell syntax; the tool description is the coverage for that path. Encoded payloads are longer than the source text (UTF-16LE then base64); ordinary tool commands stay under the Windows command-line length limit.

## Testing

`pwsh-local` asserts argv is `-EncodedCommand` whose decoded UTF-16LE equals the preamble plus command, and a real pwsh run round-trips nested quotes and a here-string. `tool-pwsh` asserts the description names POSIX heredoc and here-strings. The pwsh-tool-turn snapshot pins the schema paragraph.
