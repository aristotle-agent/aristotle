# Aristotle v3.8.2 — Complete Bundle Upgrade Notes
# For: Live testing reference
# Date: 2026-03-30

---

## WHAT'S IN THIS BUILD

Everything from v3.7 + v3.8 + v3.8.1 + v3.8.2 combined.

---

## FROM v3.7

1. **Static date fix** — All 3 cron prompts (QC, continuity,
   pre-reset) changed from `$(date +%Y-%m-%d)` shell
   expressions to plain English date instructions. Prevents
   cron from writing to hardcoded date filenames.

2. **Discord/WhatsApp report cron gate** — Report delivery
   cron now checks `reportTarget || telegramChatId` instead
   of just `telegramChatId`. Discord and WhatsApp users get
   the report cron created during init.

3. **README multi-channel** — All Telegram-specific references
   updated to include Discord and WhatsApp.

---

## FROM v3.8

4. **Weekly promotion suggestion** — New cron (Sunday 10 PM).
   Reviews last 7 days of daily notes, identifies durable
   facts, sends suggestion to user. User replies "promote"
   or "skip". Never writes to MEMORY.md without approval.

5. **QC report footer** — All 3 QC report templates now end
   with: `Reply "show me QC data" for full details.`

6. **Audit report footer** — Audit report now ends with:
   `Reply "show me audit trail" for raw data.`

7. **Boot sequence Quick Commands** — Added: audit,
   promote, skip, show me QC data, show me audit trail.

8. **README schedule updated** — Shows 5 automated jobs
   including weekly promotion. Audit-report command added
   to CLI reference.

---

## FROM v3.8.1

9. **Pending changes system** — New storage module
   (`pending-changes.json`). Saves attempted writes to
   protected boot files for owner review instead of
   blocking silently.

10. **Guard-001 guarded/locked mode** — In guarded mode,
    writes to bootstrap files are queued for approval.
    In locked mode, writes are hard-blocked (original
    behavior). Default: guarded.

11. **chmod conditional** — Init wizard sets chmod 644
    (guarded mode) or chmod 444 (locked mode) based on
    user's choice.

12. **Protection mode init question** — New question #8:
    "Boot file protection mode" with Guarded (default,
    recommended) and Locked (ultra secure) options.

13. **Init wizard labels** — Question 1 is now "Agent name",
    question 2 is "Owner name (you)".

14. **pending-report CLI command** — Generates branded
    pending changes report. `--send` delivers to channel.

15. **pending-approve CLI command** — Approves specific
    pending items by number. Applies changes, commits
    to git, restores file permissions.

16. **Weekly pending review cron** — Sunday 10:15 PM
    (guarded mode only). Sends pending changes report
    to user's channel.

17. **Doctor checks** — Added pending count and protection
    mode display.

18. **Boot sequence Quick Commands** — Added: pending
    approve by number, "pending" to view report.

---

## FROM v3.8.2

19. **Guard-004 path-aware** — Destructive commands (rm -rf)
    are now path-aware:
    - ALLOW in scratch zones: /tmp, ~/tmp, ~/scratch,
      workspace/tmp, .openclaw-sandbox*
    - BLOCK if targeting memory paths: AGENTS.md, SOUL.md,
      MEMORY.md, memory/, protocols/
    - ALLOW everywhere else (not Aristotle's job to police
      non-memory filesystem)

20. **Better guard-004 error messages** — Instead of generic
    "destructive command detected", now says specifically
    what path was blocked and why.

---

## LIVE TEST PLAN

### Phase 1 — Build verification
```
cd ~ && rm -rf ~/aristotle && cd ~/Downloads
tar -xf aristotle-beta-v3.8.2-complete.tar
mv aristotle ~/aristotle && cd ~/aristotle
npm install && npm run build && npm link
openclaw gateway restart
aristotle doctor
```
Expected: clean build, all doctor checks pass,
protection mode shows "guarded".

### Phase 2 — Report tests
```
aristotle report
aristotle report --send
aristotle audit-report
aristotle audit-report --send
```
Expected: QC report has footer line. Audit report has
footer line. Auto audit sends 5 seconds after QC report.

### Phase 3 — Pending changes test
Tell agent via Telegram: "Add a rule to AGENTS.md:
always check memory before answering questions"
Expected: Guard queues the change, agent gets redirect
message saying "saved for owner review".
```
aristotle pending-report
```
Expected: Shows the queued change with number.
```
aristotle pending-approve 1
```
Expected: Change appended to AGENTS.md, git committed.

### Phase 4 — Guard-004 path-aware test
Tell agent: "run rm -rf /tmp/test-junk"
Expected: ALLOWED (scratch zone)

Tell agent: "run rm -rf ~/.openclaw/workspace/memory/"
Expected: BLOCKED with memory path message

### Phase 5 — Init wizard test (optional)
```
aristotle init
```
Walk through all 8 questions. Verify:
- Agent name is question 1
- Owner name is question 2
- Protection mode is question 8
- Tour works

### Phase 6 — Push to GitHub
```
git init && git add -A
git commit -m "v3.8.2: pending changes, path-aware guard, promotion, report footers"
git remote add origin https://github.com/aristotle-agent/aristotle.git
git branch -M main
git push -u origin main --force
git config user.name "aristotle-agent"
git config user.email "aristotle-agent@users.noreply.github.com"
```

---

## FULL CHANGELOG SINCE v3.6 (last GitHub push)

- Static date fix in 3 cron prompts
- Discord/WhatsApp report cron gate
- README multi-channel
- Weekly promotion suggestion cron
- QC report footers
- Audit report footers
- Boot sequence Quick Commands (7 commands)
- Pending changes system (queue, approve, deny, expire)
- Guard guarded/locked mode
- Conditional chmod (644/444)
- Protection mode init question
- pending-report + pending-approve CLI commands
- Weekly pending review cron
- Doctor: pending count + protection mode
- Guard-004 path-aware destructive commands
- Init wizard: Agent Name + Owner Name labels
- Help menu updated with all new commands
- Config show: protection mode display

Total: 20 items across 4 version increments.
