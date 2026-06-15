import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const JanitorScanResultSchema = z.object({
  unstructuredNotes: z.array(z.string()).describe('List of note paths that are missing the OKF minimum `type` field.'),
  scannedCount: z.number().describe('Total number of notes scanned in the targeted area.'),
});

export const obsidianKnowledgeJanitorScan = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_janitor_scan',
  description:
    'Scans the Obsidian vault (or a specific folder) to find notes that lack the required Open Knowledge Format (OKF) `type` frontmatter field. Reserved OKF files such as index.md and log.md are ignored.',
  input: z.object({
    folder: z.string().optional().describe('Optional folder path to restrict the scan. If omitted, scans the entire vault.'),
  }),
  output: JanitorScanResultSchema,
  path: '/api/janitor-scan',

  format: ({ result }) => {
    const lines = [
      `**Janitor Scan Complete**`,
      `Scanned: ${result.scannedCount} notes`,
      '',
      `Unstructured Notes (${result.unstructuredNotes.length}):`,
      ...(result.unstructuredNotes.length === 0 
        ? ['- No notes missing OKF type found.'] 
        : result.unstructuredNotes.map((note) => `- ${note}`))
    ];
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
