import * as fs from 'fs';
import * as path from 'path';
import type { AuditEntry } from '../types.js';
import { AuditLog } from '../storage/audit-log.js';

/**
 * QC Report Formatter
 *
 * Generates branded Telegram reports in deterministic code.
 * The QC agent reads the generated file and sends it — no
 * LLM formatting decisions involved.
 *
 * Output: ~/.openclaw/aristotle/qc-telegram-report.txt
 * The cron agent protocol says: "Read this file. Send it. Nothing else."
 */

// Sign-off rotation phrases
const SIGN_OFFS = {
  clean: [
    'Everything remembered. Nothing lost.',
    'Memory intact. Context preserved.',
    'The night passed without a trace.',
    'Clean through. Nothing escaped notice.',
    'All threads held. All contexts kept.',
    'The system ran itself tonight.',
    'Nothing slipped. Nothing missed.',
    'All clear. Back to sleep.',
    'Operations nominal. Night closed clean.',
    'Watched, checked, verified. You are clear.',
  ],
  handled: [
    'While you slept, the gaps were filled.',
    'Caught. Fixed. Logged. You are clear.',
    'The night shift did its job.',
    'Handled before morning.',
    'Nothing waited for you. It is done.',
    'Found it. Fixed it. Filed it.',
    'The work happened. You did not need to.',
    'Resolved quietly. As it should be.',
    'Before you woke, it was already handled.',
    'Nothing broke through. The line was held.',
  ],
  user_needed: [
    'One thing did not make it through. You are needed.',
    'Something needs your eyes tonight.',
    'Almost clean. One thing needs you.',
    'Taken as far as it could go. Your turn.',
    'One flag. Everything else: handled.',
    'The night was mostly quiet. One thing was not.',
    'Close. One item is waiting for you.',
    'Nearly perfect. One thing needs a human.',
    'Stopped where it should. Your call now.',
    'One door left open. Only you can close it.',
  ],
};

// Plain English translations for technical terms
const TRANSLATIONS: Record<string, string> = {
  'bootstrap_present': 'System files verified',
  'bootstrap_truncation': 'System files checked for damage',
  'bootstrap_limit': 'System file sizes checked',
  'memory_case': 'Memory file naming corrected',
  'memory_lines': 'Memory file trimmed',
  'daily_log': 'Daily notes verified',
  'hybrid_search': 'Memory search restored',
  'memory_freshness': 'Memory search restored',
  'stale_entries': 'Old entries archived',
  'settings_intact': 'System settings corrected',
  'log_dir_size': 'Log storage managed',
  'daily_log_content': 'Daily notes verified',
  'uncommitted_changes': 'Unsaved changes committed',
  'reindex': 'Memory search restored',
};

function getSignOffIndex(): number {
  const now = new Date();
  const day = now.getDate();
  // ISO week number calculation
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return (day + week) % 10;
}

function buildProgressBar(passed: number, total: number): string {
  const filled = Math.round((passed / total) * 10);
  const empty = 10 - filled;
  const pct = Math.round((passed / total) * 100);
  return '█'.repeat(filled) + '░'.repeat(empty) + `  ${pct}%`;
}

function padLabel(label: string, width: number = 13): string {
  return label.padEnd(width);
}

function translateCheck(check: string): string {
  return TRANSLATIONS[check] || check.replace(/_/g, ' ');
}

export interface QCReportInput {
  totalChecks: number;
  passed: number;
  failed: number;
  actionsCompleted: string[];  // Plain English descriptions of what was fixed
  userActionNeeded: string | null;  // null if no user action needed
}

/**
 * Generate a branded Telegram report and write it to disk.
 * The QC cron agent reads this file and sends it as-is.
 */
export function generateReport(
  input: QCReportInput,
  openclawHome: string,
): string {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const date = `${now.getDate()} ${months[now.getMonth()]}`;
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const time = `${hour12}:${minutes} ${ampm} ET`;

  const bar = buildProgressBar(input.passed, input.totalChecks);
  const signOffIndex = getSignOffIndex();

  let template: string;
  let signOff: string;

  if (input.failed === 0 && input.actionsCompleted.length === 0) {
    // A1 — Clean night
    signOff = SIGN_OFFS.clean[signOffIndex];
    template = [
      `⟁ [ARISTOTLE] · Memory`,
      `${date} · ${time}`,
      `────────────────────────`,
      `${padLabel("MEMORY HEALTH", 15)}${bar}  ${input.passed}/${input.totalChecks}`,
      `────────────────────────`,
      `Completed:`,
      `· All checks passed`,
      `User Action Needed:`,
      `· None.`,
      `────────────────────────`,
      signOff,
      ``,
      `Reply "show me QC data" for full details.`,
    ].join('\n');
  } else if (!input.userActionNeeded) {
    // A2 — Issues found, all handled
    signOff = SIGN_OFFS.handled[signOffIndex];
    const completedLines = input.actionsCompleted.map(a => `· ${a}`).join('\n');
    template = [
      `⟁ [ARISTOTLE] · Memory`,
      `${date} · ${time}`,
      `────────────────────────`,
      `${padLabel("MEMORY HEALTH", 15)}${bar}  ${input.passed}/${input.totalChecks}`,
      `────────────────────────`,
      `Completed:`,
      completedLines,
      `User Action Needed:`,
      `· None. Already handled.`,
      `────────────────────────`,
      signOff,
      ``,
      `Reply "show me QC data" for full details.`,
    ].join('\n');
  } else {
    // A3 — User action needed
    signOff = SIGN_OFFS.user_needed[signOffIndex];
    const completedLines = input.actionsCompleted.length > 0
      ? input.actionsCompleted.map(a => `· ${a}`).join('\n')
      : '· No additional fixes needed.';
    template = [
      `⟁ [ARISTOTLE] · Memory`,
      `${date} · ${time}`,
      `────────────────────────`,
      `${padLabel("MEMORY HEALTH", 15)}${bar}  ${input.passed}/${input.totalChecks}`,
      `────────────────────────`,
      `Completed:`,
      completedLines,
      `User Action Needed:`,
      `→ ${input.userActionNeeded}`,
      `────────────────────────`,
      signOff,
      ``,
      `Reply "show me QC data" for full details.`,
    ].join('\n');
  }

  // Write the formatted report to a known file
  const reportPath = path.join(openclawHome, 'aristotle', 'qc-telegram-report.txt');
  fs.writeFileSync(reportPath, template, 'utf-8');

  return template;
}

/**
 * Generate a report from audit trail entries (for nightly QC).
 * Reads the last N audit entries, categorizes them, and produces
 * a branded report.
 */
export function generateReportFromAudit(
  auditLog: AuditLog,
  openclawHome: string,
  totalChecks: number = 11,
): string {
  // Read recent entries since last registration (current session)
  const entries = auditLog.recent(100);
  const lastReg = entries.findIndex(e => e.action === 'REGISTERED');
  const sessionEntries = lastReg >= 0 ? entries.slice(0, lastReg) : entries;

  const failures = sessionEntries.filter(e =>
    e.action === 'ACTIVE_SESSION_CHECK_FAILED' ||
    (e.component === 'qc' && !e.action.includes('REGISTERED'))
  );

  const passed = totalChecks - failures.length;
  const actionsCompleted = failures.map(f => translateCheck(f.detail.split(':')[0]));

  return generateReport({
    totalChecks,
    passed: Math.max(0, passed),
    failed: failures.length,
    actionsCompleted,
    userActionNeeded: null,
  }, openclawHome);
}
