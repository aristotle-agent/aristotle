import * as fs from 'fs';
import * as path from 'path';
import type { AuditEntry } from '../types.js';

export class AuditLog {
  private logPath: string;

  constructor(basePath: string) {
    const dir = path.join(basePath, 'aristotle');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.logPath = path.join(dir, 'audit.jsonl');
  }

  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    const full: AuditEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    try {
      fs.appendFileSync(this.logPath, JSON.stringify(full) + '\n');
    } catch (err) {
      // Audit log write failure should never crash the plugin
      console.error('[aristotle] audit log write failed:', err);
    }
  }

  /** Read recent entries for the audit CLI command */
  recent(count: number = 20): AuditEntry[] {
    try {
      if (!fs.existsSync(this.logPath)) return [];
      const lines = fs.readFileSync(this.logPath, 'utf-8')
        .trim()
        .split('\n')
        .filter(Boolean);
      return lines
        .slice(-count)
        .map(line => JSON.parse(line) as AuditEntry);
    } catch {
      return [];
    }
  }

  /** Get log file size in bytes for doctor command */
  sizeBytes(): number {
    try {
      if (!fs.existsSync(this.logPath)) return 0;
      return fs.statSync(this.logPath).size;
    } catch {
      return 0;
    }
  }

  /** Archive logs older than N days */
  archive(daysOld: number = 30): number {
    try {
      if (!fs.existsSync(this.logPath)) return 0;
      const lines = fs.readFileSync(this.logPath, 'utf-8')
        .trim()
        .split('\n')
        .filter(Boolean);

      const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      const keep: string[] = [];
      let archived = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as AuditEntry;
          if (new Date(entry.timestamp).getTime() < cutoff) {
            archived++;
          } else {
            keep.push(line);
          }
        } catch {
          keep.push(line); // Keep unparseable lines
        }
      }

      if (archived > 0) {
        // Write archived entries to archive file
        const archiveDir = path.dirname(this.logPath);
        const archivePath = path.join(archiveDir, `audit-archive-${new Date().toISOString().slice(0, 10)}.jsonl`);
        const archiveLines = lines.filter(line => {
          try {
            const entry = JSON.parse(line) as AuditEntry;
            return new Date(entry.timestamp).getTime() < cutoff;
          } catch {
            return false;
          }
        });
        fs.appendFileSync(archivePath, archiveLines.join('\n') + '\n');
        // Rewrite main log with only recent entries
        fs.writeFileSync(this.logPath, keep.join('\n') + (keep.length ? '\n' : ''));
      }

      return archived;
    } catch {
      return 0;
    }
  }
}
