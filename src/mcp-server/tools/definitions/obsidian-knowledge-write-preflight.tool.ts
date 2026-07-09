import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const WritePreflightCheckSchema = z
  .object({
    id: z.string().describe('Stable preflight check id.'),
    status: z.enum(['pass', 'warn', 'fail']).describe('Check status.'),
    message: z.string().describe('Human-readable check result.'),
  })
  .describe('Single write preflight check result.');

const WritePreflightResultSchema = z
  .object({
    status: z.enum(['ok', 'blocked', 'degraded']).describe('Overall preflight status.'),
    allowed: z.boolean().describe('Whether the proposed write may proceed.'),
    checks: z.array(WritePreflightCheckSchema).describe('All preflight checks.'),
    requiredFixes: z.array(z.string()).describe('Fixes required before writing.'),
    warnings: z.array(z.string()).describe('Non-blocking warnings.'),
    safeApplyHint: z.string().describe('Instruction for the next safe write step.'),
  })
  .describe('Knowledge write preflight result.');

export const obsidianKnowledgeWritePreflight = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_write_preflight',
  description:
    'Validate a proposed Knowledge vault write before any note is modified. Runs path, OKF metadata, stale-write, size, duplicate-name, and credential-safety checks.',
  input: z.object({
    operation: z.enum(['create', 'replace', 'patch']).describe('Proposed write operation.'),
    path: z.string().min(1).describe('Vault-relative markdown path to write.'),
    frontmatter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Proposed frontmatter for OKF validation.'),
    contentPreview: z
      .string()
      .optional()
      .describe('Proposed full or partial content preview used for size and secret checks.'),
    baseMtime: z.number().optional().describe('Observed file mtime for stale-write detection.'),
    baseHash: z
      .string()
      .optional()
      .describe('Observed file content hash for stale-write detection.'),
  }),
  output: WritePreflightResultSchema,
  path: '/api/write/preflight',

  format: ({ result }) => {
    const lines = [
      `**Knowledge Write Preflight: ${result.status}**`,
      `Allowed: ${result.allowed ? 'yes' : 'no'}`,
      '',
      'Checks:',
      ...result.checks.map(
        (check) =>
          `- ${check.status.toUpperCase()} ${check.id}: ${check.message}; status=${check.status}`,
      ),
    ];
    if (result.requiredFixes.length > 0) {
      lines.push('', 'Required fixes:', ...result.requiredFixes.map((fix) => `- ${fix}`));
    }
    if (result.warnings.length > 0) {
      lines.push('', 'Warnings:', ...result.warnings.map((warning) => `- ${warning}`));
    }
    lines.push('', result.safeApplyHint);
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
