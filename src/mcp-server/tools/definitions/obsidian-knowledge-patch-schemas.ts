import { z } from '@cyanheads/mcp-ts-core';

const PreflightCheckSchema = z
  .object({
    id: z.string().describe('Stable preflight check id.'),
    status: z.enum(['pass', 'warn', 'fail']).describe('Preflight check status.'),
    message: z.string().describe('Human-readable preflight check result.'),
  })
  .describe('Single patch preflight check result.');

export const PatchPreflightSchema = z.object({
  status: z.enum(['ok', 'blocked', 'degraded']).describe('Overall preflight status.'),
  allowed: z.boolean().describe('Whether the patch may be applied.'),
  checks: z.array(PreflightCheckSchema).describe('All preflight checks.'),
  requiredFixes: z
    .array(z.string().describe('Required fix before applying the patch.'))
    .describe('Fixes required before applying the patch.'),
  warnings: z
    .array(z.string().describe('Non-blocking preflight warning.'))
    .describe('Non-blocking warnings.'),
  safeApplyHint: z.string().describe('Instruction for the next safe patch step.'),
});

export const PatchInputSchema = z.object({
  path: z.string().min(1).describe('Vault-relative markdown path to patch.'),
  baseHash: z
    .string()
    .min(1)
    .optional()
    .describe(
      'SHA-256 content hash observed before patching. Omit when replace_file creates a missing note.',
    ),
  baseMtime: z
    .number()
    .optional()
    .describe(
      'File mtime observed before patching. Omit when replace_file creates a missing note.',
    ),
  mode: z
    .enum(['replace_section', 'insert_after_heading', 'append_to_note', 'replace_file'])
    .describe('Patch mode.'),
  heading: z.string().optional().describe('Heading used by insert_after_heading.'),
  startLine: z.number().int().nonnegative().optional().describe('Start line for replace_section.'),
  endLine: z.number().int().nonnegative().optional().describe('End line for replace_section.'),
  content: z.string().describe('Replacement or inserted markdown content.'),
});

export const AffectedRangeSchema = z.object({
  startLine: z.number().int().nonnegative().describe('First affected zero-based line.'),
  endLine: z.number().int().nonnegative().describe('Last affected zero-based line.'),
});

export const PatchPreviewResultSchema = z.object({
  status: z.enum(['ok', 'blocked']).describe('Patch preview status.'),
  diff: z.string().describe('Unified diff preview for the proposed patch.'),
  beforeHash: z.string().nullable().describe('Content hash before the patch, when available.'),
  afterHash: z.string().describe('Expected content hash after applying the patch.'),
  affectedRange: AffectedRangeSchema.describe('Line range affected by the patch.'),
  preflight: PatchPreflightSchema.describe('Preflight result for this patch preview.'),
});

export const PatchApplyResultSchema = z.object({
  status: z.enum(['ok', 'blocked']).describe('Patch apply status.'),
  applied: z.boolean().describe('Whether the patch was applied to the vault.'),
  path: z.string().describe('Vault-relative path that was patched.'),
  beforeHash: z.string().nullable().describe('Content hash before applying the patch.'),
  afterHash: z.string().describe('Content hash after applying the patch.'),
  backupPath: z.string().nullable().describe('Vault-local backup path, when created.'),
  auditId: z.string().describe('Audit id for this patch apply attempt.'),
  postWriteValidation: z
    .object({
      status: z.enum(['ok', 'warn', 'blocked']).describe('Post-write validation status.'),
      violations: z.array(z.unknown()).describe('All post-write validation violations.'),
      newViolations: z.array(z.unknown()).describe('New violations introduced by the patch.'),
      resolvedViolations: z
        .array(z.unknown())
        .describe('Previous violations resolved by the patch.'),
    })
    .describe('Post-write validation result.'),
});
