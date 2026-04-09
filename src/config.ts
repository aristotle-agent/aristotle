import type { AristotleConfig, ContextThreshold } from './types.js';

export const DEFAULT_THRESHOLDS: ContextThreshold[] = [
  { percentage: 50, action: 'log', message: 'Context at 50% — monitoring' },
  { percentage: 65, action: 'compact', message: '⟁ Context Shield: approaching capacity. Compacting now.' },
  { percentage: 70, action: 'alert_and_end', message: '⟁ Context Shield: session at capacity. Starting fresh to protect memory.' },
  { percentage: 75, action: 'hard_stop', message: '⟁ Context Shield: hard ceiling reached.' },
];

export const DEFAULT_CONFIG: AristotleConfig = {
  ownerName: '',
  agentName: '',
  telegramChatId: '',
  reportChannel: 'telegram',
  reportTarget: '',
  timezone: 'America/New_York',
  workspacePath: '~/.openclaw/workspace',
  mode: 'enforce',
  protectionMode: 'guarded',
  protectedFiles: [
    'AGENTS.md',
    'SOUL.md',
    'IDENTITY.md',
    'HEARTBEAT.md',
    'protocols/BOOT_SEQUENCE.md',
    'protocols/agents-reference.md',
    'protocols/templates/QC_TELEGRAM_REPORT_TEMPLATE.md',
  ],
  guard: {
    enabled: true,
  },
  contextShield: {
    enabled: true,
    thresholds: DEFAULT_THRESHOLDS,
    checkEveryNCalls: 50,
  },
  qc: {
    activeSession: {
      enabled: true,
      checkEveryNCalls: 50,
    },
  },
};

/** Protected bootstrap files — chmod 444, never agent-writable */
export const PROTECTED_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'IDENTITY.md',
  'HEARTBEAT.md',
  'protocols/BOOT_SEQUENCE.md',
  'protocols/agents-reference.md',
  'protocols/templates/QC_TELEGRAM_REPORT_TEMPLATE.md',
];

/** Credential patterns that should never appear in .md file content */
export const CREDENTIAL_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,           // Anthropic / OpenAI keys
  /api_key\s*[=:]\s*\S+/i,         // Generic API key assignments
  /BOT_TOKEN\s*[=:]\s*\S+/i,       // Bot tokens
  /client_secret\s*[=:]\s*\S+/i,   // OAuth secrets
  /TODOIST_API_TOKEN\s*[=:]\s*\S+/i, // Todoist tokens
];

/** Dangerous shell command patterns */
export const DANGEROUS_COMMANDS = [
  /gateway\s+stop/,                 // Unloads LaunchAgent — use restart
  /--token\s+\S+/,                  // Credential as CLI arg
  /--api[_-]?key\s+\S+/i,          // API key as CLI arg
  /\bsk-[a-zA-Z0-9]{20,}/,         // Bare credential in command
];

/** Destructive commands requiring confirmation */
export const DESTRUCTIVE_COMMANDS = [
  /rm\s+-rf\s/,                     // Recursive force delete
  /rm\s+-r\s/,                      // Recursive delete
];

/** QC log filename pattern */
export const QC_LOG_PATTERN = /^\d{4}-\d{2}-\d{2}-.+-qc\.md$/;

/** Daily log path pattern */
export const DAILY_LOG_PATTERN = /^memory\/\d{4}-\d{2}-\d{2}\.md$/;

/** AGENTS.md size warning threshold (chars) */
export const AGENTS_SIZE_WARNING = 15000;

/** Bootstrap files checked for truncation */
export const BOOTSTRAP_FILES = [
  'AGENTS.md', 'SOUL.md', 'MEMORY.md', 'IDENTITY.md',
  'USER.md', 'TOOLS.md', 'HEARTBEAT.md',
];

/** Per-file character limit (OpenClaw silently truncates above this) */
export const BOOTSTRAP_PER_FILE_LIMIT = 20000;

/** Total bootstrap character limit */
export const BOOTSTRAP_TOTAL_LIMIT = 150000;

/** Warning threshold per file */
export const BOOTSTRAP_WARNING_THRESHOLD = 15000;
