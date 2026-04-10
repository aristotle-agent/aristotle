# ⟁ Aristotle

**Your agent won't forget.**

I bought a Mac Mini, set up OpenClaw, and proudly had my agent introduce himself to the family. Our own Jarvis. The next morning he said, "Who am I? Who are you?"

That first month was brutal. I'd explain a project, get confirmation, type "proceed" — and twenty minutes later the agent contradicts itself, forgets the idea I mentioned three times, and confidently references a project that doesn't exist.

I'm not the only one:

- "Every session starts from zero." — OpenClaw Pulse
- "It forgets context between sessions" — #2 complaint (GitHub #39885)
- "Your bot really did forget everything. It just needs a memory system." — OpenClaw Pulse

That last line is the key. It just needs a memory system.

Aristotle is that system. It stores, protects, cross-checks, and verifies. No other tool combines all four.

My token use dropped from 262K per prompt to under 12K. That's not a sales pitch — it's a normal byproduct of the system working.

```
⟁ Aristotle              →  Your agent won't forget
  ├── Guard              →  Blocks memory corruption before it happens
  ├── Context Shield     →  Prevents silent memory loss
  └── QC                 →  Verifies memory integrity every night
```

## Why This Exists

Every other tool works the same way: wait for the problem, then try to fix it. Wait for overflow, then compress. Wait for memory loss, then try to recover.

Aristotle works differently. Every morning, your agent reads everything once and produces a compact cheat sheet — about 20 lines. That's all it carries for the rest of the day. Working memory stays lean because unnecessary accumulation never happens.

When pressure builds during long sessions, Aristotle detects it and acts before the crisis. And if something slips through, a nightly audit catches and fixes it while you sleep.

Every other system compresses after the damage is done. Aristotle never accumulates the damage in the first place.


## What It Does

Aristotle does 4 things. Each one strengthens the others.

1. Guard — blocks your agent from corrupting its own memory. Rules enforced in code, not suggestions it can forget.
2. Context Shield — watches how full your agent's working memory is and acts before it overflows. No more silent destruction.
3. QC Nightly — 11 automated checks run every night. Fixes what it can. Only contacts you if something needs a human.
4. QC Mid-Session — lightweight checks during the day so problems at 2 PM don't wait until 11 PM.


### Guard

Guard sits between your agent and every action it takes. Before a file write executes, before a shell command runs, before a sub-agent spawns — Guard checks it against 10 protection rules. If the action would damage memory, Guard blocks it and tells the agent exactly what to do instead.

This isn't a suggestion your agent can ignore. It's enforced in code.

```
Write to AGENTS.md         →  Saved for owner approval (guarded mode)
                              or blocked entirely (locked mode)
gateway stop               →  "Use gateway restart instead"
Edit tool on daily log     →  "Use exec append instead"
Credential in .md file     →  "Store in .env only"
Overwrite MEMORY.md        →  "Append, don't replace"
Spawn sub-agent bare       →  "Read continuity file first"
rm -rf in scratch dirs     →  ✅ Allowed (temp cleanup is fine)
rm -rf on memory paths     →  Blocked (memory files are protected)
Normal file read           →  ✅ Allowed
Normal memory write        →  ✅ Allowed
```

Guard blocks are redirections, not errors. Your agent gets a clear alternative and keeps working.

**Boot file protection** — two modes, you choose during setup:

- **Guarded** (default) — your agent can propose changes to boot files like AGENTS.md. Aristotle holds them for your approval. A weekly report shows what was attempted. You reply with the numbers to approve.
- **Locked** — no agent writes to boot files, period. Terminal only. For users who want the vault.


### Context Shield

Your agent's working memory has a size limit. When it fills up, the system compresses older parts of your conversation. That compression is where memory loss happens.

Context Shield watches how full your agent's working memory is by reading actual usage data from session files. No guessing, no asking the AI to self-report.

| How full | What happens |
|----------|-------------|
| 50% | Noted internally. No action. |
| 65% | Compresses proactively — while there's still room to do it carefully. |
| 70% | Alerts you and starts a fresh session — before emergency compression destroys important context. |

Destructive commands are path-aware. Cleaning `/tmp/scratch-repo` passes through — your memory paths stay protected.


### QC

Two modes. Same job: catch what slips through.

**Every night** — 11 checks run automatically. Are your memory files present? Is search working? Are settings intact? Has anything drifted? QC fixes what it can. Silence means clean.

**During the day** — Every 50 actions, QC checks if the daily log is being written and if file changes are backed up.

**The nightly report** — generated in code, not by the AI. Same layout every night.

```
⟁ [ARISTOTLE] · Memory
28 Mar · 11:20 PM ET
────────────────────────
MEMORY HEALTH  █████████░  90%  10/11
────────────────────────
Completed:
· Memory search restored
User Action Needed:
· None. Already handled.
────────────────────────
Caught. Fixed. Logged. You are clear.

Reply "show me QC data" for full details.
```

Followed automatically by a memory audit snapshot:

```
⟁ [ARISTOTLE] · Memory Audit
────────────────────────
BOOTSTRAP    ██░░░░░░░░  21% used
MEMORY.md    ██████░░░░  56% (84 lines)
DAILY LOG    ██░░░░░░░░  1.2K chars
────────────────────────
Active Projects Protected: 8
Guard (24h): 0 blocks
Search: healthy
Last QC: clean
────────────────────────
⟁ Your agent won't forget.

Reply "show me audit trail" for raw data.
```


### What Happens While You Sleep

Aristotle runs five automated jobs. You configure nothing — the setup wizard creates all of them.

```
 3:30 AM — Pre-Reset Checkpoint
            Saves any unsaved context before the 4 AM daily reset.
            Reads the session transcript, extracts what matters,
            appends it to today's log. Nothing is lost at reset.

10:45 PM — Continuity Update
            Checks for multi-day tasks still in progress.
            Creates or updates continuity files so your agent
            picks up exactly where it left off tomorrow.

11:15 PM — QC Agent
            Runs 11 memory integrity checks. Fixes what it can.
            Writes a detailed log. Stays silent if everything is clean.

11:20 PM — Report Delivery
            Reads the QC results, generates a branded report in code,
            sends it to your Telegram, Discord, or WhatsApp.
            Followed automatically by a memory audit snapshot.

Sunday 10 PM — Weekly Memory Review
            Reviews the last 7 days of daily notes. Suggests
            durable facts worth promoting to long-term memory.
            You reply "promote" or "skip." Aristotle never writes
            to MEMORY.md without your approval.
```

### Pending Boot File Changes

When your agent tries to modify protected boot files in guarded mode, Aristotle saves the change for your review. Every Sunday you get a report:

```
⟁ [ARISTOTLE] · Your attention is needed.

2 Apr · 10:15 PM
────────────────────────
Your agent attempted changes to protected boot
files this week. These files control how your
agent thinks and operates — Aristotle held the
changes for your review.

1. AGENTS.md — "always confirm before deleting
   any file" (Mar 28)
2. SOUL.md — "prefer concise answers" (Apr 1)

────────────────────────
NEXT STEPS:
Reply with the numbers to approve (e.g. "1, 3").
Remaining items stay pending up to 30 days
before automatic removal.
────────────────────────
⟁ Your boot files are protected.
```


## Works Great With

Aristotle is standalone, but these plugins complement it:

- **Lossless Claw** — preserves every message during compression. Aristotle prevents compression pressure. Together, nothing is lost.
- **QMD** — adds semantic search across your memory files. Aristotle protects those files. QMD makes them searchable.
- **Dreaming** (OpenClaw 4.5+) — consolidates memories overnight. Aristotle protects what Dreaming promotes. Dreaming decides what to remember. Aristotle makes sure those memories survive.
- **Self-Improving skills** — learn from mistakes and append rules to AGENTS.md. Guarded mode holds those changes for your approval before they write.

Not required. Not dependencies. Just honest recommendations from a user who runs them.

## Quick Start

```bash
git clone https://github.com/aristotle-agent/aristotle.git
cd aristotle
npm install
npm run build
npm link
openclaw plugins install --link ~/aristotle
openclaw gateway restart
aristotle init
aristotle doctor
```

The setup wizard asks 8 questions with sensible defaults:

1. Agent name
2. Owner name
3. Workspace path (auto-detected)
4. Enforcement mode
5. Report delivery channel (Telegram / Discord / WhatsApp)
6. Channel ID (only asks for the one that matches)
7. Timezone (auto-detected)
8. Boot file protection mode (guarded or locked)

It deploys everything: QC agent protocol, report templates, cron jobs, file permissions, memory settings, and directory structure. A 30-second welcome tour shows you exactly what you installed.

**Important:** Always install with `openclaw plugins install --link`. This creates the install provenance that OpenClaw's hook system requires. Without it, Guard registers but never fires. `aristotle doctor` checks this automatically.

## Verify

```
$ aristotle doctor

⟁ Aristotle Doctor
────────────────────────────────────────
✅ Policy file
✅ Data directory
✅ Workspace
✅ Plugin install: provenance verified
✅ File permissions: 7 protected files
✅ Audit log: 3KB
✅ Report delivery: configured
✅ QC agent protocol: deployed
✅ QC report template: deployed
✅ QC cron jobs: nightly + report delivery
✅ Guard registered: 10 rules (enforce mode)
✅ Bootstrap files: all within size limits
✅ Total bootstrap: 16,240 chars (limit: 150,000)
✅ Continuity files: 2 active, all current
✅ Pre-reset checkpoint: ran this morning
✅ Weekly hygiene: last ran 3 day(s) ago
✅ QC delivery: last log from today
✅ Pending changes: none
✅ Protection mode: guarded

⟁ Your agent won't forget.
```

If anything is wrong, `aristotle doctor --fix` repairs it automatically.

## CLI

```
$ aristotle

⟁ Aristotle — Memory Protection for OpenClaw

Commands:
  aristotle init              Setup wizard (auto-detects your config)
  aristotle status            Current policy and recent activity
  aristotle audit [n]         View last n guard decisions (default: 20)
  aristotle audit-report      Memory status audit with visual health bars
  aristotle audit-report --send  Send audit via configured channel
  aristotle doctor            Health check
  aristotle doctor --fix      Auto-repair permissions, directories, config
  aristotle report            Generate branded QC report
  aristotle report --send     Send QC report + auto audit via configured channel
  aristotle pending-report    View pending boot file changes
  aristotle pending-report --send  Send pending report via configured channel
  aristotle pending-approve 1,3   Approve specific pending changes by number
  aristotle config show       View current configuration
  aristotle config set        Update a setting
  aristotle version           Show version

Your agent won't forget.
```

## What Aristotle Doesn't Do

- **Doesn't replace OpenClaw's built-in compression.** Aristotle adds a proactive layer on top. The built-in system is still the backstop.
- **Doesn't guarantee zero memory loss.** Combined reliability on memory protection is 90-92%. The remaining 8-10% is caught by nightly QC. When something slips, we tell you.
- **Doesn't manage tasks or projects.** That's the operations layer, coming separately. Aristotle protects memory. Period.

## How It Works (Technical)

Aristotle is an OpenClaw plugin that uses the `before_tool_call` plugin hook ([docs](https://docs.openclaw.ai/tools/plugin)) to intercept every file write, shell command, and sub-agent spawn before execution.

When Guard detects a memory violation, it returns a redirect: the action is blocked, but the agent receives a specific corrective instruction. We call this the **Memory Redirect** pattern — the difference between a bouncer and a waiter. The bouncer turns you away. The waiter suggests something better.

Destructive shell commands are path-aware. `rm -rf /tmp/scratch` passes through. `rm -rf ~/.openclaw/workspace/memory/` is blocked. Aristotle protects memory paths, not the whole filesystem.

In guarded mode, writes to boot files (AGENTS.md, SOUL.md, etc.) are intercepted and saved to a pending queue for owner approval. In locked mode, they're blocked outright.

Context Shield piggybacks on Guard's hook counter. Every 50 tool calls, it reads the session JSONL transcript to calculate working memory usage. Three detection methods are tried automatically. User configures nothing.

The QC nightly report is generated entirely in code. The AI runs the checks and provides raw data. A deterministic TypeScript formatter produces the branded report. The report looks identical whether your agent runs GPT-5 or Llama.

10 Guard rules. 17+ doctor checks. 5 automated cron jobs. 11 nightly QC checks. 2 mid-session checks. All enforcement is code. Zero AI calls for any enforcement action.

## Additive by Design

Aristotle never breaks what already works. Your existing agent, channels, integrations, and workflows continue exactly as before. Guard only intercepts actions that would damage memory — everything else passes through untouched.

If you uninstall Aristotle, your agent works exactly like it did before you installed it.

## Requirements

- OpenClaw 2026.2.1 or later
- Node.js >= 18.0.0

## Community

Questions, ideas, or want to share how you're using Aristotle?

→ [Join the conversation on GitHub Discussions](https://github.com/aristotle-agent/aristotle/discussions)

## License

MIT

---

*⟁ Aristotle — Your agent won't forget.*
