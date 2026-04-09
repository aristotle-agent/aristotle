// Aristotle type definitions

// ─── GUARD ───

export type RuleTier = 'hard_gate' | 'validator' | 'soft_warning';

export interface GuardRule {
  id: string;
  tier: RuleTier;
  description: string;
  /** Tool names this rule applies to (e.g., 'write', 'edit', 'exec') */
  tools: string[];
  /** Check function — returns block result or null if rule doesn't apply */
  check: (toolName: string, params: ToolCallParams) => GuardResult | null;
}

export interface GuardResult {
  block: boolean;
  reason: string;
  redirect: string;
  ruleId: string;
  tier: RuleTier;
}

export interface ToolCallParams {
  [key: string]: unknown;
  file_path?: string;
  path?: string;
  content?: string;
  command?: string;
}

// ─── CONTEXT SHIELD ───

export type DetectionTier = 'context_engine' | 'jsonl' | 'counting';

export interface ContextReading {
  tier: DetectionTier;
  currentTokens: number;
  maxTokens: number;
  percentage: number;
  timestamp: number;
}

export type ContextAction = 'log' | 'compact' | 'alert_and_end' | 'hard_stop';

export interface ContextThreshold {
  percentage: number;
  action: ContextAction;
  message?: string;
}

// ─── QC ───

export interface QCCheckResult {
  check: string;
  passed: boolean;
  detail: string;
  action?: string;
}

// ─── AUDIT ───

export interface AuditEntry {
  timestamp: string;
  component: 'guard' | 'context_shield' | 'qc';
  action: string;
  detail: string;
  toolName?: string;
  ruleId?: string;
  blocked?: boolean;
}

// ─── CONFIG ───

export type ReportChannel = 'telegram' | 'discord' | 'whatsapp';

export interface AristotleConfig {
  ownerName: string;
  agentName: string;
  telegramChatId: string;
  reportChannel: ReportChannel;
  reportTarget: string;
  timezone: string;
  workspacePath: string;
  mode: 'enforce' | 'audit';
  protectionMode: 'guarded' | 'locked';
  protectedFiles: string[];
  guard: {
    enabled: boolean;
  };
  contextShield: {
    enabled: boolean;
    thresholds: ContextThreshold[];
    checkEveryNCalls: number;
  };
  qc: {
    activeSession: {
      enabled: boolean;
      checkEveryNCalls: number;
    };
  };
}

// ─── PENDING CHANGES ───

export interface PendingChange {
  id: string;
  file: string;
  content: string;
  action: 'append' | 'write' | 'edit';
  date: string;
  expiry: string;
  summary: string;
}

// ─── PLUGIN API (OpenClaw types we interact with) ───

export interface OpenClawPluginAPI {
  on: (event: string, handler: (...args: unknown[]) => unknown) => void;
  registerTool: (name: string, config: unknown) => void;
}

export interface BeforeToolCallEvent {
  toolName: string;
  toolCallId: string;
  params: ToolCallParams;
}

export interface BeforeToolCallResult {
  block?: boolean;
  blockReason?: string;
  params?: ToolCallParams;
}
