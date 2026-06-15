import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const SmartSearchHitSchema = z.object({
  path: z.string(),
  title: z.string().optional(),
  score: z.number(),
  originalScore: z.number().optional(),
  graphScore: z.number().optional(),
  source: z.string().optional(),
  excerpt: z.string().optional(),
  matches: z.array(z.unknown()).optional(),
  why: z.array(z.string()).optional(),
});
const SmartSearchQueryReportSchema = z.object({
  source: z.string(),
  fallbackUsed: z.boolean(),
  resultCount: z.number(),
  warnings: z.array(z.string()),
});
const SmartSearchResultSchema = z.object({
  status: z.string(),
  query: z.string(),
  results: z.array(SmartSearchHitSchema),
  queryReport: SmartSearchQueryReportSchema.optional(),
});

export const obsidianKnowledgeSmartSearch = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_smart_search',
  description:
    'Run Knowledge smart search through the Obsidian plugin: ranked text retrieval enriched with graph signals from vault links.',
  input: z.object({
    query: z.string().min(1).describe('Search query.'),
    limit: z.number().int().positive().max(50).default(20).describe('Maximum hits to return.'),
    intent: z.enum(['lookup', 'research', 'decision', 'cleanup', 'bootstrap']).optional().describe('Search intent adjusts scoring weights.'),
    filters: z.object({
      pathPrefix: z.string().optional(),
      tags: z.array(z.string()).optional(),
      fileTypes: z.array(z.string()).optional(),
      modifiedAfter: z.number().optional(),
      modifiedBefore: z.number().optional(),
    }).optional().describe('Optional metadata filters.'),
  }),
  output: SmartSearchResultSchema,
  path: '/api/search',
  gatekeeper: { requireHealth: true },

  format: ({ result }) => {
    const lines = [`**Knowledge Smart Search: "${result.query}"**`];
    if (result.queryReport?.fallbackUsed) {
      lines.push(`> [!WARNING] Omnisearch unavailable, used text fallback.`);
    }
    lines.push(`Found: ${result.results.length}`);
    for (const r of result.results) {
      lines.push(`- ${r.path} (score: ${r.score.toFixed(2)})`);
      if (r.why && r.why.length > 0) lines.push(`  Why: ${r.why.join(', ')}`);
      if (r.excerpt) lines.push(`  ${r.excerpt.slice(0, 240)}`);
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
