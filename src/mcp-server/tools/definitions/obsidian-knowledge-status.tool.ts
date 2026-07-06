import { tool, z } from '@cyanheads/mcp-ts-core';
import { getStartupDependencySnapshot } from '@/startup/dependency-startup.js';
import { knowledgeToolErrors, requestKnowledgeJson } from './obsidian-knowledge-client.js';

const StartupDependencySchema = z
  .object({
    name: z.string().describe('Dependency name.'),
    state: z
      .enum(['none', 'ready', 'started', 'degraded', 'blocked'])
      .describe('Startup state for this dependency.'),
    elapsedMs: z.number().describe('Startup elapsed time in milliseconds.'),
    recovery: z.string().optional().describe('Recovery command or manual action.'),
  })
  .describe('MCP startup dependency status.');

const StatusResultSchema = z
  .object({
    status: z.string().describe('Overall Knowledge Analytics plugin health status.'),
    schemaVersion: z.string().describe('Knowledge Analytics plugin API schema version.'),
    pluginVersion: z.string().optional().describe('Installed plugin version, when reported.'),
    vaultName: z.string().optional().describe('Active Obsidian vault name, when available.'),
    enabledModules: z
      .array(z.string().describe('Enabled Knowledge Analytics module ID.'))
      .optional()
      .describe('Knowledge Analytics modules currently enabled in the plugin.'),
    requiredCapabilities: z
      .array(
        z
          .object({
            id: z.string().describe('Stable capability ID.'),
            name: z.string().describe('Human-readable capability name.'),
            version: z.string().describe('Capability contract version.'),
            status: z
              .string()
              .describe('Capability status such as available, degraded, or missing.'),
            endpoints: z
              .array(z.string().describe('HTTP endpoint required by this capability.'))
              .describe('Plugin HTTP endpoints required by this capability.'),
            tools: z
              .array(z.string().describe('MCP tool name backed by this capability.'))
              .describe('MCP tools that depend on this capability.'),
            dependencies: z
              .array(z.string().describe('Plugin or runtime dependency ID.'))
              .describe('Dependencies required by this capability.'),
            degradedReasons: z
              .array(z.string().describe('Reason why this capability is degraded.'))
              .optional()
              .describe('Reasons reported when the capability is degraded.'),
          })
          .describe('Capability required by one or more Knowledge MCP tools.'),
      )
      .optional()
      .describe('Capabilities required by the MCP tool surface and their current plugin status.'),
    omnisearchAvailable: z
      .boolean()
      .optional()
      .describe('Whether Omnisearch is available in the plugin.'),
    warnings: z
      .array(z.string().describe('Non-fatal status warning.'))
      .optional()
      .describe('Warnings reported by the plugin.'),
    errors: z
      .array(z.string().describe('Status error.'))
      .optional()
      .describe('Errors reported by the plugin.'),
    recoveryHint: z
      .string()
      .optional()
      .describe('Suggested recovery action for degraded or failing status.'),
    startupDependencies: z
      .array(StartupDependencySchema)
      .optional()
      .describe('Local dependencies prepared during MCP startup.'),
  })
  .describe('Knowledge Analytics plugin preflight status response.');

type StatusResult = z.infer<typeof StatusResultSchema>;

function formatStatus(result: StatusResult) {
  const lines = [
    '**Knowledge Analytics Status**',
    `- Status: ${result.status}`,
    `- Plugin version: ${result.pluginVersion || 'unknown'}`,
    `- Schema version: ${result.schemaVersion}`,
  ];
  if (result.vaultName) lines.push(`- Vault: ${result.vaultName}`);
  if (result.enabledModules) lines.push(`- Modules: ${result.enabledModules.join(', ')}`);
  if (result.omnisearchAvailable !== undefined)
    lines.push(`- Omnisearch available: ${result.omnisearchAvailable ? 'yes' : 'no'}`);
  if (result.startupDependencies?.length) {
    lines.push('', '### Startup Dependencies');
    for (const dep of result.startupDependencies) {
      lines.push(`- ${dep.name}: ${dep.state} (${dep.elapsedMs}ms)`);
      if (dep.recovery) lines.push(`  - Recovery: ${dep.recovery}`);
    }
  }
  if (result.requiredCapabilities?.length) {
    lines.push(`- Capabilities: ${result.requiredCapabilities.map((cap) => cap.id).join(', ')}`);
    lines.push('', '### Required Capabilities');
    for (const cap of result.requiredCapabilities) {
      lines.push(`- ${cap.id}: ${cap.name} (${cap.version}) - ${cap.status}`);
      lines.push(`  - Endpoints: ${cap.endpoints.join(', ') || 'none'}`);
      lines.push(`  - Tools: ${cap.tools.join(', ') || 'none'}`);
      lines.push(`  - Dependencies: ${cap.dependencies.join(', ') || 'none'}`);
      if (cap.degradedReasons?.length)
        lines.push(`  - Degraded reasons: ${cap.degradedReasons.join('; ')}`);
    }
  }
  if (result.warnings?.length)
    lines.push('', '### Warnings', ...result.warnings.map((w) => `- ${w}`));
  if (result.errors?.length) lines.push('', '### Errors', ...result.errors.map((e) => `- ${e}`));
  if (result.recoveryHint) lines.push('', `**Recovery Hint**: ${result.recoveryHint}`);
  return [{ type: 'text' as const, text: lines.join('\n') }];
}

export const obsidianKnowledgeStatus = tool('obsidian_knowledge_status', {
  description:
    'Preflight check. Returns status, plugin version, and warnings for the Knowledge Analytics plugin. Use to verify connectivity before running heavier tools.',
  input: z.object({}),
  output: z.object({ result: StatusResultSchema }),
  annotations: { readOnlyHint: true, idempotentHint: true },
  auth: ['tool:obsidian_knowledge_status:read'],
  errors: knowledgeToolErrors,

  async handler(_input, ctx) {
    const startupDependencies = getStartupDependencySnapshot().dependencies;
    try {
      const result = await requestKnowledgeJson<Omit<StatusResult, 'startupDependencies'>>({
        ctx,
        path: '/api/status',
        method: 'GET',
      });
      return { result: { ...result, startupDependencies } };
    } catch (err) {
      return {
        result: {
          status: 'blocked',
          schemaVersion: 'unknown',
          errors: [(err as Error).message],
          recoveryHint:
            'Start Obsidian with Knowledge Analytics enabled, then retry obsidian_knowledge_status.',
          startupDependencies,
        },
      };
    }
  },

  format: (data: { result: StatusResult }) => formatStatus(data.result),
});
