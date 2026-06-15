import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const StatusResultSchema = z.object({
 status: z.string(),
 schemaVersion: z.string(),
 pluginVersion: z.string().optional(),
 vaultName: z.string().optional(),
 enabledModules: z.array(z.string()).optional(),
  requiredCapabilities: z.array(z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    status: z.string(),
    endpoints: z.array(z.string()),
    tools: z.array(z.string()),
    dependencies: z.array(z.string()),
    degradedReasons: z.array(z.string()).optional(),
  })).optional(),
 omnisearchAvailable: z.boolean().optional(),
 warnings: z.array(z.string()).optional(),
 errors: z.array(z.string()).optional(),
  recoveryHint: z.string().optional(),
});

export const obsidianKnowledgeStatus = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_status',
  description: 'Preflight check. Returns status, plugin version, and warnings for the Knowledge Analytics plugin. Use to verify connectivity before running heavier tools.',
  input: z.object({}),
  output: StatusResultSchema,
  path: '/api/status',
  method: 'GET',

  format: ({ result }) => {
    const lines = [
      '**Knowledge Analytics Status**',
      `- Status: ${result.status}`,
      `- Plugin version: ${result.pluginVersion || 'unknown'}`,
      `- Schema version: ${result.schemaVersion}`,
    ];
    if (result.vaultName) lines.push(`- Vault: ${result.vaultName}`);
    if (result.enabledModules) lines.push(`- Modules: ${result.enabledModules.join(', ')}`);
    if (result.requiredCapabilities) lines.push(`- Capabilities: ${result.requiredCapabilities.map(cap => cap.id).join(', ')}`);
    if (result.warnings?.length) lines.push('', '### Warnings', ...result.warnings.map(w => `- ${w}`));
    if (result.errors?.length) lines.push('', '### Errors', ...result.errors.map(e => `- ${e}`));
    if (result.recoveryHint) lines.push('', `**Recovery Hint**: ${result.recoveryHint}`);
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
