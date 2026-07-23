import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const TextListSchema = z
  .array(z.string().min(1).max(2000).describe('Compact memory item.'))
  .max(50);

const SessionSchema = z
  .object({
    id: z.string().min(1).max(160).describe('Stable client session identifier.'),
    goal: z.string().min(1).max(2000).describe('Goal handled in the session.'),
    summary: z.string().min(1).max(12000).describe('Compact outcome summary, not a transcript.'),
    status: z.enum(['completed', 'partial', 'blocked']).describe('Session outcome status.'),
    startedAt: z
      .string()
      .max(64)
      .optional()
      .describe('ISO timestamp used for the session note date.'),
    decisions: TextListSchema.optional().describe('Confirmed decisions made in the session.'),
    discoveries: TextListSchema.optional().describe('Verified discoveries from the session.'),
    blockers: TextListSchema.optional().describe('Unresolved blockers.'),
    nextSteps: TextListSchema.optional().describe('Concrete next actions.'),
    referencedFiles: TextListSchema.optional().describe(
      'Absolute or workspace-relative file references.',
    ),
  })
  .describe('Compact session checkpoint; never a raw transcript.');

const FactSchema = z
  .object({
    type: z
      .enum(['decision', 'verified-workflow', 'constraint', 'preference', 'result', 'blocker'])
      .describe('Durable fact category.'),
    statement: z.string().min(1).max(4000).describe('Concise durable fact statement.'),
    evidence: z.string().min(1).max(4000).optional().describe('Verification evidence.'),
    confidence: z.enum(['confirmed', 'inferred']).describe('Only confirmed facts are promoted.'),
    status: z
      .enum(['active', 'resolved', 'superseded'])
      .optional()
      .describe('Lifecycle status. Defaults to active.'),
    supersedes: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Fact identifier superseded by this fact.'),
  })
  .describe('Candidate durable fact.');

const CaptureResponseSchema = z
  .object({
    status: z.literal('ok').describe('Capture result status.'),
    workspaceKey: z.string().describe('Stable derived workspace key.'),
    memoryRoot: z.string().describe('Vault-relative workspace memory root.'),
    sessionPath: z.string().optional().describe('Vault-relative session note path.'),
    factPaths: z
      .array(z.string().describe('Vault-relative durable fact path.'))
      .describe('Written fact notes.'),
    skippedFacts: z
      .number()
      .int()
      .nonnegative()
      .describe('Inferred facts intentionally not promoted.'),
  })
  .describe('Agent memory capture result.');

export const obsidianKnowledgeAgentMemoryCapture = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_agent_memory_capture',
  description:
    'Persist a compact session outcome and confirmed durable facts in project-scoped shared agent memory. Do not send raw transcripts or secrets.',
  authWrite: true,
  input: z.object({
    workspacePath: z.string().min(2).max(1024).describe('Absolute local workspace path.'),
    agent: z
      .enum(['codex', 'claude', 'gemini', 'other'])
      .describe('Client that produced the memory.'),
    session: SessionSchema.optional().describe('Optional compact session checkpoint.'),
    facts: z
      .array(FactSchema)
      .max(50)
      .optional()
      .describe('Optional confirmed or inferred durable fact candidates.'),
    privacy_mode: z
      .enum(['mask', 'hash'])
      .optional()
      .describe('Redaction mode. Defaults to mask; off is intentionally unsupported.'),
  }),
  output: CaptureResponseSchema,
  path: '/api/memory/capture',
  method: 'POST',
  headers: (input) => (input.privacy_mode ? { 'X-Knowledge-Privacy': input.privacy_mode } : {}),
  format: ({ result }) => {
    const lines = [
      `Status: ${result.status}.`,
      `Workspace key: ${result.workspaceKey}.`,
      `Memory root: ${result.memoryRoot}.`,
      ...(result.sessionPath ? [`Session: ${result.sessionPath}.`] : []),
      `Skipped inferred facts: ${result.skippedFacts}.`,
    ];
    for (const path of result.factPaths) lines.push(`Fact: ${path}.`);
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
