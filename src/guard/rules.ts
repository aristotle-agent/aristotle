import type { GuardRule, GuardResult, ToolCallParams } from '../types.js';
import {
  PROTECTED_FILES,
  CREDENTIAL_PATTERNS,
  DANGEROUS_COMMANDS,
  DESTRUCTIVE_COMMANDS,
  QC_LOG_PATTERN,
  DAILY_LOG_PATTERN,
  AGENTS_SIZE_WARNING,
} from '../config.js';
import { PendingChanges } from '../storage/pending-changes.js';
import * as fs from 'fs';
import * as path from 'path';

/** Module-level pending changes instance */
let _pendingChanges: PendingChanges | null = null;
let _protectionMode: 'guarded' | 'locked' = 'guarded';

export function setPendingChanges(pc: PendingChanges): void {
  _pendingChanges = pc;
}

export function setProtectionMode(mode: 'guarded' | 'locked'): void {
  _protectionMode = mode;
}

/**
 * Normalize a file path from tool params to a workspace-relative path.
 * Handles both absolute paths and relative paths.
 */
function normalizePath(filePath: string | undefined, workspacePath: string): string {
  if (!filePath) return '';
  const resolved = path.resolve(workspacePath, filePath);
  return path.relative(workspacePath, resolved);
}

/**
 * Check if a path matches any protected file.
 */
function isProtectedFile(relativePath: string, protectedFiles: string[]): string | null {
  for (const protected_file of protectedFiles) {
    if (relativePath === protected_file || relativePath.endsWith('/' + protected_file)) {
      return protected_file;
    }
  }
  return null;
}

// ─── TIER 1: HARD GATES ───

function createFileProtectionRules(workspacePath: string, protectedFiles: string[]): GuardRule[] {
  return [{
    id: 'guard-001',
    tier: 'hard_gate',
    description: 'Protect bootstrap files — queue for approval (guarded) or block (locked)',
    tools: ['write', 'edit'],
    check: (toolName: string, params: ToolCallParams): GuardResult | null => {
      const filePath = (params.file_path || params.path || '') as string;
      const relative = normalizePath(filePath, workspacePath);
      const match = isProtectedFile(relative, protectedFiles);

      if (match) {
        if (_protectionMode === 'guarded' && _pendingChanges) {
          // Extract content summary (first 80 chars of content)
          const content = (params.content || params.file_text || '') as string;
          const summary = content.slice(0, 80).replace(/\n/g, ' ').trim() || '(content not captured)';

          _pendingChanges.add({
            file: match,
            content: content,
            action: toolName as 'write' | 'edit',
            date: new Date().toISOString().slice(0, 10),
            summary: summary,
          });

          return {
            block: true,
            reason: `Change to ${match} saved for owner review.`,
            redirect: 'Aristotle is holding this change for your owner to approve. ' +
              'They will see it in the next weekly pending changes report. ' +
              'Continue with your other tasks.',
            ruleId: 'guard-001',
            tier: 'hard_gate',
          };
        }

        // Locked mode — hard block
        const isAgentsMd = match === 'AGENTS.md';
        return {
          block: true,
          reason: `${match} is locked (protection mode: locked). Protected by Aristotle.`,
          redirect: isAgentsMd
            ? 'Self-improvement notes go to memory/qc/ only. Owner adds to AGENTS.md via terminal.'
            : 'This file can only be edited by the owner via terminal.',
          ruleId: 'guard-001',
          tier: 'hard_gate',
        };
      }
      return null;
    },
  }];
}

function createCommandProtectionRules(workspacePath: string): GuardRule[] {
  return [
    {
      id: 'guard-002',
      tier: 'hard_gate',
      description: 'Block openclaw gateway stop',
      tools: ['exec', 'bash'],
      check: (_toolName: string, params: ToolCallParams): GuardResult | null => {
        const cmd = (params.command || '') as string;
        if (/gateway\s+stop/.test(cmd)) {
          return {
            block: true,
            reason: 'openclaw gateway stop fully unloads the LaunchAgent service, causing a crash.',
            redirect: 'Use "openclaw gateway restart" instead. It safely restarts without unloading.',
            ruleId: 'guard-002',
            tier: 'hard_gate',
          };
        }
        return null;
      },
    },
    {
      id: 'guard-003',
      tier: 'hard_gate',
      description: 'Block credentials as CLI arguments',
      tools: ['exec', 'bash'],
      check: (_toolName: string, params: ToolCallParams): GuardResult | null => {
        const cmd = (params.command || '') as string;
        for (const pattern of DANGEROUS_COMMANDS) {
          if (pattern.test(cmd) && !/gateway\s+stop/.test(cmd)) {
            // gateway stop is handled by guard-002
            return {
              block: true,
              reason: 'Credentials must never be passed as CLI arguments. They are visible in process listings and shell history.',
              redirect: 'Extract credentials from ~/.openclaw/.env using: grep VARIABLE_NAME ~/.openclaw/.env | cut -d= -f2 | tr -d "\\n"',
              ruleId: 'guard-003',
              tier: 'hard_gate',
            };
          }
        }
        return null;
      },
    },
    {
      id: 'guard-004',
      tier: 'hard_gate',
      description: 'Block destructive commands outside scratch zones',
      tools: ['exec', 'bash'],
      check: (_toolName: string, params: ToolCallParams): GuardResult | null => {
        const cmd = (params.command || '') as string;

        // Only check destructive patterns
        let isDestructive = false;
        for (const pattern of DESTRUCTIVE_COMMANDS) {
          if (pattern.test(cmd)) {
            isDestructive = true;
            break;
          }
        }
        if (!isDestructive) return null;

        // Extract target path(s) from the command
        // Match paths after rm -rf, rm -r, etc.
        const pathMatches = cmd.match(/rm\s+(?:-[rfdi]+\s+)*(.+)/);
        const targets = pathMatches ? pathMatches[1].trim().split(/\s+/) : [];

        // Resolve home directory
        const home = process.env.HOME || '/home/user';

        // Scratch zones — destructive commands are allowed here
        const scratchZones = [
          '/tmp/',
          '/private/tmp/',
          `${home}/tmp/`,
          `${home}/scratch/`,
          `${workspacePath}/tmp/`,
          '.openclaw-sandbox',
        ];

        // Memory zones — destructive commands are NEVER allowed here
        const memoryZones = [
          `${workspacePath}/AGENTS.md`,
          `${workspacePath}/SOUL.md`,
          `${workspacePath}/MEMORY.md`,
          `${workspacePath}/IDENTITY.md`,
          `${workspacePath}/HEARTBEAT.md`,
          `${workspacePath}/memory/`,
          `${workspacePath}/protocols/`,
        ];

        // Check each target
        for (const target of targets) {
          const resolved = target.replace(/^~/, home);
          const abs = path.resolve(resolved);

          // Block if targeting memory zones
          for (const mz of memoryZones) {
            if (abs.startsWith(mz) || abs === mz.replace(/\/$/, '')) {
              return {
                block: true,
                reason: `Blocked: recursive delete targets memory path "${target}".`,
                redirect: 'Memory files are protected by Aristotle. ' +
                  'Use specific file operations instead of recursive delete.',
                ruleId: 'guard-004',
                tier: 'hard_gate',
              };
            }
          }

          // Allow if entirely within scratch zones
          let inScratch = false;
          for (const sz of scratchZones) {
            if (abs.startsWith(sz) || abs.includes(sz)) {
              inScratch = true;
              break;
            }
          }
          if (inScratch) continue;

          // Not in scratch, not in memory — allow but it's not our job to police
          // Aristotle protects memory, not the whole filesystem
        }

        return null;
      },
    },
  ];
}

// ─── TIER 2: VALIDATORS ───

function createValidatorRules(workspacePath: string): GuardRule[] {
  return [
    {
      id: 'guard-010',
      tier: 'validator',
      description: 'Block edit tool on daily log files — must use exec append',
      tools: ['edit'],
      check: (toolName: string, params: ToolCallParams): GuardResult | null => {
        if (toolName !== 'edit') return null;
        const filePath = (params.file_path || params.path || '') as string;
        const relative = normalizePath(filePath, workspacePath);
        if (DAILY_LOG_PATTERN.test(relative)) {
          return {
            block: true,
            reason: 'Edit tool on daily logs causes silent corruption. Edit requires exact string match on file content — fails on new or modified files.',
            redirect: 'Use exec append instead: exec: echo "[entry]" >> memory/$(date +%Y-%m-%d).md',
            ruleId: 'guard-010',
            tier: 'validator',
          };
        }
        return null;
      },
    },
    {
      id: 'guard-011',
      tier: 'validator',
      description: 'Block credential patterns in .md file write content',
      tools: ['write'],
      check: (_toolName: string, params: ToolCallParams): GuardResult | null => {
        const filePath = (params.file_path || params.path || '') as string;
        const content = (params.content || '') as string;
        if (!filePath.endsWith('.md')) return null;

        for (const pattern of CREDENTIAL_PATTERNS) {
          if (pattern.test(content)) {
            return {
              block: true,
              reason: 'Credential pattern detected in file content. Credentials must never be stored in workspace files.',
              redirect: 'Store credentials in ~/.openclaw/.env (chmod 600) only. Reference them with grep/cut pattern.',
              ruleId: 'guard-011',
              tier: 'validator',
            };
          }
        }
        return null;
      },
    },
    {
      id: 'guard-012',
      tier: 'validator',
      description: 'Validate QC log filename format',
      tools: ['write'],
      check: (_toolName: string, params: ToolCallParams): GuardResult | null => {
        const filePath = (params.file_path || params.path || '') as string;
        const relative = normalizePath(filePath, workspacePath);

        // Only check files written to memory/qc/
        if (!relative.startsWith('memory/qc/')) return null;
        // Skip weekly recap files
        if (relative.includes('weekly/')) return null;

        const filename = path.basename(relative);
        if (!QC_LOG_PATTERN.test(filename)) {
          return {
            block: true,
            reason: `QC log filename "${filename}" doesn't match required format.`,
            redirect: 'QC logs must be named: YYYY-MM-DD-{agentname}-qc.md (e.g., 2026-03-27-aristotle-qc.md)',
            ruleId: 'guard-012',
            tier: 'validator',
          };
        }
        return null;
      },
    },
    {
      id: 'guard-014',
      tier: 'validator',
      description: 'Prevent destructive overwrites of memory files',
      tools: ['write'],
      check: (_toolName: string, params: ToolCallParams): GuardResult | null => {
        const filePath = (params.file_path || params.path || '') as string;
        const relative = normalizePath(filePath, workspacePath);
        const newContent = (params.content || (params as any).file_text || '') as string;

        const isMemoryFile =
          relative === 'MEMORY.md' || relative === 'memory.md' ||
          /^memory\/\d{4}-\d{2}-\d{2}\.md$/.test(relative);
        if (!isMemoryFile) return null;

        try {
          const fullPath = path.join(workspacePath, relative);
          if (!fs.existsSync(fullPath)) return null;
          const existing = fs.readFileSync(fullPath, 'utf-8');
          if (existing.length < 500) return null;
          const ratio = newContent.length / existing.length;
          if (ratio >= 0.3) return null;

          return {
            block: true,
            reason: `${relative} has ${existing.length.toLocaleString()} characters. ` +
              `This write would replace it with ${newContent.length.toLocaleString()} ` +
              `characters (${Math.round(ratio * 100)}%).`,
            redirect: 'Memory files must be appended to, not overwritten. ' +
              `Use exec append: echo '[content]' >> ${filePath} — ` +
              'or use the edit tool to modify specific sections.',
            ruleId: 'guard-014',
            tier: 'validator',
          };
        } catch { return null; }
      },
    },
    {
      id: 'guard-015',
      tier: 'validator',
      description: 'Require memory context in sub-agent spawns for active projects',
      tools: ['sessions_spawn'],
      check: (_toolName: string, params: ToolCallParams): GuardResult | null => {
        const task = (params.task || params.message || '') as string;

        // Long tasks likely include sufficient context already
        if (task.length >= 300) return null;

        const contDir = path.join(workspacePath, 'memory', 'continuity');
        try {
          if (!fs.existsSync(contDir)) return null;
          const files = fs.readdirSync(contDir)
            .filter((f: string) => f.endsWith('.md'));
          if (files.length === 0) return null;

          // Check if the task text relates to any active continuity file
          // by looking for keyword overlap between file names and task text
          const taskLower = task.toLowerCase();
          const relevantFiles = files.filter((f: string) => {
            // Extract keywords from filename (split on hyphens, underscores, spaces)
            const keywords = f.replace('.md', '')
              .split(/[-_\s]+/)
              .filter((w: string) => w.length > 3); // skip short words like "the", "and"
            return keywords.some((kw: string) => taskLower.includes(kw.toLowerCase()));
          });

          // If no continuity files relate to this task, allow it
          // (e.g. weather lookup when continuity files are about website project)
          if (relevantFiles.length === 0) return null;

          const fileList = relevantFiles
            .map((f: string) => f.replace('.md', ''))
            .join(', ');
          return {
            block: true,
            reason: `Sub-agent task is ${task.length} characters ` +
              `with no memory context. Related continuity files ` +
              `exist: ${fileList}.`,
            redirect:
              'Before spawning, read the relevant continuity file ' +
              'from memory/continuity/ and include its contents in ' +
              'your task parameter. Sub-agents have no access to ' +
              'memory — everything they need must be in the task text. ' +
              'Format: include a CONTEXT section with project state, ' +
              'decisions made, and constraints.',
            ruleId: 'guard-015',
            tier: 'validator',
          };
        } catch { return null; }
      },
    },
  ];
}

// ─── TIER 3: SOFT WARNINGS ───

function createSoftWarningRules(workspacePath: string): GuardRule[] {
  return [
    {
      id: 'guard-013',
      tier: 'soft_warning',
      description: 'Warn when AGENTS.md approaches size limit',
      tools: ['write', 'edit'],
      check: (_toolName: string, _params: ToolCallParams): GuardResult | null => {
        try {
          const agentsPath = path.join(workspacePath, 'AGENTS.md');
          if (!fs.existsSync(agentsPath)) return null;
          const size = fs.statSync(agentsPath).size;
          if (size > AGENTS_SIZE_WARNING) {
            return {
              block: false, // Warning only — don't block
              reason: `AGENTS.md is ${size.toLocaleString()} chars — approaching 20K limit. Risk of silent truncation.`,
              redirect: 'Move lower-priority content to protocols/agents-reference.md to reduce size.',
              ruleId: 'guard-013',
              tier: 'soft_warning',
            };
          }
        } catch {
          // File read failure — don't warn
        }
        return null;
      },
    },
  ];
}

// ─── PUBLIC API ───

/**
 * Build all Guard rules for the given workspace path.
 * Accepts optional protectedFiles list from config; falls back to hardcoded default.
 */
export function buildRules(workspacePath: string, protectedFiles?: string[]): GuardRule[] {
  const files = protectedFiles || PROTECTED_FILES;
  return [
    ...createFileProtectionRules(workspacePath, files),
    ...createCommandProtectionRules(workspacePath),
    ...createValidatorRules(workspacePath),
    ...createSoftWarningRules(workspacePath),
  ];
}
