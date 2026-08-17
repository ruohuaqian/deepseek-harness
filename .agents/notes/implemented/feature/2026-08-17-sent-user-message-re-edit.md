# Agent Note: Re-edit a sent user message by forking before its turn

Status: implemented

English | [中文](2026-08-17-sent-user-message-re-edit.zh.md)

## Problem

A settled user bubble could not be corrected. The edit control was removed because it was a dead stub, and the branch control was removed from user bubbles because a fork at the message seq includes the answer — the opposite of re-asking from one's own prompt. Users who mistyped a command, or who wanted to retry after tools had already run, had no honest path that named the rollback. Leaving the source listed as a sibling titled `(1)` reads as a new conversation, which is not how re-edit is used.

## Decision

Edit returns on settled `user` bubbles only (not pending or consumed steering). Clicking it opens an in-page confirmation that the current conversation rewinds to before this message, that this message and what followed leave the current listing, and that filesystem or environment side effects are not undone. Confirming calls Host `session.fork` with `cut: 'before-turn'` and the user-message `atSeq`, which ends the child seed immediately before that turn's `turn/start` — including while the turn is still open on the source. The client then opens the child under the source title in the source's workspace slot, prefills the composer with the original text, cancels a running source turn, and archives the source so the sidebar still shows one conversation. The session log stays append-only; archive hides the source without truncating it.

An empty prior prefix is a legal child (first-prompt re-edit). Image attachments on the original message are not copied into the composer. Assistant-answer Branch still increments a sibling title and leaves the source listed.

## Alternatives considered

**Mutate the settled user message in place.** The session log is append-only; rewriting a consumed prompt would desynchronize the model transcript from the durable events and from any tool work the turn already performed.

**Leave the source listed and increment `(1)`.** That is the Branch gesture. On Edit it presents a second conversation instead of covering the current one.

**Wire Edit to the queue editor.** The queue edits unsent items. A settled user message is already in the transcript and in the model's context.

**Auto-send the edited text after the fork.** Prefill without sending keeps the correction visible and lets the user change more than the original typo before starting a new turn.

**Keep the source turn running after confirm.** The abandoned turn would keep consuming the model and tools behind an archived row. Cancel stops that work; filesystem or environment side effects already performed are still not rolled back.

**Require a risk-acknowledgement checkbox.** Full access uses that gate because it expands privilege. This confirmation is about conversation lineage, not a new capability grant.

## Consequences

Web can correct a sent prompt without adding a sidebar sibling. Branch under assistant answers is unchanged (inclusive-turn cut, incremented title, source kept). Package tests pin the confirm dialog, the before-turn Host cut (including an open turn and an empty first-prompt seed), composer prefill, and that Edit does not pass `increaseTitle`; the message-actions web aria golden includes the Edit control on user bubbles.
