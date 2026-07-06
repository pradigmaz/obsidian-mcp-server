import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const WorkspaceBriefResultSchema = z
  .object({
    status: z.string().describe('Workspace brief status reported by the Knowledge plugin.'),
    vaultName: z.string().describe('Active Obsidian vault name.'),
    filesCount: z.number().describe('Total markdown note count in the vault.'),
    attachmentCount: z.number().describe('Total attachment count in the vault.'),
    scopePreview: z
      .object({
        includedFolders: z
          .array(z.string().describe('Folder included in Knowledge processing scope.'))
          .describe('Folders included in the Knowledge processing scope.'),
        excludedFolders: z
          .array(z.string().describe('Folder excluded from Knowledge processing scope.'))
          .describe('Folders excluded from the Knowledge processing scope.'),
        noteCount: z.number().describe('Markdown note count inside the current processing scope.'),
        attachmentCount: z
          .number()
          .describe('Attachment count inside the current processing scope.'),
        ignoredPatterns: z
          .array(z.string().describe('Ignored path or glob pattern.'))
          .describe('Ignore patterns applied to the Knowledge processing scope.'),
        estimatedProcessingBytes: z
          .number()
          .describe('Estimated byte size of notes included in the current processing scope.'),
      })
      .describe('Preview of the effective Knowledge processing scope.'),
    linksCount: z.number().describe('Total resolved link count in the workspace graph.'),
    unresolvedLinksCount: z
      .number()
      .describe('Total unresolved link count in the workspace graph.'),
    isolatedNotes: z.number().describe('Count of notes without graph connections.'),
    backlinkHubs: z
      .array(
        z
          .object({
            path: z.string().describe('Vault-relative note path.'),
            backlinks: z.number().describe('Number of backlinks to this note.'),
          })
          .describe('High-backlink note candidate.'),
      )
      .describe('Notes with the most backlinks.'),
    topFolders: z
      .array(
        z
          .object({
            folder: z.string().describe('Vault folder path.'),
            count: z.number().describe('Number of notes in this folder.'),
          })
          .describe('Folder note-count summary.'),
      )
      .describe('Folders with the highest note counts.'),
    topTags: z
      .array(
        z
          .object({
            tag: z.string().describe('Tag name.'),
            count: z.number().describe('Number of notes with this tag.'),
          })
          .describe('Tag usage summary.'),
      )
      .describe('Most common tags in the workspace.'),
    commonProperties: z
      .array(
        z
          .object({
            property: z.string().describe('Frontmatter property name.'),
            count: z.number().describe('Number of notes using this property.'),
          })
          .describe('Frontmatter property usage summary.'),
      )
      .describe('Most common frontmatter properties.'),
    missingKeyProperties: z
      .number()
      .describe('Number of notes missing at least one of the top key properties.'),
    recentNotes: z
      .array(z.string().describe('Recently modified note path.'))
      .describe('Recently modified notes.'),
    staleHighCentralityNotes: z
      .array(z.string().describe('Stale high-centrality note path.'))
      .describe('Important notes that have not been updated recently.'),
    entryPoints: z
      .array(
        z
          .object({
            path: z.string().describe('Recommended entry point note path.'),
            score: z.number().describe('Entry point ranking score.'),
          })
          .describe('Recommended graph entry point.'),
      )
      .describe('Recommended notes for an agent to inspect first.'),
    projectNotes: z
      .array(z.string().describe('Project note path.'))
      .describe('Notes detected as project-oriented notes.'),
    ignoredPaths: z
      .array(z.string().describe('Ignored vault path.'))
      .describe('Vault paths ignored by Knowledge processing.'),
  })
  .describe('Compact Knowledge workspace summary for agent startup.');

export const obsidianKnowledgeWorkspaceBrief = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_workspace_brief',
  description:
    'Get a compact Knowledge workspace brief for agent startup: note counts, graph size, top tags, recent notes, and recommended entry points.',
  input: z.object({}).strict(),
  output: WorkspaceBriefResultSchema,
  path: '/api/brief',
  method: 'GET',

  format: ({ result }) => {
    const lines = [
      '**Knowledge Workspace Brief**',
      '',
      '### Identity & Size',
      `- Status: ${result.status}`,
      `- Vault: ${result.vaultName}`,
      `- Markdown notes: ${result.filesCount}`,
      `- Attachments: ${result.attachmentCount}`,
      `- Scope notes: ${result.scopePreview.noteCount}`,
      `- Scope attachments: ${result.scopePreview.attachmentCount}`,
      `- Scope size estimate: ${result.scopePreview.estimatedProcessingBytes} bytes`,
      `- Included folders: ${result.scopePreview.includedFolders.length > 0 ? result.scopePreview.includedFolders.join(', ') : 'all'}`,
      `- Excluded folders: ${result.scopePreview.excludedFolders.length > 0 ? result.scopePreview.excludedFolders.join(', ') : 'none'}`,
      '',
      '### Graph Summary',
      `- Total links: ${result.linksCount}`,
      `- Unresolved links: ${result.unresolvedLinksCount}`,
      `- Isolated notes: ${result.isolatedNotes}`,
      `- Ignored paths (boundary): ${result.scopePreview.ignoredPatterns.length > 0 ? result.scopePreview.ignoredPatterns.join(', ') : 'none'}`,
    ];
    if (result.backlinkHubs.length) {
      lines.push(
        '- Backlink hubs:',
        ...result.backlinkHubs.map((h) => `  - ${h.path}: ${h.backlinks}`),
      );
    }

    if (result.topFolders.length) {
      lines.push(
        '',
        '### Top Folders',
        ...result.topFolders.map((f) => `- ${f.folder}: ${f.count}`),
      );
    }
    if (result.topTags.length) {
      lines.push(
        '',
        '### Metadata - Top Tags',
        ...result.topTags.map((t) => `- ${t.tag}: ${t.count}`),
      );
    }
    if (result.commonProperties.length) {
      lines.push(
        '',
        '### Metadata - Common Properties',
        ...result.commonProperties.map((p) => `- ${p.property}: ${p.count}`),
      );
      lines.push(
        `- Notes missing at least one of the top 3 key properties: ${result.missingKeyProperties}`,
      );
    }
    if (result.recentNotes.length) {
      lines.push('', '### Activity - Recent Notes', ...result.recentNotes.map((n) => `- ${n}`));
    }
    if (result.staleHighCentralityNotes.length) {
      lines.push(
        '',
        '### Activity - Stale High-Centrality Hubs',
        ...result.staleHighCentralityNotes.map((n) => `- ${n}`),
      );
    }
    if (result.entryPoints.length) {
      lines.push(
        '',
        '### Entry Points - Top Hubs',
        ...result.entryPoints.map((e) => `- ${e.path} (${e.score})`),
      );
    }
    if (result.projectNotes.length) {
      lines.push(
        '',
        '### Entry Points - Project Notes',
        ...result.projectNotes.map((n) => `- ${n}`),
      );
    }
    if (result.ignoredPaths.length) {
      lines.push('', '### Ignored Paths', ...result.ignoredPaths.map((p) => `- ${p}`));
    }

    return [{ type: 'text', text: lines.join('\n') }];
  },
});
