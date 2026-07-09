import { z } from '@cyanheads/mcp-ts-core';

const PreflightCheckSchema = z.object({
  id: z.string(),
  status: z.enum(['pass', 'warn', 'fail']),
  message: z.string(),
});

export const PatchPreflightSchema = z.object({
  status: z.enum(['ok', 'blocked', 'degraded']),
  allowed: z.boolean(),
  checks: z.array(PreflightCheckSchema),
  requiredFixes: z.array(z.string()),
  warnings: z.array(z.string()),
  safeApplyHint: z.string(),
});

export const PatchInputSchema = z.object({
  path: z.string().min(1).describe('Vault-relative markdown path to patch.'),
  baseHash: z
    .string()
    .min(1)
    .optional()
    .describe('SHA-256 content hash observed before patching. Omit when replace_file creates a missing note.'),
  baseMtime: z
    .number()
    .optional()
    .describe('File mtime observed before patching. Omit when replace_file creates a missing note.'),
  mode: z
    .enum(['replace_section', 'insert_after_heading', 'append_to_note', 'replace_file'])
    .describe('Patch mode.'),
  heading: z.string().optional().describe('Heading used by insert_after_heading.'),
  startLine: z.number().int().nonnegative().optional().describe('Start line for replace_section.'),
  endLine: z.number().int().nonnegative().optional().describe('End line for replace_section.'),
  content: z.string().describe('Replacement or inserted markdown content.'),
});

export const AffectedRangeSchema = z.object({
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
});

export const PatchPreviewResultSchema = z.object({
  status: z.enum(['ok', 'blocked']),
  diff: z.string(),
  beforeHash: z.string().nullable(),
  afterHash: z.string(),
  affectedRange: AffectedRangeSchema,
  preflight: PatchPreflightSchema,
});

export const PatchApplyResultSchema = z.object({
  status: z.enum(['ok', 'blocked']),
  applied: z.boolean(),
  path: z.string(),
  beforeHash: z.string().nullable(),
  afterHash: z.string(),
  backupPath: z.string().nullable(),
  auditId: z.string(),
  postWriteValidation: z.object({
    status: z.enum(['ok', 'warn', 'blocked']),
    violations: z.array(z.unknown()),
    newViolations: z.array(z.unknown()),
    resolvedViolations: z.array(z.unknown()),
  }),
});
