# ⟁ Aristotle

**Your agent won't forget.**

"My agent woke up blank. Again."   

You explain the project, get confirmation and proudly type: proceed.  

But twenty minutes later, the agent contradicts itself. It forgets the idea you mentioned three times. It confidently referenced a project that doesn't even exist.

Maybe the YouTube videos about agents and automation are just hype. Maybe you're mad that you now know what Terminal is. 

Maybe all you wanted was a tool that ran itself. 


The problem? It's the way the memory system is structured. 


Aristotle fixes this.  


You're not the only one dealing with this issue.


Look at the top complaints from Open Claw users:

- "It forgets context between sessions" — second most-cited complaint (GitHub #39885)

- "The model wakes up with a blank slate. There's no magic database running quietly in the background." — OpenClaw Pulse

- "Every session starts from zero." — OpenClaw Pulse memory guide

- "Most AI agents have amnesia. They forget everything the moment you start a new chat." — memory-lancedb-pro

- "Your bot really did forget everything. And no, it's not broken. It just needs a memory system." — OpenClaw Pulse  


READ THAT LAST SENTENCE AGAIN... that is the key. 
"It just needs a memory system" 

That's all. 

Aristotle uses a simple 4-step process to fix the memory system. All automated. It stores, protects, cross-checks and verifies. Aristotle *remembers* 

This system has never existed, combining memory, guardrails, storage and verification.  


Why does OpenClaw's software forget?  
Your agent doesn't have a "bug", it's just the way OpenClaw was built.

You give instructions and the agent puts them in short-term memory, then long term memory. But if you give too many prompts everything vanishes. And your agent acts like a lost puppy, ready to help you all over again. 

It's called compaction, and it's actually a good thing. But that's destructive. Hence, the amnesia. This system manages compaction so it becomes an asset, not an enemy.  


What about Memory Plugins? 

Some are excellent. Aristotle actually works great in combination with them. But they solve different problems. Look at how these plugins work:
- Lossless Claw saves everything during compression — nothing gets deleted. 
- memory-lancedb-pro remembers your preferences across sessions. 
- QMD makes your old conversations searchable. 

All powerful, even world-class quality. But none of them stop your agent's memory from being silently destroyed mid-conversation. Your agent will still slam into amnesia. 

Why?

Because these plugins store and retrieve.
 
Aristotle stores, protects, cross-checks, and verifies. That 4-step structure is the difference.


By the way, I'm a user too. I bought a MacMini, told my teenage son to get ready to dream up a business and our agent will do all the work. Just like I watched online. But day-1 was all downloads and APIs. Maybe day two would be better? Nope. I just stayed up 4 extra hours and figured out how to make it send an email.  

After church the next day, I proudly had the agent send an email introducing himself to the family. So cool. Like our own family Jarvis. 

But the next morning the agent literally started the session with, "Who am I. Who are you?" 

The next week was even less sleep. 

Which is why I have obsessively created the Aristotle solution. 


Listen, I made Aristotle because I got tired of waking up to a blank agent. My first month was brutal. This solution is what came out of that month. I'm hoping you'll see an instant difference like I did. 

While no software is perfect Aristotle is really, really good at getting this piece right.

Join me in making this the standard. 

Because agents shouldn't forget.  


One more thing before you read the details below:
My token use per prompt dropped from an embarrassing 262k average in my first week to now under 12k.  

I see how that could sound a little salesy but it's a normal byproduct of the Aristotle system working. 


Here is how it works:

```
⟁ Aristotle              →  Your agent won't forget
  ├── Guard              →  Blocks memory corruption before it happens
  ├── Context Shield     →  Prevents silent memory loss
  └── QC                 →  Verifies memory integrity every night
```

## Why This Exists

Every other tool for agent memory works the same way: wait for the problem, then try to fix it. Wait for the conversation to overflow, then compress. Wait for memory to be lost, then try to recover. Wait for files to be corrupted, then notice on the next reboot.

Aristotle works differently. Instead of reacting to damage, it prevents the conditions that cause damage in the first place.

Every morning, your agent reads everything once and produces a compact cheat sheet — about 20 lines. That cheat sheet is all it carries for the rest of the day. It doesn't re-read its full operating rules on every message. It doesn't stuff its entire history into every turn. The working memory stays lean because unnecessary accumulation never happens.

When pressure does build during long sessions, Aristotle detects it and acts — before the crisis, not during it. And if something slips through despite all of this, a nightly audit catches it and fixes it while you sleep.

Every other system compresses after the damage is done. Aristotle never accumulates the damage in the first place.


## What It Does

Aristotle does 4 things. Each one strengthens the others.

1. Guard — blocks your agent from corrupting its own memory. Rules enforced in code, not suggestions it can forget.
2. Context Shield — watches how full your agent's working memory is and acts before it overflows. No more silent destruction.
3. QC Nightly — 11 automated checks run every night. Fixes what it can. Only contacts you if something needs a human.
4. QC Mid-Session — lightweight checks during the day so problems at 2 PM don't wait until 11 PM.

No other tool combines all four. Memory, guardrails, storage and verification. That's the difference.


### Guard

Guard sits between your agent and every action it takes. Before a file write executes, before a shell command runs, before a sub-agent spawns — Guard checks it against 10 protection rules. If the action would damage memory, Guard blocks it and tells the agent exactly what to do instead.

This isn't a suggestion your agent can ignore. It's enforced in code. The agent doesn't need to remember the rule — Guard remembers it for them.

```
Write to AGENTS.md         →  "Read-only. Notes go to memory/qc/"
gateway stop               →  "Use gateway restart instead"
Edit tool on daily log     →  "Use exec append instead"
Credential in .md file     →  "Store in .env only"
Overwrite MEMORY.md        →  "Append, don't replace. Use exec append."
Spawn sub-agent bare       →  "Read continuity file first. Include context."
Normal file read           →  ✅ Allowed
Normal memory write        →  ✅ Allowed
```

Guard blocks are redirections, not errors. Your agent gets a clear alternative and keeps working. Other security plugins in the OpenClaw ecosystem block dangerous actions — Aristotle redirects to correct ones. The agent tried the wrong approach, Guard showed it the right one, and work continues without interruption.

The memory overwrite rule alone prevents the single most common corruption in OpenClaw: your agent writing 42 characters to a file that had 2,847. Guard catches this before the damage happens. The sub-agent rule ensures that when your agent delegates work, the sub-agent gets project context — not a blank slate.

### Context Shield

Your agent's working memory has a size limit. When it fills up, the system compresses older parts of your conversation to make room. That compression is where memory loss happens — important details get summarized away.

Context Shield watches how full your agent's working memory is getting by reading actual usage data from session files. No guessing, no asking the AI to self-report.

When pressure builds, it acts early:

| How full | What happens |
|----------|-------------|
| 50% | Noted internally. No action. |
| 65% | Compresses proactively — while there's still room to do it carefully. |
| 70% | Alerts you and starts a fresh session — before emergency compression destroys important context. |

The difference between "managed compression with time to save what matters" and "emergency compression that destroys what matters" is the difference between a normal Tuesday and a lost afternoon. Context Shield keeps you on the normal Tuesday.

### QC

Two modes. Same job: catch what slips through.

**Every night** — 11 checks run automatically in an isolated session. Are all your memory files present? Is your search system working? Are your settings intact? Has anything drifted since yesterday? QC fixes what it can on its own. It only contacts you if something needs your attention. Silence means everything is clean.

**During the day** — Every 50 actions your agent takes, QC runs two lightweight checks: is the daily log actually being written to (catches silent write failures), and are your file changes backed up (catches backup gaps). These catch problems at 2 PM instead of 11 PM.

**The nightly report** — When QC finishes, a branded report arrives on your Telegram, Discord, or WhatsApp — whichever you chose during setup. The reports are generated in code, not by the AI. That means the format is identical every night — same layout, same progress bar, same plain English translations. No creative interpretation, no missing sections, no surprises. You get the same professional report whether your agent is running on GPT-5 or a local Llama model.

```
⟁ [ARISTOTLE] · Memory
28 Mar · 11:20 PM ET
────────────────────────
MEMORY HEALTH  █████████░  10/11
────────────────────────
Completed:
· Memory search restored
User Action Needed:
· None. Already handled.
────────────────────────
Caught. Fixed. Logged. You are clear.

Reply "show me QC data" for full details.
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

## Works Great With

Aristotle is standalone, but these plugins complement it:

- **Lossless Claw** — preserves every message during compression. Aristotle prevents compression pressure. Lossless makes compression lossless when it does happen. Together, nothing is lost.
- **QMD** — adds semantic search across your memory files. Aristotle protects those files. QMD makes them searchable.

Not required. Not dependencies. Just honest recommendations from a user who runs both.

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

The setup wizard auto-detects your workspace path from your existing OpenClaw configuration. Six questions, sensible defaults. You choose your report delivery channel — Telegram, Discord, or WhatsApp — and the wizard only asks for the ID that matches. It deploys everything: QC agent protocol, report templates, four cron jobs, file permissions, memory settings, and directory structure. Nothing breaks. Nothing left to configure manually.

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
✅ File permissions: 7 protected files correct
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

⟁ Your agent won't forget.
```

17 checks. If anything is wrong, `aristotle doctor --fix` repairs it automatically — file permissions, missing directories, configuration drift. One command.

## CLI

```
$ aristotle

⟁ Aristotle — Memory Protection for OpenClaw

Commands:
  aristotle init         Setup wizard (auto-detects your config)
  aristotle status        Current policy and recent activity
  aristotle audit [n]     View last n decisions (default: 20)
  aristotle audit-report  Memory status audit with visual health bars
  aristotle doctor        Health check (17 checks)
  aristotle doctor --fix  Auto-repair permissions, directories, config
  aristotle report        Generate branded QC report
  aristotle report --send Generate and send report via configured channel
  aristotle version       Show version

Your agent won't forget.
```

## What Aristotle Doesn't Do

- **Doesn't replace OpenClaw's built-in compression.** Aristotle adds a proactive layer on top. The built-in system is still the backstop.
- **Doesn't guarantee zero memory loss.** Three behaviors depend on the AI itself: checking its own identity after compression, not making up information it doesn't have, and responding correctly when you tell it something is wrong. Code can't control what an AI thinks — only what it does.
- **Doesn't manage tasks or projects.** That's the operations layer, coming separately. Aristotle protects memory. Period.
- **Isn't 100% reliable.** Combined reliability on memory protection is 90-92%. The remaining 8-10% is caught by nightly QC or by the rules in your agent's operating files. When something slips, we tell you.

## How It Works (Technical)

Aristotle is an OpenClaw plugin that uses the `before_tool_call` plugin hook ([docs](https://docs.openclaw.ai/tools/plugin)) to intercept every file write, shell command, and sub-agent spawn before execution.

Most security plugins in the OpenClaw ecosystem use this hook to block dangerous actions — deny and stop. Aristotle does something different. When Guard detects a memory violation, it returns a redirect: the action is blocked, but the agent receives a specific corrective instruction. The agent follows the redirect and the work continues. We call this the **Memory Redirect** pattern — the difference between a bouncer and a waiter. The bouncer turns you away. The waiter checks your order against dietary restrictions and suggests something better. The agent never needs to "remember" the memory protection rules because Guard enforces them regardless of what the agent decides to do.

Context Shield piggybacks on Guard's hook counter. Every 50 tool calls, it reads the session JSONL transcript to calculate working memory usage. Three detection methods are tried automatically: ContextEngine API (if installed), JSONL transcript parsing (default), and tool-call-based estimation (fallback). User configures nothing.

The QC nightly report uses a pattern worth explaining. Other plugins let the AI compose its own status messages. We tried that — the AI reformats the report differently every night, drops sections, invents summaries, and ignores templates despite explicit instructions. So the QC report is generated entirely in code. The AI runs the checks and provides raw data. A deterministic TypeScript formatter produces the branded report with the progress bar, plain English translations, and sign-off rotation. The report looks identical whether your agent runs GPT-5 or Llama. The AI never touches the formatting.

10 Guard rules. 17 doctor checks. 4 automated cron jobs. 11 nightly QC checks. 2 mid-session checks. All enforcement is code. Zero AI calls for any enforcement action. Zero overhead on your agent's capacity.

The full source is about 3,000 lines of TypeScript across 11 files. If you want to know how it works before you install it, read `src/plugin/index.ts` first.

## Additive by Design

Aristotle never breaks what already works. Your existing agent, channels, integrations, and workflows continue exactly as before. Guard only intercepts actions that would damage memory — everything else passes through untouched.

The setup wizard reads your existing OpenClaw config to auto-detect settings. `doctor --fix` repairs problems without changing your agent's behavior. If you uninstall Aristotle, your agent works exactly like it did before you installed it.

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
