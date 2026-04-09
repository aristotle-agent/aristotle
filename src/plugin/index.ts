import * as fs from 'fs';
import * as path from 'path';
import { Guard } from '../guard/engine.js';
import { ContextShield } from '../context-shield/monitor.js';
import { ActiveSessionQC } from '../qc/active-session.js';
import { PendingChanges } from '../storage/pending-changes.js';
import { setPendingChanges, setProtectionMode } from '../guard/rules.js';
import type { AristotleConfig } from '../types.js';
import { DEFAULT_CONFIG } from '../config.js';

/**
 * Aristotle Plugin Entry Point
 *
 * IMPORTANT: register() must be SYNCHRONOUS — the OpenClaw gateway
 * ignores async plugin registration (the returned promise is not awaited).
 *
 * Matches ClawBands' proven working pattern:
 * - Export { id, name, register(api) }
 * - Hook handler is async (event, ctx) => {}
 * - Returns { block: true, blockReason } to deny, {} to allow
 */

// Module-level flag: prevent duplicate registration messages
let _aristotleRegistered = false;

export default {
  id: 'aristotle',
  name: 'Aristotle',

  register(api: any): void {
    // ─── LOAD CONFIG ───
    const openclawHome = process.env.OPENCLAW_HOME || path.join(
      process.env.HOME || '~',
      '.openclaw',
    );

    const configPath = path.join(openclawHome, 'aristotle', 'policy.json');
    let config: AristotleConfig = DEFAULT_CONFIG;

    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      } else {
        console.log('[aristotle] No policy.json found. Run "aristotle init" to configure. Using defaults.');
      }
    } catch (err) {
      console.error('[aristotle] Failed to load policy.json, using defaults:', err);
    }

    // Resolve workspace path
    const workspacePath = config.workspacePath.replace('~', process.env.HOME || '');

    // ─── INITIALIZE COMPONENTS ───
    const aristotleDir = path.join(openclawHome, 'aristotle');
    const pendingChanges = new PendingChanges(aristotleDir);
    setPendingChanges(pendingChanges);
    setProtectionMode(config.protectionMode || 'guarded');

    const guard = new Guard(workspacePath, openclawHome, config.mode, config.protectedFiles);
    const auditLog = guard.getAuditLog();

    const contextShield = config.contextShield.enabled
      ? new ContextShield('main', openclawHome, auditLog, config.contextShield.thresholds)
      : null;

    const activeQC = config.qc.activeSession.enabled
      ? new ActiveSessionQC(workspacePath, auditLog)
      : null;

    const checkInterval = config.contextShield.checkEveryNCalls;

    // ─── REGISTER HOOK ───
    if (config.guard.enabled) {
      // Match ClawBands' exact pattern: async (event, ctx) => { ... }
      const hookHandler = async (event: any, ctx: any) => {
        const toolName: string = event.toolName || '';
        const params = event.params || {};

        // ── Guard evaluation ──
        const result = guard.evaluate(toolName, params);
        if (result && result.block) {
          return {
            block: true,
            blockReason: guard.formatBlockMessage(result),
          };
        }

        // ── Periodic checks (every N tool calls) ──
        const callCount = guard.getToolCallCount();

        if (callCount > 0 && callCount % checkInterval === 0) {

          // Context Shield check
          if (contextShield) {
            const shieldResult = contextShield.check(callCount);
            if (shieldResult) {
              auditLog.log({
                component: 'context_shield',
                action: `THRESHOLD_${shieldResult.action.toUpperCase()}`,
                detail: `Context at ${shieldResult.reading.percentage}% (${shieldResult.reading.currentTokens}/${shieldResult.reading.maxTokens} tokens).`,
              });
            }
          }

          // QC active-session checks
          if (activeQC) {
            setImmediate(() => {
              try {
                activeQC.runChecks();
              } catch (err) {
                console.error('[aristotle] QC active-session check failed:', err);
              }
            });
          }
        }

        // Allow the tool call to proceed
        return {};
      };

      // Register using api.on() — same method ClawBands uses
      try {
        if (api.on) {
          api.on('before_tool_call', hookHandler);
          if (!_aristotleRegistered) {
            console.log('[aristotle] ⟁ Hook registered: api.on(before_tool_call)');
          }
        } else {
          console.warn('[aristotle] api.on not available — hook not registered');
        }
      } catch (err) {
        console.error('[aristotle] Hook registration failed:', err);
      }

      if (!_aristotleRegistered) {
        // Log successful registration (once per process)
        auditLog.log({
          component: 'guard',
          action: 'REGISTERED',
          detail: `Aristotle Guard active. Mode: ${config.mode}. Rules: ${guard.getRuleCount().total}. Context Shield: ${contextShield ? 'enabled' : 'disabled'}. Active QC: ${activeQC ? 'enabled' : 'disabled'}.`,
        });

        const counts = guard.getRuleCount();
        console.log(
          `[aristotle] ⟁ Guard active (${counts.total} rules: ${counts.hardGates} gates, ${counts.validators} validators, ${counts.softWarnings} warnings). Mode: ${config.mode}.`,
        );
        if (contextShield) {
          console.log(`[aristotle] ⟁ Context Shield active (check every ${checkInterval} tool calls).`);
        }
        if (activeQC) {
          console.log(`[aristotle] ⟁ QC active-session enabled (check every ${checkInterval} tool calls).`);
        }
        _aristotleRegistered = true;
      }
    } else {
      console.log('[aristotle] Guard disabled in policy.json. No enforcement active.');
    }
  },
};
