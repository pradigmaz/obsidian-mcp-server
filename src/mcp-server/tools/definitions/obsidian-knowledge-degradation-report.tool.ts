import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const DegradationReportSchema = z
  .object({
    status: z.enum(['ok', 'degraded', 'stale', 'blocked']).describe('Overall degradation status.'),
    degradation_reasons: z
      .array(z.string().describe('Stable degradation reason code.'))
      .describe('Reasons search or recovery is degraded.'),
    recovery_actions: z
      .array(
        z
          .object({
            code: z.string().describe('Stable recovery action code.'),
            action: z.string().describe('Human-readable recovery action.'),
            safe: z.boolean().describe('Whether the action is safe to run manually now.'),
          })
          .describe('Recovery action.'),
      )
      .describe('Safe recovery actions available to the agent.'),
    omnisearch: z
      .object({
        available: z.boolean().describe('Whether Omnisearch search API is available.'),
        refreshIndexAvailable: z
          .boolean()
          .describe('Whether Omnisearch exposes refreshIndex.'),
      })
      .describe('Omnisearch runtime status.'),
    knowledgePlugin: z
      .object({
        schemaVersion: z.string().describe('Plugin schema version.'),
        pluginVersion: z.string().optional().describe('Plugin version.'),
        endpointReachable: z.boolean().describe('Whether the endpoint answered this request.'),
      })
      .describe('Knowledge plugin endpoint status.'),
    vault: z
      .object({
        name: z.string().describe('Vault name.'),
        noteCount: z.number().int().nonnegative().describe('Markdown note count.'),
        highFindings: z.number().int().nonnegative().describe('High-severity health findings.'),
      })
      .describe('Vault degradation summary.'),
    lastHealthSnapshot: z
      .object({
        timestamp: z.number().describe('Snapshot timestamp.'),
        score: z.number().describe('Snapshot score.'),
        ageMs: z.number().nonnegative().describe('Snapshot age in milliseconds.'),
      })
      .optional()
      .describe('Last saved health snapshot.'),
  })
  .describe('Knowledge degradation and recovery report.');

export const obsidianKnowledgeDegradationReport = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_degradation_report',
  description:
    'Report whether Knowledge search is fresh or degraded, and list safe recovery actions without triggering refresh automatically.',
  input: z.object({}),
  output: DegradationReportSchema,
  path: '/api/degradation',
  method: 'GET',
  format: ({ result }) => {
    const lines = [
      '**Knowledge Degradation Report**',
      `- Status: ${result.status}`,
      `- Omnisearch: ${result.omnisearch.available ? 'available' : 'unavailable'}`,
      `- Refresh API: ${result.omnisearch.refreshIndexAvailable ? 'available' : 'unavailable'}`,
      `- High health findings: ${result.vault.highFindings}`,
    ];
    if (result.degradation_reasons.length) {
      lines.push('', '### Degradation Reasons', ...result.degradation_reasons.map((reason) => `- ${reason}`));
    }
    if (result.recovery_actions.length) {
      lines.push(
        '',
        '### Recovery Actions',
        ...result.recovery_actions.map(
          (action) => `- ${action.code}: ${action.safe ? 'safe' : 'not safe'} - ${action.action}`,
        ),
      );
    }
    if (result.lastHealthSnapshot) {
      lines.push(
        '',
        '### Last Health Snapshot',
        `- Score: ${result.lastHealthSnapshot.score}`,
        `- Age ms: ${result.lastHealthSnapshot.ageMs}`,
      );
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
