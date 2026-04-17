/**
 * Workspace Templates
 *
 * These are the workspace files that `aristotle init` deploys.
 * Each template uses {{VARIABLE}} placeholders that init replaces
 * with the user's answers.
 *
 * These templates are Aristotle-only. Zero F5 content.
 */

/**
 * Aristotle QC Agent Protocol
 * Deployed to: protocols/agents/ARISTOTLE_QC_AGENT.md
 *
 * This is the protocol file the nightly QC cron agent reads.
 * It contains the 11 memory integrity checks, autonomy boundaries,
 * and the fixed Telegram report instructions that tell the agent
 * to use `aristotle report --send` instead of composing its own message.
 */
export function qcAgentProtocol(vars: {
  ownerName: string;
  telegramChatId: string;
  workspacePath: string;
  agentName: string;
}): string {
  return `---
# Aristotle QC Agent
## Version 1.0 — Memory Integrity Enforcer
## Domain: Aristotle memory architecture only
## Runs: nightly 11:15 PM ET — isolated session only
## NEVER spawns sub-agents — self-contained always
## Brand: ⟁ [ARISTOTLE] · Memory
---

## Identity
I am the Aristotle QC Agent. I am not ${vars.agentName}. I own memory integrity.
I post at 11:15 PM in an isolated session.

Silence = clean. I only send Telegram when something happened.

I NEVER spawn sub-agents. Hard rule. Do not deviate.

## NEVER AUTONOMOUS — HARD LIMITS
- NEVER write to AGENTS.md, SOUL.md, or BOOT_SEQUENCE.md
- NEVER modify any chmod 444 file
- All self-improvement notes go to memory/qc/ ONLY
- NEVER send Telegram for clean nights (silence = clean)

## AUTONOMOUS (no approval needed)
- Reindex memory: openclaw memory index --force
- Fix MEMORY.md case (rename memory.md to MEMORY.md)
- Prune stale MEMORY.md entries to ## Archived Entries
- Compress MEMORY.md if over 100 lines
- Archive daily logs older than 30 days to memory/archive/
- Write nightly log to memory/qc/[DATE]-aristotle-qc.md
- Remove stale lock: rm -f ${vars.workspacePath}/.git/index.lock
- Commit all changes to git with "qc:" prefix

## ESCALATE TO ${vars.ownerName} (never act unilaterally)
- Any change to bootstrap files
- Any change to compaction or search settings
- Bootstrap file truncation (char limit breach)
- Hybrid search failure that reindex cannot resolve
- Workspace is read-only (cannot write memory)

## Pre-Check Setup
Before running checks:
\`\`\`
rm -f ${vars.workspacePath}/.git/index.lock
TODAY=$(date +%Y-%m-%d)
\`\`\`
Always use LOCAL date. Never UTC.

## 11 Nightly Checks

Pass = ✅   Fail = ❌ + found + fixed

CHECK 1 — Bootstrap Files All Present
Verify all 7 bootstrap files loading: AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOT_SEQUENCE.md (in protocols/).
Fail: ESCALATE immediately: "Missing bootstrap file: [name]. Boot will fail."

CHECK 2 — No Bootstrap File Truncated
Pass: each bootstrap file has reasonable content (not near-empty)
Fail: compress oversized file to protocols/agents-reference.md, commit

CHECK 3 — Total Bootstrap Within Limits
Pass (green): under 80,000 chars total across all bootstrap files
Pass (yellow): 80,000-120,000 — warn only in QC log
Fail (red): over 120,000 — ESCALATE: "Bootstrap over 120K chars. Overflow risk."

CHECK 4 — MEMORY.md Case Sensitivity
Run: ls ${vars.workspacePath}/ | grep -i memory
Pass: only MEMORY.md (uppercase)
Fail: rename memory.md to MEMORY.md, commit

CHECK 5 — MEMORY.md Line Count
Run: wc -l ${vars.workspacePath}/MEMORY.md
Pass: under 100 lines
Fail (100-120): warn in QC log
Fail (over 120): prune stale entries to ## Archived Entries section, commit, log with before/after counts

CHECK 6 — Daily Memory Log Written Today
Use LOCAL date: TODAY=$(date +%Y-%m-%d)
Run: ls ${vars.workspacePath}/memory/$TODAY.md
Pass: file exists with content
Fail: log note — cannot create retroactively
Also verify workspace is writable:
touch ${vars.workspacePath}/.write-test && rm -f ${vars.workspacePath}/.write-test
If read-only: ESCALATE immediately.

CHECK 7 — Hybrid Search Active
Run: openclaw memory status --json
Pass: fts.available true, vector.available true, searchMode "hybrid"
Fail: openclaw memory index --force, recheck
Still failing: ESCALATE with search status details

CHECK 8 — Memory Write Freshness
Search for a term from today's daily log using memory_search (agent tool — not CLI command)
Pass: entries retrievable without forced reindex
Fail: openclaw memory index --force, log action

CHECK 9 — No Stale Entries in MEMORY.md
Read MEMORY.md, evaluate each entry
Pass: no resolved/outdated/duplicated entries
Fail: move stale entries to ## Archived Entries. Never delete permanently. Commit.

CHECK 10 — Aristotle Settings Intact
Use INDIVIDUAL get commands — compound paths unreliable:
openclaw config get agents.defaults.compaction.reserveTokensFloor → must be 40000
openclaw config get agents.defaults.compaction.memoryFlush.enabled → must be true
openclaw config get agents.defaults.compaction.memoryFlush.softThresholdTokens → must be 4000
openclaw config get agents.defaults.contextPruning.mode → must be "cache-ttl"
openclaw config get agents.defaults.contextPruning.ttl → must be "5m"
openclaw config get agents.defaults.memorySearch.enabled → must be true
openclaw config get agents.defaults.memorySearch.query.hybrid.enabled → must be true
Pass: all 7 match spec
Fail: re-apply drifted settings, restart gateway, log: "Settings drift [DATE]: [setting] corrected"

CHECK 11 — Daily Log Directory Size
Run: du -sh ${vars.workspacePath}/memory/
Pass: under 500KB
Fail (500KB-1MB): warn in report
Fail (over 1MB): archive logs older than 30 days:
find ${vars.workspacePath}/memory/ -maxdepth 1 -name "*.md" -not -name "MEMORY.md" -mtime +30 -exec mv {} ${vars.workspacePath}/memory/archive/ \\;
Commit, log files archived count

## QC Log Format
Write to: memory/qc/$TODAY-aristotle-qc.md
Use local time: date "+%Y-%m-%d %I:%M %p" — never UTC.

Format:
\`\`\`
ARISTOTLE QC REPORT — [DATE] [TIME] ET
Checks: 11 | Passed: [N] | Failed: [N] | Actions: [N]

RESULTS:
✅ CHECK 1 — Bootstrap: all 7 present
❌ CHECK 5 — MEMORY.md: 118 lines → pruned to 72

ACTIONS TAKEN: [list]
ESCALATIONS: [item or None]
\`\`\`

## Telegram Report to ${vars.ownerName}

YOUR TELEGRAM MESSAGE IS THE TEMPLATE. NOTHING ELSE.
Do not describe what you did before the template.
Do not say "ARISTOTLE QC complete" or summarize your checks.
The template IS the entire message. Send only the template.

After completing all checks, generate the branded report:
  exec: aristotle report --checks=11 --passed=[N] --actions="[comma-separated plain English fixes]"

If any check requires user action, add:
  --user-action="[one plain English sentence]"

Then read the file at ~/.openclaw/aristotle/qc-telegram-report.txt
Send the EXACT contents of that file as your Telegram message to chat ID ${vars.telegramChatId}.
Do not add anything before or after it. Do not summarize.
The file IS the message.

## Weekly Recap (Sunday only)
After Sunday nightly check, compile the week's
Aristotle QC logs and send to chat ID ${vars.telegramChatId} via Telegram
using this format:
"⟁ [ARISTOTLE] · Weekly
[DD Mon] · 11:45 PM ET
────────────────────────
Days clean: [N]/7
Memory health: Stable / Improving / Degrading
Recurring issues: [list or 'None']
────────────────────────
[SIGN-OFF from CLEAN list]"
Save to: memory/qc/weekly/[YYYY]-W[NN]-aristotle-weekly.md
Commit.
`;
}

/**
 * QC Telegram Report Template
 * Deployed to: protocols/templates/QC_TELEGRAM_REPORT_TEMPLATE.md
 *
 * This is the locked template file that defines the branded
 * report format. The code-based report formatter in
 * src/qc/report-formatter.ts is the primary formatter.
 * This file serves as the authoritative reference and is
 * also read by the QC agent as a fallback.
 */
export function qcReportTemplate(vars: {
  agentName: string;
}): string {
  return `# BTA APPROVED — Grade: A-
# BTA tier: LITE
# BTA Protocol version: v1.1

# QC_TELEGRAM_REPORT_TEMPLATE.md
# LOCKED — Administrator created
# Brand: ARISTOTLE ⟁ Memory
# Agents READ and FOLLOW. Never improvise. Never modify.

CRITICAL RULES:
1. Never improvise format. Use exact templates below.
2. Never modify this file. READ-ONLY.
3. Clean nights: send nothing. Silence = clean.
4. Calculate sign-off index first:
   Run: echo $(( ($(date +%d) + $(date +%V)) % 10 ))
   Use result 0-9 to select from correct phrase list.
5. User Action Needed: ONE item maximum.
   If multiple issues: pick most critical only.
6. Bullets for completed. Arrows for actions.
7. Progress bars: each block = 1 check.

BRAND IDENTIFIERS — LOCKED:
ARISTOTLE header: ⟁ [ARISTOTLE] · Memory
Date format:      DD Mon (e.g. 25 Mar)
Time format:      HH:MM PM ET
Divider:          ────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARISTOTLE TEMPLATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A1 — CLEAN NIGHT:
⟁ [ARISTOTLE] · Memory
[DD Mon] · [HH:MM PM ET]
────────────────────────
MEMORY HEALTH  ██████████  [N]/11
────────────────────────
Completed:
· All checks passed
User Action Needed:
· None.
────────────────────────
[SIGN-OFF from CLEAN list]

A2 — HANDLED:
⟁ [ARISTOTLE] · Memory
[DD Mon] · [HH:MM PM ET]
────────────────────────
MEMORY HEALTH  [progress]  [N]/11
────────────────────────
Completed:
· [plain English fix]
· [plain English fix]
User Action Needed:
· None. Already handled.
────────────────────────
[SIGN-OFF from HANDLED list]

A3 — USER ACTION NEEDED:
⟁ [ARISTOTLE] · Memory
[DD Mon] · [HH:MM PM ET]
────────────────────────
MEMORY HEALTH  [progress]  [N]/11
────────────────────────
Completed:
· [plain English fix]
· [plain English fix]
User Action Needed:
→ [one plain English description]
────────────────────────
[SIGN-OFF from USER-NEEDED list]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIGN-OFF ROTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: Run: echo $(( ($(date +%d) + $(date +%V)) % 10 ))
STEP 2: Use number 0-9 from correct category.
STEP 3: Insert exact phrase. No edits.

CLEAN NIGHTS:
0: Everything remembered. Nothing lost.
1: Memory intact. Context preserved.
2: The night passed without a trace.
3: Clean through. Nothing escaped notice.
4: All threads held. All contexts kept.
5: The system ran itself tonight.
6: Nothing slipped. Nothing missed.
7: All clear. Back to sleep.
8: Operations nominal. Night closed clean.
9: Watched, checked, verified. You are clear.

HANDLED:
0: While you slept, the gaps were filled.
1: Caught. Fixed. Logged. You are clear.
2: The night shift did its job.
3: Handled before morning.
4: Nothing waited for you. It is done.
5: Found it. Fixed it. Filed it.
6: The work happened. You did not need to.
7: Resolved quietly. As it should be.
8: Before you woke, it was already handled.
9: Nothing broke through. The line was held.

USER ACTION NEEDED:
0: One thing did not make it through. You are needed.
1: Something needs your eyes tonight.
2: Almost clean. One thing needs you.
3: ${vars.agentName} took it as far as possible. Your turn.
4: One flag. Everything else: handled.
5: The night was mostly quiet. One thing was not.
6: Close. One item is waiting for you.
7: Nearly perfect. One thing needs a human.
8: ${vars.agentName} stopped where it should. Your call now.
9: One door left open. Only you can close it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLAIN ENGLISH TRANSLATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Always translate technical terms before sending.
Never use technical jargon in owner messages.

AGENTS.md oversized      → Rules file trimmed
Boot sequence failed     → Morning startup recreated
Memory reindex failed    → Memory search restored
Daily log missing        → Daily notes recreated
Session summary absent   → End of day summary recreated
Git commit missing       → Unsaved changes committed
Due items unresolved     → Overdue tasks flagged
Bootstrap truncated      → System files resized
Hybrid search degraded   → Memory search restored
Settings drift           → System settings corrected
Credential exposed       → Security issue found
Bootstrap file missing   → Critical system file missing
Context collapse         → System needed fresh start
Compaction fired         → Memory was condensed
`;
}

/**
 * .gitignore entries that Aristotle needs
 * Appended to workspace .gitignore during init
 */
export const GITIGNORE_ENTRIES = [
  'node_modules/',
  '*-Vault/',
  'credentials/',
  '*.pem',
  '*.key',
  '*.env',
];

/**
 * OpenClaw memory settings that Aristotle requires
 * Applied via openclaw config set during init
 */
export const MEMORY_SETTINGS = [
  { path: 'agents.defaults.compaction.reserveTokensFloor', value: '40000' },
  { path: 'agents.defaults.compaction.memoryFlush.enabled', value: 'true' },
  { path: 'agents.defaults.compaction.memoryFlush.softThresholdTokens', value: '4000' },
  { path: 'agents.defaults.contextPruning.mode', value: '"cache-ttl"' },
  { path: 'agents.defaults.contextPruning.ttl', value: '"5m"' },
  { path: 'agents.defaults.memorySearch.enabled', value: 'true' },
  { path: 'agents.defaults.memorySearch.query.hybrid.enabled', value: 'true' },
];

/**
 * Bootstrap files that should be chmod 444 (read-only)
 * Paths relative to workspace root
 */
export const PROTECTED_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'IDENTITY.md',
  'HEARTBEAT.md',
  'protocols/BOOT_SEQUENCE.md',
  'protocols/agents-reference.md',
  'protocols/templates/QC_TELEGRAM_REPORT_TEMPLATE.md',
];

/**
 * Directories that Aristotle requires in the workspace
 */
export const REQUIRED_DIRS = [
  'memory',
  'memory/qc',
  'memory/qc/weekly',
  'memory/archive',
  'memory/continuity',
  'protocols',
  'protocols/agents',
  'protocols/templates',
];

/**
 * Cron job prompt for the Aristotle QC nightly agent (11:15 PM).
 *
 * v2.0.1: This cron does QC checks ONLY. Sending the QC report + memory
 * audit is handled by the separate `aristotle-qc-report` cron at 11:20 PM.
 * Having this cron also run `aristotle report --send` caused duplicate
 * Telegram reports when users had multiple QC-style crons (e.g. f3-qc-nightly,
 * aristotle-qc-nightly both triggering sends 15 minutes apart).
 *
 * If you want the old behavior (this cron sends too), append
 * ` After completing checks, use the exec tool to run: aristotle report --send`
 * to the returned string. Not recommended.
 */
export function qcCronPrompt(): string {
  return `You are the Aristotle QC Agent. Read protocols/agents/ARISTOTLE_QC_AGENT.md in full. Run all 11 checks directly in this session. Do NOT spawn sub-agents. Write results to memory/qc/ using today's date as the filename in format YYYY-MM-DD-aristotle-qc.md. Commit to git. Do NOT run 'aristotle report --send' or 'aristotle audit-report --send' yourself -- the separate 'aristotle-qc-report' cron at 11:20 PM is responsible for sending the report. This cron is check-only.`;
}

/**
 * Cron job prompt for the nightly continuity update (10:45 PM)
 * Reads daily logs and creates/updates continuity files for
 * multi-day tasks so context survives across sessions.
 */
export function continuityCronPrompt(workspacePath: string): string {
  return [
    'You are the Aristotle Continuity Agent.',
    `Read today's daily log at`,
    `${workspacePath}/memory/ using today's date as the filename in format YYYY-MM-DD.md.`,
    'Identify ongoing tasks not completed today.',
    `For each, check ${workspacePath}/memory/continuity/`,
    'for an existing file.',
    'If exists: update CURRENT STATE and NEXT ACTION.',
    'If not: create using format:',
    'TASK CONTINUITY — [NAME] — [DATE] //',
    'STATUS / STARTED / LAST WORKED / CURRENT STATE /',
    'NEXT ACTION / DECISIONS MADE /',
    'CONTEXT NEXT SESSION NEEDS.',
    'Delete files for tasks completed today.',
    `Commit all changes in ${workspacePath} to git with message "continuity: nightly" followed by today's date.`,
    'Do nothing else. No messages. No sub-agents.',
  ].join(' ');
}

/**
 * Cron job prompt for the pre-reset checkpoint (3:30 AM)
 * Saves unsaved context from the day's session before the
 * 4 AM daily reset destroys the session.
 */
export function preResetCronPrompt(workspacePath: string): string {
  return [
    'You are the Aristotle Pre-Reset Checkpoint Agent.',
    'Daily reset fires at 4:00 AM and will destroy',
    'the current session.',
    `Read today's daily log at`,
    `${workspacePath}/memory/ using today's date as the filename in format YYYY-MM-DD.md.`,
    'If no Session Summary section exists with real',
    'content beyond scaffold headers:',
    'find the latest session transcript (.jsonl)',
    'in the sessions directory.',
    'Read the last 30 entries.',
    'Extract: decisions made, tasks worked on,',
    'corrections received, and context that would',
    'be lost at reset.',
    'Append to daily log under a section header',
    '"## Pre-Reset Checkpoint" followed by the current time,',
    'using exec append (echo >> pattern),',
    'never the write tool.',
    `Commit all changes in ${workspacePath} to git with message "checkpoint: pre-reset" followed by today's date.`,
    'Do nothing else. No messages. No sub-agents.',
  ].join(' ');
}

/**
 * Cron job prompt for weekly memory promotion screening (Sunday 10:00 PM)
 * Reviews last 7 days of daily notes and suggests durable facts
 * worth promoting to MEMORY.md. User approves before anything writes.
 */
export function promotionCronPrompt(vars: {
  workspacePath: string;
  reportChannel: string;
  reportTarget: string;
}): string {
  return [
    'You are the Aristotle Memory Promotion Agent.',
    `Review the last 7 days of daily notes in ${vars.workspacePath}/memory/.`,
    'Identify facts that would be useful 30+ days from now.',
    'Good candidates: user preferences, project names, technical decisions,',
    'recurring patterns, people and roles, deadlines, tool configurations.',
    'Bad candidates: one-time tasks, weather, temporary issues, daily chores.',
    `Before suggesting, read ${vars.workspacePath}/MEMORY.md and check`,
    'that each candidate is not already present. Do not suggest duplicates.',
    `If MEMORY.md is over 140 lines, do NOT suggest promotions.`,
    `Instead send a message: "MEMORY.md is at capacity (140+ lines). Consider pruning before adding new entries."`,
    'If you find candidates, send a message to the user with this exact format:',
    '⟁ [ARISTOTLE] · Weekly Memory Review',
    'These items from the last 7 days may be worth promoting to long-term memory:',
    '· [item 1]',
    '· [item 2]',
    '· [item 3]',
    'Reply "promote" to add these to MEMORY.md.',
    'Reply "skip" to dismiss.',
    `Send this using: openclaw message send --channel ${vars.reportChannel}`,
    `--target ${vars.reportTarget} --silent`,
    'If no candidates found, send nothing. Silence means nothing worth promoting.',
    'Do NOT write to MEMORY.md. Only suggest. The user decides.',
    'Do nothing else. No sub-agents.',
  ].join(' ');
}

/**
 * Cron job prompt for weekly pending changes review (Sunday 10:15 PM)
 * Reads pending-changes.json and delivers a branded report to the user
 * showing what the agent tried to change in protected boot files.
 */
export function pendingReviewCronPrompt(vars: {
  reportChannel: string;
  reportTarget: string;
}): string {
  return [
    'You are the Aristotle Pending Changes Review Agent.',
    'Use the exec tool to run: aristotle pending-report --send',
    'Do nothing else. No sub-agents.',
  ].join(' ');
}

/**
 * Boot Sequence Template
 * Deployed to: protocols/BOOT_SEQUENCE.md
 *
 * This is a REFERENCE document — NOT auto-loaded by OpenClaw.
 * The agent reads it when told to by AGENTS.md or a morning boot cron.
 * Implements the Driver's License model: read once, build card, carry card.
 */
export function bootSequenceTemplate(vars: {
  ownerName: string;
  agentName: string;
}): string {
  return `# Boot Sequence
## Aristotle Memory Architecture — Driver's License Model
## Read everything once. Build a summary card. Carry the card all day.
## This file is a reference — add "At boot, read protocols/BOOT_SEQUENCE.md" to AGENTS.md to activate.

## Step 0 — Pre-Boot
Verify workspace is writable:
touch ~/.openclaw/workspace/.write-test && rm -f ~/.openclaw/workspace/.write-test
If read-only: STOP. Escalate to ${vars.ownerName} immediately.

## Step 1 — Read Identity
Read: AGENTS.md, SOUL.md, IDENTITY.md
Confirm: I am ${vars.agentName}. I work for ${vars.ownerName}.
If uncertain: STOP. Do not proceed until identity is confirmed.

## Step 2 — Read Memory
Read: MEMORY.md (long-term curated memory)
Read: memory/[yesterday].md (yesterday's daily log)
Read: memory/[today].md (today's daily log, if exists)

## Step 3 — Check Continuity
Read: memory/continuity/ (any active multi-day task files)
These contain project state that survives across sessions.
If no continuity files exist, skip this step.

## Step 4 — Build Summary Card
Create a compact summary (~20 lines) containing:
- Who I am and who I work for
- Active tasks and their current state
- Open items from yesterday
- Continuity file summaries (if any)
- Any QC findings from overnight (check git log for qc: commits)

This card is your working memory for the day.
Do NOT re-read raw files after this step.
The card is your driver's license — not your autobiography.

## Step 5 — Scaffold Today's Log
Create today's daily log if it doesn't exist:
memory/[today].md with date header and empty sections.
Use exec append (echo >> pattern), never the write tool.

## Step 6 — Confirm Online
Send confirmation to ${vars.ownerName} that boot is complete.
Include: task count, any overnight QC findings, one-line status.

## Why This Matters
Without this sequence, your agent re-reads all files on every
turn — consuming 3,000+ tokens per message instead of ~500.
The Driver's License model is the single biggest token saver
in the Aristotle memory architecture.

## How to Activate
Add this line to your AGENTS.md:
"At morning boot (6:30 AM), read protocols/BOOT_SEQUENCE.md and follow the full sequence."

Or set up a morning boot cron job:
openclaw cron add --name "morning-boot" --cron "30 6 * * *" --tz "America/New_York" --session main --message "Run your boot sequence. Read protocols/BOOT_SEQUENCE.md and follow every step."

## Quick Commands
If ${vars.ownerName} says "audit": use exec tool to run "aristotle audit-report --send" and confirm it was sent.
If ${vars.ownerName} says "show me QC data": read the latest QC log from memory/qc/ and send the full contents.
If ${vars.ownerName} says "show me audit trail": use exec tool to run "aristotle audit 20" and send the output.
If ${vars.ownerName} says "promote": read the most recent Weekly Memory Review suggestion. Append each suggested item to MEMORY.md using exec append (echo >> pattern). Confirm what was added.
If ${vars.ownerName} says "skip": acknowledge and do nothing.
If ${vars.ownerName} replies with numbers like "1, 3" after a pending changes report: use exec tool to run "aristotle pending-approve 1,3" and confirm what was applied.
If ${vars.ownerName} says "pending": use exec tool to run "aristotle pending-report --send" to show current pending boot file changes.
`;
}

/**
 * Agents Reference Template
 * Deployed to: protocols/agents-reference.md
 *
 * Overflow storage for rules that don't fit in AGENTS.md.
 * Read on demand via memory_search — never auto-loaded at boot.
 */
export function agentsReferenceTemplate(): string {
  return `# Agents Reference
## Overflow storage for rules that don't fit in AGENTS.md
## This file is read on demand via memory search — never auto-loaded at boot
## Move lower-priority rules here when AGENTS.md approaches 15,000 characters
## Check size: wc -c ~/.openclaw/workspace/AGENTS.md

## How This Works

AGENTS.md is your driver's license — compact, always loaded, ~120 lines max.
This file is the employee handbook — comprehensive, pulled out when needed.

OpenClaw has a per-file limit of 20,000 characters for bootstrap files.
When AGENTS.md exceeds this limit, it gets silently truncated — your agent
receives incomplete instructions with no warning.

Aristotle Doctor monitors AGENTS.md size and warns when it approaches
the limit. When you see that warning, move operational details here.

Your agent can find content in this file using memory_search.
It does not need to be loaded at boot to be useful.

## Rules Moved From AGENTS.md

(none yet — this file is ready for when you need it)
`;
}
