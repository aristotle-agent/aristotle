# Upgrading to Aristotle v2.0.1

**TL;DR:** `npm update -g aristotle`. No other steps. No behavior changes for existing users.

## What's different

v2.0.1 is a bug-fix and shell-safety release. It is fully backward-compatible with v2.0.0.

### The duplicate-report bug, fixed

If you ever noticed Aristotle sending multiple copies of the same nightly Memory Health + Memory Audit report (especially if you had more than one "QC" cron scheduled around 11 PM), that was a v2.0.0 bug. `aristotle report --send` had no way to be suppressed by a parent scheduler, and it automatically fired `aristotle audit-report --send` five seconds later. Three crons calling it → six messages.

v2.0.1 adds two opt-in controls:

1. **`ARISTOTLE_SUPPRESS_SEND=1` environment variable** — any `aristotle report|audit-report|pending-report --send` invocation under this env var exits without sending. Use this in the crons you want silenced.
2. **`--no-send` CLI flag** — same effect, for one-off use.

Default behavior is unchanged. If you run `aristotle report --send` with neither the env var nor the flag, you get the same two messages (QC + audit) v2.0.0 sent.

### The shell-safety hardening, invisible

Pre-v2.0.1, Aristotle built shell command strings like `openclaw message send --message "..."` with a hand-rolled escape that only handled double-quotes. Characters like `$`, backticks, and `\` were still shell-interpretable. Internally-generated content was safe, but any future feature that included a filename, git output, or user input in a report would have been an RCE vector.

v2.0.1 passes arguments as arrays to `spawnSync` with `{ shell: false }`. Node handles arg escaping natively. Safer, simpler, invisible to users.

### Corrupt-file recovery

If `pending-changes.json` or `audit.jsonl` ever becomes unreadable (disk corruption, truncation, encoding issue), v2.0.0 silently returned an empty array. You lost visibility into your pending approvals with no warning.

v2.0.1 renames the corrupt file to `<name>.corrupt-<ISO-timestamp>` and logs an error. You can inspect the preserved file or delete it.

### Fresh-install template fix

If you run `aristotle init` on v2.0.1+, the generated nightly QC cron (`aristotle-qc-nightly`) no longer tells the LLM to run `aristotle report --send` itself. Sending is handled by the separate `aristotle-qc-report` cron at 11:20 PM. This prevents fresh installs from reproducing the duplicate-report cascade.

**Existing installs are unchanged.** OpenClaw freezes cron prompts at `cron add` time, so your existing QC cron keeps its old prompt. If you want the new behavior on an existing install, edit the cron manually or delete it and re-run `aristotle init`.

## Rollback

If anything breaks:

```bash
npm install -g aristotle@2.0.0
```

All data files (`policy.json`, `pending-changes.json`, `audit.jsonl`) are forward-and-backward compatible. No state migration needed.

## Questions

File an issue at https://github.com/aristotle-agent/aristotle/issues.
