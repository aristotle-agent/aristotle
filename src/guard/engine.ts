import type { GuardRule, GuardResult, ToolCallParams } from '../types.js';
import { buildRules } from './rules.js';
import { AuditLog } from '../storage/audit-log.js';

export class Guard {
  private rules: GuardRule[];
  private auditLog: AuditLog;
  private toolCallCount: number = 0;
  private mode: 'enforce' | 'audit';
  private knownTools: Set<string>;

  constructor(workspacePath: string, openclawHome: string, mode: 'enforce' | 'audit' = 'enforce', protectedFiles?: string[]) {
    this.rules = buildRules(workspacePath, protectedFiles);
    this.auditLog = new AuditLog(openclawHome);
    this.mode = mode;
    // Pre-compute the set of all tool names any rule cares about
    // so we can skip evaluation entirely for unmatched tools
    this.knownTools = new Set(this.rules.flatMap(r => r.tools));
  }

  /**
   * Evaluate a tool call against all rules.
   * Returns the first blocking result, or null if allowed.
   */
  evaluate(toolName: string, params: ToolCallParams): GuardResult | null {
    this.toolCallCount++;

    // Fast path: if no rule cares about this tool, skip all evaluation
    if (!this.knownTools.has(toolName)) return null;

    for (const rule of this.rules) {
      // Skip rules that don't apply to this tool
      if (!rule.tools.includes(toolName)) continue;

      const result = rule.check(toolName, params);
      if (result) {
        // Log the decision
        this.auditLog.log({
          component: 'guard',
          action: result.block ? 'BLOCKED' : 'WARNING',
          detail: result.reason,
          toolName,
          ruleId: result.ruleId,
          blocked: result.block,
        });

        // In audit mode, log but don't block
        if (this.mode === 'audit' && result.block) {
          return null;
        }

        // Hard gates and validators block; soft warnings don't
        if (result.block) {
          return result;
        }
      }
    }

    // Tool call allowed — log only in verbose/debug scenarios
    // (not every allowed call to keep audit log manageable)
    return null;
  }

  /** Format a block result into the redirect message the LLM receives */
  formatBlockMessage(result: GuardResult): string {
    return [
      `⟁ ARISTOTLE GUARD: This action is not permitted.`,
      result.reason,
      result.redirect,
      `This is a policy redirect, not an error.`,
    ].join('\n');
  }

  /** Get the current tool call count (used by Context Shield and QC) */
  getToolCallCount(): number {
    return this.toolCallCount;
  }

  /** Reset tool call count (called on session reset) */
  resetToolCallCount(): void {
    this.toolCallCount = 0;
  }

  /** Get the audit log instance (shared with other components) */
  getAuditLog(): AuditLog {
    return this.auditLog;
  }

  /** Get rule count for status/doctor commands */
  getRuleCount(): { hardGates: number; validators: number; softWarnings: number; total: number } {
    const hardGates = this.rules.filter(r => r.tier === 'hard_gate').length;
    const validators = this.rules.filter(r => r.tier === 'validator').length;
    const softWarnings = this.rules.filter(r => r.tier === 'soft_warning').length;
    return { hardGates, validators, softWarnings, total: this.rules.length };
  }
}
