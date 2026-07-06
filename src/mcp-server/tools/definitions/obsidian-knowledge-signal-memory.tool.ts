import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const SignalMemoryEntrySchema = z
  .object({
    signalKey: z.string().describe('Stable key identifying the signal.'),
    ruleId: z.string().describe('Hygiene or signal rule identifier.'),
    path: z.string().describe('Vault-relative note path for the signal.'),
    decision: z
      .enum(['open', 'accepted', 'ignored', 'resolved'])
      .describe('Current decision state for the signal.'),
    reason: z.string().optional().describe('Optional reason recorded for the decision.'),
    updatedAt: z.string().describe('Timestamp when the signal memory entry was updated.'),
  })
  .describe('Single signal memory entry.');

const SignalMemoryStatusSchema = z
  .object({
    countsByState: z
      .object({
        open: z.number().describe('Number of open signals.'),
        accepted: z.number().describe('Number of accepted signals.'),
        ignored: z.number().describe('Number of ignored signals.'),
        resolved: z.number().describe('Number of resolved signals.'),
      })
      .describe('Signal counts grouped by decision state.'),
    staleOpenSignals: z.number().describe('Number of open signals considered stale.'),
    recentlyResolved: z.number().describe('Number of signals recently marked resolved.'),
  })
  .describe('Signal memory status summary.');

const SignalMemoryResultSchema = z
  .union([
    z.array(SignalMemoryEntrySchema).describe('List of signal memory entries.'),
    SignalMemoryStatusSchema.describe('Signal memory status summary.'),
    SignalMemoryEntrySchema.describe('Signal memory entry updated by a mark action.'),
  ])
  .describe('Signal memory tool result.');

export const obsidianKnowledgeSignalMemoryTool = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_signal_memory',
  description:
    'View or mark signals (e.g. hygiene rules ignored or accepted) in the vault signal memory.',
  authWrite: true,
  input: z.object({
    action: z.enum(['list', 'status', 'mark']).describe('The action to perform'),
    signalKey: z.string().optional().describe('Required for mark action. The unique signal key.'),
    ruleId: z.string().optional().describe('Required for mark action. The hygiene rule id.'),
    path: z.string().optional().describe('Required for mark action. The note path.'),
    decision: z
      .enum(['open', 'accepted', 'ignored', 'resolved'])
      .optional()
      .describe('Required for mark action. The decision state.'),
    reason: z.string().optional().describe('Optional reason for the decision.'),
  }),
  output: SignalMemoryResultSchema,
  path: (input) => {
    if (input.action === 'list') return '/api/signals';
    if (input.action === 'status') return '/api/signals/status';
    if (input.action === 'mark') {
      if (!input.signalKey || !input.ruleId || !input.path || !input.decision) {
        throw new Error('mark action requires signalKey, ruleId, path, and decision');
      }
      return '/api/signals/mark';
    }
    throw new Error('Unsupported action');
  },
  method: (input) => (input.action === 'mark' ? 'POST' : 'GET'),
  format: ({ result }) => [{ type: 'text', text: JSON.stringify(result, null, 2) }],
});
