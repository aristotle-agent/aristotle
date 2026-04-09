import * as fs from 'fs';
import * as path from 'path';
import type { PendingChange } from '../types.js';

const PENDING_FILE = 'pending-changes.json';

export class PendingChanges {
  private filePath: string;

  constructor(aristotleDir: string) {
    this.filePath = path.join(aristotleDir, PENDING_FILE);
  }

  /** Read all pending changes */
  read(): PendingChange[] {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw) as PendingChange[];
    } catch {
      return [];
    }
  }

  /** Save pending changes */
  private save(changes: PendingChange[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(changes, null, 2));
  }

  /** Add a pending change (with dedup check) */
  add(change: Omit<PendingChange, 'id' | 'expiry'>): PendingChange | null {
    const changes = this.read();

    // Dedup: don't add if same file + same content already pending
    const exists = changes.some(
      c => c.file === change.file && c.content === change.content
    );
    if (exists) return null;

    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * 86400000); // 30 days

    const pending: PendingChange = {
      id: `pc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file: change.file,
      content: change.content,
      action: change.action,
      date: now.toISOString().slice(0, 10),
      expiry: expiry.toISOString().slice(0, 10),
      summary: change.summary,
    };

    changes.push(pending);
    this.save(changes);
    return pending;
  }

  /** Remove expired items (older than 30 days) */
  pruneExpired(): number {
    const changes = this.read();
    const today = new Date().toISOString().slice(0, 10);
    const before = changes.length;
    const after = changes.filter(c => c.expiry >= today);
    this.save(after);
    return before - after.length;
  }

  /** Approve specific items by index (1-based) */
  approve(indices: number[]): PendingChange[] {
    const changes = this.read();
    const approved: PendingChange[] = [];
    const remaining: PendingChange[] = [];

    changes.forEach((change, i) => {
      if (indices.includes(i + 1)) {
        approved.push(change);
      } else {
        remaining.push(change);
      }
    });

    this.save(remaining);
    return approved;
  }

  /** Remove specific items by index (1-based) */
  deny(indices: number[]): number {
    const changes = this.read();
    const remaining = changes.filter((_, i) => !indices.includes(i + 1));
    this.save(remaining);
    return changes.length - remaining.length;
  }

  /** Count pending items */
  count(): number {
    return this.read().length;
  }

  /** Generate the branded weekly report */
  generateReport(timezone: string): string | null {
    this.pruneExpired();
    const changes = this.read();
    if (changes.length === 0) return null;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
      timeZone: timezone,
    });
    const dayStr = `${now.getDate()} ${now.toLocaleString('en-US', { month: 'short' })}`;

    const items = changes.map((c, i) =>
      `${i + 1}. ${c.file} — "${c.summary}" (${c.date})`
    ).join('\n');

    return [
      '⟁ [ARISTOTLE] · Your attention is needed.',
      '',
      `${dayStr} · ${timeStr}`,
      '────────────────────────',
      'Your agent attempted changes to protected boot',
      'files this week. These files control how your',
      'agent thinks and operates — Aristotle held the',
      'changes for your review.',
      '',
      items,
      '',
      '────────────────────────',
      'NEXT STEPS:',
      'Reply with the numbers to approve (e.g. "1, 3").',
      'Remaining items stay pending up to 30 days',
      'before automatic removal.',
      '────────────────────────',
      '⟁ Your boot files are protected.',
    ].join('\n');
  }
}
