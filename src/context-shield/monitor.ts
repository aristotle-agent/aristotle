import * as fs from 'fs';
import * as path from 'path';
import type { ContextReading, ContextThreshold, ContextAction, DetectionTier } from '../types.js';
import { DEFAULT_THRESHOLDS } from '../config.js';
import { AuditLog } from '../storage/audit-log.js';

export class ContextShield {
  private agentId: string;
  private openclawHome: string;
  private thresholds: ContextThreshold[];
  private auditLog: AuditLog;
  private lastAction: ContextAction | null = null;

  constructor(
    agentId: string,
    openclawHome: string,
    auditLog: AuditLog,
    thresholds?: ContextThreshold[],
  ) {
    this.agentId = agentId;
    this.openclawHome = openclawHome;
    this.thresholds = thresholds || DEFAULT_THRESHOLDS;
    this.auditLog = auditLog;
  }

  /**
   * Check context usage and return the appropriate action.
   * Tries Tier B (JSONL) first, falls back to Tier C (counting).
   * Tier A (ContextEngine) would be injected externally if available.
   */
  check(toolCallCount: number): { action: ContextAction; reading: ContextReading } | null {
    // Try Tier B — JSONL transcript parsing
    const reading = this.readFromJsonl();

    if (reading) {
      return this.evaluateThresholds(reading);
    }

    // Fall back to Tier C — tool-call counting
    const estimate = this.estimateFromCounting(toolCallCount);
    if (estimate) {
      return this.evaluateThresholds(estimate);
    }

    return null;
  }

  /**
   * Tier B: Read the most recent session's JSONL file and extract
   * the last assistant message's usage.input as current context size.
   */
  private readFromJsonl(): ContextReading | null {
    try {
      const sessionsDir = path.join(
        this.openclawHome,
        'agents',
        this.agentId,
        'sessions',
      );

      if (!fs.existsSync(sessionsDir)) return null;

      // Find the most recently modified JSONL file
      const files = fs.readdirSync(sessionsDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
          name: f,
          path: path.join(sessionsDir, f),
          mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length === 0) return null;

      const latestFile = files[0].path;

      // Read the last ~5000 chars to find the most recent assistant message with usage
      const stat = fs.statSync(latestFile);
      const readSize = Math.min(stat.size, 5000);
      const fd = fs.openSync(latestFile, 'r');
      const buffer = Buffer.alloc(readSize);
      fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
      fs.closeSync(fd);

      const tail = buffer.toString('utf-8');
      const lines = tail.split('\n').filter(Boolean);

      // Walk backwards to find the most recent assistant message with usage data
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (
            entry?.type === 'message' &&
            entry?.message?.role === 'assistant' &&
            entry?.message?.usage?.input > 0
          ) {
            const inputTokens = entry.message.usage.input as number;

            // Get model context window from the entry or use a sensible default
            // Models typically have 32K-200K windows
            const maxTokens = this.inferContextWindow(entry.message.model);

            return {
              tier: 'jsonl',
              currentTokens: inputTokens,
              maxTokens,
              percentage: Math.round((inputTokens / maxTokens) * 100),
              timestamp: Date.now(),
            };
          }
        } catch {
          // Skip unparseable lines
        }
      }

      return null;
    } catch (err) {
      this.auditLog.log({
        component: 'context_shield',
        action: 'JSONL_READ_FAILED',
        detail: `Failed to read JSONL: ${err}`,
      });
      return null;
    }
  }

  /**
   * Tier C: Rough estimate from tool call count.
   * Baseline: ~15K tokens (system prompt + bootstrap)
   * Per tool call: ~300 tokens average
   */
  private estimateFromCounting(toolCallCount: number): ContextReading | null {
    const baseline = 15000;
    const perCall = 300;
    const estimated = baseline + (toolCallCount * perCall);
    // Assume 200K context window as conservative default
    const maxTokens = 200000;

    return {
      tier: 'counting',
      currentTokens: estimated,
      maxTokens,
      percentage: Math.round((estimated / maxTokens) * 100),
      timestamp: Date.now(),
    };
  }

  /**
   * Infer context window size from model name.
   */
  private inferContextWindow(model: string | undefined): number {
    if (!model) return 200000;
    const m = model.toLowerCase();
    if (m.includes('gemini-2.5-flash')) return 33000; // 32K effective
    if (m.includes('gemini')) return 1000000;
    if (m.includes('claude') || m.includes('anthropic')) return 200000;
    if (m.includes('gpt-5')) return 200000;
    if (m.includes('gpt-4')) return 128000;
    if (m.includes('llama')) return 32768;
    if (m.includes('deepseek')) return 128000;
    return 200000; // Conservative default
  }

  /**
   * Evaluate a reading against thresholds and return the highest
   * triggered action. Only triggers each threshold level once
   * (doesn't re-trigger compact if already compacted).
   */
  private evaluateThresholds(
    reading: ContextReading,
  ): { action: ContextAction; reading: ContextReading } | null {
    // Find the highest threshold that the reading exceeds
    let highestAction: ContextAction | null = null;
    let highestThreshold: ContextThreshold | null = null;

    for (const threshold of this.thresholds) {
      if (reading.percentage >= threshold.percentage) {
        highestAction = threshold.action;
        highestThreshold = threshold;
      }
    }

    if (!highestAction || !highestThreshold) return null;

    // Don't re-trigger the same or lower action
    const actionPriority: Record<ContextAction, number> = {
      log: 0,
      compact: 1,
      alert_and_end: 2,
      hard_stop: 3,
    };

    if (
      this.lastAction &&
      actionPriority[highestAction] <= actionPriority[this.lastAction]
    ) {
      return null;
    }

    this.lastAction = highestAction;

    this.auditLog.log({
      component: 'context_shield',
      action: `THRESHOLD_${highestAction.toUpperCase()}`,
      detail: `Context at ${reading.percentage}% (${reading.currentTokens.toLocaleString()}/${reading.maxTokens.toLocaleString()} tokens) via ${reading.tier}. ${highestThreshold.message || ''}`,
    });

    return { action: highestAction, reading };
  }

  /** Reset state on session reset */
  reset(): void {
    this.lastAction = null;
  }
}
