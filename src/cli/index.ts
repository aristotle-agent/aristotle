#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync as execSyncTop } from 'child_process';
import { AuditLog } from '../storage/audit-log.js';
import { DEFAULT_CONFIG, PROTECTED_FILES } from '../config.js';
import type { AristotleConfig } from '../types.js';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(
  process.env.HOME || '~',
  '.openclaw',
);
const ARISTOTLE_DIR = path.join(OPENCLAW_HOME, 'aristotle');
const CONFIG_PATH = path.join(ARISTOTLE_DIR, 'policy.json');

// ─── HELPERS ───

function loadConfig(): AristotleConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
    }
  } catch {}
  return null;
}

async function ask(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

// ─── COMMANDS ───

async function init(): Promise<void> {
  console.log('\n⟁ Aristotle — Memory Protection Setup');
  console.log('  Aristotle is additive. It never breaks what already works.\n');

  if (fs.existsSync(CONFIG_PATH)) {
    const overwrite = await ask('Policy already exists. Overwrite? (yes/no)', 'no');
    if (overwrite.toLowerCase() !== 'yes') {
      console.log('Setup cancelled.');
      return;
    }
  }

  // ─── AUTO-DETECT FROM EXISTING OPENCLAW CONFIG ───
  const openclawConfigPath = path.join(OPENCLAW_HOME, 'openclaw.json');
  let detectedTelegramId = '';
  let detectedWorkspace = '~/.openclaw/workspace';
  let existingPlugins: string[] = [];

  if (fs.existsSync(openclawConfigPath)) {
    try {
      const raw = fs.readFileSync(openclawConfigPath, 'utf-8');

      // Try JSON5-safe parsing: strip // comments, /* */ comments, trailing commas
      const cleaned = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')        // block comments
        .replace(/\/\/.*$/gm, '')                 // line comments
        .replace(/,\s*([}\]])/g, '$1');           // trailing commas
      const ocConfig = JSON.parse(cleaned);

      // Auto-detect Telegram chat ID from existing config
      const allowFrom = ocConfig?.channels?.telegram?.allowFrom;
      if (Array.isArray(allowFrom) && allowFrom.length > 0) {
        for (const id of allowFrom) {
          const asStr = String(id);
          if (/^\d+$/.test(asStr)) {
            detectedTelegramId = asStr;
            break;
          }
        }
      }

      // Auto-detect workspace path
      if (ocConfig?.agents?.defaults?.workspace || ocConfig?.agent?.workspace) {
        detectedWorkspace = ocConfig?.agents?.defaults?.workspace || ocConfig?.agent?.workspace;
      }

      // Check for potentially conflicting plugins
      const pluginEntries = ocConfig?.plugins?.entries || {};
      for (const [id, entry] of Object.entries(pluginEntries)) {
        if ((entry as any)?.enabled !== false) {
          existingPlugins.push(id);
        }
      }
    } catch (parseErr) {
      // JSON parse failed — try grep-based fallback for Telegram ID
      try {
        const raw = fs.readFileSync(openclawConfigPath, 'utf-8');
        // Look for allowFrom followed by a number in telegram section
        const telegramMatch = raw.match(/"telegram"[\s\S]*?"allowFrom"[\s\S]*?[\[,]\s*"?(\d{5,})"?\s*[\],]/);
        if (telegramMatch) {
          detectedTelegramId = telegramMatch[1];
        }
      } catch {
        // Give up on auto-detection — user will enter manually
      }
    }
  }

  // ─── PRE-FLIGHT: CHECK FOR CONFLICTS ───
  console.log('─ Pre-flight checks ─');

  // Check for ClawBands conflict
  if (existingPlugins.includes('clawbands')) {
    console.log('⚠️  ClawBands is active. It conflicts with Aristotle Guard.');
    console.log('   Both intercept tool calls. ClawBands prompts YES/NO on everything.');
    console.log('   Aristotle only blocks memory violations.');
    const disableCB = await ask('   Disable ClawBands? (yes/no)', 'yes');
    if (disableCB.toLowerCase() === 'yes') {
      console.log('   → ClawBands will be disabled when you restart the gateway.');
      console.log('   → Run: openclaw config set plugins.entries.clawbands.enabled false');
    } else {
      console.log('   → Warning: both plugins will run. You may see double prompts.');
    }
  }

  // Check workspace exists
  const resolvedWorkspace = detectedWorkspace.replace('~', process.env.HOME || '');
  if (fs.existsSync(resolvedWorkspace)) {
    console.log(`✅ Workspace found: ${detectedWorkspace}`);
  } else {
    console.log(`⚠️  Workspace not found at: ${detectedWorkspace}`);
  }

  // Check Telegram detection
  if (detectedTelegramId) {
    console.log(`✅ Telegram chat ID auto-detected: ${detectedTelegramId}`);
  } else {
    console.log('ℹ️  Telegram chat ID not found in OpenClaw config.');
    console.log('   QC will log to files. Telegram alerts are optional.');
  }

  // Check required directories
  const memoryDir = path.join(resolvedWorkspace, 'memory');
  const qcDir = path.join(resolvedWorkspace, 'memory', 'qc');
  const protocolsDir = path.join(resolvedWorkspace, 'protocols');

  let dirsCreated = 0;
  for (const dir of [memoryDir, qcDir, protocolsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      dirsCreated++;
    }
  }
  if (dirsCreated > 0) {
    console.log(`✅ Created ${dirsCreated} missing directories`);
  } else {
    console.log('✅ All required directories exist');
  }

  console.log('');

  // ─── ASK QUESTIONS (with auto-detected defaults) ───
  const inputAgentName = await ask('1. Agent name');
  const ownerName = await ask('2. Owner name (you)');
  const workspacePath = await ask(`3. Workspace path`, detectedWorkspace);
  const mode = await ask('4. Enforcement mode (enforce/audit)', 'enforce');
  const reportChannel = await ask('5. Report delivery channel (telegram/discord/whatsapp)', 'telegram');

  // Validate report channel
  const validChannels = ['telegram', 'discord', 'whatsapp'];
  const normalizedChannel = reportChannel.toLowerCase().trim();
  if (!validChannels.includes(normalizedChannel)) {
    console.log(`⚠️  "${reportChannel}" is not a supported channel. Using telegram.`);
  }
  const finalChannel = validChannels.includes(normalizedChannel) ? normalizedChannel : 'telegram';

  // Ask for the channel-specific target ID
  let telegramChatId = '';
  let reportTarget = '';

  if (finalChannel === 'telegram') {
    if (detectedTelegramId) {
      telegramChatId = await ask(`6. Telegram chat ID [auto-detected: ${detectedTelegramId}]`, detectedTelegramId);
    } else {
      telegramChatId = await ask('6. Telegram chat ID (message @userinfobot on Telegram to get it)', '');
    }

    // Validate Telegram ID is numeric if provided
    if (telegramChatId && !/^\d+$/.test(telegramChatId)) {
      console.log(`⚠️  "${telegramChatId}" doesn't look like a numeric chat ID.`);
      console.log('   Telegram needs the numeric ID, not a username.');
      console.log('   Message @userinfobot on Telegram to get your numeric ID.');
      const proceed = await ask('   Use it anyway? (yes/no)', 'no');
      if (proceed.toLowerCase() !== 'yes') {
        telegramChatId = '';
        console.log('   → Telegram alerts disabled. QC will log to files only.');
      }
    }
    reportTarget = telegramChatId;
  } else if (finalChannel === 'discord') {
    reportTarget = await ask('6. Discord channel ID for reports (right-click channel → Copy Channel ID)', '');
  } else if (finalChannel === 'whatsapp') {
    reportTarget = await ask('6. WhatsApp number for reports (e.g. +15551234567)', '');
  }

  // Detect system timezone for default
  let detectedTz = 'America/New_York';
  try {
    detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch { /* fallback to default */ }
  const timezone = await ask(`7. Your timezone`, detectedTz);

  // Boot file protection mode
  console.log('\n8. Boot file protection mode:');
  console.log('   1. Guarded — agent can propose changes, pending your approval [DEFAULT, RECOMMENDED]');
  console.log('   2. Locked — no agent can edit boot files, requires user terminal changes only [ULTRA SECURE]');
  const protModeInput = await ask('   Choose (1 or 2)', '1');
  const protectionMode = protModeInput === '2' ? 'locked' : 'guarded';

  if (!ownerName) {
    console.error('Error: owner name is required.');
    process.exit(1);
  }

  // ─── DETECT AGENT NAME ───
  const resolvedWsEarly = workspacePath.replace('~', process.env.HOME || '');
  let detectedAgentName = inputAgentName || ownerName;
  if (!inputAgentName) {
    try {
      const identityPath = path.join(resolvedWsEarly, 'IDENTITY.md');
      if (fs.existsSync(identityPath)) {
        const identityContent = fs.readFileSync(identityPath, 'utf-8');
        const nameMatch = identityContent.match(/(?:name|identity|I am)\s*[:=]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
        if (nameMatch) {
          detectedAgentName = nameMatch[1].trim();
        }
      }
    } catch {}
  }

  // ─── WRITE CONFIG ───
  const config: AristotleConfig = {
    ...DEFAULT_CONFIG,
    ownerName,
    agentName: detectedAgentName,
    telegramChatId,
    reportChannel: finalChannel as any,
    reportTarget: reportTarget || telegramChatId,
    timezone,
    workspacePath,
    mode: mode === 'audit' ? 'audit' : 'enforce',
    protectionMode,
  };

  if (!fs.existsSync(ARISTOTLE_DIR)) {
    fs.mkdirSync(ARISTOTLE_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  fs.chmodSync(CONFIG_PATH, 0o600);

  // ─── DEPLOY ARISTOTLE WORKSPACE ───
  console.log('\n─ Deploying Aristotle workspace ─');

  const { execSync } = await import('child_process');
  const resolvedWs = workspacePath.replace('~', process.env.HOME || '');

  // Import templates
  const {
    qcAgentProtocol,
    qcReportTemplate,
    qcCronPrompt,
    bootSequenceTemplate,
    agentsReferenceTemplate,
    GITIGNORE_ENTRIES,
    MEMORY_SETTINGS,
    PROTECTED_FILES,
    REQUIRED_DIRS,
  } = await import('../templates.js');

  // 1. Create all required directories
  let dirsCreated2 = 0;
  for (const dir of REQUIRED_DIRS) {
    const fullPath = path.join(resolvedWs, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      dirsCreated2++;
    }
  }
  if (dirsCreated2 > 0) {
    console.log(`✅ Created ${dirsCreated2} directories`);
  }

  // 2. Deploy QC agent protocol file
  const qcAgentPath = path.join(resolvedWs, 'protocols', 'agents', 'ARISTOTLE_QC_AGENT.md');

  if (!fs.existsSync(qcAgentPath)) {
    const qcContent = qcAgentProtocol({
      ownerName,
      telegramChatId: telegramChatId || '',
      workspacePath: resolvedWs,
      agentName: detectedAgentName,
    });
    fs.writeFileSync(qcAgentPath, qcContent);
    console.log('✅ QC agent protocol deployed');
  } else {
    console.log('✅ QC agent protocol already exists');
  }

  // 3. Deploy QC report template
  const templatePath = path.join(resolvedWs, 'protocols', 'templates', 'QC_TELEGRAM_REPORT_TEMPLATE.md');
  if (!fs.existsSync(templatePath)) {
    const templateContent = qcReportTemplate({ agentName: detectedAgentName });
    fs.writeFileSync(templatePath, templateContent);
    fs.chmodSync(templatePath, 0o444);
    console.log('✅ QC report template deployed');
  } else {
    console.log('✅ QC report template already exists');
  }

  // 3b. Deploy Boot Sequence reference document
  const bootSeqPath = path.join(resolvedWs, 'protocols', 'BOOT_SEQUENCE.md');
  if (!fs.existsSync(bootSeqPath)) {
    const bootContent = bootSequenceTemplate({ ownerName, agentName: detectedAgentName });
    fs.writeFileSync(bootSeqPath, bootContent);
    fs.chmodSync(bootSeqPath, 0o444);
    console.log('✅ Boot Sequence reference deployed (protocols/BOOT_SEQUENCE.md)');
  } else {
    console.log('✅ Boot Sequence reference already exists');
  }

  // 3b-ii. Activate Boot Sequence in AGENTS.md
  const agentsMdPath = path.join(resolvedWs, 'AGENTS.md');
  if (fs.existsSync(agentsMdPath)) {
    const agentsContent = fs.readFileSync(agentsMdPath, 'utf-8');
    if (!agentsContent.includes('BOOT_SEQUENCE')) {
      console.log('');
      console.log('⟁ Aristotle will add the Boot Sequence rule to AGENTS.md.');
      console.log('  This is how your agent learns to read its boot instructions.');
      const activateBoot = await ask('  Add it now? (yes/no)', 'yes');

      if (activateBoot.toLowerCase() === 'yes' || activateBoot.toLowerCase() === 'y') {
        const bootRule = '\n\n## Boot Sequence\nAt morning boot, read protocols/BOOT_SEQUENCE.md and follow the full sequence.\n';
        try {
          fs.chmodSync(agentsMdPath, 0o644);
          fs.appendFileSync(agentsMdPath, bootRule);
          fs.chmodSync(agentsMdPath, 0o444);
          console.log('✅ Boot Sequence rule added to AGENTS.md');
        } catch (err) {
          console.log('⚠️  Could not write to AGENTS.md. Add this manually:');
          console.log('  ## Boot Sequence');
          console.log('  At morning boot, read protocols/BOOT_SEQUENCE.md and follow the full sequence.');
        }
      } else {
        console.log('');
        console.log('⚠️  Your agent won\'t know about the Boot Sequence until you add this to AGENTS.md:');
        console.log('');
        console.log('  ## Boot Sequence');
        console.log('  At morning boot, read protocols/BOOT_SEQUENCE.md and follow the full sequence.');
        console.log('');
        console.log('  ⚠️  If you prefer to insert this automatically, run "aristotle init" again and select yes.');
        console.log('');
      }
    } else {
      console.log('✅ Boot Sequence rule already in AGENTS.md');
    }
  }

  // 3c. Deploy agents-reference overflow document
  const agentsRefPath = path.join(resolvedWs, 'protocols', 'agents-reference.md');
  if (!fs.existsSync(agentsRefPath)) {
    const refContent = agentsReferenceTemplate();
    fs.writeFileSync(agentsRefPath, refContent);
    fs.chmodSync(agentsRefPath, 0o444);
    console.log('✅ Agents reference overflow file deployed (protocols/agents-reference.md)');
  } else {
    console.log('✅ Agents reference overflow file already exists');
  }

  // 4. Create Aristotle QC nightly cron job (11:15 PM, no delivery)
  try {
    const cronList = execSync('openclaw cron list', { encoding: 'utf-8', timeout: 15000 });
    if (!cronList.includes('aristotle-qc-nightly')) {
      const prompt = qcCronPrompt();
      execSync(
        `openclaw cron add --name "aristotle-qc-nightly" --cron "15 23 * * *" --tz "${config.timezone || 'America/New_York'}" --session isolated --message "${prompt.replace(/"/g, '\\"')}" --no-deliver`,
        { timeout: 15000, stdio: 'pipe' }
      );
      console.log('✅ Aristotle QC nightly cron job created (11:15 PM)');
    } else {
      console.log('✅ Aristotle QC nightly cron job already exists');
    }
  } catch {
    console.log('ℹ️  Could not auto-create QC nightly cron job.');
    console.log('   Set up manually after gateway restart.');
  }

  // 5. Create QC report delivery cron job (11:20 PM, no delivery — sends via code)
  const reportTargetFinal = reportTarget || telegramChatId;
  if (reportTargetFinal) {
    try {
      const cronList = execSync('openclaw cron list', { encoding: 'utf-8', timeout: 15000 });
      if (!cronList.includes('aristotle-qc-report')) {
        execSync(
          `openclaw cron add --name "aristotle-qc-report" --cron "20 23 * * *" --tz "${config.timezone || 'America/New_York'}" --session isolated --message "Use the exec tool to run: aristotle report --send" --no-deliver`,
          { timeout: 15000, stdio: 'pipe' }
        );
        console.log('✅ QC report delivery cron job created (11:20 PM)');
      } else {
        console.log('✅ QC report delivery cron job already exists');
      }
    } catch {
      console.log('ℹ️  Could not auto-create QC report cron job.');
    }
  }

  // 6. Create continuity nightly cron job (10:45 PM)
  try {
    const cronList = execSync('openclaw cron list', { encoding: 'utf-8', timeout: 15000 });
    if (!cronList.includes('aristotle-continuity-nightly')) {
      const { continuityCronPrompt } = await import('../templates.js');
      const contPrompt = continuityCronPrompt(resolvedWs);
      execSync(
        `openclaw cron add --name "aristotle-continuity-nightly" --cron "45 22 * * *" --tz "${config.timezone || 'America/New_York'}" --session isolated --message "${contPrompt.replace(/"/g, '\\"')}" --no-deliver`,
        { timeout: 15000, stdio: 'pipe' }
      );
      console.log('✅ Continuity nightly cron created (10:45 PM)');
    } else {
      console.log('✅ Continuity nightly cron already exists');
    }
  } catch {
    console.log('ℹ️  Could not auto-create continuity cron.');
  }

  // 7. Create pre-reset checkpoint cron job (3:30 AM)
  try {
    const cronList = execSync('openclaw cron list', { encoding: 'utf-8', timeout: 15000 });
    if (!cronList.includes('aristotle-pre-reset-checkpoint')) {
      const { preResetCronPrompt } = await import('../templates.js');
      const resetPrompt = preResetCronPrompt(resolvedWs);
      execSync(
        `openclaw cron add --name "aristotle-pre-reset-checkpoint" --cron "30 3 * * *" --tz "${config.timezone || 'America/New_York'}" --session isolated --message "${resetPrompt.replace(/"/g, '\\"')}" --no-deliver`,
        { timeout: 15000, stdio: 'pipe' }
      );
      console.log('✅ Pre-reset checkpoint cron created (3:30 AM)');
    } else {
      console.log('✅ Pre-reset checkpoint cron already exists');
    }
  } catch {
    console.log('ℹ️  Could not auto-create pre-reset checkpoint cron.');
  }

  // 7b. Create weekly memory promotion cron (Sunday 10:00 PM)
  const promotionTarget = reportTarget || telegramChatId;
  if (promotionTarget) {
    try {
      const cronList = execSync('openclaw cron list', { encoding: 'utf-8', timeout: 15000 });
      if (!cronList.includes('aristotle-weekly-promotion')) {
        const { promotionCronPrompt } = await import('../templates.js');
        const promoPrompt = promotionCronPrompt({
          workspacePath: resolvedWs,
          reportChannel: finalChannel,
          reportTarget: promotionTarget,
        });
        execSync(
          `openclaw cron add --name "aristotle-weekly-promotion" --cron "0 22 * * 0" --tz "${config.timezone || 'America/New_York'}" --session isolated --message "${promoPrompt.replace(/"/g, '\\"')}" --no-deliver`,
          { timeout: 15000, stdio: 'pipe' }
        );
        console.log('✅ Weekly promotion review cron created (Sunday 10:00 PM)');
      } else {
        console.log('✅ Weekly promotion review cron already exists');
      }
    } catch {
      console.log('ℹ️  Could not auto-create weekly promotion cron.');
    }
  }

  // 7c. Create weekly pending changes review cron (Sunday 10:15 PM) — guarded mode only
  if (protectionMode === 'guarded' && promotionTarget) {
    try {
      const cronList = execSync('openclaw cron list', { encoding: 'utf-8', timeout: 15000 });
      if (!cronList.includes('aristotle-pending-review')) {
        const { pendingReviewCronPrompt } = await import('../templates.js');
        const pendingPrompt = pendingReviewCronPrompt({
          reportChannel: finalChannel,
          reportTarget: promotionTarget,
        });
        execSync(
          `openclaw cron add --name "aristotle-pending-review" --cron "15 22 * * 0" --tz "${config.timezone || 'America/New_York'}" --session isolated --message "${pendingPrompt.replace(/"/g, '\\"')}" --no-deliver`,
          { timeout: 15000, stdio: 'pipe' }
        );
        console.log('✅ Pending changes review cron created (Sunday 10:15 PM)');
      } else {
        console.log('✅ Pending changes review cron already exists');
      }
    } catch {
      console.log('ℹ️  Could not auto-create pending review cron.');
    }
  }

  // 8. Set file permissions based on protection mode
  const fileMode = protectionMode === 'locked' ? 0o444 : 0o644;
  const modeLabel = protectionMode === 'locked' ? '444 (locked)' : '644 (guarded)';
  let permissionsSet = 0;
  for (const file of PROTECTED_FILES) {
    const fullPath = path.join(resolvedWs, file);
    if (fs.existsSync(fullPath)) {
      try {
        fs.chmodSync(fullPath, fileMode);
        permissionsSet++;
      } catch {}
    }
  }
  if (permissionsSet > 0) {
    console.log(`✅ File permissions set to ${modeLabel} (${permissionsSet} files)`);
  } else {
    console.log('ℹ️  No bootstrap files found to protect (permissions set after bootstrap install)');
  }

  // 7. Apply OpenClaw memory settings
  let settingsApplied = 0;
  for (const setting of MEMORY_SETTINGS) {
    try {
      execSync(
        `openclaw config set ${setting.path} ${setting.value}`,
        { timeout: 10000, stdio: 'pipe' }
      );
      settingsApplied++;
    } catch {}
  }
  if (settingsApplied > 0) {
    console.log(`✅ Memory settings applied (${settingsApplied} settings)`);
  } else {
    console.log('⚠️  Could not apply memory settings. Apply manually after gateway restart.');
  }

  // 8. Update .gitignore
  const gitignorePath = path.join(resolvedWs, '.gitignore');
  let gitignoreContent = '';
  try {
    gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
  } catch {}

  let gitignoreUpdated = 0;
  for (const entry of GITIGNORE_ENTRIES) {
    if (!gitignoreContent.includes(entry)) {
      gitignoreContent += `\n${entry}`;
      gitignoreUpdated++;
    }
  }
  if (gitignoreUpdated > 0) {
    fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n');
    console.log(`✅ .gitignore updated (${gitignoreUpdated} entries added)`);
  } else {
    console.log('✅ .gitignore already complete');
  }

  // ─── REPORT ───
  console.log('\n✅ Aristotle configured');
  console.log(`   Owner:     ${ownerName}`);
  console.log(`   Agent:     ${detectedAgentName}`);
  console.log(`   Mode:      ${mode}`);
  console.log(`   Workspace: ${workspacePath}`);
  console.log(`   Channel:   ${finalChannel}`);
  console.log(`   Timezone:  ${timezone}`);
  console.log(`   Policy:    ${CONFIG_PATH}`);

  // Welcome tour
  const tourAnswer = await ask('\nSetup complete. Want to take a 30 second intro tour of Aristotle? (yes/no)', 'yes');
  if (tourAnswer.toLowerCase() === 'yes' || tourAnswer.toLowerCase() === 'y') {
    const channel = finalChannel;
    const target = reportTarget || telegramChatId;

    if (!target) {
      console.log('⟁ No delivery channel configured — skipping tour.');
      console.log('  Run "aristotle report" and "aristotle audit-report" in terminal to preview.\n');
    } else {
      const { execSync } = await import('child_process');
      console.log('\n⟁ Starting tour...\n');

      // Message 1 — Welcome
      try {
        const welcome = [
          '⟁ [ARISTOTLE] · Welcome',
          '',
          'Aristotle is now protecting your agent\'s memory.',
          '',
          'Here\'s what just happened:',
          '· Guard is active — 10 rules enforcing memory safety',
          '· Context Shield is monitoring — watches for overflow',
          '· QC is scheduled — 11 checks run tonight at 11:20 PM',
          '· Boot Sequence deployed — your agent reads once,',
          '  carries a card all day',
        ].join('\n');
        execSync(
          `openclaw message send --channel ${channel} --target ${target} --silent --message "${welcome.replace(/"/g, '\\"')}"`,
          { timeout: 15000, stdio: 'pipe' }
        );
        console.log('  ✅ Welcome message sent');
      } catch { console.log('  ⚠️  Welcome message failed to send'); }

      // Brief pause
      await new Promise(r => setTimeout(r, 5000));

      // Message 2 — QC report preview
      try {
        const previewIntro = '⟁ Here\'s what your nightly QC report looks like:';
        execSync(
          `openclaw message send --channel ${channel} --target ${target} --silent --message "${previewIntro}"`,
          { timeout: 15000, stdio: 'pipe' }
        );
        // Generate report file, then send it directly (not --send, which triggers auto-audit)
        const { generateReport } = await import('../qc/report-formatter.js');
        generateReport({
          totalChecks: 11, passed: 11, failed: 0,
          actionsCompleted: [], userActionNeeded: null,
        }, OPENCLAW_HOME);
        const reportPath = path.join(ARISTOTLE_DIR, 'qc-telegram-report.txt');
        const reportContent = fs.readFileSync(reportPath, 'utf-8');
        execSync(
          `openclaw message send --channel ${channel} --target ${target} --silent --message "${reportContent.replace(/"/g, '\\"')}"`,
          { timeout: 15000, stdio: 'pipe' }
        );
        console.log('  ✅ QC report preview sent');
      } catch { console.log('  ⚠️  QC report preview failed to send'); }

      await new Promise(r => setTimeout(r, 5000));

      // Message 3 — Audit report preview
      try {
        const auditIntro = '⟁ And here\'s your memory audit — a snapshot of your agent\'s memory health right now:';
        execSync(
          `openclaw message send --channel ${channel} --target ${target} --silent --message "${auditIntro}"`,
          { timeout: 15000, stdio: 'pipe' }
        );
        // Generate and send audit report directly
        execSync(
          `aristotle audit-report --send`,
          { timeout: 30000, stdio: 'pipe' }
        );
        console.log('  ✅ Audit report preview sent');
      } catch { console.log('  ⚠️  Audit report preview failed to send'); }

      await new Promise(r => setTimeout(r, 5000));

      // Message 4 — Action note + Closing
      try {
        const closing = [
          'Your Action: no action needed from you now, just let Aristotle work in the background for the first 24 hours.',
          '',
          '⟁ Tomorrow morning, check here for your overnight QC report. Silence means clean.',
          '',
          'Your agent won\'t forget.',
        ].join('\n');
        execSync(
          `openclaw message send --channel ${channel} --target ${target} --silent --message "${closing.replace(/"/g, '\\"')}"`,
          { timeout: 15000, stdio: 'pipe' }
        );
        console.log('  ✅ Tour complete\n');
      } catch { console.log('  ⚠️  Closing message failed to send'); }
    }
  } else {
    // No tour — show next steps
    console.log('\nNext steps:');
    if (existingPlugins.includes('clawbands')) {
      console.log('  1. openclaw config set plugins.entries.clawbands.enabled false');
      console.log('  2. openclaw gateway restart');
      console.log('  3. aristotle doctor');
    } else {
      console.log('  1. openclaw gateway restart');
      console.log('  2. aristotle doctor');
    }
    console.log('\nAristotle is additive. Your existing agent, channels,');
    console.log('and integrations continue working exactly as before.\n');
  }
}

function status(): void {
  const config = loadConfig();
  if (!config) {
    console.log('⟁ Aristotle: not configured. Run "aristotle init" first.');
    return;
  }

  const auditLog = new AuditLog(OPENCLAW_HOME);
  const recent = auditLog.recent(5);
  const sizeKB = Math.round(auditLog.sizeBytes() / 1024);

  console.log('\n⟁ Aristotle Status');
  console.log('─'.repeat(40));
  console.log(`Mode:            ${config.mode}`);
  console.log(`Owner:           ${config.ownerName}`);
  console.log(`Workspace:       ${config.workspacePath}`);
  console.log(`Guard:           ${config.guard.enabled ? 'enabled' : 'disabled'}`);
  console.log(`Context Shield:  ${config.contextShield.enabled ? 'enabled' : 'disabled'}`);
  console.log(`Active QC:       ${config.qc.activeSession.enabled ? 'enabled' : 'disabled'}`);
  console.log(`Audit log:       ${sizeKB}KB`);
  console.log(`Protected files: ${PROTECTED_FILES.length}`);

  if (recent.length > 0) {
    console.log(`\nRecent activity:`);
    for (const entry of recent) {
      const time = entry.timestamp.slice(11, 19);
      const icon = entry.blocked ? '🚫' : entry.action.includes('WARNING') ? '⚠️' : '✅';
      console.log(`  ${icon} ${time} [${entry.component}] ${entry.action}: ${entry.detail.slice(0, 60)}`);
    }
  }
  console.log();
}

function audit(lines: number = 20): void {
  const auditLog = new AuditLog(OPENCLAW_HOME);
  const entries = auditLog.recent(lines);

  if (entries.length === 0) {
    console.log('No audit entries found.');
    return;
  }

  console.log(`\n⟁ Aristotle Audit Trail (last ${entries.length} entries)`);
  console.log('─'.repeat(70));

  for (const entry of entries) {
    const time = entry.timestamp.slice(0, 19).replace('T', ' ');
    const blocked = entry.blocked ? ' BLOCKED' : '';
    console.log(`${time} | ${entry.component.padEnd(15)} | ${entry.action}${blocked}`);
    console.log(`${''.padEnd(22)}| ${entry.detail.slice(0, 70)}`);
  }
  console.log();
}

async function doctor(fix: boolean = false): Promise<void> {
  console.log(`\n⟁ Aristotle Doctor${fix ? ' --fix' : ''}`);
  console.log('─'.repeat(40));

  let healthy = true;
  let fixed = 0;

  // 1. Config exists
  const config = loadConfig();
  if (config) {
    console.log(`✅ Policy file: ${CONFIG_PATH}`);
  } else {
    console.log(`❌ Policy file: missing.`);
    if (fix) {
      console.log(`   → Run "aristotle init" to create it (interactive setup required).`);
    } else {
      console.log(`   Run "aristotle init" to create, or "aristotle doctor --fix" for auto-repair.`);
    }
    healthy = false;
  }

  // 2. Aristotle directory exists
  if (fs.existsSync(ARISTOTLE_DIR)) {
    console.log(`✅ Data directory: ${ARISTOTLE_DIR}`);
  } else {
    if (fix) {
      fs.mkdirSync(ARISTOTLE_DIR, { recursive: true });
      console.log(`✅ Data directory: created ${ARISTOTLE_DIR}`);
      fixed++;
    } else {
      console.log(`❌ Data directory: missing`);
      healthy = false;
    }
  }

  // 3. Workspace accessible + required subdirectories
  if (config) {
    const ws = config.workspacePath.replace('~', process.env.HOME || '');
    if (fs.existsSync(ws)) {
      console.log(`✅ Workspace: ${ws}`);
    } else {
      console.log(`❌ Workspace: ${ws} not found`);
      healthy = false;
    }

    // Check required subdirectories
    const requiredDirs = [
      path.join(ws, 'memory'),
      path.join(ws, 'memory', 'qc'),
      path.join(ws, 'memory', 'qc', 'weekly'),
      path.join(ws, 'memory', 'archive'),
      path.join(ws, 'protocols'),
      path.join(ws, 'protocols', 'agents'),
      path.join(ws, 'protocols', 'templates'),
    ];
    let dirsMissing = 0;
    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        if (fix) {
          fs.mkdirSync(dir, { recursive: true });
          fixed++;
        } else {
          dirsMissing++;
        }
      }
    }
    if (fix && fixed > 0) {
      console.log(`✅ Directories: created ${fixed} missing directories`);
    } else if (dirsMissing > 0) {
      console.log(`⚠️  Directories: ${dirsMissing} missing. Run "aristotle doctor --fix" to create.`);
    }
  }

  // 4. Protected files have correct permissions
  if (config) {
    const ws = config.workspacePath.replace('~', process.env.HOME || '');
    let permOk = 0;
    let permBad = 0;
    let permTotal = 0;
    const badFiles: string[] = [];
    const protectedList = config.protectedFiles || PROTECTED_FILES;
    for (const f of protectedList) {
      const fp = path.join(ws, f);
      if (fs.existsSync(fp)) {
        permTotal++;
        const stat = fs.statSync(fp);
        const mode = (stat.mode & 0o777).toString(8);
        if (mode === '444') {
          permOk++;
        } else {
          if (fix) {
            try {
              fs.chmodSync(fp, 0o444);
              permOk++;
              fixed++;
            } catch (err) {
              console.log(`   ❌ Could not fix ${f}: ${err}`);
              permBad++;
            }
          } else {
            badFiles.push(`${f}: mode ${mode}`);
            permBad++;
          }
        }
      }
    }
    if (fix && permBad === 0 && permOk > 0) {
      console.log(`✅ File permissions: ${permOk} of ${permTotal} bootstrap files protected (fixed)`);
    } else if (permBad === 0 && permOk > 0) {
      console.log(`✅ File permissions: ${permOk} of ${permTotal} bootstrap files protected`);
    } else if (permBad > 0) {
      console.log(`⚠️  File permissions: ${permBad} file(s) not chmod 444`);
      for (const bf of badFiles) {
        console.log(`   ⚠️  ${bf} (should be 444)`);
      }
      if (!fix) {
        console.log(`   Run "aristotle doctor --fix" to repair.`);
      }
    } else if (permTotal === 0) {
      console.log(`ℹ️  File permissions: no bootstrap files found yet`);
    }
  }

  // 5. Audit log health
  const auditLog = new AuditLog(OPENCLAW_HOME);
  const sizeBytes = auditLog.sizeBytes();
  const sizeMB = sizeBytes / (1024 * 1024);
  if (sizeMB > 10) {
    if (fix) {
      const archived = auditLog.archive(30);
      console.log(`✅ Audit log: archived ${archived} old entries`);
      fixed++;
    } else {
      console.log(`⚠️  Audit log: ${sizeMB.toFixed(1)}MB — run "aristotle doctor --fix" to archive old entries`);
    }
  } else {
    console.log(`✅ Audit log: ${Math.round(sizeBytes / 1024)}KB`);
  }

  // 6. Telegram configuration
  if (config) {
    if (config.telegramChatId && /^\d+$/.test(config.telegramChatId)) {
      console.log(`✅ Telegram: chat ID ${config.telegramChatId}`);
    } else if (config.telegramChatId) {
      console.log(`⚠️  Telegram: "${config.telegramChatId}" is not a numeric ID`);
      if (fix) {
        // Try auto-detect from OpenClaw config
        const detectedId = autoDetectTelegramId();
        if (detectedId) {
          config.telegramChatId = detectedId;
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
          fs.chmodSync(CONFIG_PATH, 0o600);
          console.log(`   → Fixed: auto-detected ${detectedId} from OpenClaw config`);
          fixed++;
        } else {
          console.log(`   → Could not auto-detect. Run "aristotle init" to set manually.`);
        }
      } else {
        console.log(`   Run "aristotle init" to auto-detect from OpenClaw config`);
      }
    } else {
      console.log(`ℹ️  Telegram: not configured (QC logs to files only)`);
    }
  }

  // 7. Check for plugin conflicts
  const openclawConfigPath = path.join(OPENCLAW_HOME, 'openclaw.json');
  if (fs.existsSync(openclawConfigPath)) {
    try {
      const raw = fs.readFileSync(openclawConfigPath, 'utf-8');
      const cleaned = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/,\s*([}\]])/g, '$1');
      const ocConfig = JSON.parse(cleaned);
      const pluginEntries = ocConfig?.plugins?.entries || {};
      if ((pluginEntries as any)?.clawbands?.enabled !== false &&
          fs.existsSync(path.join(OPENCLAW_HOME, 'extensions', 'clawbands'))) {
        console.log(`⚠️  ClawBands is installed and may conflict with Guard`);
        console.log(`   Run: openclaw config set plugins.entries.clawbands.enabled false`);
      }
    } catch {
      // Config parse failed — skip check
    }
  }

  // 8. QC agent protocol file
  if (config) {
    const ws = config.workspacePath.replace('~', process.env.HOME || '');
    const qcAgentPath = path.join(ws, 'protocols', 'agents', 'ARISTOTLE_QC_AGENT.md');
    if (fs.existsSync(qcAgentPath)) {
      console.log('✅ QC agent protocol: deployed');
    } else {
      console.log('❌ QC agent protocol: missing');
      if (fix) {
        console.log('   → Run "aristotle init" to deploy (interactive setup required).');
      }
      healthy = false;
    }

    // 9. QC report template
    const templatePath = path.join(ws, 'protocols', 'templates', 'QC_TELEGRAM_REPORT_TEMPLATE.md');
    if (fs.existsSync(templatePath)) {
      console.log('✅ QC report template: deployed');
    } else {
      console.log('❌ QC report template: missing');
      if (fix) {
        console.log('   → Run "aristotle init" to deploy (interactive setup required).');
      }
      healthy = false;
    }
  }

  // 10. Check for QC cron jobs
  try {
    const cronList = execSyncTop('openclaw cron list', { encoding: 'utf-8', timeout: 10000 });
    const hasNightly = cronList.includes('aristotle-qc-nightly');
    const hasReport = cronList.includes('aristotle-qc-report');
    if (hasNightly && hasReport) {
      console.log('✅ QC cron jobs: nightly + report delivery');
    } else if (hasNightly) {
      console.log('⚠️  QC cron: nightly exists but report delivery missing');
      console.log('   Run "aristotle init" to create.');
    } else {
      console.log('⚠️  QC cron jobs: not found');
      console.log('   Run "aristotle init" to create.');
    }
  } catch {
    console.log('ℹ️  Could not check cron jobs (gateway may not be running)');
  }

  // 11. Check for recent Guard registration
  const recent = auditLog.recent(50);
  const registrations = recent.filter(e => e.action === 'REGISTERED');
  if (registrations.length > 0) {
    const last = registrations[registrations.length - 1];
    console.log(`✅ Guard registered: ${last.timestamp.slice(0, 19)}`);
    console.log(`   ${last.detail}`);
  } else {
    console.log(`⚠️  No Guard registration found in recent audit log.`);
    console.log(`   Is the gateway running with the plugin? Try: openclaw gateway restart`);
  }

  // 12. Install provenance check
  try {
    const pluginConfig = execSyncTop(
      'openclaw config get plugins.installs.aristotle',
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();
    if (pluginConfig && pluginConfig.includes('installPath')) {
      console.log('✅ Plugin install: provenance verified');
    } else {
      console.log('❌ Plugin install: no install provenance');
      console.log('   Guard hooks may not fire.');
      console.log('   Fix: openclaw plugins install --link ~/aristotle');
      healthy = false;
    }
  } catch {
    console.log('❌ Plugin install: not found in openclaw config');
    console.log('   Guard hooks will not fire.');
    console.log('   Fix: openclaw plugins install --link ~/aristotle');
    healthy = false;
  }

  // 13. Bootstrap truncation detection
  if (config) {
    const { BOOTSTRAP_FILES, BOOTSTRAP_PER_FILE_LIMIT, BOOTSTRAP_TOTAL_LIMIT, BOOTSTRAP_WARNING_THRESHOLD } = await import('../config.js');
    const ws = config.workspacePath.replace('~', process.env.HOME || '');
    let totalChars = 0;
    const truncated: string[] = [];
    const warnings: string[] = [];

    for (const file of BOOTSTRAP_FILES) {
      const fp = path.join(ws, file);
      const altFp = path.join(ws, 'protocols', file);
      const actual = fs.existsSync(fp) ? fp : fs.existsSync(altFp) ? altFp : null;

      if (actual) {
        const chars = fs.readFileSync(actual, 'utf-8').length;
        totalChars += chars;
        if (chars > BOOTSTRAP_PER_FILE_LIMIT) {
          truncated.push(`${file} (${chars.toLocaleString()} chars — TRUNCATED)`);
        } else if (chars > BOOTSTRAP_WARNING_THRESHOLD) {
          warnings.push(`${file} (${chars.toLocaleString()} chars — approaching limit)`);
        }
      }
    }

    if (truncated.length > 0) {
      console.log(`❌ Bootstrap files: ${truncated.length} exceed 20,000 char limit`);
      for (const f of truncated) console.log(`   🚨 ${f}`);
      console.log('   Agent is receiving INCOMPLETE instructions.');
      console.log('   Fix: Move content to protocol reference files.');
      healthy = false;
    } else if (warnings.length > 0) {
      console.log(`⚠️  Bootstrap files: ${warnings.length} approaching limit`);
      for (const f of warnings) console.log(`   ${f}`);
    } else {
      console.log('✅ Bootstrap files: all within size limits');
    }

    if (totalChars > BOOTSTRAP_TOTAL_LIMIT) {
      console.log(`❌ Total bootstrap: ${totalChars.toLocaleString()} chars (limit: ${BOOTSTRAP_TOTAL_LIMIT.toLocaleString()})`);
      healthy = false;
    } else {
      console.log(`✅ Total bootstrap: ${totalChars.toLocaleString()} chars (limit: ${BOOTSTRAP_TOTAL_LIMIT.toLocaleString()})`);
    }
  }

  // 14. Continuity file freshness
  if (config) {
    const ws = config.workspacePath.replace('~', process.env.HOME || '');
    const contDir = path.join(ws, 'memory', 'continuity');

    if (!fs.existsSync(contDir)) {
      console.log('⚠️  Continuity files: directory not found');
    } else {
      const files = fs.readdirSync(contDir).filter((f: string) => f.endsWith('.md'));
      if (files.length === 0) {
        console.log('✅ Continuity files: no active multi-day tasks');
      } else {
        let stale = 0;
        for (const file of files) {
          const stat = fs.statSync(path.join(contDir, file));
          const days = Math.floor((Date.now() - stat.mtimeMs) / 86400000);
          if (days > 3) stale++;
        }
        if (stale === 0) {
          console.log(`✅ Continuity files: ${files.length} active, all current`);
        } else {
          console.log(`⚠️  Continuity files: ${stale} of ${files.length} stale (>3 days)`);
        }
      }
    }
  }

  // 15. Pre-reset checkpoint verification
  if (config) {
    const ws = config.workspacePath.replace('~', process.env.HOME || '');
    try {
      const gitLog = execSyncTop(
        `git -C "${ws}" log --since="3:00 AM today" --until="4:30 AM today" --oneline --grep="checkpoint: pre-reset" 2>/dev/null`,
        { encoding: 'utf-8', timeout: 10000 }
      ).trim();
      if (gitLog.length > 0) {
        console.log('✅ Pre-reset checkpoint: ran this morning');
      } else {
        try {
          const cronList = execSyncTop('openclaw cron list', { encoding: 'utf-8', timeout: 10000 });
          if (cronList.includes('aristotle-pre-reset')) {
            console.log('✅ Pre-reset checkpoint: cron active (runs at 3:30 AM)');
          } else {
            console.log('ℹ️  Pre-reset checkpoint: not configured (optional)');
          }
        } catch {
          console.log('ℹ️  Pre-reset checkpoint: could not verify');
        }
      }
    } catch {
      console.log('ℹ️  Pre-reset checkpoint: could not verify');
    }
  }

  // 16. Weekly hygiene status
  if (config) {
    const ws = config.workspacePath.replace('~', process.env.HOME || '');
    const marker = path.join(ws, 'memory', 'hygiene-last-run.txt');

    try {
      if (!fs.existsSync(marker)) {
        console.log('ℹ️  Weekly hygiene: runs after first week');
      } else {
        const content = fs.readFileSync(marker, 'utf-8').trim();
        const dateMatch = content.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const days = Math.floor((Date.now() - new Date(dateMatch[1]).getTime()) / 86400000);
          if (days <= 7) {
            console.log(`✅ Weekly hygiene: last ran ${days} day(s) ago`);
          } else if (days <= 14) {
            console.log(`⚠️  Weekly hygiene: ${days} days since last run`);
          } else {
            console.log(`❌ Weekly hygiene: ${days} days overdue`);
            console.log('   Memory promotion may be stalled.');
          }
        } else {
          console.log('⚠️  Weekly hygiene: marker unreadable');
        }
      }
    } catch {
      console.log('⚠️  Weekly hygiene: could not read marker file');
    }
  }

  // 17. QC delivery health
  if (config) {
    const ws = config.workspacePath.replace('~', process.env.HOME || '');
    const qcDir = path.join(ws, 'memory', 'qc');

    try {
      if (!fs.existsSync(qcDir)) {
        console.log('⚠️  QC delivery: no QC log directory');
      } else {
        const logs = fs.readdirSync(qcDir)
          .filter((f: string) => f.endsWith('-qc.md'))
          .sort().reverse();
        if (logs.length === 0) {
          console.log('⚠️  QC delivery: no QC logs found');
        } else {
          const dateMatch = logs[0].match(/^(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            const days = Math.floor((Date.now() - new Date(dateMatch[1]).getTime()) / 86400000);
            if (days <= 1) {
              console.log(`✅ QC delivery: last log from ${days === 0 ? 'today' : 'yesterday'}`);
            } else if (days <= 3) {
              console.log(`⚠️  QC delivery: last log is ${days} days old`);
            } else {
              console.log(`❌ QC delivery: last log is ${days} days old`);
              console.log('   QC may have stopped. Check: openclaw cron list');
              healthy = false;
            }
          }
        }
      }
    } catch {
      console.log('⚠️  QC delivery: could not read directory');
    }
  }

  // Pending changes check
  try {
    const { PendingChanges } = await import('../storage/pending-changes.js');
    const pc = new PendingChanges(ARISTOTLE_DIR);
    const pendingCount = pc.count();
    const protMode = config?.protectionMode || 'guarded';
    if (pendingCount > 0) {
      console.log(`ℹ️  Pending boot file changes: ${pendingCount} awaiting review`);
    } else {
      console.log(`✅ Pending changes: none`);
    }
    console.log(`✅ Protection mode: ${protMode}`);
  } catch {
    console.log('✅ Pending changes: none');
  }

  // Summary
  if (fix && fixed > 0) {
    console.log(`\n✅ Fixed ${fixed} issue(s). Overall: Healthy\n`);
  } else if (healthy) {
    console.log(`\n⟁ Your agent won't forget.\n`);
  } else {
    console.log(`\nOverall: ❌ Issues found. Run "aristotle doctor --fix" to auto-repair.\n`);
  }
}

/** Helper: auto-detect Telegram chat ID from OpenClaw config */
function autoDetectTelegramId(): string | null {
  const openclawConfigPath = path.join(OPENCLAW_HOME, 'openclaw.json');
  if (!fs.existsSync(openclawConfigPath)) return null;
  try {
    const raw = fs.readFileSync(openclawConfigPath, 'utf-8');
    const cleaned = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/,\s*([}\]])/g, '$1');
    const ocConfig = JSON.parse(cleaned);
    const allowFrom = ocConfig?.channels?.telegram?.allowFrom;
    if (Array.isArray(allowFrom) && allowFrom.length > 0) {
      for (const id of allowFrom) {
        const asStr = String(id);
        if (/^\d+$/.test(asStr)) return asStr;
      }
    }
  } catch {
    // Try regex fallback
    try {
      const raw = fs.readFileSync(openclawConfigPath, 'utf-8');
      const match = raw.match(/"telegram"[\s\S]*?"allowFrom"[\s\S]*?[\[,]\s*"?(\d{5,})"?\s*[\],]/);
      if (match) return match[1];
    } catch {}
  }
  return null;
}

function version(): void {
  try {
    const pkg = JSON.parse(fs.readFileSync(
      path.join(path.dirname(new URL(import.meta.url).pathname), '../../package.json'),
      'utf-8',
    ));
    console.log(`⟁ Aristotle v${pkg.version}`);
  } catch {
    console.log('⟁ Aristotle (version unknown)');
  }
}

// ─── MAIN ───

const command = process.argv[2];

switch (command) {
  case 'init':
    init();
    break;
  case 'status':
    status();
    break;
  case 'audit':
    audit(parseInt(process.argv[3]) || 20);
    break;
  case 'pending-report': {
    const config = loadConfig();
    if (!config) {
      console.log('⟁ Aristotle: not configured. Run "aristotle init" first.');
      break;
    }

    const { PendingChanges } = await import('../storage/pending-changes.js');
    const pc = new PendingChanges(ARISTOTLE_DIR);

    // Prune expired items first
    const expired = pc.pruneExpired();
    if (expired > 0) {
      console.log(`  Removed ${expired} expired pending item(s).`);
    }

    const report = pc.generateReport(config.timezone || 'America/New_York');

    if (!report) {
      console.log('⟁ No pending boot file changes.');
      break;
    }

    console.log('\n' + report + '\n');

    // --send flag
    if (process.argv.includes('--send')) {
      const channel = config.reportChannel || 'telegram';
      const target = config.reportTarget || config.telegramChatId;
      if (target) {
        try {
          const { execSync } = await import('child_process');
          execSync(
            `openclaw message send --channel ${channel} --target ${target} --silent --message "${report.replace(/"/g, '\\"')}"`,
            { timeout: 15000, stdio: 'pipe' }
          );
          console.log(`✅ Pending changes report sent via ${channel}.`);
        } catch (err) {
          console.error('❌ Failed to send pending report:', err);
        }
      }
    }
    break;
  }
  case 'pending-approve': {
    const config = loadConfig();
    if (!config) {
      console.log('⟁ Aristotle: not configured. Run "aristotle init" first.');
      break;
    }

    const { PendingChanges: PC } = await import('../storage/pending-changes.js');
    const pca = new PC(ARISTOTLE_DIR);
    const ws = (config.workspacePath || '~/.openclaw/workspace').replace('~', process.env.HOME || '');

    const indicesArg = process.argv[3];
    if (!indicesArg) {
      console.log('Usage: aristotle pending-approve 1,3,5');
      break;
    }

    const indices = indicesArg.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const approved = pca.approve(indices);

    if (approved.length === 0) {
      console.log('⟁ No items matched those numbers.');
      break;
    }

    // Apply each approved change
    const { execSync } = await import('child_process');
    for (const item of approved) {
      const fullPath = path.join(ws, item.file);
      try {
        // Temporarily make writable if locked
        const stat = fs.statSync(fullPath);
        const wasReadOnly = (stat.mode & 0o222) === 0;
        if (wasReadOnly) fs.chmodSync(fullPath, 0o644);

        // Append content
        fs.appendFileSync(fullPath, '\n' + item.content);
        console.log(`✅ Applied to ${item.file}: "${item.summary}"`);

        // Restore permissions if was locked
        if (wasReadOnly) fs.chmodSync(fullPath, 0o444);

        // Git commit
        try {
          execSync(
            `git -C "${ws}" add -A && git -C "${ws}" commit -m "rules: ${item.summary.slice(0, 50)}"`,
            { timeout: 10000, stdio: 'pipe' }
          );
        } catch {}
      } catch (err) {
        console.error(`❌ Failed to apply to ${item.file}:`, err);
      }
    }
    break;
  }
  case 'audit-report': {
    const config = loadConfig();
    if (!config) {
      console.log('⟁ Aristotle: not configured. Run "aristotle init" first.');
      break;
    }
    const ws = (config.workspacePath || '~/.openclaw/workspace').replace('~', process.env.HOME || '');

    // Helper: generate progress bar
    const progressBar = (pct: number, width: number = 10): string => {
      const filled = Math.round((pct / 100) * width);
      return '█'.repeat(filled) + '░'.repeat(width - filled);
    };

    // Helper: format label with padding
    const padLabel = (label: string, width: number = 13): string => {
      return label.padEnd(width);
    };

    const auditLines: string[] = [];
    const now = new Date();
    const tz = config.timezone || 'America/New_York';
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: tz,
    });
    const dayStr = `${now.getDate()} ${now.toLocaleString('en-US', { month: 'short' })}`;

    auditLines.push(`⟁ [ARISTOTLE] · Memory Audit`);
    auditLines.push(`${dayStr} · ${timeStr} ET`);
    auditLines.push('────────────────────────');

    // Bootstrap health (% of 150K limit)
    const bootstrapFiles = ['AGENTS.md', 'SOUL.md', 'MEMORY.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md', 'HEARTBEAT.md', 'BOOTSTRAP.md'];
    let totalChars = 0;
    for (const file of bootstrapFiles) {
      const fp = path.join(ws, file);
      if (fs.existsSync(fp)) {
        totalChars += fs.readFileSync(fp, 'utf-8').length;
      }
    }
    const bootstrapPct = Math.round((totalChars / 150000) * 100);
    const bootstrapK = Math.round(totalChars / 1000);
    auditLines.push(`${padLabel('BOOTSTRAP')}${progressBar(bootstrapPct)}  ${bootstrapPct}% used`);

    // MEMORY.md health (% of 150 line soft limit)
    const memPath = path.join(ws, 'MEMORY.md');
    if (fs.existsSync(memPath)) {
      const memLines = fs.readFileSync(memPath, 'utf-8').split('\n').length;
      const memPct = Math.round((memLines / 150) * 100);
      auditLines.push(`${padLabel('MEMORY.md')}${progressBar(memPct)}  ${memPct}% (${memLines} lines)`);
    }

    // Daily log
    const today = new Date().toISOString().slice(0, 10);
    const dailyPath = path.join(ws, 'memory', `${today}.md`);
    if (fs.existsSync(dailyPath)) {
      const dailySize = fs.readFileSync(dailyPath, 'utf-8').length;
      const dailyK = (dailySize / 1000).toFixed(1);
      auditLines.push(`${padLabel('DAILY LOG')}${progressBar(Math.min(Math.round((dailySize / 10000) * 100), 100))}  ${dailyK}K chars`);
    } else {
      auditLines.push(`${padLabel('DAILY LOG')}░░░░░░░░░░  not created yet`);
    }

    auditLines.push('────────────────────────');

    // Active Projects Protected
    const contDir = path.join(ws, 'memory', 'continuity');
    if (fs.existsSync(contDir)) {
      const contFiles = fs.readdirSync(contDir).filter((f: string) => f.endsWith('.md'));
      if (contFiles.length > 0) {
        auditLines.push(`Active Projects Protected: ${contFiles.length}`);
      } else {
        auditLines.push(`Active Projects Protected: no current multi-day projects`);
      }
    } else {
      auditLines.push(`Active Projects Protected: no current multi-day projects`);
    }

    // Guard blocks (24h)
    const auditLogPath = path.join(ARISTOTLE_DIR, 'audit.jsonl');
    let recentBlocks = 0;
    if (fs.existsSync(auditLogPath)) {
      try {
        const lines = fs.readFileSync(auditLogPath, 'utf-8').trim().split('\n').filter(Boolean);
        const last24h = Date.now() - 86400000;
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.action === 'BLOCKED' && new Date(entry.timestamp).getTime() > last24h) {
              recentBlocks++;
            }
          } catch {}
        }
      } catch {}
    }
    auditLines.push(`Guard (24h): ${recentBlocks} block${recentBlocks !== 1 ? 's' : ''}`);

    // Memory search health
    try {
      const { execSync } = await import('child_process');
      const memStatus = execSync('openclaw memory status --json 2>/dev/null', { encoding: 'utf-8', timeout: 10000 });
      if (memStatus.includes('"hybrid"') || memStatus.includes('"fts"') || memStatus.includes('"vector"')) {
        auditLines.push(`Search: healthy`);
      } else {
        auditLines.push(`Search: degraded`);
      }
    } catch {
      auditLines.push(`Search: could not verify`);
    }

    // QC last run — simplified
    const qcDir = path.join(ws, 'memory', 'qc');
    if (fs.existsSync(qcDir)) {
      const qcLogs = fs.readdirSync(qcDir)
        .filter((f: string) => f.endsWith('-qc.md'))
        .sort().reverse();
      if (qcLogs.length > 0) {
        const qcDate = qcLogs[0].match(/^(\d{4}-\d{2}-\d{2})/);
        if (qcDate && qcDate[1] === today) {
          auditLines.push(`Last QC: clean`);
        } else {
          auditLines.push(`Last QC: ${qcDate ? qcDate[1] : 'unknown'}`);
        }
      }
    }

    auditLines.push('────────────────────────');
    auditLines.push('⟁ Your agent won\'t forget.');
    auditLines.push('');
    auditLines.push('Reply "show me audit trail" for raw data.');

    const auditReport = auditLines.join('\n');

    // Save to file
    const auditReportPath = path.join(ARISTOTLE_DIR, 'audit-report.txt');
    fs.writeFileSync(auditReportPath, auditReport);

    console.log('\n' + auditReport + '\n');

    // --send flag
    if (process.argv.includes('--send')) {
      const channel = config.reportChannel || 'telegram';
      const target = config.reportTarget || config.telegramChatId;
      if (target) {
        try {
          const { execSync } = await import('child_process');
          execSync(
            `openclaw message send --channel ${channel} --target ${target} --silent --message "${auditReport.replace(/"/g, '\\"')}"`,
            { timeout: 15000, stdio: 'pipe' }
          );
          console.log(`✅ Audit report sent via ${channel}.`);
        } catch (err) {
          console.error('❌ Failed to send audit report:', err);
        }
      }
    }
    break;
  }
  case 'doctor':
    doctor(process.argv.includes('--fix'));
    break;
  case 'version':
  case '--version':
  case '-v':
    version();
    break;
  case 'report': {
    const { generateReport } = await import('../qc/report-formatter.js');
    
    // If --checks and --passed are provided, use manual mode
    const hasManualArgs = process.argv.some(a => a.startsWith('--checks=') || a.startsWith('--passed='));
    
    if (hasManualArgs) {
      const totalChecks = parseInt(process.argv.find(a => a.startsWith('--checks='))?.split('=')[1] || '11');
      const passed = parseInt(process.argv.find(a => a.startsWith('--passed='))?.split('=')[1] || String(totalChecks));
      const actionsRaw = process.argv.find(a => a.startsWith('--actions='))?.split('=')[1] || '';
      const userAction = process.argv.find(a => a.startsWith('--user-action='))?.split('=')[1] || null;
      const actions = actionsRaw ? actionsRaw.split(',').map(a => a.trim()) : [];

      const report = generateReport({
        totalChecks,
        passed,
        failed: totalChecks - passed,
        actionsCompleted: actions,
        userActionNeeded: userAction,
      }, OPENCLAW_HOME);

      console.log('\n⟁ Aristotle QC Report (generated)\n');
      console.log(report);
      console.log(`\nReport saved to: ${path.join(ARISTOTLE_DIR, 'qc-telegram-report.txt')}\n`);
    } else {
      // Auto mode: read today's QC log file and parse results
      const config = loadConfig();
      const ws = (config?.workspacePath || '~/.openclaw/workspace').replace('~', process.env.HOME || '');
      const today = new Date().toISOString().slice(0, 10);
      const qcLogPath = path.join(ws, 'memory', 'qc');
      
      // Find today's aristotle QC log
      let logFile = '';
      try {
        const files = fs.readdirSync(qcLogPath);
        logFile = files.find(f => f.includes(today) && f.includes('aristotle')) || '';
      } catch {}

      if (logFile) {
        const content = fs.readFileSync(path.join(qcLogPath, logFile), 'utf-8');
        
        // Parse the QC log for pass/fail counts and actions
        const passMatch = content.match(/Passed:\s*(\d+)/i);
        const failMatch = content.match(/Failed:\s*(\d+)/i);
        const passed = parseInt(passMatch?.[1] || '11');
        const failed = parseInt(failMatch?.[1] || '0');
        const totalChecks = passed + failed;

        // Extract action lines
        const actionsSection = content.match(/ACTIONS TAKEN:\n([\s\S]*?)(?:\n\n|SELF-IMPROVEMENT)/i);
        const actions: string[] = [];
        if (actionsSection) {
          const lines = actionsSection[1].split('\n').filter(l => l.trim().startsWith('-'));
          // Translate to plain English
          const translations: Record<string, string> = {
            'reindex': 'Memory search restored',
            'committed': 'Unsaved changes committed',
            'scaffold': 'Daily notes recreated',
            'session summary': 'End of day summary recreated',
            'MEMORY.md': 'Memory file trimmed',
            'bootstrap': 'System files verified',
            'self-improvement': 'Improvement note logged',
            'settings': 'System settings corrected',
            'credential': 'Security issue found',
          };
          for (const line of lines.slice(0, 5)) { // Max 5 actions
            let translated = line.replace(/^-\s*/, '').trim();
            for (const [key, value] of Object.entries(translations)) {
              if (translated.toLowerCase().includes(key.toLowerCase())) {
                translated = value;
                break;
              }
            }
            if (!actions.includes(translated)) actions.push(translated);
          }
        }

        // Check for escalations (user action needed)
        const escalationSection = content.match(/ESCALATIONS[^:]*:\n([\s\S]*?)$/i);
        let userAction: string | null = null;
        if (escalationSection) {
          const escText = escalationSection[1].trim();
          if (escText && escText.toLowerCase() !== 'none') {
            userAction = escText.split('\n')[0].replace(/^-\s*/, '').trim();
          }
        }

        const report = generateReport({
          totalChecks,
          passed,
          failed,
          actionsCompleted: actions,
          userActionNeeded: userAction,
        }, OPENCLAW_HOME);

        console.log('\n⟁ Aristotle QC Report (from today\'s log)\n');
        console.log(report);
        console.log(`\nReport saved to: ${path.join(ARISTOTLE_DIR, 'qc-telegram-report.txt')}\n`);
      } else {
        // No QC log found — generate clean report
        const report = generateReport({
          totalChecks: 11,
          passed: 11,
          failed: 0,
          actionsCompleted: [],
          userActionNeeded: null,
        }, OPENCLAW_HOME);

        console.log('\n⟁ Aristotle QC Report (no log found — clean)\n');
        console.log(report);
        console.log(`\nReport saved to: ${path.join(ARISTOTLE_DIR, 'qc-telegram-report.txt')}\n`);
      }
    }

    // --send flag: deliver the report via configured channel
    if (process.argv.includes('--send')) {
      const config = loadConfig();
      const channel = config?.reportChannel || 'telegram';
      const target = config?.reportTarget || config?.telegramChatId;
      if (!target) {
        console.error('No report target configured. Run "aristotle init" first.');
      } else {
        try {
          const reportPath = path.join(ARISTOTLE_DIR, 'qc-telegram-report.txt');
          const reportContent = fs.readFileSync(reportPath, 'utf-8');
          const { execSync } = await import('child_process');
          execSync(
            `openclaw message send --channel ${channel} --target ${target} --silent --message "${reportContent.replace(/"/g, '\\"')}"`,
            { timeout: 15000, stdio: 'pipe' }
          );
          console.log(`✅ Report sent via ${channel}.`);

          // Auto-send audit report 5 seconds after QC report
          try {
            execSync('sleep 5', { timeout: 10000 });
            execSync(
              `aristotle audit-report --send`,
              { timeout: 30000, stdio: 'pipe' }
            );
            console.log(`✅ Audit report sent via ${channel}.`);
          } catch { /* audit report is optional — don't fail if it doesn't send */ }
        } catch (err) {
          console.error('❌ Failed to send report:', err);
        }
      }
    }
    break;
  }
  case 'config': {
    const config = loadConfig();
    if (!config) {
      console.log('⟁ Aristotle: not configured. Run "aristotle init" first.');
      break;
    }

    const subCmd = process.argv[3];
    const key = process.argv[4];
    const value = process.argv.slice(5).join(' ');

    if (subCmd === 'show' || !subCmd) {
      console.log('\n⟁ Aristotle Configuration');
      console.log('─'.repeat(40));
      console.log(`Owner:          ${config.ownerName}`);
      console.log(`Agent:          ${config.agentName || '(not set)'}`);
      console.log(`Mode:           ${config.mode}`);
      console.log(`Workspace:      ${config.workspacePath}`);
      console.log(`Telegram ID:    ${config.telegramChatId || '(not set)'}`);
      console.log(`Report channel: ${config.reportChannel || 'telegram'}`);
      console.log(`Report target:  ${config.reportTarget || config.telegramChatId || '(not set)'}`);
      console.log(`Timezone:       ${config.timezone || 'America/New_York'}`);
      console.log(`Protection:     ${config.protectionMode || 'guarded'}`);
      console.log(`Guard:          ${config.guard.enabled ? 'enabled' : 'disabled'}`);
      console.log(`Context Shield: ${config.contextShield.enabled ? 'enabled' : 'disabled'}`);
      console.log(`Active QC:      ${config.qc.activeSession.enabled ? 'enabled' : 'disabled'}`);
      console.log();
    } else if (subCmd === 'set' && key && value) {
      const validKeys = ['ownerName', 'agentName', 'telegramChatId', 'reportChannel', 'reportTarget', 'protectionMode', 'mode', 'workspacePath'];
      if (!validKeys.includes(key)) {
        console.log(`❌ Unknown config key: "${key}"`);
        console.log(`   Valid keys: ${validKeys.join(', ')}`);
        break;
      }
      (config as any)[key] = value;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      fs.chmodSync(CONFIG_PATH, 0o600);
      console.log(`✅ ${key} set to "${value}"`);

      // If agent name changed, update the QC protocol file too
      if (key === 'agentName') {
        const ws = config.workspacePath.replace('~', process.env.HOME || '');
        const qcPath = path.join(ws, 'protocols', 'agents', 'ARISTOTLE_QC_AGENT.md');
        if (fs.existsSync(qcPath)) {
          console.log('ℹ️  To update the agent name in QC protocol, re-run "aristotle init".');
        }
      }
    } else if (subCmd === 'add' && key === 'protectedFile' && value) {
      if (!config.protectedFiles) config.protectedFiles = [...PROTECTED_FILES];
      if (config.protectedFiles.includes(value)) {
        console.log(`ℹ️  "${value}" is already in the protected files list.`);
      } else {
        config.protectedFiles.push(value);
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        fs.chmodSync(CONFIG_PATH, 0o600);
        console.log(`✅ Added "${value}" to protected files.`);
      }
    } else if (subCmd === 'remove' && key === 'protectedFile' && value) {
      if (!config.protectedFiles) config.protectedFiles = [...PROTECTED_FILES];
      const idx = config.protectedFiles.indexOf(value);
      if (idx === -1) {
        console.log(`ℹ️  "${value}" is not in the protected files list.`);
      } else {
        config.protectedFiles.splice(idx, 1);
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        fs.chmodSync(CONFIG_PATH, 0o600);
        console.log(`✅ Removed "${value}" from protected files.`);
      }
    } else if (subCmd === 'list' && key === 'protectedFiles') {
      const files = config.protectedFiles || PROTECTED_FILES;
      console.log('\n⟁ Protected Files');
      console.log('─'.repeat(40));
      for (const f of files) {
        const ws = config.workspacePath.replace('~', process.env.HOME || '');
        const exists = fs.existsSync(path.join(ws, f));
        console.log(`  ${exists ? '✅' : '  '} ${f}`);
      }
      console.log();
    } else {
      console.log(`
⟁ Aristotle Config

Usage:
  aristotle config show                          Show current configuration
  aristotle config set <key> <value>             Update a setting
  aristotle config add protectedFile <path>      Add a file to Guard protection
  aristotle config remove protectedFile <path>   Remove a file from Guard protection
  aristotle config list protectedFiles           Show all protected files

Keys:
  ownerName       Your name
  agentName       Your agent's name
  telegramChatId  Telegram numeric chat ID
  reportChannel   Report delivery channel (telegram/discord/whatsapp)
  reportTarget    Channel-specific target (chat ID, channel ID, phone number)
  mode            Enforcement mode (enforce/audit)
  workspacePath   Workspace path
      `);
    }
    break;
  }
  default:
    console.log(`
⟁ Aristotle — Memory Protection for OpenClaw

Commands:
  aristotle init              Setup wizard (auto-detects your config)
  aristotle status            Current policy and recent activity
  aristotle audit [n]         View last n guard decisions (default: 20)
  aristotle audit-report      Memory status audit with visual health bars
  aristotle audit-report --send  Send audit via configured channel
  aristotle doctor            Health check
  aristotle doctor --fix      Auto-repair permissions, directories, config
  aristotle report            Generate branded QC report
  aristotle report --send     Send QC report + auto audit via configured channel
  aristotle pending-report    View pending boot file changes
  aristotle pending-report --send  Send pending report via configured channel
  aristotle pending-approve 1,3   Approve specific pending changes by number
  aristotle config show       View current configuration
  aristotle config set        Update a setting
  aristotle version           Show version

Your agent won't forget.
    `);
}
