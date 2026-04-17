# Changelog

## v2.0.1 — 2026-04-17

Bug fixes and shell-safety hardening. Fully backward-compatible with v2.0.0 — existing installs upgrade cleanly with no cron edits or migration.

### Fixes

- **Duplicate report cascade** — `aristotle report --send` no longer forces an auto-audit chain when the operator wants a single send. Parent schedulers can now centrally gate sends via `ARISTOTLE_SUPPRESS_SEND=1` env var or `--no-send` CLI flag, covering all three send commands (`report`, `audit-report`, `pending-report`) and the internal auto-audit chain. Previously, three different crons calling `aristotle report --send` produced six Telegram messages per night (three × QC + Memory Audit pair) with no way to disable the chain.
- **Fresh install QC template** — `qcCronPrompt()` in `src/templates.ts` no longer instructs the LLM to run `aristotle report --send` itself. Sending is now the exclusive responsibility of the separate `aristotle-qc-report` cron at 11:20 PM. This prevents fresh installs from reproducing the duplicate-report cascade. Existing installs are unchanged (OpenClaw freezes cron prompts at `cron add` time).
- **Shell injection closed** — all 14 `execSync` call sites that built `openclaw message send ...` and `openclaw cron add ...` shell strings have been converted to `spawnSync` with `{ shell: false }` and arguments as an array. The previous `"${x.replace(/"/g, '\\"')}"` pattern escaped only double-quotes, leaving `$(...)`, backticks, and `\` interpretable by the shell. Internally-generated content is safe today, but any future feature that includes filenames, git output, or user input in a report would have been an RCE vector.
- **Corrupt-file recovery** — `PendingChanges.read()` and `AuditLog.recent()` now rename unreadable JSON/JSONL files to `<name>.corrupt-<ISO-timestamp>` and log an error instead of silently returning empty arrays. Previously, a single corrupt byte in `pending-changes.json` erased the visible list of all pending boot-file approvals with no warning. `AuditLog.archive()` also logs failures instead of returning 0 silently.
- **Subprocess cleanup** — replaced `execSync('sleep 5')` (spawns a full shell + sleep process) with `await new Promise(r => setTimeout(r, 5000))`. Minor, but removes a subprocess cost per `report --send`.

### New

- `ARISTOTLE_SUPPRESS_SEND=1` environment variable — suppresses all `--send` operations including the internal auto-audit chain. Intended for cron/CI/parent-orchestrator use when the caller wants to control sending centrally.
- `--no-send` CLI flag — equivalent to the env var, for one-off use.

### Behavior changes

None for existing users. The default behavior of `aristotle report --send` is identical to v2.0.0 when neither the env var nor the flag is set: QC report sends, five seconds elapse, audit report sends.

### Upgrading

`npm update -g aristotle`. No other steps. Existing cron jobs and their prompts are unchanged.

### Rollback

`npm install -g aristotle@2.0.0`. Data files (`policy.json`, `pending-changes.json`, `audit.jsonl`) are forward-and-backward compatible.

---

## v2.0.0 — 2026-03-28

Complete memory protection platform for OpenClaw agents.

### Components
- **Guard** — 10 deterministic rules block memory corruption via `before_tool_call` hook
- **Context Shield** — 3-tier context monitoring (ContextEngine → JSONL → counting) with proactive compaction
- **QC Nightly** — 11 automated memory integrity checks in isolated session
- **QC Mid-Session** — 2 lightweight checks every 50 tool calls

### Guard Rules (10)
- 4 hard gates: protected file writes, gateway stop, credential CLI args, destructive commands
- 5 validators: daily log edit tool, credential content, QC log filename, memory overwrite prevention, sub-agent context enforcement
- 1 soft warning: AGENTS.md size approaching limit

### CLI
- `aristotle init` — Setup wizard with auto-detection, deploys complete workspace architecture
- `aristotle doctor` — 17-point health check with `--fix` auto-repair
- `aristotle status` — Current policy and recent activity
- `aristotle audit` — Decision history viewer
- `aristotle report` — Code-based branded QC report generator
- `aristotle report --send` — Generate and deliver report to Telegram
- `aristotle version` — Version display

### Init deploys
- QC agent protocol file (11 checks, fixed template instructions)
- QC report template (⟁ branded, 30 sign-off phrases, plain English translations)
- Aristotle QC nightly cron job (11:15 PM, no delivery)
- QC report delivery cron job (11:20 PM, code-formatted)
- Continuity nightly cron job (10:45 PM, multi-day task context)
- Pre-reset checkpoint cron job (3:30 AM, saves context before daily reset)
- File permissions (chmod 444 on 7 bootstrap files)
- 7 OpenClaw memory settings (reserveTokensFloor, memoryFlush, contextPruning, memorySearch)
- .gitignore entries
- All required workspace directories including memory/continuity/

### Doctor checks (17)
1. Policy file exists
2. Data directory exists
3. Workspace accessible + subdirectories
4. File permissions (chmod 444)
5. Audit log health
6. Telegram configuration
7. Plugin conflicts (ClawBands)
8. QC agent protocol deployed
9. QC report template deployed
10. QC cron jobs present
11. Guard registration active
12. Plugin install provenance verified
13. Bootstrap file truncation detection
14. Continuity file freshness
15. Pre-reset checkpoint verification
16. Weekly hygiene status
17. QC delivery health

### Nightly schedule
- 3:30 AM — Pre-reset checkpoint (saves unsaved context before 4 AM reset)
- 10:45 PM — Continuity update (multi-day task context files)
- 11:15 PM — Aristotle QC agent (11 memory integrity checks)
- 11:20 PM — Report delivery (code-formatted branded report to Telegram)

### Branding
- ⟁ symbol on all user-facing touchpoints
- MEMORY HEALTH progress bar in reports
- 30 rotating sign-off phrases (clean/handled/user-needed)
- Plain English translations for all technical terms

### Reliability
- 90-92% combined memory protection (Guard + Context Shield + QC)
- 3 behaviors remain prompt-dependent (irreducible with current LLMs)
- Honest limitations disclosed in README

### Critical install note
Must use `openclaw plugins install --link ~/aristotle` — never `plugins.load.paths`. The `--link` method creates install provenance required for hook dispatch. `aristotle doctor` verifies this automatically.
