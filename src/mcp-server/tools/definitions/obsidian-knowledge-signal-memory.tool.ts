import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

export const obsidianKnowledgeSignalMemoryTool = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_signal_memory',
  description: 'View or mark signals (e.g. hygiene rules ignored or accepted) in the vault signal memory.',
  authWrite: true,
  input: z.object({
    action: z.enum(['list', 'status', 'mark']).describe('The action to perform'),
    signalKey: z.string().optional().describe('Required for mark action. The unique signal key.'),
    ruleId: z.string().optional().describe('Required for mark action. The hygiene rule id.'),
    path: z.string().optional().describe('Required for mark action. The note path.'),
    decision: z.enum(['open', 'accepted', 'ignored', 'resolved']).optional().describe('Required for mark action. The decision state.'),
    reason: z.string().optional().describe('Optional reason for the decision.')
  }),
  output: z.any(),
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
  method: (input) => input.action === 'mark' ? 'POST' : 'GET',
  format: ({ result }) => {
    return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
  },
});
