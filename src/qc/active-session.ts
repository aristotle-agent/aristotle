import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { QCCheckResult } from '../types.js';
import { AuditLog } from '../storage/audit-log.js';

export class ActiveSessionQC {
  private workspacePath: string;
  private auditLog: AuditLog;

  constructor(workspacePath: string, auditLog: AuditLog) {
    this.workspacePath = workspacePath;
    this.auditLog = auditLog;
  }

  /**
   * Run all active-session checks.
   * Called every N tool calls by the plugin hook.
   * Returns results but does NOT block the agent — fire and forget.
   */
  runChecks(): QCCheckResult[] {
    const results: QCCheckResult[] = [];

    results.push(this.checkDailyLogContent());
    results.push(this.checkUncommittedChanges());

    // Log any failures to audit trail
    for (const result of results) {
      if (!result.passed) {
        this.auditLog.log({
          component: 'qc',
          action: 'ACTIVE_SESSION_CHECK_FAILED',
          detail: `${result.check}: ${result.detail}`,
        });
      }
    }

    return results;
  }

  /**
   * Check 1: Daily log has content beyond scaffold.
   *
   * If the daily log was scaffolded at 6:25 AM and it's now afternoon
   * with only scaffold content, the agent has been silently failing
   * to write memory all day. This catches BUG-K scenarios where
   * Guard prevented the bad write method but the agent never
   * attempted the correct method.
   */
  private checkDailyLogContent(): QCCheckResult {
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const logPath = path.join(this.workspacePath, 'memory', `${today}.md`);

      if (!fs.existsSync(logPath)) {
        return {
          check: 'daily_log_content',
          passed: false,
          detail: `No daily log file exists for today (${today}). Memory is not being written.`,
        };
      }

      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      // Scaffold typically has 5-6 lines (headers only, no real content)
      // If the file has grown beyond scaffold, it has real entries
      if (lines.length <= 6) {
        // Check how long the session has been running
        // If it's been more than 2 hours since the file was created,
        // a scaffold-only log is concerning
        const stat = fs.statSync(logPath);
        const ageHours = (Date.now() - stat.birthtimeMs) / (1000 * 60 * 60);

        if (ageHours > 2) {
          return {
            check: 'daily_log_content',
            passed: false,
            detail: `Daily log for ${today} has only scaffold content (${lines.length} lines) after ${Math.round(ageHours)} hours. Agent may not be writing to memory.`,
          };
        }
      }

      return {
        check: 'daily_log_content',
        passed: true,
        detail: `Daily log has ${lines.length} lines of content.`,
      };
    } catch (err) {
      return {
        check: 'daily_log_content',
        passed: false,
        detail: `Could not check daily log: ${err}`,
      };
    }
  }

  /**
   * Check 2: No uncommitted changes in workspace.
   *
   * If memory files are written but not committed, they're on disk
   * but not in git backup. Crash + disk failure = memory loss.
   * This is a lightweight piggyback check — one git status command.
   */
  private checkUncommittedChanges(): QCCheckResult {
    try {
      const result = execSync('git status --porcelain', {
        cwd: this.workspacePath,
        timeout: 5000,
        encoding: 'utf-8',
      }).trim();

      if (result.length > 0) {
        const changedFiles = result.split('\n').length;
        return {
          check: 'uncommitted_changes',
          passed: false,
          detail: `${changedFiles} uncommitted file(s) in workspace. Memory files not backed up to git.`,
          action: 'Consider running: git add -A && git commit -m "memory: auto-commit"',
        };
      }

      return {
        check: 'uncommitted_changes',
        passed: true,
        detail: 'All workspace changes committed to git.',
      };
    } catch (err) {
      return {
        check: 'uncommitted_changes',
        passed: false,
        detail: `Could not check git status: ${err}`,
      };
    }
  }
}
