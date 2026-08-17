# Agent Note: Silent Windows sandbox start failures

Status: implemented

English | [中文](2026-08-17-windows-sandbox-silent-start-failure.zh.md)

## Problem

Under the Windows ACL restricted token, workspace commands that spawn `git.exe` or `python.exe` often die during DLL initialization with `STATUS_DLL_INIT_FAILED` (`0xC0000142`) or `STATUS_ACCESS_DENIED` (`0xC0000022`). Windows then shows a blocking Application Error dialog. The process has already failed; the dialog is not a permission prompt, and stderr is usually empty, so the bash/pwsh sandbox classifier never sets `sandbox.denied` and the tool never offers `sandbox_permissions` escalation.

## Decision

Loading the Win32 bindings calls `SetErrorMode` with `SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX`. That is the process error mode children inherit (unlike `SetThreadErrorMode`). Confined grandchildren then exit quietly with the NTSTATUS code.

`ConfinedArgv.denialExitCodes` carries those NTSTATUS values for the windows-acl wrap. `classifyDenial` / `matchesSignature` compare `exitCode >>> 0` against them, so both the unsigned `0xC0000142` and the signed Node form `-1073741502` count as a sandbox denial. The tool layer then renders the existing `[sandbox: file access denied …]` marker and the same-turn `sandbox_permissions` approval path. Other backends omit the field; empty stderr plus exit 1 is still not a denial.

The [Windows ACL sandbox note](../feature/2026-08-08-windows-acl-restricted-token-sandbox.md) still owns the token mechanism and the reason `CREATE_NO_WINDOW` is unusable; this note owns only the silent-exit plus classifier path.

## Alternatives considered

**Keep the Windows dialog and tell the user to click OK.** The dialog blocks the desktop window, carries no harness permission vocabulary, and never reaches the model-visible denial marker.

**Treat every nonzero empty-stderr exit as a denial.** Ordinary command failures (`git status` in a non-repo, `python -c` syntax errors) would look like sandbox blocks and trigger false escalation prompts.

**Use `SetThreadErrorMode` or `CREATE_NO_WINDOW`.** Thread-local error mode does not propagate to `CreateProcess` children. `CREATE_NO_WINDOW` under this token is the documented `STATUS_DLL_INIT_FAILED` path.

## Consequences

Operators see no Application Error box for these start failures. The model sees a sandbox denial and may retry once with `sandbox_permissions` (user approval still required). A real crash that is not one of the listed NTSTATUS codes still reports as an ordinary exit. Microsoft Store python App Execution Alias dialogs are a different OS UI and are not this `SetErrorMode` path.

## Testing

`classifyDenial` covers unsigned and signed `0xC0000142` with empty stderr. The windows-acl confine tests pin `denialExitCodes` to `[0xC0000142, 0xC0000022]`. `SILENT_HARD_ERROR_MODE` is the three-flag mask `0x8003`. End-to-end dialog suppression is the Windows `SetErrorMode` contract plus the existing ACL runner suite; CI cannot click a message box.
