import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const WorkspaceBriefResultSchema = z.object({
  status: z.string(),
  vaultName: z.string(),
  filesCount: z.number(),
  attachmentCount: z.number(),
  linksCount: z.number(),
  unresolvedLinksCount: z.number(),
  isolatedNotes: z.number(),
  topFolders: z.array(
    z.object({
      folder: z.string(),
      count: z.number(),
    }),
  ),
  topTags: z.array(
    z.object({
      tag: z.string(),
      count: z.number(),
    }),
  ),
  commonProperties: z.array(
    z.object({
      property: z.string(),
      count: z.number(),
    }),
  ),
  missingKeyProperties: z.number(),
  recentNotes: z.array(z.string()),
  staleHighCentralityNotes: z.array(z.string()),
  entryPoints: z.array(
    z.object({
      path: z.string(),
      score: z.number(),
    }),
  ),
  projectNotes: z.array(z.string()),
});

export const obsidianKnowledgeWorkspaceBrief = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_workspace_brief',
  description:
    'Get a compact Knowledge workspace brief for agent startup: note counts, graph size, top tags, recent notes, and recommended entry points.',
  input: z.object({}),
  output: WorkspaceBriefResultSchema,
  path: '/api/brief',
  method: 'GET',

  format: ({ result }) => {
    const lines = [
      '**Knowledge Workspace Brief**',
      '',
      '### Identity & Size',
      `- Vault: ${result.vaultName}`,
      `- Markdown notes: ${result.filesCount}`,
      `- Attachments: ${result.attachmentCount}`,
      '',
      '### Graph Summary',
      `- Total links: ${result.linksCount}`,
      `- Unresolved links: ${result.unresolvedLinksCount}`,
      `- Isolated notes: ${result.isolatedNotes}`,
    ];

    if (result.topFolders.length) {
      lines.push('', '### Top Folders', ...result.topFolders.map((f) => `- ${f.folder}: ${f.count}`));
    }
    if (result.topTags.length) {
      lines.push('', '### Metadata - Top Tags', ...result.topTags.map((t) => `- ${t.tag}: ${t.count}`));
    }
    if (result.commonProperties.length) {
      lines.push('', '### Metadata - Common Properties', ...result.commonProperties.map((p) => `- ${p.property}: ${p.count}`));
      lines.push(`- Notes missing at least one of the top 3 key properties: ${result.missingKeyProperties}`);
    }
    if (result.recentNotes.length) {
      lines.push('', '### Activity - Recent Notes', ...result.recentNotes.map((n) => `- ${n}`));
    }
    if (result.staleHighCentralityNotes.length) {
      lines.push('', '### Activity - Stale High-Centrality Hubs', ...result.staleHighCentralityNotes.map((n) => `- ${n}`));
    }
    if (result.entryPoints.length) {
      lines.push('', '### Entry Points - Top Hubs', ...result.entryPoints.map((e) => `- ${e.path} (${e.score})`));
    }
    if (result.projectNotes.length) {
      lines.push('', '### Entry Points - Project Notes', ...result.projectNotes.map((n) => `- ${n}`));
    }
    
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
